import { loadConfig, updateConfig, listRecentErrors, listRecentLlmRequests, loadTranslationStatsSummary, resetTranslationCache } from './database';
import { TRANSLATION_PROMPT_VERSION } from './constants';
import { jsonResponse, clampInteger, countCharacters } from './utils';
import { requestAiTranslation } from './ai';
import { executeTranslation } from './translation';
import { Env } from './types';

const SESSION_TTL_SECONDS = 60 * 60 * 12;
const TOKEN_VERSION = 'v1';

function parseAuthorizationToken(request: Request) {
	const header = String(request.headers.get('authorization') ?? '');
	if (!header.startsWith('Bearer ')) return '';
	return header.slice('Bearer '.length).trim();
}

function parseTokenPayload(token: string) {
	try {
		const [version, encodedPayload, encodedSignature] = token.split('.');
		if (version !== TOKEN_VERSION || !encodedPayload || !encodedSignature) return null;
		const source = JSON.parse(atob(encodedPayload));
		if (!source || typeof source !== 'object') return null;
		return {
			encodedPayload,
			encodedSignature,
			exp: Number((source as any).exp),
		};
	} catch {
		return null;
	}
}

async function buildHmacSignature(secret: string, payload: string) {
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
	return btoa(String.fromCharCode(...new Uint8Array(signed)));
}

async function buildSessionToken(env: Env) {
	const payloadJson = JSON.stringify({
		exp: Date.now() + SESSION_TTL_SECONDS * 1000,
	});
	const encodedPayload = btoa(payloadJson);
	const signature = await buildHmacSignature(env.MGR_PASSWORD, encodedPayload);
	return `${TOKEN_VERSION}.${encodedPayload}.${signature}`;
}

async function isAuthenticated(request: Request, env: Env) {
	const token = parseAuthorizationToken(request);
	if (token.length === 0) return false;
	const payload = parseTokenPayload(token);
	if (!payload) return false;
	if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) return false;
	const expected = await buildHmacSignature(env.MGR_PASSWORD, payload.encodedPayload);
	return payload.encodedSignature === expected;
}

async function readJsonBody(request: Request) {
	try {
		return await request.json<any>();
	} catch {
		return null;
	}
}

export async function handleManagerApi(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
	const path = url.pathname.replace(/^\/mgr\/api/, '') || '/';

	if (path === '/login' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const password = String(body?.password ?? '');
		if (password.length === 0) return jsonResponse({ status: 'error', result: 'Password required' }, 400);
		if (password !== env.MGR_PASSWORD) return jsonResponse({ status: 'error', result: 'Unauthorized' }, 401);
		return jsonResponse({ status: 'ok', result: { token: await buildSessionToken(env), expiresInSeconds: SESSION_TTL_SECONDS } });
	}

	if (!(await isAuthenticated(request, env))) return jsonResponse({ status: 'error', result: 'Unauthorized' }, 401);

	if (path === '/status' && request.method === 'GET') {
		const config = await loadConfig(env);
		return jsonResponse({
			status: 'ok',
			result: {
				enabled: config.enabled,
				requestsPerMinute: config.requestsPerMinute,
				maxChars: config.maxChars,
				cacheTtlSeconds: config.cacheTtlSeconds,
				errorRetentionSeconds: config.errorRetentionSeconds,
			},
		});
	}

	if (path === '/config' && request.method === 'POST') {
		const current = await loadConfig(env);
		const body = await readJsonBody(request);
		const next = await updateConfig(env, {
			enabled: typeof body?.enabled === 'boolean' ? body.enabled : current.enabled,
			requestsPerMinute: clampInteger(Number(body?.requestsPerMinute), 1, 60, current.requestsPerMinute),
			maxChars: clampInteger(Number(body?.maxChars), 1, 1000, current.maxChars),
		});
		return jsonResponse({ status: 'ok', result: next });
	}

	if (path === '/errors' && request.method === 'GET') {
		const limit = clampInteger(Number(url.searchParams.get('limit') ?? '5'), 1, 50, 5);
		return jsonResponse({ status: 'ok', result: await listRecentErrors(env, limit) });
	}

	if (path === '/llmrequests' && request.method === 'GET') {
		const limit = clampInteger(Number(url.searchParams.get('limit') ?? '5'), 1, 50, 5);
		return jsonResponse({ status: 'ok', result: await listRecentLlmRequests(env, limit) });
	}

	if (path === '/stats' && request.method === 'GET') {
		return jsonResponse({ status: 'ok', result: await loadTranslationStatsSummary(env) });
	}

	if (path === '/ping' && request.method === 'POST') {
		const pingResult = await requestAiTranslation(
			env,
			'en_US',
			'ping',
			{
				source: 'manager-ping',
				promptVersion: TRANSLATION_PROMPT_VERSION,
			},
			ctx.waitUntil.bind(ctx)
		);
		if (!pingResult.ok) return jsonResponse({ status: 'error', result: pingResult.publicReason }, 502);
		return jsonResponse({
			status: 'ok',
			result: {
				latencyMs: pingResult.latencyMs,
				preview: pingResult.result,
			},
		});
	}

	if (path === '/simulate' && request.method === 'POST') {
		const config = await loadConfig(env);
		if (!config.enabled) return jsonResponse({ status: 'error', result: 'Server is closed' }, 503);

		const body = await readJsonBody(request);
		const lang = String(body?.lang ?? '').trim();
		const text = String(body?.text ?? '').trim();
		if (lang.length === 0) return jsonResponse({ status: 'error', result: 'lang を指定してください。' }, 400);
		if (text.length === 0) return jsonResponse({ status: 'error', result: 'text を指定してください。' }, 400);
		if (countCharacters(text) > config.maxChars) return jsonResponse({ status: 'error', result: 'Text too long' }, 400);

		const result = await executeTranslation(env, ctx, config, lang, text, {
			requestSource: 'manager-simulate',
			useCache: true,
			writeCache: true,
			useSingleFlight: true,
		});

		if (!result.ok) return jsonResponse({ status: 'error', result: result.publicReason }, result.statusCode);
		return jsonResponse({ status: 'ok', result });
	}

	if (path === '/resetcache' && request.method === 'POST') {
		ctx.waitUntil(resetTranslationCache(env, 'manager'));
		return jsonResponse({ status: 'ok', result: 'translation_cache のレコード削除を開始しました。' });
	}

	return jsonResponse({ status: 'error', result: 'Not Found' }, 404);
}
