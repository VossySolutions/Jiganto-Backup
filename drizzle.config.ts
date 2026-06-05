import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { getMigrationDatabaseUrl } from "./server/lib/database";

const url = getMigrationDatabaseUrl();
if (!url) {
  throw new Error(
    "DATABASE_URL must be set. See .env.example for Supabase setup.",
  );
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
