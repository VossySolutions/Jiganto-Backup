/**
 * Replace hardcoded tenant fallbacks in server/routes.ts with getApiTenantIdWithFallback(req).
 */
import fs from "fs";
import path from "path";

const routesPath = path.join(process.cwd(), "server", "routes.ts");
let content = fs.readFileSync(routesPath, "utf8");

if (!content.includes("getApiTenantIdWithFallback")) {
  content = content.replace(
    'import { resolveListClientId } from "./lib/list-client-id";',
    'import { resolveListClientId } from "./lib/list-client-id";\nimport { getApiTenantIdWithFallback, requireApiTenantId } from "./lib/api-tenant-id";',
  );
}

const replacements = [
  ["Number(req.query.tenantId) || 1", "getApiTenantIdWithFallback(req)"],
  ["Number(req.body.tenantId) || 1", "getApiTenantIdWithFallback(req)"],
  ["tenantId: profileData.tenantId || 1", "tenantId: getApiTenantIdWithFallback(req)"],
  ["tenantId: body.tenantId || 1", "tenantId: getApiTenantIdWithFallback(req)"],
  ["tenantId: req.body.tenantId || 1", "tenantId: getApiTenantIdWithFallback(req)"],
  ["tenantId: user.tenantId || 1", "tenantId: getApiTenantIdWithFallback(req)"],
  ["tenantId: tenantId || 1", "tenantId: getApiTenantIdWithFallback(req)"],
];

let total = 0;
for (const [from, to] of replacements) {
  const parts = content.split(from);
  if (parts.length > 1) {
    total += parts.length - 1;
    content = parts.join(to);
  }
}

fs.writeFileSync(routesPath, content);
console.log(`Replaced ${total} tenant id fallbacks in routes.ts`);
