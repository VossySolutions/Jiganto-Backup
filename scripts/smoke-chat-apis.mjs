/**
 * Smoke test Chat module APIs.
 * Usage: npm run smoke:chat
 */
import "dotenv/config";
import { obtainSmokeAuth, smokeCall } from "./smoke-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5000";

const GET_ENDPOINTS = [
  "GET /api/chat/config",
  "GET /api/chat/inbox",
  "GET /api/chat/channels",
  "GET /api/chat/projects",
  "GET /api/chat/projects/user",
  "GET /api/chat/dm",
  "GET /api/chat/favorites",
  "GET /api/chat/users",
];

async function callEndpoint(spec, auth) {
  const [method, pathWithQuery] = spec.split(" ");
  const r = await smokeCall(BASE, method, pathWithQuery, auth);
  return { spec, status: r.status, ok: r.status >= 200 && r.status < 300, json: r.json, text: r.text };
}

async function main() {
  console.log(`Smoke testing Chat APIs at ${BASE}...\n`);
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
    const preview = Array.isArray(r.json) ? `[${r.json.length}]` : r.json?.channels ? "{inbox}" : "ok";
    console.log(`${mark} ${ep} → ${r.status} ${preview}`);
  }

  const noAuth = await callEndpoint("GET /api/chat/inbox", {});
  if (noAuth.status === 401 || noAuth.status === 403) {
    passed++;
    console.log(`✓ GET /api/chat/inbox (no auth → ${noAuth.status})`);
  } else {
    failed++;
    console.log(`✗ GET /api/chat/inbox (no auth → ${noAuth.status})`);
  }

  console.log(`\n--- ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
