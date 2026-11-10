import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import * as jose from "jose";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  issueMandate,
  verifyMandate,
  getMandatePublicKeyPem,
  _resetCachedKeyPairForTesting,
} from "@/rooms/authorize/mandates";
import { MandateGrant } from "@/rooms/authorize/types";

describe("Production Mandate Key Enforcement (F3)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    _resetCachedKeyPairForTesting();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    _resetCachedKeyPairForTesting();
  });

  it("fails to start / initialize in production when mandate keys are missing", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.MANDATE_SIGNING_PRIVATE_KEY;
    delete process.env.MANDATE_SIGNING_PUBLIC_KEY;
    delete process.env.MANDATE_SIGNING_KEY_PEM;
    delete process.env.MANDATE_PUBLIC_KEY_PEM;

    await expect(getMandatePublicKeyPem()).rejects.toThrow(
      /Mandate signing keys \(MANDATE_SIGNING_PRIVATE_KEY and MANDATE_SIGNING_PUBLIC_KEY\) are missing in production/
    );
  });

  it("fails in production when mandate keys are corrupt or invalid", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.MANDATE_SIGNING_PRIVATE_KEY = "corrupted_invalid_private_key";
    process.env.MANDATE_SIGNING_PUBLIC_KEY = "corrupted_invalid_public_key";

    await expect(getMandatePublicKeyPem()).rejects.toThrow(
      /Mandate signing keys \(MANDATE_SIGNING_PRIVATE_KEY \/ MANDATE_SIGNING_PUBLIC_KEY\) are invalid in production/
    );
  });

  it("succeeds in production when valid single-line escaped keys are provided", async () => {
    // Generate valid Ed25519 keys
    const generated = await jose.generateKeyPair("EdDSA", { extractable: true });
    const privPem = await jose.exportPKCS8(generated.privateKey);
    const pubPem = await jose.exportSPKI(generated.publicKey);

    // Escape as single line with \n
    const singleLinePriv = privPem.trim().replace(/\r?\n/g, "\\n");
    const singleLinePub = pubPem.trim().replace(/\r?\n/g, "\\n");

    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.MANDATE_SIGNING_PRIVATE_KEY = singleLinePriv;
    process.env.MANDATE_SIGNING_PUBLIC_KEY = singleLinePub;

    const exportedPubPem = await getMandatePublicKeyPem();
    expect(exportedPubPem).toContain("BEGIN PUBLIC KEY");

    // Also verify issueMandate and verifyMandate work seamlessly
    const db = await getDb();
    const wsId = `ws_prod_${Date.now()}`;
    await db.insert(schema.workspaces).values({
      id: wsId,
    });

    const polId = `pol_prod_${Date.now()}`;
    await db.insert(schema.policies).values({
      id: polId,
      workspaceId: wsId,
    });

    const polvId = `polv_prod_${Date.now()}`;
    await db.insert(schema.policyVersions).values({
      id: polvId,
      policyId: polId,
      workspaceId: wsId,
      version: 1,
      rulesJson: {
        auto_allow_threshold_cents: 10000,
        daily_cap_cents: 50000,
        category_restrictions: [],
        merchant_domain_whitelist: [],
        disallowed_merchants: [],
        require_kill_switch: false,
        timezone: "UTC",
      },
    });

    const propId = `prop_prod_${Date.now()}`;
    const proposalHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    await db.insert(schema.proposals).values({
      id: propId,
      workspaceId: wsId,
      itemsJson: [],
      totalCents: 5000,
      currency: "USD",
      state: "MANDATED",
      proposalHash,
      policyVersionId: polvId,
    });

    const issued = await issueMandate({
      workspaceId: wsId,
      proposalId: propId,
      proposalHash,
      policyVersionId: polvId,
      amountCents: 5000,
      currency: "USD",
      merchantDomains: ["test.com"],
      grant: "POLICY_AUTO",
      ttlSeconds: 900,
    });
    expect(issued.token).toBeDefined();

    const verified = await verifyMandate({
      token: issued.token,
      expectedProposalHash: proposalHash,
    });
    expect(verified.proposalId).toBe(propId);
  });

  it("npm run keys:generate produces importable single-line Ed25519 keys", async () => {
    const output = execSync("node scripts/generate-keys.mjs", {
      encoding: "utf8",
    });

    const privMatch = output.match(/MANDATE_SIGNING_PRIVATE_KEY="([^"]+)"/);
    const pubMatch = output.match(/MANDATE_SIGNING_PUBLIC_KEY="([^"]+)"/);

    expect(privMatch).not.toBeNull();
    expect(pubMatch).not.toBeNull();

    const privKeyStr = privMatch![1];
    const pubKeyStr = pubMatch![1];

    expect(privKeyStr).toContain("BEGIN PRIVATE KEY");
    expect(pubKeyStr).toContain("BEGIN PUBLIC KEY");

    // Configure and verify production mode initializes with generated keys
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.MANDATE_SIGNING_PRIVATE_KEY = privKeyStr;
    process.env.MANDATE_SIGNING_PUBLIC_KEY = pubKeyStr;

    _resetCachedKeyPairForTesting();
    const exportedPem = await getMandatePublicKeyPem();
    expect(exportedPem).toContain("BEGIN PUBLIC KEY");
  });
});
