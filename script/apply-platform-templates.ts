/**
 * Apply Module 20 platform template tables (scripts/sql/platform-templates.sql).
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

  const sql = readFileSync(join(process.cwd(), "scripts/sql/platform-templates.sql"), "utf8");
  const marketplaceSql = readFileSync(join(process.cwd(), "scripts/sql/platform-templates-marketplace.sql"), "utf8");
  console.log("Applying platform template tables…\n");

  const pool = new pg.Pool(getDatabasePoolConfig(url));
  try {
    await pool.query(sql);
    await pool.query(marketplaceSql);
    console.log("✅ Platform template tables applied.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
