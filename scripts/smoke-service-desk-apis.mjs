/**
 * Smoke test Service Desk module APIs.
 * Usage: npm run smoke:service-desk
 *        SMOKE_BEARER_TOKEN=<jwt> npm run smoke:service-desk
 */
import "dotenv/config";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5000";
const TENANT = process.env.SEED_TENANT_ID ?? "1";
const TOKEN = process.env.SMOKE_BEARER_TOKEN ?? "";

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

async function callEndpoint(spec, body) {
  const [method, pathWithQuery] = spec.split(" ");
  const [path, existingQuery] = pathWithQuery.split("?");
  const qs = existingQuery ? `${existingQuery}&tenantId=${TENANT}` : `tenantId=${TENANT}`;
  const url = `${BASE}${path}?${qs}`;
  const headers = { "Content-Type": "application/json" };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const init = { method, credentials: "include", headers };
  if (body && method !== "GET") init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { spec, status: res.status, ok: res.ok, size: text.length, json, text };
}

async function main() {
  console.log(`Smoke testing Service Desk APIs at ${BASE}...\n`);
  if (!TOKEN) console.log("(No SMOKE_BEARER_TOKEN — 401 = route reachable)\n");

  let passed = 0;
  let failed = 0;
  let authSkipped = 0;
  let ticketId = null;

  for (const ep of GET_ENDPOINTS) {
    try {
      const r = await callEndpoint(ep);
      if (!TOKEN && r.status === 401) {
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
    const r = await callEndpoint(`GET /api/service-desk/tickets/${ticketId}`);
    const mark = r.ok ? "✓" : "✗";
    if (r.ok) passed++; else failed++;
    console.log(`${mark} GET /api/service-desk/tickets/${ticketId} → ${r.status}`);
  }

  console.log(`\n--- ${passed} passed, ${failed} failed, ${authSkipped} auth-skipped ---`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
