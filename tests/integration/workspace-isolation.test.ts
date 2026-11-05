import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

describe("Workspace Isolation Integration Test (Golden Rule 9: IDOR Prevention)", () => {
  let client: PGlite;
  let testDb: ReturnType<typeof drizzle<typeof schema>>;

  const wsA = "ws_tenant_alpha";
  const wsB = "ws_tenant_bravo";
  const policyA = "pol_alpha_secret_guardrails";
  const policyB = "pol_bravo_office_limits";

  beforeAll(async () => {
    client = new PGlite();
    testDb = drizzle(client, { schema });
    const migrationsFolder = path.resolve(process.cwd(), "drizzle");
    await migrate(testDb, { migrationsFolder });

    // Seed Workspace A
    await testDb.insert(schema.workspaces).values({ id: wsA });
    await testDb.insert(schema.policies).values({ id: policyA, workspaceId: wsA });
    await testDb.insert(schema.policyVersions).values({
      id: "pv_alpha_1",
      workspaceId: wsA,
      policyId: policyA,
      version: 1,
      rulesJson: {
        name: "Confidential Alpha Policy",
        cart_max_cents: 10000,
        approval_threshold_cents: 5000,
        per_item_max_cents: 8000,
        daily_cap_cents: 20000,
        merchant_mode: "DENYLIST",
        merchants: ["bad-alpha.com"],
        blocked_categories: ["gambling"],
        currency: "USD",
        velocity_minutes: 10,
        price_max_age_seconds: 300,
        valid_from: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        status: "ACTIVE",
      },
    });

    // Seed Workspace B
    await testDb.insert(schema.workspaces).values({ id: wsB });
    await testDb.insert(schema.policies).values({ id: policyB, workspaceId: wsB });
    await testDb.insert(schema.policyVersions).values({
      id: "pv_bravo_1",
      workspaceId: wsB,
      policyId: policyB,
      version: 1,
      rulesJson: {
        name: "Bravo Public Policy",
        cart_max_cents: 5000,
        approval_threshold_cents: 2500,
        per_item_max_cents: 4000,
        daily_cap_cents: 10000,
        merchant_mode: "DENYLIST",
        merchants: [],
        blocked_categories: [],
        currency: "USD",
        velocity_minutes: 10,
        price_max_age_seconds: 300,
        valid_from: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        status: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    await client.close();
  });

  it("allows workspace A to read its own policy by ID", async () => {
    const [policy] = await testDb
      .select()
      .from(schema.policies)
      .where(and(eq(schema.policies.id, policyA), eq(schema.policies.workspaceId, wsA)));

    expect(policy).toBeDefined();
    expect(policy.id).toBe(policyA);
    expect(policy.workspaceId).toBe(wsA);
  });

  it("CRITICAL: Workspace B cannot read Workspace A's policy by ID (returns empty/null)", async () => {
    // An attacker in Workspace B knows or guesses policyA's ID
    const crossTenantRead = await testDb
      .select()
      .from(schema.policies)
      .where(and(eq(schema.policies.id, policyA), eq(schema.policies.workspaceId, wsB)));

    expect(crossTenantRead).toHaveLength(0);
    expect(crossTenantRead[0]).toBeUndefined();
  });

  it("CRITICAL: Workspace B cannot read Workspace A's policy versions by ID or policy_id", async () => {
    const crossTenantVersions = await testDb
      .select()
      .from(schema.policyVersions)
      .where(
        and(
          eq(schema.policyVersions.policyId, policyA),
          eq(schema.policyVersions.workspaceId, wsB)
        )
      );

    expect(crossTenantVersions).toHaveLength(0);
  });

  it("lists only workspace-scoped policies", async () => {
    const listA = await testDb
      .select()
      .from(schema.policies)
      .where(eq(schema.policies.workspaceId, wsA));
    expect(listA.map((p) => p.id)).toEqual([policyA]);

    const listB = await testDb
      .select()
      .from(schema.policies)
      .where(eq(schema.policies.workspaceId, wsB));
    expect(listB.map((p) => p.id)).toEqual([policyB]);
  });
});
