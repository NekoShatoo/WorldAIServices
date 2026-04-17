CREATE TABLE IF NOT EXISTS promotion_list_items (
  id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL CHECK (item_type IN ('Avatar', 'World')),
  title TEXT NOT NULL,
  anchor TEXT NOT NULL,
  description TEXT NOT NULL,
  link TEXT NOT NULL,
  image TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_promotion_list_items_type
  ON promotion_list_items (item_type, updated_at DESC);

CREATE TABLE IF NOT EXISTS promotion_list_cache (
  cache_id INTEGER PRIMARY KEY CHECK (cache_id = 1),
  payload_total_bytes INTEGER NOT NULL,
  payload_updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promotion_list_cache_chunks (
  chunk_index INTEGER PRIMARY KEY,
  chunk_text TEXT NOT NULL
);

INSERT OR IGNORE INTO promotion_list_cache (
  cache_id,
  payload_total_bytes,
  payload_updated_at
) VALUES (
  1,
  LENGTH('{"Avatar":[],"World":[]}'),
  '1970-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO promotion_list_cache_chunks (
  chunk_index,
  chunk_text
) VALUES (
  0,
  '{"Avatar":[],"World":[]}'
);
