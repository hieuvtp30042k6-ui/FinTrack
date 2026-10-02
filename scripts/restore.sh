#!/usr/bin/env bash
# ==============================================================================
# F10.09 - Restore PostgreSQL Database Script (restore.sh)
# Hệ thống Quản lý Chi tiêu (Expense Tracker)
# ==============================================================================

set -euo pipefail

DB_HOST="${DB_HOST:-database}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-expense_tracker}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD:-postgres}"

if [ $# -lt 1 ]; then
    echo "Sử dụng: $0 <duong_dan_file_backup.sql.gz>"
    echo "Ví dụ : $0 ./backups/expense_tracker_backup_20261002_120000.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Lỗi: Không tìm thấy file backup tại '${BACKUP_FILE}'"
    exit 1
fi

echo "=========================================="
echo " [RESTORE] Phục hồi CSDL PostgreSQL"
echo " CSDL Đích : ${DB_NAME} @ ${DB_HOST}:${DB_PORT}"
echo " File Nguồn: ${BACKUP_FILE}"
echo "=========================================="

read -p "CẢNH BÁO: Thao tác này có thể ghi đè dữ liệu hiện tại. Bạn có chắc chắn muốn tiếp tục? (y/N): " confirm
if [[ ! "$confirm" =~ ^[yY]$ ]]; then
    echo ">> Đã hủy thao tác phục hồi."
    exit 0
fi

export PGPASSWORD="${DB_PASSWORD}"

if [[ "${BACKUP_FILE}" == *.gz ]]; then
    DECOMPRESS_CMD="gzip -dc"
else
    DECOMPRESS_CMD="cat"
fi

if command -v docker >/dev/null 2>&1 && docker ps | grep -q "expense-tracker-db"; then
    echo ">> Đang phục hồi dữ liệu vào Docker container 'expense-tracker-db'..."
    ${DECOMPRESS_CMD} "${BACKUP_FILE}" | docker exec -i expense-tracker-db psql -U "${DB_USER}" -d "${DB_NAME}"
else
    echo ">> Đang phục hồi dữ liệu trực tiếp qua psql..."
    ${DECOMPRESS_CMD} "${BACKUP_FILE}" | psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}"
fi

echo ">> [SUCCESS] Phục hồi CSDL thành công từ ${BACKUP_FILE}!"
