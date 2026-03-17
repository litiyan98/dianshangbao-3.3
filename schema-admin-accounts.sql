CREATE TABLE IF NOT EXISTS AdminAccounts (
  user_id TEXT PRIMARY KEY,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_accounts_phone
ON AdminAccounts(phone, status);
