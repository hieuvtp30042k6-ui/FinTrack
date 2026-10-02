from datetime import date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract

from app.models.budget import Budget
from app.models.transaction import Transaction


class BudgetRepository:
    def get_by_id(self, db: Session, budget_id: int) -> Optional[Budget]:
        return db.query(Budget).filter(Budget.id == budget_id).first()

    def get_by_id_and_user(self, db: Session, budget_id: int, user_id: int) -> Optional[Budget]:
        return db.query(Budget).filter(
            Budget.id == budget_id,
            Budget.user_id == user_id
        ).first()

    def get_all_by_user(
        self,
        db: Session,
        user_id: int,
        category_id: Optional[int] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
    ) -> List[Budget]:
        query = db.query(Budget).filter(Budget.user_id == user_id)

        if category_id is not None:
            query = query.filter(Budget.category_id == category_id)

        if month is not None:
            query = query.filter(extract("month", Budget.start_date) == month)

        if year is not None:
            query = query.filter(extract("year", Budget.start_date) == year)

        return query.order_by(Budget.start_date.desc(), Budget.id.desc()).all()

    def find_overlapping(
        self,
        db: Session,
        user_id: int,
        category_id: Optional[int],
        start_date: date,
        end_date: date,
        exclude_id: Optional[int] = None
    ) -> Optional[Budget]:
        """
        Kiểm tra xem đã có ngân sách nào của user cho cùng category
        bị trùng/giao khoảng thời gian hay không.
        Hai khoảng [s1, e1] và [s2, e2] giao nhau khi: s1 <= e2 AND e1 >= s2
        """
        query = db.query(Budget).filter(
            Budget.user_id == user_id,
            Budget.category_id == category_id,
            Budget.start_date <= end_date,
            Budget.end_date >= start_date
        )
        if exclude_id is not None:
            query = query.filter(Budget.id != exclude_id)
        return query.first()

    def calculate_spent(
        self,
        db: Session,
        user_id: int,
        category_id: Optional[int],
        start_date: date,
        end_date: date
    ) -> Decimal:
        """
        Tính tổng chi tiêu (EXPENSE) của user trong phạm vi Budget:
        - Chỉ tính Transaction thuộc user_id.
        - Chỉ tính loại 'EXPENSE' (loại trừ 'INCOME').
        - Lọc theo transaction_date (không dùng created_at).
        - Nếu category_id có giá trị, lọc theo category_id.
        """
        query = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.user_id == user_id,
            Transaction.type == "EXPENSE",
            Transaction.transaction_date >= start_date,
            Transaction.transaction_date <= end_date
        )

        if category_id is not None:
            query = query.filter(Transaction.category_id == category_id)

        spent_val = query.scalar()
        return Decimal(str(spent_val)) if spent_val is not None else Decimal("0.0")

    def create(self, db: Session, data: Dict[str, Any]) -> Budget:
        budget = Budget(
            user_id=data["user_id"],
            category_id=data.get("category_id"),
            amount=data["amount"],
            start_date=data["start_date"],
            end_date=data["end_date"],
        )
        db.add(budget)
        db.commit()
        db.refresh(budget)
        return budget

    def update(self, db: Session, budget: Budget, update_data: Dict[str, Any]) -> Budget:
        for key, value in update_data.items():
            if hasattr(budget, key):
                setattr(budget, key, value)
        db.commit()
        db.refresh(budget)
        return budget

    def delete(self, db: Session, budget: Budget) -> None:
        db.delete(budget)
        db.commit()


budget_repository = BudgetRepository()
