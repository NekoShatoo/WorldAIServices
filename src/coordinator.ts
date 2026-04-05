import { Env, TranslationCoordinatorPayload } from './types';
import { jsonResponse } from './utils';
import { getCachedTranslation, putCachedTranslation } from './database';
import { requestAiTranslation } from './ai';

export class TranslationCoordinator implements DurableObject {
	private inFlight: Promise<any> | null = null;

	constructor(public state: DurableObjectState, public env: Env) {}

	async fetch(request: Request): Promise<Response> {
		console.log(`[Coordinator] Incoming request: ${request.url}`);
		
		let payload: TranslationCoordinatorPayload;
		try {
			payload = await request.json();
		} catch {
			console.error(`[Coordinator] Failed to parse JSON body`);
			return jsonResponse({ ok: false, publicReason: 'Invalid coordinator payload' }, 400);
		}

		if (payload?.action !== 'translate') {
			console.warn(`[Coordinator] Invalid action: ${payload?.action}`);
			return jsonResponse({ ok: false, publicReason: 'Invalid coordinator action' }, 400);
		}

		// Simplified in-flight pattern: clear on each return
		if (this.inFlight === null) {
			console.log(`[Coordinator] Starting new in-flight translation for key: ${payload.cacheKey}`);
			this.inFlight = this.runTranslation(payload);
		} else {
			console.log(`[Coordinator] Returning existing in-flight promise for key: ${payload.cacheKey}`);
		}

		try {
			const result = await this.inFlight;
			return jsonResponse(result, result.statusCode ?? 200);
		} finally {
			this.inFlight = null;
		}
	}

	async runTranslation(payload: TranslationCoordinatorPayload) {
		if (payload.useCache) {
			const cached = await getCachedTranslation(this.env, payload.cacheKey);
			if (cached !== null) {
				console.log(`[Coordinator] Cache hit: ${payload.cacheKey}`);
				return {
					ok: true,
					statusCode: 200,
					source: 'cache',
					latencyMs: 0,
					result: cached,
				};
			}
		}

		console.log(`[Coordinator] Cache miss, requesting AI translation for lang=${payload.lang}`);
		
		// Use state.waitUntil to ensure logging doesn't block the main response
		const aiResult = await requestAiTranslation(
			this.env, 
			payload.lang, 
			payload.text, 
			{
				source: payload.requestSource,
				promptVersion: payload.promptVersion,
			},
			this.state.waitUntil.bind(this.state)
		);

		if (!aiResult.ok) {
			console.error(`[Coordinator] AI request failed: ${aiResult.reason}`);
			return {
				ok: false,
				statusCode: 502,
				source: 'ai',
				latencyMs: aiResult.latencyMs,
				publicReason: aiResult.publicReason,
				reason: aiResult.reason,
			};
		}

		if (payload.writeCache) {
			console.log(`[Coordinator] Writing to cache: ${payload.cacheKey}`);
			await putCachedTranslation(this.env, payload.cacheKey, payload.lang, payload.promptVersion, aiResult.result!, payload.cacheTtlSeconds);
		}

		return {
			ok: true,
			statusCode: 200,
			source: 'ai',
			latencyMs: aiResult.latencyMs,
			result: aiResult.result,
		};
	}
}
