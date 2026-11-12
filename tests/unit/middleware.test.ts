import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware, checkRateLimit } from "@/middleware";

describe("Middleware & Security Headers (F6)", () => {
  it("checkRateLimit tracks counts and blocks beyond threshold within sliding window", () => {
    const store = new Map();
    const now = 100000;

    for (let i = 1; i <= 5; i++) {
      const res = checkRateLimit(store, "1.2.3.4", 5, 60_000, now);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(5 - i);
    }

    // 6th call exceeds limit
    const blocked = checkRateLimit(store, "1.2.3.4", 5, 60_000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);

    // Call after window expires resets bucket
    const reset = checkRateLimit(store, "1.2.3.4", 5, 60_000, now + 60_001);
    expect(reset.allowed).toBe(true);
    expect(reset.remaining).toBe(4);
  });

  it("applies security headers on responses", () => {
    const req = new NextRequest("http://localhost:3000/");
    const res = middleware(req);

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(res.headers.get("Content-Security-Policy")).toContain("https://*.paypal.com");
  });

  it("does not rate limit /api/webhooks/paypal even with many requests", () => {
    for (let i = 0; i < 75; i++) {
      const req = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
        method: "POST",
        headers: { "x-forwarded-for": "198.51.100.1" },
      });
      const res = middleware(req);
      expect(res.status).toBe(200);
    }
  });

  it("enforces rate limit of 60 req/min on general /api routes", () => {
    const testIp = "203.0.113.42";
    let lastRes;

    for (let i = 0; i < 60; i++) {
      const req = new NextRequest("http://localhost:3000/api/proposals", {
        method: "GET",
        headers: { "x-forwarded-for": testIp },
      });
      lastRes = middleware(req);
      expect(lastRes.status).toBe(200);
    }

    // 61st request is blocked
    const reqBlocked = new NextRequest("http://localhost:3000/api/proposals", {
      method: "GET",
      headers: { "x-forwarded-for": testIp },
    });
    const blockedRes = middleware(reqBlocked);
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get("Retry-After")).toBeDefined();
  });

  it("enforces strict rate limit of 10 req/min on POST /api/workspaces", () => {
    const testIp = "203.0.113.99";

    for (let i = 0; i < 10; i++) {
      const req = new NextRequest("http://localhost:3000/api/workspaces", {
        method: "POST",
        headers: { "x-forwarded-for": testIp },
      });
      const res = middleware(req);
      expect(res.status).toBe(200);
    }

    // 11th request is blocked
    const reqBlocked = new NextRequest("http://localhost:3000/api/workspaces", {
      method: "POST",
      headers: { "x-forwarded-for": testIp },
    });
    const blockedRes = middleware(reqBlocked);
    expect(blockedRes.status).toBe(429);
  });
});
