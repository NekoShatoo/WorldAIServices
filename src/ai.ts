import OpenAI from 'openai';
import { Env, LlmRequestEntry, TranslationOutcome } from './types';
import { buildTranslationMessages, buildTranslationPromptText, clampInteger, countCharacters, buildPreviewText, safeMetricNumber } from './utils';
import { recordLlmRequest } from './database';

/**
 * Executes a translation request to the configured AI provider.
 * 
 * @param env Worker environment bindings.
 * @param lang Target language code.
 * @param text Source text to translate.
 * @param metadata Additional metadata for logging.
 * @param waitUntil Optional ExecutionContext/State waitUntil to allow non-blocking logging.
 */
export async function requestAiTranslation(
	env: Env,
	lang: string,
	text: string,
	metadata: any = {},
	waitUntil?: (promise: Promise<any>) => void
): Promise<TranslationOutcome & { result?: string; reason?: string }> {
	const mode = env.AI_PROVIDER_MODE === 'openai-chat' ? 'openai-chat' : 'result-json';
	const promptText = buildTranslationPromptText(lang);
	const messages = buildTranslationMessages(lang, text);
	const timeoutMs = clampInteger(Number(env.AI_TIMEOUT_MS), 1000, 60000, 10000);
	const startedAt = Date.now();

	const controller = new AbortController();
	const timerId = setTimeout(() => {
		console.warn(`[AI] Request timed out for lang=${lang} after ${timeoutMs}ms`);
		controller.abort('timeout');
	}, timeoutMs);

	try {
		console.log(`[AI] Starting ${mode} request for lang=${lang}, textLength=${countCharacters(text)}`);
		let result: string;
		if (mode === 'openai-chat') {
			if (!env.AI_MODEL) throw new Error('AI_MODEL missing');
			const openai = new OpenAI({ apiKey: env.AI_API_KEY, baseURL: env.AI_API_URL });
			const provider = buildOpenRouterProviderPreferences(env);
			const response = await openai.chat.completions.create(
				{
					model: env.AI_MODEL,
					messages: messages as any,
					temperature: 0,
					...(provider ? { provider } : {}),
				},
				{ signal: controller.signal }
			);
			result = response.choices[0]?.message?.content ?? '';
			if (!result) throw new Error('openai_content_missing');
		} else {
			const response = await fetchResultJsonProvider(env, controller.signal, promptText, text);
			if (!response.ok) throw buildAiProviderError(response.reason, response.publicReason, response.statusCode);
			result = response.result!;
		}

		const cleaned = result.trim();
		const latencyMs = Date.now() - startedAt;
		console.log(`[AI] Success: lang=${lang}, latency=${latencyMs}ms`);

		const succeeded = { ok: true, statusCode: 200, source: 'ai' as const, result: cleaned, latencyMs };
		const logPromise = recordLlmRequest(env, buildLlmRequestEntry(metadata, mode, lang, text, succeeded));
		
		if (waitUntil) {
			waitUntil(logPromise);
		} else {
			await logPromise;
		}

		return succeeded;
	} catch (error: any) {
		const latencyMs = Date.now() - startedAt;
		console.error(`[AI] Failed: lang=${lang}, error=${error instanceof Error ? error.message : String(error)}`);

		const failed = buildAiFailureResponse(error, latencyMs);
		const logPromise = recordLlmRequest(env, buildLlmRequestEntry(metadata, mode, lang, text, failed));
		
		if (waitUntil) {
			waitUntil(logPromise);
		} else {
			await logPromise;
		}

		return { ...failed, source: 'ai' as const };
	} finally {
		clearTimeout(timerId);
	}
}

function buildOpenRouterProviderPreferences(env: Env) {
	const order = parseCommaSeparatedList(env.OPENROUTER_PROVIDER_ORDER);
	if (order.length === 0 && !isOpenRouterApiUrl(env.AI_API_URL)) return null;

	return {
		sort: 'latency',
		...(order.length > 0 ? { order } : {}),
	};
}

