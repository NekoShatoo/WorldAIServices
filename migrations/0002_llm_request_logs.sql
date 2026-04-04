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
