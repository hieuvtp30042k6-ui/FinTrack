import datetime
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.user import User
from app.schemas.auth import EmailRegisterRequest
from app.repositories.user_repository import user_repository
from app.repositories.password_reset_repository import password_reset_repository
from app.services.email_service import email_service
from app.core.security import (
    hash_password,
    verify_password,
    check_password_strength,
    create_access_token,
    verify_google_id_token,
    generate_secure_token,
    hash_token
)


class AuthService:
    def register_email(self, db: Session, req: EmailRegisterRequest) -> User:
        """
        Handle Email + Password Registration:
        1. Validate password policy & strength
        2. Check for duplicate email
        3. Hash password
        4. Persist User in database
        """
        # 1. Password policy check
        strength, is_valid, reason = check_password_strength(req.password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mật khẩu không đạt yêu cầu: {reason}"
            )

        # 2. Duplicate email check in Service
        existing_user = user_repository.get_by_email(db, req.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email này đã được sử dụng trong hệ thống."
            )

        # 3. Hash password
        hashed_pwd = hash_password(req.password)

        # 4. Save to repository with DB constraint safety
        try:
            user = user_repository.create(
                db,
                {
                    "name": req.name,
                    "email": req.email,
                    "password_hash": hashed_pwd,
                    "role": "user",
                    "status": "active"
                }
            )
            return user
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email này đã được sử dụng trong hệ thống."
            )

    def register_or_login_google(self, db: Session, credential: str) -> Dict[str, Any]:
        """
        Handle Google Registration & Immediate Login:
        1. Verify Google identity token
        2. Find or create user
        3. Account linking if email exists
        4. Issue system authentication JWT token
        """
        # 1. Verify Google identity
        try:
            id_info = verify_google_id_token(credential)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Xác thực tài khoản Google không thành công: {str(e)}"
            )

        email = id_info.get("email")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể lấy thông tin email từ Google."
            )

        # Check if email is verified by Google
        if not id_info.get("email_verified", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email Google chưa được xác thực."
            )

        google_id = id_info.get("sub")
        name = id_info.get("name") or email.split("@")[0]

        # 2. Check existing user
        user = user_repository.get_by_google_id(db, google_id)
        if not user:
            # Check if email exists
            user_by_email = user_repository.get_by_email(db, email)
            if user_by_email:
                # Link account
                user = user_repository.update(db, user_by_email, {"google_id": google_id})
            else:
                # Create brand new user
                try:
                    user = user_repository.create(
                        db,
                        {
                            "name": name,
                            "email": email,
                            "google_id": google_id,
                            "password_hash": None,
                            "role": "user",
                            "status": "active"
                        }
                    )
                except IntegrityError:
                    db.rollback()
                    # In case of concurrency race condition
                    user = user_repository.get_by_email(db, email)
                    if user and not user.google_id:
                        user = user_repository.update(db, user, {"google_id": google_id})

        # 3. Check status
        if user.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản của bạn đã bị khóa hoặc chưa kích hoạt."
            )

        # 4. Immediate login - create system JWT token
        now_ts = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
        if user.password_changed_at and now_ts <= user.password_changed_at:
            now_ts = user.password_changed_at + 1
        access_token = create_access_token(
            data={"sub": str(user.id), "email": user.email, "role": user.role, "iat": now_ts}
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }

    def login_email(self, db: Session, email: str, password: str) -> Dict[str, Any]:
        """
        Handle Email + Password Login:
        1. Look up user by email
        2. Generic 401 error if user not found or password incorrect (prevents account enumeration)
        3. Check account status (active/blocked)
        4. Verify password with bcrypt
        5. Issue system JWT access token with role from database
        """
        normalized_email = email.strip().lower()
        user = user_repository.get_by_email(db, normalized_email)

        # Generic error message to prevent account enumeration
        invalid_cred_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác."
        )

        if not user:
            raise invalid_cred_exception

        # Check account status before verifying password
        if user.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản đã bị khóa hoặc chưa được kích hoạt."
            )

        # Check if account has password configured
        if not user.password_hash:
            raise invalid_cred_exception

        # Verify password using bcrypt
        if not verify_password(password, user.password_hash):
            raise invalid_cred_exception

        # Issue system JWT access token (role is sourced strictly from database)
        now_ts = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
        if user.password_changed_at and now_ts <= user.password_changed_at:
            now_ts = user.password_changed_at + 1
        access_token = create_access_token(
            data={"sub": str(user.id), "email": user.email, "role": user.role, "iat": now_ts}
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }

    def login_google(self, db: Session, credential: str) -> Dict[str, Any]:
        """
        Handle Google Login:
        1. Verify Google identity token
        2. Find user by google_id or email
        3. Account linking if registered previously via email
        4. Reject if not registered
        5. Check account status
        6. Issue system JWT access token with role from database
        """
        try:
            id_info = verify_google_id_token(credential)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Xác thực Google credential không thành công: {str(e)}"
            )

        email = id_info.get("email")
        google_id = id_info.get("sub")

        if not email or not google_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Thông tin từ Google không đầy đủ."
            )

        # 1. Find user by google_id
        user = user_repository.get_by_google_id(db, google_id)

        # 2. If not found by google_id, check by email (Account Linking)
        if not user:
            user = user_repository.get_by_email(db, email)
            if user:
                # Link google_id without creating duplicate user
                user = user_repository.update(db, user, {"google_id": google_id})

        # 3. If user still not found, reject login (User must register first)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tài khoản Google chưa được đăng ký trong hệ thống."
            )

        # 4. Check account status
        if user.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản đã bị khóa hoặc chưa được kích hoạt."
            )

        # 5. Issue system JWT access token
        now_ts = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
        if user.password_changed_at and now_ts <= user.password_changed_at:
            now_ts = user.password_changed_at + 1
        access_token = create_access_token(
            data={"sub": str(user.id), "email": user.email, "role": user.role, "iat": now_ts}
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }

    def request_password_reset(self, db: Session, email: str) -> Dict[str, str]:
        """
        Handle Forgot Password Request:
        1. Look up user by email
        2. Anti-enumeration: always return generic confirmation message
        3. If user exists, active, and has local password:
           - Check rate limit (max 5 requests per 10 mins)
           - Generate secure token and store token_hash in DB
           - Send email with reset link
        """
        generic_response = {
            "message": "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi đến email."
        }

        normalized_email = email.strip().lower()
        user = user_repository.get_by_email(db, normalized_email)

        # Anti-enumeration: if user doesn't exist or is blocked, return generic message
        if not user or user.status != "active":
            return generic_response

        # Check if Google-only account without local password (Section 18)
        if not user.password_hash:
            return generic_response

        # Rate limiting: max 5 requests per 10 minutes
        ten_minutes_ago = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=10)
        recent_requests = password_reset_repository.count_recent_requests(db, user.id, ten_minutes_ago)
        if recent_requests >= 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Bạn đã yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau 10 phút."
            )

        # Generate secure random token
        raw_token = generate_secure_token(32)
        token_hash = hash_token(raw_token)

        # Expiration
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
        )

        # Save to database
        password_reset_repository.create_token(
            db=db,
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at
        )

        # Build reset link
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"

        # Send email via EmailService
        email_service.send_password_reset_email(
            to_email=user.email,
            reset_link=reset_link,
            expires_in_minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
        )

        return generic_response

    def reset_password(
        self,
        db: Session,
        token: str,
        new_password: str,
        confirm_password: str
    ) -> Dict[str, str]:
        """
        Handle Reset Password with Token:
        1. Validate passwords match
        2. Validate password policy (Weak / Medium / Strong)
        3. Validate token existence, expiration, and one-time use
        4. Hash new password and update user in atomic transaction
        5. Mark token as used
        6. Return confirmation (do NOT auto-login)
        """
        # 1. Confirm password match
        if new_password != confirm_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mật khẩu xác nhận không khớp."
            )

        # 2. Password policy check
        strength, is_valid, reason = check_password_strength(new_password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mật khẩu không đạt yêu cầu: {reason}"
            )

        # 3. Token lookup by SHA-256 hash
        token_hash = hash_token(token)
        reset_record = password_reset_repository.get_by_token_hash(db, token_hash)
        if not reset_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mã token đặt lại mật khẩu không hợp lệ."
            )

        # 4. Check one-time use
        if reset_record.used_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mã token đặt lại mật khẩu đã được sử dụng."
            )

        # 5. Check expiration
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        # Handle offset-naive vs offset-aware datetime from SQLite/PostgreSQL
        expires_at = reset_record.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=datetime.timezone.utc)

        if expires_at < now_utc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mã token đặt lại mật khẩu đã hết hạn."
            )

        # 6. Retrieve associated user
        user = user_repository.get_by_id(db, reset_record.user_id)
        if not user or user.status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tài khoản không hợp lệ hoặc đã bị khóa."
            )

        # 7. Atomic transaction: update password & mark token as used
        new_password_hash = hash_password(new_password)
        user.password_hash = new_password_hash
        reset_record.used_at = now_utc

        db.commit()

        return {"message": "Đặt lại mật khẩu thành công."}


auth_service = AuthService()
