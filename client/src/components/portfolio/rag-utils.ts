import type { RagLevel } from "./types";

export const RAG_DOT: Record<RagLevel, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

export const RAG_TEXT: Record<RagLevel, string> = {
  green: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
};

export function formatBudget(val: number) {
  if (val >= 1_000_000) return `£${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `£${(val / 1_000).toFixed(0)}K`;
  return `£${val.toFixed(0)}`;
}