function parseCommaSeparatedList(value: any) {
	if (typeof value !== 'string') return [];
	return value
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function isOpenRouterApiUrl(value: string) {
	try {
		return new URL(value).hostname.toLowerCase().endsWith('openrouter.ai');
	} catch {
		return value.toLowerCase().includes('openrouter.ai');
	}
}

function buildAiFailureResponse(error: any, latencyMs: number) {
	if (error === 'timeout' || (error instanceof Error && error.name === 'AbortError') || String(error).toLowerCase().includes('timeout')) {
		return {
			ok: false as const,
			statusCode: 504,
			reason: 'timeout',
			publicReason: `AI request timeout (latencyMs=${latencyMs})`,
			latencyMs,
		};
	}

	const reason = error instanceof Error ? error.message : String(error);
	const statusCode = normalizeErrorStatusCode(error);
	const publicErrorText = extractPublicErrorText(error, reason);
	return {
		ok: false as const,
		statusCode,
		reason,
		publicReason: publicErrorText,
		latencyMs,
	};
}

function buildAiProviderError(reason: string, publicReason: string, statusCode: number) {
	const error = new Error(reason);
	return Object.assign(error, { publicReason, statusCode });
}

function normalizeErrorStatusCode(error: any) {
	const statusCode = normalizeHttpErrorStatusCode(error?.statusCode ?? error?.status);
	return statusCode ?? 502;
}

function normalizeHttpErrorStatusCode(value: any) {
	const statusCode = Number(value);
	if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) return null;
	return statusCode;
}

function extractPublicErrorText(error: any, fallback: string) {
	const directPublicReason = typeof error?.publicReason === 'string' ? error.publicReason : '';
	if (directPublicReason.trim().length > 0) return sanitizePublicErrorText(directPublicReason);

	const providerError = error?.error;
	if (typeof providerError === 'string' && providerError.trim().length > 0) return sanitizePublicErrorText(providerError);
	if (providerError && typeof providerError === 'object') return sanitizePublicErrorText(JSON.stringify(providerError));

	return sanitizePublicErrorText(fallback);
}

function sanitizePublicErrorText(value: string) {
	const normalized = value.trim().length > 0 ? value : 'unknown_error';
	return normalized
		.replace(/https?:\/\/[^\s"']+/gi, '[redacted-url]')
		.replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[redacted-token]')
		.replace(/\bsk-[A-Za-z0-9_-]+\b/g, '[redacted-key]')
		.replace(/\b[A-Za-z0-9_-]{24,}\b/g, (token) => (looksSensitiveToken(token) ? '[redacted-secret]' : token))
		.slice(0, 2000);
}

function looksSensitiveToken(token: string) {
	const hasLetter = /[A-Za-z]/.test(token);
	const hasDigit = /\d/.test(token);
	return hasLetter && hasDigit;
}

function buildLlmRequestEntry(metadata: any, providerMode: string, lang: string, text: string, result: any): LlmRequestEntry {
	return {
		source: typeof metadata?.source === 'string' && metadata.source.length > 0 ? metadata.source : 'unknown',
		providerMode,
		lang,
		inputChars: countCharacters(text),
		promptVersion: clampInteger(Number(metadata?.promptVersion), 0, 1000000, 0),
		status: result.ok ? 'ok' : 'error',
		latencyMs: safeMetricNumber(result.latencyMs),
		publicReason: result.ok ? '' : String(result.publicReason ?? ''),
		inputPreview: buildPreviewText(text, 120),
		outputPreview: result.ok ? buildPreviewText(result.result, 120) : '',
		occurredAt: new Date().toISOString(),
	};
}

async function fetchResultJsonProvider(env: Env, signal: AbortSignal, prompt: string, input: string) {
	const response = await fetch(env.AI_API_URL, {
		method: 'POST',
		signal,
		headers: {
			authorization: `Bearer ${env.AI_API_KEY}`,
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			prompt,
			input,
		}),
	});
	const responseText = await response.text();
	const upstreamStatusCode = normalizeHttpErrorStatusCode(response.status) ?? 502;

	if (!response.ok) {
		return {
			ok: false,
			statusCode: upstreamStatusCode,
			reason: `upstream_status_${response.status}`,
			publicReason: buildUpstreamErrorText(responseText, response.statusText, `upstream_status_${response.status}`),
		};
	}

	let payload: any;
	try {
		payload = JSON.parse(responseText);
	} catch {
		return {
			ok: false,
			statusCode: 502,
			reason: 'upstream_json_parse_failed',
			publicReason: buildUpstreamErrorText(responseText, response.statusText, 'upstream_json_parse_failed'),
		};
	}

	if (!payload || typeof payload.result !== 'string') {
		return {
			ok: false,
			statusCode: 502,
			reason: 'upstream_result_missing',
			publicReason: buildUpstreamErrorText(responseText, response.statusText, 'upstream_result_missing'),
		};
	}

	return {
		ok: true,
		result: payload.result,
	};
}

function buildUpstreamErrorText(responseText: string, statusText: string, fallback: string) {
	const sourceText = responseText.trim().length > 0 ? responseText : statusText.trim().length > 0 ? statusText : fallback;
	return sanitizePublicErrorText(sourceText);
}
