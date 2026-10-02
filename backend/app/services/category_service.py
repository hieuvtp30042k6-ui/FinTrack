from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.category import Category
from app.schemas.category import CreateCategoryRequest, UpdateCategoryRequest
from app.repositories.category_repository import category_repository, CategoryRepository


class CategoryService:
    def __init__(self, category_repo: CategoryRepository = category_repository):
        self.category_repo = category_repo

    def _to_response_dict(self, category: Category) -> Dict[str, Any]:
        return {
            "id": category.id,
            "user_id": category.user_id,
            "name": category.name,
            "type": category.type,
            "icon": category.icon,
            "description": category.description,
            "is_system": category.user_id is None,
            "created_at": category.created_at,
            "updated_at": category.updated_at,
        }

    def list_categories(
        self,
        db: Session,
        user: User,
        category_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Lấy danh sách danh mục khả dụng cho user (hệ thống + cá nhân)."""
        if category_type:
            normalized_type = category_type.strip().upper()
            if normalized_type not in ["INCOME", "EXPENSE"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bộ lọc loại danh mục chỉ chấp nhận 'income' hoặc 'expense'."
                )
            category_type = normalized_type

        categories = self.category_repo.get_user_categories(db, user_id=user.id, category_type=category_type)
        return [self._to_response_dict(c) for c in categories]

    def get_category_detail(
        self,
        db: Session,
        user: User,
        category_id: int
    ) -> Dict[str, Any]:
        """Xem chi tiết một danh mục."""
        category = self.category_repo.get_by_id(db, category_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Danh mục không tồn tại trong hệ thống."
            )

        if category.user_id is not None and category.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập danh mục của người dùng khác."
            )

        return self._to_response_dict(category)

    def create_category(
        self,
        db: Session,
        user: User,
        payload: CreateCategoryRequest
    ) -> Dict[str, Any]:
        """Tạo danh mục mới cho người dùng hiện tại."""
        # Kiểm tra trùng tên danh mục trong cùng loại thu/chi
        existing = self.category_repo.find_duplicate(
            db=db,
            name=payload.name,
            category_type=payload.type,
            user_id=user.id
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Danh mục '{payload.name}' ({payload.type}) đã tồn tại trong hệ thống của bạn."
            )

        cat_data = {
            "name": payload.name,
            "type": payload.type,
            "icon": payload.icon,
            "description": payload.description,
            "user_id": user.id
        }
        category = self.category_repo.create(db, cat_data)
        return self._to_response_dict(category)

    def update_category(
        self,
        db: Session,
        user: User,
        category_id: int,
        payload: UpdateCategoryRequest
    ) -> Dict[str, Any]:
        """Cập nhật thông tin danh mục của người dùng."""
        category = self.category_repo.get_by_id(db, category_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Danh mục không tồn tại trong hệ thống."
            )

        if category.user_id is not None and category.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền chỉnh sửa danh mục của người dùng khác."
            )

        target_name = payload.name if payload.name is not None else category.name
        target_type = payload.type if payload.type is not None else category.type

        # Kiểm tra trùng tên nếu đổi tên hoặc loại
        if target_name.lower() != category.name.lower() or target_type != category.type:
            duplicate = self.category_repo.find_duplicate(
                db=db,
                name=target_name,
                category_type=target_type,
                user_id=user.id,
                exclude_id=category.id
            )
            if duplicate:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Danh mục '{target_name}' ({target_type}) đã tồn tại trong hệ thống của bạn."
                )

        # Nếu đổi loại thu/chi (INCOME <-> EXPENSE), kiểm tra có giao dịch phát sinh chưa
        if payload.type is not None and target_type != category.type:
            if self.category_repo.has_transactions(db, category.id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Không thể thay đổi loại danh mục khi đã có giao dịch phát sinh."
                )

        update_data: Dict[str, Any] = {}
        if payload.name is not None:
            update_data["name"] = target_name
        if payload.type is not None:
            update_data["type"] = target_type
        if payload.icon is not None:
            update_data["icon"] = payload.icon
        if payload.description is not None:
            update_data["description"] = payload.description

        if not update_data:
            return self._to_response_dict(category)

        updated_category = self.category_repo.update(db, category, update_data)
        return self._to_response_dict(updated_category)

    def delete_category(
        self,
        db: Session,
        user: User,
        category_id: int
    ) -> Dict[str, str]:
        """Xóa danh mục của người dùng."""
        category = self.category_repo.get_by_id(db, category_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Danh mục không tồn tại trong hệ thống."
            )

        if category.user_id is not None and category.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền xóa danh mục của người dùng khác."
            )

        # Kiểm tra danh mục có giao dịch liên kết không
        if self.category_repo.has_transactions(db, category.id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể xóa danh mục đang có giao dịch phát sinh liên kết."
            )

        self.category_repo.delete(db, category)
        return {"message": "Xóa danh mục thành công."}


category_service = CategoryService()
