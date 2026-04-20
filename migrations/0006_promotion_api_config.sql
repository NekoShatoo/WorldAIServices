CREATE TABLE IF NOT EXISTS promotion_api_config (
  config_id INTEGER PRIMARY KEY CHECK (config_id = 1),
  include_image_in_response INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO promotion_api_config (
  config_id,
  include_image_in_response,
  updated_at
) VALUES (
  1,
  1,
  '1970-01-01T00:00:00.000Z'
);
