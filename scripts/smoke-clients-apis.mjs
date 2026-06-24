/**
 * Smoke test Clients module APIs.
 * Usage: npm run smoke:clients
 */
import "dotenv/config";
import { obtainSmokeAuth, smokeCall } from "./smoke-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5000";

const GET_ENDPOINTS = [
  "GET /api/clients/kpis",
  "GET /api/clients",
  "GET /api/clients/workspace-context",
  "GET /api/clients/me",
];

async function callEndpoint(spec, auth) {
  const [method, pathWithQuery] = spec.split(" ");
  const r = await smokeCall(BASE, method, pathWithQuery, auth);
  return { spec, status: r.status, ok: r.status >= 200 && r.status < 300, json: r.json, text: r.text };
}

async function main() {
  console.log(`Smoke testing Clients APIs at ${BASE}...\n`);
  const auth = await obtainSmokeAuth(BASE);
  if (!auth.bearer && !auth.cookie) {
    console.error("No auth available.");
    process.exit(1);
  }
  console.log(`Auth via: ${auth.via}\n`);

  let passed = 0;
  let failed = 0;
  let clientId = null;

  for (const ep of GET_ENDPOINTS) {
    const r = await callEndpoint(ep, auth);
    if (r.status === 403 && ep.includes("/me")) {
      console.log(`○ ${ep} → 403 (expected for staff session)`);
      continue;
    }
    const mark = r.ok ? "✓" : "✗";
    if (r.ok) passed++; else failed++;
    const preview = Array.isArray(r.json) ? `[${r.json.length}]` : r.json?.totalClients != null ? "{kpis}" : "ok";
    console.log(`${mark} ${ep} → ${r.status} ${preview}`);
    if (ep === "GET /api/clients" && Array.isArray(r.json) && r.json[0]?.id) {
      clientId = r.json[0].id;
    }
  }

  if (clientId) {
    for (const ep of [
      `GET /api/clients/${clientId}`,
      `GET /api/clients/${clientId}/users`,
      `GET /api/clients/${clientId}/module-visibility`,
    ]) {
      const r = await callEndpoint(ep, auth);
      const mark = r.ok ? "✓" : "✗";
      if (r.ok) passed++; else failed++;
      console.log(`${mark} ${ep} → ${r.status}`);
    }
  }

  console.log(`\n--- ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
