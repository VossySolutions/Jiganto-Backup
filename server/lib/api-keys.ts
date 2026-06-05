import { createHash, randomBytes } from "crypto";

export type StoredApiKey = {
  id: string;
  name: string;
  prefix: string;
  keyHash: string;
  scopes: string[];
  createdAt: string;
};

export type ApiKeyPublic = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
};

const KEY_PREFIX = "jig_";

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function listApiKeysPublic(
  brandingConfig: unknown,
): ApiKeyPublic[] {
  const keys = (brandingConfig as { apiKeys?: StoredApiKey[] })?.apiKeys ?? [];
  return keys.map(({ id, name, prefix, scopes, createdAt }) => ({
    id,
    name,
    prefix,
    scopes,
    createdAt,
  }));
}

export function createApiKey(
  brandingConfig: Record<string, unknown>,
  name: string,
  scopes: string[] = ["read"],
): { brandingConfig: Record<string, unknown>; rawKey: string; public: ApiKeyPublic } {
  const raw = `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  const stored: StoredApiKey = {
    id: randomBytes(8).toString("hex"),
    name: name.trim() || "API key",
    prefix: raw.slice(0, 12),
    keyHash: hashKey(raw),
    scopes: scopes.length ? scopes : ["read"],
    createdAt: new Date().toISOString(),
  };
  const existing = (brandingConfig.apiKeys as StoredApiKey[] | undefined) ?? [];
  return {
    brandingConfig: {
      ...brandingConfig,
      apiKeys: [...existing, stored],
    },
    rawKey: raw,
    public: {
      id: stored.id,
      name: stored.name,
      prefix: stored.prefix,
      scopes: stored.scopes,
      createdAt: stored.createdAt,
    },
  };
}

export function revokeApiKey(
  brandingConfig: Record<string, unknown>,
  keyId: string,
): Record<string, unknown> {
  const existing = (brandingConfig.apiKeys as StoredApiKey[] | undefined) ?? [];
  return {
    ...brandingConfig,
    apiKeys: existing.filter((k) => k.id !== keyId),
  };
}

export function verifyApiKey(
  brandingConfig: unknown,
  rawKey: string,
): StoredApiKey | null {
  const hash = hashKey(rawKey);
  const keys = (brandingConfig as { apiKeys?: StoredApiKey[] })?.apiKeys ?? [];
  return keys.find((k) => k.keyHash === hash) ?? null;
}
