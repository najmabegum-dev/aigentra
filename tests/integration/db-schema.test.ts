import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "@/lib/db/schema";

describe("Database Schema & Constraints Integration Test (PGlite / PostgreSQL)", () => {
  let client: PGlite;
  let testDb: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    // In-memory PGlite instance for fast, isolated constraint verification
    client = new PGlite();
    testDb = drizzle(client, { schema });

    const migrationsFolder = path.resolve(process.cwd(), "drizzle");
    await migrate(testDb, { migrationsFolder });
  });

  afterAll(async () => {
    await client.close();
  });

  it("verifies workspace creation and cascade references", async () => {
    const [ws] = await testDb
      .insert(schema.workspaces)
      .values({
        id: "ws_test_1",
        killSwitch: false,
      })
      .returning();

    expect(ws).toBeDefined();
    expect(ws.id).toBe("ws_test_1");
    expect(ws.killSwitch).toBe(false);
  });

  it("enforces unique constraint on policy_versions(policy_id, version)", async () => {
    const [policy] = await testDb
      .insert(schema.policies)
      .values({
        id: "pol_test_1",
        workspaceId: "ws_test_1",
      })
      .returning();

    // First version insert should succeed
    await testDb.insert(schema.policyVersions).values({
      id: "pv_test_1",
      workspaceId: "ws_test_1",
      policyId: policy.id,
      version: 1,
      rulesJson: { cart_max_cents: 10000 },
    });

    // Duplicate version insert must fail
    await expect(
      testDb.insert(schema.policyVersions).values({
        id: "pv_test_2",
        workspaceId: "ws_test_1",
        policyId: policy.id,
        version: 1, // duplicate version!
        rulesJson: { cart_max_cents: 20000 },
      })
    ).rejects.toThrow();
  });

  it("enforces primary key uniqueness on mandates(jti)", async () => {
    const [proposal] = await testDb
      .insert(schema.proposals)
      .values({
        id: "prop_test_1",
        workspaceId: "ws_test_1",
        itemsJson: [{ sku: "item-1", unit_price_cents: 1000, quantity: 1 }],
        totalCents: 1000,
        currency: "USD",
        proposalHash: "hash_test_1234",
        state: "APPROVED",
        policyVersionId: "pv_test_1",
      })
      .returning();

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await testDb.insert(schema.mandates).values({
      jti: "mandate_jti_unique_1",
      workspaceId: "ws_test_1",
      proposalId: proposal.id,
      propHash: proposal.proposalHash,
      policyVersionId: "pv_test_1",
      amountCents: 1000,
      currency: "USD",
      grant: "HUMAN_APPROVAL",
      expiresAt,
    });

    // Replay with duplicate JTI must fail
    await expect(
      testDb.insert(schema.mandates).values({
        jti: "mandate_jti_unique_1", // duplicate jti!
        workspaceId: "ws_test_1",
        proposalId: proposal.id,
        propHash: proposal.proposalHash,
        policyVersionId: "pv_test_1",
        amountCents: 1000,
        currency: "USD",
        grant: "HUMAN_APPROVAL",
        expiresAt,
      })
    ).rejects.toThrow();
  });

  it("enforces unique constraint on paypal_orders(proposal_id)", async () => {
    await testDb.insert(schema.paypalOrders).values({
      id: "order_row_1",
      workspaceId: "ws_test_1",
      proposalId: "prop_test_1",
      paypalOrderId: "PAYPAL_ORDER_1",
      status: "CREATED",
      requestId: "req_1",
      amountCents: 1000,
      currency: "USD",
    });

    // Attempting a second PayPal order for the same proposal must fail
    await expect(
      testDb.insert(schema.paypalOrders).values({
        id: "order_row_2",
        workspaceId: "ws_test_1",
        proposalId: "prop_test_1", // duplicate proposal_id!
        paypalOrderId: "PAYPAL_ORDER_2",
        status: "CREATED",
        requestId: "req_2",
        amountCents: 1000,
        currency: "USD",
      })
    ).rejects.toThrow();
  });

  it("enforces unique constraint on paypal_captures(capture_id)", async () => {
    await testDb.insert(schema.paypalCaptures).values({
      id: "cap_row_1",
      workspaceId: "ws_test_1",
      orderId: "order_row_1",
      captureId: "CAPTURE_ID_100",
      status: "COMPLETED",
      amountCents: 1000,
      currency: "USD",
    });

    // Duplicate capture ID must fail
    await expect(
      testDb.insert(schema.paypalCaptures).values({
        id: "cap_row_2",
        workspaceId: "ws_test_1",
        orderId: "order_row_1",
        captureId: "CAPTURE_ID_100", // duplicate captureId!
        status: "COMPLETED",
        amountCents: 1000,
        currency: "USD",
      })
    ).rejects.toThrow();
  });

  it("enforces unique constraint on ledger_events(workspace_id, seq)", async () => {
    await testDb.insert(schema.ledgerEvents).values({
      id: "ev_1",
      workspaceId: "ws_test_1",
      seq: 1,
      entityType: "proposal",
      entityId: "prop_test_1",
      type: "PROPOSAL_CREATED",
      actor: "user",
      payloadJson: { note: "first event" },
      prevHash: "GENESIS",
      eventHash: "hash_ev_1",
    });

    // Duplicate sequence in the same workspace must fail
    await expect(
      testDb.insert(schema.ledgerEvents).values({
        id: "ev_2",
        workspaceId: "ws_test_1",
        seq: 1, // duplicate seq in ws_test_1!
        entityType: "proposal",
        entityId: "prop_test_1",
        type: "PROPOSAL_EVALUATED",
        actor: "policy_engine",
        payloadJson: { note: "conflicting seq" },
        prevHash: "hash_ev_1",
        eventHash: "hash_ev_2",
      })
    ).rejects.toThrow();
  });

  it("enforces foreign key constraint: rejects insertion for non-existent workspace", async () => {
    await expect(
      testDb.insert(schema.intents).values({
        id: "intent_invalid_ws",
        workspaceId: "non_existent_workspace_id",
        rawText: "buy laptop",
        status: "PARSED",
      })
    ).rejects.toThrow();
  });
});
