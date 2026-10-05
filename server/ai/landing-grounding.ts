/**
 * Data grounding for the Jiganto AI landing page ("Ask Jiganto").
 *
 * The existing floating chat assistant (server/chat/routes.ts) streams raw
 * OpenAI completions with zero knowledge of what's actually in the
 * tenant's data — it can't answer "what's overdue on my projects?" because
 * nothing about projects, CRM or dashboard KPIs is ever given to the model.
 *
 * This module reuses the same dashboard summary builders that already
 * power the per-module AI insight cards (see server/customer-management/
 * ai-insights.ts for the established pattern) and condenses them into a
 * compact JSON block + system prompt, so a landing-page conversation is
 * actually grounded in live tenant data instead of guessing.
 */
import { getApiTenantId } from "../lib/api-tenant-id";
import { effectiveUserId } from "../auth/impersonationRoutes";
import type { Request } from "express";
import {
  loadCrmModuleDashboard,
  loadKpiStrip,
  loadProjectsModuleDashboard,
  type DashboardScope,
} from "../dashboard/metrics";

/**
 * Non-throwing scope resolution: unlike `requireApiTenantId`, this never
 * writes to `res` on failure. It's used mid-stream (after SSE headers may
 * already be in flight), where sending a second response would crash the
 * request — callers just skip grounding if this returns null.
 */
export function parseAiScope(req: Request): DashboardScope | null {
  const tenantId = getApiTenantId(req);
  if (tenantId == null) return null;
  const userId = effectiveUserId(req);
  if (!userId) return null;
  return { tenantId, userId };
}

export interface AiGroundingSummary {
  generatedAt: string;
  kpiStrip: {
    activeItems: number;
    atRisk: number;
    critical: number;
    portfolioBudgetLabel: string;
    teamMembers: number;
  };
  projects: {
    activeProjects: number;
    atRiskBehind: number;
    portfolioValueLabel: string;
    milestonesDue: number;
    topProjects: { name: string; customer: string | null; health: string; progress: number; dueDate: string | null }[];
  };
  crm: {
    pipelineLabel: string;
    openOpportunities: number;
    winRate90d: number;
    overdueFollowUps: number;
    hotOpportunities: { name: string; owner: string | null; amount: number; closeDate: string | null }[];
  };
}

/**
 * Pulls a compact, model-friendly summary of the tenant's live Projects,
 * CRM and top-level dashboard data. Each piece is fetched defensively —
 * if one module errors (e.g. no CRM data seeded yet) the others still
 * come through rather than failing the whole grounding call.
 */
export async function buildAiGroundingSummary(
  scope: DashboardScope,
): Promise<AiGroundingSummary> {
  const [kpiStrip, projects, crm] = await Promise.all([
    loadKpiStrip(scope).catch(() => null),
    loadProjectsModuleDashboard(scope).catch(() => null),
    loadCrmModuleDashboard(scope).catch(() => null),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    kpiStrip: {
      activeItems: kpiStrip?.activeItems ?? 0,
      atRisk: kpiStrip?.atRisk ?? 0,
      critical: kpiStrip?.critical ?? 0,
      portfolioBudgetLabel: kpiStrip?.portfolioBudgetLabel ?? "n/a",
      teamMembers: kpiStrip?.teamMembers ?? 0,
    },
    projects: {
      activeProjects: projects?.kpis.activeProjects ?? 0,
      atRiskBehind: projects?.kpis.atRiskBehind ?? 0,
      portfolioValueLabel: projects?.kpis.portfolioValueLabel ?? "n/a",
      milestonesDue: projects?.kpis.milestonesDue ?? 0,
      topProjects: (projects?.activeProjects ?? []).slice(0, 8).map((p) => ({
        name: p.name,
        customer: p.customer,
        health: p.health,
        progress: p.progress,
        dueDate: p.dueDate,
      })),
    },
    crm: {
      pipelineLabel: crm?.kpis.pipelineLabel ?? "n/a",
      openOpportunities: crm?.kpis.openOpportunities ?? 0,
      winRate90d: crm?.kpis.winRate90d ?? 0,
      overdueFollowUps: crm?.kpis.overdueFollowUps ?? 0,
      hotOpportunities: (crm?.hotOpportunities ?? []).slice(0, 8).map((o) => ({
        name: o.name,
        owner: o.owner,
        amount: o.amount,
        closeDate: o.closeDate,
      })),
    },
  };
}

export const AI_LANDING_SYSTEM_PROMPT = `You are "Ask Jiganto" — the conversational AI for the Jiganto enterprise platform, embedded on its AI landing page.

You are given a JSON snapshot of the current tenant's live data below (dashboard KPIs, active projects, CRM pipeline). Use it to answer questions concretely — name real projects, numbers and opportunities from the snapshot rather than speaking generically. If the answer isn't in the snapshot, say so plainly and suggest which module (Projects, CRM, Dashboard, etc.) the person should check, rather than inventing figures.

Keep answers concise and business-focused. When useful, suggest a relevant next action (e.g. "open the Projects module to see the full risk register").

Live data snapshot (JSON):
`;

export function buildGroundedSystemPrompt(summary: AiGroundingSummary): string {
  return `${AI_LANDING_SYSTEM_PROMPT}${JSON.stringify(summary)}`;
}
