import { eq, and, or, isNull, isNotNull, desc, gte, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  platformTemplates, templateUsageLog, templateAiGenerations,
  type TemplateModule, type PlatformTemplate, type PlatformTemplateWithMeta,
} from "@shared/models/templates";
import {
  surveyTemplates, bpmTemplates, signoffTemplates, workspaceTemplates, bpmlTemplates,
  tenants, users,
} from "@shared/schema";
import { buildSnapshot, snapshotFromBpmTemplate } from "./snapshots";
import { applyTemplate } from "./apply";
import { seedSystemPlatformTemplates } from "./seed";

const MODULE_LABELS: Record<TemplateModule, string> = {
  bpm_framework: "BPM Framework",
  bpm_diagram: "BPM Process Diagram",
  bpm_orgchart: "BPM Org Chart",
  project: "Project Setup",
  survey: "Survey",
  esign: "eSign Document",
  workspace: "Workspace",
  test_mgmt: "Test Management",
  bpml: "BPML",
  whiteboard: "Whiteboard",
};

export function getModuleLabel(module: string) {
  return MODULE_LABELS[module as TemplateModule] ?? module;
}

const syncedTenants = new Set<number>();

export async function ensureTemplatesReady(tenantId: number) {
  await seedSystemPlatformTemplates();
  if (!syncedTenants.has(tenantId)) {
    await syncLegacyTemplates(tenantId);
    syncedTenants.add(tenantId);
  }
}

async function syncLegacyTemplates(tenantId: number) {
  const existing = await db.select({
    sourceModule: platformTemplates.sourceModule,
    sourceId: platformTemplates.sourceId,
  }).from(platformTemplates).where(isNotNull(platformTemplates.sourceId));
  const existingKeys = new Set(
    existing.filter(e => e.sourceModule && e.sourceId).map(e => `${e.sourceModule}:${e.sourceId}`),
  );

  const surveys = await db.select().from(surveyTemplates).where(
    or(isNull(surveyTemplates.tenantId), eq(surveyTemplates.tenantId, tenantId), eq(surveyTemplates.tier, "system")),
  );
  for (const t of surveys) {
    const key = `survey:${t.id}`;
    if (existingKeys.has(key)) continue;
    await db.insert(platformTemplates).values({
      tenantId: t.tenantId, name: t.title, description: t.description,
      module: "survey", categoryTags: t.category ? [t.category] : null,
      tier: t.tier ?? "customer", sourceModule: "survey", sourceId: t.id,
      snapshotJsonb: { title: t.title, description: t.description, surveyType: t.surveyType, category: t.category, questionsJson: t.questionsJson, settingsJson: t.settingsJson },
      status: "active", createdBy: t.createdBy,
    });
  }

  const bpmTpls = await db.select().from(bpmTemplates);
  for (const t of bpmTpls) {
    const key = `bpm_diagram:${t.id}`;
    if (existingKeys.has(key)) continue;
    await db.insert(platformTemplates).values({
      tenantId, name: t.name, description: t.description,
      module: "bpm_diagram", categoryTags: t.vendor ? [t.vendor] : null,
      tier: t.tier ?? "customer", submissionStatus: t.submissionStatus === "pending" ? "submitted" : (t.submissionStatus ?? "none"),
      sourceModule: "bpm_diagram", sourceId: t.id,
      snapshotJsonb: { name: t.name, description: t.description, type: t.type, templateData: t.templateData, vendor: t.vendor },
      status: "active",
    });
  }

  const esignTpls = await db.select().from(signoffTemplates).where(
    or(isNull(signoffTemplates.tenantId), eq(signoffTemplates.tenantId, tenantId), eq(signoffTemplates.tier, "system")),
  );
  for (const t of esignTpls) {
    const key = `esign:${t.id}`;
    if (existingKeys.has(key)) continue;
    await db.insert(platformTemplates).values({
      tenantId: t.tenantId, name: t.title, description: t.description,
      module: "esign", categoryTags: t.category ? [t.category] : null,
      tier: t.tier ?? "customer", sourceModule: "esign", sourceId: t.id,
      snapshotJsonb: { title: t.title, description: t.description, category: t.category, contentHtml: t.contentHtml, sourceType: t.sourceType },
      status: "active", createdBy: t.createdBy,
    });
  }

  const wsTpls = await db.select().from(workspaceTemplates).where(
    or(eq(workspaceTemplates.tenantId, tenantId), eq(workspaceTemplates.tier, "system")),
  );
  for (const t of wsTpls) {
    const key = `workspace:${t.id}`;
    if (existingKeys.has(key)) continue;
    await db.insert(platformTemplates).values({
      tenantId: t.tenantId, name: t.name, description: t.description,
      module: "workspace", categoryTags: t.category ? [t.category] : null,
      tier: t.tier ?? "customer", sourceModule: "workspace", sourceId: t.id,
      snapshotJsonb: { structure: t.structure, name: t.name, description: t.description },
      status: "active", createdBy: t.createdBy,
    });
  }

  const bpmlTpls = await db.select().from(bpmlTemplates).where(eq(bpmlTemplates.tenantId, tenantId));
  for (const t of bpmlTpls) {
    const key = `bpml:${t.id}`;
    if (existingKeys.has(key)) continue;
    try {
      const snap = await buildSnapshot("bpml", t.id, tenantId);
      await db.insert(platformTemplates).values({
        tenantId, name: t.name, description: t.description,
        module: "bpml", categoryTags: t.erpPlatform ? [t.erpPlatform] : null,
        tier: t.isSystem ? "system" : "customer", sourceModule: "bpml", sourceId: t.id,
        snapshotJsonb: snap, status: "active",
      });
    } catch { /* skip if entries missing */ }
  }
}

