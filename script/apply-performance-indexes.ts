/**
 * Apply performance DB indexes (scripts/sql/performance-indexes.sql).
 * Idempotent — safe to re-run.
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";
import { getDatabasePoolConfig } from "../server/lib/database";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const sql = readFileSync(join(process.cwd(), "scripts/sql/performance-indexes.sql"), "utf8");
  console.log("Applying performance indexes…\n");

  const pool = new pg.Pool(getDatabasePoolConfig(url));
  try {
    await pool.query(sql);
    console.log("✅ Performance indexes applied.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
