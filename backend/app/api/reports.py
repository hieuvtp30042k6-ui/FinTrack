from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.report import (
    ReportSummaryResponse,
    CategoryReportResponse,
    BudgetReportResponse,
)
from app.services.report_service import report_service

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get(
    "/summary",
    response_model=ReportSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Báo cáo tổng hợp thu chi và số dư",
)
def get_summary_report(
    from_date: Optional[date] = Query(None, description="Ngày bắt đầu (YYYY-MM-DD) – tính theo transaction_date"),
    to_date: Optional[date] = Query(None, description="Ngày kết thúc (YYYY-MM-DD) – tính theo transaction_date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Thống kê tài chính tổng quan của người dùng hiện tại:
    - Tổng thu (chỉ tính INCOME).
    - Tổng chi (chỉ tính EXPENSE).
    - Số dư (balance = tổng thu - tổng chi).
    - Tỷ lệ tiết kiệm và số lượng giao dịch.
    - User xác định từ JWT Token, không nhận user_id từ Frontend.
    """
    return report_service.get_summary(
        db=db,
        user=current_user,
        from_date=from_date,
        to_date=to_date,
    )


@router.get(
    "/categories",
    response_model=CategoryReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Báo cáo phân bổ chi tiêu theo danh mục",
)
def get_categories_report(
    from_date: Optional[date] = Query(None, description="Ngày bắt đầu (YYYY-MM-DD) – tính theo transaction_date"),
    to_date: Optional[date] = Query(None, description="Ngày kết thúc (YYYY-MM-DD) – tính theo transaction_date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Thống kê chi tiêu phân bổ theo từng danh mục:
    - Chỉ tính các giao dịch loại EXPENSE của người dùng hiện tại.
    - Sắp xếp giảm dần theo tổng số tiền chi tiêu.
    - Tính tỷ lệ phần trăm cho từng danh mục so với tổng chi.
    - User xác định từ JWT Token, không nhận user_id từ Frontend.
    """
    return report_service.get_categories_report(
        db=db,
        user=current_user,
        from_date=from_date,
        to_date=to_date,
    )


@router.get(
    "/budgets",
    response_model=BudgetReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Báo cáo tình hình thực hiện ngân sách",
)
def get_budgets_report(
    from_date: Optional[date] = Query(None, description="Ngày bắt đầu (YYYY-MM-DD) – tính theo transaction_date"),
    to_date: Optional[date] = Query(None, description="Ngày kết thúc (YYYY-MM-DD) – tính theo transaction_date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Báo cáo đối chiếu ngân sách của người dùng:
    - Lấy các ngân sách giao thoa với khoảng thời gian.
    - Đối chiếu hạn mức (amount), đã chi (spent_amount), còn lại (remaining_amount) và tỷ lệ sử dụng (usage_percent).
    - User xác định từ JWT Token, không nhận user_id từ Frontend.
    """
    return report_service.get_budgets_report(
        db=db,
        user=current_user,
        from_date=from_date,
        to_date=to_date,
    )
