/**
 * Smoke test Templates module APIs.
 *
 * Usage:
 *   npm run smoke:templates  (dev server must be running)
 *
 * Auth (pick one):
 *   • Dev session cookie — GET /api/login (works in NODE_ENV=development)
 *   • SMOKE_BEARER_TOKEN=<jwt>
 *   • SMOKE_SUPABASE_EMAIL + SMOKE_SUPABASE_PASSWORD (Supabase password grant)
 *
 * Only intentional 401/404 appear in the "Security" section at the end.
 */
import "dotenv/config";
import { obtainSmokeAuth, smokeCall } from "./smoke-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:5000";
const TENANT = Number(process.env.SMOKE_TENANT_ID ?? "1");

const failures = [];
let templateId = null;
let templateModule = null;
let templateSourceId = null;

function expectOk(label, result, allowed = [200, 201]) {
  if (!allowed.includes(result.status)) {
    failures.push({ label, status: result.status, detail: result.text });
    console.log(`  FAIL ${label} → ${result.status} ${result.text}`);
    return false;
  }
  console.log(`  OK   ${label} → ${result.status}`);
  return true;
}

function expectStatus(label, result, status) {
  const allowed = Array.isArray(status) ? status : [status];
  if (!allowed.includes(result.status)) {
    failures.push({ label, status: result.status, detail: `expected ${allowed.join("|")}, got ${result.text}` });
    console.log(`  FAIL ${label} → ${result.status} (expected ${allowed.join("|")})`);
    return false;
  }
  console.log(`  OK   ${label} → ${result.status} (expected)`);
  return true;
}

async function call(method, path, auth, body) {
  return smokeCall(BASE, method, path, { ...auth, body });
}

async function discoverSourceIds(auth) {
  const qs = `tenantId=${TENANT}`;
  const ids = {};

  const fws = await call("GET", `/api/frameworks?${qs}`, auth);
  if (fws.status === 200 && Array.isArray(fws.json) && fws.json[0]?.id) ids.framework = fws.json[0].id;

  const pm = await call("GET", `/api/pm/projects?tenantId=${TENANT}`, auth);
  if (pm.status === 200 && Array.isArray(pm.json) && pm.json[0]?.id) ids.project = pm.json[0].id;

  const charts = await call("GET", `/api/org-charts?${qs}`, auth);
  if (charts.status === 200 && Array.isArray(charts.json) && charts.json[0]?.id) ids.orgChart = charts.json[0].id;

  const bpml = await call("GET", `/api/bpml/templates?${qs}`, auth);
  if (bpml.status === 200 && Array.isArray(bpml.json) && bpml.json[0]?.id) ids.bpml = bpml.json[0].id;

  const tm = await call("GET", "/api/tm/projects", auth);
  if (tm.status === 200 && Array.isArray(tm.json) && tm.json[0]?.id) ids.tmProject = tm.json[0].id;

  const wb = await call("GET", "/api/whiteboard", auth);
  if (wb.status === 200 && Array.isArray(wb.json) && wb.json[0]?.id) ids.whiteboard = wb.json[0].id;

  return ids;
}

