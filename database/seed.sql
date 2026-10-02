-- ==============================================================================
-- EXPENSE TRACKER - DATABASE SEED DATA SCRIPT (seed.sql)
-- Mục 8, 9, 11, 20: Dữ liệu khởi tạo chuẩn cho Expense Tracker
-- Mật khẩu mặc định: Password@123
-- Hash Bcrypt: $2b$12$aU32DZTFMiYyakHlFu.zTOznteK/1EDzNT8taTiNE7ch.4CFLhm12
-- ==============================================================================

-- 1. Người dùng mẫu (3 vai trò: super_admin, admin, user)
INSERT INTO users (id, name, email, password_hash, role, status) VALUES
(1, 'Vũ Tổng Quản Trị', 'superadmin@fintrack.internal', '$2b$12$aU32DZTFMiYyakHlFu.zTOznteK/1EDzNT8taTiNE7ch.4CFLhm12', 'super_admin', 'active'),
(2, 'Trần Quản Trị Viên', 'admin@fintrack.internal', '$2b$12$aU32DZTFMiYyakHlFu.zTOznteK/1EDzNT8taTiNE7ch.4CFLhm12', 'admin', 'active'),
(3, 'Nguyễn Văn A', 'vana.nguyen@example.com', '$2b$12$aU32DZTFMiYyakHlFu.zTOznteK/1EDzNT8taTiNE7ch.4CFLhm12', 'user', 'active')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  status = EXCLUDED.status;

-- 2. Danh mục hệ thống dùng chung (user_id = NULL)
INSERT INTO categories (id, user_id, name, type, icon, description) VALUES
(1, NULL, 'Ăn uống', 'EXPENSE', 'restaurant', 'Bữa chính, cà phê, ăn ngoài'),
(2, NULL, 'Mua sắm', 'EXPENSE', 'shopping_bag', 'Quần áo, đồ dùng cá nhân'),
(3, NULL, 'Di chuyển', 'EXPENSE', 'directions_car', 'Xăng xe, gửi xe, taxi, vé xe'),
(4, NULL, 'Hóa đơn & Tiện ích', 'EXPENSE', 'receipt_long', 'Điện, nước, internet, điện thoại'),
(5, NULL, 'Nhà ở', 'EXPENSE', 'home', 'Tiền thuê nhà, bảo trì, nội thất'),
(6, NULL, 'Sức khỏe & Y tế', 'EXPENSE', 'medical_services', 'Thuốc men, khám bệnh, thể thao'),
(7, NULL, 'Giải trí', 'EXPENSE', 'sports_esports', 'Phim ảnh, du lịch, hội họp'),
(8, NULL, 'Tiền lương', 'INCOME', 'payments', 'Lương cố định hàng tháng'),
(9, NULL, 'Tiền thưởng', 'INCOME', 'workspace_premium', 'Thưởng dự án, lễ tết'),
(10, NULL, 'Đầu tư & Tiết kiệm', 'INCOME', 'trending_up', 'Cổ tức, lãi suất tiết kiệm')
ON CONFLICT (id) DO NOTHING;

-- 3. Ví tiền mẫu (Gắn với người dùng Nguyễn Văn A - id: 3)
INSERT INTO wallets (id, user_id, name, balance, currency, icon, color, is_default) VALUES
(1, 3, 'Tiền mặt', 2500000.00, 'VND', 'payments', '#10B981', TRUE),
(2, 3, 'Ngân hàng Vietcombank', 18500000.00, 'VND', 'account_balance', '#3B82F6', FALSE),
(3, 3, 'Ví điện tử MoMo', 1200000.00, 'VND', 'account_balance_wallet', '#EC4899', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 4. Giao dịch mẫu (Transactions của người dùng Nguyễn Văn A - id: 3)
INSERT INTO transactions (id, user_id, category_id, wallet_id, type, amount, description, transaction_date) VALUES
(1, 3, 8, 2, 'INCOME', 20000000.00, 'Lương tháng 09/2026', CURRENT_TIMESTAMP - INTERVAL '5 days'),
(2, 3, 1, 1, 'EXPENSE', 150000.00, 'Ăn trưa văn phòng', CURRENT_TIMESTAMP - INTERVAL '3 days'),
(3, 3, 4, 3, 'EXPENSE', 200000.00, 'Thanh toán cước điện thoại', CURRENT_TIMESTAMP - INTERVAL '2 days'),
(4, 3, 2, 2, 'EXPENSE', 450000.00, 'Mua đồ dùng cá nhân', CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- 5. Ngân sách mẫu (F04: Quản lý ngân sách - Mục 10)
INSERT INTO budgets (id, user_id, category_id, amount, period, start_date, end_date) VALUES
(1, 3, 1, 3000000.00, 'MONTHLY', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '20 days'),
(2, 3, 2, 1500000.00, 'MONTHLY', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '20 days')
ON CONFLICT (id) DO NOTHING;

-- 6. Nhật ký kiểm toán mẫu (Audit Logs)
INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip_address) VALUES
(1, 'LOGIN', 'auth', 1, 'Đăng nhập hệ thống Super Admin thành công', '127.0.0.1'),
(3, 'CREATE', 'transaction', 1, 'Tạo giao dịch thu nhập Lương tháng', '192.168.1.10'),
(3, 'CREATE', 'transaction', 2, 'Tạo khoản chi Ăn uống', '192.168.1.10');

-- 7. Reset Sequence Postgres
SELECT setval(pg_get_serial_sequence('users', 'id'), coalesce(max(id), 1)) FROM users;
SELECT setval(pg_get_serial_sequence('categories', 'id'), coalesce(max(id), 1)) FROM categories;
SELECT setval(pg_get_serial_sequence('wallets', 'id'), coalesce(max(id), 1)) FROM wallets;
SELECT setval(pg_get_serial_sequence('transactions', 'id'), coalesce(max(id), 1)) FROM transactions;
SELECT setval(pg_get_serial_sequence('budgets', 'id'), coalesce(max(id), 1)) FROM budgets;
SELECT setval(pg_get_serial_sequence('audit_logs', 'id'), coalesce(max(id), 1)) FROM audit_logs;
