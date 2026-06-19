import type { Document } from "@shared/schema";

/** Match documents in the same folder (including uncategorised). */
export function sameDocumentFolder(a: number | null | undefined, b: number | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

export function findDocumentByTitleInFolder(
  documents: Pick<Document, "id" | "title" | "folderId">[],
  title: string,
  folderId: number | null,
): Pick<Document, "id" | "title" | "folderId"> | undefined {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return undefined;
  return documents.find(
    (doc) => sameDocumentFolder(doc.folderId, folderId) && doc.title.trim().toLowerCase() === normalized,
  );
}

/** Windows-style unique name: "Report" → "Report (1)" → "Report (2)". */
export function suggestUniqueDocumentTitle(
  baseTitle: string,
  folderId: number | null,
  documents: Pick<Document, "title" | "folderId">[],
): string {
  const trimmed = baseTitle.trim() || "Imported Document";
  const titlesInFolder = new Set(
    documents
      .filter((doc) => sameDocumentFolder(doc.folderId, folderId))
      .map((doc) => doc.title.trim().toLowerCase()),
  );

  if (!titlesInFolder.has(trimmed.toLowerCase())) return trimmed;

  const rootMatch = trimmed.match(/^(.*)\s\((\d+)\)$/);
  const root = (rootMatch ? rootMatch[1] : trimmed).trim() || "Imported Document";

  let index = 1;
  while (titlesInFolder.has(`${root} (${index})`.toLowerCase())) {
    index += 1;
  }
  return `${root} (${index})`;
}

export type DocumentImportConflictAction = "keep_both" | "replace";
