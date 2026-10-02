"""
Test suite – F02 Transaction Management
Coverage:
  - Thêm khoản thu / khoản chi thành công
  - Xem danh sách, chi tiết
  - Cập nhật giao dịch (bao gồm transaction_date)
  - Xóa giao dịch + hoàn lại số dư ví
  - Wallet/Category không tồn tại hoặc không thuộc user
  - type / amount / transaction_date không hợp lệ
  - Khoản chi vượt số dư Wallet → rejected
  - Wallet không bao giờ âm
  - Cập nhật không làm Wallet âm
  - Kiểm tra số dư sau mỗi thao tác
  - Rollback khi thất bại
  - Lọc theo ngày dùng transaction_date
  - Không đăng nhập → 401
"""
from decimal import Decimal
import pytest
from app.models.user import User
from app.models.wallet import Wallet
from app.models.category import Category
from app.core.security import hash_password, create_access_token


# ─── Helpers ──────────────────────────────────────────────────────────────────

def create_test_user(db_session, email="user@example.com", name="Test User"):
    user = User(
        name=name,
        email=email,
        password_hash=hash_password("Password@123"),
        role="user",
        status="active",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def get_auth_headers(user):
    token = create_access_token(
        {"sub": str(user.id), "email": user.email, "role": user.role, "sid": "test_sid"}
    )
    return {"Authorization": f"Bearer {token}"}


def make_wallet(db_session, user_id, balance="1000000.00", name="Ví chính"):
    w = Wallet(user_id=user_id, name=name, balance=Decimal(balance))
    db_session.add(w)
    db_session.commit()
    db_session.refresh(w)
    return w


def make_category(db_session, name, cat_type, user_id=None):
    c = Category(name=name, type=cat_type.upper(), user_id=user_id)
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)
    return c


# ─── F02.01 Thêm giao dịch ────────────────────────────────────────────────────

