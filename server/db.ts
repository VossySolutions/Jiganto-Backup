import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { getDatabasePoolConfig } from "./lib/database";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. For Supabase: Project Settings → Database → Connection string → URI.",
  );
}

export const pool = new Pool(getDatabasePoolConfig(process.env.DATABASE_URL));
export const db = drizzle(pool, { schema });
