/**
 * QTSP / AdES integration scaffold (Phase 3).
 * Set QTSP_PROVIDER=mock|docusign|globalsign and credentials to enable Advanced signatures.
 */

export type SignatureLevel = "ses" | "ades";

export function getQtspProvider(): string | null {
  const p = process.env.QTSP_PROVIDER?.trim();
  return p && p !== "none" ? p : null;
}

export function isAdesAvailable(): boolean {
  const provider = getQtspProvider();
  if (!provider) return false;
  if (provider === "mock") return true;
  return !!(process.env.QTSP_API_KEY?.trim() || process.env.DOCUSIGN_INTEGRATION_KEY?.trim());
}

export async function applyQtspTimestamp(params: {
  requestId: number;
  signerId: number;
  signatureLevel: string;
  documentHash: string;
}): Promise<{ applied: boolean; provider?: string; timestampToken?: string }> {
  if (params.signatureLevel !== "ades") return { applied: false };

  const provider = getQtspProvider();
  if (!provider) {
    throw new Error("Advanced Electronic Signature (AdES) requires QTSP_PROVIDER to be configured");
  }

  if (provider === "mock") {
    const token = `mock-ts-${params.requestId}-${params.signerId}-${Date.now()}`;
    console.info(`[eSign QTSP mock] timestamp for request ${params.requestId}, hash ${params.documentHash.slice(0, 16)}…`);
    return { applied: true, provider: "mock", timestampToken: token };
  }

  // Production: wire DocuSign / GlobalSign / other QTSP here
  throw new Error(`QTSP provider "${provider}" is not fully configured. Set API credentials in environment.`);
}
