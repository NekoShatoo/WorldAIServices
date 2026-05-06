CREATE TABLE IF NOT EXISTS promotion_list_item_image_chunks (
  item_id TEXT NOT NULL,
  image_kind TEXT NOT NULL CHECK (image_kind IN ('raw', 'pc', 'android', 'ios')),
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  PRIMARY KEY (item_id, image_kind, chunk_index),
  FOREIGN KEY (item_id) REFERENCES promotion_list_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS advertisement_item_image_chunks (
  item_id TEXT NOT NULL,
  image_kind TEXT NOT NULL CHECK (image_kind IN ('raw', 'pc', 'android', 'ios')),
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  PRIMARY KEY (item_id, image_kind, chunk_index),
  FOREIGN KEY (item_id) REFERENCES advertisement_items(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO promotion_list_item_image_chunks (item_id, image_kind, chunk_index, chunk_text)
SELECT id, 'raw', 0, image FROM promotion_list_items WHERE image <> '';

INSERT OR IGNORE INTO promotion_list_item_image_chunks (item_id, image_kind, chunk_index, chunk_text)
SELECT id, 'pc', 0, image_pc FROM promotion_list_items WHERE image_pc <> '';

INSERT OR IGNORE INTO promotion_list_item_image_chunks (item_id, image_kind, chunk_index, chunk_text)
SELECT id, 'android', 0, image_android FROM promotion_list_items WHERE image_android <> '';

INSERT OR IGNORE INTO promotion_list_item_image_chunks (item_id, image_kind, chunk_index, chunk_text)
SELECT id, 'ios', 0, image_ios FROM promotion_list_items WHERE image_ios <> '';

UPDATE promotion_list_items
SET image = '',
    image_pc = '',
    image_android = '',
    image_ios = ''
WHERE image <> ''
   OR image_pc <> ''
   OR image_android <> ''
   OR image_ios <> '';

INSERT OR IGNORE INTO advertisement_item_image_chunks (item_id, image_kind, chunk_index, chunk_text)
SELECT id, 'raw', 0, image FROM advertisement_items WHERE image <> '';

INSERT OR IGNORE INTO advertisement_item_image_chunks (item_id, image_kind, chunk_index, chunk_text)
SELECT id, 'pc', 0, image_pc FROM advertisement_items WHERE image_pc <> '';

INSERT OR IGNORE INTO advertisement_item_image_chunks (item_id, image_kind, chunk_index, chunk_text)
SELECT id, 'android', 0, image_android FROM advertisement_items WHERE image_android <> '';

INSERT OR IGNORE INTO advertisement_item_image_chunks (item_id, image_kind, chunk_index, chunk_text)
SELECT id, 'ios', 0, image_ios FROM advertisement_items WHERE image_ios <> '';

UPDATE advertisement_items
SET image = '',
    image_pc = '',
    image_android = '',
    image_ios = ''
WHERE image <> ''
   OR image_pc <> ''
   OR image_android <> ''
   OR image_ios <> '';
