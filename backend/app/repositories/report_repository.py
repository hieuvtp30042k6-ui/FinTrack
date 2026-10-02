from datetime import date
from decimal import Decimal
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, case, desc

from app.models.transaction import Transaction
from app.models.category import Category
from app.models.budget import Budget


class ReportRepository:
    def get_financial_summary(
        self,
        db: Session,
        user_id: int,
        from_date: date,
        to_date: date
    ) -> Dict[str, Any]:
        """
        Truy vấn tổng thu, tổng chi và số lượng giao dịch của user trong khoảng ngày:
        - Sử dụng transaction_date (không dùng created_at).
        - Phân biệt rõ ràng INCOME và EXPENSE.
        - Không tính lẫn lộn giữa hai loại giao dịch.
        """
        stmt = db.query(
            func.coalesce(
                func.sum(
                    case((func.upper(Transaction.type) == "INCOME", Transaction.amount), else_=Decimal("0.0"))
                ),
                Decimal("0.0")
            ).label("total_income"),
            func.coalesce(
                func.sum(
                    case((func.upper(Transaction.type) == "EXPENSE", Transaction.amount), else_=Decimal("0.0"))
                ),
                Decimal("0.0")
            ).label("total_expense"),
            func.count(Transaction.id).label("transaction_count")
        ).filter(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= from_date,
            Transaction.transaction_date <= to_date
        )

        row = stmt.one()
        return {
            "total_income": Decimal(str(row.total_income)),
            "total_expense": Decimal(str(row.total_expense)),
            "transaction_count": int(row.transaction_count)
        }

    def get_expense_by_category(
        self,
        db: Session,
        user_id: int,
        from_date: date,
        to_date: date
    ) -> List[Tuple[Category, Decimal, int]]:
        """
        Thống kê tổng chi tiêu theo từng danh mục:
        - Chỉ lấy các giao dịch có type = 'EXPENSE'.
        - Chỉ lấy giao dịch thuộc user_id và trong khoảng [from_date, to_date].
        - Sắp xếp giảm dần theo tổng chi tiêu.
        """
        results = db.query(
            Category,
            func.coalesce(func.sum(Transaction.amount), Decimal("0.0")).label("cat_total"),
            func.count(Transaction.id).label("tx_count")
        ).join(
            Category, Transaction.category_id == Category.id
        ).filter(
            Transaction.user_id == user_id,
            func.upper(Transaction.type) == "EXPENSE",
            Transaction.transaction_date >= from_date,
            Transaction.transaction_date <= to_date
        ).group_by(
            Category.id
        ).order_by(
            desc("cat_total")
        ).all()

        return [(row[0], Decimal(str(row[1])), int(row[2])) for row in results]

    def get_budgets_in_range(
        self,
        db: Session,
        user_id: int,
        from_date: date,
        to_date: date
    ) -> List[Budget]:
        """Lấy danh sách ngân sách của user giao thoa với khoảng thời gian báo cáo."""
        return db.query(Budget).filter(
            Budget.user_id == user_id,
            Budget.start_date <= to_date,
            Budget.end_date >= from_date
        ).order_by(Budget.start_date.desc()).all()


report_repository = ReportRepository()
