import crypto from "node:crypto";
import { getEnv } from "./env";

export const WORKSPACE_COOKIE_NAME = "aigentra_workspace";

// 14 days per PRD §7 (workspaces auto-purged after 14 days)
export const WORKSPACE_COOKIE_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

function resolveSecret(customSecret?: string): string {
  if (customSecret && customSecret.length >= 32) {
    return customSecret;
  }
  try {
    const env = getEnv();
    if (env?.SESSION_SECRET && env.SESSION_SECRET.length >= 32) {
      return env.SESSION_SECRET;
    }
  } catch {
    // getEnv() may throw in test environments where optional or unrelated env vars are omitted
  }
  const fallback = process.env.SESSION_SECRET;
  if (fallback && fallback.length >= 32) {
    return fallback;
  }
  throw new Error("SESSION_SECRET must be configured and at least 32 characters long.");
}

/**
 * Signs a workspace ID with HMAC-SHA256
 */
export function signWorkspaceId(workspaceId: string, secret?: string): string {
  if (!workspaceId || typeof workspaceId !== "string") {
    throw new Error("Invalid workspace ID to sign");
  }
  const key = resolveSecret(secret);
  const hmac = crypto.createHmac("sha256", key).update(workspaceId).digest("base64url");
  return `${workspaceId}.${hmac}`;
}

/**
 * Verifies a signed workspace cookie value using constant-time comparison.
 * Returns workspaceId if valid, or null if tampered/invalid.
 */
export function verifyWorkspaceId(signedValue: string | null | undefined, secret?: string): string | null {
  if (!signedValue || typeof signedValue !== "string") {
    return null;
  }

  const lastDotIndex = signedValue.lastIndexOf(".");
  if (lastDotIndex <= 0) {
    return null;
  }

  const workspaceId = signedValue.substring(0, lastDotIndex);
  const signature = signedValue.substring(lastDotIndex + 1);

  if (!workspaceId || !signature) {
    return null;
  }

  try {
    const key = resolveSecret(secret);
    const expectedSig = crypto.createHmac("sha256", key).update(workspaceId).digest("base64url");

    const sigBuffer = Buffer.from(signature, "utf-8");
    const expectedBuffer = Buffer.from(expectedSig, "utf-8");

    if (sigBuffer.length !== expectedBuffer.length) {
      return null;
    }

    if (crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return workspaceId;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the workspace ID from a Cookie header string.
 */
export function parseWorkspaceCookie(cookieHeader: string | null | undefined, secret?: string): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${WORKSPACE_COOKIE_NAME}=`)) {
      const rawValue = cookie.substring(WORKSPACE_COOKIE_NAME.length + 1);
      return verifyWorkspaceId(decodeURIComponent(rawValue), secret);
    }
  }

  return null;
}
