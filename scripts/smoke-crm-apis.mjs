/**
 * Smoke test CRM module APIs (read paths used by CRMPage + forecasting).
 * Usage: npm run smoke:crm
 */
import "dotenv/config";
import { obtainSmokeAuth, smokeCall } from "./smoke-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5000";

const GET_ENDPOINTS = [
  "GET /api/crm/dashboard-stats",
  "GET /api/crm/accounts",
  "GET /api/crm/contacts",
  "GET /api/crm/leads",
  "GET /api/crm/pipelines",
  "GET /api/crm/stages",
  "GET /api/crm/opportunities",
  "GET /api/crm/contracts",
  "GET /api/crm/activities",
  "GET /api/crm/tasks",
  "GET /api/crm/forecasts",
  "GET /api/crm/forecast-matrix?period=monthly&scenario=expected&monthsAhead=12",
  "GET /api/crm/saved-views",
  "GET /api/crm/custom-fields",
  "GET /api/crm/email-templates",
  "GET /api/crm/email-logs",
  "GET /api/crm/territories",
  "GET /api/crm/resource-plans/summaries",
  "GET /api/crm/resource-plan-templates",
];

async function callEndpoint(spec, auth) {
  const [method, pathWithQuery] = spec.split(" ");
  const r = await smokeCall(BASE, method, pathWithQuery, auth);
  return {
    spec,
    status: r.status,
    ok: r.status >= 200 && r.status < 300,
    size: r.text.length,
    json: r.json,
    text: r.text,
  };
}

function preview(json, spec) {
  if (Array.isArray(json)) return `[${json.length}]`;
  if (json && typeof json === "object") {
    if ("totalPipelineValue" in json) return "{stats}";
    if ("rows" in json && "columns" in json) return `{matrix ${json.rows?.length ?? 0} rows}`;
    if ("kpis" in json) return "{kpis}";
  }
  return "";
}

async function main() {
  console.log(`Smoke testing CRM APIs at ${BASE}...\n`);
  const auth = await obtainSmokeAuth(BASE);
  if (!auth.bearer && !auth.cookie) {
    console.error("No auth available.");
    process.exit(1);
  }
  console.log(`Auth via: ${auth.via}\n`);

  let passed = 0;
  let failed = 0;
  let accountId = null;
  let opportunityId = null;

  for (const ep of GET_ENDPOINTS) {
    try {
      const r = await callEndpoint(ep, auth);
      if (r.status === 401) {
        failed++;
        console.log(`✗ ${r.spec} → 401 (auth required)`);
        continue;
      }
      if (r.status === 500) {
        failed++;
        console.log(`✗ ${r.spec} → 500 ${r.text.slice(0, 120)}`);
        continue;
      }
      const mark = r.ok ? "✓" : "✗";
      if (r.ok) passed++;
      else failed++;
      console.log(`${mark} ${r.spec} → ${r.status} (${r.size}b) ${preview(r.json, ep)}`);

      if (ep === "GET /api/crm/accounts" && Array.isArray(r.json) && r.json[0]?.id) {
        accountId = r.json[0].id;
      }
      if (ep === "GET /api/crm/opportunities" && Array.isArray(r.json) && r.json[0]?.id) {
        opportunityId = r.json[0].id;
      }
    } catch (e) {
      failed++;
      console.log(`✗ ${ep} → ERROR: ${e.message}`);
    }
  }

  if (accountId) {
    for (const ep of [
      `GET /api/crm/accounts/${accountId}`,
      `GET /api/crm/activities?entityType=account&entityId=${accountId}`,
      `GET /api/crm/notes?entityType=account&entityId=${accountId}`,
    ]) {
      const r = await callEndpoint(ep, auth);
      const mark = r.ok ? "✓" : "✗";
      if (r.ok) passed++;
      else failed++;
      console.log(`${mark} ${ep} → ${r.status} ${preview(r.json, ep)}`);
    }
  }

  if (opportunityId) {
    for (const ep of [
      `GET /api/crm/opportunities/${opportunityId}`,
      `GET /api/crm/opportunities/${opportunityId}/resource-plans`,
    ]) {
      const r = await callEndpoint(ep, auth);
      const mark = r.ok ? "✓" : "✗";
      if (r.ok) passed++;
      else failed++;
      console.log(`${mark} ${ep} → ${r.status} ${preview(r.json, ep)}`);
    }

    const [method, path] = "PUT /api/crm/opportunities/:id".split(" ");
    const putPath = path.replace(":id", String(opportunityId));
    const putR = await smokeCall(BASE, method, putPath, {
      ...auth,
      body: { expectedCloseDate: "2026-12-31", probability: 50 },
    });
    if (putR.status >= 200 && putR.status < 300) {
      passed++;
      console.log(`✓ PUT ${putPath} (date string body) → ${putR.status}`);
    } else {
      failed++;
      console.log(`✗ PUT ${putPath} (date string body) → ${putR.status} ${putR.text.slice(0, 120)}`);
    }
  }

  const notesValidation = await callEndpoint("GET /api/crm/notes", auth);
  if (notesValidation.status === 400) {
    passed++;
    console.log(`✓ GET /api/crm/notes (no params → 400, expected)`);
  } else {
    failed++;
    console.log(`✗ GET /api/crm/notes (no params → ${notesValidation.status}, expected 400)`);
  }

  const noAuth = await callEndpoint("GET /api/crm/accounts", {});
  if (noAuth.status === 401 || noAuth.status === 403) {
    passed++;
    console.log(`✓ GET /api/crm/accounts (no auth → ${noAuth.status})`);
  } else {
    failed++;
    console.log(`✗ GET /api/crm/accounts (no auth → ${noAuth.status}, expected 401/403)`);
  }

  console.log(`\n--- ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
