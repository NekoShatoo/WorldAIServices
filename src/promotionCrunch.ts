import { Env, PromotionPlatform } from './types';

export interface PromotionCrunchResult {
	platform: PromotionPlatform;
	outputFormat: 'crn' | 'ktx';
	textureFormat: string;
	contentType: string;
	outputBytes: number;
	base64: string;
}

export async function convertPromotionImage(env: Env, platform: PromotionPlatform, sourceImageBase64: string, hasAlpha: boolean) {
	if (!env.CRUNCH_API_TOKEN) throw new Error('crunch_api_token_missing');
	if (!env.CRUNCH_API_URL) throw new Error('crunch_api_url_missing');

	const format = getCrunchFormat(platform, hasAlpha);
	const formData = new FormData();
	formData.append('image', buildImageBlobFromBase64(sourceImageBase64), `promotion-input.${guessSourceExtension(sourceImageBase64)}`);
	formData.append(
		'options',
		JSON.stringify({
			fileformat: format.fileformat,
			textureFormat: format.textureFormat,
			mipMode: 'None',
			yflip: true,
		})
	);

	const response = await fetch(env.CRUNCH_API_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.CRUNCH_API_TOKEN}`,
		},
		body: formData,
	});
	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`crunch_request_failed:${response.status}:${errorText}`);
	}

	const buffer = await response.arrayBuffer();
	return {
		platform,
		outputFormat: format.fileformat,
		textureFormat: format.textureFormat,
		contentType: response.headers.get('content-type') ?? 'application/octet-stream',
		outputBytes: buffer.byteLength,
		base64: arrayBufferToBase64(buffer),
	} satisfies PromotionCrunchResult;
}

function getCrunchFormat(platform: PromotionPlatform, hasAlpha: boolean) {
	switch (platform) {
		case 'pc':
			return {
				fileformat: 'crn' as const,
				textureFormat: hasAlpha ? 'DXT5' : 'DXT1',
			};
		case 'android':
			return {
				fileformat: 'ktx' as const,
				textureFormat: hasAlpha ? 'ETC2' : 'ETC1',
			};
		case 'ios':
			return {
				fileformat: 'ktx' as const,
				textureFormat: hasAlpha ? 'ETC2' : 'ETC1',
			};
		default:
			throw new Error('unsupported_promotion_platform');
	}
}

function buildImageBlobFromBase64(source: string) {
	const normalized = String(source ?? '').trim();
	const base64 = normalized.startsWith('data:') ? normalized.slice(normalized.indexOf(',') + 1) : normalized;
	const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
	return new Blob([bytes], { type: 'image/png' });
}

function guessSourceExtension(source: string) {
	const normalized = String(source ?? '');
	if (normalized.startsWith('data:image/jpeg')) return 'jpg';
	if (normalized.startsWith('data:image/webp')) return 'webp';
	return 'png';
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
	let binary = '';
	const bytes = new Uint8Array(buffer);
	for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
	return btoa(binary);
}
