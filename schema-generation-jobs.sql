CREATE TABLE IF NOT EXISTS GenerationJobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  trace_id TEXT,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  stage TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  metrics_json TEXT,
  state_json TEXT,
  result_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_created ON GenerationJobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON GenerationJobs(status, updated_at DESC);
