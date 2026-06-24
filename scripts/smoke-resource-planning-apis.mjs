/**
 * Smoke test Resource Planning APIs.
 * Usage: npm run smoke:resource-planning
 */
import "dotenv/config";
import { obtainSmokeAuth, smokeCall } from "./smoke-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:5000";

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

async function main() {
  console.log(`Smoke testing Resource Planning APIs at ${BASE}...`);
  const auth = await obtainSmokeAuth(BASE);
  if (!auth.bearer && !auth.cookie) {
    console.error("No auth — set SMOKE_BEARER_TOKEN or start dev server with dev login enabled.");
    process.exit(1);
  }
  console.log(`Auth: ${auth.via}\n`);

  let passed = 0;
  let failed = 0;
  for (const spec of ENDPOINTS) {
    const [method, path] = spec.split(" ");
    try {
      const r = await smokeCall(BASE, method, path, auth);
      const ok = r.status >= 200 && r.status < 300;
      if (ok) passed++; else failed++;
      const keys = r.json && typeof r.json === "object" ? Object.keys(r.json).slice(0, 5) : [];
      console.log(`${ok ? "✓" : "✗"} ${spec} → ${r.status} ${keys.length ? `[${keys.join(", ")}]` : r.text.slice(0, 80)}`);
    } catch (e) {
      failed++;
      console.log(`✗ ${spec} → ERROR: ${e.message}`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
