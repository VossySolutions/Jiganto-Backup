/**
 * Smoke test Workspaces module APIs.
 * Usage: SMOKE_BEARER_TOKEN=<jwt> npm run smoke:workspaces
 */
import "dotenv/config";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5000";
const TENANT = process.env.SEED_TENANT_ID ?? "1";
const TOKEN = process.env.SMOKE_BEARER_TOKEN ?? "";

const ENDPOINTS = [
  "GET /api/workspaces",
  "GET /api/workspaces/list?filter=all",
  "GET /api/workspaces/list?filter=favorites",
  "GET /api/workspaces/list?filter=recent",
  "GET /api/workspaces/list?filter=shared",
  "GET /api/workspaces/list?filter=mine",
  "GET /api/workspace-templates",
  "GET /api/workspace-pages/favorites",
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
  return { spec, status: res.status, ok: res.ok, size: text.length, json };
}

async function main() {
  console.log(`Smoke testing Workspaces APIs at ${BASE}...\n`);
  if (!TOKEN) console.log("(No SMOKE_BEARER_TOKEN — expecting 401 unless session cookie present)\n");

  let passed = 0;
  let failed = 0;
  let authSkipped = 0;
  let workspaceId = null;

  for (const ep of ENDPOINTS) {
    try {
      const r = await callEndpoint(ep);
      if (!TOKEN && r.status === 401) {
        authSkipped++;
        console.log(`○ ${r.spec} → 401 (auth required — route reachable)`);
        continue;
      }
      const mark = r.ok ? "✓" : "✗";
      if (r.ok) passed++; else failed++;
      const preview = Array.isArray(r.json) ? `[${r.json.length} items]` : r.json && typeof r.json === "object" ? `{${Object.keys(r.json).slice(0, 4).join(", ")}}` : "";
      console.log(`${mark} ${r.spec} → ${r.status} (${r.size}b) ${preview}`);
      if (ep === "GET /api/workspaces" && Array.isArray(r.json) && r.json[0]?.id) {
        workspaceId = r.json[0].id;
      }
    } catch (e) {
      failed++;
      console.log(`✗ ${ep} → ERROR: ${e.message}`);
    }
  }

  if (workspaceId) {
    const nested = [
      `GET /api/workspaces/${workspaceId}/pages`,
      `GET /api/workspaces/${workspaceId}/members`,
      `GET /api/workspaces/${workspaceId}/members-with-users`,
      `GET /api/workspaces/${workspaceId}/presence`,
    ];
    for (const ep of nested) {
      try {
        const r = await callEndpoint(ep);
        if (!TOKEN && r.status === 401) {
          authSkipped++;
          console.log(`○ ${r.spec} → 401 (auth required — route reachable)`);
          continue;
        }
        const mark = r.ok ? "✓" : "✗";
        if (r.ok) passed++; else failed++;
        const preview = Array.isArray(r.json) ? `[${r.json.length} items]` : "";
        console.log(`${mark} ${r.spec} → ${r.status} (${r.size}b) ${preview}`);
      } catch (e) {
        failed++;
        console.log(`✗ ${ep} → ERROR: ${e.message}`);
      }
    }
  } else if (TOKEN) {
    console.log("\n(no workspace id found — skipping nested workspace routes)");
  }

  console.log(`\n--- Summary ---`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (authSkipped) console.log(`Auth skipped (401): ${authSkipped}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
