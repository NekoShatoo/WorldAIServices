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
const PROMOTION_GIST_SOURCE_KEY = 'PromotionList';
const EMPTY_PROMOTION_PAYLOAD: PromotionPayload = Object.freeze({ Avatar: [], World: [] });
const EMPTY_PROMOTION_PLATFORM_PAYLOAD_BUNDLE: PromotionPlatformPayloadBundle = Object.freeze({
	pc: { Avatar: [], World: [] },
	android: { Avatar: [], World: [] },
	ios: { Avatar: [], World: [] },
});
const PROMOTION_PLATFORMS: PromotionPlatform[] = ['pc', 'android', 'ios'];

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
      LENGTH(image_pc) AS image_pc_length,
      LENGTH(image_android) AS image_android_length,
      LENGTH(image_ios) AS image_ios_length,
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
      LENGTH(image_pc) AS image_pc_length,
      LENGTH(image_android) AS image_android_length,
      LENGTH(image_ios) AS image_ios_length,
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
		HasImage: safeMetricNumber(row.image_length) > 0,
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, '', '', '', ?, ?, ?)`
	)
		.bind(payload.ID, itemType, payload.Title, payload.Anchor, payload.Description, payload.Link, payload.Image, nextOrder, now, now)
		.run();

	const summary = await rebuildPromotionListCache(env);
	return { ok: true as const, summary };
}

export async function deletePromotionItem(env: Env, id: string) {
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
        image = ?,
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
			itemType,
			payload.Title,
			payload.Anchor,
			payload.Description,
			payload.Link,
			payload.Image,
			rawImageChanged ? '' : currentItem?.image_pc ?? '',
			rawImageChanged ? 0 : safeMetricNumber(currentItem?.image_pc_width),
			rawImageChanged ? 0 : safeMetricNumber(currentItem?.image_pc_height),
			rawImageChanged ? '' : String(currentItem?.image_pc_texture_format ?? ''),
			rawImageChanged ? '' : currentItem?.image_android ?? '',
			rawImageChanged ? 0 : safeMetricNumber(currentItem?.image_android_width),
			rawImageChanged ? 0 : safeMetricNumber(currentItem?.image_android_height),
			rawImageChanged ? '' : String(currentItem?.image_android_texture_format ?? ''),
			rawImageChanged ? '' : currentItem?.image_ios ?? '',
			rawImageChanged ? 0 : safeMetricNumber(currentItem?.image_ios_width),
			rawImageChanged ? 0 : safeMetricNumber(currentItem?.image_ios_height),
			rawImageChanged ? '' : String(currentItem?.image_ios_texture_format ?? ''),
			new Date().toISOString(),
			id
		)
		.run();

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
	for (const row of result.results ?? []) {
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
				Image: String(row.image_pc ?? ''),
				ImageWidth: safeMetricNumber(row.image_pc_width),
				ImageHeight: safeMetricNumber(row.image_pc_height),
				ImageTextureFormat: String(row.image_pc_texture_format ?? ''),
			});
		}
		if (platformSet.has('android')) {
			payloadBundle.android[type].push({
				...baseItem,
				Image: String(row.image_android ?? ''),
				ImageWidth: safeMetricNumber(row.image_android_width),
				ImageHeight: safeMetricNumber(row.image_android_height),
				ImageTextureFormat: String(row.image_android_texture_format ?? ''),
			});
		}
		if (platformSet.has('ios')) {
			payloadBundle.ios[type].push({
				...baseItem,
				Image: String(row.image_ios ?? ''),
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
	if (safeMetricNumber(row?.image_pc_length) > 0) platforms.push('pc');
	if (safeMetricNumber(row?.image_android_length) > 0) platforms.push('android');
	if (safeMetricNumber(row?.image_ios_length) > 0) platforms.push('ios');
	return platforms;
}

function hasAllConvertedPlatforms(row: any) {
	return buildConvertedPlatformsFromRow(row).length === 3;
}

async function loadPromotionItemRecordById(env: Env, id: string) {
	return await env.STATE_DB.prepare(
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
    SET ${columnNames.image} = ?,
        ${columnNames.width} = ?,
        ${columnNames.height} = ?,
        ${columnNames.textureFormat} = ?,
        updated_at = ?
    WHERE id = ?`
	)
		.bind(convertedImageBase64, imageWidth, imageHeight, textureFormat, new Date().toISOString(), id)
		.run();
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
