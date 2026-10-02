from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.category import CreateCategoryRequest, UpdateCategoryRequest, CategoryResponse
from app.services.category_service import category_service

router = APIRouter(prefix="/api/categories", tags=["Categories"])


@router.post(
    "",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo danh mục mới"
)
def create_category(
    payload: CreateCategoryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Tạo Category mới cho người dùng đang đăng nhập:
    - user_id được lấy trực tiếp từ Token JWT.
    - Loại danh mục: 'income' hoặc 'expense'.
    - Tên danh mục không được để trống và không được trùng lặp trong cùng loại.
    """
    return category_service.create_category(
        db=db,
        user=current_user,
        payload=payload
    )


@router.get(
    "",
    response_model=List[CategoryResponse],
    status_code=status.HTTP_200_OK,
    summary="Xem danh sách danh mục (hệ thống + cá nhân)"
)
def get_categories(
    type: Optional[str] = Query(None, description="Lọc theo loại danh mục ('income' hoặc 'expense')"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Xem danh sách Category:
    - Trả về danh mục mặc định của hệ thống và danh mục của chính người dùng.
    - Hỗ trợ lọc theo loại: ?type=income hoặc ?type=expense.
    """
    return category_service.list_categories(
        db=db,
        user=current_user,
        category_type=type
    )


@router.get(
    "/{category_id}",
    response_model=CategoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Xem chi tiết danh mục"
)
def get_category_detail(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Xem chi tiết một danh mục theo ID:
    - Cho phép xem nếu là danh mục hệ thống hoặc thuộc sở hữu của người dùng.
    """
    return category_service.get_category_detail(
        db=db,
        user=current_user,
        category_id=category_id
    )


@router.patch(
    "/{category_id}",
    response_model=CategoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Cập nhật danh mục"
)
def update_category(
    category_id: int,
    payload: UpdateCategoryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cập nhật tên hoặc loại danh mục:
    - Chỉ cho phép sửa danh mục do chính người dùng tạo ra.
    - Không thể sửa danh mục mặc định của hệ thống.
    - Chặn thay đổi loại nếu đã có giao dịch phát sinh liên kết.
    """
    return category_service.update_category(
        db=db,
        user=current_user,
        category_id=category_id,
        payload=payload
    )


@router.delete(
    "/{category_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Xóa danh mục"
)
def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Xóa danh mục:
    - Chỉ cho phép xóa danh mục của chính người dùng.
    - Không cho phép xóa danh mục mặc định của hệ thống.
    - Chặn xóa nếu danh mục đang có giao dịch phát sinh liên kết.
    """
    return category_service.delete_category(
        db=db,
        user=current_user,
        category_id=category_id
    )
