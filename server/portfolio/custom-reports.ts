import { db } from "../db";
import { pmCustomReports } from "@shared/schema";
import { and, eq, desc } from "drizzle-orm";
import {
  getPortfolioSummaryReport,
  getMilestoneRegister,
  getRaidConsolidated,
} from "./service";

export type CustomReportConfig = {
  fields: string[];
  filters?: Record<string, string>;
  groupBy?: string | null;
  sortBy?: { field: string; direction: "asc" | "desc" };
};

const PROJECT_FIELDS = ["name", "client", "pm", "rag", "budget", "spent", "progress", "portfolios", "programme", "status"] as const;
const MILESTONE_FIELDS = ["ref", "name", "projectName", "programme", "portfolio", "client", "ragStatus", "targetDate", "status"] as const;
const RAID_FIELDS = ["type", "code", "title", "projectName", "priority", "status", "ownerName"] as const;

export async function listCustomReports(tenantId: number) {
  return db.select().from(pmCustomReports).where(eq(pmCustomReports.tenantId, tenantId)).orderBy(desc(pmCustomReports.updatedAt));
}

export async function getCustomReport(id: number, tenantId: number) {
  const [row] = await db.select().from(pmCustomReports).where(and(eq(pmCustomReports.id, id), eq(pmCustomReports.tenantId, tenantId)));
  return row;
}

export async function createCustomReport(data: typeof pmCustomReports.$inferInsert) {
  const [row] = await db.insert(pmCustomReports).values(data).returning();
  return row;
}

export async function updateCustomReport(id: number, tenantId: number, updates: Partial<typeof pmCustomReports.$inferInsert>) {
  const [row] = await db
    .update(pmCustomReports)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(pmCustomReports.id, id), eq(pmCustomReports.tenantId, tenantId)))
    .returning();
  return row;
}

export async function deleteCustomReport(id: number, tenantId: number) {
  await db.delete(pmCustomReports).where(and(eq(pmCustomReports.id, id), eq(pmCustomReports.tenantId, tenantId)));
}

function applyFilters<T extends Record<string, unknown>>(rows: T[], filters: Record<string, string> = {}): T[] {
  let result = rows;
  for (const [key, val] of Object.entries(filters)) {
    if (!val) continue;
    result = result.filter((r) => {
      const v = r[key];
      if (v == null) return false;
      return String(v).toLowerCase().includes(val.toLowerCase());
    });
  }
  return result;
}

function applySort<T extends Record<string, unknown>>(rows: T[], sortBy?: { field: string; direction: "asc" | "desc" }): T[] {
  if (!sortBy?.field) return rows;
  const dir = sortBy.direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = a[sortBy.field];
    const vb = b[sortBy.field];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });
}

function pickFields<T extends Record<string, unknown>>(rows: T[], fields: string[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      if (f in row) out[f] = row[f];
    }
    return out;
  });
}

function groupRows(rows: Record<string, unknown>[], groupBy?: string | null) {
  if (!groupBy) return { groups: [{ key: "All", rows }] };
  const map = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = String(row[groupBy] ?? "Other");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return {
    groups: Array.from(map.entries()).map(([key, groupRows]) => ({ key, rows: groupRows })),
  };
}

export async function runCustomReport(
  tenantId: number,
  dataSource: string,
  config: CustomReportConfig,
  clientId?: number,
) {
  const fields = config.fields?.length ? config.fields : [...PROJECT_FIELDS];
  let raw: Record<string, unknown>[] = [];

  if (dataSource === "milestones") {
    const rows = await getMilestoneRegister(tenantId, clientId);
    raw = rows.map((m) => ({
      ref: m.ref,
      name: m.name,
      projectName: m.projectName,
      programme: m.programme,
      portfolio: m.portfolio,
      client: m.client,
      ragStatus: m.ragStatus,
      targetDate: m.targetDate || m.dueDate,
      status: m.status,
    }));
  } else if (dataSource === "raid") {
    const rows = await getRaidConsolidated(tenantId, clientId);
    raw = rows.map((r) => ({
      type: r.type,
      code: r.code,
      title: r.title,
      projectName: r.projectName,
      priority: r.priority,
      status: r.status,
      ownerName: r.ownerName,
    }));
  } else {
    const rows = await getPortfolioSummaryReport(tenantId, clientId);
    raw = rows.map((r) => ({
      name: r.name,
      client: r.client,
      pm: r.pm,
      rag: r.rag,
      budget: r.budget,
      spent: r.spent,
      progress: r.progress,
      portfolios: r.portfolios,
      programme: r.programme,
      status: r.rag,
    }));
  }

  const filtered = applyFilters(raw, config.filters);
  const sorted = applySort(filtered, config.sortBy);
  const picked = pickFields(sorted, fields);
  const { groups } = groupRows(picked, config.groupBy);

  return {
    dataSource,
    fields,
    totalRows: picked.length,
    rows: picked,
    groups,
    generatedAt: new Date().toISOString(),
  };
}

export function getAvailableFields(dataSource: string) {
  if (dataSource === "milestones") return [...MILESTONE_FIELDS];
  if (dataSource === "raid") return [...RAID_FIELDS];
  return [...PROJECT_FIELDS];
}
