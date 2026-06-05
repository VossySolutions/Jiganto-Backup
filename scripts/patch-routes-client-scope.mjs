/**
 * Appends resolveListClientId(req) to common storage list calls in server/routes.ts
 */
import fs from "fs";
import path from "path";

const routesPath = path.join(process.cwd(), "server", "routes.ts");
let content = fs.readFileSync(routesPath, "utf8");

const replacements = [
  [
    "storage.getCrmActivities(tenantId, entityType, entityId, accountId)",
    "storage.getCrmActivities(tenantId, entityType, entityId, accountId, resolveListClientId(req))",
  ],
  [
    "storage.getCrmTasks(tenantId, entityType, entityId, accountId)",
    "storage.getCrmTasks(tenantId, entityType, entityId, accountId, resolveListClientId(req))",
  ],
  [
    "storage.getCrmNotes(tenantId, entityType, entityId)",
    "storage.getCrmNotes(tenantId, entityType, entityId, resolveListClientId(req))",
  ],
  [
    "storage.getCrmCustomerSystems(tenantId, accountId)",
    "storage.getCrmCustomerSystems(tenantId, accountId, resolveListClientId(req))",
  ],
  [
    "storage.getTaskBoards(tenantId)",
    "storage.getTaskBoards(tenantId, resolveListClientId(req))",
  ],
  [
    "storage.getGoals(tenantId)",
    "storage.getGoals(tenantId, undefined, resolveListClientId(req))",
  ],
  [
    "storage.getGoals(tenantId, strategyItemId)",
    "storage.getGoals(tenantId, strategyItemId, resolveListClientId(req))",
  ],
  [
    "storage.getRisks(tenantId)",
    "storage.getRisks(tenantId, undefined, resolveListClientId(req))",
  ],
  [
    "storage.getObjectives(tenantId)",
    "storage.getObjectives(tenantId, undefined, resolveListClientId(req))",
  ],
  [
    "storage.getOkrs(tenantId)",
    "storage.getOkrs(tenantId, undefined, resolveListClientId(req))",
  ],
  [
    "storage.getKpis(tenantId)",
    "storage.getKpis(tenantId, undefined, resolveListClientId(req))",
  ],
  [
    "storage.getBusinessTasks(tenantId)",
    "storage.getBusinessTasks(tenantId, undefined, resolveListClientId(req))",
  ],
];

let count = 0;
for (const [from, to] of replacements) {
  if (content.includes(from) && !content.includes(to)) {
    content = content.split(from).join(to);
    count++;
  }
}

fs.writeFileSync(routesPath, content);
console.log(`Patched ${count} pattern groups in routes.ts`);
