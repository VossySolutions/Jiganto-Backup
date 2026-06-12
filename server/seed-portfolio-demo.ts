/**
 * Seed Portfolio module demo: portfolios, programmes, milestones, RAID, health snapshots, schedules.
 * Run after db:seed-finance (users + projects).
 *
 * Usage: npm run db:seed-portfolio
 *        FORCE=1 npm run db:seed-portfolio
 */
import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  pmProjects,
  pmPortfolios,
  pmPrograms,
  pmProjectPortfolios,
  pmMilestones,
  pmRaiddItems,
  pmReportSchedules,
  pmCustomReports,
  pmHealthMatrixSnapshots,
} from "@shared/schema";
import { captureHealthMatrixSnapshots } from "./portfolio/health-history";

const TENANT_ID = Number(process.env.SEED_TENANT_ID ?? 1);
const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekStartMonday(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

async function main() {
  console.log(`Seeding portfolio demo for tenant ${TENANT_ID}...`);

  const [user] = await db.select().from(users).limit(1);
  const userId = user?.id ?? null;

  let projects = await db.select().from(pmProjects).where(eq(pmProjects.tenantId, TENANT_ID)).limit(6);
  if (projects.length < 2) {
    const names = [
      { name: "ERP Modernisation", code: "PF-ERP-01", rag: "amber", progress: 62 },
      { name: "Cloud Migration Phase 2", code: "PF-CLOUD-02", rag: "green", progress: 45 },
      { name: "Digital Transformation", code: "PF-DX-03", rag: "red", progress: 28 },
    ];
    for (const p of names) {
      const [row] = await db
        .insert(pmProjects)
        .values({
          tenantId: TENANT_ID,
          name: p.name,
          code: p.code,
          status: "active",
          ragStatus: p.rag,
          progress: p.progress,
          scheduleRag: p.rag,
          financialRag: p.rag === "red" ? "amber" : "green",
          managerId: userId,
          ownerId: userId,
          projectManager: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : null,
          startDate: daysAgo(120),
          endDate: daysFromNow(200),
          budget: "350000",
          spentBudget: String(Math.round(350000 * (p.progress / 100) * 0.9)),
        })
        .returning();
      projects.push(row);
    }
  }

  // Portfolios
  const existingPortfolios = await db.select().from(pmPortfolios).where(eq(pmPortfolios.tenantId, TENANT_ID));
  let portfolios = existingPortfolios;
  if (existingPortfolios.length < 2 || FORCE) {
    if (FORCE && existingPortfolios.length) {
      console.log("  FORCE=1 — adding portfolios alongside existing");
    }
    const defs = [
      { name: "Transformation Portfolio", colour: "#7C3AED", rag: "amber", budget: "1200000" },
      { name: "Run & Sustain", colour: "#0EA5E9", rag: "green", budget: "450000" },
    ];
    for (const def of defs) {
      if (!FORCE && existingPortfolios.find((p) => p.name === def.name)) continue;
      const [pf] = await db
        .insert(pmPortfolios)
        .values({
          tenantId: TENANT_ID,
          name: def.name,
          description: `Demo portfolio — ${def.name}`,
          ownerId: userId,
          status: "active",
          ragStatus: def.rag,
          colour: def.colour,
          budget: def.budget,
          spentBudget: String(Number(def.budget) * 0.42),
          startDate: daysAgo(180),
          endDate: daysFromNow(365),
        })
        .returning();
      portfolios.push(pf);
    }
  }

  const transformPf = portfolios.find((p) => p.name.includes("Transformation")) || portfolios[0];
  const sustainPf = portfolios.find((p) => p.name.includes("Sustain")) || portfolios[1] || portfolios[0];

  // Programme
  let [program] = await db
    .select()
    .from(pmPrograms)
    .where(and(eq(pmPrograms.tenantId, TENANT_ID), eq(pmPrograms.name, "Enterprise Modernisation Programme")))
    .limit(1);

  if (!program || FORCE) {
    [program] = await db
      .insert(pmPrograms)
      .values({
        tenantId: TENANT_ID,
        portfolioId: transformPf?.id,
        name: "Enterprise Modernisation Programme",
        description: "Cross-cutting ERP, cloud and digital initiatives",
        ownerId: userId,
        status: "active",
        ragStatus: "amber",
        budget: "900000",
        spentBudget: "380000",
        startDate: daysAgo(150),
        endDate: daysFromNow(300),
      })
      .returning();
  }

  // Link projects to portfolios + programme
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const portfolioId = i < 2 ? transformPf?.id : sustainPf?.id;
    await db
      .update(pmProjects)
      .set({
        portfolioId: portfolioId ?? null,
        programId: i < 3 ? program?.id : null,
        updatedAt: new Date(),
      })
      .where(eq(pmProjects.id, p.id));

    if (portfolioId) {
      const [link] = await db
        .select()
        .from(pmProjectPortfolios)
        .where(and(eq(pmProjectPortfolios.projectId, p.id), eq(pmProjectPortfolios.portfolioId, portfolioId)))
        .limit(1);
      if (!link) {
        await db.insert(pmProjectPortfolios).values({ projectId: p.id, portfolioId });
      }
    }
  }

  // Milestones
  const milestoneCount = await db.select().from(pmMilestones).where(eq(pmMilestones.tenantId, TENANT_ID));
  if (milestoneCount.length < 3 || FORCE) {
    const defs = [
      { ref: "MS-001", name: "Architecture sign-off", project: projects[0], rag: "green", days: 14 },
      { ref: "MS-002", name: "UAT complete", project: projects[0], rag: "amber", days: 45 },
      { ref: "MS-003", name: "Go-live readiness", project: projects[1], rag: "green", days: 60 },
      { ref: "MS-004", name: "Phase 2 kick-off", project: projects[2] || projects[0], rag: "red", days: -5 },
    ];
    for (const m of defs) {
      if (!m.project) continue;
      const [exists] = await db
        .select()
        .from(pmMilestones)
        .where(and(eq(pmMilestones.tenantId, TENANT_ID), eq(pmMilestones.ref, m.ref)))
        .limit(1);
      if (exists && !FORCE) continue;
      if (exists && FORCE) {
        await db.delete(pmMilestones).where(eq(pmMilestones.id, exists.id));
      }
      await db.insert(pmMilestones).values({
        tenantId: TENANT_ID,
        projectId: m.project.id,
        ref: m.ref,
        name: m.name,
        targetDate: daysFromNow(m.days),
        dueDate: daysFromNow(m.days),
        status: m.days < 0 ? "overdue" : "pending",
        ragStatus: m.rag,
        ownerId: userId,
      });
    }
  }

  // RAID items
  const raidCount = await db.select().from(pmRaiddItems).where(eq(pmRaiddItems.tenantId, TENANT_ID));
  if (raidCount.length < 2 || FORCE) {
    const p0 = projects[0];
    const items = [
      { type: "risk", code: "R-001", title: "Key SME availability", priority: "high", score: 16 },
      { type: "issue", code: "I-001", title: "Integration test environment unstable", priority: "critical" },
      { type: "assumption", code: "A-001", title: "Vendor delivers API v2 by Q3", priority: "medium" },
      { type: "dependency", code: "D-001", title: "Identity platform upgrade", priority: "high" },
    ];
    for (const item of items) {
      const [exists] = await db
        .select()
        .from(pmRaiddItems)
        .where(and(eq(pmRaiddItems.tenantId, TENANT_ID), eq(pmRaiddItems.code, item.code)))
        .limit(1);
      if (exists && !FORCE) continue;
      if (exists && FORCE) await db.delete(pmRaiddItems).where(eq(pmRaiddItems.id, exists.id));
      await db.insert(pmRaiddItems).values({
        tenantId: TENANT_ID,
        projectId: p0.id,
        type: item.type,
        code: item.code,
        title: item.title,
        status: "open",
        priority: item.priority,
        score: "score" in item ? item.score : null,
        ownerId: userId,
      });
    }
  }

  // Health snapshots (current + 3 prior weeks for trends)
  if (FORCE) {
    await db.delete(pmHealthMatrixSnapshots).where(eq(pmHealthMatrixSnapshots.tenantId, TENANT_ID));
  }
  await captureHealthMatrixSnapshots(TENANT_ID);
  const snapWeeks = await db
    .selectDistinct({ week: pmHealthMatrixSnapshots.snapshotWeek })
    .from(pmHealthMatrixSnapshots)
    .where(eq(pmHealthMatrixSnapshots.tenantId, TENANT_ID));
  if (snapWeeks.length < 4 || FORCE) {
    for (let w = 1; w <= 3; w++) {
      const d = new Date();
      d.setDate(d.getDate() - w * 7);
      const week = weekStartMonday(d);
      for (const p of projects.slice(0, 3)) {
        const [exists] = await db
          .select()
          .from(pmHealthMatrixSnapshots)
          .where(and(eq(pmHealthMatrixSnapshots.projectId, p.id), eq(pmHealthMatrixSnapshots.snapshotWeek, week)))
          .limit(1);
        if (exists) continue;
        const score = 100 - w * 8 - (p.ragStatus === "red" ? 20 : p.ragStatus === "amber" ? 10 : 0);
        await db.insert(pmHealthMatrixSnapshots).values({
          tenantId: TENANT_ID,
          projectId: p.id,
          snapshotWeek: week,
          overall: p.ragStatus || "green",
          schedule: p.scheduleRag || p.ragStatus || "green",
          budget: p.financialRag || "green",
          quality: "green",
          delivery: p.ragStatus || "green",
          risk: p.ragStatus === "red" ? "red" : "amber",
          resources: "green",
          stakeholders: "green",
          healthScore: Math.max(20, score),
        });
      }
    }
  }

  // Report schedule (weekly portfolio summary)
  const schedCount = await db.select().from(pmReportSchedules).where(eq(pmReportSchedules.tenantId, TENANT_ID));
  if (schedCount.length < 1 || FORCE) {
    if (userId) {
      await db.insert(pmReportSchedules).values({
        tenantId: TENANT_ID,
        reportType: "portfolio_summary",
        frequency: "weekly",
        dayOfWeek: 1,
        format: "pdf",
        recipientIds: [userId],
        createdBy: userId,
      });
    }
  }

  // Custom report definition
  const customCount = await db.select().from(pmCustomReports).where(eq(pmCustomReports.tenantId, TENANT_ID));
  if (customCount.length < 1 || FORCE) {
    await db.insert(pmCustomReports).values({
      tenantId: TENANT_ID,
      name: "At-risk projects",
      description: "Projects with amber or red RAG",
      dataSource: "projects",
      config: {
        fields: ["name", "client", "pm", "rag", "progress", "portfolios"],
        filters: { rag: "amber" },
        sortBy: { field: "progress", direction: "asc" },
      },
      createdBy: userId,
    });
  }

  console.log("\nPortfolio demo seed complete:");
  console.log(`  • ${portfolios.length} portfolios`);
  console.log(`  • ${projects.length} projects linked`);
  console.log(`  • Programme: ${program?.name}`);
  console.log(`  • Milestones, RAID, health snapshots, schedule & custom report`);
  console.log("\nOpen /modules/portfolio to view the data.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Portfolio seed failed:", err);
  process.exit(1);
});
