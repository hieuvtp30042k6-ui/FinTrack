from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict


class CreateWalletRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Tên ví (ví dụ: Ví tiền mặt, Tài khoản ngân hàng...)")
    balance: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0, description="Số dư ban đầu (>= 0, mặc định 0)")
    currency: Optional[str] = Field(default="VND", max_length=10, description="Đơn vị tiền tệ (VND, USD, EUR, JPY, GBP)")
    is_excluded_from_total: Optional[bool] = Field(default=False, description="Không tính vào tổng tài sản")
    wallet_type: Optional[str] = Field(default="STANDARD", description="Loại ví: 'STANDARD' hoặc 'CREDIT'")
    credit_limit: Optional[Decimal] = Field(default=None, ge=0, description="Hạn mức thẻ tín dụng")
    statement_day: Optional[int] = Field(default=None, ge=1, le=31, description="Ngày sao kê hàng tháng (1-31)")
    payment_due_day: Optional[int] = Field(default=None, ge=1, le=31, description="Ngày đến hạn thanh toán (1-31)")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Tên ví không được để trống.")
        return trimmed

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: Optional[str]) -> str:
        if not v or not v.strip():
            return "VND"
        return v.strip().upper()

    @field_validator("wallet_type")
    @classmethod
    def validate_wallet_type(cls, v: Optional[str]) -> str:
        if not v or not v.strip():
            return "STANDARD"
        normalized = v.strip().upper()
        if normalized not in ["STANDARD", "CREDIT"]:
            raise ValueError("Loại ví chỉ chấp nhận 'STANDARD' hoặc 'CREDIT'.")
        return normalized

    @field_validator("balance", mode="before")
    @classmethod
    def validate_balance(cls, v) -> Decimal:
        if v is None:
            return Decimal("0.00")
        val = Decimal(str(v))
        if val < 0:
            raise ValueError("Số dư ban đầu không được âm.")
        return val


class UpdateWalletRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Tên ví mới")
    currency: Optional[str] = Field(None, max_length=10, description="Đơn vị tiền tệ mới")
    is_excluded_from_total: Optional[bool] = Field(None, description="Không tính vào tổng tài sản")
    is_archived: Optional[bool] = Field(None, description="Trạng thái lưu trữ (ẩn)")
    wallet_type: Optional[str] = Field(None, description="Loại ví: 'STANDARD' hoặc 'CREDIT'")
    credit_limit: Optional[Decimal] = Field(None, ge=0, description="Hạn mức thẻ tín dụng")
    statement_day: Optional[int] = Field(None, ge=1, le=31, description="Ngày sao kê (1-31)")
    payment_due_day: Optional[int] = Field(None, ge=1, le=31, description="Ngày đến hạn thanh toán (1-31)")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("Tên ví không được để trống.")
            return trimmed
        return v

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip().upper()
            if not trimmed:
                return "VND"
            return trimmed
        return v

    @field_validator("wallet_type")
    @classmethod
    def validate_wallet_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            normalized = v.strip().upper()
            if normalized not in ["STANDARD", "CREDIT"]:
                raise ValueError("Loại ví chỉ chấp nhận 'STANDARD' hoặc 'CREDIT'.")
            return normalized
        return v


class WalletResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    balance: float
    currency: str = "VND"
    is_excluded_from_total: bool = False
    is_archived: bool = False
    is_shared: bool = False
    is_owner: bool = True
    my_role: str = "OWNER"
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    members_count: int = 0
    wallet_type: str = "STANDARD"
    credit_limit: Optional[float] = None
    statement_day: Optional[int] = None
    payment_due_day: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class WalletMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    wallet_id: int
    user_id: Optional[int] = None
    email: str
    name: Optional[str] = None
    role: str  # 'VIEWER' | 'EDITOR'
    status: str  # 'ACCEPTED' | 'PENDING'
    created_at: datetime


class InviteMemberRequest(BaseModel):
    email: str = Field(..., description="Email người thân muốn mời vào ví chung")
    role: str = Field(default="VIEWER", description="Quyền hạn: 'VIEWER' (chỉ xem) hoặc 'EDITOR' (xem & ghi giao dịch)")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        trimmed = v.strip().lower()
        if not trimmed or "@" not in trimmed:
            raise ValueError("Email không hợp lệ.")
        return trimmed

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        normalized = v.strip().upper()
        if normalized not in ["VIEWER", "EDITOR"]:
            raise ValueError("Quyền hạn chỉ có thể là 'VIEWER' hoặc 'EDITOR'.")
        return normalized


class UpdateMemberRoleRequest(BaseModel):
    role: str = Field(..., description="Quyền hạn mới: 'VIEWER' hoặc 'EDITOR'")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        normalized = v.strip().upper()
        if normalized not in ["VIEWER", "EDITOR"]:
            raise ValueError("Quyền hạn chỉ có thể là 'VIEWER' hoặc 'EDITOR'.")
        return normalized


class TransferRequest(BaseModel):
    from_wallet_id: int = Field(..., description="ID ví nguồn (chuyển đi)")
    to_wallet_id: int = Field(..., description="ID ví đích (nhận về)")
    amount: Decimal = Field(..., gt=0, description="Số tiền chuyển (> 0)")
    transfer_date: Optional[date] = Field(default=None, description="Ngày chuyển tiền (mặc định hôm nay)")
    description: Optional[str] = Field(default=None, max_length=255, description="Ghi chú chuyển tiền")
    fee: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0, description="Phí chuyển khoản (nếu có)")
    to_amount: Optional[Decimal] = Field(default=None, gt=0, description="Số tiền nhận thực tế (nếu khác tiền tệ)")


class TransferResponse(BaseModel):
    message: str
    from_wallet: WalletResponse
    to_wallet: WalletResponse
    amount: float
    received_amount: float
    fee: float
    transfer_date: date
    description: Optional[str] = None


class AdjustBalanceRequest(BaseModel):
    wallet_id: int = Field(..., description="ID ví cần điều chỉnh")
    target_balance: Decimal = Field(..., description="Số dư thực tế mới sau kiểm kê")
    adjustment_date: Optional[date] = Field(default=None, description="Ngày điều chỉnh")
    description: Optional[str] = Field(default=None, max_length=255, description="Lý do điều chỉnh số dư")


class AdjustBalanceResponse(BaseModel):
    message: str
    wallet: WalletResponse
    previous_balance: float
    new_balance: float
    difference: float
    adjustment_date: date

