import type { NoteType, StickyNote } from "@shared/models/whiteboard";

export type NoteTypeConfig = {
  type: NoteType;
  label: string;
  icon: string;
  border: string;
  background: string;
};

export const NOTE_TYPE_CONFIG: Record<NoteType, NoteTypeConfig> = {
  idea: { type: "idea", label: "Idea", icon: "💡", border: "#EAB308", background: "#FEF08A" },
  requirement: { type: "requirement", label: "Requirement", icon: "📄", border: "#3B82F6", background: "#BFDBFE" },
  risk: { type: "risk", label: "Risk", icon: "🛡️", border: "#EF4444", background: "#FECACA" },
  issue: { type: "issue", label: "Issue", icon: "⚡", border: "#F97316", background: "#FED7AA" },
  action: { type: "action", label: "Action", icon: "✓", border: "#22C55E", background: "#BBF7D0" },
  opportunity: { type: "opportunity", label: "Opportunity", icon: "📈", border: "#A855F7", background: "#E9D5FF" },
  decision: { type: "decision", label: "Decision", icon: "⚖️", border: "#14B8A6", background: "#99F6E4" },
  custom: { type: "custom", label: "Custom", icon: "🎨", border: "#6B7280", background: "#F3F4F6" },
};

export const NOTE_TYPES_ORDER: NoteType[] = [
  "idea", "requirement", "risk", "issue", "action", "opportunity", "decision", "custom",
];

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 2;
export const ZOOM_STEP = 0.1;
export const GRID_SPACING = 24;
export const SNAP_GRID = 8;
export const NOTE_MIN = 120;
export const NOTE_MAX = 600;
export const NOTE_DEFAULT = 200;
export const ARROW_NUDGE = 40;

export const LAST_NOTE_COLOR_KEY = "jiganto-wb-last-note-type";

export function getNoteColors(noteType: NoteType, colourHex?: string | null) {
  if (noteType === "custom" && colourHex) {
    return { border: colourHex, background: colourHex + "55" };
  }
  const cfg = NOTE_TYPE_CONFIG[noteType] ?? NOTE_TYPE_CONFIG.idea;
  return { border: cfg.border, background: cfg.background };
}

export function userColorFromId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

export function initials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

export function formatRelativeTime(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "active now";
  if (mins < 60) return `active ${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  return `active ${hrs} hr${hrs === 1 ? "" : "s"} ago`;
}

export function thumbnailPlaceholder(name: string): string {
  const initial = (name[0] ?? "W").toUpperCase();
  const colors = ["#A855F7", "#3B82F6", "#22C55E", "#F97316", "#EC4899"];
  const bg = colors[initial.charCodeAt(0) % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="${bg}" opacity="0.15"/><text x="160" y="105" text-anchor="middle" font-size="64" font-family="system-ui" fill="${bg}" font-weight="700">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function dedupeNotes(notes: StickyNote[]): StickyNote[] {
  const map = new Map<number, StickyNote>();
  for (const n of notes) {
    if (n.isDeleted) continue;
    map.set(n.id, n);
  }
  return Array.from(map.values());
}

export function mergeNotes(prev: StickyNote[], ...incoming: StickyNote[]): StickyNote[] {
  const map = new Map(prev.map((n) => [n.id, n]));
  for (const n of incoming) {
    if (n.isDeleted) {
      map.delete(n.id);
    } else {
      map.set(n.id, { ...map.get(n.id), ...n });
    }
  }
  return Array.from(map.values());
}

export function patchNoteInList(prev: StickyNote[], id: number, patch: Partial<StickyNote>): StickyNote[] {
  return prev.map((n) => (n.id === id ? { ...n, ...patch } : n));
}
