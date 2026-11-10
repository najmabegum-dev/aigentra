import * as jose from "jose";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  MandateClaims,
  MandateGrant,
  VerifiedMandate,
  ExecutionReasonCode,
} from "./types";
import { appendEvent } from "@/rooms/verify/ledger";

export class MandateVerificationError extends Error {
  readonly code: ExecutionReasonCode;

  constructor(code: ExecutionReasonCode, message: string) {
    super(message);
    this.name = "MandateVerificationError";
    this.code = code;
  }
}

type KeyType = CryptoKey;

// In-memory cached Ed25519 key pair (or imported from env)
let cachedKeyPair: { privateKey: KeyType; publicKey: KeyType } | null = null;
let cachedPublicKeyPem: string | null = null;

/**
 * Resets cached keys for unit testing isolation.
 */
export function _resetCachedKeyPairForTesting(): void {
  cachedKeyPair = null;
  cachedPublicKeyPem = null;
}

/**
 * Normalizes PEM string handling escaped newlines (\n) from single-line env definitions.
 */
function normalizePem(pem: string): string {
  return pem.replace(/\\n/g, "\n").trim();
}

/**
 * Initializes or retrieves the server-side Ed25519 signing and verification keys.
 * Golden Rule 10: Secrets never leave the server.
 *
 * In production (NODE_ENV === "production"), MANDATE_SIGNING_PRIVATE_KEY and
 * MANDATE_SIGNING_PUBLIC_KEY MUST be configured and valid, or the server fails to start.
 * Ephemeral keys are strictly forbidden in production.
 */