function visibleToTenant(tenantId: number) {
  return or(
    eq(platformTemplates.tier, "system"),
    and(eq(platformTemplates.tenantId, tenantId), inArray(platformTemplates.tier, ["customer", "submitted"])),
    and(eq(platformTemplates.tier, "submitted"), eq(platformTemplates.submissionStatus, "approved")),
  );
}

export async function listTemplates(params: {
  tenantId: number;
  userId?: string;
  module?: string;
  tier?: string;
  tag?: string;
  status?: string;
  search?: string;
  createdBy?: string;
  sort?: string;
}) {
  const conditions = [visibleToTenant(params.tenantId), eq(platformTemplates.status, params.status ?? "active")];
  if (params.module) conditions.push(eq(platformTemplates.module, params.module));
  if (params.tier && params.tier !== "all") conditions.push(eq(platformTemplates.tier, params.tier));
  if (params.createdBy === "mine" && params.userId) conditions.push(eq(platformTemplates.createdBy, params.userId));
  if (params.createdBy === "org") conditions.push(eq(platformTemplates.tenantId, params.tenantId));

  let query = db.select().from(platformTemplates).where(and(...conditions));

  const rows = await query;
  let filtered = rows;
  if (params.search?.trim()) {
    const q = params.search.trim().toLowerCase();
    filtered = filtered.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.description?.toLowerCase().includes(q)) ||
      (t.categoryTags ?? []).some(tag => tag.toLowerCase().includes(q)),
    );
  }
  if (params.tag) {
    filtered = filtered.filter(t => (t.categoryTags ?? []).includes(params.tag!));
  }

  const sort = params.sort ?? "most_used";
  if (sort === "newest") filtered.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  else if (sort === "alphabetical") filtered.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "recently_updated") filtered.sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime());
  else filtered.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));

  return enrichTemplates(filtered);
}

export async function getModuleCounts(tenantId: number): Promise<Record<string, number>> {
  const rows = await listTemplates({ tenantId, status: "active" });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.module] = (counts[r.module] ?? 0) + 1;
  return counts;
}

