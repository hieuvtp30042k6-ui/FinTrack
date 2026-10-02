from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.budget import CreateBudgetRequest, UpdateBudgetRequest, BudgetResponse
from app.services.budget_service import budget_service

router = APIRouter(prefix="/api/budgets", tags=["Budgets"])


@router.post(
    "",
    response_model=BudgetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo ngân sách mới"
)
def create_budget(
    payload: CreateBudgetRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Tạo mới một ngân sách chi tiêu:
    - User xác định từ JWT Token, không nhận user_id từ Frontend.
    - Category (nếu có) phải tồn tại, thuộc user (hoặc hệ thống) và là loại EXPENSE.
    - Hạn mức ngân sách phải lớn hơn 0.
    - Chặn trùng lặp ngân sách trong cùng khoảng thời gian cho cùng danh mục.
    """
    return budget_service.create_budget(db=db, user=current_user, payload=payload)


@router.get(
    "",
    response_model=List[BudgetResponse],
    status_code=status.HTTP_200_OK,
    summary="Xem danh sách ngân sách của người dùng"
)
def list_budgets(
    category_id: Optional[int] = Query(None, description="Lọc theo ID danh mục"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Lọc theo tháng (1-12)"),
    year: Optional[int] = Query(None, ge=2000, le=2100, description="Lọc theo năm"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Xem toàn bộ danh sách ngân sách của người dùng hiện tại kèm số tiền đã chi (spent), còn lại (remaining), tỷ lệ (percentage).
    """
    return budget_service.list_budgets(
        db=db,
        user=current_user,
        category_id=category_id,
        month=month,
        year=year
    )


@router.get(
    "/{budget_id}",
    response_model=BudgetResponse,
    status_code=status.HTTP_200_OK,
    summary="Xem chi tiết một ngân sách"
)
def get_budget_detail(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Xem chi tiết ngân sách theo ID (chỉ xem được ngân sách của chính mình).
    """
    return budget_service.get_budget_detail(db=db, user=current_user, budget_id=budget_id)


@router.patch(
    "/{budget_id}",
    response_model=BudgetResponse,
    status_code=status.HTTP_200_OK,
    summary="Cập nhật ngân sách (PATCH)"
)
def patch_budget(
    budget_id: int,
    payload: UpdateBudgetRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cập nhật thông tin ngân sách: hạn mức, danh mục, thời gian.
    """
    return budget_service.update_budget(
        db=db,
        user=current_user,
        budget_id=budget_id,
        payload=payload
    )


@router.put(
    "/{budget_id}",
    response_model=BudgetResponse,
    status_code=status.HTTP_200_OK,
    summary="Cập nhật ngân sách (PUT)"
)
def put_budget(
    budget_id: int,
    payload: UpdateBudgetRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Hỗ trợ phương thức PUT cho việc cập nhật ngân sách.
    """
    return budget_service.update_budget(
        db=db,
        user=current_user,
        budget_id=budget_id,
        payload=payload
    )


@router.delete(
    "/{budget_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Xóa ngân sách"
)
def delete_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Xóa ngân sách của người dùng hiện tại theo ID.
    """
    return budget_service.delete_budget(db=db, user=current_user, budget_id=budget_id)
