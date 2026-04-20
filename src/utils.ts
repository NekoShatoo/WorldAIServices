import { TRANSLATION_PROMPTS } from './constants';

export const JSON_HEADERS = {
	'access-control-allow-origin': '*',
	'access-control-allow-headers': 'authorization,content-type,x-signature-ed25519,x-signature-timestamp,x-unity-version',
	'access-control-allow-methods': 'GET,POST,OPTIONS',
	'cache-control': 'no-store',
	'content-type': 'application/json; charset=UTF-8',
};

export const MAINTENANCE_BATCH_SIZE = 500;

export function jsonResponse(data: any, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: JSON_HEADERS,
	});
}

export function countCharacters(text: string): number {
	return Array.from(text).length;
}

export function clampInteger(value: number, min: number, max: number, fallback: number): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.max(min, Math.min(max, Math.floor(value)));
}

export function buildTranslationMessages(lang: string, text: string) {
	const prompt = getTranslationPrompt(lang);
	return [...prompt, { role: 'user', content: text }];
}

export function buildTranslationPromptText(lang: string) {
	return getTranslationPrompt(lang)
		.map((message) => `${message.role.toUpperCase()}: ${message.content}`)
		.join('\n\n');
}

function getTranslationPrompt(lang: string) {
	const prompt = TRANSLATION_PROMPTS[lang] ?? TRANSLATION_PROMPTS.fallback;
	return prompt.map((message) => ({
		role: message.role,
		content: replaceFallbackLanguage(message.content, lang),
	}));
}

function replaceFallbackLanguage(content: string, lang: string) {
	return String(content).split('{{LANG}}').join(lang);
}

export async function buildCacheKey(lang: string, text: string, promptVersion: number) {
	const source = `${promptVersion}|${lang}|${text}`;
	const data = new TextEncoder().encode(source);
	const digest = await crypto.subtle.digest('SHA-256', data);
	const bytes = Array.from(new Uint8Array(digest));
	const hash = bytes.map((value) => value.toString(16).padStart(2, '0')).join('');
	return `cache:${lang}:v${promptVersion}:${hash}`;
}

export function parseStoredJsonObject(json: any) {
	if (typeof json !== 'string') return json;
	try {
		return JSON.parse(json);
	} catch {
		return json;
	}
}

export function buildPreviewText(value: any, maxLength: number) {
	const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
	if (normalized.length <= maxLength) return normalized;
	return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function safeMetricNumber(value: any): number {
	const numeric = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}
