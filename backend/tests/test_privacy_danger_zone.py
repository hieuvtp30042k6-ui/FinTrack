import pytest
from datetime import date
from app.models.user import User
from app.models.wallet import Wallet
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.core.security import hash_password, create_access_token


@pytest.fixture
def danger_zone_setup(db_session):
    user = User(
        name="User Danger",
        email="danger@example.com",
        password_hash=hash_password("DangerPassword@123"),
        role="user",
        status="active",
        google_id="google-sub-123456"
    )
    super_admin = User(
        name="Super Admin Danger",
        email="superdanger@example.com",
        password_hash=hash_password("SuperAdmin@123"),
        role="super_admin",
        status="active"
    )
    db_session.add_all([user, super_admin])
    db_session.commit()
    db_session.refresh(user)
    db_session.refresh(super_admin)

    # Thêm ví và giao dịch cho user
    w1 = Wallet(name="Ví Test 1", balance=500000.0, user_id=user.id)
    w2 = Wallet(name="Ví Test 2", balance=200000.0, user_id=user.id)
    db_session.add_all([w1, w2])
    db_session.commit()
    db_session.refresh(w1)

    t1 = Transaction(user_id=user.id, wallet_id=w1.id, type="EXPENSE", amount=50000.0, transaction_date=date(2026, 10, 1))
    b1 = Budget(user_id=user.id, category_id=None, amount=1000000.0, start_date=date(2026, 10, 1), end_date=date(2026, 10, 31))
    db_session.add_all([t1, b1])
    db_session.commit()

    return {"user": user, "super_admin": super_admin, "wallet": w1}


def test_get_connected_apps(client, danger_zone_setup):
    user = danger_zone_setup["user"]
    token = create_access_token(data={"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/users/me/connected-apps", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "apps" in data
    google_app = next((a for a in data["apps"] if a["provider"] == "google"), None)
    assert google_app is not None
    assert google_app["connected"] is True


def test_revoke_connected_app_success(client, danger_zone_setup, db_session):
    user = danger_zone_setup["user"]
    token = create_access_token(data={"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/users/me/connected-apps/google/revoke", headers=headers)
    assert res.status_code == 200
    assert "Đã hủy liên kết tài khoản Google thành công" in res.json()["message"]

    # Verify db
    db_session.refresh(user)
    assert user.google_id is None


def test_reset_data_wrong_confirmation(client, danger_zone_setup):
    user = danger_zone_setup["user"]
    token = create_access_token(data={"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/api/users/me/reset-data",
        headers=headers,
        json={"password": "DangerPassword@123", "confirmation_text": "WRONG TEXT"}
    )
    assert res.status_code == 400
    assert "Cụm từ xác nhận không chính xác" in res.json()["detail"]


def test_reset_data_wrong_password(client, danger_zone_setup):
    user = danger_zone_setup["user"]
    token = create_access_token(data={"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/api/users/me/reset-data",
        headers=headers,
        json={"password": "WrongPassword@123", "confirmation_text": "RESET DATA"}
    )
    assert res.status_code == 400
    assert "Mật khẩu xác nhận không chính xác" in res.json()["detail"]


def test_reset_data_success(client, danger_zone_setup, db_session):
    user = danger_zone_setup["user"]
    token = create_access_token(data={"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/api/users/me/reset-data",
        headers=headers,
        json={"password": "DangerPassword@123", "confirmation_text": "RESET DATA"}
    )
    assert res.status_code == 200
    assert "Đã làm mới dữ liệu thành công" in res.json()["message"]

    # Check database
    txs = db_session.query(Transaction).filter(Transaction.user_id == user.id).all()
    assert len(txs) == 0

    budgets = db_session.query(Budget).filter(Budget.user_id == user.id).all()
    assert len(budgets) == 0

    wallets = db_session.query(Wallet).filter(Wallet.user_id == user.id).all()
    assert len(wallets) == 1
    assert wallets[0].name == "Tiền mặt"
    assert wallets[0].balance == 0.0


def test_delete_account_super_admin_forbidden(client, danger_zone_setup):
    super_admin = danger_zone_setup["super_admin"]
    token = create_access_token(data={"sub": str(super_admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/api/users/me/delete-account",
        headers=headers,
        json={"password": "SuperAdmin@123", "confirmation_text": "XOA TAI KHOAN"}
    )
    assert res.status_code == 400
    assert "Super Admin" in res.json()["detail"]


def test_delete_account_success(client, danger_zone_setup, db_session):
    user = danger_zone_setup["user"]
    user_id = user.id
    token = create_access_token(data={"sub": str(user_id)})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/api/users/me/delete-account",
        headers=headers,
        json={"password": "DangerPassword@123", "confirmation_text": "XOA TAI KHOAN"}
    )
    assert res.status_code == 200
    assert "xóa vĩnh viễn" in res.json()["message"]

    # Verify user is deleted
    deleted_user = db_session.query(User).filter(User.id == user_id).first()
    assert deleted_user is None
