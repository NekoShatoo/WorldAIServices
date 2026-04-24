ALTER TABLE promotion_list_items ADD COLUMN image_pc_width INTEGER NOT NULL DEFAULT 0;
ALTER TABLE promotion_list_items ADD COLUMN image_pc_height INTEGER NOT NULL DEFAULT 0;
ALTER TABLE promotion_list_items ADD COLUMN image_pc_texture_format TEXT NOT NULL DEFAULT '';

ALTER TABLE promotion_list_items ADD COLUMN image_android_width INTEGER NOT NULL DEFAULT 0;
ALTER TABLE promotion_list_items ADD COLUMN image_android_height INTEGER NOT NULL DEFAULT 0;
ALTER TABLE promotion_list_items ADD COLUMN image_android_texture_format TEXT NOT NULL DEFAULT '';

ALTER TABLE promotion_list_items ADD COLUMN image_ios_width INTEGER NOT NULL DEFAULT 0;
ALTER TABLE promotion_list_items ADD COLUMN image_ios_height INTEGER NOT NULL DEFAULT 0;
ALTER TABLE promotion_list_items ADD COLUMN image_ios_texture_format TEXT NOT NULL DEFAULT '';
