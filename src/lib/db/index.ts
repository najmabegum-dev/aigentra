import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

export * from "./schema";

export type DbClient = ReturnType<typeof drizzlePg<typeof schema>> | ReturnType<typeof drizzlePglite<typeof schema>>;

let globalDb: DbClient | undefined;
let activePool: Pool | undefined;
let activePglite: PGlite | undefined;

export function getDbMode(): "postgres" | "pglite" {
  return process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0
    ? "postgres"
    : "pglite";
}

export function getDb(customDataDir?: string): DbClient {
  if (globalDb) {
    return globalDb;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl && databaseUrl.length > 0) {
    activePool = new Pool({
      connectionString: databaseUrl,
    });
    globalDb = drizzlePg(activePool, { schema });
    return globalDb;
  }

  // Fallback to embedded PGlite stored in git-ignored directory
  const dataDir = customDataDir || path.resolve(process.cwd(), ".data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  activePglite = new PGlite(dataDir);
  globalDb = drizzlePglite(activePglite, { schema });
  return globalDb;
}

export async function closeDb(): Promise<void> {
  if (activePool) {
    await activePool.end();
    activePool = undefined;
  }
  if (activePglite) {
    await activePglite.close();
    activePglite = undefined;
  }
  globalDb = undefined;
}

export const db = getDb();
