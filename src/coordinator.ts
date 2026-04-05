import { Env, TranslationCoordinatorPayload } from './types';
import { jsonResponse } from './utils';
import { getCachedTranslation, putCachedTranslation } from './database';
import { requestAiTranslation } from './ai';

export class TranslationCoordinator implements DurableObject {
	private inFlight: Promise<any> | null = null;

	constructor(public state: DurableObjectState, public env: Env) {}

	async fetch(request: Request): Promise<Response> {
		let payload: TranslationCoordinatorPayload;
		try {
			payload = await request.json();
		} catch {
			return jsonResponse({ ok: false, publicReason: 'Invalid coordinator payload' }, 400);
		}

		if (payload?.action !== 'translate') return jsonResponse({ ok: false, publicReason: 'Invalid coordinator action' }, 400);

		if (this.inFlight === null) this.inFlight = this.runTranslation(payload);

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
				return {
					ok: true,
					statusCode: 200,
					source: 'cache',
					latencyMs: 0,
					result: cached,
				};
			}
		}

		const aiResult = await requestAiTranslation(this.env, payload.lang, payload.text, {
			source: payload.requestSource,
			promptVersion: payload.promptVersion,
		});

		if (!aiResult.ok) {
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
