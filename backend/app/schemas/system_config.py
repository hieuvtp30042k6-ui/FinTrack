from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict


class GeneralConfig(BaseModel):
    app_name: str = Field(default="FinTrack", min_length=1, max_length=100)
    tagline: str = Field(default="Quản lý tài chính thông minh", max_length=200)
    default_language: str = Field(default="vi")
    timezone: str = Field(default="Asia/Ho_Chi_Minh")
    date_format: str = Field(default="DD/MM/YYYY")
    currency: str = Field(default="VND")
    max_wallets: str = Field(default="10")
    max_categories: str = Field(default="50")
    max_file_size_mb: str = Field(default="5")

    @field_validator("max_wallets", "max_categories", "max_file_size_mb")
    @classmethod
    def validate_positive_number(cls, v: str) -> str:
        try:
            num = int(v)
            if num < 1:
                raise ValueError("Giá trị phải lớn hơn hoặc bằng 1")
            return str(num)
        except (ValueError, TypeError):
            raise ValueError("Hạn mức phải là số nguyên dương hợp lệ")


class SmtpConfig(BaseModel):
    host: str = Field(default="smtp.gmail.com")
    port: str = Field(default="587")
    username: str = Field(default="")
    password: str = Field(default="")
    from_email: str = Field(default="no-reply@fintrack.app")
    from_name: str = Field(default="FinTrack")
    use_tls: bool = Field(default=True)


class FeatureFlag(BaseModel):
    id: str
    label: str
    description: str
    enabled: bool
    group: str


class ApiIntegration(BaseModel):
    id: str
    name: str
    provider: str
    key: str
    status: str
    last_check: str


class SystemConfigResponse(BaseModel):
    general: GeneralConfig
    smtp: SmtpConfig
    flags: List[FeatureFlag]
    apis: List[ApiIntegration]

    model_config = ConfigDict(from_attributes=True)


class SystemConfigUpdate(BaseModel):
    general: GeneralConfig
    smtp: SmtpConfig
    flags: List[FeatureFlag]
    apis: Optional[List[ApiIntegration]] = None


class TestEmailRequest(BaseModel):
    smtp: SmtpConfig
    recipient_email: Optional[str] = None
