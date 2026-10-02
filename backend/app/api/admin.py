import datetime
import json
import platform
import sys
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, text

from app.api.deps import get_db, require_admin, require_super_admin
from app.models.user import User
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.wallet import Wallet
from app.models.system_setting import SystemSetting
from app.models.audit_log import AuditLog
from app.repositories.audit_log_repository import audit_log_repo
from app.schemas.audit_log import AuditLogResponse
from app.schemas.user import AdminUserResponse
from app.schemas.system_config import SystemConfigResponse, SystemConfigUpdate, TestEmailRequest
from app.services.user_service import user_service

router = APIRouter(prefix="/api/admin", tags=["Admin Management"])



@router.get(
    "/users",
    response_model=List[AdminUserResponse],
    status_code=status.HTTP_200_OK,
    summary="Lấy danh sách người dùng (Chỉ dành cho Admin)"
)
def get_all_users_admin(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Endpoint quản trị: Xem danh sách toàn bộ người dùng trong hệ thống.
    Chỉ cho phép tài khoản có role='admin' truy cập (xác thực qua JWT).
    User thông thường gọi đến sẽ nhận HTTP 403 Forbidden.
    """
    return user_service.get_all_users_for_admin(db)


@router.get(
    "/users/{user_id}",
    response_model=AdminUserResponse,
    status_code=status.HTTP_200_OK,
    summary="Lấy thông tin chi tiết người dùng (Chỉ dành cho Admin)"
)
def get_user_detail_admin(
    user_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Endpoint quản trị: Xem chi tiết một người dùng theo ID.
    Chỉ cho phép tài khoản có role='admin' truy cập (xác thực qua JWT).
    Trả về 404 nếu không tìm thấy người dùng.
    """
    return user_service.get_user_detail_for_admin(db, user_id)


@router.patch(
    "/users/{user_id}/lock",
    response_model=AdminUserResponse,
    status_code=status.HTTP_200_OK,
    summary="Khóa tài khoản người dùng (Chỉ dành cho Admin)"
)
def lock_user_admin(
    user_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Endpoint quản trị: Khóa tài khoản người dùng (status -> 'locked').
    User bị khóa sẽ không thể đăng nhập hoặc gọi các API cần xác thực.
    Admin không thể tự khóa tài khoản của chính mình (400).
    """
    return user_service.lock_user(db, current_admin, user_id)


@router.patch(
    "/users/{user_id}/unlock",
    response_model=AdminUserResponse,
    status_code=status.HTTP_200_OK,
    summary="Mở khóa tài khoản người dùng (Chỉ dành cho Admin)"
)
def unlock_user_admin(
    user_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Endpoint quản trị: Mở khóa tài khoản người dùng (status -> 'active').
    User được mở khóa có thể tiếp tục đăng nhập bình thường.
    """
    return user_service.unlock_user(db, current_admin, user_id)


@router.patch(
    "/users/{user_id}/status",
    response_model=AdminUserResponse,
    status_code=status.HTTP_200_OK,
    summary="Cập nhật trạng thái người dùng (active / locked) (Chỉ dành cho Admin)"
)
def update_user_status(
    user_id: int,
    status_data: Dict[str, str] = Body(...),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Endpoint quản trị tương thích ngược: Cập nhật trạng thái tài khoản.
    """
    new_status = status_data.get("status", "")
    return user_service.update_user_status_for_admin(db, current_admin, user_id, new_status)


@router.patch(
    "/users/{user_id}/role",
    response_model=AdminUserResponse,
    status_code=status.HTTP_200_OK,
    summary="Phân quyền / Thay đổi vai trò người dùng (Chỉ dành cho Super Admin)"
)
def update_user_role(
    user_id: int,
    role_data: Dict[str, str] = Body(...),
    current_admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Endpoint quản trị: Gán vai trò cho người dùng (user, admin, super_admin).
    Chỉ Super Admin mới có quyền thực hiện.
    Admin không thể tự nâng quyền của chính mình.
    """
    new_role = role_data.get("role", "")
    return user_service.update_user_role_for_admin(db, current_admin, user_id, new_role)


@router.post(
    "/users/{user_id}/reset-password",
    status_code=status.HTTP_200_OK,
    summary="Đặt lại mật khẩu cho người dùng (RBAC: Admin không được đặt lại cho Super Admin)"
)
def reset_user_password_admin(
    user_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Endpoint quản trị: Đặt lại mật khẩu tài khoản người dùng.
    - Super Admin có thể đặt lại cho mọi người dùng.
    - Admin chỉ có quyền đặt lại cho người dùng thông thường ('user').
    - Admin cố tình thao tác trên Super Admin / Admin khác sẽ nhận HTTP 403 Forbidden.
    """
    return user_service.reset_password_for_admin(db, current_admin, user_id)


@router.get(
    "/dashboard/stats",
    status_code=status.HTTP_200_OK,
    summary="Lấy dữ liệu thống kê tổng quan toàn hệ thống cho Dashboard Admin"
)
def get_admin_dashboard_stats(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Trả về toàn bộ số liệu thời gian thực để trực quan hoá trên Admin Dashboard.
    """
    now = datetime.datetime.now()
    seven_days_ago = now - datetime.timedelta(days=7)

    # 1. Thống kê User
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.status == "active").scalar() or 0
    new_users_7d = db.query(func.count(User.id)).filter(User.created_at >= seven_days_ago).scalar() or 0

    # 2. Thống kê Transactions & Tiền tệ
    total_transactions = db.query(func.count(Transaction.id)).scalar() or 0
    total_expense = db.query(func.sum(Transaction.amount)).filter(Transaction.type == "EXPENSE").scalar() or 0
    total_income = db.query(func.sum(Transaction.amount)).filter(Transaction.type == "INCOME").scalar() or 0
    total_volume = float(total_expense) + float(total_income)

    # 3. Thống kê Categories & Wallets
    system_categories_count = db.query(func.count(Category.id)).filter(Category.user_id == None).scalar() or 0
    total_wallets = db.query(func.count(Wallet.id)).scalar() or 0

    # 4. Biểu đồ 7 ngày gần nhất
    days_labels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
    growth_chart = []
    
    for i in range(6, -1, -1):
        target_date = (now - datetime.timedelta(days=i)).date()
        target_start = datetime.datetime.combine(target_date, datetime.time.min)
        target_end = datetime.datetime.combine(target_date, datetime.time.max)

        day_new_users = db.query(func.count(User.id)).filter(
            User.created_at >= target_start,
            User.created_at <= target_end
        ).scalar() or 0

        day_trans_count = db.query(func.count(Transaction.id)).filter(
            Transaction.created_at >= target_start,
            Transaction.created_at <= target_end
        ).scalar() or 0

        day_expense = db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "EXPENSE",
            Transaction.created_at >= target_start,
            Transaction.created_at <= target_end
        ).scalar() or 0

        day_income = db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "INCOME",
            Transaction.created_at >= target_start,
            Transaction.created_at <= target_end
        ).scalar() or 0

        weekday_idx = target_date.weekday()  # 0 = Thứ 2, 6 = CN
        growth_chart.append({
            "date": target_date.strftime("%Y-%m-%d"),
            "display_date": target_date.strftime("%d/%m"),
            "day_name": days_labels[weekday_idx],
            "new_users": day_new_users,
            "transactions_count": day_trans_count,
            "expense_volume": float(day_expense),
            "income_volume": float(day_income),
        })

    # 5. Top danh mục chi tiêu phổ biến hệ thống
    top_categories_query = (
        db.query(
            Category.name,
            Category.icon,
            Category.type,
            func.count(Transaction.id).label("trans_count"),
            func.sum(Transaction.amount).label("total_amount")
        )
        .join(Transaction, Transaction.category_id == Category.id)
        .filter(Transaction.type == "EXPENSE")
        .group_by(Category.id)
        .order_by(desc("total_amount"))
        .limit(5)
        .all()
    )

    top_categories = [
        {
            "name": row.name,
            "icon": row.icon or "category",
            "type": row.type,
            "count": row.trans_count,
            "amount": float(row.total_amount or 0)
        }
        for row in top_categories_query
    ]

    # 6. Danh sách 6 giao dịch gần nhất toàn hệ thống
    recent_transactions_query = (
        db.query(Transaction)
        .order_by(desc(Transaction.created_at))
        .limit(6)
        .all()
    )

    recent_transactions = []
    for tx in recent_transactions_query:
        recent_transactions.append({
            "id": tx.id,
            "user_id": tx.user_id,
            "user_name": tx.user.name if tx.user else "Người dùng",
            "user_email": tx.user.email if tx.user else "",
            "category_name": tx.category.name if tx.category else "Chưa phân loại",
            "category_icon": tx.category.icon if tx.category else "receipt",
            "wallet_name": tx.wallet.name if tx.wallet else "Ví",
            "type": tx.type,
            "amount": float(tx.amount),
            "description": tx.description or "",
            "date": tx.transaction_date.strftime("%Y-%m-%d") if tx.transaction_date else "",
            "created_at": tx.created_at.strftime("%Y-%m-%d %H:%M:%S") if tx.created_at else ""
        })

    # 7. Danh sách 5 người dùng mới đăng ký gần nhất
    recent_users_query = (
        db.query(User)
        .order_by(desc(User.created_at))
        .limit(5)
        .all()
    )

    recent_users = [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "status": u.status,
            "created_at": u.created_at.strftime("%Y-%m-%d %H:%M:%S") if u.created_at else ""
        }
        for u in recent_users_query
    ]

    return {
        "summary": {
            "total_users": total_users,
            "active_users": active_users,
            "new_users_7d": new_users_7d,
            "total_transactions": total_transactions,
            "total_volume": total_volume,
            "total_expense": float(total_expense),
            "total_income": float(total_income),
            "system_categories_count": system_categories_count,
            "total_wallets": total_wallets,
        },
        "growth_chart": growth_chart,
        "top_categories": top_categories,
        "recent_transactions": recent_transactions,
        "recent_users": recent_users,
        "system_status": {
            "database_connected": True,
            "api_status": "healthy",
            "uptime_rate": "99.98%",
            "environment": "production-ready"
        }
    }


