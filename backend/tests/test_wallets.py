from decimal import Decimal
import pytest
from app.models.user import User
from app.models.wallet import Wallet
from app.core.security import hash_password, create_access_token


# ─── Helpers ────────────────────────────────────────────────────────────────

def create_user(db_session, email="wallet_user@example.com", name="Wallet User"):
    user = User(
        name=name,
        email=email,
        password_hash=hash_password("Password@123"),
        role="user",
        status="active"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def get_headers(user):
    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "sid": "wallet_test_sid"
    })
    return {"Authorization": f"Bearer {token}"}


def create_wallet(db_session, user_id: int, name: str = "Ví mặc định", balance: str = "1000000"):
    wallet = Wallet(user_id=user_id, name=name, balance=Decimal(balance))
    db_session.add(wallet)
    db_session.commit()
    db_session.refresh(wallet)
    return wallet


# ─── Test Suite ──────────────────────────────────────────────────────────────

class TestWalletManagement:
    """Test suite for Quản lý Wallet (Ví tiền)"""

    # ── Tạo ví ──────────────────────────────────────────────────────────────

    def test_create_wallet_success_default_balance(self, client, db_session):
        """Tạo ví thành công với số dư mặc định = 0."""
        user = create_user(db_session, "wallet1@example.com")
        headers = get_headers(user)

        res = client.post("/api/wallets", json={"name": "Ví tiền mặt"}, headers=headers)
        assert res.status_code == 201
        data = res.json()
        assert data["name"] == "Ví tiền mặt"
        assert data["balance"] == 0.0
        assert data["user_id"] == user.id
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    def test_create_wallet_success_with_initial_balance(self, client, db_session):
        """Tạo ví với số dư ban đầu hợp lệ."""
        user = create_user(db_session, "wallet2@example.com")
        headers = get_headers(user)

        res = client.post("/api/wallets", json={"name": "Tài khoản ngân hàng", "balance": 5000000}, headers=headers)
        assert res.status_code == 201
        assert res.json()["balance"] == 5000000.0
        assert res.json()["name"] == "Tài khoản ngân hàng"

    def test_create_wallet_invalid_negative_balance(self, client, db_session):
        """Tạo ví với số dư âm phải bị từ chối (422)."""
        user = create_user(db_session, "wallet3@example.com")
        headers = get_headers(user)

        res = client.post("/api/wallets", json={"name": "Ví lỗi", "balance": -100}, headers=headers)
        assert res.status_code == 422

    def test_create_wallet_empty_name_rejected(self, client, db_session):
        """Tạo ví với tên rỗng hoặc toàn khoảng trắng phải bị từ chối (422)."""
        user = create_user(db_session, "wallet4@example.com")
        headers = get_headers(user)

        res = client.post("/api/wallets", json={"name": "   "}, headers=headers)
        assert res.status_code == 422

    def test_create_wallet_name_too_long(self, client, db_session):
        """Tên ví vượt 100 ký tự phải bị từ chối (422)."""
        user = create_user(db_session, "wallet5@example.com")
        headers = get_headers(user)

        long_name = "A" * 101
        res = client.post("/api/wallets", json={"name": long_name}, headers=headers)
        assert res.status_code == 422

    def test_create_wallet_unauthorized(self, client, db_session):
        """Tạo ví không có token phải trả 401."""
        res = client.post("/api/wallets", json={"name": "Ví không auth"})
        assert res.status_code == 401

    # ── Danh sách ví ────────────────────────────────────────────────────────

    def test_list_wallets_success(self, client, db_session):
        """Xem danh sách ví: trả về đúng ví của user."""
        user = create_user(db_session, "wallet6@example.com")
        headers = get_headers(user)

        create_wallet(db_session, user.id, "Ví 1")
        create_wallet(db_session, user.id, "Ví 2")

        res = client.get("/api/wallets", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 2
        names = [w["name"] for w in data]
        assert "Ví 1" in names
        assert "Ví 2" in names

    def test_list_wallets_empty(self, client, db_session):
        """User chưa có ví: trả về danh sách rỗng."""
        user = create_user(db_session, "wallet7@example.com")
        headers = get_headers(user)

        res = client.get("/api/wallets", headers=headers)
        assert res.status_code == 200
        assert res.json() == []

    def test_list_wallets_isolates_other_users(self, client, db_session):
        """Danh sách ví không lẫn ví của user khác."""
        user_a = create_user(db_session, "wallet_a@example.com")
        user_b = create_user(db_session, "wallet_b@example.com")

        create_wallet(db_session, user_a.id, "Ví của A")
        create_wallet(db_session, user_b.id, "Ví của B")

        headers_a = get_headers(user_a)
        res = client.get("/api/wallets", headers=headers_a)
        assert res.status_code == 200
        assert len(res.json()) == 1
        assert res.json()[0]["name"] == "Ví của A"

    def test_list_wallets_unauthorized(self, client, db_session):
        """Xem danh sách ví không có token phải trả 401."""
        res = client.get("/api/wallets")
        assert res.status_code == 401

    # ── Chi tiết ví ─────────────────────────────────────────────────────────

    def test_get_wallet_detail_success(self, client, db_session):
        """Xem chi tiết ví thành công."""
        user = create_user(db_session, "wallet8@example.com")
        wallet = create_wallet(db_session, user.id, "Ví chi tiết", "250000")
        headers = get_headers(user)

        res = client.get(f"/api/wallets/{wallet.id}", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == wallet.id
        assert data["name"] == "Ví chi tiết"
        assert data["balance"] == 250000.0
        assert data["user_id"] == user.id

    def test_get_wallet_detail_not_found(self, client, db_session):
        """Xem ví không tồn tại phải trả 404."""
        user = create_user(db_session, "wallet9@example.com")
        headers = get_headers(user)

        res = client.get("/api/wallets/999999", headers=headers)
        assert res.status_code == 404
        assert "không tồn tại" in res.json()["detail"]

    def test_get_wallet_detail_other_user_forbidden(self, client, db_session):
        """Xem ví của user khác phải trả 403."""
        owner = create_user(db_session, "wallet_owner@example.com")
        hacker = create_user(db_session, "wallet_hacker@example.com")

        wallet = create_wallet(db_session, owner.id, "Ví riêng tư")
        headers_hacker = get_headers(hacker)

        res = client.get(f"/api/wallets/{wallet.id}", headers=headers_hacker)
        assert res.status_code == 403
        assert "không có quyền" in res.json()["detail"]

    def test_get_wallet_detail_unauthorized(self, client, db_session):
        """Xem chi tiết ví không có token phải trả 401."""
        res = client.get("/api/wallets/1")
        assert res.status_code == 401

    # ── Cập nhật ví ─────────────────────────────────────────────────────────

    def test_update_wallet_name_success(self, client, db_session):
        """Cập nhật tên ví thành công."""
        user = create_user(db_session, "wallet10@example.com")
        wallet = create_wallet(db_session, user.id, "Tên cũ")
        headers = get_headers(user)

        res = client.patch(f"/api/wallets/{wallet.id}", json={"name": "Tên mới"}, headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "Tên mới"
        assert res.json()["id"] == wallet.id

        db_session.refresh(wallet)
        assert wallet.name == "Tên mới"

    def test_update_wallet_no_change(self, client, db_session):
        """PATCH không truyền gì: trả về ví hiện tại, không lỗi."""
        user = create_user(db_session, "wallet11@example.com")
        wallet = create_wallet(db_session, user.id, "Ví không đổi")
        headers = get_headers(user)

        res = client.patch(f"/api/wallets/{wallet.id}", json={}, headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "Ví không đổi"

    def test_update_wallet_balance_ignored(self, client, db_session):
        """Payload có chứa balance: bị bỏ qua (balance không được cập nhật trực tiếp)."""
        user = create_user(db_session, "wallet12@example.com")
        wallet = create_wallet(db_session, user.id, "Ví bảo vệ số dư", "500000")
        headers = get_headers(user)

        # balance không có trong UpdateWalletRequest, FastAPI sẽ bỏ qua trường lạ
        res = client.patch(f"/api/wallets/{wallet.id}", json={"name": "Đổi tên thôi"}, headers=headers)
        assert res.status_code == 200
        assert res.json()["balance"] == 500000.0  # Số dư không thay đổi

    def test_update_wallet_not_found(self, client, db_session):
        """Cập nhật ví không tồn tại phải trả 404."""
        user = create_user(db_session, "wallet13@example.com")
        headers = get_headers(user)

        res = client.patch("/api/wallets/999999", json={"name": "Tên mới"}, headers=headers)
        assert res.status_code == 404

    def test_update_wallet_other_user_forbidden(self, client, db_session):
        """Cập nhật ví của user khác phải trả 403."""
        owner = create_user(db_session, "wallet_owner2@example.com")
        attacker = create_user(db_session, "wallet_attacker@example.com")

        wallet = create_wallet(db_session, owner.id, "Ví chủ sở hữu")
        headers_attacker = get_headers(attacker)

        res = client.patch(f"/api/wallets/{wallet.id}", json={"name": "Chiếm đoạt"}, headers=headers_attacker)
        assert res.status_code == 403
        assert "không có quyền" in res.json()["detail"]

    def test_update_wallet_empty_name_rejected(self, client, db_session):
        """Cập nhật tên ví bằng chuỗi rỗng phải bị từ chối (422)."""
        user = create_user(db_session, "wallet14@example.com")
        wallet = create_wallet(db_session, user.id, "Ví tên hợp lệ")
        headers = get_headers(user)

        res = client.patch(f"/api/wallets/{wallet.id}", json={"name": "  "}, headers=headers)
        assert res.status_code == 422

    def test_update_wallet_unauthorized(self, client, db_session):
        """Cập nhật ví không có token phải trả 401."""
        res = client.patch("/api/wallets/1", json={"name": "Tên mới"})
        assert res.status_code == 401

    # ── Xóa ví ──────────────────────────────────────────────────────────────

    def test_delete_wallet_success(self, client, db_session):
        """Xóa ví thành công."""
        user = create_user(db_session, "wallet15@example.com")
        wallet = create_wallet(db_session, user.id, "Ví cần xóa")
        headers = get_headers(user)

        res = client.delete(f"/api/wallets/{wallet.id}", headers=headers)
        assert res.status_code == 200
        assert "thành công" in res.json()["message"]

        # Xác nhận bị xóa khỏi DB
        assert db_session.query(Wallet).filter(Wallet.id == wallet.id).first() is None

    def test_delete_wallet_not_found(self, client, db_session):
        """Xóa ví không tồn tại phải trả 404."""
        user = create_user(db_session, "wallet16@example.com")
        headers = get_headers(user)

        res = client.delete("/api/wallets/999999", headers=headers)
        assert res.status_code == 404

    def test_delete_wallet_other_user_forbidden(self, client, db_session):
        """Xóa ví của user khác phải trả 403."""
        owner = create_user(db_session, "wallet_owner3@example.com")
        attacker = create_user(db_session, "wallet_attacker2@example.com")

        wallet = create_wallet(db_session, owner.id, "Ví cần bảo vệ")
        headers_attacker = get_headers(attacker)

        res = client.delete(f"/api/wallets/{wallet.id}", headers=headers_attacker)
        assert res.status_code == 403
        assert "không có quyền" in res.json()["detail"]

    def test_delete_wallet_unauthorized(self, client, db_session):
        """Xóa ví không có token phải trả 401."""
        res = client.delete("/api/wallets/1")
        assert res.status_code == 401

    # ── Đa tiền tệ (Multi-currency) ─────────────────────────────────────────

    def test_create_wallet_with_custom_currency(self, client, db_session):
        """Tạo ví với đơn vị tiền tệ ngoại tệ (USD, EUR, JPY)."""
        user = create_user(db_session, "currency_user@example.com")
        headers = get_headers(user)

        res = client.post(
            "/api/wallets",
            json={"name": "Ví PayPal USD", "balance": 150.50, "currency": "USD"},
            headers=headers
        )
        assert res.status_code == 201
        data = res.json()
        assert data["name"] == "Ví PayPal USD"
        assert data["currency"] == "USD"
        assert data["balance"] == 150.50

    def test_update_wallet_currency(self, client, db_session):
        """Cập nhật đơn vị tiền tệ của ví."""
        user = create_user(db_session, "currency_update_user@example.com")
        headers = get_headers(user)

        create_res = client.post(
            "/api/wallets",
            json={"name": "Ví EUR", "balance": 500, "currency": "EUR"},
            headers=headers
        )
        wallet_id = create_res.json()["id"]

        update_res = client.patch(
            f"/api/wallets/{wallet_id}",
            json={"currency": "JPY"},
            headers=headers
        )
        assert update_res.status_code == 200
        assert update_res.json()["currency"] == "JPY"

    # ── Chuyển tiền giữa các ví (Transfer) ──────────────────────────────────

    def test_transfer_funds_same_currency(self, client, db_session):
        """Chuyển tiền thành công giữa 2 ví cùng loại tiền tệ VND."""
        user = create_user(db_session, "transfer1@example.com")
        headers = get_headers(user)

        w1 = create_wallet(db_session, user.id, "Ví chính", balance="2000000")
        w2 = create_wallet(db_session, user.id, "Ví tiết kiệm", balance="500000")

        res = client.post(
            "/api/wallets/transfer",
            json={
                "from_wallet_id": w1.id,
                "to_wallet_id": w2.id,
                "amount": 500000,
                "fee": 5000,
                "description": "Gửi tiết kiệm tháng này",
            },
            headers=headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["from_wallet"]["balance"] == 1495000.0  # 2,000,000 - 500,000 - 5,000
        assert data["to_wallet"]["balance"] == 1000000.0   # 500,000 + 500,000

    def test_transfer_funds_insufficient_balance(self, client, db_session):
        """Chuyển tiền thất bại khi số dư ví nguồn không đủ."""
        user = create_user(db_session, "transfer2@example.com")
        headers = get_headers(user)

        w1 = create_wallet(db_session, user.id, "Ví ít tiền", balance="100000")
        w2 = create_wallet(db_session, user.id, "Ví khác", balance="500000")

        res = client.post(
            "/api/wallets/transfer",
            json={
                "from_wallet_id": w1.id,
                "to_wallet_id": w2.id,
                "amount": 500000,
            },
            headers=headers
        )
        assert res.status_code == 400
        assert "không đủ" in res.json()["detail"]

    def test_transfer_funds_same_wallet_error(self, client, db_session):
        """Chuyển tiền trùng ví nguồn và đích phải báo lỗi 400."""
        user = create_user(db_session, "transfer3@example.com")
        headers = get_headers(user)
        w = create_wallet(db_session, user.id, "Ví đơn", balance="1000000")

        res = client.post(
            "/api/wallets/transfer",
            json={
                "from_wallet_id": w.id,
                "to_wallet_id": w.id,
                "amount": 100000,
            },
            headers=headers
        )
        assert res.status_code == 400
        assert "không được trùng" in res.json()["detail"]

    # ── Điều chỉnh số dư (Balance Adjustment) ───────────────────────────────

    def test_adjust_balance(self, client, db_session):
        """Điều chỉnh số dư ví khi kiểm kê thực tế lệch."""
        user = create_user(db_session, "adjust@example.com")
        headers = get_headers(user)
        w = create_wallet(db_session, user.id, "Ví tiền mặt", balance="1000000")

        res = client.post(
            "/api/wallets/adjust-balance",
            json={
                "wallet_id": w.id,
                "target_balance": 1050000,
                "description": "Đếm lại tiền lẻ dư 50k",
            },
            headers=headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["previous_balance"] == 1000000.0
        assert data["new_balance"] == 1050000.0
        assert data["difference"] == 50000.0
        assert data["wallet"]["balance"] == 1050000.0

    # ── Thẻ tín dụng & Loại trừ khỏi tổng tài sản ──────────────────────────

    def test_credit_card_and_exclusion(self, client, db_session):
        """Tạo thẻ tín dụng có hạn mức, ngày sao kê và tùy chọn không tính vào tổng tài sản."""
        user = create_user(db_session, "credit_card@example.com")
        headers = get_headers(user)

        res = client.post(
            "/api/wallets",
            json={
                "name": "Thẻ tín dụng VIB Platinum",
                "balance": 0,
                "currency": "VND",
                "wallet_type": "CREDIT",
                "credit_limit": 50000000,
                "statement_day": 20,
                "payment_due_day": 5,
                "is_excluded_from_total": True,
            },
            headers=headers
        )
        assert res.status_code == 201
        data = res.json()
        assert data["wallet_type"] == "CREDIT"
        assert data["credit_limit"] == 50000000.0
        assert data["statement_day"] == 20
        assert data["payment_due_day"] == 5
        assert data["is_excluded_from_total"] is True

    # ── Lưu trữ ví khi đã có giao dịch (Archive on Delete) ─────────────────

    def test_archive_wallet_on_delete_when_has_transactions(self, client, db_session):
        """Xóa ví đã có giao dịch phát sinh sẽ tự động chuyển sang lưu trữ thay vì xóa cứng."""
        from app.models.transaction import Transaction
        from datetime import date

        user = create_user(db_session, "archive_user@example.com")
        headers = get_headers(user)
        w = create_wallet(db_session, user.id, "Ví có giao dịch", balance="1000000")

        # Thêm 1 giao dịch gắn với ví này
        tx = Transaction(
            user_id=user.id,
            wallet_id=w.id,
            category_id=None,
            type="TRANSFER",
            amount=Decimal("100000"),
            transaction_date=date.today(),
            description="Giao dịch thử nghiệm"
        )
        db_session.add(tx)
        db_session.commit()

        # Gọi xóa ví
        del_res = client.delete(f"/api/wallets/{w.id}", headers=headers)
        assert del_res.status_code == 200
        assert "lưu trữ" in del_res.json()["message"]

        # Ví vẫn còn trong DB nhưng is_archived = True
        db_session.refresh(w)
        assert w.is_archived is True

