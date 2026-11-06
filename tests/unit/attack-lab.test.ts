import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { workspaces, policies, policyVersions } from "@/lib/db/schema";
import { runAllAttackScenarios, runScenario } from "@/rooms/verify/attackLab/scenarios";
import { getGatewayCallCount, resetGatewayCallCount } from "@/rooms/execute/devStub";

describe("Attack Lab Scenarios A1-A7 (PRD §9.4, F10, Threats A1-A7)", () => {
  let wsId: string;

  beforeEach(async () => {
    process.env.PAYMENT_MODE = "dev_stub";
    resetGatewayCallCount();

    wsId = "ws_attack_" + Math.random().toString(36).slice(2, 9);
    await db.insert(workspaces).values({ id: wsId }).onConflictDoNothing();

    // Default policy: "Home Office Guardrails" (PRD 10.1: cart max $150, approval threshold $50, per-item max $120, daily cap $200)
    await db.insert(policies).values({ id: "pol_" + wsId, workspaceId: wsId }).onConflictDoNothing();
    await db.insert(policyVersions).values({
      id: "pv_" + wsId,
      policyId: "pol_" + wsId,
      workspaceId: wsId,
      version: 1,
      rulesJson: {
        status: "ACTIVE",
        currency: "USD",
        cart_max_cents: 15000,
        item_max_cents: 12000,
        daily_cap_cents: 20000,
        approval_threshold_cents: 5000,
        mode: "DENYLIST",
        denylist: ["Gambling", "Weapons"],
        valid_from: new Date(Date.now() - 3600_000).toISOString(),
        valid_to: new Date(Date.now() + 86400_000).toISOString(),
      },
    }).onConflictDoNothing();
  });

  it("A1: Injected product text is denied with OVER_CART_CAP and 0 PayPal requests", async () => {
    const res = await runScenario("A1", wsId);
    expect(res.passed).toBe(true);
    expect(res.actual).toContain("OVER_CART_CAP");
    expect(res.paypalRequestsAfter - res.paypalRequestsBefore).toBe(0);
  });

  it("A2: Inflated total is denied with TOTAL_MISMATCH and 0 PayPal requests", async () => {
    const res = await runScenario("A2", wsId);
    expect(res.passed).toBe(true);
    expect(res.actual).toContain("TOTAL_MISMATCH");
    expect(res.paypalRequestsAfter - res.paypalRequestsBefore).toBe(0);
  });

  it("A3: Price tampering is denied with ITEM_PRICE_MISMATCH and 0 PayPal requests", async () => {
    const res = await runScenario("A3", wsId);
    expect(res.passed).toBe(true);
    expect(res.actual).toContain("ITEM_PRICE_MISMATCH");
    expect(res.paypalRequestsAfter - res.paypalRequestsBefore).toBe(0);
  });

  it("A4: Cart swap after approval is rejected with HASH_MISMATCH and 0 PayPal requests", async () => {
    const res = await runScenario("A4", wsId);
    expect(res.passed).toBe(true);
    expect(res.actual).toContain("HASH_MISMATCH");
    expect(res.paypalRequestsAfter - res.paypalRequestsBefore).toBe(0);
  });

  it("A5: Mandate replay is rejected with MANDATE_ALREADY_USED and 0 PayPal requests", async () => {
    const res = await runScenario("A5", wsId);
    expect(res.passed).toBe(true);
    expect(res.actual).toContain("MANDATE_ALREADY_USED");
    expect(res.paypalRequestsAfter - res.paypalRequestsBefore).toBe(0);
  });

  it("A6: Forged webhook is rejected with HTTP 400 and security event logged, 0 PayPal requests", async () => {
    const res = await runScenario("A6", wsId);
    expect(res.passed).toBe(true);
    expect(res.actual).toContain("SECURITY_WEBHOOK_VERIFICATION_FAILED");
    expect(res.paypalRequestsAfter - res.paypalRequestsBefore).toBe(0);
  });

  it("A7: Ledger tampering is detected with chain BROKEN at exact sequence, 0 PayPal requests", async () => {
    const res = await runScenario("A7", wsId);
    expect(res.passed).toBe(true);
    expect(res.actual).toContain("BROKEN");
    expect(res.paypalRequestsAfter - res.paypalRequestsBefore).toBe(0);
  });

  it("Runs all 7 attack scenarios in batch and confirms 7/7 PASS with 0 PayPal calls delta", async () => {
    const results = await runAllAttackScenarios(wsId);
    expect(results).toHaveLength(7);
    expect(results.every((r) => r.passed)).toBe(true);
    expect(results.every((r) => r.paypalRequestsAfter - r.paypalRequestsBefore === 0)).toBe(true);
  });
});
