CREATE TABLE IF NOT EXISTS promotion_list_platform_cache (
  platform TEXT PRIMARY KEY CHECK (platform IN ('pc', 'android', 'ios')),
  payload_bytes INTEGER NOT NULL,
  payload_updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promotion_list_platform_cache_chunks (
  platform TEXT NOT NULL CHECK (platform IN ('pc', 'android', 'ios')),
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  PRIMARY KEY (platform, chunk_index)
);

INSERT OR IGNORE INTO promotion_list_platform_cache (
  platform,
  payload_bytes,
  payload_updated_at
) VALUES
  ('pc', LENGTH('{"Avatar":[],"World":[]}'), '1970-01-01T00:00:00.000Z'),
  ('android', LENGTH('{"Avatar":[],"World":[]}'), '1970-01-01T00:00:00.000Z'),
  ('ios', LENGTH('{"Avatar":[],"World":[]}'), '1970-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO promotion_list_platform_cache_chunks (
  platform,
  chunk_index,
  chunk_text
) VALUES
  ('pc', 0, '{"Avatar":[],"World":[]}'),
  ('android', 0, '{"Avatar":[],"World":[]}'),
  ('ios', 0, '{"Avatar":[],"World":[]}');
