import Dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

export type DeltaChangeType = "added" | "removed" | "changed" | "unchanged";

export interface DeltaStepRow {
  stepId: string;
  stepName: string;
  changeType: DeltaChangeType;
  details: string;
}

export function autoLayoutNodes(nodes: Node[], edges: Edge[], direction: "TB" | "LR" = "LR"): Node[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });
  nodes.forEach(n => {
    if (n.type === "swimlane_pool" || n.type === "swimlane_lane") return;
    g.setNode(n.id, { width: (n.width as number) || 160, height: (n.height as number) || 60 });
  });
  edges.forEach(e => {
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  });
  Dagre.layout(g);
  return nodes.map(n => {
    if (!g.hasNode(n.id)) return n;
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - ((n.width as number) || 160) / 2, y: pos.y - ((n.height as number) || 60) / 2 } };
  });
}

export function buildDeltaReport(
  asIsNodes: any[],
  toBeNodes: any[],
): DeltaStepRow[] {
  const asIsMap = new Map(asIsNodes.map(n => [n.id, n]));
  const toBeMap = new Map(toBeNodes.map(n => [n.id, n]));
  const rows: DeltaStepRow[] = [];

  asIsMap.forEach((node, id) => {
    const toBe = toBeMap.get(id);
    const name = node.data?.label || id;
    if (!toBe) {
      rows.push({ stepId: id, stepName: name, changeType: "removed", details: "Step removed in To-Be" });
      return;
    }
    const diffs: string[] = [];
    if ((node.data?.label || "") !== (toBe.data?.label || "")) diffs.push("label");
    const aAttrs = node.data?.attributes || {};
    const bAttrs = toBe.data?.attributes || {};
    if (aAttrs.duration !== bAttrs.duration) diffs.push("duration");
    if (aAttrs.resources !== bAttrs.resources) diffs.push("actor/resources");
    if (aAttrs.systemUsed !== bAttrs.systemUsed) diffs.push("system");
    rows.push({
      stepId: id, stepName: name,
      changeType: diffs.length ? "changed" : "unchanged",
      details: diffs.length ? `Changed: ${diffs.join(", ")}` : "No changes",
    });
  });

  toBeMap.forEach((node, id) => {
    if (!asIsMap.has(id)) {
      rows.push({
        stepId: id, stepName: node.data?.label || id,
        changeType: "added", details: "New step in To-Be",
      });
    }
  });

  return rows.sort((a, b) => a.stepName.localeCompare(b.stepName));
}

export function highlightSearchText(text: string, term: string): string {
  if (!term.trim()) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${escaped})`, "gi"), "<mark class='bg-yellow-200 dark:bg-yellow-900 rounded px-0.5'>$1</mark>");
}

export type BpmlFilterOperator = "contains" | "equals" | "starts_with" | "is_empty" | "is_not_empty" | "greater_than" | "less_than";

export interface BpmlFilter {
  field: string;
  operator: BpmlFilterOperator;
  value: string;
}

export function applyBpmlFilter(row: Record<string, unknown>, filter: BpmlFilter): boolean {
  const raw = row[filter.field];
  const val = raw != null ? String(raw) : "";
  const fv = filter.value.toLowerCase();
  switch (filter.operator) {
    case "contains": return val.toLowerCase().includes(fv);
    case "equals": return val.toLowerCase() === fv;
    case "starts_with": return val.toLowerCase().startsWith(fv);
    case "is_empty": return !val.trim();
    case "is_not_empty": return !!val.trim();
    case "greater_than": return Number(val) > Number(filter.value);
    case "less_than": return Number(val) < Number(filter.value);
    default: return true;
  }
}

export function multiSort<T extends Record<string, unknown>>(
  data: T[],
  sorts: { field: string; dir: "asc" | "desc" }[],
): T[] {
  if (!sorts.length) return data;
  return [...data].sort((a, b) => {
    for (const s of sorts) {
      const av = String(a[s.field] ?? "");
      const bv = String(b[s.field] ?? "");
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      if (cmp !== 0) return s.dir === "asc" ? cmp : -cmp;
    }
    return 0;
  });
}

export function exportDeltaReportCsv(rows: DeltaStepRow[]): string {
  const header = "Step ID,Step Name,Change Type,Details";
  const lines = rows.map(r =>
    [r.stepId, r.stepName, r.changeType, r.details]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(","),
  );
  return [header, ...lines].join("\n");
}

export function exportProcessReportCsv(report: {
  diagramName: string; totalCost: number; totalDuration: number;
  totalFte: number; stepCount: number; automationPercent: number;
}): string {
  return [
    "Metric,Value",
    `"Diagram","${report.diagramName}"`,
    `"Total Cost",${report.totalCost}`,
    `"Total Duration (min)",${report.totalDuration}`,
    `"Total FTE",${report.totalFte}`,
    `"Step Count",${report.stepCount}`,
    `"Automation %",${report.automationPercent}`,
  ].join("\n");
}
