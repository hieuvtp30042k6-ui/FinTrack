from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=True, index=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(20), nullable=False)  # 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'ADJUSTMENT'
    amount = Column(Numeric(15, 2), nullable=False)
    description = Column(String(255), nullable=True)
    transaction_date = Column(Date, nullable=False)  # Ngày giao dịch thực tế (bắt buộc, do user cung cấp)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", backref="transactions")
    category = relationship("Category", backref="transactions")
    wallet = relationship("Wallet", backref="transactions")

    def __repr__(self) -> str:
        return f"<Transaction id={self.id} type='{self.type}' amount={self.amount} user_id={self.user_id} date={self.transaction_date}>"
