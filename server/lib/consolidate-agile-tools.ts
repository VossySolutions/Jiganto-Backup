import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { pmProjectTools } from "@shared/schema";

/** Legacy granular Agile tool types folded into unified `agile`. */
export const LEGACY_AGILE_TOOL_TYPES = [
  "kanban_board",
  "sprint_board",
  "scrum_board",
  "backlog",
  "epics",
  "stories",
  "sprints",
  "defects",
  "roadmap",
  "epics_stories",
  "best_practice",
] as const;

const LEGACY_SET = new Set<string>(LEGACY_AGILE_TOOL_TYPES);

/**
 * Persist unified Agile tool: remove legacy rows and ensure one `agile` tool exists.
 * Returns the healed tool list from DB. No-op (single read) when already consolidated.
 */
export async function consolidateAgileProjectTools(
  projectId: number,
  tenantId: number,
) {
  const tools = await storage.getPmProjectTools(projectId);
  const legacy = tools.filter((t) => LEGACY_SET.has(t.toolType));
  if (legacy.length === 0) return tools;

  const existingAgile = tools.find((t) => t.toolType === "agile");
  const sortOrder = Math.min(...legacy.map((t) => t.sortOrder ?? 999), existingAgile?.sortOrder ?? 999);
  const anyEnabled = legacy.some((t) => t.isEnabled !== false) || existingAgile?.isEnabled !== false;

  await db
    .delete(pmProjectTools)
    .where(
      and(
        eq(pmProjectTools.projectId, projectId),
        inArray(pmProjectTools.toolType, [...LEGACY_AGILE_TOOL_TYPES]),
      ),
    );

  if (existingAgile) {
    await storage.updatePmProjectTool(existingAgile.id, {
      label: "Agile",
      toolCategory: "planning_scheduling",
      isEnabled: anyEnabled,
      sortOrder,
    });
  } else if (anyEnabled) {
    await storage.createPmProjectTool({
      tenantId,
      projectId,
      toolType: "agile",
      toolCategory: "planning_scheduling",
      label: "Agile",
      isEnabled: true,
      sortOrder,
    } as any);
  }

  return storage.getPmProjectTools(projectId);
}
