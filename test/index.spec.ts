import { SELF } from "cloudflare:test";
import { describe, it, expect, vi, afterEach } from "vitest";
import { requestAiTranslation } from "../src/ai";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("worker routes", () => {
	it("/mgr returns html", async () => {
		const response = await SELF.fetch("https://example.com/mgr");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
	});

	it("removed PromotionList route returns 404", async () => {
		const response = await SELF.fetch("https://example.com/PromotionList?p=pc");
		expect(response.status).toBe(404);
	});
});

describe("ai error handling", () => {
	function buildAiEnv(overrides: Record<string, unknown> = {}) {
		return {
			AI_PROVIDER_MODE: "result-json",
			AI_API_URL: "https://ai.example.test/translate",
			AI_API_KEY: "dummy-key",
			AI_MODEL: "dummy-model",
			MGR_PASSWORD: "dummy-password",
			STATE_DB: {
				prepare: () => ({
					bind: () => ({
						run: async () => ({}),
					}),
				}),
			},
			...overrides,
		} as any;
	}

	it("passes through result-json upstream error status and body", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response('{"error":"quota_exceeded"}', { status: 429, statusText: "Too Many Requests" }))
		);

		const env = buildAiEnv();

		const result = await requestAiTranslation(env, "en_US", "こんにちは", { source: "test", promptVersion: 1 });

		expect(result.ok).toBe(false);
		expect(result.statusCode).toBe(429);
		expect(result.publicReason).toBe('{"error":"quota_exceeded"}');
	});

	it("sends OpenRouter provider latency sort and configured order", async () => {
		let requestBody: any = null;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input, init: RequestInit = {}) => {
				const body = init.body ?? (input instanceof Request ? await input.clone().text() : "");
				requestBody = JSON.parse(String(body));
				return new Response(JSON.stringify({ choices: [{ message: { content: "Hello" } }] }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			})
		);

		const env = buildAiEnv({
			AI_PROVIDER_MODE: "openai-chat",
			AI_API_URL: "https://openrouter.ai/api/v1",
			OPENROUTER_PROVIDER_ORDER: "google-vertex/us-east5, deepinfra/turbo",
		});

		const result = await requestAiTranslation(env, "en_US", "こんにちは", { source: "test", promptVersion: 1 });

		expect(result.ok).toBe(true);
		expect(requestBody.provider).toEqual({
			sort: "latency",
			order: ["google-vertex/us-east5", "deepinfra/turbo"],
		});
	});

	it("does not send provider preferences to non-OpenRouter endpoints when order is empty", async () => {
		let requestBody: any = null;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input, init: RequestInit = {}) => {
				const body = init.body ?? (input instanceof Request ? await input.clone().text() : "");
				requestBody = JSON.parse(String(body));
				return new Response(JSON.stringify({ choices: [{ message: { content: "Hello" } }] }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			})
		);

		const env = buildAiEnv({
			AI_PROVIDER_MODE: "openai-chat",
			AI_API_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
			OPENROUTER_PROVIDER_ORDER: "",
		});

		const result = await requestAiTranslation(env, "en_US", "こんにちは", { source: "test", promptVersion: 1 });

		expect(result.ok).toBe(true);
		expect(requestBody.provider).toBeUndefined();
	});
});
