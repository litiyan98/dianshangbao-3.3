CREATE TABLE IF NOT EXISTS GenerationCache (
  cache_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  value_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_generation_cache_kind_expires ON GenerationCache(kind, expires_at);
