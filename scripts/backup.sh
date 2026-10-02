#!/usr/bin/env bash
# ==============================================================================
# F10.08 - Backup PostgreSQL Database Script (backup.sh)
# Hệ thống Quản lý Chi tiêu (Expense Tracker)
# ==============================================================================

set -euo pipefail

# Cấu hình biến môi trường (Ưu tiên lấy từ biến môi trường hệ thống hoặc file .env)
DB_HOST="${DB_HOST:-database}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-expense_tracker}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD:-postgres}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.sql.gz"

echo "=========================================="
echo " [BACKUP] Khởi động sao lưu CSDL PostgreSQL"
echo " Thời gian : $(date)"
echo " CSDL      : ${DB_NAME} @ ${DB_HOST}:${DB_PORT}"
echo "=========================================="

# 1. Tạo thư mục chứa backup nếu chưa có
mkdir -p "${BACKUP_DIR}"

# 2. Thực hiện sao lưu bằng pg_dump và nén gzip
export PGPASSWORD="${DB_PASSWORD}"

if command -v docker >/dev/null 2>&1 && docker ps | grep -q "expense-tracker-db"; then
    echo ">> Sao lưu thông qua Docker container 'expense-tracker-db'..."
    docker exec -t expense-tracker-db pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"
else
    echo ">> Sao lưu trực tiếp qua pg_dump..."
    pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"
fi

BACKUP_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
echo ">> [SUCCESS] Sao lưu thành công: ${BACKUP_FILE} (${BACKUP_SIZE})"

# 3. Dọn dẹp bản sao lưu cũ hơn RETENTION_DAYS ngày
echo ">> Dọn dẹp bản backup cũ quá ${RETENTION_DAYS} ngày..."
find "${BACKUP_DIR}" -name "${DB_NAME}_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete || true

echo ">> Hoàn tất sao lưu."