export async function getDiscovery(tenantId: number, userId: string) {
  const all = await listTemplates({ tenantId, status: "active" });
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const recentUsage = await db.select().from(templateUsageLog)
    .where(and(eq(templateUsageLog.tenantId, tenantId), eq(templateUsageLog.usedBy, userId), gte(templateUsageLog.createdAt, thirtyDaysAgo)))
    .orderBy(desc(templateUsageLog.createdAt)).limit(20);

  const recentIds = [...new Set(recentUsage.map(u => u.templateId))];
  const recentlyUsed = all.filter(t => recentIds.includes(t.id));

  const featured = all.filter(t => t.isFeatured || t.tier === "system").slice(0, 12);
  const popular = [...all].sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0)).slice(0, 12);
  const newUpdated = [...all].sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime()).slice(0, 12);

  const [tenant] = await db.select({ industry: tenants.industry }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const industry = tenant?.industry?.toLowerCase() ?? "";
  const industryTagMap: Record<string, string[]> = {
    automotive: ["SAP", "Generic IT"],
    financial: ["SAP", "Workday"],
    technology: ["Salesforce", "Agile"],
    healthcare: ["Workday", "Generic IT"],
  };
  const matchTags = industryTagMap[Object.keys(industryTagMap).find(k => industry.includes(k)) ?? ""] ?? ["Generic IT"];
  const recommended = all
    .filter(t => (t.categoryTags ?? []).some(tag => matchTags.includes(tag)) || t.isFeatured)
    .sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0))
    .slice(0, 8);
  const recommendedFallback = recommended.length ? recommended : popular.slice(0, 8);

  return { featured, recentlyUsed, popular, newUpdated, recommended: recommendedFallback };
}

export async function listMarketplaceTemplates(tenantId: number) {
  const rows = await db.select().from(platformTemplates).where(
    and(
      eq(platformTemplates.tier, "system"),
      eq(platformTemplates.status, "active"),
      or(
        eq(platformTemplates.marketplaceListed, true),
        eq(platformTemplates.showContributorCredit, true),
      ),
    ),
  );
  const enriched = await enrichTemplates(rows);
  return enriched.sort((a, b) => {
    if (a.marketplaceFeatured && !b.marketplaceFeatured) return -1;
    if (!a.marketplaceFeatured && b.marketplaceFeatured) return 1;
    return (b.usageCount ?? 0) - (a.usageCount ?? 0);
  });
}

async function enrichTemplates(rows: PlatformTemplate[]): Promise<PlatformTemplateWithMeta[]> {
  if (!rows.length) return [];
  const userIds = [...new Set(rows.map(r => r.createdBy).filter(Boolean))] as string[];
  const orgIds = [...new Set(rows.map(r => r.contributorOrgId).filter(Boolean))] as number[];

  const userRows = userIds.length
    ? await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where(inArray(users.id, userIds))
    : [];
  const orgRows = orgIds.length
    ? await db.select({ id: tenants.id, name: tenants.name }).from(tenants).where(inArray(tenants.id, orgIds))
    : [];

  const userMap = new Map(userRows.map(u => [u.id, u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email]));
  const orgMap = new Map(orgRows.map(o => [o.id, o.name]));

  return rows.map(r => ({
    ...r,
    creatorName: r.createdByName ?? (r.createdBy ? userMap.get(r.createdBy) : null) ?? (r.tier === "system" ? "Jiganto" : null),
    contributorOrgName: r.contributorOrgId ? orgMap.get(r.contributorOrgId) : null,
  }));
}

export async function getTemplate(id: number, tenantId: number) {
  const [row] = await db.select().from(platformTemplates).where(eq(platformTemplates.id, id));
  if (!row) return null;
  if (row.tier === "customer" && row.tenantId !== tenantId) return null;
  if (row.tier === "system" || row.tenantId === tenantId || row.submissionStatus === "approved") {
    const [enriched] = await enrichTemplates([row]);
    return enriched;
  }
  return null;
}

