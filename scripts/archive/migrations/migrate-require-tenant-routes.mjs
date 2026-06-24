/**
 * Replace getApiTenantIdWithFallback(req) with requireApiTenantId + guard in server/routes.ts
 */
import fs from "fs";
import path from "path";

const routesPath = path.join(process.cwd(), "server", "routes.ts");
let content = fs.readFileSync(routesPath, "utf8");

const before = (content.match(/getApiTenantIdWithFallback\(req\)/g) ?? []).length;

content = content.replace(
  /^(\s*)const tenantId = getApiTenantIdWithFallback\(req\);$/gm,
  (_, indent) =>
    `${indent}const tenantId = requireApiTenantId(req, res);\n${indent}if (tenantId == null) return;`,
);

content = content.replace(
  /import \{ getApiTenantIdWithFallback, requireApiTenantId \}/,
  "import { requireApiTenantId, getApiTenantId }",
);

content = content.replace(
  /await registerExtendedChatRoutes\(app, getUserId, getApiTenantIdWithFallback\)/,
  "await registerExtendedChatRoutes(app, getUserId, (req) => getApiTenantId(req) ?? 0)",
);

const after = (content.match(/getApiTenantIdWithFallback\(req\)/g) ?? []).length;

fs.writeFileSync(routesPath, content);
console.log(`Migrated routes.ts: ${before} fallback calls → ${after} remaining`);
