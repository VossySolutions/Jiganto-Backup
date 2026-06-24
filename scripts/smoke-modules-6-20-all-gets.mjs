/**
 * Exhaustive GET smoke for modules 6–20 (DEPLOYMENT.md scope).
 * Discovers app.get routes from server route files, substitutes :params with 1,
 * and reports 401/403/404/5xx.
 *
 * Usage: npm run smoke:modules-6-20-gets  (dev server on :5000)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { obtainSmokeAuth, smokeCall } from "./smoke-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:5000";
const ROOT = path.resolve(import.meta.dirname, "..");

const ROUTE_FILES = [
  "server/routes.ts",
  "server/finance/routes.ts",
  "server/resources/routes.ts",
  "server/resource-planning/routes.ts",
  "server/portfolio/routes.ts",
  "server/tasks/routes.ts",
  "server/workspaces/routes.ts",
  "server/service-desk/routes.ts",
  "server/help-desk/routes.ts",
  "server/testmgmt/routes.ts",
  "server/bpm/routes.ts",
  "server/surveys/routes.ts",
  "server/templates/routes.ts",
];

/** Prefixes in DEPLOYMENT.md modules 6–20 scope */
const MODULE_PREFIXES = [
  { module: "CRM", prefix: "/api/crm" },
  { module: "Finance", prefix: "/api/finance" },
  { module: "Resources", prefix: "/api/resources" },
  { module: "Resource Planning", prefix: "/api/resource-planning" },
  { module: "Portfolio", prefix: "/api/portfolio" },
  { module: "Projects", prefix: "/api/pm" },
  { module: "Projects", prefix: "/api/projects" },
  { module: "Tasks", prefix: "/api/tasks" },
  { module: "Workspaces", prefix: "/api/workspace" },
  { module: "Workspaces", prefix: "/api/workspaces" },
  { module: "Service Desk", prefix: "/api/service-desk" },
  { module: "Help Desk", prefix: "/api/help-desk" },
  { module: "Test Management", prefix: "/api/tm" },
  { module: "BPM", prefix: "/api/bpm" },
  { module: "BPM", prefix: "/api/bpml" },
  { module: "BPM", prefix: "/api/org-chart" },
  { module: "BPM", prefix: "/api/frameworks" },
  { module: "BPM", prefix: "/api/portal" },
  { module: "BPM", prefix: "/api/process-resources" },
  { module: "Surveys", prefix: "/api/surveys" },
  { module: "Surveys", prefix: "/api/polls" },
  { module: "Surveys", prefix: "/api/survey-templates" },
  { module: "Templates", prefix: "/api/templates" },
];

const SKIP_PATTERNS = [
  /^\/api\/auth\//,
  /^\/public\//,
  /:token/,
  /by-token/,
  /\/csat\//,
  /\/webhooks\//,
  /\/pdf$/,
  /\/export/,
  // Help Desk customer portal — uses x-portal-session, not SI cookie
  /^\/api\/portal\/:[^/]+/,
];

function extractGetRoutes(filePath) {
  const src = fs.readFileSync(path.join(ROOT, filePath), "utf8");
  const routes = new Set();
  const re = /app\.get\(\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    routes.add(m[1]);
  }
  return [...routes];
}

function moduleForPath(p) {
  for (const { module, prefix } of MODULE_PREFIXES) {
    if (p.startsWith(prefix)) return module;
  }
  return null;
}

function shouldSkip(p) {
  return SKIP_PATTERNS.some((re) => re.test(p));
}

function substituteParams(p) {
  return p.replace(/:[A-Za-z0-9_]+/g, "1");
}

function classify(status) {
  if (status === 401) return "401";
  if (status === 403) return "403";
  if (status === 404) return "404";
  if (status >= 500) return "5xx";
  if (status >= 200 && status < 300) return "ok";
  if (status >= 400 && status < 500) return "4xx";
  return "other";
}

async function main() {
  const allRoutes = new Set();
  for (const f of ROUTE_FILES) {
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    for (const r of extractGetRoutes(f)) allRoutes.add(r);
  }

  const scoped = [...allRoutes]
    .map((p) => ({ path: p, module: moduleForPath(p) }))
    .filter((r) => r.module && !shouldSkip(r.path))
    .sort((a, b) => a.path.localeCompare(b.path));

  console.log(`\nModules 6–20 GET route scan @ ${BASE}`);
  console.log(`Discovered ${scoped.length} scoped GET routes (params → 1)\n`);

  const auth = await obtainSmokeAuth(BASE);
  if (!auth.bearer && !auth.cookie) {
    console.error("No auth — set SMOKE_BEARER_TOKEN or run with dev login enabled.");
    process.exit(1);
  }
  console.log(`Auth: ${auth.via}\n`);

  const byModule = new Map();
  const problems = [];
  let ok = 0;

  for (const { path: routePath, module } of scoped) {
    const testPath = substituteParams(routePath);
    const r = await smokeCall(BASE, "GET", testPath, auth);
    const bucket = classify(r.status);
    if (!byModule.has(module)) byModule.set(module, { ok: 0, total: 0, issues: [] });
    const mod = byModule.get(module);
    mod.total++;

    if (bucket === "ok") {
      ok++;
      mod.ok++;
    } else if (bucket === "404") {
      mod.issues.push({ path: testPath, status: r.status, note: "404 (missing id=1 or empty)" });
    } else {
      problems.push({ module, path: testPath, raw: routePath, status: r.status, detail: r.text.slice(0, 120) });
      mod.issues.push({ path: testPath, status: r.status, detail: r.text.slice(0, 80) });
    }
  }

  for (const [module, stats] of [...byModule.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const bad = stats.issues.filter((i) => i.status !== 404);
    console.log(`${module}: ${stats.ok}/${stats.total} OK` + (bad.length ? ` — ${bad.length} auth/5xx` : ""));
    for (const i of bad.slice(0, 5)) {
      console.log(`  ✗ GET ${i.path} → ${i.status} ${i.detail ?? ""}`);
    }
    if (bad.length > 5) console.log(`  … +${bad.length - 5} more`);
  }

  const authErrors = problems.filter((p) => p.status === 401);
  const serverErrors = problems.filter((p) => p.status >= 500);

  console.log(`\n── Summary ──`);
  console.log(`Total GET routes tested: ${scoped.length}`);
  console.log(`2xx: ${ok}`);
  console.log(`401 Unauthorized: ${authErrors.length}`);
  console.log(`5xx Server errors: ${serverErrors.length}`);
  console.log(`Other 4xx (excl. 404): ${problems.filter((p) => p.status !== 401 && p.status >= 400 && p.status < 500 && p.status !== 404).length}`);
  console.log(`404 (likely no record id=1): ${scoped.length - ok - problems.filter((p) => p.status !== 404).length}`);

  if (authErrors.length || serverErrors.length) {
    console.log("\n── Action required ──");
    for (const p of [...authErrors, ...serverErrors].slice(0, 20)) {
      console.log(`  [${p.module}] GET ${p.path} → ${p.status}`);
    }
    process.exit(1);
  }

  console.log("\nNo 401 or 5xx on authenticated GET scan.\n");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
