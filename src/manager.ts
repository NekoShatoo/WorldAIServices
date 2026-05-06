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
	clearPromotionPlatformImages,
	getPromotionPlatformBinary,
	listAdvertisementScopes,
	createAdvertisementScope,
	updateAdvertisementScope,
	deleteAdvertisementScope,
	listAdvertisementItems,
	createAdvertisementItem,
	updateAdvertisementItem,
	deleteAdvertisementItem,
	reorderAdvertisementItems,
	getAdvertisementItemById,
	saveAdvertisementPlatformImage,
	clearAdvertisementPlatformImages,
	getAdvertisementPlatformBinary,
	getAdvertisementUsage,
	getAdvertisementScopeById,
} from './database';
import { TRANSLATION_PROMPT_VERSION } from './constants';
import { jsonResponse, clampInteger, countCharacters } from './utils';
import { requestAiTranslation } from './ai';
import { executeTranslation } from './translation';
import { convertPromotionImage } from './promotionCrunch';
import { AdvertisementPlatform, Env, PromotionItemType, PromotionPlatform } from './types';
import { deleteGistfsFile, getAdvertisementGistfsStatus, getPromotionGistfsStatus, listGistfsFiles, uploadAdvertisementPlatformToGistfs, uploadPromotionPlatformToGistfs } from './gistfs';

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

	if (path === '/promotion/gist/status' && request.method === 'GET') {
		try {
			return jsonResponse({ status: 'ok', result: await getPromotionGistfsStatus(env) });
		} catch (error) {
			return jsonResponse({ status: 'error', result: normalizeGistfsManagerError(error) }, 502);
		}
	}

	if (path === '/promotion/gist/upload-platform' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const platform = String(body?.platform ?? '').trim() as PromotionPlatform;
		if (platform !== 'pc' && platform !== 'android' && platform !== 'ios') return jsonResponse({ status: 'error', result: 'platform は pc/android/ios を指定してください。' }, 400);
		try {
			return jsonResponse({ status: 'ok', result: await uploadPromotionPlatformToGistfs(env, platform) });
		} catch (error) {
			return jsonResponse({ status: 'error', result: normalizeGistfsManagerError(error) }, 502);
		}
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
		const imageWidth = clampInteger(Number(body?.imageWidth), 0, 32768, 0);
		const imageHeight = clampInteger(Number(body?.imageHeight), 0, 32768, 0);
		if (!id) return jsonResponse({ status: 'error', result: 'id を指定してください。' }, 400);
		if (platform !== 'pc' && platform !== 'android' && platform !== 'ios') return jsonResponse({ status: 'error', result: 'platform は pc/android/ios を指定してください。' }, 400);
		if (imageWidth <= 0 || imageHeight <= 0) return jsonResponse({ status: 'error', result: 'imageWidth/imageHeight を指定してください。' }, 400);

		const item = await getPromotionItemById(env, id);
		if (!item) return jsonResponse({ status: 'error', result: 'not_found' }, 404);
		if (!item.Image.trim()) return jsonResponse({ status: 'error', result: 'image_not_found' }, 400);

		try {
			const converted = await convertPromotionImage(env, platform, item.Image, hasAlpha, imageWidth, imageHeight);
			const summary = await savePromotionPlatformImage(env, id, platform, converted.base64, converted.imageWidth, converted.imageHeight, converted.textureFormat);
			return jsonResponse({
				status: 'ok',
				result: {
					platform,
					textureFormat: converted.textureFormat,
					outputFormat: converted.outputFormat,
					imageWidth: converted.imageWidth,
					imageHeight: converted.imageHeight,
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

	if (path === '/promotion/items/clear-converted' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const id = String(body?.id ?? '').trim();
		if (!id) return jsonResponse({ status: 'error', result: 'id を指定してください。' }, 400);
		const item = await getPromotionItemById(env, id);
		if (!item) return jsonResponse({ status: 'error', result: 'not_found' }, 404);
		const summary = await clearPromotionPlatformImages(env, id);
		return jsonResponse({ status: 'ok', result: summary });
	}

	if (path === '/promotion/items/download' && request.method === 'GET') {
		const id = String(url.searchParams.get('id') ?? '').trim();
		const platform = String(url.searchParams.get('platform') ?? '').trim() as PromotionPlatform;
		if (!id) return jsonResponse({ status: 'error', result: 'id を指定してください。' }, 400);
		if (platform !== 'pc' && platform !== 'android' && platform !== 'ios') return jsonResponse({ status: 'error', result: 'platform は pc/android/ios を指定してください。' }, 400);
		const binary = await getPromotionPlatformBinary(env, id, platform);
		if (!binary) return jsonResponse({ status: 'error', result: 'not_found' }, 404);
		return new Response(base64ToUint8Array(binary.base64), {
			status: 200,
			headers: {
				'content-type': binary.contentType,
				'cache-control': 'no-store',
				'content-disposition': `attachment; filename="${binary.id}_${platform}.${binary.extension}"`,
			},
		});
	}

	if (path === '/advertisement/usage' && request.method === 'GET') {
		return jsonResponse({ status: 'ok', result: await getAdvertisementUsage(env) });
	}

	if (path === '/advertisement/scopes' && request.method === 'GET') {
		return jsonResponse({ status: 'ok', result: await listAdvertisementScopes(env) });
	}

	if (path === '/advertisement/scopes' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const scopeKey = String(body?.scopeKey ?? '').trim();
		const name = String(body?.name ?? '').trim();
		if (!scopeKey) return jsonResponse({ status: 'error', result: 'scopeKey を指定してください。' }, 400);
		if (!name) return jsonResponse({ status: 'error', result: 'name を指定してください。' }, 400);
		try {
			return jsonResponse({ status: 'ok', result: await createAdvertisementScope(env, scopeKey, name) });
		} catch (error) {
			if (error instanceof Error && error.message === 'advertisement_scope_key_invalid') return jsonResponse({ status: 'error', result: 'scopeKey は a-z / 0-9 / _ / - のみ使用できます。' }, 400);
			if (error instanceof Error && error.message.includes('UNIQUE')) return jsonResponse({ status: 'error', result: 'scopeKey が重複しています。' }, 409);
			throw error;
		}
	}

	if (path === '/advertisement/scopes/update' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const id = String(body?.id ?? '').trim();
		const name = String(body?.name ?? '').trim();
		if (!id) return jsonResponse({ status: 'error', result: 'id を指定してください。' }, 400);
		if (!name) return jsonResponse({ status: 'error', result: 'name を指定してください。' }, 400);
		return jsonResponse({ status: 'ok', result: await updateAdvertisementScope(env, id, name) });
	}

	if (path === '/advertisement/scopes/delete' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const id = String(body?.id ?? '').trim();
		if (!id) return jsonResponse({ status: 'error', result: 'id を指定してください。' }, 400);
		await deleteAdvertisementScope(env, id);
		return jsonResponse({ status: 'ok', result: true });
	}

	if (path === '/advertisement/items' && request.method === 'GET') {
		const scopeId = String(url.searchParams.get('scopeId') ?? '').trim();
		if (!scopeId) return jsonResponse({ status: 'error', result: 'scopeId を指定してください。' }, 400);
		return jsonResponse({ status: 'ok', result: await listAdvertisementItems(env, scopeId) });
	}

	if (path === '/advertisement/items/detail' && request.method === 'GET') {
		const id = String(url.searchParams.get('id') ?? '').trim();
		if (!id) return jsonResponse({ status: 'error', result: 'id を指定してください。' }, 400);
		const item = await getAdvertisementItemById(env, id);
		if (!item) return jsonResponse({ status: 'error', result: 'not_found' }, 404);
		return jsonResponse({ status: 'ok', result: item });
	}

	if (path === '/advertisement/items' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const scopeId = String(body?.scopeId ?? '').trim();
		if (!scopeId) return jsonResponse({ status: 'error', result: 'scopeId を指定してください。' }, 400);
		const payload = {
			ID: '',
			Title: String(body?.item?.Title ?? '').trim(),
			URL: String(body?.item?.URL ?? '').trim(),
			Image: String(body?.item?.Image ?? '').trim(),
		};
		if (!payload.Title) return jsonResponse({ status: 'error', result: 'Title は必須です。' }, 400);
		const predictedBytes = clampInteger(Number(body?.predictedBytes), 0, 200000000, 0);
		try {
			const created = await createAdvertisementItem(env, scopeId, payload as any, predictedBytes);
			if (!created.ok) return jsonResponse({ status: 'error', result: 'Advertisement payload limit exceeded' }, 400);
			return jsonResponse({ status: 'ok', result: created });
		} catch (error) {
			if (error instanceof Error && error.message === 'advertisement_payload_limit_exceeded') return jsonResponse({ status: 'error', result: 'Advertisement payload limit exceeded' }, 400);
			throw error;
		}
	}

	if (path === '/advertisement/items/update' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const id = String(body?.id ?? '').trim();
		if (!id) return jsonResponse({ status: 'error', result: 'id を指定してください。' }, 400);
		const payload = {
			ID: id,
			Title: String(body?.item?.Title ?? '').trim(),
			URL: String(body?.item?.URL ?? '').trim(),
			Image: String(body?.item?.Image ?? '').trim(),
		};
		if (!payload.Title) return jsonResponse({ status: 'error', result: 'Title は必須です。' }, 400);
		const predictedBytes = clampInteger(Number(body?.predictedBytes), 0, 200000000, 0);
		try {
			const updated = await updateAdvertisementItem(env, id, payload as any, predictedBytes);
			if (!updated.ok) return jsonResponse({ status: 'error', result: 'Advertisement payload limit exceeded' }, 400);
			return jsonResponse({ status: 'ok', result: updated.summary });
		} catch (error) {
			if (error instanceof Error && error.message === 'advertisement_payload_limit_exceeded') return jsonResponse({ status: 'error', result: 'Advertisement payload limit exceeded' }, 400);
			throw error;
		}
	}

	if (path === '/advertisement/items/delete' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const id = String(body?.id ?? '').trim();
		if (!id) return jsonResponse({ status: 'error', result: 'id を指定してください。' }, 400);
		await deleteAdvertisementItem(env, id);
		return jsonResponse({ status: 'ok', result: true });
	}

	if (path === '/advertisement/items/reorder' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const scopeId = String(body?.scopeId ?? '').trim();
		const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds : [];
		if (!scopeId) return jsonResponse({ status: 'error', result: 'scopeId を指定してください。' }, 400);
		const reordered = await reorderAdvertisementItems(env, scopeId, orderedIds);
		if (!reordered.ok) return jsonResponse({ status: 'error', result: '並び順データが不正です。' }, 400);
		return jsonResponse({ status: 'ok', result: reordered.summary });
	}

	if (path === '/advertisement/items/convert' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const id = String(body?.id ?? '').trim();
		const platform = String(body?.platform ?? '').trim() as AdvertisementPlatform;
		const hasAlpha = typeof body?.hasAlpha === 'boolean' ? body.hasAlpha : false;
		const imageWidth = clampInteger(Number(body?.imageWidth), 0, 32768, 0);
		const imageHeight = clampInteger(Number(body?.imageHeight), 0, 32768, 0);
		if (!id) return jsonResponse({ status: 'error', result: 'id を指定してください。' }, 400);
		if (platform !== 'pc' && platform !== 'android' && platform !== 'ios') return jsonResponse({ status: 'error', result: 'platform は pc/android/ios を指定してください。' }, 400);
		if (imageWidth <= 0 || imageHeight <= 0) return jsonResponse({ status: 'error', result: 'imageWidth/imageHeight を指定してください。' }, 400);
		const item = await getAdvertisementItemById(env, id);
		if (!item) return jsonResponse({ status: 'error', result: 'not_found' }, 404);
		if (!item.Image.trim()) return jsonResponse({ status: 'error', result: 'image_not_found' }, 400);
		try {
			const converted = await convertPromotionImage(env, platform, item.Image, hasAlpha, imageWidth, imageHeight);
			const summary = await saveAdvertisementPlatformImage(env, id, platform, converted.base64, converted.imageWidth, converted.imageHeight, converted.textureFormat);
			return jsonResponse({ status: 'ok', result: { platform, textureFormat: converted.textureFormat, outputFormat: converted.outputFormat, imageWidth: converted.imageWidth, imageHeight: converted.imageHeight, outputBytes: converted.outputBytes, contentType: converted.contentType, summary } });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return jsonResponse({ status: 'error', result: message }, 502);
		}
	}

	if (path === '/advertisement/items/clear-converted' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const id = String(body?.id ?? '').trim();
		if (!id) return jsonResponse({ status: 'error', result: 'id を指定してください。' }, 400);
		const item = await getAdvertisementItemById(env, id);
		if (!item) return jsonResponse({ status: 'error', result: 'not_found' }, 404);
		const summary = await clearAdvertisementPlatformImages(env, id);
		return jsonResponse({ status: 'ok', result: summary });
	}

	if (path === '/advertisement/items/download' && request.method === 'GET') {
		const id = String(url.searchParams.get('id') ?? '').trim();
		const platform = String(url.searchParams.get('platform') ?? '').trim() as AdvertisementPlatform;
		if (!id) return jsonResponse({ status: 'error', result: 'id を指定してください。' }, 400);
		if (platform !== 'pc' && platform !== 'android' && platform !== 'ios') return jsonResponse({ status: 'error', result: 'platform は pc/android/ios を指定してください。' }, 400);
		const binary = await getAdvertisementPlatformBinary(env, id, platform);
		if (!binary) return jsonResponse({ status: 'error', result: 'not_found' }, 404);
		return new Response(base64ToUint8Array(binary.base64), {
			status: 200,
			headers: {
				'content-type': binary.contentType,
				'cache-control': 'no-store',
				'content-disposition': `attachment; filename="${binary.id}_${platform}.${binary.extension}"`,
			},
		});
	}

	if (path === '/advertisement/gist/status' && request.method === 'GET') {
		const scopeId = String(url.searchParams.get('scopeId') ?? '').trim();
		if (!scopeId) return jsonResponse({ status: 'error', result: 'scopeId を指定してください。' }, 400);
		const scope = await getAdvertisementScopeById(env, scopeId);
		if (!scope) return jsonResponse({ status: 'error', result: 'not_found' }, 404);
		try {
			return jsonResponse({ status: 'ok', result: await getAdvertisementGistfsStatus(env, scope.ScopeKey) });
		} catch (error) {
			return jsonResponse({ status: 'error', result: normalizeGistfsManagerError(error) }, 502);
		}
	}

	if (path === '/advertisement/gist/upload-platform' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const scopeId = String(body?.scopeId ?? '').trim();
		const platform = String(body?.platform ?? '').trim() as AdvertisementPlatform;
		if (!scopeId) return jsonResponse({ status: 'error', result: 'scopeId を指定してください。' }, 400);
		if (platform !== 'pc' && platform !== 'android' && platform !== 'ios') return jsonResponse({ status: 'error', result: 'platform は pc/android/ios を指定してください。' }, 400);
		const scope = await getAdvertisementScopeById(env, scopeId);
		if (!scope) return jsonResponse({ status: 'error', result: 'not_found' }, 404);
		try {
			return jsonResponse({ status: 'ok', result: await uploadAdvertisementPlatformToGistfs(env, scope.ScopeKey, scope.ID, platform) });
		} catch (error) {
			return jsonResponse({ status: 'error', result: normalizeGistfsManagerError(error) }, 502);
		}
	}

	if (path === '/gistfs/uploads' && request.method === 'GET') {
		try {
			return jsonResponse({ status: 'ok', result: await listGistfsFiles(env) });
		} catch (error) {
			return jsonResponse({ status: 'error', result: normalizeGistfsManagerError(error) }, 502);
		}
	}

	if (path === '/gistfs/uploads/delete' && request.method === 'POST') {
		const body = await readJsonBody(request);
		const targetPath = String(body?.path ?? '').trim();
		if (!targetPath) return jsonResponse({ status: 'error', result: 'path を指定してください。' }, 400);
		try {
			return jsonResponse({ status: 'ok', result: await deleteGistfsFile(env, targetPath) });
		} catch (error) {
			return jsonResponse({ status: 'error', result: normalizeGistfsManagerError(error) }, 502);
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
					'公開 GET /PromotionList?p=pc|android|ios は廃止済み',
					'配布用 JSON は管理画面から gistfs へ pc / android / ios の 3 本を順番にアップロードする',
					'gistfs ファイル名: PromotionList.pc.json / PromotionList.android.json / PromotionList.ios.json',
					'各ファイルの JSON は対象プラットフォーム 1 本分だけを含む',
					'トップレベル構造: { "Avatar": PromotionItem[], "World": PromotionItem[] }',
					'PromotionItem フィールド: ID, Title, Anchor, Description, Link, Image, ImageWidth, ImageHeight, ImageTextureFormat',
					'Image は変換済みプラットフォーム別画像Base64。未変換の場合は空文字になる',
					'ImageWidth / ImageHeight は変換元画像サイズ、ImageTextureFormat は crunch API が返した texture format',
					'最小例: { "Avatar": [{ "ID": "avatar_001", "Title": "Sample", "Anchor": "sample", "Description": "text", "Link": "https://example.com", "Image": "...base64...", "ImageWidth": 512, "ImageHeight": 512, "ImageTextureFormat": "DXT5" }], "World": [] }',
					'アップロード時は gistfs の PUT /files/{path}/content を使い、Worker から ReadableStream で転送する',
					'管理画面には各プラットフォームの raw URL と最終アップロード日時を表示する',
					'Gist 管理画面ではアップロード済みファイルの一覧確認と削除ができる',
					'元データは D1 内のプラットフォーム別キャッシュJSONを再利用するため、アップロード前に変換を済ませておく',
				],
			},
		});
	}

	if (path === '/docs/advertisement' && request.method === 'GET') {
		return jsonResponse({
			status: 'ok',
			result: {
				title: 'Advertisement API 仕様',
				body: [
					'Advertisement は Scope ごとに配布ファイルを分ける',
					'ScopeKey はファイル名に使う固定キー。Scope 名を変更しても ScopeKey と既存 raw URL は維持する',
					'JSON 内容には ScopeKey / ScopeName などの Scope 情報は含めない',
					'gistfs ファイル名: adv_{scopeKey}_pc.json / adv_{scopeKey}_android.json / adv_{scopeKey}_ios.json',
					'各ファイルの JSON は選択 Scope の対象プラットフォーム 1 本分の配列だけを含む',
					'トップレベル構造: AdvertisementExportItem[]',
					'AdvertisementExportItem フィールド: Title, Link, Image, ImageWidth, ImageHeight, ImageTextureFormat',
					'Image は変換済みプラットフォーム別画像Base64。未変換の場合は空文字になる',
					'ImageWidth / ImageHeight は変換元画像サイズ、ImageTextureFormat は crunch API が返した texture format',
					'順序は管理画面の並び順（display_order）に従う',
					'最小例: [{ "Title": "Sample", "Link": "https://example.com", "Image": "...base64...", "ImageWidth": 512, "ImageHeight": 256, "ImageTextureFormat": "ETC2_RGBA8" }]',
					'アップロード時は gistfs の PUT /files/{path}/content を使い、Worker から ReadableStream で転送する',
					'Gist 管理画面でファイルを削除した場合、Advertisement 面板の gistfs 状態にも反映される',
				],
			},
		});
	}

	return jsonResponse({ status: 'error', result: 'Not Found' }, 404);
}

function base64ToUint8Array(base64: string) {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

function normalizeGistfsManagerError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	if (message === 'vpc_service_missing') return 'VPC_SERVICE binding が未設定です。';
	if (message === 'path_required') return 'path を指定してください。';
	return message;
}
