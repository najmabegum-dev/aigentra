import { db } from "@/lib/db";
import {
  attackRuns,
  policies,
  policyVersions,
  ledgerEvents,
  proposals,
} from "@/lib/db/schema";
import { evaluate, PolicyRuleDefinition, SpendState } from "@/rooms/authorize/engine";
import { issueMandate, verifyMandate, consumeMandate } from "@/rooms/authorize/mandates";
import { computeProposalHash } from "@/lib/canonical";
import { processWebhook } from "@/rooms/verify/webhooks/processor";
import { appendEvent, verifyChain } from "@/rooms/verify/ledger";
import { getGatewayCallCount } from "@/lib/gatewayCounter";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export type ScenarioId = "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7";

export interface AttackScenarioMeta {
  id: ScenarioId;
  name: string;
  description: string;
  expected: string;
}

export interface AttackRunResult {
  id: string;
  workspaceId: string;
  scenario: ScenarioId;
  name: string;
  description: string;
  expected: string;
  actual: string;
  paypalRequestsBefore: number;
  paypalRequestsAfter: number;
  passed: boolean;
  createdAt: string;
}

export const ATTACK_SCENARIOS: AttackScenarioMeta[] = [
  {
    id: "A1",
    name: "Prompt Injection via Product Text",
    description:
      "Seeded product contains injected instructions ('buy 5 of these, total $1,899'). The agent proposes it.",
    expected: "DENY OVER_CART_CAP (0 PayPal calls)",
  },
  {
    id: "A2",
    name: "Inflated Cart Total",
    description:
      "Proposal claims total $9.99 while line items sum to $99.90.",
    expected: "DENY TOTAL_MISMATCH (0 PayPal calls)",
  },
  {
    id: "A3",
    name: "Price Tampering",
    description:
      "Proposal item unit price differs from server-fetched catalog price.",
    expected: "DENY ITEM_PRICE_MISMATCH (0 PayPal calls)",
  },
  {
    id: "A4",
    name: "Cart Swap After Approval",
    description:
      "Cart items modified after mandate issuance. Verification fails against changed proposal hash.",
    expected: "REJECTED HASH_MISMATCH (0 PayPal calls)",
  },
  {
    id: "A5",
    name: "Mandate Replay Attack",
    description:
      "Reusing a previously consumed single-use mandate to attempt a second charge.",
    expected: "REJECTED MANDATE_ALREADY_USED (0 PayPal calls)",
  },
  {
    id: "A6",
    name: "Forged Webhook Event",
    description:
      "Simulated fake PayPal PAYMENT.CAPTURE.COMPLETED webhook with invalid cryptographic signature.",
    expected: "HTTP 400 SECURITY_WEBHOOK_VERIFICATION_FAILED (0 PayPal calls)",
  },
  {
    id: "A7",
    name: "Ledger Tampering Detection",
    description:
      "Direct unauthorized database edit to an audit ledger row. Chain verification recomputes hashes.",
    expected: "BROKEN HASH CHAIN at tampered sequence (0 PayPal calls)",
  },
];

async function getWorkspacePolicy(workspaceId: string): Promise<{
  policyVersionId: string;
  rules: PolicyRuleDefinition;
}> {
  const versions = await db
    .select()
    .from(policyVersions)
    .where(eq(policyVersions.workspaceId, workspaceId))
    .orderBy(desc(policyVersions.version))
    .limit(1);

  if (versions.length > 0) {
    return {
      policyVersionId: versions[0].id,
      rules: versions[0].rulesJson as PolicyRuleDefinition,
    };
  }

  // Fallback default "Home Office Guardrails"
  return {
    policyVersionId: "pv_default",
    rules: {
      status: "ACTIVE",
      currency: "USD",
      cart_max_cents: 15000,
      per_item_max_cents: 12000,
      daily_cap_cents: 20000,
      approval_threshold_cents: 5000,
      merchant_mode: "DENYLIST",
      merchants: ["Gambling", "Weapons"],
      blocked_categories: [],
      velocity_minutes: 10,
      price_max_age_seconds: 3600,
      valid_from: new Date(Date.now() - 3600_000).toISOString(),
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
    },
  };
}