class TestCreateTransaction:

    def test_add_income_success(self, client, db_session):
        """Thêm khoản thu thành công → số dư ví tăng."""
        user = create_test_user(db_session, "income1@test.com")
        headers = get_auth_headers(user)
        wallet = make_wallet(db_session, user.id, "1000000.00")
        cat = make_category(db_session, "Lương", "INCOME")

        resp = client.post("/api/transactions", json={
            "wallet_id": wallet.id,
            "category_id": cat.id,
            "type": "income",
            "amount": 500000,
            "transaction_date": "2026-09-30",
            "description": "Nhận lương tháng 9",
        }, headers=headers)

        assert resp.status_code == 201
        data = resp.json()
        assert data["type"] == "INCOME"
        assert data["amount"] == 500000.0
        assert data["wallet_balance"] == 1500000.0
        assert data["transaction_date"] == "2026-09-30"
        assert data["user_id"] == user.id

        db_session.refresh(wallet)
        assert wallet.balance == Decimal("1500000.00")

    def test_add_expense_success(self, client, db_session):
        """Thêm khoản chi thành công → số dư ví giảm."""
        user = create_test_user(db_session, "expense1@test.com")
        headers = get_auth_headers(user)
        wallet = make_wallet(db_session, user.id, "2000000.00")
        cat = make_category(db_session, "Ăn uống", "EXPENSE")

        resp = client.post("/api/transactions", json={
            "wallet_id": wallet.id,
            "category_id": cat.id,
            "type": "expense",
            "amount": 350000,
            "transaction_date": "2026-09-15",
        }, headers=headers)

        assert resp.status_code == 201
        data = resp.json()
        assert data["type"] == "EXPENSE"
        assert data["amount"] == 350000.0
        assert data["wallet_balance"] == 1650000.0
        assert data["transaction_date"] == "2026-09-15"

        db_session.refresh(wallet)
        assert wallet.balance == Decimal("1650000.00")

    def test_add_transaction_unauthorized(self, client):
        """Không có token → 401."""
        resp = client.post("/api/transactions", json={
            "wallet_id": 1, "category_id": 1,
            "type": "expense", "amount": 100000,
            "transaction_date": "2026-09-30",
        })
        assert resp.status_code == 401

    def test_add_transaction_wallet_not_found(self, client, db_session):
        """Ví không tồn tại → 404."""
        user = create_test_user(db_session, "wnotfound@test.com")
        cat = make_category(db_session, "Đi lại", "EXPENSE")

        resp = client.post("/api/transactions", json={
            "wallet_id": 999999, "category_id": cat.id,
            "type": "expense", "amount": 50000,
            "transaction_date": "2026-09-30",
        }, headers=get_auth_headers(user))
        assert resp.status_code == 404
        assert "Ví không tồn tại" in resp.json()["detail"]

    def test_add_transaction_wallet_belongs_to_other_user(self, client, db_session):
        """Ví thuộc user khác → 403."""
        user_a = create_test_user(db_session, "walletA@test.com")
        user_b = create_test_user(db_session, "walletB@test.com")
        wallet_a = make_wallet(db_session, user_a.id)
        cat = make_category(db_session, "Mua sắm", "EXPENSE")

        resp = client.post("/api/transactions", json={
            "wallet_id": wallet_a.id, "category_id": cat.id,
            "type": "expense", "amount": 100000,
            "transaction_date": "2026-09-30",
        }, headers=get_auth_headers(user_b))
        assert resp.status_code == 403

    def test_add_transaction_category_not_found(self, client, db_session):
        """Danh mục không tồn tại → 404."""
        user = create_test_user(db_session, "catnotfound@test.com")
        wallet = make_wallet(db_session, user.id)

        resp = client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": 999999,
            "type": "expense", "amount": 50000,
            "transaction_date": "2026-09-30",
        }, headers=get_auth_headers(user))
        assert resp.status_code == 404
        assert "Danh mục không tồn tại" in resp.json()["detail"]

    def test_add_transaction_category_belongs_to_other_user(self, client, db_session):
        """Danh mục cá nhân của user khác → 403."""
        user_a = create_test_user(db_session, "catA@test.com")
        user_b = create_test_user(db_session, "catB@test.com")
        wallet_b = make_wallet(db_session, user_b.id)
        cat_a = make_category(db_session, "Danh mục riêng A", "EXPENSE", user_a.id)

        resp = client.post("/api/transactions", json={
            "wallet_id": wallet_b.id, "category_id": cat_a.id,
            "type": "expense", "amount": 50000,
            "transaction_date": "2026-09-30",
        }, headers=get_auth_headers(user_b))
        assert resp.status_code == 403
        assert "không thuộc quyền sở hữu" in resp.json()["detail"]

    def test_add_transaction_type_mismatch(self, client, db_session):
        """Loại giao dịch không khớp danh mục → 400."""
        user = create_test_user(db_session, "typemismatch@test.com")
        wallet = make_wallet(db_session, user.id)
        cat = make_category(db_session, "Hóa đơn điện", "EXPENSE")

        resp = client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "income",  # Không khớp với EXPENSE category
            "amount": 200000,
            "transaction_date": "2026-09-30",
        }, headers=get_auth_headers(user))
        assert resp.status_code == 400
        assert "không khớp" in resp.json()["detail"]

    def test_add_transaction_invalid_type(self, client, db_session):
        """type không hợp lệ → 422."""
        user = create_test_user(db_session, "invalidtype@test.com")
        wallet = make_wallet(db_session, user.id)
        cat = make_category(db_session, "Ăn uống", "EXPENSE")

        resp = client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "TRANSFER",  # Không hợp lệ
            "amount": 100000,
            "transaction_date": "2026-09-30",
        }, headers=get_auth_headers(user))
        assert resp.status_code == 422

    def test_add_transaction_amount_zero(self, client, db_session):
        """amount = 0 → 422."""
        user = create_test_user(db_session, "amount0@test.com")
        wallet = make_wallet(db_session, user.id)
        cat = make_category(db_session, "Giải trí", "EXPENSE")

        resp = client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "expense", "amount": 0,
            "transaction_date": "2026-09-30",
        }, headers=get_auth_headers(user))
        assert resp.status_code == 422

    def test_add_transaction_amount_negative(self, client, db_session):
        """amount âm → 422."""
        user = create_test_user(db_session, "amountneg@test.com")
        wallet = make_wallet(db_session, user.id)
        cat = make_category(db_session, "Giải trí", "EXPENSE")

        resp = client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "expense", "amount": -50000,
            "transaction_date": "2026-09-30",
        }, headers=get_auth_headers(user))
        assert resp.status_code == 422

    def test_add_transaction_date_missing(self, client, db_session):
        """transaction_date thiếu → 422."""
        user = create_test_user(db_session, "dateMissing@test.com")
        wallet = make_wallet(db_session, user.id)
        cat = make_category(db_session, "Ăn uống", "EXPENSE")

        resp = client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "expense", "amount": 50000,
            # Không có transaction_date
        }, headers=get_auth_headers(user))
        assert resp.status_code == 422

    def test_add_transaction_date_invalid_format(self, client, db_session):
        """transaction_date sai định dạng → 422."""
        user = create_test_user(db_session, "dateInvalid@test.com")
        wallet = make_wallet(db_session, user.id)
        cat = make_category(db_session, "Ăn uống", "EXPENSE")

        resp = client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "expense", "amount": 50000,
            "transaction_date": "30-09-2026",  # Sai format
        }, headers=get_auth_headers(user))
        assert resp.status_code == 422

    def test_expense_exceeds_wallet_balance_rejected(self, client, db_session):
        """Khoản chi > số dư ví → 400, ví không thay đổi."""
        user = create_test_user(db_session, "exceed@test.com")
        wallet = make_wallet(db_session, user.id, "100000.00")
        cat = make_category(db_session, "Mua sắm", "EXPENSE")

        resp = client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "expense", "amount": 150000,
            "transaction_date": "2026-09-30",
        }, headers=get_auth_headers(user))
        assert resp.status_code == 400
        assert "Số dư ví không đủ" in resp.json()["detail"]

        # Ví không thay đổi
        db_session.refresh(wallet)
        assert wallet.balance == Decimal("100000.00")

    def test_wallet_balance_never_negative(self, client, db_session):
        """Số dư ví không bao giờ âm sau khi từ chối khoản chi."""
        user = create_test_user(db_session, "neverNeg@test.com")
        wallet = make_wallet(db_session, user.id, "50000.00")
        cat = make_category(db_session, "Nhà ở", "EXPENSE")

        resp = client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "expense", "amount": 60000,
            "transaction_date": "2026-09-30",
        }, headers=get_auth_headers(user))
        assert resp.status_code == 400

        db_session.refresh(wallet)
        assert wallet.balance >= Decimal("0")


