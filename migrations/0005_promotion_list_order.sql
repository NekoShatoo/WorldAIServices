ALTER TABLE promotion_list_items ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    id,
    item_type,
    ROW_NUMBER() OVER (PARTITION BY item_type ORDER BY updated_at DESC, id ASC) AS rn
  FROM promotion_list_items
)
UPDATE promotion_list_items
SET display_order = (
  SELECT rn
  FROM ranked
  WHERE ranked.id = promotion_list_items.id
    AND ranked.item_type = promotion_list_items.item_type
);

CREATE INDEX IF NOT EXISTS idx_promotion_list_items_type_order
  ON promotion_list_items (item_type, display_order ASC);
