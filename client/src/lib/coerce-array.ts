/** Normalize API list responses — handlers may return an array or `{ data: [] }` / error objects. */
export function coerceArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const key of ["data", "projects", "items", "results"] as const) {
      if (Array.isArray(o[key])) return o[key] as T[];
    }
  }
  return [];
}
