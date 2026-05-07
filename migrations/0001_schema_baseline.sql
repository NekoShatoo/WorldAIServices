CREATE TABLE IF NOT EXISTS service_config (
  config_id INTEGER PRIMARY KEY CHECK (config_id = 1),
  enabled INTEGER NOT NULL,
  requests_per_minute INTEGER NOT NULL,
  max_chars INTEGER NOT NULL,
  cache_ttl_seconds INTEGER NOT NULL,
  error_retention_seconds INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO service_config (
  config_id,
  enabled,
  requests_per_minute,
  max_chars,
  cache_ttl_seconds,
  error_retention_seconds,
  updated_at
) VALUES (
  1,
  1,
  6,
  300,
  15552000,
  1209600,
  '1970-01-01T00:00:00.000Z'
);

CREATE TABLE IF NOT EXISTS translation_cache (
  cache_key TEXT PRIMARY KEY,
  lang TEXT NOT NULL,
  prompt_version INTEGER NOT NULL,
  result TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_translation_cache_expires_at
  ON translation_cache (expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  window_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at
  ON rate_limits (expires_at);

CREATE TABLE IF NOT EXISTS translation_stats (
  period_type TEXT NOT NULL,
  period_key TEXT NOT NULL,
  lang TEXT NOT NULL,
  requests_total INTEGER NOT NULL DEFAULT 0,
  total_input_chars INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  cache_misses INTEGER NOT NULL DEFAULT 0,
  ai_requests INTEGER NOT NULL DEFAULT 0,
  ai_successes INTEGER NOT NULL DEFAULT 0,
  ai_failures INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (period_type, period_key, lang)
);

CREATE INDEX IF NOT EXISTS idx_translation_stats_period
  ON translation_stats (period_type, period_key);

CREATE TABLE IF NOT EXISTS error_logs (
  error_id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  details_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_error_logs_occurred_at
  ON error_logs (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_expires_at
  ON error_logs (expires_at);

CREATE TABLE IF NOT EXISTS llm_request_logs (
  request_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  provider_mode TEXT NOT NULL,
  lang TEXT NOT NULL,
  input_chars INTEGER NOT NULL,
  prompt_version INTEGER NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  public_reason TEXT NOT NULL,
  input_preview TEXT NOT NULL,
  output_preview TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_llm_request_logs_occurred_at
  ON llm_request_logs (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_request_logs_expires_at
  ON llm_request_logs (expires_at);
