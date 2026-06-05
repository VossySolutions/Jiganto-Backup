/**
 * Full application DB reset:
 * 1) Drop & recreate public schema (all app tables removed)
 * 2) drizzle-kit push — recreate tables from shared/schema.ts
 * 3) sync-auth-users.sql — auth trigger + backfill public.users
 *
 * Does NOT remove Supabase Authentication users (auth.users).
 *
 * Stop `npm run dev` before running to avoid pool conflicts.
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import pg from "pg";
import { getDatabasePoolConfig } from "../server/lib/database";

const root = process.cwd();

async function runSqlFile(pool: pg.Pool, relativePath: string, label: string): Promise<void> {
  const path = join(root, relativePath);
  const sql = readFileSync(path, "utf8");
  console.log(`\n→ ${label} (${relativePath})`);
  await pool.query(sql);
  console.log(`  ✓ ${label} done`);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
    process.exit(1);
  }

  console.log("Jiganto DB reset");
  console.log("  • Drops ALL public tables (app data deleted)");
  console.log("  • Keeps Supabase auth.users (logins remain)");
  console.log("  • Recreates schema from Drizzle\n");

  const pool = new pg.Pool(getDatabasePoolConfig(url));

  try {
    await runSqlFile(pool, "scripts/sql/reset-public-schema.sql", "Reset public schema");
  } catch (err) {
    console.error("Failed to reset schema:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }

  console.log("\n→ drizzle-kit push (recreate tables)");
  const push = spawnSync("npx", ["drizzle-kit", "push"], {
    stdio: "inherit",
    shell: true,
    cwd: root,
    env: process.env,
  });
  if (push.status !== 0) {
    console.error("db:push failed.");
    process.exit(push.status ?? 1);
  }
  console.log("  ✓ Tables created");

  const pool2 = new pg.Pool(getDatabasePoolConfig(url));
  try {
    await runSqlFile(pool2, "scripts/sql/sync-auth-users.sql", "Auth → users sync (triggers + backfill)");
  } catch (err) {
    console.warn("\n⚠ sync-auth-users.sql failed (run it manually in Supabase SQL Editor):", err);
  } finally {
    await pool2.end();
  }

  console.log(`
✅ Database reset complete.

Next:
  1. npm run dev
  2. Sign in with Supabase
  3. Access pending → "Set up as first administrator" (first user)
  4. Re-seed demo data if you use it (e.g. TM seed routes)
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
