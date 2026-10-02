from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.transaction import CreateTransactionRequest, UpdateTransactionRequest, TransactionResponse
from app.services.transaction_service import transaction_service

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


@router.post(
    "",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Thêm giao dịch mới (Khoản thu hoặc Khoản chi)",
)
def create_transaction(
    payload: CreateTransactionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    F02.01 – Thêm giao dịch:
    - Yêu cầu xác thực tài khoản qua Bearer Token JWT.
    - Không nhận user_id từ Frontend, tự động gán user_id từ user đang đăng nhập.
    - `transaction_date` bắt buộc (YYYY-MM-DD): ngày giao dịch thực tế.
    - Kiểm tra ví tồn tại và thuộc sở hữu của người dùng.
    - Kiểm tra danh mục hợp lệ và tương thích với loại giao dịch (INCOME/EXPENSE).
    - Cập nhật số dư ví tương ứng (atomic).
    - Tuân thủ kiến trúc: API → Service → Repository → PostgreSQL.
    """
    return transaction_service.create_transaction(db=db, user=current_user, payload=payload)


@router.get(
    "",
    response_model=List[TransactionResponse],
    status_code=status.HTTP_200_OK,
    summary="Xem danh sách giao dịch",
)
def list_transactions(
    type: Optional[str] = Query(None, description="Lọc theo loại: 'income' hoặc 'expense'"),
    category_id: Optional[int] = Query(None, description="Lọc theo ID danh mục"),
    wallet_id: Optional[int] = Query(None, description="Lọc theo ID ví"),
    from_date: Optional[date] = Query(None, description="Lọc từ ngày (YYYY-MM-DD) – dùng transaction_date"),
    to_date: Optional[date] = Query(None, description="Lọc đến ngày (YYYY-MM-DD) – dùng transaction_date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    F02.02 – Xem danh sách giao dịch của user đang đăng nhập.
    Hỗ trợ lọc theo type, category, wallet và khoảng ngày (transaction_date).
    """
    return transaction_service.list_transactions(
        db=db,
        user=current_user,
        tx_type=type,
        category_id=category_id,
        wallet_id=wallet_id,
        from_date=from_date,
        to_date=to_date,
    )


@router.get(
    "/{transaction_id}",
    response_model=TransactionResponse,
    status_code=status.HTTP_200_OK,
    summary="Xem chi tiết giao dịch",
)
def get_transaction_detail(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    F02.03 – Xem chi tiết giao dịch theo ID.
    Chỉ cho phép xem giao dịch của chính người dùng đang đăng nhập.
    """
    return transaction_service.get_transaction_detail(
        db=db, user=current_user, transaction_id=transaction_id
    )


@router.patch(
    "/{transaction_id}",
    response_model=TransactionResponse,
    status_code=status.HTTP_200_OK,
    summary="Cập nhật giao dịch",
)
def update_transaction(
    transaction_id: int,
    payload: UpdateTransactionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    F02.04 – Cập nhật giao dịch:
    - Cho phép cập nhật type, amount, wallet, category, description, transaction_date.
    - Tính lại số dư ví tương ứng (atomic).
    - Chặn nếu số dư ví sẽ âm sau cập nhật.
    """
    return transaction_service.update_transaction(
        db=db, user=current_user, transaction_id=transaction_id, payload=payload
    )


@router.delete(
    "/{transaction_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Xóa giao dịch",
)
def delete_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    F02.05 – Xóa giao dịch:
    - Hoàn lại ảnh hưởng của giao dịch vào số dư ví (atomic).
    - Chỉ cho phép xóa giao dịch của chính người dùng.
    """
    return transaction_service.delete_transaction(
        db=db, user=current_user, transaction_id=transaction_id
    )
