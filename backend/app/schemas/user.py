from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator, ConfigDict


class UserProfileResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    status: str
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    has_password: Optional[bool] = None
    google_connected: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class AdminUserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Họ và tên người dùng")
    email: Optional[EmailStr] = Field(None, description="Địa chỉ email hợp lệ")
    avatar_url: Optional[str] = Field(None, description="URL ảnh đại diện hoặc None để xóa")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            stripped = v.strip()
            if not stripped:
                raise ValueError("Họ và tên không được để trống.")
            return stripped
        return v

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return v.strip().lower()
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, description="Mật khẩu hiện tại")
    new_password: str = Field(..., min_length=8, max_length=128, description="Mật khẩu mới")
    confirm_password: str = Field(..., description="Xác nhận mật khẩu mới")

    @model_validator(mode="after")
    def check_passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Mật khẩu xác nhận không khớp với mật khẩu mới.")
        return self


class ResetDataRequest(BaseModel):
    password: Optional[str] = Field(None, description="Mật khẩu tài khoản (bắt buộc nếu tài khoản có mật khẩu)")
    confirmation_text: str = Field(..., min_length=1, description="Cụm từ xác nhận 'RESET DATA' hoặc 'XOA DU LIEU'")


class DeleteAccountRequest(BaseModel):
    password: Optional[str] = Field(None, description="Mật khẩu tài khoản (bắt buộc nếu tài khoản có mật khẩu)")
    confirmation_text: str = Field(..., min_length=1, description="Cụm từ xác nhận 'XOA TAI KHOAN' hoặc 'DELETE ACCOUNT'")


class ConnectedAppItem(BaseModel):
    provider: str
    name: str
    connected: bool
    email: Optional[str] = None
    icon: Optional[str] = None


class ConnectedAppsResponse(BaseModel):
    apps: list[ConnectedAppItem]

