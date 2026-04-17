import { Env, ServiceConfig, TranslationMetric, TranslationStatsSummary, TranslationStatsRecord, ErrorEntry, LlmRequestEntry, PromotionItem, PromotionItemType, PromotionPayload } from './types';
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

export async function listPromotionItems(env: Env) {
	const result = await env.STATE_DB.prepare(
		`SELECT
      id,
      item_type,
      title,
      anchor,
      description,
      link,
      image,
      updated_at
    FROM promotion_list_items
    ORDER BY item_type ASC, updated_at DESC`
	).all<any>();
	return (result.results ?? []).map((row) => ({
		ID: String(row.id ?? ''),
		Type: String(row.item_type ?? '') as PromotionItemType,
		Title: String(row.title ?? ''),
		Anchor: String(row.anchor ?? ''),
		Description: String(row.description ?? ''),
		Link: String(row.link ?? ''),
		Image: String(row.image ?? ''),
		UpdatedAt: String(row.updated_at ?? ''),
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
	await env.STATE_DB.prepare(
		`INSERT INTO promotion_list_items (
      id,
      item_type,
      title,
      anchor,
      description,
      link,
      image,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	)
		.bind(payload.ID, itemType, payload.Title, payload.Anchor, payload.Description, payload.Link, payload.Image, now, now)
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

	await env.STATE_DB.prepare(
		`UPDATE promotion_list_items
    SET item_type = ?,
        title = ?,
        anchor = ?,
        description = ?,
        link = ?,
        image = ?,
        updated_at = ?
    WHERE id = ?`
	)
		.bind(itemType, payload.Title, payload.Anchor, payload.Description, payload.Link, payload.Image, new Date().toISOString(), id)
		.run();

	const summary = await rebuildPromotionListCache(env);
	return { ok: true as const, summary };
}

export async function getPromotionListPayload(env: Env): Promise<PromotionPayload> {
	const payloadText = await loadPromotionPayloadText(env);
	try {
		const parsed = JSON.parse(payloadText);
		if (!parsed || typeof parsed !== 'object') return { Avatar: [], World: [] };
		return {
			Avatar: Array.isArray((parsed as any).Avatar) ? (parsed as any).Avatar : [],
			World: Array.isArray((parsed as any).World) ? (parsed as any).World : [],
		};
	} catch {
		return { Avatar: [], World: [] };
	}
}

export async function getPromotionListUsage(env: Env) {
	const bytes = await loadPromotionPayloadBytes(env);
	return {
		usedBytes: bytes,
		maxBytes: PROMOTION_LIST_MAX_BYTES,
		usedPercent: Math.min(100, Number(((bytes / PROMOTION_LIST_MAX_BYTES) * 100).toFixed(2))),
	};
}

export async function rebuildPromotionListCache(env: Env) {
	const payload = await buildPromotionPayloadFromItems(env);
	const payloadText = JSON.stringify(payload);
	const payloadBytes = new TextEncoder().encode(payloadText).length;
	if (payloadBytes > PROMOTION_LIST_MAX_BYTES) throw new Error('promotion_payload_limit_exceeded');

	const chunks = splitPromotionPayload(payloadText);
	const db = env.STATE_DB;
	await db.prepare('DELETE FROM promotion_list_cache_chunks').run();
	const statements = chunks.map((chunk, index) => db.prepare('INSERT INTO promotion_list_cache_chunks (chunk_index, chunk_text) VALUES (?, ?)').bind(index, chunk));
	await db.batch(statements);
	await db.prepare(
		`INSERT INTO promotion_list_cache (
      cache_id,
      payload_total_bytes,
      payload_updated_at
    ) VALUES (1, ?, ?)
    ON CONFLICT(cache_id) DO UPDATE SET
      payload_total_bytes = excluded.payload_total_bytes,
      payload_updated_at = excluded.payload_updated_at`
	)
		.bind(payloadBytes, new Date().toISOString())
		.run();
	return {
		payloadBytes,
		chunkCount: chunks.length,
	};
}

async function buildPromotionPayloadFromItems(env: Env): Promise<PromotionPayload> {
	const result = await env.STATE_DB.prepare(
		`SELECT
      id,
      item_type,
      title,
      anchor,
      description,
      link,
      image
    FROM promotion_list_items
    ORDER BY item_type ASC, updated_at DESC`
	).all<any>();
	const payload: PromotionPayload = { Avatar: [], World: [] };
	for (const row of result.results ?? []) {
		const item = {
			ID: String(row.id ?? ''),
			Title: String(row.title ?? ''),
			Anchor: String(row.anchor ?? ''),
			Description: String(row.description ?? ''),
			Link: String(row.link ?? ''),
			Image: String(row.image ?? ''),
		};
		const type = String(row.item_type ?? '');
		if (type === 'Avatar') payload.Avatar.push(item);
		if (type === 'World') payload.World.push(item);
	}
	return payload;
}

async function loadPromotionPayloadText(env: Env) {
	const result = await env.STATE_DB.prepare(
		`SELECT chunk_text
    FROM promotion_list_cache_chunks
    ORDER BY chunk_index ASC`
	).all<any>();
	const chunks = (result.results ?? []).map((row) => String(row.chunk_text ?? ''));
	return chunks.join('');
}

async function loadPromotionPayloadBytes(env: Env) {
	const row = await env.STATE_DB.prepare(
		`SELECT payload_total_bytes
    FROM promotion_list_cache
    WHERE cache_id = 1`
	).first<any>();
	return safeMetricNumber(row?.payload_total_bytes);
}

function splitPromotionPayload(payloadText: string) {
	if (payloadText.length <= PROMOTION_LIST_CHUNK_SIZE) return [payloadText];
	const chunks: string[] = [];
	for (let index = 0; index < payloadText.length; index += PROMOTION_LIST_CHUNK_SIZE) {
		chunks.push(payloadText.slice(index, index + PROMOTION_LIST_CHUNK_SIZE));
	}
	return chunks;
}
