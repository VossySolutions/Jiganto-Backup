/**
 * Smoke test Test Management module APIs.
 * Usage: npm run smoke:test-mgmt  (dev server must be running)
 */
import "dotenv/config";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:5000";
const LOGIN_PRESET = process.env.SMOKE_LOGIN_PRESET ?? "si_super_admin";

function cookieHeaderFromResponse(res) {
  const parts = [];
  if (typeof res.headers.getSetCookie === "function") {
    for (const c of res.headers.getSetCookie()) {
      const pair = c.split(";")[0]?.trim();
      if (pair) parts.push(pair);
    }
  } else {
    const raw = res.headers.get("set-cookie");
    if (raw) {
      for (const c of raw.split(/,(?=\s*[^;]+=)/)) {
        const pair = c.split(";")[0]?.trim();
        if (pair) parts.push(pair);
      }
    }
  }
  return parts.join("; ");
}

async function obtainAuthCookie() {
  try {
    const res = await fetch(`${BASE}/api/login?preset=${encodeURIComponent(LOGIN_PRESET)}`, { redirect: "manual" });
    const cookie = cookieHeaderFromResponse(res);
    if (cookie) return cookie;
    const res2 = await fetch(`${BASE}/api/login`, { redirect: "manual" });
    return cookieHeaderFromResponse(res2);
  } catch {
    return "";
  }
}

async function call(method, path, { cookie, body } = {}) {
  const url = `${BASE}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const init = { method, headers };
  if (body) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text: text.slice(0, 200) };
}

let projectId = null;
let cycleId = null;
let caseId = null;
let executionId = null;

const failures = [];

function check(label, status, allowed = [200, 201]) {
  const ok = allowed.includes(status);
  console.log(`${ok ? "✓" : "✗"} ${label} → ${status}`);
  if (!ok) failures.push({ label, status });
  return ok;
}

const cookie = await obtainAuthCookie();
console.log(`Base: ${BASE}  Auth cookie: ${cookie ? "yes" : "no"}\n`);

// Schema + projects
let r = await call("POST", "/api/tm/migrate-schema", { cookie });
check("POST /api/tm/migrate-schema", r.status, [200, 401]);

r = await call("GET", "/api/tm/projects", { cookie });
check("GET /api/tm/projects", r.status);
if (r.json?.length) projectId = r.json[0].id;
else {
  r = await call("POST", "/api/tm/projects", { cookie, body: { name: "Smoke TM Project", status: "active", tenantId: 1 } });
  check("POST /api/tm/projects", r.status, [200, 201]);
  projectId = r.json?.id;
}

if (!projectId) {
  console.error("\nNo project id — aborting.");
  process.exit(1);
}

const q = `?projectId=${projectId}`;

const getEndpoints = [
  `/api/tm/business-areas${q}`,
  `/api/tm/business-processes${q}`,
  `/api/tm/hierarchy${q}`,
  `/api/tm/cycles${q}`,
  `/api/tm/dashboard${q}`,
  `/api/tm/suites${q}`,
  `/api/tm/cases${q}`,
  `/api/tm/scenarios${q}`,
  `/api/tm/runs${q}`,
  `/api/tm/requirements${q}`,
  `/api/tm/defects${q}`,
  `/api/tm/defects/hd${q}`,
  `/api/tm/results/all${q}`,
  `/api/tm/audit${q}`,
  `/api/tm/sign-offs${q}`,
  `/api/tm/reports/phase-comparison${q}`,
];

for (const path of getEndpoints) {
  r = await call("GET", path, { cookie });
  check(`GET ${path.split("?")[0]}`, r.status, [200]);
  if (path.includes("/cycles") && r.json?.[0]?.id) cycleId = r.json[0].id;
  if (path.includes("/cases") && r.json?.[0]?.id) caseId = r.json[0].id;
}

if (cycleId) {
  r = await call("GET", `/api/tm/cycles/${cycleId}`, { cookie });
  check(`GET /api/tm/cycles/:id`, r.status);
  if (r.json?.results?.[0]?.id) executionId = r.json.results[0].id;
}

r = await call("GET", `/api/tm/sign-offs/pdf${q}&entityType=test_cycle&entityId=${cycleId ?? 1}`, { cookie });
check("GET /api/tm/sign-offs/pdf", r.status, [200]);

if (caseId) {
  r = await call("POST", "/api/tm/ai/generate-tests", { cookie, body: { projectId, scenarioId: caseId, count: 1, create: false } });
  check("POST /api/tm/ai/generate-tests", r.status, [200, 404]);
}

r = await call("POST", "/api/tm/seed-hierarchy", { cookie, body: { projectId } });
check("POST /api/tm/seed-hierarchy", r.status, [200]);

console.log(`\n${failures.length ? `FAILED (${failures.length})` : "ALL PASS"}`);
if (failures.length) {
  failures.forEach(f => console.log(`  - ${f.label}: ${f.status}`));
  process.exit(1);
}
