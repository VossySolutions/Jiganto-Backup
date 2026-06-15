import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.join(__dirname, "sql/test-mgmt-module.sql"), "utf-8");

const statements = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();
console.log(`Applying ${statements.length} Test Management schema statements...`);
for (const stmt of statements) {
  try {
    await client.query(stmt);
    console.log("OK:", stmt.slice(0, 60).replace(/\s+/g, " ") + "...");
  } catch (err) {
    console.warn("Skip or error:", err instanceof Error ? err.message : String(err));
  }
}
await client.end();
console.log("Done.");
