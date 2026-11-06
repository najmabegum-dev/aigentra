import { describe, expect, it, beforeAll } from "vitest";
import * as schema from "@/lib/db/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import * as jose from "jose";
import {
  issueMandate,
  verifyMandate,
  consumeMandate,
  getMandatePublicKeyPem,
  MandateVerificationError,
} from "@/rooms/authorize/mandates";

describe("Mandates & Cryptographic Verification (PRD §6.5, F5)", () => {
  const wsId = "ws_test_mandate_unit";
  const proposalId = "prop_test_mandate_01";
  const policyVersionId = "pv_test_mandate_v1";
  const proposalHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  beforeAll(async () => {
    // Seed workspace
    await db.delete(schema.mandates).where(eq(schema.mandates.workspaceId, wsId));
    await db.delete(schema.proposals).where(eq(schema.proposals.workspaceId, wsId));
    await db.delete(schema.policyVersions).where(eq(schema.policyVersions.workspaceId, wsId));
    await db.delete(schema.policies).where(eq(schema.policies.workspaceId, wsId));
    await db.delete(schema.workspaces).where(eq(schema.workspaces.id, wsId));

    await db.insert(schema.workspaces).values({ id: wsId });
    await db.insert(schema.policies).values({ id: "pol_test", workspaceId: wsId });
    await db.insert(schema.policyVersions).values({
      id: policyVersionId,
      policyId: "pol_test",
      workspaceId: wsId,
      version: 1,
      rulesJson: {},
    });
    await db.insert(schema.proposals).values({
      id: proposalId,
      workspaceId: wsId,
      itemsJson: [],
      totalCents: 8499,
      currency: "USD",
      proposalHash,
      state: "PENDING_APPROVAL",
      policyVersionId,
    });
  });

  it("issues and cryptographically verifies an Ed25519 HUMAN_APPROVAL mandate", async () => {
    const issued = await issueMandate({
      workspaceId: wsId,
      proposalId,
      proposalHash,
      policyVersionId,
      amountCents: 8499,
      currency: "USD",
      merchantDomains: ["keychron.com"],
      grant: "HUMAN_APPROVAL",
      ttlSeconds: 900,
    });

    expect(issued.token).toBeDefined();
    expect(typeof issued.token).toBe("string");
    expect(issued.jti).toBeDefined();

    // Verify token
    const verified = await verifyMandate({
      token: issued.token,
      expectedProposalHash: proposalHash,
    });

    expect(verified.jti).toBe(issued.jti);
    expect(verified.workspaceId).toBe(wsId);
    expect(verified.proposalId).toBe(proposalId);
    expect(verified.proposalHash).toBe(proposalHash);
    expect(verified.amountCents).toBe(8499);
    expect(verified.currency).toBe("USD");
    expect(verified.merchantDomains).toEqual(["keychron.com"]);
    expect(verified.grant).toBe("HUMAN_APPROVAL");
  });

  it("issues and verifies a POLICY_AUTO mandate", async () => {
    const issued = await issueMandate({
      workspaceId: wsId,
      proposalId,
      proposalHash,
      policyVersionId,
      amountCents: 1999,
      currency: "USD",
      merchantDomains: ["anker.com"],
      grant: "POLICY_AUTO",
      ttlSeconds: 900,
    });

    const verified = await verifyMandate({
      token: issued.token,
      expectedProposalHash: proposalHash,
    });

    expect(verified.grant).toBe("POLICY_AUTO");
    expect(verified.amountCents).toBe(1999);
  });

  it("rejects tokens with forged/invalid signatures with MANDATE_BAD_SIGNATURE", async () => {
    // Generate an attacker key pair
    const attackerKeyPair = await jose.generateKeyPair("EdDSA");
    const attackerToken = await new jose.SignJWT({
      prop: proposalHash,
      polv: policyVersionId,
      amt: 8499,
      cur: "USD",
      mrc: ["attacker.com"],
      grant: "POLICY_AUTO",
      proposal_id: proposalId,
    })
      .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
      .setJti("jti_forged_999")
      .setSubject(wsId)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(attackerKeyPair.privateKey);

    await expect(
      verifyMandate({
        token: attackerToken,
        expectedProposalHash: proposalHash,
      })
    ).rejects.toMatchObject({
      code: "MANDATE_BAD_SIGNATURE",
    });
  });

  it("rejects expired mandates with MANDATE_EXPIRED", async () => {
    // Issue token that expired 10 seconds ago
    const expiredMandate = await issueMandate({
      workspaceId: wsId,
      proposalId,
      proposalHash,
      policyVersionId,
      amountCents: 5000,
      currency: "USD",
      merchantDomains: ["keychron.com"],
      grant: "HUMAN_APPROVAL",
      ttlSeconds: -10, // already expired
    });

    await expect(
      verifyMandate({
        token: expiredMandate.token,
        expectedProposalHash: proposalHash,
      })
    ).rejects.toMatchObject({
      code: "MANDATE_EXPIRED",
    });
  });

  it("rejects proposal hash tampering with HASH_MISMATCH", async () => {
    const issued = await issueMandate({
      workspaceId: wsId,
      proposalId,
      proposalHash,
      policyVersionId,
      amountCents: 8499,
      currency: "USD",
      merchantDomains: ["keychron.com"],
      grant: "HUMAN_APPROVAL",
    });

    const tamperedHash = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

    await expect(
      verifyMandate({
        token: issued.token,
        expectedProposalHash: tamperedHash,
      })
    ).rejects.toMatchObject({
      code: "HASH_MISMATCH",
    });
  });

  it("exports a valid Ed25519 SPKI public key PEM", async () => {
    const pem = await getMandatePublicKeyPem();
    expect(pem).toContain("-----BEGIN PUBLIC KEY-----");
    expect(pem).toContain("-----END PUBLIC KEY-----");
  });

  it("enforces atomic single-use consumption: replay returns MANDATE_ALREADY_USED", async () => {
    const issued = await issueMandate({
      workspaceId: wsId,
      proposalId,
      proposalHash,
      policyVersionId,
      amountCents: 8499,
      currency: "USD",
      merchantDomains: ["keychron.com"],
      grant: "HUMAN_APPROVAL",
    });

    const verified = await verifyMandate({
      token: issued.token,
      expectedProposalHash: proposalHash,
    });

    // 1st consumption: MUST succeed
    const firstUse = await consumeMandate(verified);
    expect(firstUse.success).toBe(true);

    // 2nd consumption (replay attack): MUST fail with MANDATE_ALREADY_USED
    const secondUse = await consumeMandate(verified);
    expect(secondUse.success).toBe(false);
    if (!secondUse.success) {
      expect(secondUse.reasonCode).toBe("MANDATE_ALREADY_USED");
    }
  });

  it("rejects consumption of an expired mandate with MANDATE_EXPIRED", async () => {
    const issued = await issueMandate({
      workspaceId: wsId,
      proposalId,
      proposalHash,
      policyVersionId,
      amountCents: 5000,
      currency: "USD",
      merchantDomains: ["keychron.com"],
      grant: "HUMAN_APPROVAL",
      ttlSeconds: -5,
    });

    // Artificially bypass verifyMandate to test DB consumption lock
    const fakeVerified = {
      jti: issued.jti,
      workspaceId: wsId,
      proposalId,
      proposalHash,
      policyVersionId,
      amountCents: 5000,
      currency: "USD",
      merchantDomains: ["keychron.com"],
      grant: "HUMAN_APPROVAL" as const,
      issuedAt: new Date(Date.now() - 10000),
      expiresAt: new Date(Date.now() - 5000),
      rawToken: issued.token,
    } as any;

    const result = await consumeMandate(fakeVerified);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reasonCode).toBe("MANDATE_EXPIRED");
    }
  });

  it("gives exactly one winner and one loser when two consume calls run in parallel", async () => {
    const issued = await issueMandate({
      workspaceId: wsId,
      proposalId,
      proposalHash,
      policyVersionId,
      amountCents: 8499,
      currency: "USD",
      merchantDomains: ["keychron.com"],
      grant: "HUMAN_APPROVAL",
    });

    const verified = await verifyMandate({
      token: issued.token,
      expectedProposalHash: proposalHash,
    });

    // Execute two concurrent consumption queries simultaneously
    const [res1, res2] = await Promise.all([
      consumeMandate(verified),
      consumeMandate(verified),
    ]);

    const successes = [res1, res2].filter((r) => r.success);
    const failures = [res1, res2].filter((r) => !r.success);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].reasonCode).toBe("MANDATE_ALREADY_USED");
  });
});
