# Database Migrations

Thư mục này chứa các file di chuyển lược đồ cơ sở dữ liệu (Database Migrations).

- Quản lý phiên bản tự động bằng Alembic trong thư mục `backend/alembic/`.
- Chạy lệnh áp dụng migrations:
  ```bash
  cd backend
  alembic upgrade head
  ```
- Tạo migration mới khi thay đổi models SQLAlchemy:
  ```bash
  cd backend
  alembic revision --autogenerate -m "ten_migration"
  ```
