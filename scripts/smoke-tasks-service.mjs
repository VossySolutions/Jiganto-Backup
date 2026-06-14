/**
 * Smoke-test Tasks service functions directly (no HTTP auth required).
 * Usage: npx tsx scripts/smoke-tasks-service.mjs [tenantId]
 */
import "dotenv/config";
import pg from "pg";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    let tenantId = process.argv[2] ? Number(process.argv[2]) : null;
    if (!tenantId) {
      const r = await client.query(`SELECT id FROM tenants ORDER BY id LIMIT 1`);
      tenantId = r.rows[0]?.id;
    }
    if (!tenantId) {
      console.error("No tenant found");
      process.exit(1);
    }

    const userRes = await client.query(
      `SELECT user_id AS id FROM org_memberships WHERE org_id = $1 AND is_active = true ORDER BY user_id LIMIT 1`,
      [tenantId],
    );
    const userId = userRes.rows[0]?.id;
    if (!userId) {
      console.error(`No user found for tenant ${tenantId}`);
      process.exit(1);
    }

    console.log(`Testing Tasks service for tenant ${tenantId}, user ${userId}...\n`);

    const service = await import("../server/tasks/service.ts");
    const ai = await import("../server/tasks/ai.ts");

    const scope = { userId, tenantId, platformRole: "org_admin", isJigantoStaff: false, lockedWorkspaceId: null };

    const tests = [
      ["listAggregatedTasks", () => service.listAggregatedTasks(scope, {})],
      ["summarizeTasks", async () => {
        const items = await service.listAggregatedTasks(scope, {});
        return service.summarizeTasks(items);
      }],
      ["listAccessibleWorkspaces", () => service.listAccessibleWorkspaces(scope)],
      ["listAccessibleProjects", () => service.listAccessibleProjects(scope)],
      ["detectDueDateFromTitle", () => service.detectDueDateFromTitle("Follow up on Friday")],
      ["prioritizeTasks", () => ai.prioritizeTasks(scope)],
      ["summariseWeek", () => ai.summariseWeek(scope)],
      ["createTasksFromText", () => ai.createTasksFromText(scope, "- Review proposal\n- Send timesheet")],
      ["createPersonalTask", () =>
        service.createPersonalTask(scope, {
          title: `Smoke service task ${Date.now()}`,
          source: "personal",
          isPersonal: true,
          priority: "medium",
        }),
      ],
    ];

    let failed = 0;
    let createdNativeId = null;

    for (const [name, fn] of tests) {
      try {
        const result = await fn();
        let summary = "ok";
        if (Array.isArray(result)) summary = `${result.length} items`;
        else if (typeof result === "object" && result !== null) {
          if ("id" in result) {
            summary = `id=${result.id}`;
            if (name === "createPersonalTask") createdNativeId = result.nativeId ?? result.id;
          } else if ("orderedIds" in result) summary = `${result.orderedIds?.length ?? 0} ordered`;
          else if ("summary" in result) summary = `${String(result.summary).slice(0, 40)}…`;
          else if ("parsed" in result) summary = `${result.parsed?.length ?? 0} parsed`;
          else summary = `${Object.keys(result).length} keys`;
        } else summary = String(result);
        console.log(`  ✓ ${name}: ${summary}`);
      } catch (err) {
        failed++;
        console.error(`  ✗ ${name}:`, err?.message ?? err);
      }
    }

    if (createdNativeId) {
      try {
        await service.getTaskComments(createdNativeId);
        await service.addTaskComment(createdNativeId, userId, "Smoke test comment");
        await service.getTaskTimeLogs(createdNativeId);
        await service.addTaskTimeLog(createdNativeId, userId, 0.5, "Smoke");
        await service.getTaskAttachments(createdNativeId);
        await service.deleteNativeTask(scope, createdNativeId);
        console.log(`  ✓ sub-resources + delete: native ${createdNativeId}`);
      } catch (err) {
        failed++;
        console.error(`  ✗ sub-resources:`, err?.message ?? err);
      }
    }

    console.log(`\n${tests.length + (createdNativeId ? 1 : 0) - failed} passed, ${failed} failed`);
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
