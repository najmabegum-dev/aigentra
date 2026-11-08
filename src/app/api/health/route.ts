import { NextResponse } from "next/server";
import { validateEnv } from "@/lib/env";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { checkGeminiHealth } from "@/rooms/propose/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const { env, integrations, missingIntegrations } = validateEnv(process.env);
  const paymentMode = env?.PAYMENT_MODE ?? (process.env.PAYMENT_MODE === "paypal" ? "paypal" : "dev_stub");

  // Check database health (PGlite or Postgres)
  let databaseHealthy = Boolean(integrations.database);
  try {
    const database = await getDb();
    if (database) {
      await database.select().from(schema.workspaces).limit(1);
      databaseHealthy = true;
    }
  } catch {
    databaseHealthy = Boolean(integrations.database);
  }

  // Check Gemini model health
  const geminiHealth = await checkGeminiHealth();

  return NextResponse.json({
    status: "ok",
    paymentMode,
    integrations: {
      database: databaseHealthy,
      paypal: integrations.paypal,
      gemini: integrations.gemini || geminiHealth.operational,
      channel3: integrations.channel3,
      agStudio: integrations.agStudio,
    },
    geminiModel: {
      id: geminiHealth.id,
      configured: geminiHealth.configured,
      operational: geminiHealth.operational,
      error: geminiHealth.error,
    },
    missingIntegrations,
  });
}