# ─── F02.02 Danh sách giao dịch ───────────────────────────────────────────────

class TestListTransactions:

    def test_list_transactions_success(self, client, db_session):
        """Xem danh sách trả về đúng giao dịch của user."""
        user = create_test_user(db_session, "list1@test.com")
        headers = get_auth_headers(user)
        wallet = make_wallet(db_session, user.id, "1000000.00")
        cat = make_category(db_session, "Lương", "INCOME")

        client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "income", "amount": 200000,
            "transaction_date": "2026-09-01",
        }, headers=headers)
        client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "income", "amount": 300000,
            "transaction_date": "2026-09-10",
        }, headers=headers)

        resp = client.get("/api/transactions", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

    def test_list_transactions_unauthorized(self, client):
        """Không có token → 401."""
        resp = client.get("/api/transactions")
        assert resp.status_code == 401

    def test_list_filter_by_type(self, client, db_session):
        """Lọc theo type=income."""
        user = create_test_user(db_session, "filterType@test.com")
        headers = get_auth_headers(user)
        wallet = make_wallet(db_session, user.id, "2000000.00")
        cat_income = make_category(db_session, "Thưởng", "INCOME")
        cat_expense = make_category(db_session, "Di chuyển", "EXPENSE")

        client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat_income.id,
            "type": "income", "amount": 500000,
            "transaction_date": "2026-09-01",
        }, headers=headers)
        client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat_expense.id,
            "type": "expense", "amount": 100000,
            "transaction_date": "2026-09-02",
        }, headers=headers)

        resp = client.get("/api/transactions?type=income", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert all(tx["type"] == "INCOME" for tx in data)
        assert len(data) == 1

    def test_list_filter_by_date_range(self, client, db_session):
        """Lọc theo from_date/to_date dùng transaction_date."""
        user = create_test_user(db_session, "filterDate@test.com")
        headers = get_auth_headers(user)
        wallet = make_wallet(db_session, user.id, "2000000.00")
        cat = make_category(db_session, "Lương", "INCOME")

        client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "income", "amount": 100000,
            "transaction_date": "2026-09-01",
        }, headers=headers)
        client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "income", "amount": 200000,
            "transaction_date": "2026-09-15",
        }, headers=headers)
        client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "income", "amount": 300000,
            "transaction_date": "2026-09-30",
        }, headers=headers)

        # Lọc từ 10 đến 20 tháng 9
        resp = client.get(
            "/api/transactions?from_date=2026-09-10&to_date=2026-09-20",
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["transaction_date"] == "2026-09-15"

    def test_list_only_own_transactions(self, client, db_session):
        """User chỉ thấy giao dịch của mình, không thấy giao dịch user khác."""
        user_a = create_test_user(db_session, "ownA@test.com")
        user_b = create_test_user(db_session, "ownB@test.com")
        wallet_a = make_wallet(db_session, user_a.id, "1000000.00", "Ví A")
        wallet_b = make_wallet(db_session, user_b.id, "1000000.00", "Ví B")
        cat = make_category(db_session, "Lương", "INCOME")

        client.post("/api/transactions", json={
            "wallet_id": wallet_a.id, "category_id": cat.id,
            "type": "income", "amount": 100000,
            "transaction_date": "2026-09-01",
        }, headers=get_auth_headers(user_a))
        client.post("/api/transactions", json={
            "wallet_id": wallet_b.id, "category_id": cat.id,
            "type": "income", "amount": 200000,
            "transaction_date": "2026-09-01",
        }, headers=get_auth_headers(user_b))

        resp_a = client.get("/api/transactions", headers=get_auth_headers(user_a))
        assert resp_a.status_code == 200
        assert len(resp_a.json()) == 1
        assert resp_a.json()[0]["wallet_id"] == wallet_a.id


# ─── F02.03 Chi tiết giao dịch ────────────────────────────────────────────────

class TestGetTransactionDetail:

    def test_get_detail_success(self, client, db_session):
        """Xem chi tiết giao dịch của chính mình."""
        user = create_test_user(db_session, "detail1@test.com")
        headers = get_auth_headers(user)
        wallet = make_wallet(db_session, user.id)
        cat = make_category(db_session, "Lương", "INCOME")

        resp_create = client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "income", "amount": 500000,
            "transaction_date": "2026-09-20",
        }, headers=headers)
        tx_id = resp_create.json()["id"]

        resp = client.get(f"/api/transactions/{tx_id}", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == tx_id
        assert data["transaction_date"] == "2026-09-20"

    def test_get_detail_not_found(self, client, db_session):
        """Xem giao dịch không tồn tại → 404."""
        user = create_test_user(db_session, "detail404@test.com")

        resp = client.get("/api/transactions/999999", headers=get_auth_headers(user))
        assert resp.status_code == 404

    def test_get_detail_other_user_forbidden(self, client, db_session):
        """Xem giao dịch của user khác → 404 (không lộ thông tin)."""
        user_a = create_test_user(db_session, "detailA@test.com")
        user_b = create_test_user(db_session, "detailB@test.com")
        wallet_a = make_wallet(db_session, user_a.id)
        cat = make_category(db_session, "Lương", "INCOME")

        resp_create = client.post("/api/transactions", json={
            "wallet_id": wallet_a.id, "category_id": cat.id,
            "type": "income", "amount": 500000,
            "transaction_date": "2026-09-20",
        }, headers=get_auth_headers(user_a))
        tx_id = resp_create.json()["id"]

        resp = client.get(f"/api/transactions/{tx_id}", headers=get_auth_headers(user_b))
        assert resp.status_code == 404


# ─── F02.04 Cập nhật giao dịch ────────────────────────────────────────────────

class TestUpdateTransaction:

    def _create_tx(self, client, db_session, user, wallet, cat, amount, date_str, tx_type="income"):
        resp = client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": tx_type, "amount": amount,
            "transaction_date": date_str,
        }, headers=get_auth_headers(user))
        assert resp.status_code == 201
        return resp.json()

    def test_update_amount_success(self, client, db_session):
        """Cập nhật amount → số dư ví tính lại đúng."""
        user = create_test_user(db_session, "upd_amount@test.com")
        wallet = make_wallet(db_session, user.id, "1000000.00")
        cat = make_category(db_session, "Lương", "INCOME")

        tx = self._create_tx(client, db_session, user, wallet, cat, 100000, "2026-09-01")
        # Sau create: balance = 1100000

        resp = client.patch(f"/api/transactions/{tx['id']}", json={
            "amount": 200000,
        }, headers=get_auth_headers(user))
        assert resp.status_code == 200
        data = resp.json()
        assert data["amount"] == 200000.0
        # 1000000 (ban đầu) + 200000 = 1200000
        assert data["wallet_balance"] == 1200000.0

        db_session.refresh(wallet)
        assert wallet.balance == Decimal("1200000.00")

    def test_update_transaction_date(self, client, db_session):
        """Cập nhật transaction_date."""
        user = create_test_user(db_session, "upd_date@test.com")
        wallet = make_wallet(db_session, user.id, "1000000.00")
        cat = make_category(db_session, "Lương", "INCOME")

        tx = self._create_tx(client, db_session, user, wallet, cat, 100000, "2026-09-01")

        resp = client.patch(f"/api/transactions/{tx['id']}", json={
            "transaction_date": "2026-08-15",
        }, headers=get_auth_headers(user))
        assert resp.status_code == 200
        assert resp.json()["transaction_date"] == "2026-08-15"

    def test_update_expense_wallet_balance_correct(self, client, db_session):
        """Cập nhật khoản chi: wallet = old_balance + old_amount - new_amount."""
        user = create_test_user(db_session, "upd_exp@test.com")
        wallet = make_wallet(db_session, user.id, "1000000.00")
        cat = make_category(db_session, "Ăn uống", "EXPENSE")

        tx = self._create_tx(client, db_session, user, wallet, cat, 100000, "2026-09-01", "expense")
        # After create: balance = 900000

        resp = client.patch(f"/api/transactions/{tx['id']}", json={
            "amount": 200000,
        }, headers=get_auth_headers(user))
        assert resp.status_code == 200
        # 1000000 - 200000 = 800000
        assert resp.json()["wallet_balance"] == 800000.0

        db_session.refresh(wallet)
        assert wallet.balance == Decimal("800000.00")

    def test_update_makes_wallet_negative_rejected(self, client, db_session):
        """Cập nhật làm số dư âm → 400, giao dịch và ví không thay đổi."""
        user = create_test_user(db_session, "upd_neg@test.com")
        wallet = make_wallet(db_session, user.id, "500000.00")
        cat = make_category(db_session, "Mua sắm", "EXPENSE")

        tx = self._create_tx(client, db_session, user, wallet, cat, 100000, "2026-09-01", "expense")
        # After create: balance = 400000

        resp = client.patch(f"/api/transactions/{tx['id']}", json={
            "amount": 600000,  # Sẽ làm balance = 500000 - 600000 = -100000
        }, headers=get_auth_headers(user))
        assert resp.status_code == 400
        assert "Số dư ví không đủ" in resp.json()["detail"]

        # Kiểm tra ví không thay đổi (vẫn 400000)
        db_session.refresh(wallet)
        assert wallet.balance == Decimal("400000.00")

    def test_update_not_found(self, client, db_session):
        """Cập nhật giao dịch không tồn tại → 404."""
        user = create_test_user(db_session, "upd_404@test.com")

        resp = client.patch("/api/transactions/999999", json={
            "amount": 50000,
        }, headers=get_auth_headers(user))
        assert resp.status_code == 404

    def test_update_invalid_transaction_date(self, client, db_session):
        """Cập nhật transaction_date sai định dạng → 422."""
        user = create_test_user(db_session, "upd_dateInv@test.com")
        wallet = make_wallet(db_session, user.id)
        cat = make_category(db_session, "Lương", "INCOME")

        tx = self._create_tx(client, db_session, user, wallet, cat, 100000, "2026-09-01")

        resp = client.patch(f"/api/transactions/{tx['id']}", json={
            "transaction_date": "not-a-date",
        }, headers=get_auth_headers(user))
        assert resp.status_code == 422


