from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import pytest

from app.models.user import User
from app.models.wallet import Wallet
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.core.security import hash_password, create_access_token


def create_user(db_session, email="report_user@example.com", name="Report Tester"):
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


def create_wallet(db_session, user_id, name="Ví tiền mặt", balance=Decimal("10000000")):
    wallet = Wallet(user_id=user_id, name=name, balance=balance)
    db_session.add(wallet)
    db_session.commit()
    db_session.refresh(wallet)
    return wallet


def create_category(db_session, user_id, name, cat_type="EXPENSE"):
    cat = Category(user_id=user_id, name=name, type=cat_type, icon="category")
    db_session.add(cat)
    db_session.commit()
    db_session.refresh(cat)
    return cat


class TestReportEndpoints:
    def test_unauthorized_access(self, client):
        """User chưa đăng nhập -> reject (401)."""
        res1 = client.get("/api/reports/summary")
        assert res1.status_code == 401

        res2 = client.get("/api/reports/categories")
        assert res2.status_code == 401

        res3 = client.get("/api/reports/budgets")
        assert res3.status_code == 401

    def test_empty_transactions_returns_zeros(self, client, db_session):
        """Không có Transaction -> trả kết quả hợp lệ với giá trị 0/rỗng phù hợp."""
        user = create_user(db_session, "empty_report@example.com")
        headers = get_headers(user)

        res_sum = client.get(
            "/api/reports/summary?from_date=2026-09-01&to_date=2026-09-30",
            headers=headers
        )
        assert res_sum.status_code == 200
        data_sum = res_sum.json()
        assert data_sum["total_income"] == 0.0
        assert data_sum["total_expense"] == 0.0
        assert data_sum["balance"] == 0.0
        assert data_sum["transaction_count"] == 0
        assert data_sum["savings_rate"] == 0.0

        res_cat = client.get(
            "/api/reports/categories?from_date=2026-09-01&to_date=2026-09-30",
            headers=headers
        )
        assert res_cat.status_code == 200
        data_cat = res_cat.json()
        assert data_cat["total_expense"] == 0.0
        assert data_cat["categories"] == []

    def test_financial_summary_income_expense_balance(self, client, db_session):
        """Lấy tổng thu, tổng chi và tính số dư chuẩn xác."""
        user = create_user(db_session, "summary_user@example.com")
        headers = get_headers(user)
        wallet = create_wallet(db_session, user.id)
        cat_inc = create_category(db_session, user.id, "Lương", "INCOME")
        cat_exp1 = create_category(db_session, user.id, "Ăn uống", "EXPENSE")
        cat_exp2 = create_category(db_session, user.id, "Mua sắm", "EXPENSE")

        # Thu: 10,000,000
        db_session.add(Transaction(
            user_id=user.id, wallet_id=wallet.id, category_id=cat_inc.id,
            type="INCOME", amount=Decimal("10000000"), transaction_date=date(2026, 9, 5)
        ))
        # Chi 1: 4,000,000
        db_session.add(Transaction(
            user_id=user.id, wallet_id=wallet.id, category_id=cat_exp1.id,
            type="EXPENSE", amount=Decimal("4000000"), transaction_date=date(2026, 9, 10)
        ))
        # Chi 2: 1,500,000
        db_session.add(Transaction(
            user_id=user.id, wallet_id=wallet.id, category_id=cat_exp2.id,
            type="EXPENSE", amount=Decimal("1500000"), transaction_date=date(2026, 9, 15)
        ))
        db_session.commit()

        res = client.get(
            "/api/reports/summary?from_date=2026-09-01&to_date=2026-09-30",
            headers=headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["from_date"] == "2026-09-01"
        assert data["to_date"] == "2026-09-30"
        assert data["total_income"] == 10000000.0
        assert data["total_expense"] == 5500000.0
        assert data["balance"] == 4500000.0
        assert data["net_balance"] == 4500000.0
        assert data["transaction_count"] == 3
        # savings_rate = 4500000 / 10000000 * 100 = 45.0%
        assert data["savings_rate"] == 45.0

    def test_income_not_counted_in_expense_and_vice_versa(self, client, db_session):
        """Không tính income vào tổng chi, không tính expense vào tổng thu."""
        user = create_user(db_session, "pure_test@example.com")
        headers = get_headers(user)
        wallet = create_wallet(db_session, user.id)
        cat_inc = create_category(db_session, user.id, "Tiền thưởng", "INCOME")
        cat_exp = create_category(db_session, user.id, "Tiền điện", "EXPENSE")

        # Chỉ có thu
        db_session.add(Transaction(
            user_id=user.id, wallet_id=wallet.id, category_id=cat_inc.id,
            type="INCOME", amount=Decimal("5000000"), transaction_date=date(2026, 9, 1)
        ))
        db_session.commit()

        res = client.get(
            "/api/reports/summary?from_date=2026-09-01&to_date=2026-09-30",
            headers=headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total_income"] == 5000000.0
        assert data["total_expense"] == 0.0
        assert data["balance"] == 5000000.0

        # Thêm chi
        db_session.add(Transaction(
            user_id=user.id, wallet_id=wallet.id, category_id=cat_exp.id,
            type="EXPENSE", amount=Decimal("2000000"), transaction_date=date(2026, 9, 2)
        ))
        db_session.commit()

        res2 = client.get(
            "/api/reports/summary?from_date=2026-09-01&to_date=2026-09-30",
            headers=headers
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["total_income"] == 5000000.0
        assert data2["total_expense"] == 2000000.0
        assert data2["balance"] == 3000000.0

    def test_date_filtering_from_date_and_to_date(self, client, db_session):
        """Lọc đúng from_date và to_date."""
        user = create_user(db_session, "filter_user@example.com")
        headers = get_headers(user)
        wallet = create_wallet(db_session, user.id)
        cat_exp = create_category(db_session, user.id, "Ăn uống", "EXPENSE")

        # Giao dịch trước khoảng lọc: 2026-09-05
        db_session.add(Transaction(
            user_id=user.id, wallet_id=wallet.id, category_id=cat_exp.id,
            type="EXPENSE", amount=Decimal("100000"), transaction_date=date(2026, 9, 5)
        ))
        # Giao dịch trong khoảng lọc: 2026-09-15
        db_session.add(Transaction(
            user_id=user.id, wallet_id=wallet.id, category_id=cat_exp.id,
            type="EXPENSE", amount=Decimal("250000"), transaction_date=date(2026, 9, 15)
        ))
        # Giao dịch sau khoảng lọc: 2026-09-25
        db_session.add(Transaction(
            user_id=user.id, wallet_id=wallet.id, category_id=cat_exp.id,
            type="EXPENSE", amount=Decimal("400000"), transaction_date=date(2026, 9, 25)
        ))
        db_session.commit()

        res = client.get(
            "/api/reports/summary?from_date=2026-09-10&to_date=2026-09-20",
            headers=headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total_expense"] == 250000.0
        assert data["transaction_count"] == 1

    def test_uses_transaction_date_not_created_at(self, client, db_session):
        """Sử dụng transaction_date, không sử dụng created_at."""
        user = create_user(db_session, "date_test@example.com")
        headers = get_headers(user)
        wallet = create_wallet(db_session, user.id)
        cat_exp = create_category(db_session, user.id, "Mua sắm", "EXPENSE")

        # Giao dịch có transaction_date là tháng 8, dù record được tạo tại thời điểm hiện tại (tháng 9)
        tx = Transaction(
            user_id=user.id,
            wallet_id=wallet.id,
            category_id=cat_exp.id,
            type="EXPENSE",
            amount=Decimal("880000"),
            transaction_date=date(2026, 8, 20),
            created_at=datetime(2026, 9, 30, 12, 0, 0, tzinfo=timezone.utc)
        )
        db_session.add(tx)
        db_session.commit()

        # Tìm trong tháng 9 -> Không có kết quả vì transaction_date nằm ở tháng 8
        res_sep = client.get(
            "/api/reports/summary?from_date=2026-09-01&to_date=2026-09-30",
            headers=headers
        )
        assert res_sep.status_code == 200
        assert res_sep.json()["total_expense"] == 0.0
        assert res_sep.json()["transaction_count"] == 0

        # Tìm trong tháng 8 -> Phải xuất hiện kết quả
        res_aug = client.get(
            "/api/reports/summary?from_date=2026-08-01&to_date=2026-08-31",
            headers=headers
        )
        assert res_aug.status_code == 200
        assert res_aug.json()["total_expense"] == 880000.0
        assert res_aug.json()["transaction_count"] == 1

    def test_from_date_greater_than_to_date_rejected(self, client, db_session):
        """from_date > to_date -> reject (400 Bad Request)."""
        user = create_user(db_session, "invalid_range@example.com")
        headers = get_headers(user)

        res_sum = client.get(
            "/api/reports/summary?from_date=2026-09-30&to_date=2026-09-01",
            headers=headers
        )
        assert res_sum.status_code == 400
        assert "from_date không được lớn hơn to_date" in res_sum.json()["detail"]

        res_cat = client.get(
            "/api/reports/categories?from_date=2026-09-30&to_date=2026-09-01",
            headers=headers
        )
        assert res_cat.status_code == 400
        assert "from_date không được lớn hơn to_date" in res_cat.json()["detail"]

    def test_invalid_date_format_rejected(self, client, db_session):
        """Ngày không hợp lệ -> reject (422 Unprocessable Entity)."""
        user = create_user(db_session, "invalid_date_user@example.com")
        headers = get_headers(user)

        res = client.get(
            "/api/reports/summary?from_date=invalid-date&to_date=2026-09-30",
            headers=headers
        )
        assert res.status_code == 422

        res2 = client.get(
            "/api/reports/summary?from_date=2026-09-01&to_date=2026-13-45",
            headers=headers
        )
        assert res2.status_code == 422

    def test_user_isolation_cannot_see_other_user_data(self, client, db_session):
        """Chỉ tính Transaction của user hiện tại, không thể xem Report của user khác."""
        user1 = create_user(db_session, "owner1@example.com", "Owner 1")
        user2 = create_user(db_session, "owner2@example.com", "Owner 2")
        headers1 = get_headers(user1)
        headers2 = get_headers(user2)

        wallet1 = create_wallet(db_session, user1.id, "Ví 1")
        wallet2 = create_wallet(db_session, user2.id, "Ví 2")

        cat1 = create_category(db_session, user1.id, "Ăn uống 1", "EXPENSE")
        cat2 = create_category(db_session, user2.id, "Mua sắm 2", "EXPENSE")

        # User 1 chi 1,000,000
        db_session.add(Transaction(
            user_id=user1.id, wallet_id=wallet1.id, category_id=cat1.id,
            type="EXPENSE", amount=Decimal("1000000"), transaction_date=date(2026, 9, 10)
        ))
        # User 2 chi 5,000,000
        db_session.add(Transaction(
            user_id=user2.id, wallet_id=wallet2.id, category_id=cat2.id,
            type="EXPENSE", amount=Decimal("5000000"), transaction_date=date(2026, 9, 10)
        ))
        db_session.commit()

        # User 1 chỉ thấy 1,000,000
        res1 = client.get("/api/reports/summary?from_date=2026-09-01&to_date=2026-09-30", headers=headers1)
        assert res1.status_code == 200
        assert res1.json()["total_expense"] == 1000000.0

        # User 2 chỉ thấy 5,000,000
        res2 = client.get("/api/reports/summary?from_date=2026-09-01&to_date=2026-09-30", headers=headers2)
        assert res2.status_code == 200
        assert res2.json()["total_expense"] == 5000000.0

        # Thống kê category cũng độc lập
        cat_res1 = client.get("/api/reports/categories?from_date=2026-09-01&to_date=2026-09-30", headers=headers1)
        assert cat_res1.status_code == 200
        assert len(cat_res1.json()["categories"]) == 1
        assert cat_res1.json()["categories"][0]["category_id"] == cat1.id

    def test_category_expense_breakdown(self, client, db_session):
        """Thống kê chi tiêu theo Category chính xác với tỷ lệ phần trăm."""
        user = create_user(db_session, "cat_user@example.com")
        headers = get_headers(user)
        wallet = create_wallet(db_session, user.id)

        cat_food = create_category(db_session, user.id, "Ăn uống", "EXPENSE")
        cat_shop = create_category(db_session, user.id, "Mua sắm", "EXPENSE")
        cat_trans = create_category(db_session, user.id, "Đi lại", "EXPENSE")
        cat_salary = create_category(db_session, user.id, "Lương", "INCOME")

        # Ăn uống: 2.000.000 (50%)
        db_session.add(Transaction(
            user_id=user.id, wallet_id=wallet.id, category_id=cat_food.id,
            type="EXPENSE", amount=Decimal("2000000"), transaction_date=date(2026, 9, 10)
        ))
        # Mua sắm: 1.500.000 (37.5%)
        db_session.add(Transaction(
            user_id=user.id, wallet_id=wallet.id, category_id=cat_shop.id,
            type="EXPENSE", amount=Decimal("1500000"), transaction_date=date(2026, 9, 12)
        ))
        # Đi lại: 500.000 (12.5%)
        db_session.add(Transaction(
            user_id=user.id, wallet_id=wallet.id, category_id=cat_trans.id,
            type="EXPENSE", amount=Decimal("500000"), transaction_date=date(2026, 9, 14)
        ))
        # Thu nhập: 10.000.000 (Không được xuất hiện trong thống kê khoản chi theo Category)
        db_session.add(Transaction(
            user_id=user.id, wallet_id=wallet.id, category_id=cat_salary.id,
            type="INCOME", amount=Decimal("10000000"), transaction_date=date(2026, 9, 1)
        ))
        db_session.commit()

        res = client.get(
            "/api/reports/categories?from_date=2026-09-01&to_date=2026-09-30",
            headers=headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total_expense"] == 4000000.0
        categories = data["categories"]
        assert len(categories) == 3

        # Sắp xếp giảm dần theo tổng chi
        assert categories[0]["category_name"] == "Ăn uống"
        assert categories[0]["total_expense"] == 2000000.0
        assert categories[0]["percentage"] == 50.0

        assert categories[1]["category_name"] == "Mua sắm"
        assert categories[1]["total_expense"] == 1500000.0
        assert categories[1]["percentage"] == 37.5

        assert categories[2]["category_name"] == "Đi lại"
        assert categories[2]["total_expense"] == 500000.0
        assert categories[2]["percentage"] == 12.5

    def test_budget_report(self, client, db_session):
        """Báo cáo đối chiếu ngân sách: amount, spent_amount, remaining_amount, usage_percent."""
        user = create_user(db_session, "budget_report_user@example.com")
        headers = get_headers(user)
        wallet = create_wallet(db_session, user.id)
        cat = create_category(db_session, user.id, "Ăn uống", "EXPENSE")

        # Ngân sách 3,000,000 cho tháng 9
        budget = Budget(
            user_id=user.id,
            category_id=cat.id,
            amount=Decimal("3000000"),
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30)
        )
        db_session.add(budget)

        # Chi tiêu 1,200,000 trong tháng 9
        db_session.add(Transaction(
            user_id=user.id, wallet_id=wallet.id, category_id=cat.id,
            type="EXPENSE", amount=Decimal("1200000"), transaction_date=date(2026, 9, 10)
        ))
        db_session.commit()

        res = client.get(
            "/api/reports/budgets?from_date=2026-09-01&to_date=2026-09-30",
            headers=headers
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data["budgets"]) == 1
        item = data["budgets"][0]
        assert item["budget_amount"] == 3000000.0
        assert item["spent_amount"] == 1200000.0
        assert item["remaining_amount"] == 1800000.0
        assert item["usage_percent"] == 40.0
        assert item["category_name"] == "Ăn uống"

    def test_default_date_range_when_omitted(self, client, db_session):
        """Khi không truyền khoảng ngày, mặc định lấy tháng hiện tại."""
        user = create_user(db_session, "default_date_user@example.com")
        headers = get_headers(user)

        res = client.get("/api/reports/summary", headers=headers)
        assert res.status_code == 200
        data = res.json()
        today = date.today()
        assert data["from_date"].startswith(f"{today.year}-{today.month:02d}-01")

        res_cat = client.get("/api/reports/categories", headers=headers)
        assert res_cat.status_code == 200
        data_cat = res_cat.json()
        assert data_cat["from_date"].startswith(f"{today.year}-{today.month:02d}-01")
