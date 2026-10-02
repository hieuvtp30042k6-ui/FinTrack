from datetime import date, datetime
from decimal import Decimal
import calendar
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


class CreateBudgetRequest(BaseModel):
    category_id: Optional[int] = Field(None, description="ID danh mục (nếu để trống, áp dụng cho tổng ngân sách)")
    amount: Optional[Decimal] = Field(None, gt=0, description="Hạn mức ngân sách (phải > 0)")
    limit: Optional[Decimal] = Field(None, gt=0, description="Alias của amount cho frontend")
    start_date: Optional[date] = Field(None, description="Ngày bắt đầu (YYYY-MM-DD)")
    end_date: Optional[date] = Field(None, description="Ngày kết thúc (YYYY-MM-DD)")
    month: Optional[int] = Field(None, ge=1, le=12, description="Tháng áp dụng (1-12)")
    year: Optional[int] = Field(None, ge=2000, le=2100, description="Năm áp dụng (ví dụ 2026)")

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def parse_date(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            try:
                return date.fromisoformat(v.strip())
            except ValueError:
                raise ValueError("Định dạng ngày không hợp lệ. Vui lòng dùng YYYY-MM-DD.")
        return v

    @model_validator(mode="after")
    def resolve_amount_and_period(self):
        # 1. Resolve amount / limit
        resolved_amount = self.amount or self.limit
        if resolved_amount is None:
            raise ValueError("Hạn mức ngân sách (amount hoặc limit) là bắt buộc và phải lớn hơn 0.")
        if resolved_amount <= Decimal("0"):
            raise ValueError("Hạn mức ngân sách phải lớn hơn 0.")
        self.amount = resolved_amount
        self.limit = resolved_amount

        # 2. Resolve start_date and end_date
        today = date.today()
        if self.start_date and self.end_date:
            if self.start_date > self.end_date:
                raise ValueError("Ngày bắt đầu không được lớn hơn ngày kết thúc.")
        elif self.month and self.year:
            _, last_day = calendar.monthrange(self.year, self.month)
            self.start_date = date(self.year, self.month, 1)
            self.end_date = date(self.year, self.month, last_day)
        elif self.start_date and not self.end_date:
            _, last_day = calendar.monthrange(self.start_date.year, self.start_date.month)
            self.end_date = date(self.start_date.year, self.start_date.month, last_day)
        elif not self.start_date and self.end_date:
            self.start_date = date(self.end_date.year, self.end_date.month, 1)
        else:
            # Default to current month
            _, last_day = calendar.monthrange(today.year, today.month)
            self.start_date = date(today.year, today.month, 1)
            self.end_date = date(today.year, today.month, last_day)

        return self


class UpdateBudgetRequest(BaseModel):
    category_id: Optional[int] = Field(None, description="ID danh mục mới")
    amount: Optional[Decimal] = Field(None, gt=0, description="Hạn mức ngân sách mới")
    limit: Optional[Decimal] = Field(None, gt=0, description="Alias của amount cho frontend")
    start_date: Optional[date] = Field(None, description="Ngày bắt đầu mới (YYYY-MM-DD)")
    end_date: Optional[date] = Field(None, description="Ngày kết thúc mới (YYYY-MM-DD)")

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def parse_date(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            try:
                return date.fromisoformat(v.strip())
            except ValueError:
                raise ValueError("Định dạng ngày không hợp lệ. Vui lòng dùng YYYY-MM-DD.")
        return v

    @model_validator(mode="after")
    def resolve_amount_and_dates(self):
        resolved_amount = self.amount or self.limit
        if resolved_amount is not None:
            if resolved_amount <= Decimal("0"):
                raise ValueError("Hạn mức ngân sách phải lớn hơn 0.")
            self.amount = resolved_amount
            self.limit = resolved_amount

        if self.start_date and self.end_date:
            if self.start_date > self.end_date:
                raise ValueError("Ngày bắt đầu không được lớn hơn ngày kết thúc.")
        return self


class BudgetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    category: Optional[str] = None
    category_icon: Optional[str] = None
    icon: Optional[str] = None
    amount: float
    limit: float
    spent: float = 0.0
    remaining: float = 0.0
    percentage: float = 0.0
    status: str = "normal"  # 'normal' | 'warning' | 'exceeded'
    start_date: date
    end_date: date
    created_at: datetime
    updated_at: datetime
