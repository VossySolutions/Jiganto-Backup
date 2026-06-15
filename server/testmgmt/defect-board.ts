/** Defect ticket status workflow (mirrors service-desk VALID_TRANSITIONS.defect). */
export const DEFECT_TRANSITIONS: Record<string, string[]> = {
  open: ["assigned", "in_progress"],
  assigned: ["in_progress"],
  in_progress: ["fix_ready", "wont_fix"],
  fix_ready: ["retesting"],
  retesting: ["fixed", "open"],
  fixed: ["closed"],
  wont_fix: ["closed"],
  closed: [],
};

/** Kanban column → canonical Help Desk status for that column. */
export const COLUMN_TO_STATUS: Record<string, string> = {
  open: "open",
  assigned: "assigned",
  in_progress: "in_progress",
  fix_ready: "fix_ready",
  retesting: "retesting",
  fixed: "fixed",
  wont_fix: "wont_fix",
  closed: "closed",
};

export function mapStatusToColumn(status: string): string {
  if (status in COLUMN_TO_STATUS) return status;
  return status;
}

/** Shortest valid transition path (excluding start). Returns null if unreachable. */
export function findDefectTransitionPath(from: string, to: string): string[] | null {
  if (from === to) return [];
  const queue: Array<[string, string[]]> = [[from, []]];
  const visited = new Set<string>([from]);

  while (queue.length > 0) {
    const [current, path] = queue.shift()!;
    for (const next of DEFECT_TRANSITIONS[current] ?? []) {
      if (next === to) return [...path, next];
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([next, [...path, next]]);
      }
    }
  }
  return null;
}

export function resolveColumnTargetStatus(from: string, columnId: string): string | null {
  const target = COLUMN_TO_STATUS[columnId] ?? columnId;
  const path = findDefectTransitionPath(from, target);
  if (path === null) return null;
  return path.length > 0 ? path[path.length - 1]! : from;
}

export function getAllowedTargetColumns(from: string): string[] {
  const reachable = new Set<string>();
  const queue = [from];
  const visited = new Set<string>([from]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of DEFECT_TRANSITIONS[current] ?? []) {
      reachable.add(next);
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return Object.keys(COLUMN_TO_STATUS).filter((col) => {
    const target = COLUMN_TO_STATUS[col]!;
    return reachable.has(target) || target === from;
  });
}
