import path from "node:path";
import fs from "node:fs";
import { getDbMode } from "../src/lib/db";

async function runMigrations() {
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  const mode = getDbMode();

  console.log(`[db:migrate] Running migrations in ${mode.toUpperCase()} mode...`);

  if (mode === "postgres") {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const db = drizzle(pool);

    try {
      await migrate(db, { migrationsFolder });
      console.log(`[db:migrate] Successfully applied migrations to PostgreSQL.`);
    } finally {
      await pool.end();
    }
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");

    const dataDir = path.resolve(process.cwd(), ".data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const client = new PGlite(dataDir);
    const db = drizzle(client);

    try {
      await migrate(db, { migrationsFolder });
      console.log(`[db:migrate] Successfully applied migrations to embedded PGlite at ${dataDir}`);
    } finally {
      await client.close();
    }
  }
}

runMigrations().catch((err) => {
  console.error("[db:migrate] Migration failed:", err);
  process.exit(1);
});
