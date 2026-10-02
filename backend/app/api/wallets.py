from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.wallet import (
    CreateWalletRequest,
    UpdateWalletRequest,
    WalletResponse,
    TransferRequest,
    TransferResponse,
    AdjustBalanceRequest,
    AdjustBalanceResponse,
    InviteMemberRequest,
    UpdateMemberRoleRequest,
    WalletMemberResponse,
)
from app.services.wallet_service import wallet_service

router = APIRouter(prefix="/api/wallets", tags=["Wallets"])


@router.post(
    "",
    response_model=WalletResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo ví mới"
)
def create_wallet(
    payload: CreateWalletRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Tạo ví mới cho người dùng đang đăng nhập:
    - user_id được lấy từ JWT Token, không nhận từ Frontend.
    - Hỗ trợ ví tiền tiêu chuẩn hoặc Thẻ tín dụng (credit_limit, statement_day, payment_due_day).
    - Hỗ trợ đánh dấu không tính vào tổng tài sản (is_excluded_from_total).
    """
    return wallet_service.create_wallet(db=db, user=current_user, payload=payload)


@router.get(
    "",
    response_model=List[WalletResponse],
    status_code=status.HTTP_200_OK,
    summary="Xem danh sách ví"
)
def list_wallets(
    include_archived: bool = Query(True, description="Bao gồm cả các ví đã lưu trữ"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lấy danh sách tất cả ví thuộc người dùng đang đăng nhập.
    """
    return wallet_service.list_wallets(db=db, user=current_user, include_archived=include_archived)


@router.post(
    "/transfer",
    response_model=TransferResponse,
    status_code=status.HTTP_200_OK,
    summary="Chuyển tiền giữa các ví (Transfer)"
)
def transfer_funds(
    payload: TransferRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Chuyển tiền giữa các ví:
    - Không tính là thu hay chi trong báo cáo.
    - Cập nhật số dư 2 ví và tự động ghi nhận giao dịch chuyển tiền.
    """
    return wallet_service.transfer_funds(db=db, user=current_user, payload=payload)


@router.post(
    "/adjust-balance",
    response_model=AdjustBalanceResponse,
    status_code=status.HTTP_200_OK,
    summary="Điều chỉnh số dư ví (Balance Adjustment)"
)
def adjust_balance(
    payload: AdjustBalanceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Điều chỉnh số dư ví khi lệch với thực tế:
    - Cập nhật số dư ví thành số dư thực tế mới.
    - Ghi nhận giao dịch ADJUSTMENT và không tính vào thu/chi trong báo cáo.
    """
    return wallet_service.adjust_balance(db=db, user=current_user, payload=payload)


@router.get(
    "/{wallet_id}",
    response_model=WalletResponse,
    status_code=status.HTTP_200_OK,
    summary="Xem chi tiết ví"
)
def get_wallet_detail(
    wallet_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Xem chi tiết ví theo ID:
    - Chỉ cho phép xem ví của chính người dùng đang đăng nhập.
    """
    return wallet_service.get_wallet_detail(db=db, user=current_user, wallet_id=wallet_id)


@router.patch(
    "/{wallet_id}",
    response_model=WalletResponse,
    status_code=status.HTTP_200_OK,
    summary="Cập nhật ví"
)
def update_wallet(
    wallet_id: int,
    payload: UpdateWalletRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cập nhật ví:
    - Đổi tên, tiền tệ, trạng thái loại trừ tổng tài sản, lưu trữ, hoặc thiết lập thẻ tín dụng.
    """
    return wallet_service.update_wallet(db=db, user=current_user, wallet_id=wallet_id, payload=payload)


@router.patch(
    "/{wallet_id}/archive",
    response_model=WalletResponse,
    status_code=status.HTTP_200_OK,
    summary="Lưu trữ ví (ẩn khỏi danh sách sử dụng)"
)
def archive_wallet(
    wallet_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lưu trữ ví mà không xóa dữ liệu lịch sử."""
    return wallet_service.update_wallet(
        db=db,
        user=current_user,
        wallet_id=wallet_id,
        payload=UpdateWalletRequest(is_archived=True)
    )


@router.patch(
    "/{wallet_id}/unarchive",
    response_model=WalletResponse,
    status_code=status.HTTP_200_OK,
    summary="Khôi phục ví từ trạng thái lưu trữ"
)
def unarchive_wallet(
    wallet_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Khôi phục ví đang lưu trữ."""
    return wallet_service.update_wallet(
        db=db,
        user=current_user,
        wallet_id=wallet_id,
        payload=UpdateWalletRequest(is_archived=False)
    )


@router.delete(
    "/{wallet_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Xóa hoặc lưu trữ ví"
)
def delete_wallet(
    wallet_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Xóa ví:
    - Nếu ví đã có giao dịch phát sinh: chuyển sang trạng thái lưu trữ (is_archived = True) để bảo toàn dữ liệu.
    - Nếu ví chưa có giao dịch: xóa hoàn toàn.
    """
    return wallet_service.delete_wallet(db=db, user=current_user, wallet_id=wallet_id)


# ─── Quản lý thành viên ví chung (Family Shared Wallet) ─────────────────────────

@router.get(
    "/{wallet_id}/members",
    response_model=List[WalletMemberResponse],
    status_code=status.HTTP_200_OK,
    summary="Xem danh sách thành viên của ví chung"
)
def list_wallet_members(
    wallet_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Xem danh sách thành viên của ví:
    - Chủ sở hữu và tất cả thành viên trong ví đều có quyền xem.
    """
    return wallet_service.list_members(db=db, user=current_user, wallet_id=wallet_id)


@router.post(
    "/{wallet_id}/members",
    response_model=WalletMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Mời thành viên vào ví chung"
)
def invite_wallet_member(
    wallet_id: int,
    payload: InviteMemberRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mời người thân/thành viên tham gia ví chung:
    - Chỉ chủ ví (Owner) mới có quyền mời.
    - Quyền hạn: VIEWER (chỉ xem) hoặc EDITOR (được tạo/sửa chi tiêu gia đình).
    """
    return wallet_service.invite_member(
        db=db,
        user=current_user,
        wallet_id=wallet_id,
        email=payload.email,
        role=payload.role
    )


@router.patch(
    "/{wallet_id}/members/{member_id}",
    response_model=WalletMemberResponse,
    status_code=status.HTTP_200_OK,
    summary="Cập nhật quyền hạn thành viên ví chung"
)
def update_wallet_member_role(
    wallet_id: int,
    member_id: int,
    payload: UpdateMemberRoleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Thay đổi vai trò của thành viên (VIEWER <-> EDITOR):
    - Chỉ chủ ví (Owner) mới có quyền đổi vai trò.
    """
    return wallet_service.update_member_role(
        db=db,
        user=current_user,
        wallet_id=wallet_id,
        member_id=member_id,
        role=payload.role
    )


@router.delete(
    "/{wallet_id}/members/{member_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Xóa thành viên khỏi ví chung"
)
def remove_wallet_member(
    wallet_id: int,
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Xóa thành viên khỏi ví chung:
    - Chủ ví có thể xóa bất kỳ thành viên nào.
    - Hoặc thành viên có thể tự xóa quyền của chính mình.
    """
    return wallet_service.remove_member(
        db=db,
        user=current_user,
        wallet_id=wallet_id,
        member_id=member_id
    )


@router.post(
    "/{wallet_id}/leave",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Thành viên tự rời khỏi ví chung"
)
def leave_wallet(
    wallet_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Rời khỏi ví chung gia đình:
    - Áp dụng cho các thành viên được chia sẻ (không áp dụng cho chủ sở hữu ví).
    """
    return wallet_service.leave_wallet(db=db, user=current_user, wallet_id=wallet_id)


