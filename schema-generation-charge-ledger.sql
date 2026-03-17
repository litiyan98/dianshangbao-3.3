CREATE TABLE IF NOT EXISTS GenerationChargeLedger (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  output_id TEXT,
  trace_id TEXT,
  slot_index INTEGER NOT NULL DEFAULT 0,
  action_type TEXT NOT NULL,
  token_delta INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_generation_charge_job
ON GenerationChargeLedger(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_charge_user_created
ON GenerationChargeLedger(user_id, created_at DESC);
