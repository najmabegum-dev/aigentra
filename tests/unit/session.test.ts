import { describe, it, expect } from "vitest";
import { signWorkspaceId, verifyWorkspaceId, parseWorkspaceCookie } from "@/lib/session";

describe("Session & Workspace Cookie Signing", () => {
  const secret = "0123456789abcdef0123456789abcdef"; // 32 chars
  const workspaceId = "ws_test_987654321";

  it("signs and verifies a valid workspace ID", () => {
    const signed = signWorkspaceId(workspaceId, secret);
    expect(signed).toContain(".");
    expect(signed.startsWith(workspaceId + ".")).toBe(true);

    const verified = verifyWorkspaceId(signed, secret);
    expect(verified).toBe(workspaceId);
  });

  it("rejects tampered workspace ID", () => {
    const signed = signWorkspaceId(workspaceId, secret);
    const tampered = signed.replace("ws_test_987654321", "ws_test_attacker");
    expect(verifyWorkspaceId(tampered, secret)).toBeNull();
  });

  it("rejects tampered signature", () => {
    const signed = signWorkspaceId(workspaceId, secret);
    const tampered = signed.slice(0, -2) + "ab";
    expect(verifyWorkspaceId(tampered, secret)).toBeNull();
  });

  it("rejects signature signed with different secret", () => {
    const signed = signWorkspaceId(workspaceId, secret);
    const differentSecret = "fedcba9876543210fedcba9876543210";
    expect(verifyWorkspaceId(signed, differentSecret)).toBeNull();
  });

  it("rejects malformed cookies without separator", () => {
    expect(verifyWorkspaceId("randominvalidstring", secret)).toBeNull();
    expect(verifyWorkspaceId("", secret)).toBeNull();
  });

  it("parses workspace ID from a raw Cookie header", () => {
    const signed = signWorkspaceId(workspaceId, secret);
    const cookieHeader = `other_cookie=123; aigentra_workspace=${signed}; foo=bar`;
    const extracted = parseWorkspaceCookie(cookieHeader, secret);
    expect(extracted).toBe(workspaceId);
  });

  it("returns null when cookie header has no aigentra_workspace or invalid signature", () => {
    expect(parseWorkspaceCookie("other_cookie=123", secret)).toBeNull();
    expect(parseWorkspaceCookie("aigentra_workspace=invalid.sig", secret)).toBeNull();
    expect(parseWorkspaceCookie(null, secret)).toBeNull();
  });
});
