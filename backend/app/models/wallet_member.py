from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class WalletMember(Base):
    __tablename__ = "wallet_members"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    role = Column(String(20), default="VIEWER", server_default="VIEWER", nullable=False)  # 'VIEWER' | 'EDITOR'
    status = Column(String(20), default="ACCEPTED", server_default="ACCEPTED", nullable=False)  # 'ACCEPTED' | 'PENDING'
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    wallet = relationship("Wallet", back_populates="members")
    user = relationship("User", backref="wallet_memberships")

    def __repr__(self) -> str:
        return f"<WalletMember id={self.id} wallet_id={self.wallet_id} email='{self.email}' role='{self.role}' status='{self.status}'>"
