from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=True)  # Nullable for Google OAuth users
    google_id = Column(String(255), unique=True, index=True, nullable=True)
    role = Column(String(20), default="user", nullable=False)
    status = Column(String(20), default="active", nullable=False)
    avatar_url = Column(String(500), nullable=True)
    password_changed_at = Column(Integer, nullable=True)  # Unix timestamp for session invalidation
    active_session_id = Column(String(64), nullable=True)  # Active session ID preserved after password change
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    @property
    def has_password(self) -> bool:
        return self.password_hash is not None and len(self.password_hash) > 0

    @property
    def google_connected(self) -> bool:
        return self.google_id is not None and len(self.google_id) > 0

    def __repr__(self) -> str:
        return f"<User id={self.id} email='{self.email}' role='{self.role}' status='{self.status}'>"
