import { NextResponse } from "next/server";
import { validateEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const { env, integrations, missingIntegrations } = validateEnv(process.env);
  const paymentMode = env?.PAYMENT_MODE ?? (process.env.PAYMENT_MODE === "paypal" ? "paypal" : "dev_stub");

  return NextResponse.json({
    status: "ok",
    paymentMode,
    integrations: {
      database: integrations.database,
      paypal: integrations.paypal,
      gemini: integrations.gemini,
      channel3: integrations.channel3,
      agStudio: integrations.agStudio,
    },
    missingIntegrations,
  });
}
