# ĐỀ TÀI 38 – HỆ THỐNG QUẢN LÝ CHI TIÊU (EXPENSE TRACKER)

Hệ thống quản lý thu chi cá nhân/gia đình trên nền Web, được thiết kế theo mô hình phân tầng chuẩn, triển khai đóng gói container toàn diện kèm hạ tầng Nginx Reverse Proxy, hệ thống giám sát Prometheus + Grafana và quản lý log tập trung với Loki + LogQL.

---

## 1. BẢNG CÔNG NGHỆ ÁP DỤNG

| Hạng mục | Công nghệ sử dụng | Ghi chú |
|---|---|---|
| **Frontend** | React, TypeScript, Vite | Giao diện Responsive hiện đại, tối ưu SEO |
| **Backend** | Python 3.11, FastAPI, SQLAlchemy, Pydantic | Kiến trúc API $\rightarrow$ Service $\rightarrow$ Repository $\rightarrow$ Database |
| **Cơ sở dữ liệu** | PostgreSQL 16 | Chuẩn hóa quan hệ, sequence, index tối ưu |
| **Quản trị CSDL** | pgAdmin 4 | Giao diện web trực quan quản lý CSDL |
| **Reverse Proxy** | Nginx Alpine | Điều hướng phân luồng, nén Gzip, bảo mật Header |
| **Monitoring** | Prometheus + Grafana | Thu thập số liệu hiệu năng API và hệ thống theo thời gian thực |
| **Logging** | Loki + LogQL | Thu thập và truy vấn log tập trung |
| **Quản lý mã nguồn** | GitHub | Quản lý source code |
| **Triển khai** | Docker, Docker Compose | Đóng gói toàn bộ hệ sinh thái chạy tự động |
| **Bảo mật** | Hardening hệ thống | CORS cấu hình chặt chẽ, Non-root containers, Token JWT, RBAC |

---

## 2. KIẾN TRÚC HỆ THỐNG (MỤC 18)

```
                            INTERNET / BROWSER
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   NGINX REVERSE     │
                         │       PROXY         │
                         └──────────┬──────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
  ┌───────────────────┐                           ┌───────────────────┐
  │     FRONTEND      │                           │      BACKEND      │
  │  React/TypeScript │──────────────────────────▶│   FastAPI/Python  │
  └───────────────────┘                           └─────────┬─────────┘
                                                            │
                                  ┌─────────────────────────┴────────────────────────┐
                                  ▼                                                  ▼
                         ┌─────────────────┐                                ┌─────────────────┐
                         │   PostgreSQL    │                                │   Prometheus    │
                         │    Database     │                                │    Monitoring   │
                         └────────┬────────┘                                └────────┬────────┘
                                  │                                                  │
                               pgAdmin                                            Grafana
                                                                                     ▲
                                                                                     │
                                                      Loki (Logging) ────────────────┘
```

---

## 3. CÂY THƯ MỤC CHUẨN CỦA DỰ ÁN (MỤC 20)