# ─── F02.05 Xóa giao dịch ────────────────────────────────────────────────────

class TestDeleteTransaction:

    def test_delete_income_restores_balance(self, client, db_session):
        """Xóa khoản thu → số dư ví hoàn lại (giảm)."""
        user = create_test_user(db_session, "del_income@test.com")
        wallet = make_wallet(db_session, user.id, "1000000.00")
        cat = make_category(db_session, "Lương", "INCOME")

        resp_create = client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "income", "amount": 500000,
            "transaction_date": "2026-09-01",
        }, headers=get_auth_headers(user))
        tx_id = resp_create.json()["id"]
        # Balance: 1500000

        resp = client.delete(f"/api/transactions/{tx_id}", headers=get_auth_headers(user))
        assert resp.status_code == 200
        assert "thành công" in resp.json()["message"]

        # Ví phải hoàn lại: 1500000 - 500000 = 1000000
        db_session.refresh(wallet)
        assert wallet.balance == Decimal("1000000.00")

    def test_delete_expense_restores_balance(self, client, db_session):
        """Xóa khoản chi → số dư ví hoàn lại (tăng)."""
        user = create_test_user(db_session, "del_expense@test.com")
        wallet = make_wallet(db_session, user.id, "1000000.00")
        cat = make_category(db_session, "Ăn uống", "EXPENSE")

        resp_create = client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "expense", "amount": 300000,
            "transaction_date": "2026-09-01",
        }, headers=get_auth_headers(user))
        tx_id = resp_create.json()["id"]
        # Balance: 700000

        resp = client.delete(f"/api/transactions/{tx_id}", headers=get_auth_headers(user))
        assert resp.status_code == 200

        # Ví phải hoàn lại: 700000 + 300000 = 1000000
        db_session.refresh(wallet)
        assert wallet.balance == Decimal("1000000.00")

    def test_delete_not_found(self, client, db_session):
        """Xóa giao dịch không tồn tại → 404."""
        user = create_test_user(db_session, "del_404@test.com")

        resp = client.delete("/api/transactions/999999", headers=get_auth_headers(user))
        assert resp.status_code == 404

    def test_delete_other_user_forbidden(self, client, db_session):
        """Xóa giao dịch của user khác → 404."""
        user_a = create_test_user(db_session, "del_A@test.com")
        user_b = create_test_user(db_session, "del_B@test.com")
        wallet_a = make_wallet(db_session, user_a.id)
        cat = make_category(db_session, "Lương", "INCOME")

        resp_create = client.post("/api/transactions", json={
            "wallet_id": wallet_a.id, "category_id": cat.id,
            "type": "income", "amount": 100000,
            "transaction_date": "2026-09-01",
        }, headers=get_auth_headers(user_a))
        tx_id = resp_create.json()["id"]

        resp = client.delete(f"/api/transactions/{tx_id}", headers=get_auth_headers(user_b))
        assert resp.status_code == 404

    def test_delete_unauthorized(self, client):
        """Không có token → 401."""
        resp = client.delete("/api/transactions/1")
        assert resp.status_code == 401


