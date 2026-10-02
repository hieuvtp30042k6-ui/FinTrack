-- 03_transactions.sql
-- Bảng quản lý giao dịch thu và chi (Transactions)

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,           -- 'INCOME' (Khoản thu) | 'EXPENSE' (Khoản chi)
    amount NUMERIC(15, 2) NOT NULL,
    description VARCHAR(255) NULL,
    receipt_url VARCHAR(500) NULL,
    transaction_date DATE NOT NULL,      -- Ngày giao dịch thực tế (do user cung cấp, bắt buộc)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,  -- Thời điểm tạo bản ghi
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL   -- Thời điểm cập nhật bản ghi
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
