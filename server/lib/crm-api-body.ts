/** Coerce JSON date strings to Date for Drizzle timestamp columns. */
export function parseApiDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return undefined;
}

export function withApiDates<T extends Record<string, unknown>>(
  body: T,
  keys: readonly string[],
): T {
  const out = { ...body };
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      (out as Record<string, unknown>)[key] = parseApiDate(out[key]);
    }
  }
  return out;
}

/** Drop read-only / relation fields clients may round-trip from GET responses. */
export function omitReadOnlyFields<T extends Record<string, unknown>>(
  body: T,
  keys: readonly string[] = ["id", "tenantId", "createdAt", "updatedAt"],
): Partial<T> {
  const out = { ...body };
  for (const key of keys) {
    delete out[key];
  }
  return out;
}

export function normalizeCrmOpportunityBody(body: Record<string, unknown>) {
  return withApiDates(omitReadOnlyFields(body), ["expectedCloseDate", "actualCloseDate"]);
}

export function normalizeCrmActivityBody(body: Record<string, unknown>) {
  return withApiDates(omitReadOnlyFields(body), ["dueDate", "reminderDate", "completedAt"]);
}

export function normalizeCrmTaskBody(body: Record<string, unknown>) {
  return withApiDates(omitReadOnlyFields(body), ["dueDate", "reminderDate", "completedAt"]);
}

export function normalizeCrmContractBody(body: Record<string, unknown>) {
  return withApiDates(omitReadOnlyFields(body), ["startDate", "endDate", "signedDate"]);
}
