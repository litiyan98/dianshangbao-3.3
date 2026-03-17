CREATE TABLE IF NOT EXISTS RefundAppeals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  appeal_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  requested_refund_tokens INTEGER NOT NULL DEFAULT 0,
  requested_refund_amount REAL NOT NULL DEFAULT 0,
  evidence_json TEXT,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  auto_check_result TEXT,
  resolution_summary TEXT,
  admin_note TEXT,
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refund_appeals_user_created
ON RefundAppeals(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refund_appeals_status_created
ON RefundAppeals(status, created_at DESC);
