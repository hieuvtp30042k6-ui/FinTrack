import calendar
from datetime import date
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.report_repository import report_repository, ReportRepository
from app.repositories.budget_repository import budget_repository, BudgetRepository
from app.repositories.category_repository import category_repository, CategoryRepository


class ReportService:
    def __init__(
        self,
        report_repo: ReportRepository = report_repository,
        budget_repo: BudgetRepository = budget_repository,
        cat_repo: CategoryRepository = category_repository,
    ):
        self.report_repo = report_repo
        self.budget_repo = budget_repo
        self.cat_repo = cat_repo

    def _resolve_date_range(
        self,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> Tuple[date, date]:
        """
        Chuẩn hóa và validate khoảng thời gian:
        - Nếu cả from_date và to_date đều có: kiểm tra from_date <= to_date.
        - Nếu chỉ có from_date: to_date mặc định là ngày cuối cùng của tháng chứa from_date.
        - Nếu chỉ có to_date: from_date mặc định là ngày đầu tiên của tháng chứa to_date.
        - Nếu cả hai đều không truyền: mặc định từ ngày đầu đến ngày cuối của tháng hiện tại.
        """
        today = date.today()

        if from_date and to_date:
            if from_date > to_date:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Khoảng thời gian không hợp lệ: from_date không được lớn hơn to_date."
                )
            return from_date, to_date

        if from_date and not to_date:
            _, last_day = calendar.monthrange(from_date.year, from_date.month)
            resolved_to = date(from_date.year, from_date.month, last_day)
            return from_date, resolved_to

        if not from_date and to_date:
            resolved_from = date(to_date.year, to_date.month, 1)
            if resolved_from > to_date:
                resolved_from = to_date
            return resolved_from, to_date

        # Cả 2 đều None -> Mặc định tháng hiện tại theo convention
        _, last_day = calendar.monthrange(today.year, today.month)
        return date(today.year, today.month, 1), date(today.year, today.month, last_day)

    def get_summary(
        self,
        db: Session,
        user: User,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Báo cáo tổng quan tài chính (Summary):
        - Tổng thu (chỉ tính INCOME).
        - Tổng chi (chỉ tính EXPENSE).
        - Số dư = Tổng thu - Tổng chi.
        - Tỷ lệ tiết kiệm và số lượng giao dịch.
        - Chỉ tính giao dịch của user đang đăng nhập và theo transaction_date.
        """
        start_date, end_date = self._resolve_date_range(from_date, to_date)
        data = self.report_repo.get_financial_summary(
            db=db,
            user_id=user.id,
            from_date=start_date,
            to_date=end_date
        )

        total_income = float(data["total_income"])
        total_expense = float(data["total_expense"])
        balance = round(total_income - total_expense, 2)
        net_balance = balance
        savings_rate = round((balance / total_income) * 100, 2) if (total_income > 0 and balance > 0) else 0.0

        return {
            "from_date": start_date,
            "to_date": end_date,
            "total_income": total_income,
            "total_expense": total_expense,
            "balance": balance,
            "net_balance": net_balance,
            "savings_rate": savings_rate,
            "transaction_count": data["transaction_count"],
        }

    def get_categories_report(
        self,
        db: Session,
        user: User,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Báo cáo phân bổ chi tiêu theo từng danh mục:
        - Chỉ tính EXPENSE.
        - Thuộc user đang đăng nhập.
        - Nằm trong khoảng [from_date, to_date] theo transaction_date.
        - Tính phần trăm chi tiêu và sắp xếp theo tổng chi giảm dần.
        """
        start_date, end_date = self._resolve_date_range(from_date, to_date)
        rows = self.report_repo.get_expense_by_category(
            db=db,
            user_id=user.id,
            from_date=start_date,
            to_date=end_date
        )

        total_expense = round(sum(float(row[1]) for row in rows), 2)
        category_items: List[Dict[str, Any]] = []

        for cat, cat_total, tx_count in rows:
            cat_amount = float(cat_total)
            percentage = round((cat_amount / total_expense) * 100, 2) if total_expense > 0 else 0.0
            category_items.append({
                "category_id": cat.id,
                "category_name": cat.name,
                "category_icon": cat.icon,
                "icon": cat.icon,
                "total_expense": cat_amount,
                "percentage": percentage,
                "transaction_count": tx_count,
            })

        return {
            "from_date": start_date,
            "to_date": end_date,
            "total_expense": total_expense,
            "categories": category_items,
        }

    def get_budgets_report(
        self,
        db: Session,
        user: User,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Báo cáo đối chiếu ngân sách:
        - Lấy ngân sách của user giao thoa với khoảng thời gian báo cáo.
        - Tính spent_amount theo transaction_date.
        - Tính remaining_amount và usage_percent.
        """
        start_date, end_date = self._resolve_date_range(from_date, to_date)
        budgets = self.report_repo.get_budgets_in_range(
            db=db,
            user_id=user.id,
            from_date=start_date,
            to_date=end_date
        )

        budget_items: List[Dict[str, Any]] = []
        for b in budgets:
            spent = self.budget_repo.calculate_spent(
                db=db,
                user_id=user.id,
                category_id=b.category_id,
                start_date=b.start_date,
                end_date=b.end_date
            )
            b_amount = float(b.amount)
            spent_amount = float(spent)
            remaining_amount = max(0.0, round(b_amount - spent_amount, 2))
            usage_percent = round((spent_amount / b_amount) * 100, 2) if b_amount > 0 else 0.0

            category_name = b.category.name if b.category else "Tất cả danh mục"
            category_icon = b.category.icon if b.category else "account_balance_wallet"

            budget_items.append({
                "budget_id": b.id,
                "category_id": b.category_id,
                "category_name": category_name,
                "category_icon": category_icon,
                "budget_amount": b_amount,
                "spent_amount": spent_amount,
                "remaining_amount": remaining_amount,
                "usage_percent": usage_percent,
                "start_date": b.start_date,
                "end_date": b.end_date,
            })

        return {
            "from_date": start_date,
            "to_date": end_date,
            "budgets": budget_items,
        }


report_service = ReportService()
