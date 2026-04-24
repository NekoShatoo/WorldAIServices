import {
	loadConfig,
	updateConfig,
	listRecentErrors,
	listRecentLlmRequests,
	loadTranslationStatsSummary,
	resetTranslationCache,
	getPromotionListUsage,
	listPromotionItems,
	createPromotionItem,
	deletePromotionItem,
	updatePromotionItem,
	movePromotionItem,
	reorderPromotionItems,
	getPromotionItemById,
	savePromotionPlatformImage,
} from './database';
import { TRANSLATION_PROMPT_VERSION } from './constants';
import { jsonResponse, clampInteger, countCharacters } from './utils';
import { requestAiTranslation } from './ai';
import { executeTranslation } from './translation';
import { convertPromotionImage } from './promotionCrunch';
import { Env, PromotionItemType, PromotionPlatform } from './types';

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

	if (path === '/promotion/usage' && request.method === 'GET') {
		return jsonResponse({ status: 'ok', result: await getPromotionListUsage(env) });
	}

	if (path === '/promotion/items' && request.method === 'GET') {
		const type = String(url.searchParams.get('type') ?? '') as PromotionItemType;
		if (type && type !== 'Avatar' && type !== 'World') return jsonResponse({ status: 'error', result: 'type は Avatar または World を指定してください。' }, 400);
		return jsonResponse({ status: 'ok', result: await listPromotionItems(env, type || undefined) });
	}

	if (path === '/promotion/items/detail' && request.method === 'GET') {
		const id = String(url.searchParams.get('id') ?? '').trim();
		if (!id) return jsonResponse({ status: 'error', result: 'id を指定してください。' }, 400);
		const item = await getPromotionItemById(env, id);
		if (!item) return jsonResponse({ status: 'error', result: 'not_found' }, 404);
		return jsonResponse({ status: 'ok', result: item });
	}

	if (path === '/promotion/items' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const itemType = String(body?.type ?? '') as PromotionItemType;
		if (itemType !== 'Avatar' && itemType !== 'World') return jsonResponse({ status: 'error', result: 'type は Avatar または World を指定してください。' }, 400);

		const payload = {
			ID: String(body?.item?.ID ?? '').trim(),
			Title: String(body?.item?.Title ?? '').trim(),
			Anchor: String(body?.item?.Anchor ?? '').trim(),
			Description: String(body?.item?.Description ?? '').trim(),
			Link: String(body?.item?.Link ?? '').trim(),
			Image: String(body?.item?.Image ?? '').trim(),
		};
		if (!payload.ID) return jsonResponse({ status: 'error', result: 'ID は必須です。' }, 400);

		const predictedBytes = clampInteger(Number(body?.predictedBytes), 0, 200000000, 0);
		try {
			const created = await createPromotionItem(env, itemType, payload, predictedBytes);
			if (!created.ok) return jsonResponse({ status: 'error', result: 'PromotionList payload limit exceeded' }, 400);
			return jsonResponse({ status: 'ok', result: created.summary });
		} catch (error) {
			if (error instanceof Error && error.message === 'promotion_payload_limit_exceeded') {
				return jsonResponse({ status: 'error', result: 'PromotionList payload limit exceeded' }, 400);
			}
			if (error instanceof Error && error.message.includes('UNIQUE')) {
				return jsonResponse({ status: 'error', result: 'ID が重複しています。' }, 409);
			}
			throw error;
		}
	}

	if (path === '/promotion/items/delete' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const id = String(body?.id ?? '').trim();
		if (id.length === 0) return jsonResponse({ status: 'error', result: 'id を指定してください。' }, 400);
		return jsonResponse({ status: 'ok', result: await deletePromotionItem(env, id) });
	}

	if (path === '/promotion/items/update' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const id = String(body?.id ?? '').trim();
		if (id.length === 0) return jsonResponse({ status: 'error', result: 'id を指定してください。' }, 400);

		const itemType = String(body?.type ?? '') as PromotionItemType;
		if (itemType !== 'Avatar' && itemType !== 'World') return jsonResponse({ status: 'error', result: 'type は Avatar または World を指定してください。' }, 400);

		const payload = {
			ID: id,
			Title: String(body?.item?.Title ?? '').trim(),
			Anchor: String(body?.item?.Anchor ?? '').trim(),
			Description: String(body?.item?.Description ?? '').trim(),
			Link: String(body?.item?.Link ?? '').trim(),
			Image: String(body?.item?.Image ?? '').trim(),
		};
		if (!payload.ID) return jsonResponse({ status: 'error', result: 'ID は必須です。' }, 400);

		const predictedBytes = clampInteger(Number(body?.predictedBytes), 0, 200000000, 0);
		try {
			const updated = await updatePromotionItem(env, id, itemType, payload, predictedBytes);
			if (!updated.ok) return jsonResponse({ status: 'error', result: 'PromotionList payload limit exceeded' }, 400);
			return jsonResponse({ status: 'ok', result: updated.summary });
		} catch (error) {
			if (error instanceof Error && error.message === 'promotion_payload_limit_exceeded') {
				return jsonResponse({ status: 'error', result: 'PromotionList payload limit exceeded' }, 400);
			}
			throw error;
		}
	}

	if (path === '/promotion/items/move' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const id = String(body?.id ?? '').trim();
		const direction = String(body?.direction ?? '');
		if (id.length === 0) return jsonResponse({ status: 'error', result: 'id を指定してください。' }, 400);
		if (direction !== 'up' && direction !== 'down') return jsonResponse({ status: 'error', result: 'direction は up/down を指定してください。' }, 400);
		const moved = await movePromotionItem(env, id, direction);
		if (!moved.ok) return jsonResponse({ status: 'error', result: 'not_found' }, 404);
		return jsonResponse({ status: 'ok', result: moved.summary });
	}

	if (path === '/promotion/items/reorder' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const itemType = String(body?.type ?? '') as PromotionItemType;
		const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds : [];
		if (itemType !== 'Avatar' && itemType !== 'World') return jsonResponse({ status: 'error', result: 'type は Avatar または World を指定してください。' }, 400);
		const reordered = await reorderPromotionItems(env, itemType, orderedIds);
		if (!reordered.ok) return jsonResponse({ status: 'error', result: '並び順データが不正です。' }, 400);
		return jsonResponse({ status: 'ok', result: reordered.summary });
	}

	if (path === '/promotion/items/convert' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const id = String(body?.id ?? '').trim();
		const platform = String(body?.platform ?? '').trim() as PromotionPlatform;
		const hasAlpha = typeof body?.hasAlpha === 'boolean' ? body.hasAlpha : false;
		if (!id) return jsonResponse({ status: 'error', result: 'id を指定してください。' }, 400);
		if (platform !== 'pc' && platform !== 'android' && platform !== 'ios') return jsonResponse({ status: 'error', result: 'platform は pc/android/ios を指定してください。' }, 400);

		const item = await getPromotionItemById(env, id);
		if (!item) return jsonResponse({ status: 'error', result: 'not_found' }, 404);
		if (!item.Image.trim()) return jsonResponse({ status: 'error', result: 'image_not_found' }, 400);

		try {
			const converted = await convertPromotionImage(env, platform, item.Image, hasAlpha);
			const summary = await savePromotionPlatformImage(env, id, platform, converted.base64);
			return jsonResponse({
				status: 'ok',
				result: {
					platform,
					textureFormat: converted.textureFormat,
					outputFormat: converted.outputFormat,
					outputBytes: converted.outputBytes,
					contentType: converted.contentType,
					summary,
				},
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return jsonResponse({ status: 'error', result: message }, 502);
		}
	}

	if (path === '/docs/ai' && request.method === 'GET') {
		return jsonResponse({
			status: 'ok',
			result: {
				title: 'AIサービス API 仕様',
				body: [
					'公開翻訳 API: GET /trans?{lang}={text}',
					'許可ヘッダー: UnityPlayer + Accept */* + X-Unity-Version',
					'レスポンス形式: { status, result }',
					'サーバー停止時: 503 + Server is closed',
				],
			},
		});
	}

	if (path === '/docs/promotion' && request.method === 'GET') {
		return jsonResponse({
			status: 'ok',
			result: {
				title: 'PromotionList API 仕様',
				body: [
					'公開API: GET /PromotionList?p=pc|android|ios',
					'レスポンスは { Avatar: PromotionItem[], World: PromotionItem[] }',
					'PromotionItem: Title / Anchor / Description / Link / ID / Image',
					'Image は各プラットフォーム向けに変換済みの Base64 データのみを返し、原画像は公開しない',
					'画像変換は管理画面から pc → android → ios の順で実行する',
					'公開APIは都度変換せず、管理画面更新時に再生成したキャッシュJSONを返す',
					'JSON 総サイズ上限は 100MB',
				],
			},
		});
	}

	return jsonResponse({ status: 'error', result: 'Not Found' }, 404);
}
