/**
 * Smoke test Service Desk module APIs.
 * Usage: npm run smoke:service-desk
 */
import "dotenv/config";
import { obtainSmokeAuth, smokeCall } from "./smoke-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5000";

const GET_ENDPOINTS = [
  "GET /api/service-desk/dashboard",
  "GET /api/service-desk/tickets",
  "GET /api/service-desk/catalogue",
  "GET /api/service-desk/catalogue?admin=1",
  "GET /api/service-desk/teams",
  "GET /api/service-desk/routing-rules",
  "GET /api/service-desk/sla-configs",
  "GET /api/service-desk/cab-members",
  "GET /api/service-desk/reports/time-analysis",
  "GET /api/service-desk/reports/billable-time",
  "GET /api/service-desk/settings",
];

async function callEndpoint(spec, auth, body) {
  const [method, pathWithQuery] = spec.split(" ");
  const r = await smokeCall(BASE, method, pathWithQuery, { ...auth, body });
  return { spec, status: r.status, ok: r.status >= 200 && r.status < 300, size: r.text.length, json: r.json, text: r.text };
}

async function main() {
  console.log(`Smoke testing Service Desk APIs at ${BASE}...\n`);
  const auth = await obtainSmokeAuth(BASE);
  if (!auth.bearer && !auth.cookie) {
    console.error("No auth available.");
    process.exit(1);
  }
  console.log(`Auth via: ${auth.via}\n`);

  let passed = 0;
  let failed = 0;
  let authSkipped = 0;
  let ticketId = null;

  for (const ep of GET_ENDPOINTS) {
    try {
      const r = await callEndpoint(ep, auth);
      if (r.status === 401) {
        authSkipped++;
        console.log(`○ ${r.spec} → 401 (auth required)`);
        continue;
      }
      if (r.status === 500) {
        failed++;
        console.log(`✗ ${r.spec} → 500 ${r.text.slice(0, 120)}`);
        continue;
      }
      const mark = r.ok ? "✓" : "✗";
      if (r.ok) passed++; else failed++;
      const preview = Array.isArray(r.json) ? `[${r.json.length}]` : r.json?.kpis ? `{kpis}` : "";
      console.log(`${mark} ${r.spec} → ${r.status} (${r.size}b) ${preview}`);
      if (ep === "GET /api/service-desk/tickets" && Array.isArray(r.json) && r.json[0]?.id) {
        ticketId = r.json[0].id;
      }
    } catch (e) {
      failed++;
      console.log(`✗ ${ep} → ERROR: ${e.message}`);
    }
  }

  if (ticketId) {
    const r = await callEndpoint(`GET /api/service-desk/tickets/${ticketId}`, auth);
    const mark = r.ok ? "✓" : "✗";
    if (r.ok) passed++; else failed++;
    console.log(`${mark} GET /api/service-desk/tickets/${ticketId} → ${r.status}`);
  }

  console.log(`\n--- ${passed} passed, ${failed} failed, ${authSkipped} auth-skipped ---`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
