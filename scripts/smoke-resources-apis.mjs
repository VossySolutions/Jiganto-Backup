/**
 * Smoke-test resources service functions (no HTTP auth required).
 * Usage: npx tsx scripts/smoke-resources-apis.mjs [tenantId]
 */
import "dotenv/config";
import pg from "pg";

const tenantId = process.argv[2] ? Number(process.argv[2]) : null;

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    let orgId = tenantId;
    if (!orgId) {
      const r = await client.query(`SELECT id FROM tenants ORDER BY id LIMIT 1`);
      orgId = r.rows[0]?.id;
    }
    if (!orgId) {
      console.error("No organization found");
      process.exit(1);
    }
    console.log(`Testing resources APIs for org ${orgId}...`);

    const {
      getExtendedResourceStats,
      getUtilisationTrend,
      getCapacityVsDemand,
      getSkillsDemandHeatmap,
      getResourceOrgTree,
      getAllResourceSkillsMap,
      getPipelineView,
      listLeaves,
      listTimesheetIntegrations,
      listIntegrationLogs,
      searchResourcesBySkills,
      exportTimesheetsCsv,
    } = await import("../server/resources/service.ts");

    const tests = [
      ["extended stats", () => getExtendedResourceStats(orgId)],
      ["utilisation trend", () => getUtilisationTrend(orgId, 12)],
      ["capacity vs demand", () => getCapacityVsDemand(orgId, 8)],
      ["skills heatmap", () => getSkillsDemandHeatmap(orgId, 8)],
      ["skills map", () => getAllResourceSkillsMap(orgId)],
      ["pipeline view", () => getPipelineView(orgId)],
      ["leaves", () => listLeaves(orgId)],
      ["timesheet integrations", () => listTimesheetIntegrations(orgId)],
      ["integration log", () => listIntegrationLogs(orgId)],
      ["skills search", () => searchResourcesBySkills(orgId, [], "and")],
      ["timesheet csv export", () => exportTimesheetsCsv(orgId, { format: "standard" })],
      ["org chart", () => getResourceOrgTree(orgId)],
    ];

    let failed = 0;
    for (const [name, fn] of tests) {
      try {
        const result = await fn();
        let summary = "ok";
        if (Array.isArray(result)) summary = `${result.length} rows`;
        else if (typeof result === "object" && result !== null) {
          if ("stats" in result) summary = "dashboard bundle";
          else if ("items" in result) summary = `${result.items?.length ?? 0} items`;
          else summary = `${Object.keys(result).length} keys`;
        } else summary = String(result);
        console.log(`  ✓ ${name}: ${summary}`);
      } catch (err) {
        failed++;
        console.error(`  ✗ ${name}:`, err?.message ?? err);
      }
    }

    console.log(failed ? `\n${failed} test(s) failed` : "\nAll resources API smoke tests passed");
    process.exit(failed ? 1 : 0);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
