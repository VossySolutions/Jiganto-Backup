/** When false, users must pick a folder (uncategorised option hidden everywhere). */
export const ALLOW_UNCATEGORISED_DOCS = true;

export const UNCATEGORISED_FOLDER_VALUE = "__uncategorised__";

export function folderSelectValue(folderId: number | null | undefined): string {
  if (folderId == null) return UNCATEGORISED_FOLDER_VALUE;
  return String(folderId);
}

export function parseFolderSelectValue(value: string): number | null {
  if (value === UNCATEGORISED_FOLDER_VALUE) return null;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}