async function main() {
  console.log(`\nTemplates API smoke test @ ${BASE}\n`);

  try {
    await fetch(`${BASE}/api/login`, { redirect: "manual", signal: AbortSignal.timeout(15000) });
  } catch (err) {
    console.error(`FATAL: cannot reach ${BASE} — ${err instanceof Error ? err.message : err}`);
    console.error("\nStart the dev server first:  npm run dev\n");
    process.exit(1);
  }

  const auth = await obtainSmokeAuth(BASE);
  if (auth.via === "SMOKE_BEARER_TOKEN") {
    console.log("Auth: SMOKE_BEARER_TOKEN\n");
  } else if (auth.via === "supabase-password") {
    console.log("Auth: Supabase password grant\n");
  } else if (auth.cookie) {
    console.log(`Auth: dev session cookie (${auth.via}, mode=${auth.mode})\n`);
  } else {
    console.error("FATAL: could not obtain auth\n");
    console.error("Options:");
    console.error("  • Run with dev server in NODE_ENV=development (uses /api/login cookie)");
    console.error("  • Set SMOKE_BEARER_TOKEN=<supabase-jwt>");
    console.error("  • Set SMOKE_SUPABASE_EMAIL + SMOKE_SUPABASE_PASSWORD in .env\n");
    process.exit(1);
  }

  const session = await call("GET", "/api/auth/session", auth);
  if (!expectOk("GET /api/auth/session (auth check)", session)) {
    console.error("\nSession invalid — all protected routes would return 401.\n");
    process.exit(1);
  }

  console.log("— Core read endpoints (must be 200, not 401/404) —");
  let r = await call("GET", "/api/templates", auth);
  if (expectOk("GET /api/templates", r)) {
    const list = Array.isArray(r.json) ? r.json : [];
    if (list.length) {
      templateId = list[0].id;
      templateModule = list[0].module;
      templateSourceId = list[0].sourceId;
    }
  }

  expectOk("GET /api/templates/discovery", await call("GET", "/api/templates/discovery", auth));
  expectOk("GET /api/templates/module-counts", await call("GET", "/api/templates/module-counts", auth));
  expectOk("GET /api/templates?sort=newest&tier=system", await call("GET", "/api/templates?sort=newest&tier=system", auth));
  expectOk("GET /api/templates?tier=submitted", await call("GET", "/api/templates?tier=submitted", auth));
  expectOk("GET /api/templates/marketplace", await call("GET", "/api/templates/marketplace", auth));

  console.log("\n— Detail & snapshot —");
  if (templateId) {
    expectOk("GET /api/templates/:id", await call("GET", `/api/templates/${templateId}`, auth));
    if (templateModule && templateSourceId) {
      expectOk(
        "GET /api/templates/snapshot",
        await call("GET", `/api/templates/snapshot?module=${encodeURIComponent(templateModule)}&sourceId=${templateSourceId}`, auth),
      );
    } else {
      console.log("  SKIP GET /api/templates/snapshot — template has no sourceId");
    }
  } else {
    console.log("  SKIP GET /api/templates/:id — no templates in registry");
  }

  expectStatus("GET /api/templates/snapshot (missing params → 400)", await call("GET", "/api/templates/snapshot", auth), 400);

  console.log("\n— Mutations (validation) —");
  expectStatus("POST /api/templates/apply (no templateId → 400)", await call("POST", "/api/templates/apply", auth, {}), 400);
  expectStatus("POST /api/templates/ai-generate (no prompt → 400)", await call("POST", "/api/templates/ai-generate", auth, { module: "survey" }), 400);
  expectStatus("POST /api/templates/:id/review (bad status → 400)", await call("POST", `/api/templates/${templateId ?? 1}/review`, auth, { status: "invalid" }), 400);
  expectOk("POST /api/templates/sync", await call("POST", "/api/templates/sync", auth, {}));

  if (templateId) {
    expectOk("POST /api/templates/apply", await call("POST", "/api/templates/apply", auth, {
      templateId,
      name: `Smoke test ${Date.now()}`,
    }));
  }

  console.log("\n— Save-as-template shortcuts —");
  const sources = await discoverSourceIds(auth);
  const saveRoutes = [
    ["framework", `/api/frameworks/${sources.framework}/save-as-template`, sources.framework],
    ["project", `/api/pm/projects/${sources.project}/save-as-template`, sources.project],
    ["org chart", `/api/org-charts/${sources.orgChart}/save-as-template`, sources.orgChart],
    ["bpml", `/api/bpml/templates/${sources.bpml}/save-as-template`, sources.bpml],
    ["tm project", `/api/tm/projects/${sources.tmProject}/save-as-template`, sources.tmProject],
    ["whiteboard", `/api/whiteboard/${sources.whiteboard}/save-as-template`, sources.whiteboard],
  ];
  for (const [label, path, id] of saveRoutes) {
    if (!id) {
      console.log(`  SKIP POST ${label} save-as-template — no ${label} in tenant`);
      continue;
    }
    expectOk(`POST ${label} save-as-template`, await call("POST", path, auth, { name: `Smoke ${label} ${Date.now()}` }), [200, 201]);
  }

  console.log("\n— Security (intentional 401/404 — not bugs) —");
  expectStatus("GET /api/templates (no auth → 401/403)", await smokeCall(BASE, "GET", "/api/templates"), [401, 403]);
  expectStatus("GET /api/templates/999999 (missing id → 404)", await call("GET", "/api/templates/999999", auth), 404);
  expectStatus("POST /api/frameworks/999999/save-as-template (missing → 404)", await call("POST", "/api/frameworks/999999/save-as-template", auth, { name: "x" }), 404);
  expectStatus("POST /api/pm/projects/999999/save-as-template (missing → 404)", await call("POST", "/api/pm/projects/999999/save-as-template", auth, { name: "x" }), 404);
  expectStatus("POST /api/bpml/templates/999999/save-as-template (missing → 404)", await call("POST", "/api/bpml/templates/999999/save-as-template", auth, { name: "x" }), 404);
  expectStatus("POST /api/tm/projects/999999/save-as-template (missing → 404)", await call("POST", "/api/tm/projects/999999/save-as-template", auth, { name: "x" }), 404);
  expectStatus("POST /api/whiteboard/999999/save-as-template (missing → 404)", await call("POST", "/api/whiteboard/999999/save-as-template", auth, { name: "x" }), 404);

  console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${failures.length} failure(s)`);
  if (failures.length) {
    for (const f of failures) console.log(`  • ${f.label} → ${f.status}${f.detail ? `: ${f.detail}` : ""}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
