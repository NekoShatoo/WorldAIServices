import {
	Env,
	ServiceConfig,
	TranslationMetric,
	TranslationStatsSummary,
	TranslationStatsRecord,
	ErrorEntry,
	LlmRequestEntry,
	PromotionItem,
	PromotionItemType,
	PromotionPayload,
	PromotionPlatform,
	PromotionPlatformPayloadBundle,
	GistfsFileMetadata,
	AdvertisementScope,
	AdvertisementItem,
	AdvertisementPlatform,
	AdvertisementExportItem,
	AdvertisementPlatformPayloadBundle,
	NonAiMigrationData,
} from './types';
import { clampInteger, safeMetricNumber, parseStoredJsonObject, MAINTENANCE_BATCH_SIZE } from './utils';

export const DEFAULT_CONFIG: ServiceConfig = Object.freeze({
	enabled: true,
	requestsPerMinute: 6,
	maxChars: 300,
	cacheTtlSeconds: 60 * 60 * 24 * 180,
	errorRetentionSeconds: 60 * 60 * 24 * 14,
});
const PROMOTION_LIST_MAX_BYTES = 100 * 1024 * 1024;
const PROMOTION_LIST_CHUNK_SIZE = 900000;
const ADVERTISEMENT_LIST_MAX_BYTES = 100 * 1024 * 1024;
const ADVERTISEMENT_IMAGE_CHUNK_SIZE = 1500000;
const PROMOTION_GIST_SOURCE_KEY = 'PromotionList';
const ADVERTISEMENT_GIST_SOURCE_KEY = 'Advertisement';
const EMPTY_PROMOTION_PAYLOAD: PromotionPayload = Object.freeze({ Avatar: [], World: [] });
const EMPTY_PROMOTION_PLATFORM_PAYLOAD_BUNDLE: PromotionPlatformPayloadBundle = Object.freeze({
	pc: { Avatar: [], World: [] },
	android: { Avatar: [], World: [] },
	ios: { Avatar: [], World: [] },
});
const PROMOTION_PLATFORMS: PromotionPlatform[] = ['pc', 'android', 'ios'];
const EMPTY_ADVERTISEMENT_PLATFORM_PAYLOAD_BUNDLE: AdvertisementPlatformPayloadBundle = Object.freeze({
	pc: [],
	android: [],
	ios: [],
});
const ADVERTISEMENT_PLATFORMS: AdvertisementPlatform[] = ['pc', 'android', 'ios'];
const MIGRATION_IMPORT_BATCH_SIZE = 40;
type StoredImageKind = 'raw' | PromotionPlatform;
type ImageChunkTableName = 'promotion_list_item_image_chunks' | 'advertisement_item_image_chunks';

const PROMOTION_GIST_PATHS: Record<PromotionPlatform, string> = {
	pc: 'PromotionList.pc.json',
	android: 'PromotionList.android.json',
	ios: 'PromotionList.ios.json',
};

export async function loadConfig(env: Env): Promise<ServiceConfig> {
	const db = env.STATE_DB;
	const stored = await db
		.prepare(
			`SELECT
      enabled,
      requests_per_minute AS requestsPerMinute,
      max_chars AS maxChars,
      cache_ttl_seconds AS cacheTtlSeconds,
      error_retention_seconds AS errorRetentionSeconds
    FROM service_config
    WHERE config_id = 1`
		)
		.first<any>();

	if (!stored) return { ...DEFAULT_CONFIG };

	return {
		...DEFAULT_CONFIG,
		enabled: normalizeBooleanFlag(stored.enabled, DEFAULT_CONFIG.enabled),
		requestsPerMinute: clampInteger(Number(stored.requestsPerMinute), 1, 60, 6),
		maxChars: clampInteger(Number(stored.maxChars), 1, 1000, 300),
		cacheTtlSeconds: clampInteger(Number(stored.cacheTtlSeconds), 60, 60 * 60 * 24 * 365, DEFAULT_CONFIG.cacheTtlSeconds),
		errorRetentionSeconds: clampInteger(Number(stored.errorRetentionSeconds), 60, 60 * 60 * 24 * 365, DEFAULT_CONFIG.errorRetentionSeconds),
	};
}

function normalizeBooleanFlag(value: any, fallback: boolean): boolean {
	if (typeof value === 'boolean') return value;
	if (value === 1 || value === '1') return true;
	if (value === 0 || value === '0') return false;
	return fallback;
}

export async function upsertConfig(env: Env, config: ServiceConfig) {
	await env.STATE_DB.prepare(
		`INSERT INTO service_config (
      config_id,
      enabled,
      requests_per_minute,
      max_chars,
      cache_ttl_seconds,
      error_retention_seconds,
      updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(config_id) DO UPDATE SET
      enabled = excluded.enabled,
      requests_per_minute = excluded.requests_per_minute,
      max_chars = excluded.max_chars,
      cache_ttl_seconds = excluded.cache_ttl_seconds,
      error_retention_seconds = excluded.error_retention_seconds,
      updated_at = excluded.updated_at`
	)
		.bind(config.enabled ? 1 : 0, config.requestsPerMinute, config.maxChars, config.cacheTtlSeconds, config.errorRetentionSeconds, new Date().toISOString())
		.run();
}

export async function updateConfig(env: Env, partialConfig: Partial<ServiceConfig>) {
	const current = await loadConfig(env);
	const next = { ...current, ...partialConfig };
	await upsertConfig(env, next);
	return next;
}

export async function getCachedTranslation(env: Env, cacheKey: string): Promise<string | null> {
	const row = await env.STATE_DB.prepare(
		`SELECT result
    FROM translation_cache
    WHERE cache_key = ? AND expires_at > ?`
	)
		.bind(cacheKey, Date.now())
		.first<{ result: string }>();

	return row?.result ?? null;
}

export async function putCachedTranslation(env: Env, cacheKey: string, lang: string, promptVersion: number, result: string, ttlSeconds: number) {
	const now = Date.now();
	await env.STATE_DB.prepare(
		`INSERT INTO translation_cache (
      cache_key,
      lang,
      prompt_version,
      result,
      expires_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      lang = excluded.lang,
      prompt_version = excluded.prompt_version,
      result = excluded.result,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at`
	)
		.bind(cacheKey, lang, promptVersion, result, now + ttlSeconds * 1000, new Date(now).toISOString())
		.run();
}

export async function recordTranslationStats(env: Env, metric: TranslationMetric) {
	const keys = buildStatsKeys();
	const updatedAt = new Date().toISOString();
	const db = env.STATE_DB;

	await db.batch([
		buildStatsUpsertStatement(db, 'day', keys.dayKey, metric, updatedAt),
		buildStatsUpsertStatement(db, 'month', keys.monthKey, metric, updatedAt),
	]);
}

function buildStatsKeys() {
	const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
	const year = String(now.getUTCFullYear()).padStart(4, '0');
	const month = String(now.getUTCMonth() + 1).padStart(2, '0');
	const day = String(now.getUTCDate()).padStart(2, '0');

	return {
		dayKey: `${year}-${month}-${day}`,
		monthKey: `${year}-${month}`,
	};
}

function buildStatsUpsertStatement(db: D1Database, periodType: string, periodKey: string, metric: TranslationMetric, updatedAt: string) {
	return db
		.prepare(
			`INSERT INTO translation_stats (
      period_type,
      period_key,
      lang,
      requests_total,
      total_input_chars,
      cache_hits,
      cache_misses,
      ai_requests,
      ai_successes,
      ai_failures,
      updated_at
    ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(period_type, period_key, lang) DO UPDATE SET
      requests_total = translation_stats.requests_total + 1,
      total_input_chars = translation_stats.total_input_chars + excluded.total_input_chars,
      cache_hits = translation_stats.cache_hits + excluded.cache_hits,
      cache_misses = translation_stats.cache_misses + excluded.cache_misses,
      ai_requests = translation_stats.ai_requests + excluded.ai_requests,
      ai_successes = translation_stats.ai_successes + excluded.ai_successes,
      ai_failures = translation_stats.ai_failures + excluded.ai_failures,
      updated_at = excluded.updated_at`
		)
		.bind(
			periodType,
			periodKey,
			metric.lang,
			metric.textLength,
			metric.cacheHit ? 1 : 0,
			metric.cacheMiss ? 1 : 0,
			metric.aiRequest ? 1 : 0,
			metric.aiSuccess ? 1 : 0,
			metric.aiFailure ? 1 : 0,
			updatedAt
		);
}

export async function loadTranslationStatsSummary(env: Env): Promise<TranslationStatsSummary> {
	const keys = buildStatsKeys();
	const [dayRows, monthRows] = await Promise.all([loadStatsRows(env, 'day', keys.dayKey), loadStatsRows(env, 'month', keys.monthKey)]);

	return {
		day: normalizeStatsRecord(dayRows, 'day', keys.dayKey),
		month: normalizeStatsRecord(monthRows, 'month', keys.monthKey),
	};
}

async function loadStatsRows(env: Env, periodType: string, periodKey: string) {
	const result = await env.STATE_DB.prepare(
		`SELECT
      lang,
      requests_total,
      total_input_chars,
      cache_hits,
      cache_misses,
      ai_requests,
      ai_successes,
      ai_failures,
      updated_at
    FROM translation_stats
    WHERE period_type = ? AND period_key = ?`
	)
		.bind(periodType, periodKey)
		.all<any>();

	return result.results ?? [];
}

function normalizeStatsRecord(rows: any[], period: string, periodKey: string): TranslationStatsRecord {
	const languages: Record<string, number> = {};
	let updatedAt = '';
	let requestsTotal = 0;
	let totalInputChars = 0;
	let cacheHits = 0;
	let cacheMisses = 0;
	let aiRequests = 0;
	let aiSuccesses = 0;
	let aiFailures = 0;

	for (const row of rows) {
		const lang = typeof row?.lang === 'string' ? row.lang : '';
		const langRequests = safeMetricNumber(row?.requests_total);
		const langChars = safeMetricNumber(row?.total_input_chars);
		const langCacheHits = safeMetricNumber(row?.cache_hits);
		const langCacheMisses = safeMetricNumber(row?.cache_misses);
		const langAiRequests = safeMetricNumber(row?.ai_requests);
		const langAiSuccesses = safeMetricNumber(row?.ai_successes);
		const langAiFailures = safeMetricNumber(row?.ai_failures);

		if (lang.length > 0 && langRequests > 0) languages[lang] = (languages[lang] ?? 0) + langRequests;

		requestsTotal += langRequests;
		totalInputChars += langChars;
		cacheHits += langCacheHits;
		cacheMisses += langCacheMisses;
		aiRequests += langAiRequests;
		aiSuccesses += langAiSuccesses;
		aiFailures += langAiFailures;

		if (typeof row?.updated_at === 'string' && row.updated_at > updatedAt) updatedAt = row.updated_at;
	}

	return {
		period,
		periodKey,
		requestsTotal,
		totalInputChars,
		cacheHits,
		cacheMisses,
		aiRequests,
		aiSuccesses,
		aiFailures,
		languages,
		updatedAt,
	};
}

