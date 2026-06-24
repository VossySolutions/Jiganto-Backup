import fs from "fs";

const files = [
  "server/surveys/routes.ts",
  "server/templates/routes.ts",
  "server/portfolio/routes.ts",
  "server/workspaces/routes.ts",
];

for (const rel of files) {
  let src = fs.readFileSync(rel, "utf8");
  src = src.replace(
    'import { getApiTenantIdWithFallback } from "../lib/api-tenant-id";',
    'import { requireApiTenantId } from "../lib/api-tenant-id";',
  );
  src = src.replace(
    /const tenantId = getApiTenantIdWithFallback\(req\);/g,
    "const tenantId = requireApiTenantId(req, res);\n      if (tenantId == null) return;",
  );
  src = src.replace(
    /const tenantId = getApiTenantIdWithFallback\(req\);\n/g,
    "const tenantId = requireApiTenantId(req, res);\n    if (tenantId == null) return;\n",
  );
  fs.writeFileSync(rel, src);
  console.log("patched", rel);
}
