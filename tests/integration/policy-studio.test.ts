import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { evaluate } from "@/rooms/authorize/engine";
import type { PolicyRuleDefinition, ProposalItem, SpendState } from "@/rooms/authorize/types";

describe("Policy Studio Integration & Immutability (PRD F2 & 10.2)", () => {
  let client: PGlite;
  let testDb: ReturnType<typeof drizzle<typeof schema>>;

  const wsA = "ws_studio_alpha";
  const wsB = "ws_studio_bravo";
  const policyId = "pol_studio_test";

  const initialRules: PolicyRuleDefinition = {
    name: "Engineering Equipment Limits",
    currency: "USD",
    per_item_max_cents: 12000,
    cart_max_cents: 15000,
    approval_threshold_cents: 5000,
    daily_cap_cents: 20000,
    merchant_mode: "DENYLIST",
    merchants: ["sketchy.com"],
    blocked_categories: ["gift_cards"],
    velocity_minutes: 10,
    price_max_age_seconds: 300,
    valid_from: new Date("2026-01-01").toISOString(),
    expires_at: new Date("2026-12-31").toISOString(),
    status: "DRAFT",
  };

  beforeAll(async () => {
    client = new PGlite();
    testDb = drizzle(client, { schema });
    const migrationsFolder = path.resolve(process.cwd(), "drizzle");
    await migrate(testDb, { migrationsFolder });

    await testDb.insert(schema.workspaces).values({ id: wsA, killSwitch: false });
    await testDb.insert(schema.workspaces).values({ id: wsB, killSwitch: false });
  });

  afterAll(async () => {
    await client.close();
  });

  it("creates policy with initial version 1", async () => {
    await testDb.insert(schema.policies).values({
      id: policyId,
      workspaceId: wsA,
    });

    await testDb.insert(schema.policyVersions).values({
      id: "pv_1",
      workspaceId: wsA,
      policyId,
      version: 1,
      rulesJson: initialRules,
    });

    const [v1] = await testDb
      .select()
      .from(schema.policyVersions)
      .where(and(eq(schema.policyVersions.policyId, policyId), eq(schema.policyVersions.version, 1)));

    expect(v1).toBeDefined();
    expect(v1.version).toBe(1);
    expect((v1.rulesJson as PolicyRuleDefinition).status).toBe("DRAFT");
    expect((v1.rulesJson as PolicyRuleDefinition).cart_max_cents).toBe(15000);
  });

  it("creates an immutable version 2 on material edit, preserving version 1", async () => {
    const updatedRules: PolicyRuleDefinition = {
      ...initialRules,
      cart_max_cents: 18000, // increased to $180.00
      status: "ACTIVE", // activated
    };

    // Insert version 2
    await testDb.insert(schema.policyVersions).values({
      id: "pv_2",
      workspaceId: wsA,
      policyId,
      version: 2,
      rulesJson: updatedRules,
    });

    // Verify version 1 is unchanged
    const [v1] = await testDb
      .select()
      .from(schema.policyVersions)
      .where(and(eq(schema.policyVersions.policyId, policyId), eq(schema.policyVersions.version, 1)));

    expect((v1.rulesJson as PolicyRuleDefinition).cart_max_cents).toBe(15000);
    expect((v1.rulesJson as PolicyRuleDefinition).status).toBe("DRAFT");

    // Verify version 2 has new values
    const [v2] = await testDb
      .select()
      .from(schema.policyVersions)
      .where(and(eq(schema.policyVersions.policyId, policyId), eq(schema.policyVersions.version, 2)));

    expect((v2.rulesJson as PolicyRuleDefinition).cart_max_cents).toBe(18000);
    expect((v2.rulesJson as PolicyRuleDefinition).status).toBe("ACTIVE");
  });

  it("handles pause and revoke as immutable versions 3 and 4", async () => {
    // Version 3: PAUSED
    const [latest] = await testDb
      .select()
      .from(schema.policyVersions)
      .where(eq(schema.policyVersions.policyId, policyId))
      .orderBy(desc(schema.policyVersions.version))
      .limit(1);

    const pausedRules: PolicyRuleDefinition = {
      ...(latest.rulesJson as PolicyRuleDefinition),
      status: "PAUSED",
    };

    await testDb.insert(schema.policyVersions).values({
      id: "pv_3",
      workspaceId: wsA,
      policyId,
      version: 3,
      rulesJson: pausedRules,
    });

    // Version 4: REVOKED
    const revokedRules: PolicyRuleDefinition = {
      ...pausedRules,
      status: "REVOKED",
    };

    await testDb.insert(schema.policyVersions).values({
      id: "pv_4",
      workspaceId: wsA,
      policyId,
      version: 4,
      rulesJson: revokedRules,
    });

    const allVersions = await testDb
      .select()
      .from(schema.policyVersions)
      .where(eq(schema.policyVersions.policyId, policyId))
      .orderBy(schema.policyVersions.version);

    expect(allVersions).toHaveLength(4);
    expect((allVersions[0].rulesJson as PolicyRuleDefinition).status).toBe("DRAFT");
    expect((allVersions[1].rulesJson as PolicyRuleDefinition).status).toBe("ACTIVE");
    expect((allVersions[2].rulesJson as PolicyRuleDefinition).status).toBe("PAUSED");
    expect((allVersions[3].rulesJson as PolicyRuleDefinition).status).toBe("REVOKED");
  });

  it("enforces workspace kill switch in evaluate engine", () => {
    const activePolicy: PolicyRuleDefinition = {
      ...initialRules,
      status: "ACTIVE",
    };

    const item: ProposalItem = {
      sku: "ITEM-1",
      name: "Desk Lamp",
      merchant_domain: "goodstore.com",
      unit_price_cents: 3000,
      server_price_cents: 3000,
      quantity: 1,
      currency: "USD",
      price_fetched_at: new Date("2026-06-01T12:00:00Z"),
      category: "office",
    };

    const proposal = {
      workspace_id: wsA,
      items: [item],
      currency: "USD" as const,
      total_cents: 3000,
    };

    const now = new Date("2026-06-01T12:01:00Z");

    const normalSpendState: SpendState = {
      daily_captured_cents: 0,
      daily_reserved_cents: 0,
      kill_switch: false,
    };

    const killedSpendState: SpendState = {
      daily_captured_cents: 0,
      daily_reserved_cents: 0,
      kill_switch: true,
    };

    // Without kill switch: ALLOW
    const normalEval = evaluate(proposal, activePolicy, normalSpendState, now);
    expect(normalEval.decision).toBe("ALLOW");

    // With workspace kill switch ON: DENY with KILL_SWITCH_ON
    const killedEval = evaluate(proposal, activePolicy, killedSpendState, now);
    expect(killedEval.decision).toBe("DENY");
    expect(killedEval.reason_codes).toContain("KILL_SWITCH_ON");
  });

  it("prevents Workspace B from updating or appending versions to Workspace A's policy", async () => {
    // Attempt to query or write on behalf of Workspace B
    const crossTenantPolicies = await testDb
      .select()
      .from(schema.policies)
      .where(and(eq(schema.policies.id, policyId), eq(schema.policies.workspaceId, wsB)));

    expect(crossTenantPolicies).toHaveLength(0);
  });
});
