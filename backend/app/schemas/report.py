from datetime import date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class ReportSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    from_date: date
    to_date: date
    total_income: float
    total_expense: float
    balance: float
    net_balance: float
    savings_rate: float
    transaction_count: int


class CategoryExpenseItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category_id: int
    category_name: str
    category_icon: Optional[str] = None
    icon: Optional[str] = None
    total_expense: float
    percentage: float
    transaction_count: int


class CategoryReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    from_date: date
    to_date: date
    total_expense: float
    categories: List[CategoryExpenseItem]


class BudgetReportItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    budget_id: int
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    budget_amount: float
    spent_amount: float
    remaining_amount: float
    usage_percent: float
    start_date: date
    end_date: date


class BudgetReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    from_date: date
    to_date: date
    budgets: List[BudgetReportItem]
