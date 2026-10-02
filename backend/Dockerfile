# ==============================================================================
# BACKEND DOCKERFILE - EXPENSE TRACKER (FastAPI + Python 3.11)
# ==============================================================================

FROM python:3.11-slim as base

# Ngăn Python tạo .pyc và buffer output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Cài đặt system libraries cần thiết cho psycopg2 và build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy và cài đặt dependencies Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ mã nguồn Backend
COPY . .

# Tạo thư mục uploads tĩnh nếu chưa có
RUN mkdir -p uploads/avatars uploads/receipts

# Non-root user để tăng cường bảo mật (Hardening - Mục 16)
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Chạy Uvicorn ASGI server
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
