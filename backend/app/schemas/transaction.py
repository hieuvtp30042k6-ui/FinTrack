from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict


class CreateTransactionRequest(BaseModel):
    wallet_id: int = Field(..., description="ID ví giao dịch")
    category_id: int = Field(..., description="ID danh mục giao dịch")
    type: str = Field(..., description="Loại giao dịch: 'income' hoặc 'expense'")
    amount: Decimal = Field(..., gt=0, description="Số tiền giao dịch, bắt buộc phải lớn hơn 0")
    description: Optional[str] = Field(None, max_length=255, description="Ghi chú / mô tả giao dịch")
    transaction_date: date = Field(..., description="Ngày giao dịch thực tế (YYYY-MM-DD), bắt buộc")

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v: str) -> str:
        if isinstance(v, str):
            normalized = v.strip().upper()
            if normalized not in ["INCOME", "EXPENSE"]:
                raise ValueError("Loại giao dịch chỉ chấp nhận 'income' hoặc 'expense'.")
            return normalized
        return v

    @field_validator("transaction_date", mode="before")
    @classmethod
    def validate_transaction_date(cls, v) -> date:
        if v is None:
            raise ValueError("Ngày giao dịch (transaction_date) là bắt buộc.")
        if isinstance(v, date):
            return v
        # Hỗ trợ chuỗi ISO 8601: "YYYY-MM-DD"
        try:
            if isinstance(v, str):
                parsed = date.fromisoformat(v.strip())
                return parsed
        except (ValueError, AttributeError):
            pass
        raise ValueError("Ngày giao dịch không hợp lệ. Định dạng hợp lệ: YYYY-MM-DD (ví dụ: 2026-09-30).")


class UpdateTransactionRequest(BaseModel):
    wallet_id: Optional[int] = Field(None, description="ID ví mới")
    category_id: Optional[int] = Field(None, description="ID danh mục mới")
    type: Optional[str] = Field(None, description="Loại giao dịch mới: 'income' hoặc 'expense'")
    amount: Optional[Decimal] = Field(None, gt=0, description="Số tiền mới, phải lớn hơn 0")
    description: Optional[str] = Field(None, max_length=255, description="Ghi chú mới")
    transaction_date: Optional[date] = Field(None, description="Ngày giao dịch mới (YYYY-MM-DD)")

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v) -> Optional[str]:
        if v is None:
            return v
        if isinstance(v, str):
            normalized = v.strip().upper()
            if normalized not in ["INCOME", "EXPENSE"]:
                raise ValueError("Loại giao dịch chỉ chấp nhận 'income' hoặc 'expense'.")
            return normalized
        return v

    @field_validator("transaction_date", mode="before")
    @classmethod
    def validate_transaction_date(cls, v) -> Optional[date]:
        if v is None:
            return v
        if isinstance(v, date):
            return v
        try:
            if isinstance(v, str):
                return date.fromisoformat(v.strip())
        except (ValueError, AttributeError):
            pass
        raise ValueError("Ngày giao dịch không hợp lệ. Định dạng hợp lệ: YYYY-MM-DD (ví dụ: 2026-09-30).")


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    wallet_id: int
    category_id: Optional[int] = None
    type: str
    amount: float
    description: Optional[str] = None
    transaction_date: date
    created_at: datetime
    updated_at: datetime
    category_name: Optional[str] = None
    wallet_name: Optional[str] = None
    wallet_balance: Optional[float] = None

    @field_validator("transaction_date", mode="before")
    @classmethod
    def convert_transaction_date(cls, v) -> Optional[date]:
        if v is None:
            return None
        if hasattr(v, "date"):
            return v.date()
        if isinstance(v, str):
            return date.fromisoformat(v[:10])
        return v
