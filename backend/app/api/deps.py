from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.repositories.user_repository import user_repository

http_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    auth: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db)
) -> User:
    """Extract and validate JWT token to get current authenticated user."""
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yêu cầu thông tin xác thực (Bearer Token).",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(auth.credentials)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ: thiếu thông tin định danh.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = user_repository.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng không tồn tại.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị khóa hoặc chưa được kích hoạt.",
        )

    # Check session revocation (F01.06: Revoke other sessions on password change)
    token_sid = payload.get("sid")
    token_iat = payload.get("iat")

    if user.password_changed_at:
        is_current_session = bool(token_sid and user.active_session_id and token_sid == user.active_session_id)
        if not is_current_session:
            if token_iat is None or token_iat <= user.password_changed_at:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Phiên đăng nhập đã bị thu hồi do đổi mật khẩu. Vui lòng đăng nhập lại.",
                    headers={"WWW-Authenticate": "Bearer"},
                )

    setattr(user, "_current_token_sid", token_sid)
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Authorize access strictly for Admin or Super Admin users."""
    if current_user.role not in ("admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập chức năng này (yêu cầu quyền Admin hoặc Super Admin).",
        )
    return current_user


def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    """Authorize access strictly for Super Admin users."""
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chức năng này chỉ dành riêng cho Super Admin (Toàn quyền hệ thống).",
        )
    return current_user


__all__ = ["get_db", "get_current_user", "require_admin", "require_super_admin"]
