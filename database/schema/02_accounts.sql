-- 02_accounts.sql
-- Bảng tài khoản tiền / Ví thanh toán (Wallets / Accounts)

CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    balance NUMERIC(15, 2) DEFAULT 0.0 NOT NULL,
    currency VARCHAR(10) DEFAULT 'VND' NOT NULL,
    icon VARCHAR(50) DEFAULT 'account_balance_wallet',
    color VARCHAR(20) DEFAULT '#4F46E5',
    is_default BOOLEAN DEFAULT FALSE,
    is_excluded_from_total BOOLEAN DEFAULT FALSE NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE NOT NULL,
    is_shared BOOLEAN DEFAULT FALSE NOT NULL,
    wallet_type VARCHAR(20) DEFAULT 'STANDARD' NOT NULL,
    credit_limit NUMERIC(15, 2),
    statement_day INTEGER,
    payment_due_day INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

CREATE TABLE IF NOT EXISTS wallet_members (
    id SERIAL PRIMARY KEY,
    wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'VIEWER' NOT NULL,
    status VARCHAR(20) DEFAULT 'ACCEPTED' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_members_wallet_id ON wallet_members(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_members_user_id ON wallet_members(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_members_email ON wallet_members(email);

-- View bí danh tương đương accounts
CREATE OR REPLACE VIEW accounts AS 
SELECT id, user_id, name, balance, currency, created_at, updated_at 
FROM wallets;
