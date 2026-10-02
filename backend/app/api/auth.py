from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.auth import (
    EmailRegisterRequest,
    EmailLoginRequest,
    LoginResponse,
    UserResponse,
    GoogleRegisterRequest,
    GoogleAuthResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    MessageResponse
)
from app.services.auth_service import auth_service

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký tài khoản bằng Email và Mật khẩu"
)
def register_with_email(
    payload: EmailRegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Tiếp nhận đăng ký tài khoản qua Email và Mật khẩu.
    - Validate thông tin
    - Kiểm tra email trùng
    - Mã hóa mật khẩu
    - Lưu User và trả thông tin User (không kèm password/hash)
    """
    user = auth_service.register_email(db=db, req=payload)
    return user


@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Đăng nhập bằng Email và Mật khẩu"
)
def login_with_email(
    payload: EmailLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Tiếp nhận đăng nhập tài khoản qua Email và Mật khẩu.
    - Validate thông tin
    - Kiểm tra email và mật khẩu
    - Kiểm tra trạng thái tài khoản
    - Trả JWT token và thông tin User kèm vai trò (role)
    """
    result = auth_service.login_email(db=db, email=payload.email, password=payload.password)
    return result


@router.post(
    "/login/google",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Đăng nhập bằng tài khoản Google"
)
def login_with_google(
    payload: GoogleRegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Tiếp nhận đăng nhập bằng Google ID token.
    - Xác minh token qua Google OIDC
    - Tìm kiếm user và liên kết tài khoản nếu cần
    - Kiểm tra trạng thái tài khoản
    - Trả JWT token và thông tin User kèm vai trò (role)
    """
    result = auth_service.login_google(db=db, credential=payload.credential)
    return result


@router.post(
    "/google",
    response_model=GoogleAuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Đăng ký / Đăng nhập ngay bằng Google OAuth"
)
def register_with_google(
    payload: GoogleRegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Tiếp nhận đăng ký / đăng nhập nhanh bằng Google ID token.
    - Xác minh token qua Google OIDC
    - Tạo user mới nếu chưa tồn tại (hoặc liên kết tài khoản nếu cùng email)
    - Tự động đăng nhập và phát hành JWT token của hệ thống
    """
    auth_result = auth_service.register_or_login_google(db=db, credential=payload.credential)
    return auth_result


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Yêu cầu đặt lại mật khẩu qua Email"
)
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Tiếp nhận yêu cầu quên mật khẩu.
    - Anti-enumeration: Trả thông báo chung bất kể email có tồn tại hay không.
    - Sinh mã token ngẫu nhiên bảo mật, lưu hash vào database và gửi qua email.
    """
    result = auth_service.request_password_reset(db=db, email=payload.email)
    return result


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Xác nhận mã token và đặt mật khẩu mới"
)
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Xác nhận token và cập nhật mật khẩu mới:
    - Kiểm tra tính hợp lệ và thời hạn token (chỉ dùng 1 lần)
    - Kiểm tra độ mạnh của mật khẩu mới theo password policy
    - Mã hóa mật khẩu bằng bcrypt và cập nhật cơ sở dữ liệu
    """
    result = auth_service.reset_password(
        db=db,
        token=payload.token,
        new_password=payload.new_password,
        confirm_password=payload.confirm_password
    )
    return result
