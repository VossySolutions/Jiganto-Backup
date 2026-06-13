/** Internal module deep-link helpers (copy/share). */
export function documentModulePath(documentId: number): string {
  return `/modules/documents?document=${documentId}`;
}

export function documentModuleUrl(documentId: number): string {
  return `${window.location.origin}${documentModulePath(documentId)}`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
