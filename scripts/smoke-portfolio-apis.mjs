/**
 * Smoke-test portfolio service functions (no HTTP auth required).
 * Usage: npx tsx scripts/smoke-portfolio-apis.mjs [tenantId]
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
    console.log(`Testing portfolio APIs for org ${orgId}...`);

    const service = await import("../server/portfolio/service.ts");
    const healthHistory = await import("../server/portfolio/health-history.ts");
    const customReports = await import("../server/portfolio/custom-reports.ts");
    const pptxExport = await import("../server/portfolio/pptx-export.ts");
    const reportEmail = await import("../server/portfolio/report-email.ts");

    const {
      getPortfolioDashboard,
      getProgrammesList,
      getRoadmapData,
      getHealthMatrix,
      getMilestoneRegister,
      listPortfoliosWithLinks,
      getPortfolioSummaryReport,
      getRaidConsolidated,
      listReportSchedules,
      generate360Report,
    } = service;

    const tests = [
      ["dashboard", () => getPortfolioDashboard(orgId)],
      ["programmes", () => getProgrammesList(orgId)],
      ["roadmap", () => getRoadmapData(orgId)],
      ["health matrix", () => getHealthMatrix(orgId)],
      ["milestones", () => getMilestoneRegister(orgId)],
      ["portfolios", () => listPortfoliosWithLinks(orgId)],
      ["summary report", () => getPortfolioSummaryReport(orgId)],
      ["raid consolidated", () => getRaidConsolidated(orgId)],
      ["report schedules", () => listReportSchedules(orgId)],
      ["snapshot weeks", () => healthHistory.listHealthSnapshotWeeks(orgId)],
      ["capture snapshots", () => healthHistory.captureHealthMatrixSnapshots(orgId)],
      ["custom report fields", () => customReports.getAvailableFields("projects")],
      ["custom report run", () => customReports.runCustomReport(orgId, "projects", { fields: ["name", "rag"] })],
      ["resolve recipients", () => reportEmail.resolveRecipientEmails([])],
    ];

    let failed = 0;
    for (const [name, fn] of tests) {
      try {
        const result = await fn();
        let summary = "ok";
        if (Array.isArray(result)) summary = `${result.length} rows`;
        else if (typeof result === "object" && result !== null) {
          if ("kpis" in result) summary = "dashboard bundle";
          else if ("items" in result) summary = `${result.items?.length ?? 0} items`;
          else if ("totalRows" in result) summary = `${result.totalRows} rows`;
          else if ("saved" in result) summary = `${result.saved} saved`;
          else summary = `${Object.keys(result).length} keys`;
        } else summary = String(result);
        console.log(`  ✓ ${name}: ${summary}`);
      } catch (err) {
        failed++;
        console.error(`  ✗ ${name}:`, err?.message ?? err);
      }
    }

    // 360 report + PPTX (needs a project)
    try {
      const proj = await client.query(
        `SELECT id FROM pm_projects WHERE tenant_id = $1 ORDER BY id LIMIT 1`,
        [orgId],
      );
      const projectId = proj.rows[0]?.id;
      if (projectId) {
        const report = await generate360Report(orgId, projectId);
        console.log(`  ✓ 360 report: ${report ? "generated" : "null"}`);
        if (report) {
          const history = await healthHistory.getProjectHealthHistory(projectId, orgId, 4);
          console.log(`  ✓ health history: ${history.length} weeks`);
          const buf = await pptxExport.build360ReportPptx(pptxExport.map360ReportToPptxInput(report));
          console.log(`  ✓ pptx export: ${buf.length} bytes`);
        }
      } else {
        console.log("  · 360 report: skipped (no projects)");
      }
    } catch (err) {
      failed++;
      console.error(`  ✗ 360/pptx:`, err?.message ?? err);
    }

    console.log(failed ? `\n${failed} test(s) failed` : "\nAll portfolio API smoke tests passed");
    process.exit(failed ? 1 : 0);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
