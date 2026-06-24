/**
 * Authenticated HTTP smoke for modules without dedicated scripts or partial coverage.
 * Usage: npm run smoke:validate-all  (dev server must be running)
 */
import "dotenv/config";
import { obtainSmokeAuth, smokeCall } from "./smoke-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:5000";

const MODULE_CHECKS = [
  { module: "Finance", endpoints: [
    "GET /api/finance/dashboard",
    "GET /api/finance/budgets",
    "GET /api/finance/timesheets/periods",
    "GET /api/finance/expenses/reports",
    "GET /api/finance/invoices",
    "GET /api/finance/rate-cards",
    "GET /api/finance/erp/integrations",
    "GET /api/finance/settings",
  ]},
  { module: "Projects", endpoints: [
    "GET /api/pm/projects",
    "GET /api/pm/programs",
  ]},
  { module: "Resources", endpoints: [
    "GET /api/resources/scope",
    "GET /api/resources/stats",
    "GET /api/resources",
  ]},
  { module: "Business", endpoints: [
    "GET /api/business/stats",
    "GET /api/business/goals",
    "GET /api/business/strategy-map",
  ]},
  { module: "Tasks", endpoints: [
    "GET /api/tasks",
    "GET /api/tasks/summary",
    "GET /api/tasks/meta/workspaces",
    "GET /api/tasks/meta/projects",
  ]},
  { module: "Service Desk", endpoints: [
    "GET /api/service-desk/dashboard",
    "GET /api/service-desk/tickets",
  ]},
];

async function main() {
  console.log(`\nAuthenticated module validation @ ${BASE}\n`);
  const auth = await obtainSmokeAuth(BASE);
  if (!auth.bearer && !auth.cookie) {
    console.error("No auth available.");
    process.exit(1);
  }
  console.log(`Auth via: ${auth.via}\n`);

  let totalPass = 0;
  let totalFail = 0;
  const failures = [];

  for (const { module, endpoints } of MODULE_CHECKS) {
    console.log(`— ${module} —`);
    for (const spec of endpoints) {
      const [method, path] = spec.split(" ");
      const r = await smokeCall(BASE, method, path, auth);
      const ok = r.status >= 200 && r.status < 300;
      if (ok) {
        totalPass++;
        const preview = Array.isArray(r.json) ? `[${r.json.length}]` : r.json?.kpis ? "{kpis}" : "ok";
        console.log(`  ✓ ${spec} → ${r.status} ${preview}`);
      } else {
        totalFail++;
        failures.push({ module, spec, status: r.status, detail: r.text });
        console.log(`  ✗ ${spec} → ${r.status} ${r.text.slice(0, 100)}`);
      }
    }
  }

  console.log(`\nSummary: ${totalPass} passed, ${totalFail} failed`);
  if (failures.length) {
    for (const f of failures) console.log(`  FAIL [${f.module}] ${f.spec} → ${f.status}`);
    process.exit(1);
  }
  console.log("All authenticated module checks passed.\n");
}

main();
