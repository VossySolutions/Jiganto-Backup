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

/** True for pool/network blips common with Supabase session pooler after restarts. */
export function isTransientDbError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error && "cause" in err ? String((err as { cause?: unknown }).cause) : "";
  const combined = `${msg} ${cause}`.toLowerCase();
  return (
    combined.includes("connection terminated") ||
    combined.includes("connection timeout") ||
    combined.includes("econnreset") ||
    combined.includes("etimedout") ||
    combined.includes("too many clients")
  );
}

/** Retry a DB operation once or twice on transient pool/network errors. */
export async function withDbRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isTransientDbError(err) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw last;
}
