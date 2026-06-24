/**
 * HTTP smoke test for Finance module (authenticated routes).
 * Usage: npm run smoke:finance-http
 */
import "dotenv/config";
import { obtainSmokeAuth, smokeCall } from "./smoke-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5000";

const GET_ENDPOINTS = [
  "GET /api/finance/dashboard",
  "GET /api/finance/budgets",
  "GET /api/finance/timesheets/periods",
  "GET /api/finance/expenses/reports",
  "GET /api/finance/invoices",
  "GET /api/finance/rate-cards",
  "GET /api/finance/erp/integrations",
  "GET /api/finance/settings",
  "GET /api/finance/reports/utilisation",
  "GET /api/finance/reports/missing-timesheets",
];

async function callEndpoint(spec, auth) {
  const [method, pathWithQuery] = spec.split(" ");
  const r = await smokeCall(BASE, method, pathWithQuery, auth);
  return { spec, status: r.status, ok: r.status >= 200 && r.status < 300, json: r.json, text: r.text };
}

async function main() {
  console.log(`Smoke testing Finance HTTP APIs at ${BASE}...\n`);
  const auth = await obtainSmokeAuth(BASE);
  if (!auth.bearer && !auth.cookie) {
    console.error("No auth available.");
    process.exit(1);
  }
  console.log(`Auth via: ${auth.via}\n`);

  let passed = 0;
  let failed = 0;

  for (const ep of GET_ENDPOINTS) {
    const r = await callEndpoint(ep, auth);
    const mark = r.ok ? "✓" : "✗";
    if (r.ok) passed++; else failed++;
    const preview = Array.isArray(r.json) ? `[${r.json.length}]` : r.json?.kpis ? "{dashboard}" : "ok";
    console.log(`${mark} ${ep} → ${r.status} ${preview}`);
  }

  console.log(`\n--- ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
