from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.models.category import Category
from app.models.transaction import Transaction


class CategoryRepository:
    def get_by_id(self, db: Session, category_id: int) -> Optional[Category]:
        return db.query(Category).filter(Category.id == category_id).first()

    def get_user_accessible_category(self, db: Session, category_id: int, user_id: int) -> Optional[Category]:
        """
        Lấy danh mục mà user có quyền truy cập / sử dụng:
        - Danh mục hệ thống: user_id is NULL
        - Danh mục riêng của user: user_id == user_id
        """
        return (
            db.query(Category)
            .filter(
                Category.id == category_id,
                or_(Category.user_id == None, Category.user_id == user_id)
            )
            .first()
        )

    def get_user_categories(self, db: Session, user_id: int, category_type: Optional[str] = None) -> List[Category]:
        """
        Lấy toàn bộ danh mục khả dụng cho user (hệ thống + cá nhân).
        Có thể lọc theo loại thu/chi (INCOME/EXPENSE).
        """
        query = db.query(Category).filter(
            or_(Category.user_id == None, Category.user_id == user_id)
        )
        if category_type:
            query = query.filter(Category.type == category_type.strip().upper())
        return query.order_by(Category.user_id.asc(), Category.id.asc()).all()

    def find_duplicate(
        self,
        db: Session,
        name: str,
        category_type: str,
        user_id: int,
        exclude_id: Optional[int] = None
    ) -> Optional[Category]:
        """
        Kiểm tra trùng tên danh mục trong cùng loại thu/chi của user hoặc hệ thống.
        """
        query = db.query(Category).filter(
            func.lower(Category.name) == name.strip().lower(),
            Category.type == category_type.strip().upper(),
            or_(Category.user_id == None, Category.user_id == user_id)
        )
        if exclude_id is not None:
            query = query.filter(Category.id != exclude_id)
        return query.first()

    def has_transactions(self, db: Session, category_id: int) -> bool:
        """Kiểm tra danh mục đã phát sinh giao dịch nào chưa."""
        return db.query(Transaction).filter(Transaction.category_id == category_id).first() is not None

    def create(self, db: Session, data: Dict[str, Any]) -> Category:
        category = Category(
            name=data["name"].strip(),
            type=data["type"].strip().upper(),
            icon=data.get("icon"),
            description=data.get("description"),
            user_id=data.get("user_id")
        )
        db.add(category)
        db.commit()
        db.refresh(category)
        return category

    def update(self, db: Session, category: Category, update_data: Dict[str, Any]) -> Category:
        for key, value in update_data.items():
            if hasattr(category, key):
                setattr(category, key, value)
        db.commit()
        db.refresh(category)
        return category

    def delete(self, db: Session, category: Category) -> None:
        db.delete(category)
        db.commit()


category_repository = CategoryRepository()
