import { describe, it, expect } from "vitest";
import { validateEnv, envSchema, getIntegrationStatus } from "@/lib/env";

describe("Environment Variable Validation (src/lib/env.ts)", () => {
  const validBaseEnv = {
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/aigentra_test",
    SESSION_SECRET: "a_very_secure_and_long_session_secret_32chars_min",
    MANDATE_SIGNING_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----",
    MANDATE_SIGNING_PUBLIC_KEY: "-----BEGIN PUBLIC KEY-----\nMOCK_KEY\n-----END PUBLIC KEY-----",
  };

  it("passes validation with only the required variables (integrations optional)", () => {
    const result = validateEnv(validBaseEnv);
    expect(result.valid).toBe(true);
    expect(result.env).toBeDefined();
    expect(result.env?.PAYMENT_MODE).toBe("dev_stub");
    expect(result.env?.NODE_ENV).toBe("development");
    expect(result.env?.APP_BASE_URL).toBe("http://localhost:3000");

    // All optional integrations report false (gracefully degraded)
    expect(result.integrations.database).toBe(true);
    expect(result.integrations.paypal).toBe(false);
    expect(result.integrations.gemini).toBe(false);
    expect(result.integrations.channel3).toBe(false);
    expect(result.integrations.agStudio).toBe(false);

    // Missing integrations list contains the 4 optional services
    expect(result.missingIntegrations.length).toBe(4);
    expect(result.missingIntegrations).toEqual(
      expect.arrayContaining([
        expect.stringContaining("PayPal"),
        expect.stringContaining("Gemini"),
        expect.stringContaining("Channel3"),
        expect.stringContaining("AG Studio"),
      ])
    );
  });

  it("fails if DATABASE_URL is missing", () => {
    const env = { ...validBaseEnv, DATABASE_URL: "" };
    const result = validateEnv(env);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("DATABASE_URL"))).toBe(true);
  });

  it("fails if SESSION_SECRET is shorter than 32 characters", () => {
    const env = { ...validBaseEnv, SESSION_SECRET: "too_short" };
    const result = validateEnv(env);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("SESSION_SECRET"))).toBe(true);
  });

  it("fails if Mandate keys are missing", () => {
    const envNoPrivate = { ...validBaseEnv, MANDATE_SIGNING_PRIVATE_KEY: "" };
    const resultPrivate = validateEnv(envNoPrivate);
    expect(resultPrivate.valid).toBe(false);
    expect(resultPrivate.errors?.some((e) => e.includes("MANDATE_SIGNING_PRIVATE_KEY"))).toBe(true);

    const envNoPublic = { ...validBaseEnv, MANDATE_SIGNING_PUBLIC_KEY: "" };
    const resultPublic = validateEnv(envNoPublic);
    expect(resultPublic.valid).toBe(false);
    expect(resultPublic.errors?.some((e) => e.includes("MANDATE_SIGNING_PUBLIC_KEY"))).toBe(true);
  });

  it("defaults PAYMENT_MODE to 'dev_stub' and accepts 'paypal'", () => {
    const stubResult = validateEnv(validBaseEnv);
    expect(stubResult.env?.PAYMENT_MODE).toBe("dev_stub");

    const paypalResult = validateEnv({
      ...validBaseEnv,
      PAYMENT_MODE: "paypal",
    });
    expect(paypalResult.valid).toBe(true);
    expect(paypalResult.env?.PAYMENT_MODE).toBe("paypal");
  });

  it("rejects invalid PAYMENT_MODE values", () => {
    const invalidResult = validateEnv({
      ...validBaseEnv,
      PAYMENT_MODE: "stripe" as any,
    });
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors?.some((e) => e.includes("PAYMENT_MODE"))).toBe(true);
  });

  it("refuses to start with dev_stub when NODE_ENV is production", () => {
    const prodStubEnv = {
      ...validBaseEnv,
      NODE_ENV: "production",
      PAYMENT_MODE: "dev_stub",
    };
    const result = validateEnv(prodStubEnv);
    expect(result.valid).toBe(false);
    expect(
      result.errors?.some((e) =>
        e.includes("Refusing to start: PAYMENT_MODE cannot be dev_stub in production")
      )
    ).toBe(true);
  });

  it("allows production start when PAYMENT_MODE is paypal", () => {
    const prodPaypalEnv = {
      ...validBaseEnv,
      NODE_ENV: "production",
      PAYMENT_MODE: "paypal",
    };
    const result = validateEnv(prodPaypalEnv);
    expect(result.valid).toBe(true);
  });

  it("correctly identifies active integrations when optional keys are provided", () => {
    const fullEnv = {
      ...validBaseEnv,
      PAYPAL_CLIENT_ID: "mock_paypal_id",
      PAYPAL_CLIENT_SECRET: "mock_paypal_secret",
      GEMINI_API_KEY: "mock_gemini_key",
      CHANNEL3_API_KEY: "mock_channel3_key",
      NEXT_PUBLIC_AG_LICENSE_KEY: "mock_ag_key",
    };

    const status = getIntegrationStatus(fullEnv);
    expect(status.integrations.database).toBe(true);
    expect(status.integrations.paypal).toBe(true);
    expect(status.integrations.gemini).toBe(true);
    expect(status.integrations.channel3).toBe(true);
    expect(status.integrations.agStudio).toBe(true);
    expect(status.missingIntegrations.length).toBe(0);
  });
});
