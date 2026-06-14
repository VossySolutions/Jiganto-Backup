/**
 * Smoke test Resource Planning APIs.
 * Usage: SMOKE_BEARER_TOKEN=<jwt> npm run smoke:resource-planning
 */
import "dotenv/config";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5000";
const TENANT = process.env.SEED_TENANT_ID ?? "1";
const TOKEN = process.env.SMOKE_BEARER_TOKEN ?? "";

const ENDPOINTS = [
  "GET /api/resource-planning/dashboard?persona=res-mgr",
  "GET /api/resource-planning/demand-supply?includePipeline=true&persona=res-mgr",
  "GET /api/resource-planning/heatmap?weeks=8&persona=res-mgr",
  "GET /api/resource-planning/scheduler?weeks=8&persona=res-mgr",
  "GET /api/resource-planning/skills-inventory?persona=res-mgr",
  "GET /api/resource-planning/pipeline?scenario=expected&persona=res-mgr",
  "GET /api/resource-planning/recruitment?persona=res-mgr",
  "GET /api/resource-planning/bench?persona=res-mgr",
  "GET /api/resource-planning/scenarios?persona=res-mgr",
  "GET /api/resource-planning/ai/insights?persona=res-mgr",
  "GET /api/resource-planning/demand-supply/export?format=pdf&persona=res-mgr",
  "GET /api/resource-planning/recruitment/export?format=pdf&persona=hr",
];

async function fetchEndpoint(spec) {
  const [method, path] = spec.split(" ");
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}tenantId=${TENANT}`;
  const headers = {};
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(url, { method, credentials: "include", headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { spec, status: res.status, ok: res.ok, size: text.length, keys: json ? Object.keys(json).slice(0, 5) : [] };
}

async function main() {
  console.log(`Smoke testing Resource Planning APIs at ${BASE}...`);
  if (!TOKEN) console.log("(No SMOKE_BEARER_TOKEN — expecting 401 unless session cookie present)\n");
  let passed = 0;
  let failed = 0;
  for (const ep of ENDPOINTS) {
    try {
      const r = await fetchEndpoint(ep);
      const mark = r.ok ? "✓" : "✗";
      if (r.ok) passed++; else failed++;
      console.log(`${mark} ${r.spec} → ${r.status} (${r.size}b) ${r.keys.length ? `[${r.keys.join(", ")}]` : ""}`);
    } catch (e) {
      failed++;
      console.log(`✗ ${ep} → ERROR: ${e.message}`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
