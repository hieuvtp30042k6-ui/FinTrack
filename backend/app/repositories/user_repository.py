from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.user import User


class UserRepository:
    def get_all(self, db: Session):
        return db.query(User).order_by(User.created_at.desc()).all()

    def get_by_id(self, db: Session, user_id: int) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    def get_by_email(self, db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email.strip().lower()).first()

    def get_by_google_id(self, db: Session, google_id: str) -> Optional[User]:
        return db.query(User).filter(User.google_id == google_id).first()

    def create(self, db: Session, user_data: Dict[str, Any]) -> User:
        user = User(
            name=user_data["name"],
            email=user_data["email"].strip().lower(),
            password_hash=user_data.get("password_hash"),
            google_id=user_data.get("google_id"),
            role=user_data.get("role", "user"),
            status=user_data.get("status", "active")
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def update(self, db: Session, user: User, update_data: Dict[str, Any]) -> User:
        for key, value in update_data.items():
            if hasattr(user, key):
                setattr(user, key, value)
        db.commit()
        db.refresh(user)
        return user


user_repository = UserRepository()
