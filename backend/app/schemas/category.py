from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict


class CreateCategoryRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Tên danh mục (ví dụ: Ăn uống, Lương...)")
    type: str = Field(..., description="Loại danh mục: 'INCOME'/'income' hoặc 'EXPENSE'/'expense'")
    icon: Optional[str] = Field(None, max_length=50, description="Tên biểu tượng (Material Symbol)")
    description: Optional[str] = Field(None, max_length=255, description="Mô tả phụ cho danh mục")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Tên danh mục không được để trống.")
        return trimmed

    @field_validator("type")
    @classmethod
    def normalize_and_validate_type(cls, v: str) -> str:
        normalized = v.strip().upper()
        if normalized not in ["INCOME", "EXPENSE"]:
            raise ValueError("Loại danh mục chỉ chấp nhận 'income' hoặc 'expense'.")
        return normalized


class UpdateCategoryRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Tên danh mục mới")
    type: Optional[str] = Field(None, description="Loại danh mục mới ('INCOME' hoặc 'EXPENSE')")
    icon: Optional[str] = Field(None, max_length=50, description="Tên biểu tượng mới")
    description: Optional[str] = Field(None, max_length=255, description="Mô tả phụ mới")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("Tên danh mục không được để trống.")
            return trimmed
        return v

    @field_validator("type")
    @classmethod
    def normalize_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            normalized = v.strip().upper()
            if normalized not in ["INCOME", "EXPENSE"]:
                raise ValueError("Loại danh mục chỉ chấp nhận 'income' hoặc 'expense'.")
            return normalized
        return v


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    name: str
    type: str
    icon: Optional[str] = None
    description: Optional[str] = None
    is_system: bool = False
    created_at: datetime
    updated_at: datetime
