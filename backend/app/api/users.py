from fastapi import APIRouter, Depends, status, UploadFile, File
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.user import (
    UserProfileResponse,
    UpdateProfileRequest,
    ChangePasswordRequest,
    ResetDataRequest,
    DeleteAccountRequest,
    ConnectedAppsResponse,
)
from app.services.user_service import user_service

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get(
    "/me",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Xem thông tin cá nhân của người dùng đang đăng nhập"
)
def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    F01.04 – Xem thông tin cá nhân:
    - Xác thực bằng token JWT hiện tại (Bearer).
    - Không nhận user_id từ Frontend.
    - Gọi qua UserService để truy vấn dữ liệu từ UserRepository.
    - Không trả về password, password_hash, token hay secret.
    """
    return user_service.get_profile(db=db, user_id=current_user.id)


@router.patch(
    "/me",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Cập nhật thông tin cá nhân của người dùng đang đăng nhập"
)
def update_my_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    F01.05 – Cập nhật thông tin cá nhân:
    - Xác thực bằng token JWT hiện tại (Bearer).
    - Không nhận user_id từ Frontend.
    - Chỉ cho phép cập nhật các trường được phép (name, email, avatar_url).
    - Ngăn chặn chỉnh sửa id, role, status, password_hash.
    - Kiểm tra email hợp lệ và xử lý trùng lặp.
    - Gọi qua UserService để cập nhật qua UserRepository.
    """
    return user_service.update_profile(db=db, user_id=current_user.id, payload=payload)


@router.post(
    "/me/avatar",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Tải lên hoặc thay thế ảnh đại diện (Avatar)"
)
@router.patch(
    "/me/avatar",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Cập nhật ảnh đại diện (Avatar) qua PATCH"
)
def upload_my_avatar(
    file: UploadFile = File(..., description="File ảnh đại diện hợp lệ (JPG, PNG, WEBP, GIF, tối đa 5MB)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    F01.05 – Upload & thay thế Avatar:
    - Xác thực bằng token JWT hiện tại.
    - Kiểm tra định dạng ảnh (MIME type + Magic bytes).
    - Kiểm tra giới hạn dung lượng tối đa 5MB.
    - Lưu file vào uploads/avatars/ và cập nhật avatar_url của User.
    """
    return user_service.upload_avatar(db=db, user=current_user, file=file)


@router.delete(
    "/me/avatar",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Xóa ảnh đại diện và quay về ảnh mặc định"
)
def delete_my_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    F01.05 – Xóa Avatar:
    - Xác thực bằng token JWT hiện tại.
    - Xóa file trên đĩa (nếu có) và đặt avatar_url về None.
    """
    return user_service.delete_avatar(db=db, user=current_user)


@router.patch(
    "/me/password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Đổi mật khẩu cho người dùng đang đăng nhập"
)
def change_my_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    F01.06 – Đổi mật khẩu:
    - Xác thực bằng token JWT hiện tại (Bearer).
    - Không nhận user_id từ Frontend.
    - Kiểm tra mật khẩu hiện tại và validate độ mạnh mật khẩu mới.
    - Không lưu mật khẩu plaintext, hash bằng bcrypt.
    - Sau khi đổi mật khẩu thành công, thu hồi tất cả các phiên đăng nhập khác, bảo lưu phiên hiện tại.
    - Response không chứa password hay password_hash.
    """
    return user_service.change_password(db=db, user=current_user, payload=payload)


@router.post(
    "/me/reset-data",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Xóa toàn bộ dữ liệu giao dịch, ngân sách và đặt lại ví"
)
def reset_my_data(
    payload: ResetDataRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Quyền riêng tư - Xóa dữ liệu (Reset Data):
    - Xóa toàn bộ giao dịch, ngân sách, danh mục tùy chỉnh.
    - Đặt lại ví về 0 (ví tiền mặt mặc định).
    - Yêu cầu mật khẩu và chuỗi xác nhận 'RESET DATA' hoặc 'XOA DU LIEU'.
    """
    return user_service.reset_user_data(db=db, user=current_user, payload=payload)


@router.post(
    "/me/delete-account",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Xóa vĩnh viễn tài khoản người dùng và toàn bộ dữ liệu"
)
@router.delete(
    "/me",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Xóa vĩnh viễn tài khoản qua DELETE /me"
)
def delete_my_account(
    payload: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Quyền riêng tư - Xóa tài khoản vĩnh viễn (Delete Account):
    - Bảo vệ tài khoản Super Admin không được tự xóa.
    - Xóa sạch mọi dữ liệu liên quan và bản ghi User.
    - Yêu cầu mật khẩu và chuỗi xác nhận 'XOA TAI KHOAN' hoặc 'DELETE ACCOUNT'.
    """
    return user_service.delete_user_account(db=db, user=current_user, payload=payload)


@router.get(
    "/me/connected-apps",
    response_model=ConnectedAppsResponse,
    status_code=status.HTTP_200_OK,
    summary="Xem danh sách ứng dụng bên thứ 3 đã liên kết (Google)"
)
def get_my_connected_apps(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Quyền riêng tư - Quản lý ứng dụng bên thứ 3:
    - Xem trạng thái liên kết với Google OAuth.
    """
    return user_service.get_connected_apps(db=db, user=current_user)


@router.post(
    "/me/connected-apps/{provider}/revoke",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Thu hồi quyền truy cập / Hủy liên kết ứng dụng bên thứ 3"
)
def revoke_my_connected_app(
    provider: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Quyền riêng tư - Thu hồi quyền ứng dụng bên thứ 3:
    - Hủy liên kết tài khoản Google.
    - Đảm bảo người dùng đã có mật khẩu trước khi hủy liên kết.
    """
    return user_service.revoke_connected_app(db=db, user=current_user, provider=provider)

