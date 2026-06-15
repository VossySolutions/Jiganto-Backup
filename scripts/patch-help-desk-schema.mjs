import "dotenv/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "sql", "help-desk-module.sql");
const sql = readFileSync(sqlPath, "utf8");

const statements = sql
  .split(";")
  .map((s) => s.replace(/--[^\n]*/g, "").trim())
  .filter(Boolean);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  for (const statement of statements) {
    await pool.query(statement);
    const preview = statement.replace(/\s+/g, " ").slice(0, 72);
    console.log("OK:", preview);
  }
  console.log("Help Desk schema patch applied");
} catch (err) {
  console.error("Patch failed:", err);
  process.exit(1);
} finally {
  await pool.end();
}
