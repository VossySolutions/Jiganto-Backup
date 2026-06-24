import type { Request, Response } from "express";
import type { PlatformRole } from "@shared/models/permissions";
import type { ResourceScope } from "../resources/permissions";

export type RpPersona = "res-mgr" | "exec" | "sales" | "hr";

export type RpFeature =
  | "dashboard"
  | "demand-supply"
  | "heatmap"
  | "scheduler"
  | "skills"
  | "pipeline"
  | "recruitment"
  | "bench"
  | "scenarios"
  | "ai";

const READ_ACCESS: Record<RpPersona, RpFeature[]> = {
  "res-mgr": ["dashboard", "demand-supply", "heatmap", "scheduler", "skills", "pipeline", "recruitment", "bench", "scenarios", "ai"],
  exec: ["dashboard", "demand-supply", "scenarios", "ai"],
  sales: ["demand-supply", "pipeline", "scenarios", "ai"],
  hr: ["skills", "recruitment", "bench", "ai"],
};

const WRITE_ACCESS: Record<RpPersona, RpFeature[]> = {
  "res-mgr": ["dashboard", "demand-supply", "heatmap", "scheduler", "skills", "pipeline", "recruitment", "bench", "scenarios", "ai"],
  exec: ["scenarios", "ai"],
  sales: ["pipeline", "scenarios", "ai"],
  hr: ["recruitment", "bench", "ai"],
};

export function getRpPersona(req: Request): RpPersona {
  const raw = String(req.headers["x-rp-persona"] ?? req.query.persona ?? "res-mgr");
  if (raw === "exec" || raw === "sales" || raw === "hr") return raw;
  return "res-mgr";
}

/** Resolve which RP personas the signed-in user may assume (server + client RBAC). */
export function resolveAllowedRpPersonas(
  platformRole: PlatformRole | null | undefined,
  resourceScope: ResourceScope | null | undefined,
): { allowed: RpPersona[]; defaultPersona: RpPersona } {
  const role = platformRole ?? "client_project_user";

  if (resourceScope?.role === "self") {
    return { allowed: [], defaultPersona: "res-mgr" };
  }

  if (role === "client_executive") {
    return { allowed: ["exec"], defaultPersona: "exec" };
  }

  if (role === "jiganto_staff" || role === "si_super_admin") {
    return { allowed: ["res-mgr", "exec", "sales", "hr"], defaultPersona: "res-mgr" };
  }

  if (resourceScope?.role === "manager") {
    return { allowed: ["res-mgr", "exec", "sales", "hr"], defaultPersona: "res-mgr" };
  }

  if (resourceScope?.role === "consultant") {
    return { allowed: ["res-mgr"], defaultPersona: "res-mgr" };
  }

  if (role === "si_consultant_pm") {
    return { allowed: ["res-mgr", "sales"], defaultPersona: "res-mgr" };
  }

  return { allowed: ["res-mgr"], defaultPersona: "res-mgr" };
}

export function assertRpPersonaAllowed(
  res: Response,
  requested: RpPersona,
  platformRole: PlatformRole | null | undefined,
  resourceScope: ResourceScope | null | undefined,
): boolean {
  const { allowed } = resolveAllowedRpPersonas(platformRole, resourceScope);
  if (!allowed.includes(requested)) {
    res.status(403).json({
      message: `Persona "${requested}" is not available for your role`,
      allowed,
    });
    return false;
  }
  return true;
}

export function assertRpAccess(
  res: Response,
  persona: RpPersona,
  feature: RpFeature,
  method: string,
): boolean {
  const isWrite = method !== "GET" && method !== "HEAD";
  const allowed = isWrite ? WRITE_ACCESS[persona] : READ_ACCESS[persona];
  if (!allowed.includes(feature)) {
    res.status(403).json({
      message: `Persona "${persona}" cannot ${isWrite ? "modify" : "view"} ${feature}`,
      persona,
      feature,
    });
    return false;
  }
  return true;
}

export function featureFromPath(path: string): RpFeature | null {
  if (path.includes("/dashboard")) return "dashboard";
  if (path.includes("/demand-supply")) return "demand-supply";
  if (path.includes("/heatmap")) return "heatmap";
  if (path.includes("/scheduler") || path.includes("/bookings") || path.includes("/auto-match")) return "scheduler";
  if (path.includes("/skills-inventory")) return "skills";
  if (path.includes("/pipeline")) return "pipeline";
  if (path.includes("/recruitment")) return "recruitment";
  if (path.includes("/bench")) return "bench";
  if (path.includes("/scenarios")) return "scenarios";
  if (path.includes("/ai/")) return "ai";
  return null;
}

/** Strip sensitive fields per persona (cost data, etc.). */
export function filterRpResponse(persona: RpPersona, feature: RpFeature, data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const hideCost = persona === "exec" || persona === "sales";

  if (feature === "bench" && hideCost) {
    const d = data as { kpis?: Record<string, unknown> };
    if (d.kpis) {
      const { benchCostMonth: _removed, ...rest } = d.kpis;
      return { ...d, kpis: rest };
    }
  }

  if (feature === "recruitment" && hideCost) {
    const d = data as { cards?: Array<{ rows?: Array<{ l: string; v: string }> }>; timeline?: Array<{ cost?: string }> };
    return {
      ...d,
      cards: d.cards?.map((c) => ({
        ...c,
        rows: c.rows?.filter((r) => !r.l.toLowerCase().includes("cost")),
      })),
      timeline: d.timeline?.map(({ cost: _c, ...t }) => t),
    };
  }

  if (feature === "dashboard" && persona === "sales") {
    const d = data as { kpis?: Array<{ label: string }> };
    return {
      ...d,
      kpis: d.kpis?.filter((k) => k.label !== "On Bench" && k.label !== "Open Skills Gaps"),
    };
  }

  return data;
}
