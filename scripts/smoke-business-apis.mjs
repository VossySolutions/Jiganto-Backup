/**
 * Smoke test Business Management module APIs.
 * Usage: npm run smoke:business
 */
import "dotenv/config";
import { obtainSmokeAuth, smokeCall } from "./smoke-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5000";

const GET_ENDPOINTS = [
  "GET /api/business/stats",
  "GET /api/business/strategy",
  "GET /api/business/strategy-map",
  "GET /api/business/goals",
  "GET /api/business/initiatives",
  "GET /api/business/risks",
  "GET /api/business/departments",
  "GET /api/business/processes",
  "GET /api/business/tools",
  "GET /api/business/kpis",
  "GET /api/business/objectives",
  "GET /api/business/okrs",
  "GET /api/business/meetings",
  "GET /api/business/review-notes",
  "GET /api/business/overdue-reviews",
  "GET /api/business/governance",
  "GET /api/business/entity-refs",
];

async function callEndpoint(spec, auth) {
  const [method, pathWithQuery] = spec.split(" ");
  const r = await smokeCall(BASE, method, pathWithQuery, auth);
  return { spec, status: r.status, ok: r.status >= 200 && r.status < 300, json: r.json, text: r.text };
}

async function main() {
  console.log(`Smoke testing Business Management APIs at ${BASE}...\n`);
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
    const preview = Array.isArray(r.json) ? `[${r.json.length}]` : r.json?.goals != null ? "{stats}" : "ok";
    console.log(`${mark} ${ep} → ${r.status} ${preview}`);
  }

  console.log(`\n--- ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
