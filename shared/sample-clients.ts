/** Legacy demo clients from POST /api/clients/seed-demo — excluded from live org lists. */
export const LEGACY_SAMPLE_CLIENT_SHORT_CODES = ["AGB", "MGN", "RCG"] as const;

export function isLegacySampleClient(shortCode: string): boolean {
  return (LEGACY_SAMPLE_CLIENT_SHORT_CODES as readonly string[]).includes(shortCode);
}