# ─── Kiểm tra số dư sau từng thao tác ────────────────────────────────────────

class TestWalletBalanceIntegrity:

    def test_wallet_balance_after_create_update_delete(self, client, db_session):
        """Kiểm tra số dư ví sau chuỗi: tạo → cập nhật → xóa."""
        user = create_test_user(db_session, "integrity@test.com")
        headers = get_auth_headers(user)
        wallet = make_wallet(db_session, user.id, "1000000.00")
        cat = make_category(db_session, "Lương", "INCOME")

        # Tạo: +500000 → balance = 1500000
        resp = client.post("/api/transactions", json={
            "wallet_id": wallet.id, "category_id": cat.id,
            "type": "income", "amount": 500000,
            "transaction_date": "2026-09-01",
        }, headers=headers)
        assert resp.status_code == 201
        tx_id = resp.json()["id"]

        db_session.refresh(wallet)
        assert wallet.balance == Decimal("1500000.00")

        # Cập nhật: 500000 → 700000 → balance = 1700000
        resp = client.patch(f"/api/transactions/{tx_id}", json={"amount": 700000}, headers=headers)
        assert resp.status_code == 200

        db_session.refresh(wallet)
        assert wallet.balance == Decimal("1700000.00")

        # Xóa: hoàn lại -700000 → balance = 1000000
        resp = client.delete(f"/api/transactions/{tx_id}", headers=headers)
        assert resp.status_code == 200

        db_session.refresh(wallet)
        assert wallet.balance == Decimal("1000000.00")
