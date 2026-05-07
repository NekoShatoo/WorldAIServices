-- 非AIサービス移管後に Worker 側へ残った旧データを削除する。
DROP TABLE IF EXISTS promotion_list_item_image_chunks;
DROP TABLE IF EXISTS promotion_list_platform_cache_chunks;
DROP TABLE IF EXISTS promotion_list_platform_cache;
DROP TABLE IF EXISTS promotion_list_items;
DROP TABLE IF EXISTS promotion_api_config;

DROP TABLE IF EXISTS advertisement_item_image_chunks;
DROP TABLE IF EXISTS advertisement_platform_cache_chunks;
DROP TABLE IF EXISTS advertisement_platform_cache;
DROP TABLE IF EXISTS advertisement_items;
DROP TABLE IF EXISTS advertisement_scopes;
