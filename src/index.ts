import { AutoRouter } from 'itty-router';
import { Env, ServiceConfig, TranslationOutcome } from './types';
import { jsonResponse, countCharacters, buildCacheKey, DISCORD_INTERACTION_TYPE_PING, DISCORD_INTERACTION_TYPE_APPLICATION_COMMAND, DISCORD_INTERACTION_RESPONSE_PONG } from './utils';
import { TRANSLATION_PROMPT_VERSION, DISCORD_COMMANDS } from './constants';
import {
	loadConfig,
	getCachedTranslation,
	putCachedTranslation,
	runDatabaseMaintenance,
	recordError,
	checkRateLimit,
	recordTranslationStats,
} from './database';
import { verifyDiscordRequest, handleDiscordApplicationCommand, discordMessageResponse } from './discord';
import { requestAiTranslation } from './ai';

export { TranslationCoordinator } from './coordinator';

const router = AutoRouter();

router.options('*', () => new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-signature-ed25519,x-signature-timestamp', 'access-control-allow-methods': 'GET,POST,OPTIONS' } }));

router.get('/', (request, env) => handleHealth(env));
router.get('/health', (request, env) => handleHealth(env));

router.get('/trans', (request, env, ctx) => handleTranslate(request, env, ctx, new URL(request.url)));

router.post('/discord/interactions', (request, env, ctx) => handleDiscordInteractions(request, env, ctx));

router.get('/discord/commands', (request) => handleDiscordCommands(request));

export default {
	/**
	 * Main entry point for HTTP requests.
	 */
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			console.log(`[Worker] ${request.method} ${request.url}`);
			return await router.fetch(request, env, ctx);
		} catch (error) {
			const entry = {
				level: 'critical',
				code: 'UNHANDLED_EXCEPTION',
				message: '未処理例外が発生しました。',
				details: {
					message: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack ?? '' : '',
					method: request.method,
					path: new URL(request.url).pathname,
				},
				occurredAt: new Date().toISOString(),
			};

			console.error(`[Worker] Critical error: ${entry.message}`, error);
			ctx.waitUntil(recordError(env, entry));
			return jsonResponse({ status: 'error', result: 'Server error' }, 500);
		}
	},

	/**
	 * Background tasks (Cron Triggers).
	 */
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(`[Worker] Scheduled task started: ${controller.cron}`);
		ctx.waitUntil(runDatabaseMaintenance(env));
	},
} satisfies ExportedHandler<Env>;

async function handleHealth(env: Env) {
	const config = await loadConfig(env);
	return jsonResponse({
		status: 'ok',
		result: {
			enabled: config.enabled,
			requestsPerMinute: config.requestsPerMinute,
			maxChars: config.maxChars,
		},
	});
}

async function handleTranslate(request: Request, env: Env, ctx: ExecutionContext, url: URL) {
	if (!isAllowedUnityTranslateRequest(request)) return jsonResponse({ status: 'error', result: 'Unauthorized client' }, 403);

	const config = await loadConfig(env);
	if (!config.enabled) return jsonResponse({ status: 'error', result: 'Server is closed' }, 503);

	const parsed = parseTranslateQuery(url);
	if (!parsed) return jsonResponse({ status: 'error', result: 'Invalid request' }, 400);

	const text = parsed.text.trim();
	if (text.length === 0) return jsonResponse({ status: 'ok', result: '' });

	if (countCharacters(text) > config.maxChars) return jsonResponse({ status: 'error', result: 'Text too long' }, 400);

	const cacheKey = await buildCacheKey(parsed.lang, text, TRANSLATION_PROMPT_VERSION);
	const cached = await getCachedTranslation(env, cacheKey);
	if (cached !== null) {
		ctx.waitUntil(
			recordTranslationStats(env, {
				lang: parsed.lang,
				textLength: countCharacters(text),
				cacheHit: true,
				cacheMiss: false,
				aiRequest: false,
				aiSuccess: false,
				aiFailure: false,
			})
		);
		return jsonResponse({ status: 'ok', result: cached });
	}

	const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
	const rateLimit = await checkRateLimit(env, clientIp, config.requestsPerMinute);
	if (!rateLimit.allowed) return jsonResponse({ status: 'error', result: 'Rate limit exceeded' }, 429);

	const translation = await executeTranslation(env, ctx, config, parsed.lang, text, {
		requestSource: 'translate-api',
		useCache: true,
		writeCache: true,
		useSingleFlight: true,
		recordStats: false, // will be recorded after outcome
	});

	if (!translation.ok) {
		ctx.waitUntil(recordTranslationOutcome(env, parsed.lang, countCharacters(text), translation));
		return jsonResponse({ status: 'error', result: translation.publicReason }, translation.statusCode);
	}

	ctx.waitUntil(recordTranslationOutcome(env, parsed.lang, countCharacters(text), translation));
	return jsonResponse({ status: 'ok', result: translation.result });
}

async function handleDiscordCommands(request: Request) {
	if (request.method === 'GET') return jsonResponse({ status: 'ok', result: DISCORD_COMMANDS });
	return jsonResponse({ status: 'error', result: 'Invalid method' }, 405);
}

async function handleDiscordInteractions(request: Request, env: Env, ctx: ExecutionContext) {
	const rawBody = await request.text();
	const isValid = await verifyDiscordRequest(request, env, rawBody);
	if (!isValid) return jsonResponse({ status: 'error', result: 'Unauthorized' }, 401);

	let interaction: any;
	try {
		interaction = JSON.parse(rawBody);
	} catch {
		return jsonResponse({ status: 'error', result: 'Invalid JSON' }, 400);
	}

	if (interaction.type === DISCORD_INTERACTION_TYPE_PING) return jsonResponse({ type: DISCORD_INTERACTION_RESPONSE_PONG });

	if (interaction.type !== DISCORD_INTERACTION_TYPE_APPLICATION_COMMAND) {
		return discordMessageResponse('未対応の Interaction 種別です。', true);
	}

	try {
		return await handleDiscordApplicationCommand(interaction, env, ctx);
	} catch (error) {
		const entry = {
			level: 'critical',
			code: 'DISCORD_COMMAND_FAILED',
			message: 'Discord コマンド処理中に未処理例外が発生しました。',
			details: {
				commandName: interaction?.data?.name ?? '',
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack ?? '' : '',
			},
			occurredAt: new Date().toISOString(),
		};

		ctx.waitUntil(recordError(env, entry));
		return discordMessageResponse('サーバーエラーが発生しました。', true);
	}
}

export async function executeTranslation(env: Env, ctx: ExecutionContext, config: ServiceConfig, lang: string, text: string, options: any): Promise<TranslationOutcome> {
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

async function recordTranslationOutcome(env: Env, lang: string, textLength: number, translation: TranslationOutcome) {
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

function parseTranslateQuery(url: URL) {
	const entries = Array.from(url.searchParams.entries());
	if (entries.length === 0) return null;
	const firstEntry = entries[0];
	const lang = firstEntry[0].trim();
	if (lang.length === 0) return null;
	return { lang, text: firstEntry[1] };
}

function isAllowedUnityTranslateRequest(request: Request) {
	const userAgent = String(request.headers.get('user-agent') ?? '');
	const accept = String(request.headers.get('accept') ?? '').trim();
	const unityVersion = String(request.headers.get('x-unity-version') ?? '').trim();
	return userAgent.includes('UnityPlayer') && accept === '*/*' && unityVersion.length > 0;
}
