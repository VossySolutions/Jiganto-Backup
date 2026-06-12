/**
 * Smoke-test finance repository functions (no HTTP auth required).
 * Usage: node scripts/smoke-finance-apis.mjs [tenantId]
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
    console.log(`Testing finance APIs for org ${orgId}...`);

    const { loadFinanceDashboard, listProjectBudgets, listTimesheetPeriods, listExpenseReports, listInvoices, listRateCards, listErpIntegrations, getOrCreateFinanceSettings, getUtilisationReport, getMissingTimesheetsReport } = await import("../server/finance/repository.ts");

    const tests = [
      ["dashboard", () => loadFinanceDashboard(orgId)],
      ["budgets", () => listProjectBudgets(orgId)],
      ["timesheet periods", () => listTimesheetPeriods(orgId)],
      ["expense reports", () => listExpenseReports(orgId)],
      ["invoices", () => listInvoices(orgId)],
      ["rate cards", () => listRateCards(orgId)],
      ["erp integrations", () => listErpIntegrations(orgId)],
      ["settings", () => getOrCreateFinanceSettings(orgId)],
      ["utilisation report", () => getUtilisationReport(orgId)],
      ["missing timesheets", () => getMissingTimesheetsReport(orgId, new Date().toISOString().slice(0, 10))],
    ];

    let failed = 0;
    for (const [name, fn] of tests) {
      try {
        const result = await fn();
        const summary = Array.isArray(result) ? `${result.length} rows` : typeof result === "object" ? "ok" : String(result);
        console.log(`  ✓ ${name}: ${summary}`);
      } catch (err) {
        failed++;
        console.error(`  ✗ ${name}:`, err?.message ?? err);
      }
    }

    console.log(failed ? `\n${failed} test(s) failed` : "\nAll finance API smoke tests passed");
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
