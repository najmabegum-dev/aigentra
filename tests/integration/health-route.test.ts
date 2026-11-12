import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";
import { DEFAULT_GEMINI_MODEL, checkGeminiHealth } from "@/rooms/propose/ai";

describe("Health Route & Model Health Check (PRD §8, §9)", () => {
  it("uses current Flash-tier model ID gemini-2.0-flash as default", () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-2.0-flash");
  });

  it("checks Gemini model health and reports operational or unconfigured status", async () => {
    const health = await checkGeminiHealth();
    expect(health).toBeDefined();
    expect(health.id).toBe("gemini-2.0-flash");
    expect(typeof health.configured).toBe("boolean");
    expect(typeof health.operational).toBe("boolean");
  });

  it("returns 200 from GET /api/health and reports database as true when PGlite or Postgres is operational", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.integrations).toBeDefined();

    // Golden test for Item 6: Database must report true when PGlite or Postgres works
    expect(data.integrations.database).toBe(true);

    // Golden test for Item 2: Reports geminiModel health status
    expect(data.geminiModel).toBeDefined();
    expect(data.geminiModel.id).toBe("gemini-2.0-flash");
  });
});
