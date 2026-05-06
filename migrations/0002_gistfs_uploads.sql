CREATE TABLE IF NOT EXISTS gistfs_uploaded_files (
  path TEXT PRIMARY KEY,
  source_key TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '' CHECK (platform IN ('', 'pc', 'android', 'ios')),
  raw_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gistfs_uploaded_files_source
  ON gistfs_uploaded_files (source_key, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_gistfs_uploaded_files_uploaded_at
  ON gistfs_uploaded_files (uploaded_at DESC);
