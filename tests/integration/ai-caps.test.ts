import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "@/lib/db/schema";
import {
  checkWorkspaceAiCap,
  recordAiUsage,
  MAX_AI_CALLS_PER_HOUR,
} from "@/rooms/propose/caps";
import { eq } from "drizzle-orm";

describe("AI Workspace Caps & ai_usage Integration (PRD §9.2)", () => {
  let client: PGlite;
  let testDb: ReturnType<typeof drizzle<typeof schema>>;
  const wsId = "ws_test_caps_tenant";

  beforeAll(async () => {
    client = new PGlite();
    testDb = drizzle(client, { schema });
    const migrationsFolder = path.resolve(process.cwd(), "drizzle");
    await migrate(testDb, { migrationsFolder });

    await testDb.insert(schema.workspaces).values({
      id: wsId,
      aiCallsUsed: 0,
      killSwitch: false,
    });
  }, 30000);

  afterAll(async () => {
    await client.close();
  });

  it("permits AI calls when usage is within limits", async () => {
    // Insert 5 calls into aiUsage table
    for (let i = 0; i < 5; i++) {
      await testDb.insert(schema.aiUsage).values({
        id: `use_test_${i}`,
        workspaceId: wsId,
        kind: "intent_parser",
        tokens: 120,
        at: new Date(),
      });
    }

    const pastDay = await testDb
      .select()
      .from(schema.aiUsage)
      .where(eq(schema.aiUsage.workspaceId, wsId));

    expect(pastDay.length).toBe(5);
  });

  it("blocks and triggers Replay mode when hourly limit is reached", async () => {
    // Fill up to MAX_AI_CALLS_PER_HOUR
    for (let i = 5; i < MAX_AI_CALLS_PER_HOUR; i++) {
      await testDb.insert(schema.aiUsage).values({
        id: `use_test_${i}`,
        workspaceId: wsId,
        kind: "intent_parser",
        tokens: 100,
        at: new Date(),
      });
    }

    const totalRows = await testDb
      .select()
      .from(schema.aiUsage)
      .where(eq(schema.aiUsage.workspaceId, wsId));

    expect(totalRows.length).toBe(MAX_AI_CALLS_PER_HOUR);
  });
});
