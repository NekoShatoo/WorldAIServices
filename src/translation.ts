import { TRANSLATION_PROMPT_VERSION } from './constants';
import { getCachedTranslation, putCachedTranslation, recordError, recordTranslationStats } from './database';
import { requestAiTranslation } from './ai';
import { buildCacheKey, countCharacters } from './utils';
import { Env, ExecuteTranslationOptions, ServiceConfig, TranslationOutcome } from './types';

export async function executeTranslation(
	env: Env,
	ctx: ExecutionContext,
	config: ServiceConfig,
	lang: string,
	text: string,
	options: ExecuteTranslationOptions
): Promise<TranslationOutcome> {
	if (options.useSingleFlight) {
		return requestTranslationThroughCoordinator(env, {
			cacheKey: await buildCacheKey(lang, text, TRANSLATION_PROMPT_VERSION),
			cacheTtlSeconds: config.cacheTtlSeconds,
			lang,
			promptVersion: TRANSLATION_PROMPT_VERSION,
			requestSource: options.requestSource,
			text,
			useCache: options.useCache,
			writeCache: options.writeCache,
			action: 'translate',
		});
	}

	const startedAt = Date.now();
	const textLength = countCharacters(text);
	const cacheKey = await buildCacheKey(lang, text, TRANSLATION_PROMPT_VERSION);

	if (options.useCache) {
		const cached = await getCachedTranslation(env, cacheKey);
		if (cached !== null) {
			if (options.recordStats) {
				ctx.waitUntil(
					recordTranslationStats(env, {
						lang,
						textLength,
						cacheHit: true,
						cacheMiss: false,
						aiRequest: false,
						aiSuccess: false,
						aiFailure: false,
					})
				);
			}
			return { ok: true, statusCode: 200, source: 'cache', latencyMs: Date.now() - startedAt, result: cached };
		}
	}

	const aiResult = await requestAiTranslation(
		env,
		lang,
		text,
		{
			source: options.requestSource,
			promptVersion: TRANSLATION_PROMPT_VERSION,
		},
		ctx.waitUntil.bind(ctx)
	);

	if (!aiResult.ok) {
		if (options.recordStats) {
			ctx.waitUntil(
				recordTranslationStats(env, {
					lang,
					textLength,
					cacheHit: false,
					cacheMiss: true,
					aiRequest: true,
					aiSuccess: false,
					aiFailure: true,
				})
			);
		}
		ctx.waitUntil(
			recordError(env, {
				level: 'error',
				code: 'AI_REQUEST_FAILED',
				message: '翻訳AIへのリクエストに失敗しました。',
				details: {
					reason: aiResult.reason,
					publicReason: aiResult.publicReason,
					lang,
					textLength,
				},
				occurredAt: new Date().toISOString(),
			})
		);
		return aiResult as TranslationOutcome;
	}

	if (options.writeCache) {
		await putCachedTranslation(env, cacheKey, lang, TRANSLATION_PROMPT_VERSION, aiResult.result!, config.cacheTtlSeconds);
	}

	if (options.recordStats) {
		ctx.waitUntil(
			recordTranslationStats(env, {
				lang,
				textLength,
				cacheHit: false,
				cacheMiss: true,
				aiRequest: true,
				aiSuccess: true,
				aiFailure: false,
			})
		);
	}

	return aiResult as TranslationOutcome;
}

export async function recordTranslationOutcome(env: Env, lang: string, textLength: number, translation: TranslationOutcome) {
	await recordTranslationStats(env, {
		lang,
		textLength,
		cacheHit: translation.ok && translation.source === 'cache',
		cacheMiss: !translation.ok || translation.source === 'ai',
		aiRequest: !translation.ok || translation.source === 'ai',
		aiSuccess: translation.ok && translation.source === 'ai',
		aiFailure: !translation.ok,
	});
}

async function requestTranslationThroughCoordinator(env: Env, payload: any): Promise<TranslationOutcome> {
	const id = env.TRANSLATION_COORDINATOR.idFromName(payload.cacheKey);
	const stub = env.TRANSLATION_COORDINATOR.get(id);
	const response = await stub.fetch('https://translation-coordinator/translate', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
	});
	return await response.json<TranslationOutcome>();
}
