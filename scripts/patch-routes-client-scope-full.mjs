/**
 * Append resolveListClientId(req) to storage list calls missing client scope.
 */
import fs from "fs";
import path from "path";

const routesPath = path.join(process.cwd(), "server", "routes.ts");
let content = fs.readFileSync(routesPath, "utf8");
const marker = "resolveListClientId(req)";

const replacements = [
  ["storage.getCrmOpportunities(tenantId)", "storage.getCrmOpportunities(tenantId, undefined, undefined, resolveListClientId(req))"],
  ["storage.getCrmOpportunities(tenantId, stageId)", "storage.getCrmOpportunities(tenantId, stageId, undefined, resolveListClientId(req))"],
  ["storage.getCrmOpportunities(tenantId, undefined, accountId)", "storage.getCrmOpportunities(tenantId, undefined, accountId, resolveListClientId(req))"],
  ["storage.getKpis(tenantId, goalId)", "storage.getKpis(tenantId, goalId, resolveListClientId(req))"],
  ["storage.getKpis(tenantId)", "storage.getKpis(tenantId, undefined, resolveListClientId(req))"],
  ["storage.getPmPrograms(tenantId, portfolioId)", "storage.getPmPrograms(tenantId, portfolioId, resolveListClientId(req))"],
  ["storage.getPmPrograms(tenantId)", "storage.getPmPrograms(tenantId, undefined, resolveListClientId(req))"],
  ["storage.getInitiatives(tenantId, undefined, statsClientId)", "storage.getInitiatives(tenantId, undefined, resolveListClientId(req))"],
  ["storage.getInitiatives(tenantId, goalId, workspaceClientId(req))", "storage.getInitiatives(tenantId, goalId, resolveListClientId(req))"],
  ["storage.getCrmAccounts(tenantId, workspaceClientId(req))", "storage.getCrmAccounts(tenantId, resolveListClientId(req))"],
];

let count = 0;
for (const [from, to] of replacements) {
  if (!content.includes(from)) continue;
  if (content.includes(to)) continue;
  content = content.split(from).join(to);
  count++;
}

if (!content.includes(marker)) {
  console.error("resolveListClientId import missing");
  process.exit(1);
}

fs.writeFileSync(routesPath, content);
console.log(`Patched ${count} client-scope groups`);
