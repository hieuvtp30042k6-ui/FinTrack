from datetime import date
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models.transaction import Transaction


class TransactionRepository:
    def get_by_id(self, db: Session, transaction_id: int) -> Optional[Transaction]:
        return db.query(Transaction).filter(Transaction.id == transaction_id).first()

    def get_by_id_and_user(self, db: Session, transaction_id: int, user_id: int) -> Optional[Transaction]:
        return db.query(Transaction).filter(
            Transaction.id == transaction_id,
            Transaction.user_id == user_id
        ).first()

    def get_all_by_user(
        self,
        db: Session,
        user_id: int,
        tx_type: Optional[str] = None,
        category_id: Optional[int] = None,
        wallet_id: Optional[int] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> List[Transaction]:
        """Lấy danh sách giao dịch của user, có thể lọc theo type/category/wallet/ngày."""
        query = db.query(Transaction).filter(Transaction.user_id == user_id)

        if tx_type:
            query = query.filter(Transaction.type == tx_type.upper())
        if category_id is not None:
            query = query.filter(Transaction.category_id == category_id)
        if wallet_id is not None:
            query = query.filter(Transaction.wallet_id == wallet_id)
        if from_date is not None:
            query = query.filter(Transaction.transaction_date >= from_date)
        if to_date is not None:
            query = query.filter(Transaction.transaction_date <= to_date)

        return query.order_by(Transaction.transaction_date.desc(), Transaction.id.desc()).all()

    def create(self, db: Session, data: Dict[str, Any]) -> Transaction:
        transaction = Transaction(
            user_id=data["user_id"],
            wallet_id=data["wallet_id"],
            category_id=data["category_id"],
            type=data["type"],
            amount=data["amount"],
            description=data.get("description"),
            transaction_date=data["transaction_date"],
        )
        db.add(transaction)
        # Commit được thực hiện trong service để đảm bảo atomic transaction
        return transaction

    def update(self, db: Session, transaction: Transaction, update_data: Dict[str, Any]) -> Transaction:
        for key, value in update_data.items():
            if hasattr(transaction, key):
                setattr(transaction, key, value)
        # Commit được thực hiện trong service để đảm bảo atomic transaction
        return transaction

    def delete(self, db: Session, transaction: Transaction) -> None:
        db.delete(transaction)
        # Commit được thực hiện trong service để đảm bảo atomic transaction


transaction_repository = TransactionRepository()
