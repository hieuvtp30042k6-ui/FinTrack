from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator, ConfigDict


class EmailRegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Họ và tên người dùng")
    email: EmailStr = Field(..., description="Địa chỉ email hợp lệ")
    password: str = Field(..., min_length=8, max_length=128, description="Mật khẩu tài khoản")
    confirm_password: str = Field(..., description="Xác nhận mật khẩu")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Họ và tên không được để trống.")
        return stripped

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @model_validator(mode="after")
    def check_passwords_match(self) -> "EmailRegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Mật khẩu xác nhận không khớp với mật khẩu đã nhập.")
        return self


class GoogleRegisterRequest(BaseModel):
    credential: str = Field(..., min_length=10, description="Google ID Token (credential)")


class EmailLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Địa chỉ email đăng nhập")
    password: str = Field(..., min_length=1, description="Mật khẩu tài khoản")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GoogleAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="Địa chỉ email cần khôi phục mật khẩu")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, description="Mã token đặt lại mật khẩu")
    new_password: str = Field(..., min_length=8, max_length=128, description="Mật khẩu mới")
    confirm_password: str = Field(..., description="Xác nhận mật khẩu mới")

    @model_validator(mode="after")
    def check_passwords_match(self) -> "ResetPasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Mật khẩu xác nhận không khớp với mật khẩu mới.")
        return self


class MessageResponse(BaseModel):
    message: str
