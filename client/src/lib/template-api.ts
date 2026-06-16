import { fetchWithAuth } from "@/lib/queryClient";
import type { PlatformTemplateWithMeta } from "@shared/models/templates";

export type TemplatesDiscovery = {
  featured: PlatformTemplateWithMeta[];
  recentlyUsed: PlatformTemplateWithMeta[];
  popular: PlatformTemplateWithMeta[];
  newUpdated: PlatformTemplateWithMeta[];
  recommended: PlatformTemplateWithMeta[];
};

export type ApplyTemplateResult = {
  targetId: number;
  targetModule: string;
  navigateUrl: string;
  name: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const raw = await res.text();
    try {
      const p = JSON.parse(raw) as { message?: string };
      throw new Error(p.message ?? `${res.status}`);
    } catch {
      throw new Error(raw || `${res.status}`);
    }
  }
  return res.json() as Promise<T>;
}

export async function fetchTemplates(query: string): Promise<PlatformTemplateWithMeta[]> {
  const res = await fetchWithAuth(`/api/templates?${query}`);
  return parseJson(res);
}

export async function fetchTemplateModuleCounts(): Promise<Record<string, number>> {
  const res = await fetchWithAuth("/api/templates/module-counts");
  return parseJson(res);
}

export async function fetchTemplatesDiscovery(): Promise<TemplatesDiscovery> {
  const res = await fetchWithAuth("/api/templates/discovery");
  return parseJson(res);
}

export async function fetchMarketplaceTemplates(): Promise<PlatformTemplateWithMeta[]> {
  const res = await fetchWithAuth("/api/templates/marketplace");
  return parseJson(res);
}

export async function fetchTemplateById(id: number): Promise<PlatformTemplateWithMeta> {
  const res = await fetchWithAuth(`/api/templates/${id}`);
  return parseJson(res);
}

export async function applyTemplate(body: {
  templateId: number;
  name?: string;
  projectId?: number;
  workspaceId?: number;
}): Promise<ApplyTemplateResult> {
  const res = await fetchWithAuth("/api/templates/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function submitTemplateForReview(id: number, note?: string) {
  const res = await fetchWithAuth(`/api/templates/${id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  return parseJson(res);
}

export async function generateTemplateWithAi(body: { module: string; prompt: string; categoryTags?: string[] }) {
  const res = await fetchWithAuth("/api/templates/ai-generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function reviewTemplate(id: number, status: "approved" | "declined", note?: string) {
  const res = await fetchWithAuth(`/api/templates/${id}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, note }),
  });
  return parseJson(res);
}
