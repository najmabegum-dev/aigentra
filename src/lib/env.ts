import { z } from "zod";

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z
      .string({
        required_error: "DATABASE_URL is required",
      })
      .min(1, "DATABASE_URL cannot be empty"),
    SESSION_SECRET: z
      .string({
        required_error: "SESSION_SECRET is required",
      })
      .min(32, "SESSION_SECRET must be at least 32 characters long"),
    MANDATE_SIGNING_PRIVATE_KEY: z
      .string({
        required_error: "MANDATE_SIGNING_PRIVATE_KEY is required",
      })
      .min(1, "MANDATE_SIGNING_PRIVATE_KEY cannot be empty"),
    MANDATE_SIGNING_PUBLIC_KEY: z
      .string({
        required_error: "MANDATE_SIGNING_PUBLIC_KEY is required",
      })
      .min(1, "MANDATE_SIGNING_PUBLIC_KEY cannot be empty"),
    APP_BASE_URL: z.string().url().default("http://localhost:3000"),
    PAYMENT_MODE: z.enum(["paypal", "dev_stub"]).default("dev_stub"),

    // Optional integration variables (app degrades gracefully when missing)
    PAYPAL_CLIENT_ID: z.string().optional(),
    PAYPAL_CLIENT_SECRET: z.string().optional(),
    PAYPAL_WEBHOOK_ID: z.string().optional(),
    PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),

    AI_PROVIDER: z.string().default("gemini"),
    GEMINI_API_KEY: z.string().optional(),

    CHANNEL3_API_KEY: z.string().optional(),
    NEXT_PUBLIC_AG_LICENSE_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" && data.PAYMENT_MODE === "dev_stub") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PAYMENT_MODE"],
        message:
          "Refusing to start: PAYMENT_MODE cannot be dev_stub in production. Set PAYMENT_MODE=paypal.",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export interface IntegrationHealth {
  database: boolean;
  paypal: boolean;
  gemini: boolean;
  channel3: boolean;
  agStudio: boolean;
}

export interface EnvValidationResult {
  valid: boolean;
  env?: Env;
  errors?: string[];
  missingIntegrations: string[];
  integrations: IntegrationHealth;
}

export function getIntegrationStatus(env: Partial<Env>): {
  integrations: IntegrationHealth;
  missingIntegrations: string[];
} {
  const integrations: IntegrationHealth = {
    database: Boolean(env.DATABASE_URL && env.DATABASE_URL.length > 0),
    paypal: Boolean(
      env.PAYPAL_CLIENT_ID &&
        env.PAYPAL_CLIENT_SECRET &&
        env.PAYPAL_CLIENT_ID.length > 0 &&
        env.PAYPAL_CLIENT_SECRET.length > 0
    ),
    gemini: Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 0),
    channel3: Boolean(env.CHANNEL3_API_KEY && env.CHANNEL3_API_KEY.length > 0),
    agStudio: Boolean(
      env.NEXT_PUBLIC_AG_LICENSE_KEY &&
        env.NEXT_PUBLIC_AG_LICENSE_KEY.length > 0
    ),
  };

  const missingIntegrations: string[] = [];
  if (!integrations.paypal) missingIntegrations.push("PayPal (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)");
  if (!integrations.gemini) missingIntegrations.push("Gemini AI (GEMINI_API_KEY)");
  if (!integrations.channel3) missingIntegrations.push("Channel3 Product Search (CHANNEL3_API_KEY)");
  if (!integrations.agStudio) missingIntegrations.push("AG Studio License (NEXT_PUBLIC_AG_LICENSE_KEY)");

  return { integrations, missingIntegrations };
}

export function validateEnv(
  rawEnv: Record<string, string | undefined> = process.env
): EnvValidationResult {
  const parsed = envSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const errors = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "env"}: ${issue.message}`
    );
    const { integrations, missingIntegrations } = getIntegrationStatus(rawEnv);
    return {
      valid: false,
      errors,
      integrations,
      missingIntegrations,
    };
  }

  const { integrations, missingIntegrations } = getIntegrationStatus(parsed.data);

  return {
    valid: true,
    env: parsed.data,
    integrations,
    missingIntegrations,
  };
}

let cachedEnv: Env | undefined;

/**
 * Returns validated environment variables. Throws an explicit error if required
 * configuration is missing or invalid.
 */
export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = validateEnv(process.env);
  if (!result.valid || !result.env) {
    const errorDetails = result.errors?.join("\n  - ") || "Unknown validation error";
    throw new Error(
      `[AIGENTRA Config Error] Environment validation failed:\n  - ${errorDetails}`
    );
  }

  cachedEnv = result.env;
  return cachedEnv;
}
