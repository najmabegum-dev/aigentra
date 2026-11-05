import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "@/lib/db/schema";
import { createSamplePolicyRules, SAMPLE_POLICY_NAME } from "@/lib/policies";
import { eq, and } from "drizzle-orm";

describe("Workspace Seeding & Sample Policy Verification (PRD §10.1)", () => {
  let client: PGlite;
  let testDb: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    client = new PGlite();
    testDb = drizzle(client, { schema });
    const migrationsFolder = path.resolve(process.cwd(), "drizzle");
    await migrate(testDb, { migrationsFolder });
  });

  afterAll(async () => {
    await client.close();
  });

  it("creates workspace and seeds 'Home Office Guardrails' policy with exact parameters", async () => {
    const wsId = "ws_demo_home_office";
    const polId = "pol_demo_home_office";
    const pvId = "pv_demo_home_office_v1";

    const rules = createSamplePolicyRules();

    // Verify rules match prompt:
    // cart max 150.00 USD, approval threshold 50.00, per-item max 120.00, daily cap 200.00, denylist mode
    expect(rules.name).toBe(SAMPLE_POLICY_NAME);
    expect(rules.currency).toBe("USD");
    expect(rules.cart_max_cents).toBe(15000); // 150.00 USD
    expect(rules.approval_threshold_cents).toBe(5000); // 50.00 USD
    expect(rules.per_item_max_cents).toBe(12000); // 120.00 USD
    expect(rules.daily_cap_cents).toBe(20000); // 200.00 USD
    expect(rules.merchant_mode).toBe("DENYLIST");
    expect(rules.status).toBe("ACTIVE");

    // Insert workspace
    await testDb.insert(schema.workspaces).values({
      id: wsId,
      aiCallsUsed: 0,
      killSwitch: false,
    });

    // Insert policy
    await testDb.insert(schema.policies).values({
      id: polId,
      workspaceId: wsId,
    });

    // Insert policy version
    await testDb.insert(schema.policyVersions).values({
      id: pvId,
      workspaceId: wsId,
      policyId: polId,
      version: 1,
      rulesJson: rules,
    });

    // Verify database read
    const [savedPolicy] = await testDb
      .select()
      .from(schema.policies)
      .where(and(eq(schema.policies.id, polId), eq(schema.policies.workspaceId, wsId)));

    expect(savedPolicy).toBeDefined();
    expect(savedPolicy.id).toBe(polId);

    const [savedVersion] = await testDb
      .select()
      .from(schema.policyVersions)
      .where(
        and(
          eq(schema.policyVersions.policyId, polId),
          eq(schema.policyVersions.workspaceId, wsId)
        )
      );

    expect(savedVersion).toBeDefined();
    expect(savedVersion.version).toBe(1);
    expect((savedVersion.rulesJson as typeof rules).name).toBe("Home Office Guardrails");
    expect((savedVersion.rulesJson as typeof rules).cart_max_cents).toBe(15000);
    expect((savedVersion.rulesJson as typeof rules).approval_threshold_cents).toBe(5000);
    expect((savedVersion.rulesJson as typeof rules).per_item_max_cents).toBe(12000);
    expect((savedVersion.rulesJson as typeof rules).daily_cap_cents).toBe(20000);
  });
});
