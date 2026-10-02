from sqlalchemy import Column, Integer, String, Numeric, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import expression, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    balance = Column(Numeric(15, 2), default=0.0, nullable=False)
    currency = Column(String(10), default="VND", server_default="VND", nullable=False)
    is_excluded_from_total = Column(Boolean, default=False, server_default=expression.false(), nullable=False)
    is_archived = Column(Boolean, default=False, server_default=expression.false(), nullable=False)
    is_shared = Column(Boolean, default=False, server_default=expression.false(), nullable=False)
    wallet_type = Column(String(20), default="STANDARD", server_default="STANDARD", nullable=False)  # 'STANDARD' | 'CREDIT'
    credit_limit = Column(Numeric(15, 2), nullable=True)
    statement_day = Column(Integer, nullable=True)  # 1-31
    payment_due_day = Column(Integer, nullable=True)  # 1-31
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", backref="wallets")
    members = relationship("WalletMember", back_populates="wallet", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Wallet id={self.id} name='{self.name}' balance={self.balance} currency='{self.currency}' type='{self.wallet_type}' user_id={self.user_id}>"