```
expense-tracker/
│
├── frontend/                     # Mã nguồn Giao diện người dùng
│   ├── src/
│   │   ├── components/           # Component UI tái sử dụng
│   │   ├── pages/                # Các trang màn hình nghiệp vụ
│   │   ├── services/             # Lớp gọi API Backend
│   │   ├── types/                # TypeScript type definitions
│   │   ├── utils/                # Hàm tiện ích xử lý định dạng, ngày tháng
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                      # Mã nguồn Máy chủ Backend
│   ├── app/
│   │   ├── api/                  # Tầng định tuyến API Endpoint
│   │   ├── models/               # SQLAlchemy ORM Models
│   │   ├── schemas/              # Pydantic Schemas xác thực dữ liệu
│   │   ├── services/             # Xử lý Business Logic nghiệp vụ
│   │   ├── repositories/         # Tương tác và truy vấn CSDL
│   │   ├── core/                 # Cấu hình, Database engine, JWT, Metrics
│   │   └── main.py               # File khởi động FastAPI
│   ├── tests/                    # Unit tests & Integration tests
│   ├── Dockerfile
│   └── requirements.txt          # Danh sách thư viện Python
│
├── database/                     # Cấu trúc CSDL và Dữ liệu khởi tạo
│   ├── init.sql                  # Toàn bộ DDL khởi tạo schema
│   ├── seed.sql                  # Dữ liệu mẫu khởi tạo chuẩn
│   └── migrations/               # Thư mục lưu lịch sử migration
│
├── nginx/                        # Cấu hình Cổng vào Reverse Proxy
│   └── nginx.conf
│
├── monitoring/                   # Cấu hình Hệ thống Giám sát & Ghi log
│   ├── prometheus/
│   │   └── prometheus.yml        # Cấu hình Scrape endpoint backend /metrics
│   ├── grafana/
│   │   ├── dashboards/           # Pre-built Dashboards JSON
│   │   └── provisioning/         # Auto-provisioning datasources & dashboards
│   └── loki/
│       └── loki-config.yml       # Cấu hình Loki thu thập log
│
├── scripts/                      # Kịch bản Vận hành & Bảo trì
│   ├── backup.sh                 # Sao lưu tự động CSDL PostgreSQL (F10.08)
│   └── restore.sh                # Phục hồi CSDL từ bản sao lưu (F10.09)
│
├── docker-compose.yml            # Điều phối toàn bộ các container dịch vụ
├── .env.example                  # Mẫu biến môi trường cấu hình hệ thống
├── .gitignore                    # Bỏ qua các file rác, file tạm
└── README.md                     # Tài liệu hướng dẫn dự án
```

---

## 4. HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG

### Cách 1: Khởi chạy toàn bộ hệ thống bằng Docker Compose (Khuyên dùng)

1. Sao chép file cấu hình môi trường:
   ```bash
   cp .env.example .env
   ```
2. Khởi chạy toàn bộ hệ sinh thái (Nginx, Frontend, Backend, Database, pgAdmin, Prometheus, Grafana, Loki):
   ```bash
   docker-compose up -d --build
   ```
3. Truy cập các dịch vụ:
   * **Cổng chính ứng dụng (Web App & API qua Nginx):** `http://localhost`
   * **Swagger API Documentation:** `http://localhost/api/docs`
   * **pgAdmin (Quản trị CSDL):** `http://localhost:5050`
     * Email: `admin@fintrack.local`
     * Password: `Admin123456!`
   * **Grafana (Monitoring & Dashboards):** `http://localhost:3001`
     * User: `admin`
     * Password: `admin123`
   * **Prometheus:** `http://localhost:9090`
   * **Loki:** `http://localhost:3100`

---

### Cách 2: Khởi chạy cục bộ (Local Development)

#### Backend:
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### Frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## 5. TÀI KHOẢN MẪU KHỞI TẠO (TRONG `seed.sql`)

* Mật khẩu chung mặc định: **`Password@123`**

| Vai trò | Họ tên | Email | Quyền hạn |
|---|---|---|---|
| **Super Admin** | Vũ Tổng Quản Trị | `superadmin@fintrack.internal` | Toàn quyền cấu hình hệ thống, phân vai trò Admin |
| **Admin** | Trần Quản Trị Viên | `admin@fintrack.internal` | Quản lý người dùng, xem thống kê, khóa tài khoản, audit logs |
| **User** | Nguyễn Văn A | `vana.nguyen@example.com` | Quản lý thu chi cá nhân, ví tiền, ngân sách, báo cáo |

---

## 6. HƯỚNG DẪN VẬN HÀNH BẢO MẬT & SAO LƯU (F10)

* **Tự động sao lưu CSDL (Backup):**
  ```bash
  bash scripts/backup.sh
  ```
  File sao lưu nén gzip sẽ được lưu tự động vào thư mục `./backups/` và tự dọn dẹp các bản lưu cũ quá 7 ngày.

* **Phục hồi dữ liệu từ bản sao lưu (Restore):**
  ```bash
  bash scripts/restore.sh ./backups/expense_tracker_backup_YYYYMMDD_HHMMSS.sql.gz
  ```
