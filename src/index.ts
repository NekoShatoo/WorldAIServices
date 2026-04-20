import { AutoRouter } from 'itty-router';
import { Env } from './types';
import { jsonResponse, countCharacters, buildCacheKey, JSON_HEADERS } from './utils';
import { TRANSLATION_PROMPT_VERSION } from './constants';
import { loadConfig, getCachedTranslation, runDatabaseMaintenance, recordError, checkRateLimit, recordTranslationStats, getPromotionListPayload } from './database';
import { executeTranslation, recordTranslationOutcome } from './translation';
import { handleManagerApi } from './manager';
import { buildManagerAppPageHtml, buildManagerLoginPageHtml } from './managerPage';

export { TranslationCoordinator } from './coordinator';

const router = AutoRouter();

router.options('*', () => new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type,x-signature-ed25519,x-signature-timestamp,x-unity-version', 'access-control-allow-methods': 'GET,POST,OPTIONS' } }));

router.get('/', (request, env) => handleHealth(env));
router.get('/health', (request, env) => handleHealth(env));

router.get('/trans', (request, env, ctx) => handleTranslate(request, env, ctx, new URL(request.url)));
router.get('/PromotionList', (request, env) => handlePromotionList(env));

router.get('/mgr', () => handleManagerPage());
router.get('/mgr/', () => handleManagerPage());
router.get('/mgr/app', () => handleManagerAppPage());
router.get('/mgr/app/', () => handleManagerAppPage());
router.all('/mgr/api/*', (request, env, ctx) => handleManagerApi(request, env, ctx, new URL(request.url)));

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

function handleManagerPage() {
	return new Response(buildManagerLoginPageHtml(), {
		status: 200,
		headers: {
			'content-type': 'text/html; charset=UTF-8',
			'cache-control': 'no-store',
		},
	});
}

function handleManagerAppPage() {
	return new Response(buildManagerAppPageHtml(), {
		status: 200,
		headers: {
			'content-type': 'text/html; charset=UTF-8',
			'cache-control': 'no-store',
		},
	});
}

async function handlePromotionList(env: Env) {
	return new Response(JSON.stringify(await getPromotionListPayload(env)), {
		status: 200,
		headers: {
			...JSON_HEADERS,
			'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
		},
	});
}
