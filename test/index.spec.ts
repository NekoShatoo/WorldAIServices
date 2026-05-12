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
	it("passes through result-json upstream error status and body", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response('{"error":"quota_exceeded"}', { status: 429, statusText: "Too Many Requests" }))
		);

		const env = {
			AI_PROVIDER_MODE: "result-json",
			AI_API_URL: "https://ai.example.test/translate",
			AI_API_KEY: "dummy-key",
			MGR_PASSWORD: "dummy-password",
			STATE_DB: {
				prepare: () => ({
					bind: () => ({
						run: async () => ({}),
					}),
				}),
			},
		} as any;

		const result = await requestAiTranslation(env, "en_US", "こんにちは", { source: "test", promptVersion: 1 });

		expect(result.ok).toBe(false);
		expect(result.statusCode).toBe(429);
		expect(result.publicReason).toBe('{"error":"quota_exceeded"}');
	});
});
