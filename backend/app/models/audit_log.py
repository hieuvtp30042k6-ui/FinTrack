from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class AuditLog(Base):
    """
    Bảng audit_logs theo đặc tả tài liệu (Mục 14, 19)
    Lưu nhật ký hoạt động hệ thống: F08.09 - Xem nhật ký hoạt động
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(50), nullable=False, index=True)       # CREATE, UPDATE, DELETE, LOGIN, LOGOUT, LOCK, UNLOCK
    entity = Column(String(50), nullable=False, index=True)       # user, transaction, category, wallet, budget, auth
    entity_id = Column(Integer, nullable=True)                    # ID của bản ghi bị tác động
    details = Column(Text, nullable=True)                         # Chi tiết thay đổi hoặc mô tả
    ip_address = Column(String(45), nullable=True)                # IPv4 hoặc IPv6
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Quan hệ
    user = relationship("User", backref="audit_logs", lazy="joined")
