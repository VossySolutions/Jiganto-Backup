export function resolveBusinessLinkedRecordHref(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const [type, rawId] = ref.split(":");
  const id = rawId?.trim();
  if (!id || !/^\d+$/.test(id)) return null;

  switch (type) {
    case "project":
      return `/modules/projects/${id}`;
    case "programme":
    case "program":
      return `/modules/portfolio?program=${id}`;
    case "task":
      return `/modules/tasks?task=${id}`;
    default:
      return null;
  }
}

export function formatBusinessLinkedRecordLabel(ref: string | null | undefined): string {
  if (!ref) return "—";
  const [type, id] = ref.split(":");
  if (!id) return ref;
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  return `${label} #${id}`;
}