export async function checkRateLimit(env: Env, clientIp: string, requestsPerMinute: number) {
	const now = Date.now();
	const windowKey = `rate:${clientIp}:${Math.floor(now / 60000)}`;
	const updatedAt = new Date(now).toISOString();
	const expiresAt = now + 90 * 1000;
	const row = await env.STATE_DB.prepare(
		`INSERT INTO rate_limits (
      window_key,
      count,
      expires_at,
      updated_at
    ) VALUES (?, 1, ?, ?)
    ON CONFLICT(window_key) DO UPDATE SET
      count = rate_limits.count + 1,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
    RETURNING count`
	)
		.bind(windowKey, expiresAt, updatedAt)
		.first<{ count: number }>();

	const count = safeMetricNumber(row?.count);
	if (count > requestsPerMinute) return { allowed: false, remaining: 0 };

	return { allowed: true, remaining: Math.max(0, requestsPerMinute - count) };
}

export async function recordError(env: Env, entry: ErrorEntry) {
	const config = await loadConfig(env);
	const retentionSeconds = config.errorRetentionSeconds;
	const now = Date.now();
	const errorId = `error:${now.toString().padStart(13, '0')}:${crypto.randomUUID()}`;
	await env.STATE_DB.prepare(
		`INSERT INTO error_logs (
      error_id,
      level,
      code,
      message,
      details_json,
      occurred_at,
      expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
	)
		.bind(errorId, entry.level, entry.code, entry.message, JSON.stringify(entry.details ?? {}), entry.occurredAt, now + retentionSeconds * 1000)
		.run();
}

export async function listRecentErrors(env: Env, limit: number): Promise<ErrorEntry[]> {
	const result = await env.STATE_DB.prepare(
		`SELECT
      level,
      code,
      message,
      details_json,
      occurred_at
    FROM error_logs
    WHERE expires_at > ?
    ORDER BY occurred_at DESC
    LIMIT ?`
	)
		.bind(Date.now(), limit)
		.all<any>();

	return (result.results ?? []).map((row) => ({
		level: typeof row?.level === 'string' ? row.level : 'error',
		code: typeof row?.code === 'string' ? row.code : '',
		message: typeof row?.message === 'string' ? row.message : '',
		details: parseStoredJsonObject(row?.details_json),
		occurredAt: typeof row?.occurred_at === 'string' ? row.occurred_at : '',
	}));
}

export async function recordLlmRequest(env: Env, entry: LlmRequestEntry) {
	const now = Date.now();
	const requestId = `llm:${now.toString().padStart(13, '0')}:${crypto.randomUUID()}`;
	const expiresAt = now + 60 * 60 * 24 * 30 * 1000; // 30 days
	await env.STATE_DB.prepare(
		`INSERT INTO llm_request_logs (
      request_id,
      source,
      provider_mode,
      lang,
      input_chars,
      prompt_version,
      status,
      latency_ms,
      public_reason,
      input_preview,
      output_preview,
      occurred_at,
      expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	)
		.bind(
			requestId,
			entry.source,
			entry.providerMode,
			entry.lang,
			entry.inputChars,
			entry.promptVersion,
			entry.status,
			entry.latencyMs,
			entry.publicReason,
			entry.inputPreview,
			entry.outputPreview,
			entry.occurredAt,
			expiresAt
		)
		.run();
}

export async function listRecentLlmRequests(env: Env, limit: number): Promise<LlmRequestEntry[]> {
	const result = await env.STATE_DB.prepare(
		`SELECT
      source,
      provider_mode,
      lang,
      input_chars,
      prompt_version,
      status,
      latency_ms,
      public_reason,
      input_preview,
      output_preview,
      occurred_at
    FROM llm_request_logs
    WHERE expires_at > ?
    ORDER BY occurred_at DESC
    LIMIT ?`
	)
		.bind(Date.now(), limit)
		.all<any>();

	return (result.results ?? []).map((row) => ({
		source: typeof row?.source === 'string' ? row.source : 'unknown',
		providerMode: typeof row?.provider_mode === 'string' ? row.provider_mode : '',
		lang: typeof row?.lang === 'string' ? row.lang : '',
		inputChars: safeMetricNumber(row?.input_chars),
		promptVersion: safeMetricNumber(row?.prompt_version),
		status: typeof row?.status === 'string' ? row.status : 'error',
		latencyMs: safeMetricNumber(row?.latency_ms),
		publicReason: typeof row?.public_reason === 'string' ? row.public_reason : '',
		inputPreview: typeof row?.input_preview === 'string' ? row.input_preview : '',
		outputPreview: typeof row?.output_preview === 'string' ? row.output_preview : '',
		occurredAt: typeof row?.occurred_at === 'string' ? row.occurred_at : '',
	}));
}

export async function runDatabaseMaintenance(env: Env) {
	const now = Date.now();
	const db = env.STATE_DB;
	console.log(`[DB] Starting maintenance...`);
	try {
		await db.batch([
			db.prepare('DELETE FROM translation_cache WHERE cache_key IN (SELECT cache_key FROM translation_cache WHERE expires_at <= ? LIMIT ?)').bind(now, MAINTENANCE_BATCH_SIZE),
			db.prepare('DELETE FROM rate_limits WHERE window_key IN (SELECT window_key FROM rate_limits WHERE expires_at <= ? LIMIT ?)').bind(now, MAINTENANCE_BATCH_SIZE),
			db.prepare('DELETE FROM error_logs WHERE error_id IN (SELECT error_id FROM error_logs WHERE expires_at <= ? LIMIT ?)').bind(now, MAINTENANCE_BATCH_SIZE),
			db.prepare('DELETE FROM llm_request_logs WHERE request_id IN (SELECT request_id FROM llm_request_logs WHERE expires_at <= ? LIMIT ?)').bind(now, MAINTENANCE_BATCH_SIZE),
		]);
		console.log(`[DB] Maintenance completed successfully.`);
	} catch (error) {
		console.error(`[DB] Maintenance failed:`, error);
	}
}

export async function resetTranslationCache(env: Env, triggeredByUserId: string) {
	const db = env.STATE_DB;
	const countRow = await db.prepare('SELECT COUNT(*) AS count FROM translation_cache').first<{ count: number }>();
	const deletedCount = safeMetricNumber(countRow?.count);
	await db.prepare('DELETE FROM translation_cache').run();

	await recordError(env, {
		level: 'info',
		code: 'CACHE_RESET_COMPLETED',
		message: 'translation_cache のレコードを全削除しました。',
		details: { deletedCount, triggeredByUserId },
		occurredAt: new Date().toISOString(),
	});
}

export async function exportNonAiMigrationData(env: Env): Promise<NonAiMigrationData> {
	const db = env.STATE_DB;
	const [
		promotionApiConfig,
		promotionItems,
		promotionImageChunks,
		promotionPlatformCache,
		promotionPlatformCacheChunks,
		advertisementScopes,
		advertisementItems,
		advertisementImageChunks,
		advertisementPlatformCache,
		advertisementPlatformCacheChunks,
	] = await Promise.all([
		selectAllRows(db, 'SELECT config_id, include_image_in_response, updated_at FROM promotion_api_config ORDER BY config_id ASC'),
		selectAllRows(
			db,
			`SELECT
      id, item_type, title, anchor, description, link, image,
      image_pc, image_pc_width, image_pc_height, image_pc_texture_format,
      image_android, image_android_width, image_android_height, image_android_texture_format,
      image_ios, image_ios_width, image_ios_height, image_ios_texture_format,
      display_order, created_at, updated_at
    FROM promotion_list_items
    ORDER BY item_type ASC, display_order ASC, updated_at DESC, id ASC`
		),
		selectAllRows(db, 'SELECT item_id, image_kind, chunk_index, chunk_text FROM promotion_list_item_image_chunks ORDER BY item_id ASC, image_kind ASC, chunk_index ASC'),
		selectAllRows(db, 'SELECT platform, payload_bytes, payload_updated_at FROM promotion_list_platform_cache ORDER BY platform ASC'),
		selectAllRows(db, 'SELECT platform, chunk_index, chunk_text FROM promotion_list_platform_cache_chunks ORDER BY platform ASC, chunk_index ASC'),
		selectAllRows(db, 'SELECT id, scope_key, name, created_at, updated_at FROM advertisement_scopes ORDER BY scope_key ASC, id ASC'),
		selectAllRows(
			db,
			`SELECT
      id, scope_id, title, group_name, url, image,
      image_pc, image_pc_width, image_pc_height, image_pc_texture_format,
      image_android, image_android_width, image_android_height, image_android_texture_format,
      image_ios, image_ios_width, image_ios_height, image_ios_texture_format,
      display_order, created_at, updated_at
    FROM advertisement_items
    ORDER BY scope_id ASC, display_order ASC, updated_at DESC, id ASC`
		),
		selectAllRows(db, 'SELECT item_id, image_kind, chunk_index, chunk_text FROM advertisement_item_image_chunks ORDER BY item_id ASC, image_kind ASC, chunk_index ASC'),
		selectAllRows(db, 'SELECT scope_id, platform, payload_bytes, payload_updated_at FROM advertisement_platform_cache ORDER BY scope_id ASC, platform ASC'),
		selectAllRows(db, 'SELECT scope_id, platform, chunk_index, chunk_text FROM advertisement_platform_cache_chunks ORDER BY scope_id ASC, platform ASC, chunk_index ASC'),
	]);

	return {
		schemaVersion: 1,
		exportedAt: new Date().toISOString(),
		source: 'WorldAIServices',
		promotion: {
			apiConfig: promotionApiConfig,
			items: promotionItems,
			imageChunks: promotionImageChunks,
			platformCache: promotionPlatformCache,
			platformCacheChunks: promotionPlatformCacheChunks,
		},
		advertisement: {
			scopes: advertisementScopes,
			items: advertisementItems,
			imageChunks: advertisementImageChunks,
			platformCache: advertisementPlatformCache,
			platformCacheChunks: advertisementPlatformCacheChunks,
		},
	};
}

export async function importNonAiMigrationData(env: Env, data: unknown) {
	if (!isNonAiMigrationData(data)) throw new Error('invalid_migration_json');
	const db = env.STATE_DB;
	const statements: D1PreparedStatement[] = [];
	for (const row of data.promotion.apiConfig) {
		statements.push(
			db.prepare('INSERT INTO promotion_api_config (config_id, include_image_in_response, updated_at) VALUES (?, ?, ?)').bind(
				toInteger(row.config_id, 1),
				toInteger(row.include_image_in_response, 1),
				toText(row.updated_at)
			)
		);
	}
	for (const row of data.promotion.items) statements.push(buildPromotionItemInsertStatement(db, row));
	for (const row of data.promotion.imageChunks) statements.push(buildItemImageChunkInsertStatement(db, 'promotion_list_item_image_chunks', row));
	for (const row of data.promotion.platformCache) {
		statements.push(
			db.prepare('INSERT INTO promotion_list_platform_cache (platform, payload_bytes, payload_updated_at) VALUES (?, ?, ?)').bind(
				toPlatform(row.platform),
				toInteger(row.payload_bytes, 0),
				toText(row.payload_updated_at)
			)
		);
	}
	for (const row of data.promotion.platformCacheChunks) {
		statements.push(
			db.prepare('INSERT INTO promotion_list_platform_cache_chunks (platform, chunk_index, chunk_text) VALUES (?, ?, ?)').bind(
				toPlatform(row.platform),
				toInteger(row.chunk_index, 0),
				toText(row.chunk_text)
			)
		);
	}
	for (const row of data.advertisement.scopes) {
		statements.push(
			db.prepare('INSERT INTO advertisement_scopes (id, scope_key, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(
				toText(row.id),
				toText(row.scope_key),
				toText(row.name),
				toText(row.created_at),
				toText(row.updated_at)
			)
		);
	}
	for (const row of data.advertisement.items) statements.push(buildAdvertisementItemInsertStatement(db, row));
	for (const row of data.advertisement.imageChunks) statements.push(buildItemImageChunkInsertStatement(db, 'advertisement_item_image_chunks', row));
	for (const row of data.advertisement.platformCache) {
		statements.push(
			db.prepare('INSERT INTO advertisement_platform_cache (scope_id, platform, payload_bytes, payload_updated_at) VALUES (?, ?, ?, ?)').bind(
				toText(row.scope_id),
				toPlatform(row.platform),
				toInteger(row.payload_bytes, 0),
				toText(row.payload_updated_at)
			)
		);
	}
	for (const row of data.advertisement.platformCacheChunks) {
		statements.push(
			db.prepare('INSERT INTO advertisement_platform_cache_chunks (scope_id, platform, chunk_index, chunk_text) VALUES (?, ?, ?, ?)').bind(
				toText(row.scope_id),
				toPlatform(row.platform),
				toInteger(row.chunk_index, 0),
				toText(row.chunk_text)
			)
		);
	}
	await runImportBatch(db, [
		db.prepare('DELETE FROM promotion_list_item_image_chunks'),
		db.prepare('DELETE FROM promotion_list_platform_cache_chunks'),
		db.prepare('DELETE FROM promotion_list_platform_cache'),
		db.prepare('DELETE FROM promotion_list_items'),
		db.prepare('DELETE FROM promotion_api_config'),
		db.prepare('DELETE FROM advertisement_item_image_chunks'),
		db.prepare('DELETE FROM advertisement_platform_cache_chunks'),
		db.prepare('DELETE FROM advertisement_platform_cache'),
		db.prepare('DELETE FROM advertisement_items'),
		db.prepare('DELETE FROM advertisement_scopes'),
	]);
	await runImportBatch(db, statements);

	return {
		promotionItems: data.promotion.items.length,
		promotionImageChunks: data.promotion.imageChunks.length,
		advertisementScopes: data.advertisement.scopes.length,
		advertisementItems: data.advertisement.items.length,
		advertisementImageChunks: data.advertisement.imageChunks.length,
	};
}

async function selectAllRows(db: D1Database, sql: string) {
	const result = await db.prepare(sql).all<any>();
	return result.results ?? [];
}

function isNonAiMigrationData(value: any): value is NonAiMigrationData {
	return (
		value &&
		typeof value === 'object' &&
		value.schemaVersion === 1 &&
		value.source === 'WorldAIServices' &&
		hasMigrationSection(value.promotion, ['apiConfig', 'items', 'imageChunks', 'platformCache', 'platformCacheChunks']) &&
		hasMigrationSection(value.advertisement, ['scopes', 'items', 'imageChunks', 'platformCache', 'platformCacheChunks'])
	);
}

function hasMigrationSection(section: any, keys: string[]) {
	if (!section || typeof section !== 'object') return false;
	return keys.every((key) => Array.isArray(section[key]));
}

async function runImportBatch(db: D1Database, statements: D1PreparedStatement[]) {
	for (let offset = 0; offset < statements.length; offset += MIGRATION_IMPORT_BATCH_SIZE) {
		const chunk = statements.slice(offset, offset + MIGRATION_IMPORT_BATCH_SIZE);
		if (chunk.length > 0) await db.batch(chunk);
	}
}

function buildPromotionItemInsertStatement(db: D1Database, row: any) {
	return db
		.prepare(
			`INSERT INTO promotion_list_items (
      id, item_type, title, anchor, description, link, image,
      image_pc, image_pc_width, image_pc_height, image_pc_texture_format,
      image_android, image_android_width, image_android_height, image_android_texture_format,
      image_ios, image_ios_width, image_ios_height, image_ios_texture_format,
      display_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			toText(row.id),
			toPromotionItemType(row.item_type),
			toText(row.title),
			toText(row.anchor),
			toText(row.description),
			toText(row.link),
			toText(row.image),
			toText(row.image_pc),
			toInteger(row.image_pc_width, 0),
			toInteger(row.image_pc_height, 0),
			toText(row.image_pc_texture_format),
			toText(row.image_android),
			toInteger(row.image_android_width, 0),
			toInteger(row.image_android_height, 0),
			toText(row.image_android_texture_format),
			toText(row.image_ios),
			toInteger(row.image_ios_width, 0),
			toInteger(row.image_ios_height, 0),
			toText(row.image_ios_texture_format),
			toInteger(row.display_order, 0),
			toText(row.created_at),
			toText(row.updated_at)
		);
}

function buildAdvertisementItemInsertStatement(db: D1Database, row: any) {
	return db
		.prepare(
			`INSERT INTO advertisement_items (
      id, scope_id, title, group_name, url, image,
      image_pc, image_pc_width, image_pc_height, image_pc_texture_format,
      image_android, image_android_width, image_android_height, image_android_texture_format,
      image_ios, image_ios_width, image_ios_height, image_ios_texture_format,
      display_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			toText(row.id),
			toText(row.scope_id),
			toText(row.title),
			toText(row.group_name),
			toText(row.url),
			toText(row.image),
			toText(row.image_pc),
			toInteger(row.image_pc_width, 0),
			toInteger(row.image_pc_height, 0),
			toText(row.image_pc_texture_format),
			toText(row.image_android),
			toInteger(row.image_android_width, 0),
			toInteger(row.image_android_height, 0),
			toText(row.image_android_texture_format),
			toText(row.image_ios),
			toInteger(row.image_ios_width, 0),
			toInteger(row.image_ios_height, 0),
			toText(row.image_ios_texture_format),
			toInteger(row.display_order, 0),
			toText(row.created_at),
			toText(row.updated_at)
		);
}

function buildItemImageChunkInsertStatement(db: D1Database, tableName: ImageChunkTableName, row: any) {
	return db.prepare(`INSERT INTO ${tableName} (item_id, image_kind, chunk_index, chunk_text) VALUES (?, ?, ?, ?)`).bind(
		toText(row.item_id),
		toImageKind(row.image_kind),
		toInteger(row.chunk_index, 0),
		toText(row.chunk_text)
	);
}

function toText(value: any) {
	return String(value ?? '');
}

function toInteger(value: any, fallback: number) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function toPlatform(value: any): PromotionPlatform {
	const text = String(value ?? '');
	if (text === 'pc' || text === 'android' || text === 'ios') return text;
	throw new Error('invalid_platform');
}

function toImageKind(value: any): StoredImageKind {
	const text = String(value ?? '');
	if (isStoredImageKind(text)) return text;
	throw new Error('invalid_image_kind');
}

function toPromotionItemType(value: any): PromotionItemType {
	const text = String(value ?? '');
	if (text === 'Avatar' || text === 'World') return text;
	throw new Error('invalid_promotion_item_type');
}

export async function listPromotionItems(env: Env, itemType?: PromotionItemType) {
	const result =
		itemType === 'Avatar' || itemType === 'World'
			? await env.STATE_DB.prepare(
					`SELECT
      id,
      item_type,
      title,
      anchor,
      description,
      link,
      LENGTH(image) AS image_length,
      COALESCE((SELECT SUM(LENGTH(chunk_text)) FROM promotion_list_item_image_chunks WHERE item_id = promotion_list_items.id AND image_kind = 'raw'), 0) AS image_chunk_length,
      LENGTH(image_pc) AS image_pc_length,
      COALESCE((SELECT SUM(LENGTH(chunk_text)) FROM promotion_list_item_image_chunks WHERE item_id = promotion_list_items.id AND image_kind = 'pc'), 0) AS image_pc_chunk_length,
      LENGTH(image_android) AS image_android_length,
      COALESCE((SELECT SUM(LENGTH(chunk_text)) FROM promotion_list_item_image_chunks WHERE item_id = promotion_list_items.id AND image_kind = 'android'), 0) AS image_android_chunk_length,
      LENGTH(image_ios) AS image_ios_length,
      COALESCE((SELECT SUM(LENGTH(chunk_text)) FROM promotion_list_item_image_chunks WHERE item_id = promotion_list_items.id AND image_kind = 'ios'), 0) AS image_ios_chunk_length,
      updated_at,
      display_order
    FROM promotion_list_items
    WHERE item_type = ?
    ORDER BY display_order ASC, updated_at DESC, id ASC`
				)
					.bind(itemType)
					.all<any>()
			: await env.STATE_DB.prepare(
		`SELECT
      id,
      item_type,
      title,
      anchor,
      description,
      link,
      LENGTH(image) AS image_length,
      COALESCE((SELECT SUM(LENGTH(chunk_text)) FROM promotion_list_item_image_chunks WHERE item_id = promotion_list_items.id AND image_kind = 'raw'), 0) AS image_chunk_length,
      LENGTH(image_pc) AS image_pc_length,
      COALESCE((SELECT SUM(LENGTH(chunk_text)) FROM promotion_list_item_image_chunks WHERE item_id = promotion_list_items.id AND image_kind = 'pc'), 0) AS image_pc_chunk_length,
      LENGTH(image_android) AS image_android_length,
      COALESCE((SELECT SUM(LENGTH(chunk_text)) FROM promotion_list_item_image_chunks WHERE item_id = promotion_list_items.id AND image_kind = 'android'), 0) AS image_android_chunk_length,
      LENGTH(image_ios) AS image_ios_length,
      COALESCE((SELECT SUM(LENGTH(chunk_text)) FROM promotion_list_item_image_chunks WHERE item_id = promotion_list_items.id AND image_kind = 'ios'), 0) AS image_ios_chunk_length,
      updated_at,
      display_order
    FROM promotion_list_items
    ORDER BY item_type ASC, display_order ASC, updated_at DESC, id ASC`
			).all<any>();
	return (result.results ?? []).map((row) => ({
		ID: String(row.id ?? ''),
		Type: String(row.item_type ?? '') as PromotionItemType,
		Title: String(row.title ?? ''),
		Anchor: String(row.anchor ?? ''),
		Description: String(row.description ?? ''),
		Link: String(row.link ?? ''),
		Image: '',
		UpdatedAt: String(row.updated_at ?? ''),
		DisplayOrder: safeMetricNumber(row.display_order),
		ConvertedPlatforms: buildConvertedPlatformsFromRow(row),
		IsImageConverted: hasAllConvertedPlatforms(row),
		HasImage: safeMetricNumber(row.image_length) > 0 || safeMetricNumber(row.image_chunk_length) > 0,
	}));
}

export async function createPromotionItem(
	env: Env,
	itemType: PromotionItemType,
	payload: PromotionItem,
	predictedPayloadBytes: number
) {
	const current = await loadPromotionPayloadBytes(env);
	const expected = current + Math.max(0, Math.floor(predictedPayloadBytes));
	if (expected > PROMOTION_LIST_MAX_BYTES) return { ok: false as const, reason: 'payload_limit_exceeded', expectedBytes: expected };

	const now = new Date().toISOString();
	const orderRow = await env.STATE_DB.prepare(
		`SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order
    FROM promotion_list_items
    WHERE item_type = ?`
	)
		.bind(itemType)
		.first<any>();
	const nextOrder = Math.max(1, safeMetricNumber(orderRow?.next_order));
	await env.STATE_DB.prepare(
		`INSERT INTO promotion_list_items (
      id,
      item_type,
      title,
      anchor,
      description,
      link,
      image,
      image_pc,
      image_android,
      image_ios,
      display_order,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, '', '', '', '', ?, ?, ?)`
	)
		.bind(payload.ID, itemType, payload.Title, payload.Anchor, payload.Description, payload.Link, nextOrder, now, now)
		.run();
	await saveItemImageChunks(env, 'promotion_list_item_image_chunks', payload.ID, 'raw', payload.Image);

	const summary = await rebuildPromotionListCache(env);
	return { ok: true as const, summary };
}

export async function deletePromotionItem(env: Env, id: string) {
	await deleteItemImageChunks(env, 'promotion_list_item_image_chunks', id);
	await env.STATE_DB.prepare('DELETE FROM promotion_list_items WHERE id = ?').bind(id).run();
	return await rebuildPromotionListCache(env);
}

export async function updatePromotionItem(
	env: Env,
	id: string,
	itemType: PromotionItemType,
	payload: PromotionItem,
	predictedPayloadBytes: number
) {
	const current = await loadPromotionPayloadBytes(env);
	const expected = current + Math.max(0, Math.floor(predictedPayloadBytes));
	if (expected > PROMOTION_LIST_MAX_BYTES) return { ok: false as const, reason: 'payload_limit_exceeded', expectedBytes: expected };

	const currentItem = await loadPromotionItemRecordById(env, id);
	const rawImageChanged = !currentItem || currentItem.image !== payload.Image;

	await env.STATE_DB.prepare(
		`UPDATE promotion_list_items
    SET item_type = ?,
        title = ?,
        anchor = ?,
        description = ?,
        link = ?,
        image = '',
        image_pc = '',
        image_pc_width = ?,
        image_pc_height = ?,
        image_pc_texture_format = ?,
        image_android = '',
        image_android_width = ?,
        image_android_height = ?,
        image_android_texture_format = ?,
        image_ios = '',
        image_ios_width = ?,
        image_ios_height = ?,
        image_ios_texture_format = ?,
        updated_at = ?
    WHERE id = ?`
	)
		.bind(
			itemType,
			payload.Title,
			payload.Anchor,
			payload.Description,
			payload.Link,
			rawImageChanged ? 0 : safeMetricNumber(currentItem?.image_pc_width),
			rawImageChanged ? 0 : safeMetricNumber(currentItem?.image_pc_height),
			rawImageChanged ? '' : String(currentItem?.image_pc_texture_format ?? ''),
			rawImageChanged ? 0 : safeMetricNumber(currentItem?.image_android_width),
			rawImageChanged ? 0 : safeMetricNumber(currentItem?.image_android_height),
			rawImageChanged ? '' : String(currentItem?.image_android_texture_format ?? ''),
			rawImageChanged ? 0 : safeMetricNumber(currentItem?.image_ios_width),
			rawImageChanged ? 0 : safeMetricNumber(currentItem?.image_ios_height),
			rawImageChanged ? '' : String(currentItem?.image_ios_texture_format ?? ''),
			new Date().toISOString(),
			id
		)
		.run();
	if (rawImageChanged) {
		await saveItemImageChunks(env, 'promotion_list_item_image_chunks', id, 'raw', payload.Image);
		await deleteItemImageChunks(env, 'promotion_list_item_image_chunks', id, ['pc', 'android', 'ios']);
	}

	const summary = await rebuildPromotionListCache(env);
	return { ok: true as const, summary };
}

export async function movePromotionItem(env: Env, id: string, direction: 'up' | 'down') {
	const current = await env.STATE_DB.prepare(
		`SELECT id, item_type, display_order
    FROM promotion_list_items
    WHERE id = ?`
	)
		.bind(id)
		.first<any>();
	if (!current) return { ok: false as const, reason: 'not_found' };

	const comparator = direction === 'up' ? '<' : '>';
	const orderBy = direction === 'up' ? 'display_order DESC' : 'display_order ASC';
	const swapTarget = await env.STATE_DB.prepare(
		`SELECT id, display_order
    FROM promotion_list_items
    WHERE item_type = ? AND display_order ${comparator} ?
    ORDER BY ${orderBy}
    LIMIT 1`
	)
		.bind(current.item_type, current.display_order)
		.first<any>();
	if (!swapTarget) return { ok: true as const, summary: await rebuildPromotionListCache(env) };

	const now = new Date().toISOString();
	await env.STATE_DB.batch([
		env.STATE_DB.prepare('UPDATE promotion_list_items SET display_order = ?, updated_at = ? WHERE id = ?').bind(swapTarget.display_order, now, current.id),
		env.STATE_DB.prepare('UPDATE promotion_list_items SET display_order = ?, updated_at = ? WHERE id = ?').bind(current.display_order, now, swapTarget.id),
	]);

	return { ok: true as const, summary: await rebuildPromotionListCache(env) };
}

export async function reorderPromotionItems(env: Env, itemType: PromotionItemType, orderedIds: string[]) {
	const normalizedIds = orderedIds.map((id) => String(id ?? '').trim()).filter((id) => id.length > 0);
	const uniqueIds = new Set(normalizedIds);
	if (normalizedIds.length === 0 || uniqueIds.size !== normalizedIds.length) return { ok: false as const, reason: 'invalid_ids' };

	const rows = await env.STATE_DB.prepare(
		`SELECT id
    FROM promotion_list_items
    WHERE item_type = ?
    ORDER BY display_order ASC, updated_at DESC, id ASC`
	)
		.bind(itemType)
		.all<any>();
	const currentIds = (rows.results ?? []).map((row) => String(row.id ?? ''));
	if (currentIds.length !== normalizedIds.length) return { ok: false as const, reason: 'count_mismatch' };

	const currentSet = new Set(currentIds);
	for (const id of normalizedIds) if (!currentSet.has(id)) return { ok: false as const, reason: 'unknown_id' };

	const now = new Date().toISOString();
	const statements = normalizedIds.map((id, index) =>
		env.STATE_DB.prepare('UPDATE promotion_list_items SET display_order = ?, updated_at = ? WHERE id = ?').bind(index + 1, now, id)
	);
	if (statements.length > 0) await env.STATE_DB.batch(statements);

	return { ok: true as const, summary: await rebuildPromotionListCache(env) };
}

export async function getPromotionListPayload(env: Env, platform: PromotionPlatform): Promise<PromotionPayload> {
	const payloadText = await loadPromotionPlatformPayloadText(env, platform);
	if (payloadText) {
		try {
			return normalizePromotionPayload(JSON.parse(payloadText));
		} catch {
			return clonePromotionPayload(EMPTY_PROMOTION_PAYLOAD);
		}
	}

	return await loadLegacyPromotionPayload(env, platform);
}

export async function getPromotionListUsage(env: Env) {
	const usage = await loadPromotionCacheUsage(env);
	return {
		maxBytes: PROMOTION_LIST_MAX_BYTES,
		total: usage.total,
		platforms: usage.platforms,
	};
}

export function getPromotionGistPath(platform: PromotionPlatform) {
	return PROMOTION_GIST_PATHS[platform];
}

export function getAdvertisementGistPath(scopeKey: string, platform: AdvertisementPlatform) {
	return `adv_${scopeKey}_${platform}.json`;
}

export async function getPromotionPlatformPayloadText(env: Env, platform: PromotionPlatform) {
	const payloadText = await loadPromotionPlatformPayloadText(env, platform);
	if (payloadText) return payloadText;
	return JSON.stringify(await loadLegacyPromotionPayload(env, platform));
}

export async function upsertGistfsUploadRecord(env: Env, metadata: GistfsFileMetadata) {
	await env.STATE_DB.prepare(
		`INSERT INTO gistfs_uploaded_files (
      path,
      source_key,
      platform,
      raw_url,
      mime_type,
      sha256,
      size_bytes,
      uploaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      source_key = excluded.source_key,
      platform = excluded.platform,
      raw_url = excluded.raw_url,
      mime_type = excluded.mime_type,
      sha256 = excluded.sha256,
      size_bytes = excluded.size_bytes,
      uploaded_at = excluded.uploaded_at`
	)
		.bind(
			metadata.path,
			metadata.sourceKey,
			metadata.platform,
			metadata.rawUrl,
			metadata.mimeType,
			metadata.sha256,
			metadata.size,
			metadata.uploadedAt
		)
		.run();
}

export async function deleteGistfsUploadRecord(env: Env, path: string) {
	await env.STATE_DB.prepare('DELETE FROM gistfs_uploaded_files WHERE path = ?').bind(path).run();
}

export async function listGistfsUploadRecords(env: Env): Promise<GistfsFileMetadata[]> {
	const result = await env.STATE_DB.prepare(
		`SELECT
      path,
      source_key,
      platform,
      raw_url,
      mime_type,
      sha256,
      size_bytes,
      uploaded_at
    FROM gistfs_uploaded_files
    ORDER BY uploaded_at DESC, path ASC`
	).all<any>();
	return (result.results ?? []).map(normalizeGistfsUploadRow);
}

export async function getPromotionGistfsStatus(env: Env) {
	const result = await env.STATE_DB.prepare(
		`SELECT
      path,
      source_key,
      platform,
      raw_url,
      mime_type,
      sha256,
      size_bytes,
      uploaded_at
    FROM gistfs_uploaded_files
    WHERE source_key = ?
    ORDER BY uploaded_at DESC, path ASC`
	)
		.bind(PROMOTION_GIST_SOURCE_KEY)
		.all<any>();

	const records = (result.results ?? []).map(normalizeGistfsUploadRow);
	const platforms = {
		pc: null as GistfsFileMetadata | null,
		android: null as GistfsFileMetadata | null,
		ios: null as GistfsFileMetadata | null,
	};
	for (const record of records) {
		if ((record.platform === 'pc' || record.platform === 'android' || record.platform === 'ios') && !platforms[record.platform]) {
			platforms[record.platform] = record;
		}
	}
	return {
		sourceKey: PROMOTION_GIST_SOURCE_KEY,
		platforms,
	};
}

export async function rebuildPromotionListCache(env: Env, targetPlatforms: PromotionPlatform[] = PROMOTION_PLATFORMS) {
	const normalizedPlatforms = targetPlatforms.filter((platform, index, array) => PROMOTION_PLATFORMS.includes(platform) && array.indexOf(platform) === index);
	if (normalizedPlatforms.length === 0) {
		return {
			totalPayloadBytes: await loadPromotionPayloadBytes(env),
			platforms: {},
		};
	}

	const payloadBundle = await buildPromotionPayloadBundleFromItems(env, normalizedPlatforms);
	const platformPayloads = normalizedPlatforms.map((platform) => {
		const payloadText = JSON.stringify(payloadBundle[platform]);
		const payloadBytes = new TextEncoder().encode(payloadText).length;
		return {
			platform,
			payloadText,
			payloadBytes,
			chunks: splitPromotionPayload(payloadText),
		};
	});

	const currentUsage = await loadPromotionCacheUsage(env);
	let totalPayloadBytes = currentUsage.total.usedBytes;
	for (const payload of platformPayloads) {
		totalPayloadBytes -= currentUsage.platforms[payload.platform].usedBytes;
		totalPayloadBytes += payload.payloadBytes;
	}
	if (totalPayloadBytes > PROMOTION_LIST_MAX_BYTES) throw new Error('promotion_payload_limit_exceeded');

	const now = new Date().toISOString();
	const db = env.STATE_DB;
	const statements = [];
	for (const payload of platformPayloads) {
		statements.push(db.prepare('DELETE FROM promotion_list_platform_cache_chunks WHERE platform = ?').bind(payload.platform));
		for (const [chunkIndex, chunkText] of payload.chunks.entries()) {
			statements.push(
				db.prepare('INSERT INTO promotion_list_platform_cache_chunks (platform, chunk_index, chunk_text) VALUES (?, ?, ?)').bind(payload.platform, chunkIndex, chunkText)
			);
		}
		statements.push(
			db.prepare(
				`INSERT INTO promotion_list_platform_cache (
	      platform,
	      payload_bytes,
	      payload_updated_at
	    ) VALUES (?, ?, ?)
	    ON CONFLICT(platform) DO UPDATE SET
	      payload_bytes = excluded.payload_bytes,
	      payload_updated_at = excluded.payload_updated_at`
			).bind(payload.platform, payload.payloadBytes, now)
		);
	}
	if (statements.length > 0) await db.batch(statements);

	return {
		totalPayloadBytes,
		platforms: Object.fromEntries(
			platformPayloads.map((payload) => [
				payload.platform,
				{
					payloadBytes: payload.payloadBytes,
					chunkCount: payload.chunks.length,
				},
			])
		),
	};
}

async function buildPromotionPayloadBundleFromItems(env: Env, targetPlatforms: PromotionPlatform[]): Promise<PromotionPlatformPayloadBundle> {
	const result = await env.STATE_DB.prepare(
		`SELECT
      id,
      item_type,
      title,
      anchor,
      description,
      link,
      image_pc,
      image_pc_width,
      image_pc_height,
      image_pc_texture_format,
      image_android,
      image_android_width,
      image_android_height,
      image_android_texture_format,
      image_ios,
      image_ios_width,
      image_ios_height,
      image_ios_texture_format
    FROM promotion_list_items
	    ORDER BY item_type ASC, display_order ASC, updated_at DESC, id ASC`
	).all<any>();
	const payloadBundle = clonePromotionPlatformPayloadBundle(EMPTY_PROMOTION_PLATFORM_PAYLOAD_BUNDLE);
	const platformSet = new Set(targetPlatforms);
	const itemIds = (result.results ?? []).map((row) => String(row.id ?? '')).filter((id) => id.length > 0);
	const imagesByItemId = await loadItemImagesFromChunks(env, 'promotion_list_item_image_chunks', itemIds);
	for (const row of result.results ?? []) {
		const itemImages = imagesByItemId[String(row.id ?? '')] ?? {};
		const baseItem = {
			ID: String(row.id ?? ''),
			Title: String(row.title ?? ''),
			Anchor: String(row.anchor ?? ''),
			Description: String(row.description ?? ''),
			Link: String(row.link ?? ''),
		};
		const type = String(row.item_type ?? '');
		if (type !== 'Avatar' && type !== 'World') continue;
		if (platformSet.has('pc')) {
			payloadBundle.pc[type].push({
				...baseItem,
				Image: itemImages.pc || String(row.image_pc ?? ''),
				ImageWidth: safeMetricNumber(row.image_pc_width),
				ImageHeight: safeMetricNumber(row.image_pc_height),
				ImageTextureFormat: String(row.image_pc_texture_format ?? ''),
			});
		}
		if (platformSet.has('android')) {
			payloadBundle.android[type].push({
				...baseItem,
				Image: itemImages.android || String(row.image_android ?? ''),
				ImageWidth: safeMetricNumber(row.image_android_width),
				ImageHeight: safeMetricNumber(row.image_android_height),
				ImageTextureFormat: String(row.image_android_texture_format ?? ''),
			});
		}
		if (platformSet.has('ios')) {
			payloadBundle.ios[type].push({
				...baseItem,
				Image: itemImages.ios || String(row.image_ios ?? ''),
				ImageWidth: safeMetricNumber(row.image_ios_width),
				ImageHeight: safeMetricNumber(row.image_ios_height),
				ImageTextureFormat: String(row.image_ios_texture_format ?? ''),
			});
		}
	}
	return payloadBundle;
}

async function loadPromotionPlatformPayloadText(env: Env, platform: PromotionPlatform) {
	const result = await env.STATE_DB.prepare(
		`SELECT chunk_text
    FROM promotion_list_platform_cache_chunks
    WHERE platform = ?
    ORDER BY chunk_index ASC`
	)
		.bind(platform)
		.all<any>();
	const chunks = (result.results ?? []).map((row) => String(row.chunk_text ?? ''));
	return chunks.length > 0 ? chunks.join('') : '';
}

async function loadLegacyPromotionPayload(env: Env, platform: PromotionPlatform): Promise<PromotionPayload> {
	const payloadText = await loadLegacyPromotionPayloadText(env);
	if (!payloadText) return clonePromotionPayload(EMPTY_PROMOTION_PAYLOAD);
	try {
		const parsed = JSON.parse(payloadText);
		if (!parsed || typeof parsed !== 'object') return clonePromotionPayload(EMPTY_PROMOTION_PAYLOAD);
		return normalizePromotionPayload((parsed as any)[platform]);
	} catch {
		return clonePromotionPayload(EMPTY_PROMOTION_PAYLOAD);
	}
}

async function loadLegacyPromotionPayloadText(env: Env) {
	const result = await env.STATE_DB.prepare(
		`SELECT chunk_text
    FROM promotion_list_cache_chunks
    ORDER BY chunk_index ASC`
	).all<any>();
	const chunks = (result.results ?? []).map((row) => String(row.chunk_text ?? ''));
	return chunks.length > 0 ? chunks.join('') : '';
}

async function loadPromotionPayloadBytes(env: Env) {
	const usage = await loadPromotionCacheUsage(env);
	return usage.total.usedBytes;
}

function splitPromotionPayload(payloadText: string) {
	if (payloadText.length <= PROMOTION_LIST_CHUNK_SIZE) return [payloadText];
	const chunks: string[] = [];
	for (let index = 0; index < payloadText.length; index += PROMOTION_LIST_CHUNK_SIZE) {
		chunks.push(payloadText.slice(index, index + PROMOTION_LIST_CHUNK_SIZE));
	}
	return chunks;
}

async function loadPromotionCacheUsage(env: Env) {
	const defaultUsage = {
		total: buildUsageEntry(0),
		platforms: {
			pc: buildUsageEntry(0),
			android: buildUsageEntry(0),
			ios: buildUsageEntry(0),
		},
	};
	const result = await env.STATE_DB.prepare(
		`SELECT
      platform,
      payload_bytes
    FROM promotion_list_platform_cache`
	).all<any>();
	if ((result.results ?? []).length === 0) return await measureLegacyPromotionPayloadUsage(env);

	let totalBytes = 0;
	for (const row of result.results ?? []) {
		const platform = String(row.platform ?? '') as PromotionPlatform;
		if (!PROMOTION_PLATFORMS.includes(platform)) continue;
		const bytes = safeMetricNumber(row.payload_bytes);
		defaultUsage.platforms[platform] = buildUsageEntry(bytes);
		totalBytes += bytes;
	}
	defaultUsage.total = buildUsageEntry(totalBytes);
	return defaultUsage;
}

async function measureLegacyPromotionPayloadUsage(env: Env) {
	const payloadText = await loadLegacyPromotionPayloadText(env);
	if (!payloadText) {
		return {
			total: buildUsageEntry(0),
			platforms: {
				pc: buildUsageEntry(0),
				android: buildUsageEntry(0),
				ios: buildUsageEntry(0),
			},
		};
	}
	try {
		const parsed = JSON.parse(payloadText);
		if (!parsed || typeof parsed !== 'object') throw new Error('invalid_legacy_payload');
		const platformPayloads = {
			pc: JSON.stringify((parsed as any).pc ?? EMPTY_PROMOTION_PAYLOAD),
			android: JSON.stringify((parsed as any).android ?? EMPTY_PROMOTION_PAYLOAD),
			ios: JSON.stringify((parsed as any).ios ?? EMPTY_PROMOTION_PAYLOAD),
		};
		const pcBytes = new TextEncoder().encode(platformPayloads.pc).length;
		const androidBytes = new TextEncoder().encode(platformPayloads.android).length;
		const iosBytes = new TextEncoder().encode(platformPayloads.ios).length;
		return {
			total: buildUsageEntry(pcBytes + androidBytes + iosBytes),
			platforms: {
				pc: buildUsageEntry(pcBytes),
				android: buildUsageEntry(androidBytes),
				ios: buildUsageEntry(iosBytes),
			},
		};
	} catch {
		return {
			total: buildUsageEntry(0),
			platforms: {
				pc: buildUsageEntry(0),
				android: buildUsageEntry(0),
				ios: buildUsageEntry(0),
			},
		};
	}
}

function buildUsageEntry(bytes: number) {
	return {
		usedBytes: bytes,
		usedPercent: Math.min(100, Number(((bytes / PROMOTION_LIST_MAX_BYTES) * 100).toFixed(2))),
	};
}

function normalizeGistfsUploadRow(row: any): GistfsFileMetadata {
	const platform = String(row?.platform ?? '').trim();
	return {
		path: String(row?.path ?? ''),
		sourceKey: String(row?.source_key ?? ''),
		platform: platform === 'pc' || platform === 'android' || platform === 'ios' ? platform : '',
		rawUrl: String(row?.raw_url ?? ''),
		mimeType: String(row?.mime_type ?? ''),
		sha256: String(row?.sha256 ?? ''),
		size: safeMetricNumber(row?.size_bytes),
		uploadedAt: String(row?.uploaded_at ?? ''),
	};
}

function normalizePromotionPayload(value: any): PromotionPayload {
	if (!value || typeof value !== 'object') return clonePromotionPayload(EMPTY_PROMOTION_PAYLOAD);
	return {
		Avatar: Array.isArray(value.Avatar) ? value.Avatar : [],
		World: Array.isArray(value.World) ? value.World : [],
	};
}

function clonePromotionPayload(payload: PromotionPayload): PromotionPayload {
	return {
		Avatar: payload.Avatar.slice(),
		World: payload.World.slice(),
	};
}

function clonePromotionPlatformPayloadBundle(payloadBundle: PromotionPlatformPayloadBundle): PromotionPlatformPayloadBundle {
	return {
		pc: clonePromotionPayload(payloadBundle.pc),
		android: clonePromotionPayload(payloadBundle.android),
		ios: clonePromotionPayload(payloadBundle.ios),
	};
}

function buildConvertedPlatformsFromRow(row: any): PromotionPlatform[] {
	const platforms: PromotionPlatform[] = [];
	if (safeMetricNumber(row?.image_pc_length) > 0 || safeMetricNumber(row?.image_pc_chunk_length) > 0) platforms.push('pc');
	if (safeMetricNumber(row?.image_android_length) > 0 || safeMetricNumber(row?.image_android_chunk_length) > 0) platforms.push('android');
	if (safeMetricNumber(row?.image_ios_length) > 0 || safeMetricNumber(row?.image_ios_chunk_length) > 0) platforms.push('ios');
	return platforms;
}

function hasAllConvertedPlatforms(row: any) {
	return buildConvertedPlatformsFromRow(row).length === 3;
}

async function loadPromotionItemRecordById(env: Env, id: string) {
	const row = await env.STATE_DB.prepare(
		`SELECT
      id,
      item_type,
      title,
      anchor,
      description,
      link,
      image,
      image_pc,
      image_pc_width,
      image_pc_height,
      image_pc_texture_format,
      image_android,
      image_android_width,
      image_android_height,
      image_android_texture_format,
      image_ios,
      image_ios_width,
      image_ios_height,
      image_ios_texture_format,
      updated_at,
      display_order
    FROM promotion_list_items
    WHERE id = ?`
	)
		.bind(id)
		.first<any>();
	if (!row) return null;
	const images = await loadItemImagesFromChunks(env, 'promotion_list_item_image_chunks', [id]);
	const itemImages = images[id] ?? {};
	return {
		...row,
		image: itemImages.raw || String(row.image ?? ''),
		image_pc: itemImages.pc || String(row.image_pc ?? ''),
		image_android: itemImages.android || String(row.image_android ?? ''),
		image_ios: itemImages.ios || String(row.image_ios ?? ''),
	};
}

export async function getPromotionItemById(env: Env, id: string) {
	const row = await loadPromotionItemRecordById(env, id);
	if (!row) return null;
	return {
		ID: String(row.id ?? ''),
		Type: String(row.item_type ?? '') as PromotionItemType,
		Title: String(row.title ?? ''),
		Anchor: String(row.anchor ?? ''),
		Description: String(row.description ?? ''),
		Link: String(row.link ?? ''),
		Image: String(row.image ?? ''),
		UpdatedAt: String(row.updated_at ?? ''),
		DisplayOrder: safeMetricNumber(row.display_order),
		ConvertedPlatforms: buildConvertedPlatformsFromRow({
			image_pc_length: String(row.image_pc ?? '').length,
			image_android_length: String(row.image_android ?? '').length,
			image_ios_length: String(row.image_ios ?? '').length,
		}),
		IsImageConverted: !!String(row.image ?? '').trim() && String(row.image_pc ?? '').length > 0 && String(row.image_android ?? '').length > 0 && String(row.image_ios ?? '').length > 0,
	};
}

export async function savePromotionPlatformImage(
	env: Env,
	id: string,
	platform: PromotionPlatform,
	convertedImageBase64: string,
	imageWidth: number,
	imageHeight: number,
	textureFormat: string
) {
	const columnNameByPlatform = {
		pc: {
			image: 'image_pc',
			width: 'image_pc_width',
			height: 'image_pc_height',
			textureFormat: 'image_pc_texture_format',
		},
		android: {
			image: 'image_android',
			width: 'image_android_width',
			height: 'image_android_height',
			textureFormat: 'image_android_texture_format',
		},
		ios: {
			image: 'image_ios',
			width: 'image_ios_width',
			height: 'image_ios_height',
			textureFormat: 'image_ios_texture_format',
		},
	};
	const columnNames = columnNameByPlatform[platform];
	await env.STATE_DB.prepare(
		`UPDATE promotion_list_items
    SET ${columnNames.image} = '',
        ${columnNames.width} = ?,
        ${columnNames.height} = ?,
        ${columnNames.textureFormat} = ?,
        updated_at = ?
    WHERE id = ?`
	)
		.bind(imageWidth, imageHeight, textureFormat, new Date().toISOString(), id)
		.run();
	await saveItemImageChunks(env, 'promotion_list_item_image_chunks', id, platform, convertedImageBase64);
	return await rebuildPromotionListCache(env, [platform]);
}

export async function clearPromotionPlatformImages(env: Env, id: string) {
	await env.STATE_DB.prepare(
		`UPDATE promotion_list_items
    SET image_pc = '',
        image_pc_width = 0,
        image_pc_height = 0,
        image_pc_texture_format = '',
        image_android = '',
        image_android_width = 0,
        image_android_height = 0,
        image_android_texture_format = '',
        image_ios = '',
        image_ios_width = 0,
        image_ios_height = 0,
        image_ios_texture_format = '',
        updated_at = ?
    WHERE id = ?`
	)
		.bind(new Date().toISOString(), id)
		.run();
	await deleteItemImageChunks(env, 'promotion_list_item_image_chunks', id, ['pc', 'android', 'ios']);
	return await rebuildPromotionListCache(env);
}

export async function getPromotionPlatformBinary(env: Env, id: string, platform: PromotionPlatform) {
	const row = await loadPromotionItemRecordById(env, id);
	if (!row) return null;
	const mapping = {
		pc: {
			image: String(row.image_pc ?? ''),
			width: safeMetricNumber(row.image_pc_width),
			height: safeMetricNumber(row.image_pc_height),
			textureFormat: String(row.image_pc_texture_format ?? ''),
			contentType: 'application/octet-stream',
			extension: 'crn',
		},
		android: {
			image: String(row.image_android ?? ''),
			width: safeMetricNumber(row.image_android_width),
			height: safeMetricNumber(row.image_android_height),
			textureFormat: String(row.image_android_texture_format ?? ''),
			contentType: 'image/ktx',
			extension: 'ktx',
		},
		ios: {
			image: String(row.image_ios ?? ''),
			width: safeMetricNumber(row.image_ios_width),
			height: safeMetricNumber(row.image_ios_height),
			textureFormat: String(row.image_ios_texture_format ?? ''),
			contentType: 'image/ktx',
			extension: 'ktx',
		},
	};
	const target = mapping[platform];
	if (!target.image) return null;
	return {
		id: String(row.id ?? ''),
		platform,
		base64: target.image,
		width: target.width,
		height: target.height,
		textureFormat: target.textureFormat,
		contentType: target.contentType,
		extension: target.extension,
	};
}

export async function listAdvertisementScopes(env: Env): Promise<AdvertisementScope[]> {
	const result = await env.STATE_DB.prepare(
		`SELECT id, scope_key, name, updated_at
    FROM advertisement_scopes
    ORDER BY scope_key ASC`
	).all<any>();
	return (result.results ?? []).map((row) => ({
		ID: String(row.id ?? ''),
		ScopeKey: String(row.scope_key ?? ''),
		Name: String(row.name ?? ''),
		UpdatedAt: String(row.updated_at ?? ''),
	}));
}

export async function createAdvertisementScope(env: Env, scopeKey: string, name: string) {
	const normalizedScopeKey = normalizeAdvertisementScopeKey(scopeKey);
	if (!normalizedScopeKey) throw new Error('advertisement_scope_key_invalid');
	const now = new Date().toISOString();
	const id = crypto.randomUUID();
	await env.STATE_DB.prepare(
		`INSERT INTO advertisement_scopes (id, scope_key, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)`
	)
		.bind(id, normalizedScopeKey, name.trim(), now, now)
		.run();
	await rebuildAdvertisementCache(env, [id]);
	return {
		ID: id,
		ScopeKey: normalizedScopeKey,
		Name: name.trim(),
		UpdatedAt: now,
	} satisfies AdvertisementScope;
}

export async function updateAdvertisementScope(env: Env, id: string, name: string) {
	const now = new Date().toISOString();
	await env.STATE_DB.prepare('UPDATE advertisement_scopes SET name = ?, updated_at = ? WHERE id = ?').bind(name.trim(), now, id).run();
	await rebuildAdvertisementCache(env, [id]);
	const scope = await getAdvertisementScopeById(env, id);
	if (!scope) throw new Error('not_found');
	return scope;
}

export async function deleteAdvertisementScope(env: Env, id: string) {
	await env.STATE_DB.prepare(
		`DELETE FROM advertisement_item_image_chunks
    WHERE item_id IN (SELECT id FROM advertisement_items WHERE scope_id = ?)`
	)
		.bind(id)
		.run();
	await env.STATE_DB.batch([
		env.STATE_DB.prepare('DELETE FROM advertisement_platform_cache_chunks WHERE scope_id = ?').bind(id),
		env.STATE_DB.prepare('DELETE FROM advertisement_platform_cache WHERE scope_id = ?').bind(id),
		env.STATE_DB.prepare('DELETE FROM advertisement_items WHERE scope_id = ?').bind(id),
		env.STATE_DB.prepare('DELETE FROM advertisement_scopes WHERE id = ?').bind(id),
	]);
}

export async function getAdvertisementScopeById(env: Env, id: string): Promise<AdvertisementScope | null> {
	const row = await env.STATE_DB.prepare('SELECT id, scope_key, name, updated_at FROM advertisement_scopes WHERE id = ?').bind(id).first<any>();
	if (!row) return null;
	return {
		ID: String(row.id ?? ''),
		ScopeKey: String(row.scope_key ?? ''),
		Name: String(row.name ?? ''),
		UpdatedAt: String(row.updated_at ?? ''),
	};
}

export async function listAdvertisementItems(env: Env, scopeId: string): Promise<AdvertisementItem[]> {
	const result = await env.STATE_DB.prepare(
		`SELECT
      id,
      title,
      group_name,
      url,
      LENGTH(image) AS image_length,
      COALESCE((SELECT SUM(LENGTH(chunk_text)) FROM advertisement_item_image_chunks WHERE item_id = advertisement_items.id AND image_kind = 'raw'), 0) AS image_chunk_length,
      LENGTH(image_pc) AS image_pc_length,
      COALESCE((SELECT SUM(LENGTH(chunk_text)) FROM advertisement_item_image_chunks WHERE item_id = advertisement_items.id AND image_kind = 'pc'), 0) AS image_pc_chunk_length,
      LENGTH(image_android) AS image_android_length,
      COALESCE((SELECT SUM(LENGTH(chunk_text)) FROM advertisement_item_image_chunks WHERE item_id = advertisement_items.id AND image_kind = 'android'), 0) AS image_android_chunk_length,
      LENGTH(image_ios) AS image_ios_length,
      COALESCE((SELECT SUM(LENGTH(chunk_text)) FROM advertisement_item_image_chunks WHERE item_id = advertisement_items.id AND image_kind = 'ios'), 0) AS image_ios_chunk_length,
      updated_at,
      display_order
    FROM advertisement_items
    WHERE scope_id = ?
    ORDER BY display_order ASC, updated_at DESC, id ASC`
	)
		.bind(scopeId)
		.all<any>();
	return (result.results ?? []).map((row) => ({
		ID: String(row.id ?? ''),
		Title: String(row.title ?? ''),
		Group: String(row.group_name ?? ''),
		URL: String(row.url ?? ''),
		Image: '',
		UpdatedAt: String(row.updated_at ?? ''),
		DisplayOrder: safeMetricNumber(row.display_order),
		ConvertedPlatforms: buildConvertedPlatformsFromRow(row),
		IsImageConverted: hasAllConvertedPlatforms(row),
		HasImage: safeMetricNumber(row.image_length) > 0 || safeMetricNumber(row.image_chunk_length) > 0,
	}));
}

export async function createAdvertisementItem(env: Env, scopeId: string, payload: AdvertisementItem, predictedPayloadBytes: number) {
	const current = await loadAdvertisementPayloadBytes(env);
	const expected = current + Math.max(0, Math.floor(predictedPayloadBytes));
	if (expected > ADVERTISEMENT_LIST_MAX_BYTES) return { ok: false as const, reason: 'payload_limit_exceeded', expectedBytes: expected };
	const now = new Date().toISOString();
	const id = crypto.randomUUID();
	const orderRow = await env.STATE_DB.prepare(
		`SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order
    FROM advertisement_items
    WHERE scope_id = ?`
	)
		.bind(scopeId)
		.first<any>();
	const nextOrder = Math.max(1, safeMetricNumber(orderRow?.next_order));
	await env.STATE_DB.prepare(
		`INSERT INTO advertisement_items (
      id, scope_id, title, group_name, url, image, image_pc, image_android, image_ios, display_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, '', '', '', ?, ?, ?)`
	)
		.bind(id, scopeId, payload.Title.trim(), String(payload.Group ?? '').trim(), payload.URL.trim(), '', nextOrder, now, now)
		.run();
	await saveItemImageChunks(env, 'advertisement_item_image_chunks', id, 'raw', payload.Image.trim());
	const summary = await rebuildAdvertisementCache(env, [scopeId]);
	return { ok: true as const, summary, id };
}

export async function updateAdvertisementItem(env: Env, id: string, payload: AdvertisementItem, predictedPayloadBytes: number) {
	const current = await loadAdvertisementPayloadBytes(env);
	const expected = current + Math.max(0, Math.floor(predictedPayloadBytes));
	if (expected > ADVERTISEMENT_LIST_MAX_BYTES) return { ok: false as const, reason: 'payload_limit_exceeded', expectedBytes: expected };
	const currentItem = await loadAdvertisementItemRecordById(env, id);
	if (!currentItem) return { ok: false as const, reason: 'not_found' };
	const rawImageChanged = currentItem.image !== payload.Image;
	await env.STATE_DB.prepare(
		`UPDATE advertisement_items
    SET title = ?,
        group_name = ?,
        url = ?,
        image = '',
        image_pc = ?,
        image_pc_width = ?,
        image_pc_height = ?,
        image_pc_texture_format = ?,
        image_android = ?,
        image_android_width = ?,
        image_android_height = ?,
        image_android_texture_format = ?,
        image_ios = ?,
        image_ios_width = ?,
        image_ios_height = ?,
        image_ios_texture_format = ?,
        updated_at = ?
    WHERE id = ?`
	)
		.bind(
			payload.Title.trim(),
			String(payload.Group ?? '').trim(),
			payload.URL.trim(),
			rawImageChanged ? '' : String(currentItem.image_pc ?? ''),
			rawImageChanged ? 0 : safeMetricNumber(currentItem.image_pc_width),
			rawImageChanged ? 0 : safeMetricNumber(currentItem.image_pc_height),
			rawImageChanged ? '' : String(currentItem.image_pc_texture_format ?? ''),
			rawImageChanged ? '' : String(currentItem.image_android ?? ''),
			rawImageChanged ? 0 : safeMetricNumber(currentItem.image_android_width),
			rawImageChanged ? 0 : safeMetricNumber(currentItem.image_android_height),
			rawImageChanged ? '' : String(currentItem.image_android_texture_format ?? ''),
			rawImageChanged ? '' : String(currentItem.image_ios ?? ''),
			rawImageChanged ? 0 : safeMetricNumber(currentItem.image_ios_width),
			rawImageChanged ? 0 : safeMetricNumber(currentItem.image_ios_height),
			rawImageChanged ? '' : String(currentItem.image_ios_texture_format ?? ''),
			new Date().toISOString(),
			id
		)
		.run();
	if (rawImageChanged) {
		await saveItemImageChunks(env, 'advertisement_item_image_chunks', id, 'raw', payload.Image.trim());
		await deleteItemImageChunks(env, 'advertisement_item_image_chunks', id, ['pc', 'android', 'ios']);
	}
	const summary = await rebuildAdvertisementCache(env, [String(currentItem.scope_id ?? '')]);
	return { ok: true as const, summary };
}

export async function deleteAdvertisementItem(env: Env, id: string) {
	const currentItem = await loadAdvertisementItemRecordById(env, id);
	if (!currentItem) return;
	await deleteItemImageChunks(env, 'advertisement_item_image_chunks', id);
	await env.STATE_DB.prepare('DELETE FROM advertisement_items WHERE id = ?').bind(id).run();
	await rebuildAdvertisementCache(env, [String(currentItem.scope_id ?? '')]);
}

export async function reorderAdvertisementItems(env: Env, scopeId: string, orderedIds: string[]) {
	const normalizedIds = orderedIds.map((id) => String(id ?? '').trim()).filter((id) => id.length > 0);
	const uniqueIds = new Set(normalizedIds);
	if (normalizedIds.length === 0 || uniqueIds.size !== normalizedIds.length) return { ok: false as const, reason: 'invalid_ids' };
	const rows = await env.STATE_DB.prepare(
		`SELECT id
    FROM advertisement_items
    WHERE scope_id = ?
    ORDER BY display_order ASC, updated_at DESC, id ASC`
	)
		.bind(scopeId)
		.all<any>();
	const currentIds = (rows.results ?? []).map((row) => String(row.id ?? ''));
	if (currentIds.length !== normalizedIds.length) return { ok: false as const, reason: 'count_mismatch' };
	const currentSet = new Set(currentIds);
	for (const id of normalizedIds) if (!currentSet.has(id)) return { ok: false as const, reason: 'unknown_id' };
	const now = new Date().toISOString();
	const statements = normalizedIds.map((itemId, index) =>
		env.STATE_DB.prepare('UPDATE advertisement_items SET display_order = ?, updated_at = ? WHERE id = ?').bind(index + 1, now, itemId)
	);
	if (statements.length > 0) await env.STATE_DB.batch(statements);
	return { ok: true as const, summary: await rebuildAdvertisementCache(env, [scopeId]) };
}

export async function getAdvertisementItemById(env: Env, id: string): Promise<AdvertisementItem | null> {
	const row = await loadAdvertisementItemRecordById(env, id);
	if (!row) return null;
	return {
		ID: String(row.id ?? ''),
		ScopeID: String(row.scope_id ?? ''),
		Title: String(row.title ?? ''),
		Group: String(row.group_name ?? ''),
		URL: String(row.url ?? ''),
		Image: String(row.image ?? ''),
		UpdatedAt: String(row.updated_at ?? ''),
		DisplayOrder: safeMetricNumber(row.display_order),
		ConvertedPlatforms: buildConvertedPlatformsFromRow({
			image_pc_length: String(row.image_pc ?? '').length,
			image_android_length: String(row.image_android ?? '').length,
			image_ios_length: String(row.image_ios ?? '').length,
		}),
		IsImageConverted: !!String(row.image ?? '').trim() && String(row.image_pc ?? '').length > 0 && String(row.image_android ?? '').length > 0 && String(row.image_ios ?? '').length > 0,
	};
}

export async function saveAdvertisementPlatformImage(
	env: Env,
	id: string,
	platform: AdvertisementPlatform,
	convertedImageBase64: string,
	imageWidth: number,
	imageHeight: number,
	textureFormat: string
) {
	const columnNameByPlatform = {
		pc: { image: 'image_pc', width: 'image_pc_width', height: 'image_pc_height', textureFormat: 'image_pc_texture_format' },
		android: { image: 'image_android', width: 'image_android_width', height: 'image_android_height', textureFormat: 'image_android_texture_format' },
		ios: { image: 'image_ios', width: 'image_ios_width', height: 'image_ios_height', textureFormat: 'image_ios_texture_format' },
	};
	const currentItem = await loadAdvertisementItemRecordById(env, id);
	if (!currentItem) throw new Error('not_found');
	const columnNames = columnNameByPlatform[platform];
	await env.STATE_DB.prepare(
		`UPDATE advertisement_items
    SET ${columnNames.image} = '',
        ${columnNames.width} = ?,
        ${columnNames.height} = ?,
        ${columnNames.textureFormat} = ?,
        updated_at = ?
    WHERE id = ?`
	)
		.bind(imageWidth, imageHeight, textureFormat, new Date().toISOString(), id)
		.run();
	await saveItemImageChunks(env, 'advertisement_item_image_chunks', id, platform, convertedImageBase64);
	return await rebuildAdvertisementCache(env, [String(currentItem.scope_id ?? '')], [platform]);
}

export async function clearAdvertisementPlatformImages(env: Env, id: string) {
	const currentItem = await loadAdvertisementItemRecordById(env, id);
	if (!currentItem) throw new Error('not_found');
	await env.STATE_DB.prepare(
		`UPDATE advertisement_items
    SET image_pc = '',
        image_pc_width = 0,
        image_pc_height = 0,
        image_pc_texture_format = '',
        image_android = '',
        image_android_width = 0,
        image_android_height = 0,
        image_android_texture_format = '',
        image_ios = '',
        image_ios_width = 0,
        image_ios_height = 0,
        image_ios_texture_format = '',
        updated_at = ?
    WHERE id = ?`
	)
		.bind(new Date().toISOString(), id)
		.run();
	await deleteItemImageChunks(env, 'advertisement_item_image_chunks', id, ['pc', 'android', 'ios']);
	return await rebuildAdvertisementCache(env, [String(currentItem.scope_id ?? '')]);
}

export async function getAdvertisementPlatformBinary(env: Env, id: string, platform: AdvertisementPlatform) {
	const row = await loadAdvertisementItemRecordById(env, id);
	if (!row) return null;
	const mapping = {
		pc: { image: String(row.image_pc ?? ''), width: safeMetricNumber(row.image_pc_width), height: safeMetricNumber(row.image_pc_height), textureFormat: String(row.image_pc_texture_format ?? ''), contentType: 'application/octet-stream', extension: 'crn' },
		android: { image: String(row.image_android ?? ''), width: safeMetricNumber(row.image_android_width), height: safeMetricNumber(row.image_android_height), textureFormat: String(row.image_android_texture_format ?? ''), contentType: 'image/ktx', extension: 'ktx' },
		ios: { image: String(row.image_ios ?? ''), width: safeMetricNumber(row.image_ios_width), height: safeMetricNumber(row.image_ios_height), textureFormat: String(row.image_ios_texture_format ?? ''), contentType: 'image/ktx', extension: 'ktx' },
	};
	const target = mapping[platform];
	if (!target.image) return null;
	return {
		id: String(row.id ?? ''),
		platform,
		base64: target.image,
		width: target.width,
		height: target.height,
		textureFormat: target.textureFormat,
		contentType: target.contentType,
		extension: target.extension,
	};
}

export async function getAdvertisementUsage(env: Env) {
	const usage = await loadAdvertisementCacheUsage(env);
	return {
		maxBytes: ADVERTISEMENT_LIST_MAX_BYTES,
		total: usage.total,
		platforms: usage.platforms,
	};
}

export async function getAdvertisementPlatformPayloadText(env: Env, scopeId: string, platform: AdvertisementPlatform) {
	const payloadText = await loadAdvertisementPlatformPayloadText(env, scopeId, platform);
	if (payloadText) return payloadText;
	return JSON.stringify(buildEmptyAdvertisementPayload());
}

export async function rebuildAdvertisementCache(
	env: Env,
	targetScopeIds: string[],
	targetPlatforms: AdvertisementPlatform[] = ADVERTISEMENT_PLATFORMS
) {
	const normalizedScopeIds = targetScopeIds.map((id) => String(id ?? '').trim()).filter((id) => id.length > 0);
	const normalizedPlatforms = targetPlatforms.filter((platform, index, array) => ADVERTISEMENT_PLATFORMS.includes(platform) && array.indexOf(platform) === index);
	if (normalizedScopeIds.length === 0 || normalizedPlatforms.length === 0) {
		return {
			totalPayloadBytes: await loadAdvertisementPayloadBytes(env),
			platforms: {},
		};
	}
	const scopePayloads = await buildAdvertisementPayloadsForScopes(env, normalizedScopeIds, normalizedPlatforms);
	const currentUsage = await loadAdvertisementCacheUsage(env);
	let totalPayloadBytes = currentUsage.total.usedBytes;
	for (const payload of scopePayloads) {
		totalPayloadBytes -= currentUsage.byScopePlatform[`${payload.scopeId}:${payload.platform}`] ?? 0;
		totalPayloadBytes += payload.payloadBytes;
	}
	if (totalPayloadBytes > ADVERTISEMENT_LIST_MAX_BYTES) throw new Error('advertisement_payload_limit_exceeded');
	const now = new Date().toISOString();
	const statements = [];
	for (const payload of scopePayloads) {
		statements.push(env.STATE_DB.prepare('DELETE FROM advertisement_platform_cache_chunks WHERE scope_id = ? AND platform = ?').bind(payload.scopeId, payload.platform));
		for (const [chunkIndex, chunkText] of payload.chunks.entries()) {
			statements.push(
				env.STATE_DB.prepare('INSERT INTO advertisement_platform_cache_chunks (scope_id, platform, chunk_index, chunk_text) VALUES (?, ?, ?, ?)').bind(
					payload.scopeId,
					payload.platform,
					chunkIndex,
					chunkText
				)
			);
		}
		statements.push(
			env.STATE_DB.prepare(
				`INSERT INTO advertisement_platform_cache (scope_id, platform, payload_bytes, payload_updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(scope_id, platform) DO UPDATE SET
          payload_bytes = excluded.payload_bytes,
          payload_updated_at = excluded.payload_updated_at`
			).bind(payload.scopeId, payload.platform, payload.payloadBytes, now)
		);
	}
	if (statements.length > 0) await env.STATE_DB.batch(statements);
	return {
		totalPayloadBytes,
		platforms: Object.fromEntries(scopePayloads.map((payload) => [`${payload.scopeId}:${payload.platform}`, { payloadBytes: payload.payloadBytes, chunkCount: payload.chunks.length }])),
	};
}

async function buildAdvertisementPayloadsForScopes(env: Env, scopeIds: string[], targetPlatforms: AdvertisementPlatform[]) {
	const validScopes = (await Promise.all(scopeIds.map(async (scopeId) => await getAdvertisementScopeById(env, scopeId)))).filter(Boolean) as AdvertisementScope[];
	const scopeIdSet = new Set(validScopes.map((scope) => scope.ID));
	if (scopeIdSet.size === 0) return [];
	const rows = await env.STATE_DB.prepare(
		`SELECT
      id, scope_id, title, group_name, url,
      image_pc, image_pc_width, image_pc_height, image_pc_texture_format,
      image_android, image_android_width, image_android_height, image_android_texture_format,
      image_ios, image_ios_width, image_ios_height, image_ios_texture_format
    FROM advertisement_items
    WHERE scope_id IN (${scopeIds.map(() => '?').join(', ')})
    ORDER BY scope_id ASC, display_order ASC, updated_at DESC, id ASC`
	)
		.bind(...scopeIds)
		.all<any>();
	const itemIds = (rows.results ?? []).map((row) => String(row.id ?? '')).filter((id) => id.length > 0);
	const imagesByItemId = await loadItemImagesFromChunks(env, 'advertisement_item_image_chunks', itemIds);
	const payloadByScopePlatform = new Map<string, AdvertisementExportItem[]>();
	for (const scope of validScopes) {
		for (const platform of targetPlatforms) payloadByScopePlatform.set(`${scope.ID}:${platform}`, buildEmptyAdvertisementPayload());
	}
	for (const row of rows.results ?? []) {
		const scopeId = String(row.scope_id ?? '');
		if (!scopeIdSet.has(scopeId)) continue;
		const itemImages = imagesByItemId[String(row.id ?? '')] ?? {};
		for (const platform of targetPlatforms) {
			const targetPayload = payloadByScopePlatform.get(`${scopeId}:${platform}`);
			if (!targetPayload) continue;
			targetPayload.push({
				Title: String(row.title ?? ''),
				Group: String(row.group_name ?? ''),
				Link: String(row.url ?? ''),
				Image:
					platform === 'pc'
						? itemImages.pc || String(row.image_pc ?? '')
						: platform === 'android'
							? itemImages.android || String(row.image_android ?? '')
							: itemImages.ios || String(row.image_ios ?? ''),
				ImageWidth:
					platform === 'pc' ? safeMetricNumber(row.image_pc_width) : platform === 'android' ? safeMetricNumber(row.image_android_width) : safeMetricNumber(row.image_ios_width),
				ImageHeight:
					platform === 'pc' ? safeMetricNumber(row.image_pc_height) : platform === 'android' ? safeMetricNumber(row.image_android_height) : safeMetricNumber(row.image_ios_height),
				ImageTextureFormat:
					platform === 'pc' ? String(row.image_pc_texture_format ?? '') : platform === 'android' ? String(row.image_android_texture_format ?? '') : String(row.image_ios_texture_format ?? ''),
			});
		}
	}
	return validScopes.flatMap((scope) =>
		targetPlatforms.map((platform) => {
			const payload = payloadByScopePlatform.get(`${scope.ID}:${platform}`) ?? buildEmptyAdvertisementPayload();
			const payloadText = JSON.stringify(payload);
			return {
				scopeId: scope.ID,
				platform,
				payloadText,
				payloadBytes: new TextEncoder().encode(payloadText).length,
				chunks: splitPromotionPayload(payloadText),
			};
		})
	);
}

async function loadAdvertisementPlatformPayloadText(env: Env, scopeId: string, platform: AdvertisementPlatform) {
	const result = await env.STATE_DB.prepare(
		`SELECT chunk_text
    FROM advertisement_platform_cache_chunks
    WHERE scope_id = ? AND platform = ?
    ORDER BY chunk_index ASC`
	)
		.bind(scopeId, platform)
		.all<any>();
	const chunks = (result.results ?? []).map((row) => String(row.chunk_text ?? ''));
	return chunks.length > 0 ? chunks.join('') : '';
}

async function loadAdvertisementPayloadBytes(env: Env) {
	const usage = await loadAdvertisementCacheUsage(env);
	return usage.total.usedBytes;
}

async function loadAdvertisementCacheUsage(env: Env) {
	const usage = {
		total: buildAdvertisementUsageEntry(0),
		platforms: {
			pc: buildAdvertisementUsageEntry(0),
			android: buildAdvertisementUsageEntry(0),
			ios: buildAdvertisementUsageEntry(0),
		},
		byScopePlatform: {} as Record<string, number>,
	};
	const result = await env.STATE_DB.prepare('SELECT scope_id, platform, payload_bytes FROM advertisement_platform_cache').all<any>();
	let totalBytes = 0;
	for (const row of result.results ?? []) {
		const platform = String(row.platform ?? '') as AdvertisementPlatform;
		if (!ADVERTISEMENT_PLATFORMS.includes(platform)) continue;
		const bytes = safeMetricNumber(row.payload_bytes);
		usage.platforms[platform] = buildAdvertisementUsageEntry(usage.platforms[platform].usedBytes + bytes);
		usage.byScopePlatform[`${String(row.scope_id ?? '')}:${platform}`] = bytes;
		totalBytes += bytes;
	}
	usage.total = buildAdvertisementUsageEntry(totalBytes);
	return usage;
}

function buildAdvertisementUsageEntry(bytes: number) {
	return {
		usedBytes: bytes,
		usedPercent: Math.min(100, Number(((bytes / ADVERTISEMENT_LIST_MAX_BYTES) * 100).toFixed(2))),
	};
}

function buildEmptyAdvertisementPayload(): AdvertisementExportItem[] {
	return [];
}

async function loadItemImagesFromChunks(env: Env, tableName: ImageChunkTableName, itemIds: string[]) {
	const normalizedIds = itemIds.map((id) => String(id ?? '').trim()).filter((id, index, array) => id.length > 0 && array.indexOf(id) === index);
	const imagesByItemId: Record<string, Partial<Record<StoredImageKind, string>>> = {};
	if (normalizedIds.length === 0) return imagesByItemId;
	for (let offset = 0; offset < normalizedIds.length; offset += 80) {
		const ids = normalizedIds.slice(offset, offset + 80);
		const result = await env.STATE_DB.prepare(
			`SELECT item_id, image_kind, chunk_text
      FROM ${tableName}
      WHERE item_id IN (${ids.map(() => '?').join(', ')})
      ORDER BY item_id ASC, image_kind ASC, chunk_index ASC`
		)
			.bind(...ids)
			.all<any>();
		for (const row of result.results ?? []) {
			const itemId = String(row.item_id ?? '');
			const imageKind = String(row.image_kind ?? '') as StoredImageKind;
			if (!itemId || !isStoredImageKind(imageKind)) continue;
			if (!imagesByItemId[itemId]) imagesByItemId[itemId] = {};
			imagesByItemId[itemId][imageKind] = String(imagesByItemId[itemId][imageKind] ?? '') + String(row.chunk_text ?? '');
		}
	}
	return imagesByItemId;
}

async function saveItemImageChunks(env: Env, tableName: ImageChunkTableName, itemId: string, imageKind: StoredImageKind, imageBase64: string) {
	if (!isStoredImageKind(imageKind)) throw new Error('invalid_image_kind');
	const chunks = splitAdvertisementImagePayload(imageBase64);
	const statements = [env.STATE_DB.prepare(`DELETE FROM ${tableName} WHERE item_id = ? AND image_kind = ?`).bind(itemId, imageKind)];
	for (const [chunkIndex, chunkText] of chunks.entries()) {
		if (chunkText.length === 0) continue;
		statements.push(
			env.STATE_DB.prepare(`INSERT INTO ${tableName} (item_id, image_kind, chunk_index, chunk_text) VALUES (?, ?, ?, ?)`).bind(itemId, imageKind, chunkIndex, chunkText)
		);
	}
	await env.STATE_DB.batch(statements);
}

async function deleteItemImageChunks(env: Env, tableName: ImageChunkTableName, itemId: string, imageKinds?: StoredImageKind[]) {
	const normalizedKinds = (imageKinds ?? []).filter(isStoredImageKind);
	if (normalizedKinds.length === 0) {
		await env.STATE_DB.prepare(`DELETE FROM ${tableName} WHERE item_id = ?`).bind(itemId).run();
		return;
	}
	await env.STATE_DB.prepare(`DELETE FROM ${tableName} WHERE item_id = ? AND image_kind IN (${normalizedKinds.map(() => '?').join(', ')})`)
		.bind(itemId, ...normalizedKinds)
		.run();
}

function isStoredImageKind(value: string): value is StoredImageKind {
	return value === 'raw' || value === 'pc' || value === 'android' || value === 'ios';
}

async function loadAdvertisementItemRecordById(env: Env, id: string) {
	const row = await env.STATE_DB.prepare(
		`SELECT
      id, scope_id, title, url, image,
      group_name,
      image_pc, image_pc_width, image_pc_height, image_pc_texture_format,
      image_android, image_android_width, image_android_height, image_android_texture_format,
      image_ios, image_ios_width, image_ios_height, image_ios_texture_format,
      updated_at, display_order
    FROM advertisement_items
    WHERE id = ?`
	)
		.bind(id)
		.first<any>();
	if (!row) return null;
	const images = await loadItemImagesFromChunks(env, 'advertisement_item_image_chunks', [id]);
	const itemImages = images[id] ?? {};
	return {
		...row,
		image: itemImages.raw || String(row.image ?? ''),
		image_pc: itemImages.pc || String(row.image_pc ?? ''),
		image_android: itemImages.android || String(row.image_android ?? ''),
		image_ios: itemImages.ios || String(row.image_ios ?? ''),
	};
}

function splitAdvertisementImagePayload(payloadText: string) {
	if (payloadText.length <= ADVERTISEMENT_IMAGE_CHUNK_SIZE) return [payloadText];
	const chunks: string[] = [];
	for (let index = 0; index < payloadText.length; index += ADVERTISEMENT_IMAGE_CHUNK_SIZE) {
		chunks.push(payloadText.slice(index, index + ADVERTISEMENT_IMAGE_CHUNK_SIZE));
	}
	return chunks;
}

function normalizeAdvertisementScopeKey(value: string) {
	const normalized = String(value ?? '').trim().toLowerCase();
	return /^[a-z0-9_-]+$/.test(normalized) ? normalized : '';
}
