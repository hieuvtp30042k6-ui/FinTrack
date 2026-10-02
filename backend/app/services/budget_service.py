from typing import List, Dict, Any, Optional
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.budget import Budget
from app.schemas.budget import CreateBudgetRequest, UpdateBudgetRequest
from app.repositories.budget_repository import budget_repository, BudgetRepository
from app.repositories.category_repository import category_repository, CategoryRepository


class BudgetService:
    def __init__(
        self,
        budget_repo: BudgetRepository = budget_repository,
        cat_repo: CategoryRepository = category_repository
    ):
        self.budget_repo = budget_repo
        self.cat_repo = cat_repo

    def _build_response_dict(self, db: Session, budget: Budget) -> Dict[str, Any]:
        """Tính toán spent, remaining, percentage và chuẩn hóa response."""
        spent = self.budget_repo.calculate_spent(
            db=db,
            user_id=budget.user_id,
            category_id=budget.category_id,
            start_date=budget.start_date,
            end_date=budget.end_date
        )

        amount_dec = Decimal(str(budget.amount))
        spent_float = float(spent)
        amount_float = float(amount_dec)
        remaining_float = max(0.0, amount_float - spent_float)

        percentage = round((spent_float / amount_float) * 100, 2) if amount_float > 0 else 0.0

        if percentage > 100:
            status_label = "exceeded"
        elif percentage >= 80:
            status_label = "warning"
        else:
            status_label = "normal"

        category_name = None
        category_icon = None
        if budget.category:
            category_name = budget.category.name
            category_icon = budget.category.icon
        elif budget.category_id is not None:
            cat = self.cat_repo.get_by_id(db, budget.category_id)
            if cat:
                category_name = cat.name
                category_icon = cat.icon

        return {
            "id": budget.id,
            "user_id": budget.user_id,
            "category_id": budget.category_id,
            "category_name": category_name or "Tất cả danh mục",
            "category": category_name or "Tất cả danh mục",
            "category_icon": category_icon or "account_balance_wallet",
            "icon": category_icon or "account_balance_wallet",
            "amount": amount_float,
            "limit": amount_float,
            "spent": spent_float,
            "remaining": remaining_float,
            "percentage": percentage,
            "status": status_label,
            "start_date": budget.start_date,
            "end_date": budget.end_date,
            "created_at": budget.created_at,
            "updated_at": budget.updated_at,
        }

    def _validate_category(self, db: Session, user: User, category_id: Optional[int]):
        """Kiểm tra Category phải tồn tại, user có quyền truy cập và là loại EXPENSE."""
        if category_id is None:
            return None
        cat = self.cat_repo.get_user_accessible_category(db, category_id=category_id, user_id=user.id)
        if not cat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Danh mục không tồn tại hoặc bạn không có quyền sử dụng danh mục này."
            )
        if cat.type.upper() != "EXPENSE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ngân sách chỉ được thiết lập cho danh mục loại chi tiêu (EXPENSE)."
            )
        return cat

    def create_budget(self, db: Session, user: User, payload: CreateBudgetRequest) -> Dict[str, Any]:
        """Tạo mới ngân sách cho user hiện tại."""
        # 1. Kiểm tra danh mục
        if payload.category_id is not None:
            self._validate_category(db, user, payload.category_id)

        # 2. Kiểm tra xung đột trùng lặp khoảng thời gian cho cùng danh mục
        conflict = self.budget_repo.find_overlapping(
            db=db,
            user_id=user.id,
            category_id=payload.category_id,
            start_date=payload.start_date,
            end_date=payload.end_date
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Đã tồn tại ngân sách cho phạm vi danh mục này trong khoảng thời gian đã chọn."
            )

        # 3. Tạo ngân sách
        budget_data = {
            "user_id": user.id,
            "category_id": payload.category_id,
            "amount": payload.amount,
            "start_date": payload.start_date,
            "end_date": payload.end_date,
        }
        budget = self.budget_repo.create(db, budget_data)
        return self._build_response_dict(db, budget)

    def list_budgets(
        self,
        db: Session,
        user: User,
        category_id: Optional[int] = None,
        month: Optional[int] = None,
        year: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Lấy danh sách ngân sách của user hiện tại."""
        budgets = self.budget_repo.get_all_by_user(
            db=db,
            user_id=user.id,
            category_id=category_id,
            month=month,
            year=year
        )
        return [self._build_response_dict(db, b) for b in budgets]

    def get_budget_detail(self, db: Session, user: User, budget_id: int) -> Dict[str, Any]:
        """Xem chi tiết một ngân sách."""
        budget = self.budget_repo.get_by_id(db, budget_id)
        if not budget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ngân sách không tồn tại trong hệ thống."
            )
        if budget.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập ngân sách của người dùng khác."
            )
        return self._build_response_dict(db, budget)

    def update_budget(
        self,
        db: Session,
        user: User,
        budget_id: int,
        payload: UpdateBudgetRequest
    ) -> Dict[str, Any]:
        """Cập nhật ngân sách."""
        budget = self.budget_repo.get_by_id(db, budget_id)
        if not budget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ngân sách không tồn tại trong hệ thống."
            )
        if budget.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền sửa ngân sách của người dùng khác."
            )

        update_data = {}
        new_category_id = budget.category_id
        if payload.category_id is not None:
            self._validate_category(db, user, payload.category_id)
            update_data["category_id"] = payload.category_id
            new_category_id = payload.category_id

        if payload.amount is not None:
            update_data["amount"] = payload.amount

        new_start = payload.start_date or budget.start_date
        new_end = payload.end_date or budget.end_date

        if new_start > new_end:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ngày bắt đầu không được lớn hơn ngày kết thúc."
            )

        if payload.start_date is not None:
            update_data["start_date"] = payload.start_date
        if payload.end_date is not None:
            update_data["end_date"] = payload.end_date

        # Kiểm tra trùng lặp nếu có thay đổi thời gian hoặc category
        if "category_id" in update_data or "start_date" in update_data or "end_date" in update_data:
            conflict = self.budget_repo.find_overlapping(
                db=db,
                user_id=user.id,
                category_id=new_category_id,
                start_date=new_start,
                end_date=new_end,
                exclude_id=budget.id
            )
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Đã tồn tại ngân sách cho danh mục này trong khoảng thời gian đã chọn."
                )

        updated_budget = self.budget_repo.update(db, budget, update_data)
        return self._build_response_dict(db, updated_budget)

    def delete_budget(self, db: Session, user: User, budget_id: int) -> Dict[str, str]:
        """Xóa ngân sách."""
        budget = self.budget_repo.get_by_id(db, budget_id)
        if not budget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ngân sách không tồn tại trong hệ thống."
            )
        if budget.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền xóa ngân sách của người dùng khác."
            )

        self.budget_repo.delete(db, budget)
        return {"message": "Xóa ngân sách thành công."}


budget_service = BudgetService()
