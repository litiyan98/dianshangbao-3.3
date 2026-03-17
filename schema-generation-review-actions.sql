CREATE TABLE IF NOT EXISTS GenerationReviewActions (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  output_id TEXT,
  target_user_id TEXT NOT NULL,
  admin_user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  issue_tag TEXT,
  token_delta INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_generation_review_actions_job
ON GenerationReviewActions(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_review_actions_target_user
ON GenerationReviewActions(target_user_id, created_at DESC);
