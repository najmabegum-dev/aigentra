import { describe, it, expect, beforeEach } from "vitest";
import { getAuditorTools, executeAuditorTool } from "@/studio/auditor/tools";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

describe("Auditor Agent & Read-Only Tools (PRD P19)", () => {
  let workspaceA: string;
  let workspaceB: string;

  beforeEach(async () => {
    workspaceA = `ws_test_auditor_${crypto.randomBytes(6).toString("hex")}`;
    workspaceB = `ws_test_auditor_other_${crypto.randomBytes(6).toString("hex")}`;

    // Seed test workspaces
    await db.insert(schema.workspaces).values([
      { id: workspaceA },
      { id: workspaceB },
    ]).onConflictDoNothing();
  });

  describe("Safety & Read-Only Invariants (Golden Rule 1 & P19)", () => {
    it("lists all auditor tools and asserts 100% are read-only and none writes data or touches payments", () => {
      const tools = getAuditorTools();
      expect(tools.length).toBe(3);

      const toolNames = tools.map((t) => t.name).sort();
      expect(toolNames).toEqual([
        "explain_decision",
        "query_ledger",
        "summarize_blocked",
      ]);

      const forbiddenWords = [
        "write",
        "create",
        "insert",
        "update",
        "delete",
        "drop",
        "capture",
        "refund",
        "execute",
        "order",
        "pay",
        "mandate",
        "sign",
      ];

      for (const tool of tools) {
        expect(tool.isReadOnly, `Tool ${tool.name} must be read-only`).toBe(true);
        expect(tool.canWrite, `Tool ${tool.name} canWrite must be false`).toBe(false);
        expect(
          tool.touchesPayments,
          `Tool ${tool.name} touchesPayments must be false`
        ).toBe(false);
        expect(tool.category).toBe("audit");

        // Ensure tool name does not contain forbidden write/payment mutations
        for (const word of forbiddenWords) {
          expect(
            tool.name.toLowerCase().includes(word),
            `Tool name '${tool.name}' must not contain mutating verb '${word}'`
          ).toBe(false);
        }
      }
    });

    it("verifies through static file inspection that src/studio/auditor has no payment or execute imports", () => {
      const auditorDir = path.resolve(process.cwd(), "src/studio/auditor");
      if (fs.existsSync(auditorDir)) {
        const files = fs.readdirSync(auditorDir);
        for (const file of files) {
          if (file.endsWith(".ts") || file.endsWith(".tsx")) {
            const content = fs.readFileSync(path.join(auditorDir, file), "utf8");
            expect(content).not.toMatch(/@\/rooms\/execute/);
            expect(content).not.toMatch(/@paypal/);
            expect(content).not.toMatch(/PAYPAL_CLIENT/);
          }
        }
      }
    });
  });

  describe("query_ledger Tool", () => {
    it("returns only workspace-scoped ledger events and respects filters", async () => {
      // Seed ledger events for workspace A
      await db.insert(schema.ledgerEvents).values([
        {
          id: `evt_1_${crypto.randomBytes(4).toString("hex")}`,
          workspaceId: workspaceA,
          seq: 1,
          entityType: "proposal",
          entityId: "prop_1",
          type: "PROPOSAL_CREATED",
          actor: "agent:shopper",
          payloadJson: { note: "test 1" },
          prevHash: "0000000000000000000000000000000000000000000000000000000000000000",
          eventHash: "hash1",
        },
        {
          id: `evt_2_${crypto.randomBytes(4).toString("hex")}`,
          workspaceId: workspaceA,
          seq: 2,
          entityType: "evaluation",
          entityId: "eval_1",
          type: "EVALUATION_PERFORMED",
          actor: "system:engine",
          payloadJson: { decision: "ALLOW" },
          prevHash: "hash1",
          eventHash: "hash2",
        },
      ]);

      // Seed event for workspace B
      await db.insert(schema.ledgerEvents).values([
        {
          id: `evt_b_${crypto.randomBytes(4).toString("hex")}`,
          workspaceId: workspaceB,
          seq: 1,
          entityType: "proposal",
          entityId: "prop_b",
          type: "PROPOSAL_CREATED",
          actor: "agent:shopper",
          payloadJson: { note: "workspace B event" },
          prevHash: "0000000000000000000000000000000000000000000000000000000000000000",
          eventHash: "hash_b1",
        },
      ]);

      // Query ledger for workspace A
      const res = await executeAuditorTool("query_ledger", { limit: 10 }, workspaceA);
      expect(res.ok).toBe(true);
      expect(res.data.events.length).toBe(2);
      expect(res.data.events.every((e: any) => e.workspace_id === workspaceA || !e.workspace_id)).toBe(true);
      expect(res.data.events.some((e: any) => e.entity_id === "prop_b")).toBe(false);

      // Query with entityType filter
      const filtered = await executeAuditorTool(
        "query_ledger",
        { entity_type: "evaluation" },
        workspaceA
      );
      expect(filtered.ok).toBe(true);
      expect(filtered.data.events.length).toBe(1);
      expect(filtered.data.events[0].entity_type).toBe("evaluation");
    });
  });

  describe("explain_decision Tool", () => {
    it("retrieves evaluation and formats rule breakdown and plain language explanation", async () => {
      // Create a policy and policy version
      const policyId = `pol_${crypto.randomBytes(4).toString("hex")}`;
      const polVerId = `pv_${crypto.randomBytes(4).toString("hex")}`;
      await db.insert(schema.policies).values({
        id: policyId,
        workspaceId: workspaceA,
      });
      await db.insert(schema.policyVersions).values({
        id: polVerId,
        policyId: policyId,
        workspaceId: workspaceA,
        version: 1,
        rulesJson: {
          cart_max_cents: 15000,
          approval_threshold_cents: 5000,
          per_item_max_cents: 12000,
          daily_cap_cents: 20000,
          allowed_merchants: ["amazon.com", "bestbuy.com"],
          merchant_mode: "denylist",
          blocked_merchants: ["bad-merchant.com"],
          blocked_categories: ["gambling"],
          stale_price_seconds: 300,
          velocity_window_hours: 24,
          max_proposals_in_velocity_window: 10,
        },
      });

      const propId = `prop_${crypto.randomBytes(4).toString("hex")}`;
      await db.insert(schema.proposals).values({
        id: propId,
        workspaceId: workspaceA,
        itemsJson: [
          { sku: "SKU1", title: "Ergonomic Desk", price_cents: 25000, merchant: "desk.com" },
        ],
        totalCents: 25000,
        currency: "USD",
        proposalHash: "prophash_123",
        state: "DENIED",
      });

      const evalId = `eval_${crypto.randomBytes(4).toString("hex")}`;
      await db.insert(schema.evaluations).values({
        id: evalId,
        workspaceId: workspaceA,
        proposalId: propId,
        policyVersionId: polVerId,
        decision: "DENY",
        ruleResultsJson: [
          { rule: "cart_max", passed: false, reason: "CART_MAX_EXCEEDED" },
          { rule: "item_max", passed: false, reason: "ITEM_MAX_EXCEEDED" },
        ],
        reasonCodes: ["CART_MAX_EXCEEDED", "ITEM_MAX_EXCEEDED"],
      });

      const res = await executeAuditorTool(
        "explain_decision",
        { decision_id: evalId },
        workspaceA
      );

      expect(res.ok).toBe(true);
      expect(res.data.decision).toBe("DENY");
      expect(res.data.reason_codes).toContain("CART_MAX_EXCEEDED");
      expect(res.data.reason_codes).toContain("ITEM_MAX_EXCEEDED");
      expect(res.data.plain_summary).toBeDefined();
      expect(res.data.plain_summary.length).toBeGreaterThan(10);

      // Verify cross-workspace isolation: workspaceB cannot read workspaceA's evaluation
      const crossRes = await executeAuditorTool(
        "explain_decision",
        { decision_id: evalId },
        workspaceB
      );
      expect(crossRes.ok).toBe(false);
      expect(crossRes.error).toMatch(/not found/i);
    });
  });

  describe("summarize_blocked Tool", () => {
    it("aggregates denied attempts over the requested time window", async () => {
      const policyId = `pol_summ_${crypto.randomBytes(4).toString("hex")}`;
      const polVerId = `pv_summ_${crypto.randomBytes(4).toString("hex")}`;
      await db.insert(schema.policies).values({
        id: policyId,
        workspaceId: workspaceA,
      });
      await db.insert(schema.policyVersions).values({
        id: polVerId,
        policyId: policyId,
        workspaceId: workspaceA,
        version: 1,
        rulesJson: {
          cart_max_cents: 10000,
          approval_threshold_cents: 5000,
          per_item_max_cents: 5000,
          daily_cap_cents: 15000,
          allowed_merchants: [],
          merchant_mode: "denylist",
          blocked_merchants: [],
          blocked_categories: [],
          stale_price_seconds: 300,
          velocity_window_hours: 24,
          max_proposals_in_velocity_window: 10,
        },
      });

      // Insert 2 denied proposals/evaluations
      for (let i = 0; i < 2; i++) {
        const pId = `prop_b_${i}_${crypto.randomBytes(4).toString("hex")}`;
        await db.insert(schema.proposals).values({
          id: pId,
          workspaceId: workspaceA,
          itemsJson: [{ sku: `S${i}`, title: "Blocked item", price_cents: 20000, merchant: "ex.com" }],
          totalCents: 20000,
          currency: "USD",
          proposalHash: `hash_${i}`,
          state: "DENIED",
        });
        await db.insert(schema.evaluations).values({
          id: `eval_b_${i}_${crypto.randomBytes(4).toString("hex")}`,
          workspaceId: workspaceA,
          proposalId: pId,
          policyVersionId: polVerId,
          decision: "DENY",
          ruleResultsJson: [{ rule: "cart_max", passed: false, reason: "CART_MAX_EXCEEDED" }],
          reasonCodes: ["CART_MAX_EXCEEDED"],
        });
      }

      const res = await executeAuditorTool(
        "summarize_blocked",
        { range_hours: 24 },
        workspaceA
      );

      expect(res.ok).toBe(true);
      expect(res.data.total_blocked).toBeGreaterThanOrEqual(2);
      expect(res.data.reason_breakdown).toBeDefined();
      expect(res.data.reason_breakdown["CART_MAX_EXCEEDED"]).toBeGreaterThanOrEqual(2);
      expect(res.data.summary).toBeDefined();
    });
  });
});
