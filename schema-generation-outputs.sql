CREATE TABLE IF NOT EXISTS GenerationOutputs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  trace_id TEXT,
  slot_index INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL,
  model_name TEXT,
  status TEXT NOT NULL,
  image_url TEXT,
  prompt_snapshot TEXT,
  error_message TEXT,
  charged_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_generation_outputs_job
ON GenerationOutputs(job_id, slot_index);

CREATE INDEX IF NOT EXISTS idx_generation_outputs_user_created
ON GenerationOutputs(user_id, created_at DESC);
