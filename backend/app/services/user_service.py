import os
import uuid
import datetime
from typing import Dict, Any, Optional, List
from fastapi import HTTPException, status, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.wallet import Wallet
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.models.category import Category
from app.models.password_reset_token import PasswordResetToken
from app.repositories.user_repository import user_repository, UserRepository
from app.schemas.user import (
    UpdateProfileRequest,
    ChangePasswordRequest,
    ResetDataRequest,
    DeleteAccountRequest,
    ConnectedAppsResponse,
    ConnectedAppItem,
)
from app.core.security import verify_password, hash_password, check_password_strength

ALLOWED_AVATAR_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_AVATAR_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5MB
AVATAR_UPLOAD_DIR = "uploads/avatars"


def validate_image_bytes(content: bytes) -> bool:
    """Validate image by inspecting magic bytes/signatures."""
    if len(content) < 8:
        return False
    # JPEG
    if content.startswith(b"\xff\xd8\xff"):
        return True
    # PNG
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return True
    # GIF
    if content.startswith(b"GIF87a") or content.startswith(b"GIF89a"):
        return True
    # WEBP: RIFF....WEBP
    if content.startswith(b"RIFF") and b"WEBP" in content[8:16]:
        return True
    return False


class UserService:
    def __init__(self, user_repo: UserRepository = user_repository):
        self.user_repo = user_repo

    def get_profile(self, db: Session, user_id: int) -> User:
        """
        F01.04 – Lấy thông tin cá nhân của người dùng.
        Tuân thủ kiến trúc: API -> Service -> Repository -> PostgreSQL.
        """
        user = self.user_repo.get_by_id(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy thông tin người dùng."
            )
        return user

    def update_profile(self, db: Session, user_id: int, payload: UpdateProfileRequest) -> User:
        """
        F01.05 – Cập nhật thông tin cá nhân.
        - Xác thực quyền sở hữu từ user_id trong token (không nhận user_id từ request).
        - Chỉ cho phép sửa đổi name, email, avatar_url.
        - Ngăn chặn tuyệt đối việc thay đổi role, status, id, password_hash, created_at.
        - Kiểm tra trùng lặp email nếu email được thay đổi.
        - Cập nhật thông qua UserRepository.
        """
        user = self.get_profile(db, user_id)

        update_data: Dict[str, Any] = {}

        if payload.name is not None:
            update_data["name"] = payload.name

        if payload.email is not None:
            normalized_email = payload.email.strip().lower()
            if normalized_email != user.email:
                existing_email = self.user_repo.get_by_email(db, normalized_email)
                if existing_email:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Email này đã được sử dụng trong hệ thống."
                    )
                update_data["email"] = normalized_email

        if payload.avatar_url is not None:
            update_data["avatar_url"] = payload.avatar_url if payload.avatar_url else None

        if not update_data:
            return user

        try:
            return self.user_repo.update(db, user, update_data)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email này đã được sử dụng trong hệ thống."
            )

    def upload_avatar(self, db: Session, user: User, file: UploadFile) -> User:
        """
        F01.05 – Upload & thay thế ảnh đại diện:
        - Kiểm tra đuôi file và MIME type.
        - Kiểm tra magic bytes hình ảnh.
        - Kiểm tra dung lượng tối đa 5MB.
        - Lưu vào thư mục uploads/avatars/.
        - Xóa avatar cũ trên đĩa nếu có.
        - Cập nhật URL avatar vào User.
        """
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tên file không hợp lệ."
            )

        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_AVATAR_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Định dạng file không được hỗ trợ. Chỉ chấp nhận JPG, JPEG, PNG, WEBP, GIF."
            )

        if file.content_type and file.content_type.lower() not in ALLOWED_AVATAR_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MIME type không hợp lệ. Chỉ chấp nhận file hình ảnh."
            )

        content = file.file.read()
        if len(content) > MAX_AVATAR_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kích thước file ảnh vượt quá giới hạn cho phép (tối đa 5MB)."
            )

        if not validate_image_bytes(content):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nội dung file không phải là hình ảnh hợp lệ."
            )

        os.makedirs(AVATAR_UPLOAD_DIR, exist_ok=True)

        # Xóa file avatar cũ nếu tồn tại
        if user.avatar_url and user.avatar_url.startswith(f"/{AVATAR_UPLOAD_DIR}/"):
            old_filename = os.path.basename(user.avatar_url)
            old_filepath = os.path.join(AVATAR_UPLOAD_DIR, old_filename)
            if os.path.exists(old_filepath):
                try:
                    os.remove(old_filepath)
                except OSError:
                    pass

        new_filename = f"avatar_{user.id}_{uuid.uuid4().hex[:12]}{ext}"
        new_filepath = os.path.join(AVATAR_UPLOAD_DIR, new_filename)

        with open(new_filepath, "wb") as f:
            f.write(content)

        avatar_url = f"/{AVATAR_UPLOAD_DIR}/{new_filename}"
        return self.user_repo.update(db, user, {"avatar_url": avatar_url})

    def delete_avatar(self, db: Session, user: User) -> User:
        """
        F01.05 – Xóa ảnh đại diện (đặt lại về mặc định):
        """
        if user.avatar_url and user.avatar_url.startswith(f"/{AVATAR_UPLOAD_DIR}/"):
            old_filename = os.path.basename(user.avatar_url)
            old_filepath = os.path.join(AVATAR_UPLOAD_DIR, old_filename)
            if os.path.exists(old_filepath):
                try:
                    os.remove(old_filepath)
                except OSError:
                    pass

        return self.user_repo.update(db, user, {"avatar_url": None})

    def change_password(self, db: Session, user: User, payload: ChangePasswordRequest) -> Dict[str, str]:
        """
        F01.06 – Đổi mật khẩu:
        - Kiểm tra mật khẩu hiện tại.
        - Validate độ mạnh mật khẩu mới theo chuẩn hệ thống.
        - Kiểm tra mật khẩu mới không trùng mật khẩu cũ.
        - Mã hóa mật khẩu bằng bcrypt (không lưu plaintext).
        - Thu hồi tất cả các phiên đăng nhập khác, bảo lưu phiên hiện tại.
        """
        if not user.password_hash or not verify_password(payload.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mật khẩu hiện tại không chính xác."
            )

        if payload.new_password == payload.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mật khẩu mới không được trùng với mật khẩu hiện tại."
            )

        strength, is_valid, reason = check_password_strength(payload.new_password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mật khẩu không đạt yêu cầu: {reason}"
            )

        hashed_new_pwd = hash_password(payload.new_password)
        now_ts = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
        current_sid = getattr(user, "_current_token_sid", None)

        update_data = {
            "password_hash": hashed_new_pwd,
            "password_changed_at": now_ts,
            "active_session_id": current_sid
        }

        self.user_repo.update(db, user, update_data)
        return {"message": "Đổi mật khẩu thành công."}

    # ─── ADMIN USER MANAGEMENT ───────────────────────────────────────────────

    def get_all_users_for_admin(self, db: Session) -> List[User]:
        """Admin: Lấy danh sách toàn bộ người dùng trong hệ thống."""
        return self.user_repo.get_all(db)

    def get_user_detail_for_admin(self, db: Session, user_id: int) -> User:
        """
        Admin: Lấy thông tin chi tiết một người dùng theo ID.
        Nếu không tồn tại -> raise HTTP 404.
        """
        user = self.user_repo.get_by_id(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy người dùng."
            )
        return user

    def lock_user(self, db: Session, admin_user: User, user_id: int) -> User:
        """
        Admin: Khóa tài khoản người dùng (status -> 'locked').
        - Kiểm tra user tồn tại (404).
        - Ngăn Admin tự khóa tài khoản của chính mình (400).
        - Cập nhật status = 'locked' qua Repository.
        - Đăng xuất / thu hồi mọi phiên đăng nhập hiện tại: xóa active_session_id và đặt password_changed_at.
        """
        target_user = self.get_user_detail_for_admin(db, user_id)

        if target_user.id == admin_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể tự khóa tài khoản của chính mình."
            )

        if target_user.role == "super_admin" and admin_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Không thể khóa tài khoản của Super Admin."
            )

        now_ts = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
        return self.user_repo.update(
            db,
            target_user,
            {
                "status": "locked",
                "active_session_id": None,
                "password_changed_at": now_ts,
            }
        )

    def unlock_user(self, db: Session, admin_user: User, user_id: int) -> User:
        """
        Admin: Mở khóa tài khoản người dùng (status -> 'active').
        - Kiểm tra user tồn tại (404).
        - Ngăn Admin can thiệp vào tài khoản Super Admin (403).
        - Cập nhật status = 'active' qua Repository.
        """
        target_user = self.get_user_detail_for_admin(db, user_id)

        if target_user.role == "super_admin" and admin_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Không thể thao tác trên tài khoản của Super Admin."
            )

        return self.user_repo.update(db, target_user, {"status": "active"})

    def update_user_status_for_admin(
        self, db: Session, admin_user: User, user_id: int, new_status: str
    ) -> User:
        """
        Admin: Cập nhật trạng thái người dùng (hỗ trợ tương thích ngược /status).
        Chấp nhận 'active', 'locked', 'inactive'.
        """
        if new_status in ["locked", "inactive"]:
            return self.lock_user(db, admin_user, user_id)
        elif new_status == "active":
            return self.unlock_user(db, admin_user, user_id)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Trạng thái không hợp lệ (chỉ chấp nhận 'active' hoặc 'locked')."
            )

    def update_user_role_for_admin(
        self, db: Session, admin_user: User, user_id: int, new_role: str
    ) -> User:
        """
        RBAC: Phân quyền / gán vai trò người dùng (chỉ Super Admin mới gán được).
        - Admin không thể tự nâng hoặc thay đổi quyền của chính mình.
        - 3 vai trò riêng biệt hợp lệ: 'user', 'admin', 'super_admin'.
        """
        if admin_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chỉ Super Admin mới có quyền gán vai trò và phân quyền người dùng."
            )

        target_user = self.get_user_detail_for_admin(db, user_id)

        if target_user.id == admin_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin không thể tự nâng hoặc thay đổi quyền của chính mình."
            )

        allowed_roles = ["user", "admin", "super_admin"]
        if new_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Vai trò không hợp lệ (hệ thống gồm 3 vai trò: {', '.join(allowed_roles)})."
            )

        return self.user_repo.update(db, target_user, {"role": new_role})

    def reset_password_for_admin(
        self, db: Session, admin_user: User, user_id: int
    ) -> Dict[str, Any]:
        """
        RBAC: Đặt lại mật khẩu người dùng bởi Admin/Super Admin.
        - Admin KHÔNG CÓ QUYỀN đặt lại mật khẩu cho Super Admin hoặc Admin khác (403 Forbidden).
        - Admin không được đặt lại mật khẩu của chính mình qua endpoint quản trị (400 Bad Request).
        - Chỉ Super Admin mới có quyền thao tác trên tài khoản Quản trị / Super Admin.
        """
        target_user = self.get_user_detail_for_admin(db, user_id)

        if target_user.id == admin_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể tự đặt lại mật khẩu cho chính mình qua giao diện quản trị viên."
            )

        if target_user.role in ["super_admin", "admin"] and admin_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Quản trị viên (Admin) không có quyền cấp lại hoặc đặt lại mật khẩu cho Super Admin hoặc Quản trị viên khác."
            )

        temp_pwd = "FT@" + uuid.uuid4().hex[:8] + "!9"
        hashed = hash_password(temp_pwd)
        now_ts = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
        self.user_repo.update(
            db,
            target_user,
            {
                "password_hash": hashed,
                "password_changed_at": now_ts,
                "active_session_id": None
            }
        )
        return {
            "message": f"Đặt lại mật khẩu thành công cho tài khoản {target_user.email}",
            "temp_password": temp_pwd
        }

    def reset_user_data(
        self, db: Session, user: User, payload: ResetDataRequest
    ) -> Dict[str, Any]:
        """
        Xóa toàn bộ dữ liệu tài chính của người dùng (Giao dịch, Ngân sách, Danh mục tùy chỉnh)
        và thiết lập lại số dư ví về 0 (tạo lại ví tiền mặt mặc định).
        """
        # 1. Xác thực cụm từ xác nhận
        valid_confirmations = {"RESET DATA", "XOA DU LIEU"}
        if payload.confirmation_text.strip().upper() not in valid_confirmations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cụm từ xác nhận không chính xác. Vui lòng nhập đúng 'RESET DATA' hoặc 'XOA DU LIEU'."
            )

        # 2. Xác thực mật khẩu nếu tài khoản có mật khẩu
        if user.password_hash:
            if not payload.password or not verify_password(payload.password, user.password_hash):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Mật khẩu xác nhận không chính xác."
                )

        # 3. Xóa toàn bộ giao dịch của user
        db.query(Transaction).filter(Transaction.user_id == user.id).delete(synchronize_session="fetch")

        # 4. Xóa toàn bộ ngân sách của user
        db.query(Budget).filter(Budget.user_id == user.id).delete(synchronize_session="fetch")

        # 5. Xóa danh mục tùy chỉnh của user
        db.query(Category).filter(Category.user_id == user.id).delete(synchronize_session="fetch")

        # 6. Xóa các ví cũ và tạo 1 ví mặc định Tiền mặt với số dư 0 VND
        db.query(Wallet).filter(Wallet.user_id == user.id).delete(synchronize_session="fetch")
        db.flush()

        default_wallet = Wallet(
            name="Tiền mặt",
            balance=0.0,
            currency="VND",
            wallet_type="CASH",
            user_id=user.id,
            is_excluded_from_total=False,
            is_archived=False
        )
        db.add(default_wallet)
        db.commit()

        return {
            "message": "Đã làm mới dữ liệu thành công. Toàn bộ lịch sử giao dịch và ngân sách đã được xóa sạch."
        }

    def delete_user_account(
        self, db: Session, user: User, payload: DeleteAccountRequest
    ) -> Dict[str, Any]:
        """
        Xóa vĩnh viễn tài khoản người dùng và toàn bộ dữ liệu liên quan khỏi hệ thống.
        """
        # 1. Bảo vệ tài khoản Super Admin
        if user.role == "super_admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tài khoản Quản trị cấp cao (Super Admin) không thể tự xóa vĩnh viễn. Vui lòng liên hệ quản trị hệ thống."
            )

        # 2. Xác thực cụm từ xác nhận
        valid_confirmations = {"XOA TAI KHOAN", "DELETE ACCOUNT"}
        if payload.confirmation_text.strip().upper() not in valid_confirmations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cụm từ xác nhận không chính xác. Vui lòng nhập đúng 'XOA TAI KHOAN' hoặc 'DELETE ACCOUNT'."
            )

        # 3. Xác thực mật khẩu nếu tài khoản có mật khẩu
        if user.password_hash:
            if not payload.password or not verify_password(payload.password, user.password_hash):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Mật khẩu xác nhận không chính xác."
                )

        # 4. Xóa avatar file nếu có
        if user.avatar_url:
            old_path = user.avatar_url.lstrip("/")
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except OSError:
                    pass

        # 5. Xóa các bản ghi liên quan
        db.query(Transaction).filter(Transaction.user_id == user.id).delete(synchronize_session="fetch")
        db.query(Budget).filter(Budget.user_id == user.id).delete(synchronize_session="fetch")
        db.query(Category).filter(Category.user_id == user.id).delete(synchronize_session="fetch")
        db.query(Wallet).filter(Wallet.user_id == user.id).delete(synchronize_session="fetch")
        db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete(synchronize_session="fetch")
        db.flush()

        # 6. Xóa User
        db.delete(user)
        db.commit()

        return {
            "message": "Tài khoản của bạn đã được xóa vĩnh viễn khỏi hệ thống."
        }

    def get_connected_apps(self, db: Session, user: User) -> ConnectedAppsResponse:
        """
        Lấy danh sách các ứng dụng bên thứ 3 đã liên kết với tài khoản.
        """
        is_google_connected = bool(user.google_id)
        apps = [
            ConnectedAppItem(
                provider="google",
                name="Google",
                connected=is_google_connected,
                email=user.email if is_google_connected else None,
                icon="google"
            )
        ]
        return ConnectedAppsResponse(apps=apps)

    def revoke_connected_app(self, db: Session, user: User, provider: str) -> Dict[str, Any]:
        """
        Thu hồi quyền truy cập / Hủy liên kết ứng dụng bên thứ 3.
        """
        if provider.lower() == "google":
            if not user.google_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tài khoản của bạn hiện chưa liên kết với Google."
                )
            if not user.password_hash:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Vui lòng thiết lập mật khẩu cho tài khoản trước khi hủy liên kết Google để tránh mất quyền đăng nhập."
                )
            user.google_id = None
            db.commit()
            return {"message": "Đã hủy liên kết tài khoản Google thành công."}

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Nhà cung cấp '{provider}' không được hỗ trợ."
        )


user_service = UserService()