async function getKeyPair(): Promise<{
  privateKey: KeyType;
  publicKey: KeyType;
}> {
  if (cachedKeyPair) {
    return cachedKeyPair;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const rawPrivate =
    process.env.MANDATE_SIGNING_PRIVATE_KEY || process.env.MANDATE_SIGNING_KEY_PEM;
  const rawPublic =
    process.env.MANDATE_SIGNING_PUBLIC_KEY || process.env.MANDATE_PUBLIC_KEY_PEM;

  if (rawPrivate && rawPublic && rawPrivate.trim().length > 0 && rawPublic.trim().length > 0) {
    try {
      const privateKey = (await jose.importPKCS8(
        normalizePem(rawPrivate),
        "EdDSA"
      )) as CryptoKey;
      const publicKey = (await jose.importSPKI(
        normalizePem(rawPublic),
        "EdDSA"
      )) as CryptoKey;

      cachedKeyPair = { privateKey, publicKey };
      return cachedKeyPair;
    } catch (err) {
      if (isProduction) {
        throw new Error(
          `Mandate signing keys (MANDATE_SIGNING_PRIVATE_KEY / MANDATE_SIGNING_PUBLIC_KEY) are invalid in production: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
      // In non-production, fall through to ephemeral key generation
    }
  } else if (isProduction) {
    throw new Error(
      "Mandate signing keys (MANDATE_SIGNING_PRIVATE_KEY and MANDATE_SIGNING_PUBLIC_KEY) are missing in production. Generate keys using 'npm run keys:generate' and configure environment variables."
    );
  }

  // Generate an ephemeral Ed25519 key pair for runtime / dev / test
  const generated = await jose.generateKeyPair("EdDSA", { extractable: true });
  cachedKeyPair = {
    privateKey: generated.privateKey as CryptoKey,
    publicKey: generated.publicKey as CryptoKey,
  };

  return cachedKeyPair;
}

/**
 * Exports the Ed25519 public key as an SPKI PEM string for public verification.
 */
export async function getMandatePublicKeyPem(): Promise<string> {
  if (cachedPublicKeyPem) {
    return cachedPublicKeyPem;
  }

  const { publicKey } = await getKeyPair();
  cachedPublicKeyPem = await jose.exportSPKI(publicKey);
  return cachedPublicKeyPem;
}

export interface IssueMandateParams {
  workspaceId: string;
  proposalId: string;
  proposalHash: string;
  policyVersionId: string;
  amountCents: number;
  currency?: string;
  merchantDomains: string[];
  grant: MandateGrant;
  ttlSeconds?: number; // Default: 900 (15 minutes per PRD §6.5)
}

export interface IssuedMandateResult {
  jti: string;
  token: string;
  expiresAt: Date;
  issuedAt: Date;
}

/**
 * Issues an EdDSA-signed Authority Mandate (PRD §6.5).
 * Mirrors the mandate into the PostgreSQL mandates table for atomic single-use tracking.
 */
export async function issueMandate(
  params: IssueMandateParams
): Promise<IssuedMandateResult> {
  const { privateKey } = await getKeyPair();

  const jti = `mandate_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = new Date();
  const ttl = params.ttlSeconds ?? 900;
  const expiresAt = new Date(now.getTime() + ttl * 1000);

  const claims: Omit<MandateClaims, "iat" | "exp"> = {
    jti,
    sub: params.workspaceId,
    prop: params.proposalHash,
    polv: params.policyVersionId,
    amt: params.amountCents,
    cur: params.currency || "USD",
    mrc: params.merchantDomains,
    grant: params.grant,
    proposal_id: params.proposalId,
  };

  // Sign JWS compact token with Ed25519
  const token = await new jose.SignJWT(claims as Record<string, unknown>)
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
    .setJti(jti)
    .setSubject(params.workspaceId)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(privateKey);

  // Persist record to database for atomic single-use consumption
  const db = await getDb();
  await db.insert(schema.mandates).values({
    jti,
    workspaceId: params.workspaceId,
    proposalId: params.proposalId,
    propHash: params.proposalHash,
    policyVersionId: params.policyVersionId,
    amountCents: params.amountCents,
    currency: (params.currency || "USD") as "USD",
    grant: params.grant,
    createdAt: now,
    expiresAt,
    usedAt: null,
  });

  // Append hash-chained ledger event (Golden Rule 8)
  await appendEvent({
    workspaceId: params.workspaceId,
    entityType: "mandate",
    entityId: jti,
    type: "MANDATE_ISSUED",
    actor: params.grant === "POLICY_AUTO" ? "policy_engine" : "human",
    payload: {
      jti,
      proposal_id: params.proposalId,
      proposal_hash: params.proposalHash,
      amount_cents: params.amountCents,
      currency: params.currency || "USD",
      grant: params.grant,
      expires_at: expiresAt.toISOString(),
    },
  });

  return {
    jti,
    token,
    issuedAt: now,
    expiresAt,
  };
}

export interface VerifyMandateParams {
  token: string;
  expectedProposalHash?: string;
  now?: Date;
}

/**
 * Cryptographically verifies an Authority Mandate token.
 * Returns a branded VerifiedMandate that is the only gateway into src/rooms/execute.
 *
 * Golden Rule 2 (AGENTS.md):
 * src/rooms/execute functions accept only a VerifiedMandate.
 * Never cast around it.
 */
export async function verifyMandate(
  params: VerifyMandateParams
): Promise<VerifiedMandate> {
  const { publicKey } = await getKeyPair();

  let payload: jose.JWTPayload;
  try {
    const result = await jose.jwtVerify(params.token, publicKey, {
      algorithms: ["EdDSA"],
      currentDate: params.now,
    });
    payload = result.payload;
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code: string }).code;
      if (code === "ERR_JWT_EXPIRED") {
        throw new MandateVerificationError(
          "MANDATE_EXPIRED",
          "Authority Mandate has expired."
        );
      }
    }
    throw new MandateVerificationError(
      "MANDATE_BAD_SIGNATURE",
      "Mandate signature verification failed or token is malformed."
    );
  }

  const claims = payload as unknown as MandateClaims;

  // Verify proposal hash matching
  if (
    params.expectedProposalHash &&
    claims.prop !== params.expectedProposalHash
  ) {
    throw new MandateVerificationError(
      "HASH_MISMATCH",
      `Mandate proposal hash (${claims.prop}) does not match expected proposal hash (${params.expectedProposalHash}).`
    );
  }

  const issuedAt = new Date((claims.iat || 0) * 1000);
  const expiresAt = new Date((claims.exp || 0) * 1000);

  // Return branded VerifiedMandate
  return {
    jti: claims.jti,
    workspaceId: claims.sub,
    proposalId: claims.proposal_id,
    proposalHash: claims.prop,
    policyVersionId: claims.polv,
    amountCents: claims.amt,
    currency: claims.cur,
    merchantDomains: claims.mrc || [],
    grant: claims.grant,
    issuedAt,
    expiresAt,
    rawToken: params.token,
  } as VerifiedMandate;
}

export interface ConsumeMandateResult {
  success: boolean;
  reasonCode?: ExecutionReasonCode;
  mandate?: typeof schema.mandates.$inferSelect;
}

/**
 * Single-use atomic consumption using SQL (PRD §6.5):
 * UPDATE mandates SET used_at = now() WHERE jti = $1 AND used_at IS NULL AND exp > now() RETURNING *
 */
export async function consumeMandate(
  mandate: VerifiedMandate,
  dbClient?: any
): Promise<ConsumeMandateResult> {
  const db = dbClient || (await getDb());
  const now = new Date();

  const consumed = await db
    .update(schema.mandates)
    .set({ usedAt: now })
    .where(
      and(
        eq(schema.mandates.jti, mandate.jti),
        isNull(schema.mandates.usedAt),
        gt(schema.mandates.expiresAt, now)
      )
    )
    .returning();

  if (consumed.length > 0) {
    await appendEvent({
      workspaceId: mandate.workspaceId,
      entityType: "mandate",
      entityId: mandate.jti,
      type: "MANDATE_CONSUMED",
      actor: "executor",
      payload: {
        jti: mandate.jti,
        proposal_id: mandate.proposalId,
        consumed_at: now.toISOString(),
      },
    });
    return {
      success: true,
      mandate: consumed[0],
    };
  }

  // Determine specific rejection reason code
  const existing = await db
    .select()
    .from(schema.mandates)
    .where(eq(schema.mandates.jti, mandate.jti))
    .limit(1);

  if (existing.length === 0) {
    return {
      success: false,
      reasonCode: "MANDATE_MISSING",
    };
  }

  const row = existing[0];
  if (row.usedAt !== null) {
    return {
      success: false,
      reasonCode: "MANDATE_ALREADY_USED",
    };
  }

  if (new Date(row.expiresAt) <= now) {
    return {
      success: false,
      reasonCode: "MANDATE_EXPIRED",
    };
  }

  return {
    success: false,
    reasonCode: "MANDATE_ALREADY_USED",
  };
}
