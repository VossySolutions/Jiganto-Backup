/**
 * Smoke test Projects / PM module APIs.
 * Usage: npm run smoke:projects
 */
import "dotenv/config";
import { obtainSmokeAuth, smokeCall } from "./smoke-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5000";

const GET_ENDPOINTS = [
  "GET /api/pm/projects",
  "GET /api/pm/programs",
  "GET /api/pm/portfolios",
];

async function callEndpoint(spec, auth) {
  const [method, pathWithQuery] = spec.split(" ");
  const r = await smokeCall(BASE, method, pathWithQuery, auth);
  return { spec, status: r.status, ok: r.status >= 200 && r.status < 300, json: r.json, text: r.text };
}

async function main() {
  console.log(`Smoke testing Projects APIs at ${BASE}...\n`);
  const auth = await obtainSmokeAuth(BASE);
  if (!auth.bearer && !auth.cookie) {
    console.error("No auth available.");
    process.exit(1);
  }
  console.log(`Auth via: ${auth.via}\n`);

  let passed = 0;
  let failed = 0;
  let projectId = null;

  for (const ep of GET_ENDPOINTS) {
    const r = await callEndpoint(ep, auth);
    const mark = r.ok ? "✓" : "✗";
    if (r.ok) passed++; else failed++;
    const preview = Array.isArray(r.json) ? `[${r.json.length}]` : "ok";
    console.log(`${mark} ${ep} → ${r.status} ${preview}`);
    if (ep === "GET /api/pm/projects" && Array.isArray(r.json) && r.json[0]?.id) {
      projectId = r.json[0].id;
    }
  }

  if (projectId) {
    for (const ep of [
      `GET /api/pm/projects/${projectId}`,
      `GET /api/pm/projects/${projectId}/tools`,
      `GET /api/pm/projects/${projectId}/agile/workstreams`,
      `GET /api/pm/projects/${projectId}/agile/dashboard`,
    ]) {
      const r = await callEndpoint(ep, auth);
      const mark = r.ok ? "✓" : "✗";
      if (r.ok) passed++; else failed++;
      console.log(`${mark} ${ep} → ${r.status}`);
    }
  }

  const noAuth = await callEndpoint("GET /api/pm/projects", {});
  if (noAuth.status === 401 || noAuth.status === 403) {
    passed++;
    console.log(`✓ GET /api/pm/projects (no auth → ${noAuth.status})`);
  } else {
    failed++;
    console.log(`✗ GET /api/pm/projects (no auth → ${noAuth.status})`);
  }

  console.log(`\n--- ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
