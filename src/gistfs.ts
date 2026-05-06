import { getAdvertisementGistPath, getAdvertisementPlatformPayloadText, getPromotionGistPath, getPromotionPlatformPayloadText } from './database';
import { AdvertisementPlatform, Env, GistfsFileMetadata, PromotionPlatform } from './types';

const PROMOTION_GIST_SOURCE_KEY = 'PromotionList';
const ADVERTISEMENT_GIST_SOURCE_KEY = 'Advertisement';

interface GistfsResponsePayload {
	path?: string;
	size?: number;
	sha256?: string;
	raw_url?: string;
	mime_type?: string;
	updated_at?: string;
	error?: string;
	status?: number;
	files?: Array<{
		path?: string;
		size?: number;
		sha256?: string;
		raw_url?: string;
		mime_type?: string;
		updated_at?: string;
	}>;
}

export async function uploadPromotionPlatformToGistfs(env: Env, platform: PromotionPlatform): Promise<GistfsFileMetadata> {
	const path = getPromotionGistPath(platform);
	const payloadText = await getPromotionPlatformPayloadText(env, platform);
	const response = await getGistfsBinding(env).fetch(`http://localhost/files/${encodeURIComponent(path)}/content`, {
		method: 'PUT',
		headers: {
			'content-type': 'application/json; charset=UTF-8',
			'x-gistfs-commit-message': `${path} を更新`,
		},
		body: new Blob([payloadText]).stream(),
	});
	const payload = await readGistfsResponsePayload(response);
	if (!response.ok) throw new Error(buildGistfsErrorMessage('upload_failed', response.status, payload));

	const metadata = {
		path: String(payload.path ?? path),
		size: normalizeGistfsNumber(payload.size, new TextEncoder().encode(payloadText).length),
		sha256: String(payload.sha256 ?? ''),
		rawUrl: String(payload.raw_url ?? ''),
		mimeType: String(payload.mime_type ?? 'application/json'),
		uploadedAt: new Date().toISOString(),
		sourceKey: PROMOTION_GIST_SOURCE_KEY,
		platform,
	} satisfies GistfsFileMetadata;
	return metadata;
}

export async function deleteGistfsFile(env: Env, path: string) {
	const normalizedPath = String(path ?? '').trim();
	if (!normalizedPath) throw new Error('path_required');

	const response = await getGistfsBinding(env).fetch(`http://localhost/files/${encodeURIComponent(normalizedPath)}?message=${encodeURIComponent(`${normalizedPath} を削除`)}`, {
		method: 'DELETE',
	});
	const payload = await readGistfsResponsePayload(response);
	if (!response.ok) throw new Error(buildGistfsErrorMessage('delete_failed', response.status, payload));

	return {
		deleted: true,
		path: normalizedPath,
	};
}

export async function uploadAdvertisementPlatformToGistfs(env: Env, scopeKey: string, scopeId: string, platform: AdvertisementPlatform): Promise<GistfsFileMetadata> {
	const path = getAdvertisementGistPath(scopeKey, platform);
	const payloadText = await getAdvertisementPlatformPayloadText(env, scopeId, platform);
	const response = await getGistfsBinding(env).fetch(`http://localhost/files/${encodeURIComponent(path)}/content`, {
		method: 'PUT',
		headers: {
			'content-type': 'application/json; charset=UTF-8',
			'x-gistfs-commit-message': `${path} を更新`,
		},
		body: new Blob([payloadText]).stream(),
	});
	const payload = await readGistfsResponsePayload(response);
	if (!response.ok) throw new Error(buildGistfsErrorMessage('upload_failed', response.status, payload));
	return {
		path: String(payload.path ?? path),
		size: normalizeGistfsNumber(payload.size, new TextEncoder().encode(payloadText).length),
		sha256: String(payload.sha256 ?? ''),
		rawUrl: String(payload.raw_url ?? ''),
		mimeType: String(payload.mime_type ?? 'application/json'),
		uploadedAt: String(payload.updated_at ?? ''),
		sourceKey: ADVERTISEMENT_GIST_SOURCE_KEY,
		platform,
	};
}

export async function listGistfsFiles(env: Env): Promise<GistfsFileMetadata[]> {
	const response = await getGistfsBinding(env).fetch('http://localhost/files', {
		method: 'GET',
	});
	const payload = await readGistfsResponsePayload(response);
	if (!response.ok) throw new Error(buildGistfsErrorMessage('list_failed', response.status, payload));
	return Array.isArray(payload.files) ? payload.files.map((entry) => normalizeGistfsMetadata(entry, '', '')) : [];
}

