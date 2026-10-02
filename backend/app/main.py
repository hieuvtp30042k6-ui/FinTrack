from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import Base, engine
from app.api.auth import router as auth_router
from app.api.users import router as user_router
from app.api.admin import router as admin_router
from app.api.transactions import router as transaction_router
from app.api.categories import router as category_router
from app.api.wallets import router as wallet_router
from app.api.budgets import router as budget_router
from app.api.reports import router as report_router
from app.models.category import Category


def seed_default_categories():
    """Seed standard system categories according to Project Spec section 9"""
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        existing_count = db.query(Category).filter(Category.user_id == None).count()
        if existing_count == 0:
            default_categories = [
                # Khoản chi (EXPENSE - 7 danh mục chuẩn UI)
                {"name": "Ăn uống", "type": "EXPENSE", "icon": "restaurant", "description": "Bữa chính, cà phê, ăn ngoài", "user_id": None},
                {"name": "Mua sắm", "type": "EXPENSE", "icon": "shopping_bag", "description": "Quần áo, đồ dùng cá nhân", "user_id": None},
                {"name": "Di chuyển", "type": "EXPENSE", "icon": "directions_car", "description": "Xăng xe, gửi xe, taxi, vé xe", "user_id": None},
                {"name": "Hóa đơn & Tiện ích", "type": "EXPENSE", "icon": "receipt_long", "description": "Điện, nước, internet, điện thoại", "user_id": None},
                {"name": "Nhà ở", "type": "EXPENSE", "icon": "home", "description": "Tiền thuê nhà, bảo trì, nội thất", "user_id": None},
                {"name": "Sức khỏe & Y tế", "type": "EXPENSE", "icon": "medical_services", "description": "Thuốc men, khám bệnh, thể thao", "user_id": None},
                {"name": "Giải trí", "type": "EXPENSE", "icon": "sports_esports", "description": "Phim ảnh, du lịch, hội họp", "user_id": None},
                # Khoản thu (INCOME - 3 danh mục chuẩn UI)
                {"name": "Tiền lương", "type": "INCOME", "icon": "payments", "description": "Lương cố định hàng tháng", "user_id": None},
                {"name": "Tiền thưởng", "type": "INCOME", "icon": "workspace_premium", "description": "Thưởng dự án, lễ tết", "user_id": None},
                {"name": "Đầu tư & Tiết kiệm", "type": "INCOME", "icon": "trending_up", "description": "Cổ tức, lãi suất tiết kiệm", "user_id": None},
            ]
            for cat_data in default_categories:
                cat = Category(**cat_data)
                db.add(cat)
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def run_migrations():
    """Apply Alembic migrations to head on application startup."""
    try:
        from alembic.config import Config
        from alembic import command
        alembic_cfg = Config("alembic.ini")
        db_url = settings.DATABASE_URL
        if db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        alembic_cfg.set_main_option("sqlalchemy.url", db_url)
        command.upgrade(alembic_cfg, "head")
    except Exception:
        # Fallback to create_all if alembic.ini is not in working directory
        try:
            Base.metadata.create_all(bind=engine)
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    seed_default_categories()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Backend API cho Hệ thống Quản lý Chi tiêu (Expense Tracker)",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# CORS Middleware for TypeScript Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus Monitoring Middleware (F09 - Monitoring & Metrics)
from app.core.metrics import PrometheusMiddleware, get_metrics_response
app.add_middleware(PrometheusMiddleware)

# Include Routers
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(admin_router)
app.include_router(transaction_router)
app.include_router(category_router)
app.include_router(wallet_router)
app.include_router(budget_router)
app.include_router(report_router)

# Mount Static Files for Uploads (Avatars, Attachments)
import os
from fastapi.staticfiles import StaticFiles

os.makedirs("uploads/avatars", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "app": settings.PROJECT_NAME}


@app.get("/metrics", tags=["Monitoring"], summary="Prometheus Scrape Endpoint (F09)")
def metrics_endpoint():
    """Endpoint cho Prometheus server định kỳ thu thập chỉ số hệ thống và API."""
    return get_metrics_response()
