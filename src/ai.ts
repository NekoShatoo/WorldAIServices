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
			const response = await openai.chat.completions.create(
				{
					model: env.AI_MODEL,
					messages: messages as any,
					temperature: 0,
				},
				{ signal: controller.signal }
			);
			result = response.choices[0]?.message?.content ?? '';
			if (!result) throw new Error('openai_content_missing');
		} else {
			const response = await fetchResultJsonProvider(env, controller.signal, promptText, text);
			if (!response.ok) throw new Error(response.reason);
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

		return { ...failed, statusCode: 502, source: 'ai' as const };
	} finally {
		clearTimeout(timerId);
	}
}

function buildAiFailureResponse(error: any, latencyMs: number) {
	if (error === 'timeout' || (error instanceof Error && error.name === 'AbortError') || String(error).toLowerCase().includes('timeout')) {
		return {
			ok: false as const,
			reason: 'timeout',
			publicReason: `AI request timeout (latencyMs=${latencyMs})`,
			latencyMs,
		};
	}

	const reason = error instanceof Error ? error.message : String(error);
	const sanitizedReason = sanitizePublicErrorText(reason);
	return {
		ok: false as const,
		reason,
		publicReason: `AI request failed: ${sanitizedReason}`,
		latencyMs,
	};
}

function sanitizePublicErrorText(value: string) {
	const normalized = value.trim().length > 0 ? value : 'unknown_error';
	return normalized
		.replace(/https?:\/\/[^\s"']+/gi, '[redacted-url]')
		.replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[redacted-token]')
		.replace(/\bsk-[A-Za-z0-9_-]+\b/g, '[redacted-key]')
		.replace(/\b[A-Za-z0-9_-]{24,}\b/g, (token) => (looksSensitiveToken(token) ? '[redacted-secret]' : token))
		.slice(0, 220);
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

	if (!response.ok) {
		return {
			ok: false,
			reason: `upstream_status_${response.status}`,
			publicReason: `AI upstream status ${response.status}`,
		};
	}

	const payload: any = await response.json();
	if (!payload || typeof payload.result !== 'string') {
		return {
			ok: false,
			reason: 'upstream_result_missing',
			publicReason: 'AI result missing',
		};
	}

	return {
		ok: true,
		result: payload.result,
	};
}
