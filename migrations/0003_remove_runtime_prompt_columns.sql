CREATE TABLE IF NOT EXISTS service_config_next (
  config_id INTEGER PRIMARY KEY CHECK (config_id = 1),
  enabled INTEGER NOT NULL,
  requests_per_minute INTEGER NOT NULL,
  max_chars INTEGER NOT NULL,
  cache_ttl_seconds INTEGER NOT NULL,
  error_retention_seconds INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO service_config_next (
  config_id,
  enabled,
  requests_per_minute,
  max_chars,
  cache_ttl_seconds,
  error_retention_seconds,
  updated_at
)
SELECT
  config_id,
  enabled,
  requests_per_minute,
  max_chars,
  cache_ttl_seconds,
  error_retention_seconds,
  updated_at
FROM service_config;

DROP TABLE service_config;
ALTER TABLE service_config_next RENAME TO service_config;