export async function getPromotionGistfsStatus(env: Env) {
	const platforms = {
		pc: await getGistfsPromotionMetadata(env, 'pc'),
		android: await getGistfsPromotionMetadata(env, 'android'),
		ios: await getGistfsPromotionMetadata(env, 'ios'),
	};
	return {
		sourceKey: PROMOTION_GIST_SOURCE_KEY,
		platforms,
	};
}

export async function getAdvertisementGistfsStatus(env: Env, scopeKey: string) {
	const platforms = {
		pc: await getGistfsAdvertisementMetadata(env, scopeKey, 'pc'),
		android: await getGistfsAdvertisementMetadata(env, scopeKey, 'android'),
		ios: await getGistfsAdvertisementMetadata(env, scopeKey, 'ios'),
	};
	return {
		sourceKey: ADVERTISEMENT_GIST_SOURCE_KEY,
		platforms,
	};
}

function getGistfsBinding(env: Env) {
	if (!env.VPC_SERVICE) throw new Error('vpc_service_missing');
	return env.VPC_SERVICE;
}

async function getGistfsPromotionMetadata(env: Env, platform: PromotionPlatform) {
	const path = getPromotionGistPath(platform);
	const response = await getGistfsBinding(env).fetch(`http://localhost/files/${encodeURIComponent(path)}`, {
		method: 'GET',
	});
	if (response.status === 404) return null;
	const payload = await readGistfsResponsePayload(response);
	if (!response.ok) throw new Error(buildGistfsErrorMessage('metadata_failed', response.status, payload));
	return normalizeGistfsMetadata(payload, PROMOTION_GIST_SOURCE_KEY, platform);
}

async function getGistfsAdvertisementMetadata(env: Env, scopeKey: string, platform: AdvertisementPlatform) {
	const path = getAdvertisementGistPath(scopeKey, platform);
	const response = await getGistfsBinding(env).fetch(`http://localhost/files/${encodeURIComponent(path)}`, {
		method: 'GET',
	});
	if (response.status === 404) return null;
	const payload = await readGistfsResponsePayload(response);
	if (!response.ok) throw new Error(buildGistfsErrorMessage('metadata_failed', response.status, payload));
	return normalizeGistfsMetadata(payload, ADVERTISEMENT_GIST_SOURCE_KEY, platform);
}

async function readGistfsResponsePayload(response: Response): Promise<GistfsResponsePayload> {
	const text = await response.text();
	if (!text.trim()) return {};
	try {
		return JSON.parse(text);
	} catch {
		return {
			error: text,
			status: response.status,
		};
	}
}

function buildGistfsErrorMessage(prefix: string, status: number, payload: GistfsResponsePayload) {
	const reason = String(payload.error ?? payload.status ?? '').trim();
	return reason ? `${prefix}:${status}:${reason}` : `${prefix}:${status}`;
}

function normalizeGistfsNumber(value: unknown, fallback: number) {
	const numeric = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : fallback;
}

function normalizeGistfsMetadata(value: GistfsResponsePayload | NonNullable<GistfsResponsePayload['files']>[number], sourceKey: string, platform: PromotionPlatform | ''): GistfsFileMetadata {
	const path = String(value?.path ?? '');
	const resolvedSourceKey = sourceKey || inferGistSourceKey(path);
	const resolvedPlatform = platform || inferPromotionPlatform(path);
	return {
		path,
		size: normalizeGistfsNumber(value?.size, 0),
		sha256: String(value?.sha256 ?? ''),
		rawUrl: String(value?.raw_url ?? ''),
		mimeType: String(value?.mime_type ?? 'application/octet-stream'),
		uploadedAt: String(value?.updated_at ?? ''),
		sourceKey: resolvedSourceKey,
		platform: resolvedPlatform,
	};
}

function inferGistSourceKey(path: string) {
	if (path.startsWith('PromotionList.')) return PROMOTION_GIST_SOURCE_KEY;
	if (path.startsWith('adv_')) return ADVERTISEMENT_GIST_SOURCE_KEY;
	return '';
}

function inferPromotionPlatform(path: string): PromotionPlatform | '' {
	if (path === 'PromotionList.pc.json') return 'pc';
	if (path === 'PromotionList.android.json') return 'android';
	if (path === 'PromotionList.ios.json') return 'ios';
	if (path.startsWith('adv_') && path.endsWith('_pc.json')) return 'pc';
	if (path.startsWith('adv_') && path.endsWith('_android.json')) return 'android';
	if (path.startsWith('adv_') && path.endsWith('_ios.json')) return 'ios';
	return '';
}
