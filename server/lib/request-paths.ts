/**
 * Paths that should not trigger Postgres session loads or permission resolution.
 * Vite dev serves dozens of /src/* modules in parallel; each must not open a DB connection.
 */
export function isApiRequest(path: string): boolean {
  return path.startsWith("/api");
}

export function isViteDevAssetRequest(path: string): boolean {
  if (path.startsWith("/src/")) return true;
  if (path.startsWith("/@")) return true;
  if (path.startsWith("/node_modules/")) return true;
  if (path.startsWith("/vite-hmr")) return true;
  if (path === "/favicon.ico" || path === "/jiganto-logo.png") return true;

  const dot = path.lastIndexOf(".");
  if (dot === -1) return false;
  const ext = path.slice(dot + 1).toLowerCase();
  return [
    "js",
    "jsx",
    "ts",
    "tsx",
    "mjs",
    "css",
    "map",
    "json",
    "svg",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "woff",
    "woff2",
    "ico",
  ].includes(ext);
}

/** Session + permission DB work only for API and SPA HTML navigations. */
export function shouldRunDatabaseMiddleware(path: string): boolean {
  if (isApiRequest(path)) return true;
  if (isViteDevAssetRequest(path)) return false;
  return true;
}
