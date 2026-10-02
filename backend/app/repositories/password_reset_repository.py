import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.password_reset_token import PasswordResetToken


class PasswordResetRepository:
    def create_token(
        self,
        db: Session,
        user_id: int,
        token_hash: str,
        expires_at: datetime.datetime
    ) -> PasswordResetToken:
        reset_token = PasswordResetToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            used_at=None
        )
        db.add(reset_token)
        db.commit()
        db.refresh(reset_token)
        return reset_token

    def get_by_token_hash(self, db: Session, token_hash: str) -> Optional[PasswordResetToken]:
        return db.query(PasswordResetToken).filter(
            PasswordResetToken.token_hash == token_hash
        ).first()

    def mark_as_used(self, db: Session, token: PasswordResetToken) -> PasswordResetToken:
        token.used_at = datetime.datetime.now(datetime.timezone.utc)
        db.commit()
        db.refresh(token)
        return token

    def count_recent_requests(self, db: Session, user_id: int, since: datetime.datetime) -> int:
        """Count how many reset requests this user created since a given time for rate limiting."""
        return db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.created_at >= since
        ).count()


password_reset_repository = PasswordResetRepository()
