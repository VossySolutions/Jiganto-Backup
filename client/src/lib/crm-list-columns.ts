const STORAGE_PREFIX = "crm-column-visibility:";

export type CrmColumnDef = {
  id: string;
  label: string;
  defaultVisible?: boolean;
};

export function loadColumnVisibility(storageKey: string, columns: CrmColumnDef[]): Record<string, boolean> {
  const defaults = Object.fromEntries(
    columns.map((c) => [c.id, c.defaultVisible !== false]),
  );
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveColumnVisibility(storageKey: string, visibility: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, JSON.stringify(visibility));
}

export function visibleColumnIds(columns: CrmColumnDef[], visibility: Record<string, boolean>): string[] {
  return columns.filter((c) => visibility[c.id] !== false).map((c) => c.id);
}
