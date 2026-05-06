import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
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
