import { z } from "zod";

/** Per-document page chrome stored on `documents.metadata`. */
export const documentPageLayoutSchema = z.object({
  headerHtml: z.string().nullable().optional(),
  footerHtml: z.string().nullable().optional(),
});

/** Folder defaults stored on `document_folders.metadata` (Confluence space-level chrome). */
export const folderPageLayoutDefaultsSchema = z.object({
  defaultHeaderHtml: z.string().nullable().optional(),
  defaultFooterHtml: z.string().nullable().optional(),
});

export type DocumentPageLayout = z.infer<typeof documentPageLayoutSchema>;
export type FolderPageLayoutDefaults = z.infer<typeof folderPageLayoutDefaultsSchema>;

export type FolderLayoutNode = {
  id: number;
  name: string;
  parentId: number | null;
  metadata?: unknown;
};

export type ResolvedPageLayout = {
  headerHtml: string;
  footerHtml: string;
  headerInherited: boolean;
  footerInherited: boolean;
  headerSourceFolderId?: number;
  headerSourceFolderName?: string;
  footerSourceFolderId?: number;
  footerSourceFolderName?: string;
};

function normalizeHtml(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** `null`/missing = inherit from folder; string (incl. empty) = document override. */
export function documentHasOwnPageLayoutOverride(
  metadata: unknown,
  field: "headerHtml" | "footerHtml",
): boolean {
  const raw = (metadata && typeof metadata === "object" ? metadata : {}) as Record<string, unknown>;
  return typeof raw[field] === "string";
}

export function parseDocumentPageLayout(metadata: unknown): DocumentPageLayout {
  const raw = (metadata && typeof metadata === "object" ? metadata : {}) as Record<string, unknown>;
  return {
    headerHtml: typeof raw.headerHtml === "string" ? raw.headerHtml : raw.headerHtml === null ? null : undefined,
    footerHtml: typeof raw.footerHtml === "string" ? raw.footerHtml : raw.footerHtml === null ? null : undefined,
  };
}

export function parseFolderPageLayoutDefaults(metadata: unknown): FolderPageLayoutDefaults {
  const raw = (metadata && typeof metadata === "object" ? metadata : {}) as Record<string, unknown>;
  return {
    defaultHeaderHtml:
      typeof raw.defaultHeaderHtml === "string"
        ? raw.defaultHeaderHtml
        : raw.defaultHeaderHtml === null
          ? null
          : undefined,
    defaultFooterHtml:
      typeof raw.defaultFooterHtml === "string"
        ? raw.defaultFooterHtml
        : raw.defaultFooterHtml === null
          ? null
          : undefined,
  };
}

/** Walk folder tree — nearest folder with each default wins independently. */
export function resolveFolderPageLayoutFromTree(
  folders: FolderLayoutNode[],
  folderId: number | null | undefined,
): {
  headerHtml: string;
  footerHtml: string;
  headerSourceFolderId?: number;
  headerSourceFolderName?: string;
  footerSourceFolderId?: number;
  footerSourceFolderName?: string;
} {
  const byId = new Map(folders.map((f) => [f.id, f]));
  let currentId = folderId ?? null;
  let headerHtml = "";
  let footerHtml = "";
  let headerSourceFolderId: number | undefined;
  let headerSourceFolderName: string | undefined;
  let footerSourceFolderId: number | undefined;
  let footerSourceFolderName: string | undefined;

  while (currentId != null) {
    const folder = byId.get(currentId);
    if (!folder) break;
    const defaults = parseFolderPageLayoutDefaults(folder.metadata);
    const folderHeader = normalizeHtml(defaults.defaultHeaderHtml);
    const folderFooter = normalizeHtml(defaults.defaultFooterHtml);

    if (!headerHtml && folderHeader) {
      headerHtml = folderHeader;
      headerSourceFolderId = folder.id;
      headerSourceFolderName = folder.name;
    }
    if (!footerHtml && folderFooter) {
      footerHtml = folderFooter;
      footerSourceFolderId = folder.id;
      footerSourceFolderName = folder.name;
    }
    if (headerHtml && footerHtml) break;
    currentId = folder.parentId;
  }

  return {
    headerHtml,
    footerHtml,
    headerSourceFolderId,
    headerSourceFolderName,
    footerSourceFolderId,
    footerSourceFolderName,
  };
}

export function resolveEffectivePageLayout(
  documentMetadata: unknown,
  folderId: number | null | undefined,
  folders: FolderLayoutNode[],
): ResolvedPageLayout {
  const docLayout = parseDocumentPageLayout(documentMetadata);
  const folderLayout = resolveFolderPageLayoutFromTree(folders, folderId);

  const hasOwnHeader = documentHasOwnPageLayoutOverride(documentMetadata, "headerHtml");
  const hasOwnFooter = documentHasOwnPageLayoutOverride(documentMetadata, "footerHtml");
  const docHeader = hasOwnHeader ? normalizeHtml(docLayout.headerHtml) : "";
  const docFooter = hasOwnFooter ? normalizeHtml(docLayout.footerHtml) : "";

  const headerInherited = !hasOwnHeader && !!folderLayout.headerHtml;
  const footerInherited = !hasOwnFooter && !!folderLayout.footerHtml;

  return {
    headerHtml: hasOwnHeader ? docLayout.headerHtml ?? "" : folderLayout.headerHtml,
    footerHtml: hasOwnFooter ? docLayout.footerHtml ?? "" : folderLayout.footerHtml,
    headerInherited,
    footerInherited,
    headerSourceFolderId: headerInherited ? folderLayout.headerSourceFolderId : undefined,
    headerSourceFolderName: headerInherited ? folderLayout.headerSourceFolderName : undefined,
    footerSourceFolderId: footerInherited ? folderLayout.footerSourceFolderId : undefined,
    footerSourceFolderName: footerInherited ? folderLayout.footerSourceFolderName : undefined,
  };
}

/** Persist overrides only when the document differs from inherited folder defaults. */
export function resolvePageLayoutFieldsForSave(
  editorHeader: string,
  editorFooter: string,
  documentMetadata: unknown,
  folderId: number | null | undefined,
  folders: FolderLayoutNode[],
): { headerHtml: string | null; footerHtml: string | null } {
  const folderLayout = resolveFolderPageLayoutFromTree(folders, folderId);
  const hasOwnHeader = documentHasOwnPageLayoutOverride(documentMetadata, "headerHtml");
  const hasOwnFooter = documentHasOwnPageLayoutOverride(documentMetadata, "footerHtml");
  const headerTrim = editorHeader.trim();
  const footerTrim = editorFooter.trim();

  let headerHtml: string | null;
  if (!headerTrim) {
    headerHtml = null;
  } else if (!hasOwnHeader && headerTrim === folderLayout.headerHtml) {
    headerHtml = null;
  } else {
    headerHtml = editorHeader;
  }

  let footerHtml: string | null;
  if (!footerTrim) {
    footerHtml = null;
  } else if (!hasOwnFooter && footerTrim === folderLayout.footerHtml) {
    footerHtml = null;
  } else {
    footerHtml = editorFooter;
  }

  return { headerHtml, footerHtml };
}

export function mergeDocumentMetadataWithPageLayout(
  baseMetadata: Record<string, unknown> | null | undefined,
  layout: { headerHtml: string | null; footerHtml: string | null },
): Record<string, unknown> {
  return {
    ...(baseMetadata || {}),
    headerHtml: layout.headerHtml,
    footerHtml: layout.footerHtml,
  };
}

/** Server-side: document override or folder-chain fallback. */
export function resolvePageLayoutWithFolderDefaults(
  documentMetadata: unknown,
  folderDefaults: { headerHtml: string; footerHtml: string },
): { headerHtml: string; footerHtml: string } {
  const docLayout = parseDocumentPageLayout(documentMetadata);
  return {
    headerHtml: documentHasOwnPageLayoutOverride(documentMetadata, "headerHtml")
      ? docLayout.headerHtml ?? ""
      : folderDefaults.headerHtml,
    footerHtml: documentHasOwnPageLayoutOverride(documentMetadata, "footerHtml")
      ? docLayout.footerHtml ?? ""
      : folderDefaults.footerHtml,
  };
}
