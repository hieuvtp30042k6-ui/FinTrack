from datetime import date
from decimal import Decimal
import pytest
from app.models.user import User
from app.models.wallet import Wallet
from app.models.category import Category
from app.models.transaction import Transaction
from app.core.security import hash_password, create_access_token


def create_user(db_session, email="user@example.com", name="Test User"):
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
    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role, "sid": "cat_test_sid"})
    return {"Authorization": f"Bearer {token}"}


class TestCategoryManagement:
    """Test suite for Quản lý Category (Danh mục thu/chi)"""

    def test_create_category_income_and_expense_success(self, client, db_session):
        user = create_user(db_session, "cat_user1@example.com")
        headers = get_headers(user)

        # 1. Tạo danh mục thu (income)
        res_income = client.post("/api/categories", json={
            "name": "Bán hàng online",
            "type": "income"
        }, headers=headers)
        assert res_income.status_code == 201
        data_income = res_income.json()
        assert data_income["name"] == "Bán hàng online"
        assert data_income["type"] == "INCOME"
        assert data_income["user_id"] == user.id
        assert data_income["is_system"] is False

        # 2. Tạo danh mục chi (expense)
        res_expense = client.post("/api/categories", json={
            "name": "Nuôi thú cưng",
            "type": "EXPENSE"
        }, headers=headers)
        assert res_expense.status_code == 201
        data_expense = res_expense.json()
        assert data_expense["name"] == "Nuôi thú cưng"
        assert data_expense["type"] == "EXPENSE"
        assert data_expense["user_id"] == user.id

    def test_list_categories_and_filter(self, client, db_session):
        user = create_user(db_session, "cat_user2@example.com")
        headers = get_headers(user)

        # Tạo 1 category hệ thống và 2 category của user
        cat_sys = Category(name="Hệ thống Ăn uống", type="EXPENSE", user_id=None)
        cat_user_exp = Category(name="Chi tiêu A", type="EXPENSE", user_id=user.id)
        cat_user_inc = Category(name="Thu nhập B", type="INCOME", user_id=user.id)
        db_session.add_all([cat_sys, cat_user_exp, cat_user_inc])
        db_session.commit()

        # Lấy tất cả
        res_all = client.get("/api/categories", headers=headers)
        assert res_all.status_code == 200
        names = [c["name"] for c in res_all.json()]
        assert "Hệ thống Ăn uống" in names
        assert "Chi tiêu A" in names
        assert "Thu nhập B" in names

        # Lọc chỉ khoản thu
        res_income = client.get("/api/categories?type=income", headers=headers)
        assert res_income.status_code == 200
        for item in res_income.json():
            assert item["type"] == "INCOME"

        # Lọc chỉ khoản chi
        res_expense = client.get("/api/categories?type=expense", headers=headers)
        assert res_expense.status_code == 200
        for item in res_expense.json():
            assert item["type"] == "EXPENSE"

    def test_get_category_detail(self, client, db_session):
        user = create_user(db_session, "cat_user3@example.com")
        headers = get_headers(user)

        category = Category(name="Tiền điện", type="EXPENSE", user_id=user.id)
        db_session.add(category)
        db_session.commit()
        db_session.refresh(category)

        res = client.get(f"/api/categories/{category.id}", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == category.id
        assert data["name"] == "Tiền điện"

    def test_update_category_success(self, client, db_session):
        user = create_user(db_session, "cat_user4@example.com")
        headers = get_headers(user)

        category = Category(name="Tên cũ", type="EXPENSE", user_id=user.id)
        db_session.add(category)
        db_session.commit()
        db_session.refresh(category)

        res = client.patch(f"/api/categories/{category.id}", json={
            "name": "Tên mới đã sửa"
        }, headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "Tên mới đã sửa"

        db_session.refresh(category)
        assert category.name == "Tên mới đã sửa"

    def test_delete_and_update_default_category_success(self, client, db_session):
        user = create_user(db_session, "cat_user5@example.com")
        headers = get_headers(user)

        # Danh mục mặc định ban đầu user_id = None
        default_cat = Category(name="Danh mục mặc định có thể sửa và xóa", type="EXPENSE", user_id=None)
        db_session.add(default_cat)
        db_session.commit()
        db_session.refresh(default_cat)

        # Cập nhật thành công
        res = client.patch(f"/api/categories/{default_cat.id}", json={
            "name": "Tên mới sau sửa"
        }, headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "Tên mới sau sửa"

        # Xóa thành công
        res_del = client.delete(f"/api/categories/{default_cat.id}", headers=headers)
        assert res_del.status_code == 200
        assert "thành công" in res_del.json()["message"]

    def test_update_other_user_category_forbidden(self, client, db_session):
        user_a = create_user(db_session, "owner_cat@example.com")
        user_b = create_user(db_session, "hacker_cat@example.com")

        cat_a = Category(name="Danh mục riêng của A", type="EXPENSE", user_id=user_a.id)
        db_session.add(cat_a)
        db_session.commit()
        db_session.refresh(cat_a)

        headers_b = get_headers(user_b)
        res = client.patch(f"/api/categories/{cat_a.id}", json={
            "name": "B cố sửa của A"
        }, headers=headers_b)
        assert res.status_code == 403
        assert "không có quyền" in res.json()["detail"]

    def test_delete_category_success(self, client, db_session):
        user = create_user(db_session, "cat_user6@example.com")
        headers = get_headers(user)

        cat = Category(name="Danh mục cần xóa", type="EXPENSE", user_id=user.id)
        db_session.add(cat)
        db_session.commit()
        db_session.refresh(cat)

        res = client.delete(f"/api/categories/{cat.id}", headers=headers)
        assert res.status_code == 200
        assert "thành công" in res.json()["message"]

        assert db_session.query(Category).filter(Category.id == cat.id).first() is None

    def test_delete_category_with_transactions_blocked(self, client, db_session):
        user = create_user(db_session, "cat_user7@example.com")
        headers = get_headers(user)

        wallet = Wallet(user_id=user.id, name="Ví test", balance=Decimal("1000000"))
        cat = Category(name="Danh mục có giao dịch", type="EXPENSE", user_id=user.id)
        db_session.add_all([wallet, cat])
        db_session.commit()
        db_session.refresh(wallet)
        db_session.refresh(cat)

        # Tạo giao dịch sử dụng category này
        tx = Transaction(
            user_id=user.id,
            wallet_id=wallet.id,
            category_id=cat.id,
            type="EXPENSE",
            amount=Decimal("50000"),
            transaction_date=date.today()
        )
        db_session.add(tx)
        db_session.commit()

        # Thử xóa danh mục -> Phải bị chặn
        res = client.delete(f"/api/categories/{cat.id}", headers=headers)
        assert res.status_code == 400
        assert "đang có giao dịch phát sinh" in res.json()["detail"]

    def test_category_duplicate_name_conflict(self, client, db_session):
        user = create_user(db_session, "cat_user8@example.com")
        headers = get_headers(user)

        # Tạo danh mục lần 1
        client.post("/api/categories", json={
            "name": "Tiền thưởng tết",
            "type": "income"
        }, headers=headers)

        # Tạo danh mục lần 2 trùng tên và loại
        res_dup = client.post("/api/categories", json={
            "name": "tiền thưởng tết ",  # hoa thường và khoảng trắng
            "type": "INCOME"
        }, headers=headers)
        assert res_dup.status_code == 409
        assert "đã tồn tại" in res_dup.json()["detail"]

    def test_category_invalid_type_and_empty_name(self, client, db_session):
        user = create_user(db_session, "cat_user9@example.com")
        headers = get_headers(user)

        # Type sai
        res_type = client.post("/api/categories", json={
            "name": "Tên hợp lệ",
            "type": "INVALID_TYPE"
        }, headers=headers)
        assert res_type.status_code == 422

        # Tên rỗng
        res_name = client.post("/api/categories", json={
            "name": "   ",
            "type": "income"
        }, headers=headers)
        assert res_name.status_code == 422

    def test_category_unauthorized(self, client, db_session):
        res = client.get("/api/categories")
        assert res.status_code == 401

    def test_category_not_found(self, client, db_session):
        user = create_user(db_session, "cat_user10@example.com")
        headers = get_headers(user)

        res = client.get("/api/categories/999999", headers=headers)
        assert res.status_code == 404