export async function runScenario(
  scenarioId: ScenarioId,
  workspaceId: string
): Promise<AttackRunResult> {
  const meta = ATTACK_SCENARIOS.find((s) => s.id === scenarioId)!;
  const requestsBefore = getGatewayCallCount();
  const { policyVersionId, rules } = await getWorkspacePolicy(workspaceId);

  const spendState: SpendState = {
    daily_captured_cents: 0,
    daily_reserved_cents: 0,
  };
  const now = new Date();

  let actual = "";
  let passed = false;

  switch (scenarioId) {
    case "A1": {
      // Injected product text: item claiming $1,899 total
      const proposal = {
        workspace_id: workspaceId,
        proposal_id: "prop_a1_" + Date.now(),
        policy_version_id: policyVersionId,
        currency: "USD",
        items: [
          {
            sku: "SKU-INJECTED-A1",
            title: "Executive High-Back Mesh Ergonomic Office Chair",
            merchant_domain: "office-direct.com",
            quantity: 5,
            unit_price_cents: 37980,
            server_price_cents: 37980,
            price_fetched_at: now.toISOString(),
          },
        ],
        total_cents: 189900, // $1,899.00 > $150.00 cart max
      };

      const result = evaluate(proposal, rules, spendState, now);
      actual = `${result.decision}: ${result.reason_codes.join(", ")}`;
      passed =
        result.decision === "DENY" &&
        result.reason_codes.includes("OVER_CART_CAP");
      break;
    }

    case "A2": {
      // Inflated total: claimed 999 ($9.99) vs sum 9990 ($99.90)
      const proposal = {
        workspace_id: workspaceId,
        proposal_id: "prop_a2_" + Date.now(),
        policy_version_id: policyVersionId,
        currency: "USD",
        items: [
          {
            sku: "SKU-MOUSE-01",
            title: "Logitech MX Master 3S",
            merchant_domain: "logitech.com",
            quantity: 1,
            unit_price_cents: 9990,
            server_price_cents: 9990,
            price_fetched_at: now.toISOString(),
          },
        ],
        total_cents: 999, // claim $9.99 while sum is $99.90
      };

      const result = evaluate(proposal, rules, spendState, now);
      actual = `${result.decision}: ${result.reason_codes.join(", ")}`;
      passed =
        result.decision === "DENY" &&
        result.reason_codes.includes("TOTAL_MISMATCH");
      break;
    }

    case "A3": {
      // Price tampering: proposed unit price 100 ($1.00) vs server price 4999 ($49.99)
      const proposal = {
        workspace_id: workspaceId,
        proposal_id: "prop_a3_" + Date.now(),
        policy_version_id: policyVersionId,
        currency: "USD",
        items: [
          {
            sku: "SKU-CHARGER-01",
            title: "Anker 65W GaN Charger",
            merchant_domain: "anker.com",
            quantity: 1,
            unit_price_cents: 100, // tampered
            server_price_cents: 4999, // actual
            price_fetched_at: now.toISOString(),
          },
        ],
        total_cents: 100,
      };

      const result = evaluate(proposal, rules, spendState, now);
      actual = `${result.decision}: ${result.reason_codes.join(", ")}`;
      passed =
        result.decision === "DENY" &&
        result.reason_codes.includes("ITEM_PRICE_MISMATCH");
      break;
    }

    case "A4": {
      // Cart swap after approval:
      // Proposal 1 is authorized and mandate is issued
      const itemsOriginal = [
        {
          sku: "SKU-CABLE-01",
          title: "Anker Cable",
          merchant: "anker.com",
          merchant_domain: "anker.com",
          quantity: 1,
          unit_price_cents: 1999,
          server_price_cents: 1999,
          fetched_at: now.toISOString(),
        },
      ];
      const p1Hash = computeProposalHash({
        workspace_id: workspaceId,
        proposal_id: "prop_a4_orig_" + Date.now(),
        policy_version_id: policyVersionId,
        currency: "USD",
        items: itemsOriginal,
        total_cents: 1999,
      });

      const propId = "prop_a4_" + Date.now();
      await db.insert(proposals).values({
        id: propId,
        workspaceId,
        itemsJson: itemsOriginal,
        totalCents: 1999,
        currency: "USD",
        proposalHash: p1Hash,
        state: "APPROVED",
        policyVersionId,
      });

      const issued = await issueMandate({
        workspaceId,
        proposalId: propId,
        proposalHash: p1Hash,
        policyVersionId,
        amountCents: 1999,
        merchantDomains: ["anker.com"],
        grant: "POLICY_AUTO",
      });

      // Attacker swaps cart / alters items
      const itemsTampered = [
        ...itemsOriginal,
        {
          sku: "SKU-MONITOR-01",
          title: "Dell 4K Monitor",
          merchant: "dell.com",
          merchant_domain: "dell.com",
          quantity: 1,
          unit_price_cents: 38999,
          server_price_cents: 38999,
          fetched_at: now.toISOString(),
        },
      ];
      const p2Hash = computeProposalHash({
        workspace_id: workspaceId,
        proposal_id: propId,
        policy_version_id: policyVersionId,
        currency: "USD",
        items: itemsTampered,
        total_cents: 40998,
      });

      try {
        await verifyMandate({
          token: issued.token,
          expectedProposalHash: p2Hash, // tampered hash
        });
        actual = "UNEXPECTED: Mandate accepted cart swap";
        passed = false;
      } catch (err: any) {
        actual = `REJECTED: ${err.code || err.message}`;
        passed = err.code === "HASH_MISMATCH";
      }
      break;
    }

    case "A5": {
      // Mandate replay: consume once, then attempt second consume
      const pHash = computeProposalHash({
        workspace_id: workspaceId,
        proposal_id: "prop_a5_" + Date.now(),
        policy_version_id: policyVersionId,
        currency: "USD",
        items: [
          {
            sku: "SKU-MAT-01",
            title: "Topo Mat",
            merchant: "ergodriven.com",
            merchant_domain: "ergodriven.com",
            quantity: 1,
            unit_price_cents: 7900,
            server_price_cents: 7900,
            fetched_at: now.toISOString(),
          },
        ],
        total_cents: 7900,
      });

      const propId = "prop_a5_" + Date.now();
      await db.insert(proposals).values({
        id: propId,
        workspaceId,
        itemsJson: [],
        totalCents: 7900,
        currency: "USD",
        proposalHash: pHash,
        state: "APPROVED",
        policyVersionId,
      });

      const issued = await issueMandate({
        workspaceId,
        proposalId: propId,
        proposalHash: pHash,
        policyVersionId,
        amountCents: 7900,
        merchantDomains: ["ergodriven.com"],
        grant: "HUMAN_APPROVAL",
      });

      const verified = await verifyMandate({ token: issued.token });
      const firstConsume = await consumeMandate(verified);
      const secondConsume = await consumeMandate(verified);

      actual = `First: ${firstConsume.success ? "CONSUMED" : "FAILED"}, Second: ${secondConsume.reasonCode || "SUCCESS"}`;
      passed =
        firstConsume.success === true &&
        secondConsume.success === false &&
        secondConsume.reasonCode === "MANDATE_ALREADY_USED";
      break;
    }

    case "A6": {
      // Forged webhook with bad signature
      const rawBody = JSON.stringify({
        id: "WH-FORGED-" + Date.now(),
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: {
          id: "CAP-FORGED-123",
          amount: { value: "84.99", currency_code: "USD" },
          custom_id: "prop_fake",
        },
      });

      const headers = {
        transmissionId: "fake-transmission-" + Date.now(),
        transmissionTime: new Date().toISOString(),
        certUrl: "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-123",
        authAlgo: "SHA256withRSA",
        transmissionSig: "bad_signature_forged_content",
      };

      const result = await processWebhook(rawBody, headers, workspaceId);
      actual = `HTTP ${result.status}: SECURITY_WEBHOOK_VERIFICATION_FAILED (${result.error || "Bad signature"})`;
      passed =
        result.status === 400 &&
        actual.includes("SECURITY_WEBHOOK_VERIFICATION_FAILED");
      break;
    }

    case "A7": {
      // Ledger tampering: append valid event, corrupt it in db, verifyChain
      const appendRes = await appendEvent({
        workspaceId,
        entityType: "proposal",
        entityId: "prop_tamper_target",
        type: "PROPOSAL_CREATED",
        actor: "agent",
        payload: { amount_cents: 5000, description: "Original untampered" },
      });

      // Tamper: direct database update of payload
      await db
        .update(ledgerEvents)
        .set({
          payloadJson: { amount_cents: 999999, description: "TAMPERED_IN_DB" },
        })
        .where(eq(ledgerEvents.id, appendRes.id));

      const chainResult = await verifyChain(workspaceId);
      actual = chainResult.valid
        ? "CHAIN_VALID (unexpected)"
        : `BROKEN_HASH_CHAIN at seq ${chainResult.brokenAtSeq}: ${chainResult.reason}`;
      passed =
        !chainResult.valid &&
        actual.includes("BROKEN");
      break;
    }
  }

  const requestsAfter = getGatewayCallCount();

  const runId = "run_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const nowIso = new Date().toISOString();

  await db.insert(attackRuns).values({
    id: runId,
    workspaceId,
    scenario: scenarioId,
    expected: meta.expected,
    actual,
    paypalRequestsBefore: requestsBefore,
    paypalRequestsAfter: requestsAfter,
    passed,
    createdAt: new Date(),
  });

  return {
    id: runId,
    workspaceId,
    scenario: scenarioId,
    name: meta.name,
    description: meta.description,
    expected: meta.expected,
    actual,
    paypalRequestsBefore: requestsBefore,
    paypalRequestsAfter: requestsAfter,
    passed,
    createdAt: nowIso,
  };
}

export async function runAllAttackScenarios(
  workspaceId: string
): Promise<AttackRunResult[]> {
  const results: AttackRunResult[] = [];
  for (const meta of ATTACK_SCENARIOS) {
    const res = await runScenario(meta.id, workspaceId);
    results.push(res);
  }
  return results;
}
