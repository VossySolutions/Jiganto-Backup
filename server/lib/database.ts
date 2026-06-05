import type { PoolConfig } from "pg";

/** True when DATABASE_URL points at Supabase-hosted Postgres. */
export function isSupabaseDatabaseUrl(url: string): boolean {
  return url.includes("supabase.co") || url.includes("supabase.com");
}

/**
 * Pool options for node-pg. Supabase requires SSL; free tier benefits from a modest pool size.
 */
export function getDatabasePoolConfig(connectionString: string): PoolConfig {
  const supabase = isSupabaseDatabaseUrl(connectionString);

  return {
    connectionString,
    ...(supabase && {
      ssl: { rejectUnauthorized: false },
      // Supabase session pooler free tier ≈ 15 connections total (app + session store + drizzle-kit).
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    }),
  };
}

/** Connection string for Drizzle Kit (migrations / db:push). */
export function getMigrationDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? "";
}
