CREATE TABLE IF NOT EXISTS advertisement_scopes (
  id TEXT PRIMARY KEY,
  scope_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_advertisement_scopes_key
  ON advertisement_scopes (scope_key);

CREATE TABLE IF NOT EXISTS advertisement_items (
  id TEXT PRIMARY KEY,
  scope_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  image TEXT NOT NULL,
  image_pc TEXT NOT NULL DEFAULT '',
  image_pc_width INTEGER NOT NULL DEFAULT 0,
  image_pc_height INTEGER NOT NULL DEFAULT 0,
  image_pc_texture_format TEXT NOT NULL DEFAULT '',
  image_android TEXT NOT NULL DEFAULT '',
  image_android_width INTEGER NOT NULL DEFAULT 0,
  image_android_height INTEGER NOT NULL DEFAULT 0,
  image_android_texture_format TEXT NOT NULL DEFAULT '',
  image_ios TEXT NOT NULL DEFAULT '',
  image_ios_width INTEGER NOT NULL DEFAULT 0,
  image_ios_height INTEGER NOT NULL DEFAULT 0,
  image_ios_texture_format TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (scope_id) REFERENCES advertisement_scopes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_advertisement_items_scope
  ON advertisement_items (scope_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_advertisement_items_scope_order
  ON advertisement_items (scope_id, display_order ASC);

CREATE TABLE IF NOT EXISTS advertisement_platform_cache (
  scope_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('pc', 'android', 'ios')),
  payload_bytes INTEGER NOT NULL,
  payload_updated_at TEXT NOT NULL,
  PRIMARY KEY (scope_id, platform),
  FOREIGN KEY (scope_id) REFERENCES advertisement_scopes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS advertisement_platform_cache_chunks (
  scope_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('pc', 'android', 'ios')),
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  PRIMARY KEY (scope_id, platform, chunk_index),
  FOREIGN KEY (scope_id) REFERENCES advertisement_scopes(id) ON DELETE CASCADE
);
