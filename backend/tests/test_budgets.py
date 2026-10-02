from datetime import date, timedelta
from decimal import Decimal
import pytest
from app.models.user import User
from app.models.wallet import Wallet
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.core.security import hash_password, create_access_token


def create_user(db_session, email="budget_user@example.com", name="Budget Tester"):
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
    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role, "sid": f"sid_{user.id}"})
    return {"Authorization": f"Bearer {token}"}


class TestBudgetManagement:
    def test_unauthorized_access(self, client):
        res = client.get("/api/budgets")
        assert res.status_code == 401
        res = client.post("/api/budgets", json={"amount": 1000000})
        assert res.status_code == 401

    def test_create_budget_success(self, client, db_session):
        user = create_user(db_session, "user1@example.com")
        headers = get_headers(user)

        cat = Category(name="Ăn uống test", type="EXPENSE", user_id=user.id)
        db_session.add(cat)
        db_session.commit()
        db_session.refresh(cat)

        payload = {
            "category_id": cat.id,
            "amount": 2500000,
            "start_date": "2026-10-01",
            "end_date": "2026-10-31"
        }
        res = client.post("/api/budgets", json=payload, headers=headers)
        assert res.status_code == 201
        data = res.json()
        assert data["user_id"] == user.id
        assert data["category_id"] == cat.id
        assert data["amount"] == 2500000.0
        assert data["limit"] == 2500000.0
        assert data["category_name"] == "Ăn uống test"
        assert data["spent"] == 0.0
        assert data["remaining"] == 2500000.0
        assert data["percentage"] == 0.0
        assert data["status"] == "normal"
        assert data["start_date"] == "2026-10-01"
        assert data["end_date"] == "2026-10-31"

    def test_create_budget_with_month_year(self, client, db_session):
        user = create_user(db_session, "user2@example.com")
        headers = get_headers(user)

        payload = {
            "limit": 5000000,
            "month": 11,
            "year": 2026
        }
        res = client.post("/api/budgets", json=payload, headers=headers)
        assert res.status_code == 201
        data = res.json()
        assert data["amount"] == 5000000.0
        assert data["start_date"] == "2026-11-01"
        assert data["end_date"] == "2026-11-30"

    def test_create_budget_rejects_income_category(self, client, db_session):
        user = create_user(db_session, "user3@example.com")
        headers = get_headers(user)

        cat_income = Category(name="Tiền lương", type="INCOME", user_id=user.id)
        db_session.add(cat_income)
        db_session.commit()
        db_session.refresh(cat_income)

        payload = {
            "category_id": cat_income.id,
            "amount": 10000000,
            "start_date": "2026-10-01",
            "end_date": "2026-10-31"
        }
        res = client.post("/api/budgets", json=payload, headers=headers)
        assert res.status_code == 400
        assert "EXPENSE" in res.json()["detail"]

    def test_create_budget_rejects_other_user_category(self, client, db_session):
        userA = create_user(db_session, "userA@example.com")
        userB = create_user(db_session, "userB@example.com")
        headersA = get_headers(userA)

        cat_userB = Category(name="Mua sắm B", type="EXPENSE", user_id=userB.id)
        db_session.add(cat_userB)
        db_session.commit()
        db_session.refresh(cat_userB)

        payload = {
            "category_id": cat_userB.id,
            "amount": 1000000,
            "start_date": "2026-10-01",
            "end_date": "2026-10-31"
        }
        res = client.post("/api/budgets", json=payload, headers=headersA)
        assert res.status_code == 404

    def test_create_budget_rejects_invalid_amount_and_dates(self, client, db_session):
        user = create_user(db_session, "user_invalid@example.com")
        headers = get_headers(user)

        # Số tiền âm
        res = client.post("/api/budgets", json={"amount": -100000}, headers=headers)
        assert res.status_code == 422

        # Số tiền = 0
        res = client.post("/api/budgets", json={"amount": 0}, headers=headers)
        assert res.status_code == 422

        # start_date > end_date
        res = client.post("/api/budgets", json={
            "amount": 1000000,
            "start_date": "2026-10-31",
            "end_date": "2026-10-01"
        }, headers=headers)
        assert res.status_code == 422

    def test_create_duplicate_budget_conflict(self, client, db_session):
        user = create_user(db_session, "user_dup@example.com")
        headers = get_headers(user)

        cat = Category(name="Di chuyển test", type="EXPENSE", user_id=user.id)
        db_session.add(cat)
        db_session.commit()
        db_session.refresh(cat)

        payload1 = {
            "category_id": cat.id,
            "amount": 1000000,
            "start_date": "2026-10-01",
            "end_date": "2026-10-31"
        }
        res1 = client.post("/api/budgets", json=payload1, headers=headers)
        assert res1.status_code == 201

        # Trùng category và trùng khoảng thời gian (giao nhau)
        payload2 = {
            "category_id": cat.id,
            "amount": 1500000,
            "start_date": "2026-10-15",
            "end_date": "2026-11-15"
        }
        res2 = client.post("/api/budgets", json=payload2, headers=headers)
        assert res2.status_code == 409
        assert "Đã tồn tại ngân sách" in res2.json()["detail"]

    def test_calculate_spent_and_status(self, client, db_session):
        user = create_user(db_session, "user_spent@example.com")
        other_user = create_user(db_session, "other_spent@example.com")
        headers = get_headers(user)

        wallet = Wallet(user_id=user.id, name="Ví tiền", balance=Decimal("10000000"))
        wallet_other = Wallet(user_id=other_user.id, name="Ví người khác", balance=Decimal("10000000"))
        cat_food = Category(name="Ăn uống tính tiền", type="EXPENSE", user_id=user.id)
        cat_other = Category(name="Mua sắm tính tiền", type="EXPENSE", user_id=user.id)
        cat_income = Category(name="Lương", type="INCOME", user_id=user.id)

        db_session.add_all([wallet, wallet_other, cat_food, cat_other, cat_income])
        db_session.commit()

        # Tạo ngân sách cho cat_food: hạn mức 1,000,000 từ 2026-10-01 đến 2026-10-31
        budget = Budget(
            user_id=user.id,
            category_id=cat_food.id,
            amount=Decimal("1000000"),
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 31)
        )
        db_session.add(budget)
        db_session.commit()
        db_session.refresh(budget)

        # 1. Giao dịch hợp lệ: EXPENSE, user, cat_food, trong khoảng ngày -> 300,000
        tx1 = Transaction(
            user_id=user.id,
            wallet_id=wallet.id,
            category_id=cat_food.id,
            type="EXPENSE",
            amount=Decimal("300000"),
            transaction_date=date(2026, 10, 10)
        )
        # 2. Giao dịch hợp lệ thứ 2: EXPENSE, user, cat_food, trong khoảng ngày -> 550,000 (Tổng = 850,000, 85% -> warning)
        tx2 = Transaction(
            user_id=user.id,
            wallet_id=wallet.id,
            category_id=cat_food.id,
            type="EXPENSE",
            amount=Decimal("550000"),
            transaction_date=date(2026, 10, 20)
        )
        # 3. Giao dịch NGOÀI khoảng ngày (2026-11-01) -> không được tính
        tx3 = Transaction(
            user_id=user.id,
            wallet_id=wallet.id,
            category_id=cat_food.id,
            type="EXPENSE",
            amount=Decimal("200000"),
            transaction_date=date(2026, 11, 1)
        )
        # 4. Giao dịch KHÁC category (cat_other) -> không được tính
        tx4 = Transaction(
            user_id=user.id,
            wallet_id=wallet.id,
            category_id=cat_other.id,
            type="EXPENSE",
            amount=Decimal("400000"),
            transaction_date=date(2026, 10, 15)
        )
        # 5. Giao dịch INCOME -> KHÔNG được tính vào spent
        tx5 = Transaction(
            user_id=user.id,
            wallet_id=wallet.id,
            category_id=cat_income.id,
            type="INCOME",
            amount=Decimal("5000000"),
            transaction_date=date(2026, 10, 5)
        )
        # 6. Giao dịch của NGƯỜI DÙNG KHÁC -> KHÔNG được tính
        tx6 = Transaction(
            user_id=other_user.id,
            wallet_id=wallet_other.id,
            category_id=cat_food.id,
            type="EXPENSE",
            amount=Decimal("999999"),
            transaction_date=date(2026, 10, 10)
        )

        db_session.add_all([tx1, tx2, tx3, tx4, tx5, tx6])
        db_session.commit()

        # Kiểm tra API chi tiết budget
        res = client.get(f"/api/budgets/{budget.id}", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["spent"] == 850000.0
        assert data["remaining"] == 150000.0
        assert data["percentage"] == 85.0
        assert data["status"] == "warning"

    def test_get_and_update_other_user_budget_forbidden(self, client, db_session):
        userA = create_user(db_session, "userA_sec@example.com")
        userB = create_user(db_session, "userB_sec@example.com")
        headersB = get_headers(userB)

        budgetA = Budget(
            user_id=userA.id,
            amount=Decimal("2000000"),
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 31)
        )
        db_session.add(budgetA)
        db_session.commit()
        db_session.refresh(budgetA)

        # User B thử xem budget của User A
        res_get = client.get(f"/api/budgets/{budgetA.id}", headers=headersB)
        assert res_get.status_code == 403

        # User B thử cập nhật budget của User A
        res_patch = client.patch(f"/api/budgets/{budgetA.id}", json={"amount": 9999999}, headers=headersB)
        assert res_patch.status_code == 403

        # User B thử xóa budget của User A
        res_del = client.delete(f"/api/budgets/{budgetA.id}", headers=headersB)
        assert res_del.status_code == 403

    def test_update_budget_success(self, client, db_session):
        user = create_user(db_session, "user_upd@example.com")
        headers = get_headers(user)

        budget = Budget(
            user_id=user.id,
            amount=Decimal("2000000"),
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 31)
        )
        db_session.add(budget)
        db_session.commit()
        db_session.refresh(budget)

        res = client.patch(
            f"/api/budgets/{budget.id}",
            json={"amount": 3500000, "end_date": "2026-11-15"},
            headers=headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["amount"] == 3500000.0
        assert data["end_date"] == "2026-11-15"

    def test_delete_budget_success(self, client, db_session):
        user = create_user(db_session, "user_del@example.com")
        headers = get_headers(user)

        budget = Budget(
            user_id=user.id,
            amount=Decimal("1000000"),
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 31)
        )
        db_session.add(budget)
        db_session.commit()
        db_session.refresh(budget)

        res = client.delete(f"/api/budgets/{budget.id}", headers=headers)
        assert res.status_code == 200
        assert "thành công" in res.json()["message"]

        # Kiểm tra đã bị xóa trong database
        assert db_session.query(Budget).filter(Budget.id == budget.id).first() is None