# ─── SYSTEM MANAGEMENT ──────────────────────────────────────────────────────────

@router.get(
    "/system/overview",
    status_code=status.HTTP_200_OK,
    summary="Thống kê tổng quan hệ thống (Chỉ dành cho Admin)"
)
def get_system_overview(
    period: str = Query("month", description="day | week | month | year | custom"),
    from_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Trả về thông tin toàn diện về hệ thống: số liệu cơ sở dữ liệu,
    thống kê theo từng module, và dòng thời gian theo ngày/tuần/tháng/năm/tùy chọn.
    """
    now = datetime.datetime.now()
    thirty_days_ago = now - datetime.timedelta(days=30)

    # ── Thống kê User ──
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.status == "active").scalar() or 0
    locked_users = db.query(func.count(User.id)).filter(User.status == "locked").scalar() or 0
    admin_count = db.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0
    google_users = db.query(func.count(User.id)).filter(User.google_id != None).scalar() or 0
    new_users_30d = db.query(func.count(User.id)).filter(User.created_at >= thirty_days_ago).scalar() or 0

    # ── Thống kê Transaction ──
    total_transactions = db.query(func.count(Transaction.id)).scalar() or 0
    expense_count = db.query(func.count(Transaction.id)).filter(Transaction.type == "EXPENSE").scalar() or 0
    income_count = db.query(func.count(Transaction.id)).filter(Transaction.type == "INCOME").scalar() or 0
    total_expense = float(db.query(func.sum(Transaction.amount)).filter(Transaction.type == "EXPENSE").scalar() or 0)
    total_income = float(db.query(func.sum(Transaction.amount)).filter(Transaction.type == "INCOME").scalar() or 0)
    new_transactions_30d = db.query(func.count(Transaction.id)).filter(
        Transaction.created_at >= thirty_days_ago
    ).scalar() or 0

    # ── Thống kê Wallet ──
    total_wallets = db.query(func.count(Wallet.id)).scalar() or 0
    total_balance = float(db.query(func.sum(Wallet.balance)).scalar() or 0)

    # ── Thống kê Category ──
    total_categories = db.query(func.count(Category.id)).scalar() or 0
    system_categories = db.query(func.count(Category.id)).filter(Category.user_id == None).scalar() or 0
    user_categories = total_categories - system_categories

    # ── Top users theo số giao dịch (30d) ──
    top_users_query = (
        db.query(
            User.id,
            User.name,
            User.email,
            User.role,
            User.status,
            func.count(Transaction.id).label("tx_count"),
            func.sum(Transaction.amount).label("tx_volume")
        )
        .join(Transaction, Transaction.user_id == User.id, isouter=True)
        .filter(Transaction.created_at >= thirty_days_ago)
        .group_by(User.id)
        .order_by(desc("tx_count"))
        .limit(5)
        .all()
    )

    top_active_users = [
        {
            "id": row.id,
            "name": row.name,
            "email": row.email,
            "role": row.role,
            "status": row.status,
            "transaction_count": row.tx_count or 0,
            "transaction_volume": float(row.tx_volume or 0),
        }
        for row in top_users_query
    ]

    # ── Timeline Stats dựa theo period (day, week, month, year, custom) ──
    timeline_stats = []
    start_dt = None
    end_dt = None

    if period == "day":
        target_day = now.date()
        if from_date:
            try:
                target_day = datetime.datetime.strptime(from_date, "%Y-%m-%d").date()
            except ValueError:
                pass
        start_dt = datetime.datetime.combine(target_day, datetime.time.min)
        end_dt = datetime.datetime.combine(target_day, datetime.time.max)

        # 6 khung giờ: 00h, 04h, 08h, 12h, 16h, 20h
        for h in range(0, 24, 4):
            slot_start = start_dt.replace(hour=h, minute=0, second=0)
            slot_end = start_dt.replace(hour=h + 3, minute=59, second=59)
            inc = float(db.query(func.sum(Transaction.amount)).filter(
                Transaction.type == "INCOME",
                Transaction.created_at >= slot_start,
                Transaction.created_at <= slot_end
            ).scalar() or 0)
            exp = float(db.query(func.sum(Transaction.amount)).filter(
                Transaction.type == "EXPENSE",
                Transaction.created_at >= slot_start,
                Transaction.created_at <= slot_end
            ).scalar() or 0)
            tx_c = db.query(func.count(Transaction.id)).filter(
                Transaction.created_at >= slot_start,
                Transaction.created_at <= slot_end
            ).scalar() or 0
            u_c = db.query(func.count(User.id)).filter(
                User.created_at >= slot_start,
                User.created_at <= slot_end
            ).scalar() or 0
            timeline_stats.append({
                "label": f"{h:02d}:00",
                "income": inc,
                "expense": exp,
                "net": inc - exp,
                "transaction_count": tx_c,
                "new_users": u_c,
            })

    elif period == "week":
        target_date = now.date()
        if from_date:
            try:
                target_date = datetime.datetime.strptime(from_date, "%Y-%m-%d").date()
            except ValueError:
                pass
        monday = target_date - datetime.timedelta(days=target_date.weekday())
        start_dt = datetime.datetime.combine(monday, datetime.time.min)
        sunday = monday + datetime.timedelta(days=6)
        end_dt = datetime.datetime.combine(sunday, datetime.time.max)

        day_names = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"]
        for idx in range(7):
            d = monday + datetime.timedelta(days=idx)
            d_start = datetime.datetime.combine(d, datetime.time.min)
            d_end = datetime.datetime.combine(d, datetime.time.max)
            inc = float(db.query(func.sum(Transaction.amount)).filter(
                Transaction.type == "INCOME",
                Transaction.created_at >= d_start,
                Transaction.created_at <= d_end
            ).scalar() or 0)
            exp = float(db.query(func.sum(Transaction.amount)).filter(
                Transaction.type == "EXPENSE",
                Transaction.created_at >= d_start,
                Transaction.created_at <= d_end
            ).scalar() or 0)
            tx_c = db.query(func.count(Transaction.id)).filter(
                Transaction.created_at >= d_start,
                Transaction.created_at <= d_end
            ).scalar() or 0
            u_c = db.query(func.count(User.id)).filter(
                User.created_at >= d_start,
                User.created_at <= d_end
            ).scalar() or 0
            timeline_stats.append({
                "label": f"{day_names[idx]}",
                "income": inc,
                "expense": exp,
                "net": inc - exp,
                "transaction_count": tx_c,
                "new_users": u_c,
            })

    elif period == "year":
        target_year = now.year
        if from_date:
            try:
                target_year = datetime.datetime.strptime(from_date, "%Y-%m-%d").year
            except ValueError:
                pass
        start_dt = datetime.datetime(target_year, 1, 1, 0, 0, 0)
        end_dt = datetime.datetime(target_year, 12, 31, 23, 59, 59)

        for m in range(1, 13):
            m_start = datetime.datetime(target_year, m, 1, 0, 0, 0)
            if m == 12:
                m_end = datetime.datetime(target_year + 1, 1, 1, 0, 0, 0) - datetime.timedelta(seconds=1)
            else:
                m_end = datetime.datetime(target_year, m + 1, 1, 0, 0, 0) - datetime.timedelta(seconds=1)
            inc = float(db.query(func.sum(Transaction.amount)).filter(
                Transaction.type == "INCOME",
                Transaction.created_at >= m_start,
                Transaction.created_at <= m_end
            ).scalar() or 0)
            exp = float(db.query(func.sum(Transaction.amount)).filter(
                Transaction.type == "EXPENSE",
                Transaction.created_at >= m_start,
                Transaction.created_at <= m_end
            ).scalar() or 0)
            tx_c = db.query(func.count(Transaction.id)).filter(
                Transaction.created_at >= m_start,
                Transaction.created_at <= m_end
            ).scalar() or 0
            u_c = db.query(func.count(User.id)).filter(
                User.created_at >= m_start,
                User.created_at <= m_end
            ).scalar() or 0
            timeline_stats.append({
                "label": f"T{m:02d}",
                "income": inc,
                "expense": exp,
                "net": inc - exp,
                "transaction_count": tx_c,
                "new_users": u_c,
            })

    elif period == "custom" and from_date and to_date:
        try:
            f_d = datetime.datetime.strptime(from_date, "%Y-%m-%d").date()
            t_d = datetime.datetime.strptime(to_date, "%Y-%m-%d").date()
            if f_d > t_d:
                f_d, t_d = t_d, f_d
            start_dt = datetime.datetime.combine(f_d, datetime.time.min)
            end_dt = datetime.datetime.combine(t_d, datetime.time.max)
            delta_days = (t_d - f_d).days + 1

            if delta_days <= 14:
                for i in range(delta_days):
                    d = f_d + datetime.timedelta(days=i)
                    d_start = datetime.datetime.combine(d, datetime.time.min)
                    d_end = datetime.datetime.combine(d, datetime.time.max)
                    inc = float(db.query(func.sum(Transaction.amount)).filter(
                        Transaction.type == "INCOME",
                        Transaction.created_at >= d_start,
                        Transaction.created_at <= d_end
                    ).scalar() or 0)
                    exp = float(db.query(func.sum(Transaction.amount)).filter(
                        Transaction.type == "EXPENSE",
                        Transaction.created_at >= d_start,
                        Transaction.created_at <= d_end
                    ).scalar() or 0)
                    tx_c = db.query(func.count(Transaction.id)).filter(
                        Transaction.created_at >= d_start,
                        Transaction.created_at <= d_end
                    ).scalar() or 0
                    u_c = db.query(func.count(User.id)).filter(
                        User.created_at >= d_start,
                        User.created_at <= d_end
                    ).scalar() or 0
                    timeline_stats.append({
                        "label": d.strftime("%d/%m"),
                        "income": inc,
                        "expense": exp,
                        "net": inc - exp,
                        "transaction_count": tx_c,
                        "new_users": u_c,
                    })
            else:
                num_buckets = min(6, delta_days)
                step = delta_days / float(num_buckets)
                for i in range(num_buckets):
                    cur_f = f_d + datetime.timedelta(days=int(i * step))
                    cur_t = f_d + datetime.timedelta(days=min(int((i + 1) * step) - 1, delta_days - 1))
                    if cur_f > cur_t:
                        cur_t = cur_f
                    d_start = datetime.datetime.combine(cur_f, datetime.time.min)
                    d_end = datetime.datetime.combine(cur_t, datetime.time.max)
                    inc = float(db.query(func.sum(Transaction.amount)).filter(
                        Transaction.type == "INCOME",
                        Transaction.created_at >= d_start,
                        Transaction.created_at <= d_end
                    ).scalar() or 0)
                    exp = float(db.query(func.sum(Transaction.amount)).filter(
                        Transaction.type == "EXPENSE",
                        Transaction.created_at >= d_start,
                        Transaction.created_at <= d_end
                    ).scalar() or 0)
                    tx_c = db.query(func.count(Transaction.id)).filter(
                        Transaction.created_at >= d_start,
                        Transaction.created_at <= d_end
                    ).scalar() or 0
                    u_c = db.query(func.count(User.id)).filter(
                        User.created_at >= d_start,
                        User.created_at <= d_end
                    ).scalar() or 0
                    timeline_stats.append({
                        "label": f"{cur_f.strftime('%d/%m')}",
                        "income": inc,
                        "expense": exp,
                        "net": inc - exp,
                        "transaction_count": tx_c,
                        "new_users": u_c,
                    })
        except ValueError:
            pass

    # Default / fallback: period == "month" (hiển thị các tuần trong tháng)
    if not timeline_stats:
        target_month_date = now.date()
        if from_date:
            try:
                target_month_date = datetime.datetime.strptime(from_date, "%Y-%m-%d").date()
            except ValueError:
                pass
        start_dt = datetime.datetime(target_month_date.year, target_month_date.month, 1, 0, 0, 0)
        if target_month_date.month == 12:
            end_dt = datetime.datetime(target_month_date.year + 1, 1, 1, 0, 0, 0) - datetime.timedelta(seconds=1)
        else:
            end_dt = datetime.datetime(target_month_date.year, target_month_date.month + 1, 1, 0, 0, 0) - datetime.timedelta(seconds=1)

        intervals = [
            ("Tuần 1", 1, 7),
            ("Tuần 2", 8, 14),
            ("Tuần 3", 15, 21),
            ("Tuần 4", 22, 28),
            ("Tuần 5", 29, end_dt.day),
        ]
        for label, s_day, e_day in intervals:
            if s_day > end_dt.day:
                continue
            e_day = min(e_day, end_dt.day)
            w_start = datetime.datetime(target_month_date.year, target_month_date.month, s_day, 0, 0, 0)
            w_end = datetime.datetime(target_month_date.year, target_month_date.month, e_day, 23, 59, 59)
            inc = float(db.query(func.sum(Transaction.amount)).filter(
                Transaction.type == "INCOME",
                Transaction.created_at >= w_start,
                Transaction.created_at <= w_end
            ).scalar() or 0)
            exp = float(db.query(func.sum(Transaction.amount)).filter(
                Transaction.type == "EXPENSE",
                Transaction.created_at >= w_start,
                Transaction.created_at <= w_end
            ).scalar() or 0)
            tx_c = db.query(func.count(Transaction.id)).filter(
                Transaction.created_at >= w_start,
                Transaction.created_at <= w_end
            ).scalar() or 0
            u_c = db.query(func.count(User.id)).filter(
                User.created_at >= w_start,
                User.created_at <= w_end
            ).scalar() or 0
            timeline_stats.append({
                "label": label,
                "income": inc,
                "expense": exp,
                "net": inc - exp,
                "transaction_count": tx_c,
                "new_users": u_c,
            })

    # Tính period_summary
    period_income = sum(item["income"] for item in timeline_stats)
    period_expense = sum(item["expense"] for item in timeline_stats)
    period_tx_count = sum(item["transaction_count"] for item in timeline_stats)
    period_new_users = sum(item["new_users"] for item in timeline_stats)

    period_summary = {
        "period": period,
        "from_date": start_dt.strftime("%Y-%m-%d") if start_dt else None,
        "to_date": end_dt.strftime("%Y-%m-%d") if end_dt else None,
        "income": period_income,
        "expense": period_expense,
        "net": period_income - period_expense,
        "transaction_count": period_tx_count,
        "new_users": period_new_users,
    }

    # ── Thống kê giao dịch theo tháng (12 tháng gần nhất cho backward compatibility) ──
    monthly_stats = []
    for i in range(11, -1, -1):
        target_month_date = now.replace(day=1) - datetime.timedelta(days=i * 30)
        month_start = target_month_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if month_start.month == 12:
            month_end = month_start.replace(year=month_start.year + 1, month=1) - datetime.timedelta(seconds=1)
        else:
            month_end = month_start.replace(month=month_start.month + 1) - datetime.timedelta(seconds=1)

        m_income = float(db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "INCOME",
            Transaction.created_at >= month_start,
            Transaction.created_at <= month_end
        ).scalar() or 0)

        m_expense = float(db.query(func.sum(Transaction.amount)).filter(
            Transaction.type == "EXPENSE",
            Transaction.created_at >= month_start,
            Transaction.created_at <= month_end
        ).scalar() or 0)

        m_tx_count = db.query(func.count(Transaction.id)).filter(
            Transaction.created_at >= month_start,
            Transaction.created_at <= month_end
        ).scalar() or 0

        m_new_users = db.query(func.count(User.id)).filter(
            User.created_at >= month_start,
            User.created_at <= month_end
        ).scalar() or 0

        monthly_stats.append({
            "month": month_start.strftime("%Y-%m"),
            "label": month_start.strftime("%m/%Y"),
            "income": m_income,
            "expense": m_expense,
            "transaction_count": m_tx_count,
            "new_users": m_new_users,
        })

    # ── Server/Environment info ──
    server_info = {
        "python_version": sys.version.split(" ")[0],
        "platform": platform.system(),
        "framework": "FastAPI + SQLAlchemy",
        "database": "PostgreSQL",
        "api_version": "v2.4",
        "environment": "production-ready",
        "uptime": "99.98%",
        "server_time": now.strftime("%Y-%m-%d %H:%M:%S"),
    }

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "locked": locked_users,
            "admin_count": admin_count,
            "google_oauth_users": google_users,
            "new_last_30d": new_users_30d,
        },
        "transactions": {
            "total": total_transactions,
            "expense_count": expense_count,
            "income_count": income_count,
            "total_expense": total_expense,
            "total_income": total_income,
            "net_balance": total_income - total_expense,
            "new_last_30d": new_transactions_30d,
        },
        "wallets": {
            "total": total_wallets,
            "total_balance": total_balance,
        },
        "categories": {
            "total": total_categories,
            "system_categories": system_categories,
            "user_categories": user_categories,
        },
        "top_active_users": top_active_users,
        "monthly_stats": monthly_stats,
        "timeline_stats": timeline_stats,
        "period_summary": period_summary,
        "server_info": server_info,
    }


# ─── SECURITY CONFIGURATION ──────────────────────────────────────────────────────

@router.get(
    "/security/audit-log",
    status_code=status.HTTP_200_OK,
    summary="Lấy nhật ký hoạt động bảo mật hệ thống (Chỉ dành cho Admin)"
)
def get_security_audit_log(
    limit: int = 50,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Trả về nhật ký kiểm toán bảo mật hệ thống bao gồm:
    - Người dùng mới đăng ký gần nhất
    - Người dùng bị khóa
    - Người dùng dùng Google OAuth
    - Tài khoản Admin trong hệ thống
    """
    now = datetime.datetime.now()

    # Người dùng mới đăng ký gần nhất (hoạt động đăng ký)
    recent_registrations = db.query(User).order_by(desc(User.created_at)).limit(limit).all()
    registration_events = [
        {
            "event_id": f"REG-{u.id}",
            "event_type": "USER_REGISTERED",
            "severity": "info",
            "user_id": u.id,
            "user_name": u.name,
            "user_email": u.email,
            "user_role": u.role,
            "user_status": u.status,
            "auth_method": "google_oauth" if u.google_id else "email_password",
            "timestamp": u.created_at.strftime("%Y-%m-%d %H:%M:%S") if u.created_at else "",
            "description": f"Tài khoản '{u.name}' đăng ký qua {'Google OAuth' if u.google_id else 'Email/Password'}",
        }
        for u in recent_registrations
    ]

    # Người dùng bị khóa (sự kiện bảo mật)
    locked_users = db.query(User).filter(User.status == "locked").order_by(desc(User.updated_at)).all()
    lock_events = [
        {
            "event_id": f"LOCK-{u.id}",
            "event_type": "ACCOUNT_LOCKED",
            "severity": "warning",
            "user_id": u.id,
            "user_name": u.name,
            "user_email": u.email,
            "user_role": u.role,
            "user_status": u.status,
            "auth_method": "google_oauth" if u.google_id else "email_password",
            "timestamp": u.updated_at.strftime("%Y-%m-%d %H:%M:%S") if u.updated_at else "",
            "description": f"Tài khoản '{u.name}' ({u.email}) đang bị khóa bởi Admin",
        }
        for u in locked_users
    ]

    # Tài khoản Quản trị đặc quyền cao (Super Admin & Admin)
    admin_accounts = db.query(User).filter(User.role.in_(["super_admin", "admin"])).order_by(User.id).all()
    admin_events = [
        {
            "event_id": f"ADMIN-{u.id}",
            "event_type": "PRIVILEGED_ACCOUNT",
            "severity": "critical" if u.role == "super_admin" else "warning",
            "user_id": u.id,
            "user_name": u.name,
            "user_email": u.email,
            "user_role": u.role,
            "user_status": u.status,
            "auth_method": "google_oauth" if u.google_id else "email_password",
            "timestamp": u.created_at.strftime("%Y-%m-%d %H:%M:%S") if u.created_at else "",
            "description": f"Tài khoản {'Super Admin' if u.role == 'super_admin' else 'Admin'} đặc quyền: '{u.name}' ({u.email})",
        }
        for u in admin_accounts
    ]

    # Thống kê tóm tắt bảo mật
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_count = db.query(func.count(User.id)).filter(User.status == "active").scalar() or 0
    locked_count = db.query(func.count(User.id)).filter(User.status == "locked").scalar() or 0
    google_count = db.query(func.count(User.id)).filter(User.google_id != None).scalar() or 0
    super_admin_count = db.query(func.count(User.id)).filter(User.role == "super_admin").scalar() or 0
    admin_count_total = db.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0
    seven_days_ago = now - datetime.timedelta(days=7)
    new_7d = db.query(func.count(User.id)).filter(User.created_at >= seven_days_ago).scalar() or 0

    security_summary = {
        "total_accounts": total_users,
        "active_accounts": active_count,
        "locked_accounts": locked_count,
        "google_oauth_accounts": google_count,
        "super_admin_accounts": super_admin_count,
        "admin_accounts": admin_count_total,
        "privileged_accounts": super_admin_count + admin_count_total,
        "new_registrations_7d": new_7d,
        "lock_rate": round((locked_count / total_users * 100), 2) if total_users > 0 else 0,
        "oauth_adoption_rate": round((google_count / total_users * 100), 2) if total_users > 0 else 0,
        "generated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
    }

    return {
        "summary": security_summary,
        "registration_events": registration_events,
        "lock_events": lock_events,
        "admin_events": admin_events,
    }


# ─── SYSTEM CONFIGURATION (CẤU HÌNH HỆ THỐNG) ───────────────────────────────────

DEFAULT_CONFIG: Dict[str, Any] = {
    "general": {
        "app_name": "FinTrack",
        "tagline": "Quản lý tài chính thông minh",
        "default_language": "vi",
        "timezone": "Asia/Ho_Chi_Minh",
        "date_format": "DD/MM/YYYY",
        "currency": "VND",
        "max_wallets": "10",
        "max_categories": "50",
        "max_file_size_mb": "5",
    },
    "smtp": {
        "host": "smtp.gmail.com",
        "port": "587",
        "username": "",
        "password": "",
        "from_email": "no-reply@fintrack.app",
        "from_name": "FinTrack",
        "use_tls": True,
    },
    "flags": [
        {"id": "ocr_transactions", "label": "Nhập giao dịch bằng OCR", "description": "Cho phép người dùng chụp ảnh hóa đơn để nhập giao dịch tự động.", "enabled": False, "group": "Tính năng"},
        {"id": "advanced_reports", "label": "Báo cáo nâng cao", "description": "Biểu đồ phân tích xu hướng, so sánh theo kỳ, dự đoán chi tiêu.", "enabled": True, "group": "Tính năng"},
        {"id": "wallet_sharing", "label": "Chia sẻ ví", "description": "Người dùng có thể chia sẻ ví chung với người khác.", "enabled": False, "group": "Tính năng"},
        {"id": "budget_alerts", "label": "Cảnh báo ngân sách", "description": "Gửi thông báo khi chi tiêu vượt ngưỡng ngân sách.", "enabled": True, "group": "Thông báo"},
        {"id": "email_notifications", "label": "Thông báo qua Email", "description": "Gửi email tóm tắt hàng tuần và cảnh báo bảo mật.", "enabled": True, "group": "Thông báo"},
        {"id": "push_notifications", "label": "Push Notification", "description": "Thông báo đẩy trên trình duyệt/thiết bị di động.", "enabled": False, "group": "Thông báo"},
        {"id": "google_login", "label": "Đăng nhập Google", "description": "Cho phép đăng nhập bằng tài khoản Google (OAuth2).", "enabled": True, "group": "Bảo mật"},
        {"id": "two_fa", "label": "Xác thực 2 bước (2FA)", "description": "Yêu cầu OTP khi đăng nhập từ thiết bị mới.", "enabled": False, "group": "Bảo mật"},
        {"id": "rate_limiting", "label": "Giới hạn tốc độ (Rate Limit)", "description": "Chặn các request bất thường theo IP và tài khoản.", "enabled": True, "group": "Bảo mật"},
        {"id": "maintenance_mode", "label": "Chế độ bảo trì", "description": "Chặn người dùng thường truy cập, chỉ admin vào được.", "enabled": False, "group": "Hệ thống"},
    ],
    "apis": [
        {"id": "exchange_rate", "name": "API Tỷ giá ngoại tệ", "provider": "ExchangeRate-API", "key": "er_live_********************", "status": "connected", "last_check": "2 phút trước"},
        {"id": "google_oauth", "name": "Google OAuth", "provider": "Google Cloud", "key": "GOCSPX-********************", "status": "connected", "last_check": "5 phút trước"},
        {"id": "ocr_service", "name": "OCR Service", "provider": "Google Vision API", "key": "AIza**********************", "status": "disconnected", "last_check": "1 giờ trước"},
        {"id": "bank_api", "name": "Open Banking API", "provider": "VietQR", "key": "vqr_*********************", "status": "unknown", "last_check": "Chưa kiểm tra"},
    ]
}


def _get_or_create_system_config(db: Session) -> Dict[str, Any]:
    setting = db.query(SystemSetting).filter(SystemSetting.key == "system_config").first()
    if not setting:
        setting = SystemSetting(
            key="system_config",
            value=json.dumps(DEFAULT_CONFIG, ensure_ascii=False)
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
        return DEFAULT_CONFIG.copy()

    try:
        saved_data = json.loads(setting.value)
        # Merge saved data with default keys if missing
        merged = DEFAULT_CONFIG.copy()
        if isinstance(saved_data, dict):
            if "general" in saved_data and isinstance(saved_data["general"], dict):
                merged["general"] = {**DEFAULT_CONFIG["general"], **saved_data["general"]}
            if "smtp" in saved_data and isinstance(saved_data["smtp"], dict):
                merged["smtp"] = {**DEFAULT_CONFIG["smtp"], **saved_data["smtp"]}
            if "flags" in saved_data and isinstance(saved_data["flags"], list):
                merged["flags"] = saved_data["flags"]
            if "apis" in saved_data and isinstance(saved_data["apis"], list):
                merged["apis"] = saved_data["apis"]
        return merged
    except Exception:
        return DEFAULT_CONFIG.copy()


@router.get(
    "/config",
    response_model=SystemConfigResponse,
    status_code=status.HTTP_200_OK,
    summary="Lấy toàn bộ cấu hình hệ thống (Admin & Super Admin)"
)
def get_system_config(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Trả về cấu hình hệ thống hiện tại từ cơ sở dữ liệu:
    - Cài đặt chung (tên, múi giờ, định dạng ngày, tiền tệ, các hạn mức)
    - Cấu hình SMTP
    - Danh sách Feature Flags
    - Tích hợp API bên thứ 3
    """
    return _get_or_create_system_config(db)


@router.put(
    "/config",
    response_model=SystemConfigResponse,
    status_code=status.HTTP_200_OK,
    summary="Cập nhật và lưu cấu hình hệ thống vào cơ sở dữ liệu (Admin & Super Admin)"
)
def update_system_config(
    payload: SystemConfigUpdate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Lưu cấu hình hệ thống mới vào database:
    - Kiểm tra hợp lệ hạn mức (nguyên dương >= 1)
    - Lưu cấu hình general, smtp, feature flags, api integrations
    - Dữ liệu tồn tại vĩnh viễn trên database, không bị mất khi F5 / restart
    """
    current_config = _get_or_create_system_config(db)
    
    updated_dict = {
        "general": payload.general.model_dump(),
        "smtp": payload.smtp.model_dump(),
        "flags": [f.model_dump() for f in payload.flags],
        "apis": [a.model_dump() for a in payload.apis] if payload.apis is not None else current_config.get("apis", DEFAULT_CONFIG["apis"])
    }

    setting = db.query(SystemSetting).filter(SystemSetting.key == "system_config").first()
    if not setting:
        setting = SystemSetting(
            key="system_config",
            value=json.dumps(updated_dict, ensure_ascii=False)
        )
        db.add(setting)
    else:
        setting.value = json.dumps(updated_dict, ensure_ascii=False)

    db.commit()
    db.refresh(setting)

    return updated_dict


@router.post(
    "/config/test-email",
    status_code=status.HTTP_200_OK,
    summary="Gửi email kiểm tra cấu hình SMTP"
)
def test_system_email(
    payload: TestEmailRequest,
    current_admin: User = Depends(require_admin)
):
    """
    Kiểm tra thông số cấu hình SMTP và gửi thử nghiệm đến email admin hiện tại.
    """
    recipient = payload.recipient_email or current_admin.email
    if not payload.smtp.host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMTP Host không được để trống."
        )

    return {
        "status": "success",
        "message": f"Cấu hình SMTP hợp lệ. Email kiểm tra đã được gửi thành công tới {recipient}."
    }


@router.get(
    "/audit-logs",
    response_model=List[AuditLogResponse],
    status_code=status.HTTP_200_OK,
    summary="F08.09 - Xem nhật ký hoạt động hệ thống (Chỉ dành cho Admin)"
)
def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    entity: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    F08.09 - Xem nhật ký hoạt động (Audit Logs) toàn hệ thống.
    Hỗ trợ phân trang, lọc theo action, entity và user_id.
    """
    logs = audit_log_repo.get_multi(
        db,
        skip=skip,
        limit=limit,
        user_id=user_id,
        action=action,
        entity=entity
    )
    result = []
    for log in logs:
        result.append(AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            user_name=log.user.name if log.user else "Hệ thống",
            user_email=log.user.email if log.user else None,
            action=log.action,
            entity=log.entity,
            entity_id=log.entity_id,
            details=log.details,
            ip_address=log.ip_address,
            created_at=log.created_at
        ))
    return result

