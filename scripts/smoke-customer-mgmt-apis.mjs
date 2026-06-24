/**
 * Smoke test Customer Management (commercial) module APIs.
 * Usage: npm run smoke:customer-mgmt
 */
import "dotenv/config";
import { obtainSmokeAuth, smokeCall } from "./smoke-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5000";

const GET_ENDPOINTS = [
  "GET /api/customer-mgmt/status",
  "GET /api/customer-mgmt/dashboard",
];

async function callEndpoint(spec, auth) {
  const [method, pathWithQuery] = spec.split(" ");
  const r = await smokeCall(BASE, method, pathWithQuery, auth);
  return { spec, status: r.status, ok: r.status >= 200 && r.status < 300, json: r.json, text: r.text };
}

async function main() {
  console.log(`Smoke testing Customer Management APIs at ${BASE}...\n`);
  const auth = await obtainSmokeAuth(BASE);
  if (!auth.bearer && !auth.cookie) {
    console.error("No auth available.");
    process.exit(1);
  }
  console.log(`Auth via: ${auth.via}\n`);

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const ep of GET_ENDPOINTS) {
    const r = await callEndpoint(ep, auth);
    if (r.status === 403) {
      skipped++;
      console.log(`○ ${ep} → 403 (requires Jiganto commercial admin — route reachable)`);
      continue;
    }
    const mark = r.ok ? "✓" : "✗";
    if (r.ok) passed++; else failed++;
    const preview = r.json?.overview ? "{dashboard}" : r.json?.enabled != null ? "{status}" : "ok";
    console.log(`${mark} ${ep} → ${r.status} ${preview}`);
  }

  console.log(`\n--- ${passed} passed, ${failed} failed, ${skipped} skipped ---`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
