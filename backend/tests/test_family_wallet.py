import pytest
from fastapi import status
from app.models.user import User
from app.models.wallet import Wallet
from app.models.category import Category
from app.core.security import hash_password, create_access_token


def create_test_user(db_session, email="owner@example.com", name="Chủ Ví"):
    user = User(
        email=email,
        name=name,
        password_hash=hash_password("password123"),
        role="user",
        status="active"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def get_auth_headers(user):
    token = create_access_token(data={
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "sid": "test_sid_family"
    })
    return {"Authorization": f"Bearer {token}"}


class TestFamilySharedWallet:
    def test_invite_member_success(self, client, db_session):
        owner = create_test_user(db_session, "owner@example.com", "Chủ Hộ")
        member = create_test_user(db_session, "wife@example.com", "Vợ Yêu")

        owner_headers = get_auth_headers(owner)

        # 1. Chủ ví tạo ví gia đình
        create_res = client.post(
            "/api/wallets",
            json={"name": "Ví Quỹ Gia Đình", "balance": 10000000},
            headers=owner_headers
        )
        assert create_res.status_code == status.HTTP_201_CREATED
        wallet_id = create_res.json()["id"]

        # 2. Mời thành viên quyền VIEWER
        invite_res = client.post(
            f"/api/wallets/{wallet_id}/members",
            json={"email": "wife@example.com", "role": "VIEWER"},
            headers=owner_headers
        )
        assert invite_res.status_code == status.HTTP_201_CREATED
        data = invite_res.json()
        assert data["email"] == "wife@example.com"
        assert data["role"] == "VIEWER"
        assert data["user_id"] == member.id
        assert data["name"] == "Vợ Yêu"

        # 3. Kiểm tra danh sách thành viên
        list_res = client.get(f"/api/wallets/{wallet_id}/members", headers=owner_headers)
        assert list_res.status_code == status.HTTP_200_OK
        members = list_res.json()
        assert len(members) == 1
        assert members[0]["email"] == "wife@example.com"

    def test_invite_self_fails(self, client, db_session):
        owner = create_test_user(db_session, "owner2@example.com")
        owner_headers = get_auth_headers(owner)

        create_res = client.post(
            "/api/wallets",
            json={"name": "Ví Cá Nhân", "balance": 1000000},
            headers=owner_headers
        )
        wallet_id = create_res.json()["id"]

        # Thử mời chính mình
        invite_res = client.post(
            f"/api/wallets/{wallet_id}/members",
            json={"email": "owner2@example.com", "role": "VIEWER"},
            headers=owner_headers
        )
        assert invite_res.status_code == status.HTTP_400_BAD_REQUEST
        assert "không thể mời chính mình" in invite_res.json()["detail"].lower()

    def test_member_permissions_viewer_vs_editor(self, client, db_session):
        owner = create_test_user(db_session, "husband@example.com", "Chồng")
        member = create_test_user(db_session, "member@example.com", "Con Trai")
        owner_headers = get_auth_headers(owner)
        member_headers = get_auth_headers(member)

        # Tạo category chi tiêu
        cat = Category(name="Tiền học phí", type="EXPENSE", user_id=None)
        db_session.add(cat)
        db_session.commit()
        db_session.refresh(cat)

        # Chủ ví tạo ví chung
        create_res = client.post(
            "/api/wallets",
            json={"name": "Ví Nuôi Con", "balance": 5000000},
            headers=owner_headers
        )
        wallet_id = create_res.json()["id"]

        # Mời thành viên ban đầu quyền VIEWER
        invite_res = client.post(
            f"/api/wallets/{wallet_id}/members",
            json={"email": "member@example.com", "role": "VIEWER"},
            headers=owner_headers
        )
        assert invite_res.status_code == status.HTTP_201_CREATED
        member_record_id = invite_res.json()["id"]

        # Thành viên kiểm tra danh sách ví của mình
        member_wallets_res = client.get("/api/wallets", headers=member_headers)
        assert member_wallets_res.status_code == status.HTTP_200_OK
        wallets = member_wallets_res.json()
        assert len(wallets) == 1
        shared_wallet = wallets[0]
        assert shared_wallet["id"] == wallet_id
        assert shared_wallet["is_shared"] is True
        assert shared_wallet["is_owner"] is False
        assert shared_wallet["my_role"] == "VIEWER"
        assert shared_wallet["owner_name"] == "Chồng"

        # 4. VIEWER thử thêm giao dịch -> PHẢI BỊ CHẶN 403 Forbidden!
        tx_fail_res = client.post(
            "/api/transactions",
            json={
                "wallet_id": wallet_id,
                "category_id": cat.id,
                "amount": 500000,
                "type": "EXPENSE",
                "description": "Mua sách vở",
                "transaction_date": "2026-10-01"
            },
            headers=member_headers
        )
        assert tx_fail_res.status_code == status.HTTP_403_FORBIDDEN
        assert "chỉ có quyền xem" in tx_fail_res.json()["detail"].lower()

        # 5. Chủ ví thăng cấp quyền cho thành viên thành EDITOR
        update_role_res = client.patch(
            f"/api/wallets/{wallet_id}/members/{member_record_id}",
            json={"role": "EDITOR"},
            headers=owner_headers
        )
        assert update_role_res.status_code == status.HTTP_200_OK
        assert update_role_res.json()["role"] == "EDITOR"

        # 6. Bây giờ EDITOR thêm giao dịch -> THÀNH CÔNG!
        tx_success_res = client.post(
            "/api/transactions",
            json={
                "wallet_id": wallet_id,
                "category_id": cat.id,
                "amount": 500000,
                "type": "EXPENSE",
                "description": "Mua sách vở",
                "transaction_date": "2026-10-01"
            },
            headers=member_headers
        )
        assert tx_success_res.status_code == status.HTTP_201_CREATED

        # 7. Kiểm tra số dư ví giảm chính xác
        wallet_detail_res = client.get(f"/api/wallets/{wallet_id}", headers=owner_headers)
        assert wallet_detail_res.status_code == status.HTTP_200_OK
        assert wallet_detail_res.json()["balance"] == 4500000.0

    def test_leave_and_remove_member(self, client, db_session):
        owner = create_test_user(db_session, "boss@example.com")
        member1 = create_test_user(db_session, "sub1@example.com")
        member2 = create_test_user(db_session, "sub2@example.com")

        owner_headers = get_auth_headers(owner)
        m1_headers = get_auth_headers(member1)

        create_res = client.post("/api/wallets", json={"name": "Ví Quỹ Nhóm"}, headers=owner_headers)
        wallet_id = create_res.json()["id"]

        # Mời cả 2 thành viên
        inv1 = client.post(f"/api/wallets/{wallet_id}/members", json={"email": "sub1@example.com"}, headers=owner_headers)
        inv2 = client.post(f"/api/wallets/{wallet_id}/members", json={"email": "sub2@example.com"}, headers=owner_headers)
        m2_record_id = inv2.json()["id"]

        # Member 1 tự rời ví
        leave_res = client.post(f"/api/wallets/{wallet_id}/leave", headers=m1_headers)
        assert leave_res.status_code == status.HTTP_200_OK

        # Owner xóa Member 2
        del_res = client.delete(f"/api/wallets/{wallet_id}/members/{m2_record_id}", headers=owner_headers)
        assert del_res.status_code == status.HTTP_200_OK

        # Kiểm tra danh sách thành viên trống và is_shared chuyển về False
        members_res = client.get(f"/api/wallets/{wallet_id}/members", headers=owner_headers)
        assert len(members_res.json()) == 0

        detail_res = client.get(f"/api/wallets/{wallet_id}", headers=owner_headers)
        assert detail_res.json()["is_shared"] is False