export async function registerTemplate(params: {
  tenantId: number;
  userId: string;
  userName?: string;
  name: string;
  description?: string;
  module: TemplateModule;
  sourceModule?: string;
  sourceId?: number;
  snapshotJsonb?: Record<string, unknown>;
  categoryTags?: string[];
  tier?: string;
  status?: string;
  thumbnailUrl?: string;
  isAiGenerated?: boolean;
}) {
  let snapshot = params.snapshotJsonb;
  if (!snapshot && params.sourceId) {
    snapshot = await buildSnapshot(params.module, params.sourceId, params.tenantId);
  }
  if (!snapshot) throw new Error("Snapshot required");

  if (params.sourceModule && params.sourceId) {
    const [existing] = await db.select().from(platformTemplates).where(
      and(eq(platformTemplates.sourceModule, params.sourceModule), eq(platformTemplates.sourceId, params.sourceId), eq(platformTemplates.tenantId, params.tenantId)),
    );
    if (existing) {
      const [updated] = await db.update(platformTemplates).set({
        name: params.name, description: params.description ?? existing.description,
        snapshotJsonb: snapshot, categoryTags: params.categoryTags ?? existing.categoryTags,
        updatedAt: new Date(),
        version: bumpVersion(existing.version),
      }).where(eq(platformTemplates.id, existing.id)).returning();
      return updated;
    }
  }

  const [row] = await db.insert(platformTemplates).values({
    tenantId: params.tenantId,
    name: params.name,
    description: params.description,
    module: params.module,
    categoryTags: params.categoryTags,
    tier: params.tier ?? "customer",
    sourceModule: params.sourceModule ?? params.module,
    sourceId: params.sourceId,
    snapshotJsonb: snapshot,
    thumbnailUrl: params.thumbnailUrl,
    status: params.status ?? "active",
    isAiGenerated: params.isAiGenerated ?? false,
    createdBy: params.userId,
    createdByName: params.userName,
  }).returning();
  return row;
}

function bumpVersion(v: string | null): string {
  const parts = (v ?? "1.0").split(".").map(Number);
  parts[1] = (parts[1] ?? 0) + 1;
  return `${parts[0]}.${parts[1]}`;
}

export async function updateTemplate(id: number, tenantId: number, updates: Partial<PlatformTemplate>) {
  const [existing] = await db.select().from(platformTemplates).where(eq(platformTemplates.id, id));
  if (!existing || existing.tenantId !== tenantId) throw new Error("Template not found");
  const [row] = await db.update(platformTemplates).set({ ...updates, updatedAt: new Date() }).where(eq(platformTemplates.id, id)).returning();
  return row;
}

export async function deleteTemplate(id: number, tenantId: number) {
  const [existing] = await db.select().from(platformTemplates).where(eq(platformTemplates.id, id));
  if (!existing || (existing.tenantId !== tenantId && existing.tier !== "system")) throw new Error("Template not found");
  await db.delete(platformTemplates).where(eq(platformTemplates.id, id));
}

export async function submitForReview(id: number, tenantId: number, note?: string) {
  const [row] = await db.update(platformTemplates).set({
    tier: "submitted", submissionStatus: "submitted", submissionNote: note ?? null, updatedAt: new Date(),
  }).where(and(eq(platformTemplates.id, id), eq(platformTemplates.tenantId, tenantId))).returning();
  if (!row) throw new Error("Template not found");
  return row;
}

export async function reviewTemplate(id: number, status: "approved" | "declined", note?: string, reviewerOrgId?: number) {
  const updates: Partial<PlatformTemplate> = {
    reviewerNote: note ?? null, updatedAt: new Date(),
  };
  if (status === "approved") {
    updates.tier = "system";
    updates.submissionStatus = "approved";
    updates.showContributorCredit = true;
    updates.marketplaceListed = true;
    if (reviewerOrgId) updates.contributorOrgId = reviewerOrgId;
  } else {
    updates.tier = "customer";
    updates.submissionStatus = "declined";
  }
  const [row] = await db.update(platformTemplates).set(updates).where(eq(platformTemplates.id, id)).returning();
  if (!row) throw new Error("Template not found");
  return row;
}

export async function applyAndLog(params: {
  templateId: number;
  tenantId: number;
  userId: string;
  userName?: string;
  name?: string;
  workspaceId?: number | null;
  projectId?: number | null;
}) {
  const result = await applyTemplate(params);
  await db.insert(templateUsageLog).values({
    templateId: params.templateId,
    usedBy: params.userId,
    tenantId: params.tenantId,
    targetModule: result.targetModule,
    targetId: result.targetId,
  });
  return result;
}

export { buildSnapshot, applyTemplate, snapshotFromBpmTemplate };
