/**
 * Smoke test Tasks module APIs.
 * Usage: SMOKE_BEARER_TOKEN=<jwt> npm run smoke:tasks
 */
import "dotenv/config";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5000";
const TENANT = process.env.SEED_TENANT_ID ?? "1";
const TOKEN = process.env.SMOKE_BEARER_TOKEN ?? "";

const ENDPOINTS = [
  "GET /api/tasks",
  "GET /api/tasks/summary",
  "GET /api/tasks/meta/workspaces",
  "GET /api/tasks/meta/projects",
  "GET /api/tasks/views",
  "GET /api/tasks/boards",
  "POST /api/tasks/ai/detect-due-date",
  "POST /api/tasks/ai/prioritize",
  "POST /api/tasks/ai/summarise-week",
];

async function callEndpoint(spec, body) {
  const [method, path] = spec.split(" ");
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}tenantId=${TENANT}`;
  const headers = { "Content-Type": "application/json" };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const init = { method, credentials: "include", headers };
  if (body && method !== "GET") init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { spec, status: res.status, ok: res.ok, size: text.length, json };
}

async function main() {
  console.log(`Smoke testing Tasks APIs at ${BASE}...\n`);
  if (!TOKEN) console.log("(No SMOKE_BEARER_TOKEN — expecting 401 unless session cookie present)\n");

  let passed = 0;
  let failed = 0;
  let authSkipped = 0;
  let createdId = null;

  for (const ep of ENDPOINTS) {
    const body =
      ep.includes("detect-due-date") ? { title: "Follow up on Friday" }
      : ep.includes("from-text") ? { text: "- Review proposal\n- Send timesheet" }
      : undefined;
    try {
      const r = await callEndpoint(ep, body);
      if (!TOKEN && r.status === 401) {
        authSkipped++;
        console.log(`○ ${r.spec} → 401 (auth required — route reachable)`);
        continue;
      }
      const mark = r.ok ? "✓" : "✗";
      if (r.ok) passed++; else failed++;
      const preview = Array.isArray(r.json) ? `[${r.json.length} items]` : r.json && typeof r.json === "object" ? `{${Object.keys(r.json).slice(0, 4).join(", ")}}` : "";
      console.log(`${mark} ${r.spec} → ${r.status} (${r.size}b) ${preview}`);
    } catch (e) {
      failed++;
      console.log(`✗ ${ep} → ERROR: ${e.message}`);
    }
  }

  try {
    const create = await callEndpoint("POST /api/tasks", {
      title: `Smoke test task ${Date.now()}`,
      source: "personal",
      isPersonal: true,
      priority: "medium",
    });
    if (!TOKEN && create.status === 401) {
      authSkipped++;
      console.log(`○ POST /api/tasks → 401 (auth required — route reachable)`);
    } else if (create.ok && create.json?.id) {
      createdId = create.json.id;
      passed++;
      console.log(`✓ POST /api/tasks → ${create.status} (created ${createdId})`);
    } else {
      failed++;
      console.log(`✗ POST /api/tasks → ${create.status}`);
    }
  } catch (e) {
    failed++;
    console.log(`✗ POST /api/tasks → ERROR: ${e.message}`);
  }

  if (createdId) {
    for (const ep of [
      [`GET /api/tasks/${createdId}`, null],
      [`PUT /api/tasks/${createdId}`, { status: "in_progress" }],
      [`GET /api/tasks/${createdId}/subtasks`, null],
      [`POST /api/tasks/${createdId}/subtasks`, { title: "Sub item" }],
      [`POST /api/tasks/${createdId}/comments`, { body: "Smoke comment" }],
      [`POST /api/tasks/${createdId}/time-logs`, { hours: 1.5, notes: "Smoke" }],
    ]) {
      try {
        const r = await callEndpoint(ep[0], ep[1]);
        const mark = r.ok ? "✓" : "✗";
        if (r.ok) passed++; else failed++;
        console.log(`${mark} ${ep[0]} → ${r.status}`);
      } catch (e) {
        failed++;
        console.log(`✗ ${ep[0]} → ERROR: ${e.message}`);
      }
    }
    try {
      const del = await callEndpoint(`DELETE /api/tasks/${createdId}`, null);
      if (del.ok || del.status === 204) { passed++; console.log(`✓ DELETE /api/tasks/${createdId} → ${del.status}`); }
      else { failed++; console.log(`✗ DELETE /api/tasks/${createdId} → ${del.status}`); }
    } catch (e) {
      failed++;
      console.log(`✗ DELETE → ERROR: ${e.message}`);
    }
  }

  console.log(`\n${passed} passed, ${authSkipped} auth-skipped (set SMOKE_BEARER_TOKEN for full run), ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
