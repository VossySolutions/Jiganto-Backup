/**
 * Seed Resources module demo: org chart, skills matrix, contractor portal, integrations.
 * Run after db:seed-finance (or any seed with users + projects).
 *
 * Usage: npx tsx server/seed-resources-demo.ts
 *        FORCE=1 npx tsx server/seed-resources-demo.ts
 */
import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  resources,
  skillCategories,
  skills,
  resourceSkills,
  resourceAllocations,
  resourceLeaves,
  timesheetIntegrations,
  timesheetPeriods,
  documents,
  documentResourceLinks,
  pmProjects,
} from "@shared/schema";
import {
  createTimesheetPeriod,
  upsertTimesheetEntry,
  submitTimesheetPeriod,
} from "./finance/repository";

const TENANT_ID = Number(process.env.SEED_TENANT_ID ?? 1);
const FORCE = process.env.FORCE === "1";

function weeksAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

async function ensureBulkApprovalTimesheets(
  resourceIds: Record<string, number>,
  project: { id: number; name: string } | undefined,
) {
  if (!project) return;

  const submitted = await db
    .select()
    .from(timesheetPeriods)
    .where(and(eq(timesheetPeriods.tenantId, TENANT_ID), eq(timesheetPeriods.status, "submitted")));

  if (submitted.length >= 3 && !FORCE) {
    console.log(`  Pending timesheets: ${submitted.length} already submitted (bulk-approval demo ready)`);
    return;
  }

  const targets = [
    { key: "jordan", role: "Business Analyst" },
    { key: "taylor", role: "Developer" },
    { key: "riley", role: "UX Contractor" },
  ] as const;

  let created = 0;
  for (const t of targets) {
    const resourceId = resourceIds[t.key];
    if (!resourceId) continue;

    const [alreadyPending] = await db.select().from(timesheetPeriods).where(and(
      eq(timesheetPeriods.tenantId, TENANT_ID),
      eq(timesheetPeriods.resourceId, resourceId),
      eq(timesheetPeriods.status, "submitted"),
    )).limit(1);

    if (alreadyPending) continue;

    const weekStart = weeksAgo(1 + created);
    const period = await createTimesheetPeriod(TENANT_ID, {
      resourceId,
      weekStartDate: weekStart,
    });
    if (!period) continue;

    for (const day of [1, 2, 3, 4, 5]) {
      await upsertTimesheetEntry(TENANT_ID, period.id, {
        resourceId,
        projectId: project.id,
        projectName: project.name,
        dayOfWeek: day,
        hours: t.key === "riley" ? "7" : "8",
        activityType: "billable",
        role: t.role,
      });
    }

    await submitTimesheetPeriod(TENANT_ID, period.id);
    created++;
  }

  console.log(`  Pending timesheets: ${created} submitted for bulk PM/RM approval demo`);
  console.log("  Manager: open /modules/resource-mgmt?tab=timesheets&timesheetView=approval");
}

async function main() {
  console.log(`Seeding Resources demo for tenant ${TENANT_ID}...`);

  const userRows = await db.select().from(users).limit(5);
  if (!userRows.length) {
    console.error("No users found. Log in once or run db:seed-crm first.");
    process.exit(1);
  }

  const [existingSkill] = await db.select().from(skills).where(eq(skills.tenantId, TENANT_ID)).limit(1);
  const projectRows = await db.select().from(pmProjects).where(eq(pmProjects.tenantId, TENANT_ID)).limit(3);

  // Build resource id map from DB for timesheet seed (runs even when demo already exists)
  const allResources = await db.select().from(resources).where(eq(resources.tenantId, TENANT_ID));
  const idByKeyFromDb: Record<string, number> = {};
  for (const r of allResources) {
    const key = r.email?.split("@")[0]?.split(".")[0];
    if (r.email?.includes("jordan")) idByKeyFromDb.jordan = r.id;
    if (r.email?.includes("taylor")) idByKeyFromDb.taylor = r.id;
    if (r.email?.includes("riley")) idByKeyFromDb.riley = r.id;
    if (r.email?.includes("alex")) idByKeyFromDb.alex = r.id;
    if (r.email?.includes("sam")) idByKeyFromDb.sam = r.id;
    void key;
  }

  if (existingSkill && !FORCE) {
    console.log("Resources demo data already exists. Set FORCE=1 to re-seed people/skills.");
    await ensureBulkApprovalTimesheets(idByKeyFromDb, projectRows[0]);
    process.exit(0);
  }

  const primaryUserId = userRows[0].id;
  const contractorUserId = userRows[1]?.id ?? primaryUserId;

  // --- People with org hierarchy (5 resource types + expiry-driven status) ---
  const peopleSpec = [
    {
      key: "sam",
      firstName: "Sam", lastName: "Patel", email: "sam.patel@demo.local",
      jobTitle: "Delivery Director", department: "Management", personType: "employee",
      userId: null as string | null, reportsToId: null as number | null, fte: "1.0",
    },
    {
      key: "alex",
      firstName: "Alex", lastName: "Morgan", email: "alex.morgan@demo.local",
      jobTitle: "Senior Consultant", department: "Delivery", personType: "employee",
      userId: primaryUserId, reportsToKey: "sam", fte: "1.0",
    },
    {
      key: "jordan",
      firstName: "Jordan", lastName: "Lee", email: "jordan.lee@demo.local",
      jobTitle: "Business Analyst", department: "Delivery", personType: "employee",
      userId: null, reportsToKey: "sam", fte: "1.0",
    },
    {
      key: "taylor",
      firstName: "Taylor", lastName: "Brooks", email: "taylor.brooks@demo.local",
      jobTitle: "Developer", department: "Engineering", personType: "employee",
      userId: null, reportsToKey: "alex", fte: "1.0",
    },
    {
      key: "riley",
      firstName: "Riley", lastName: "Chen", email: "riley.chen@contractor.demo",
      jobTitle: "UX Contractor", department: "Delivery", personType: "contractor",
      userId: contractorUserId, reportsToKey: "alex", fte: "0.8",
      endDate: new Date(Date.now() + 60 * 86400000),
    },
    {
      key: "marcus",
      firstName: "Marcus", lastName: "Chen", email: "marcus.chen@hsbc.com",
      jobTitle: "Chief Digital Officer", department: "Delivery", personType: "customer",
      userId: null, reportsToKey: "sam", fte: "0.2",
      endDate: new Date(Date.now() + 84 * 86400000),
    },
    {
      key: "maria",
      firstName: "Maria", lastName: "Koch", email: "m.koch@partner-firm.de",
      jobTitle: "SAP FICO Specialist", department: "Delivery", personType: "partner",
      userId: null, reportsToKey: "sam", fte: "1.0",
      endDate: new Date(Date.now() + 176 * 86400000),
    },
    {
      key: "david",
      firstName: "David", lastName: "Lee", email: "d.lee@associate.demo",
      jobTitle: "Solutions Architect", department: "Delivery", personType: "associate",
      userId: null, reportsToKey: "sam", fte: "0.5",
      endDate: new Date(Date.now() + 12 * 86400000),
    },
    {
      key: "laura",
      firstName: "Laura", lastName: "Novak", email: "l.novak@demo.local",
      jobTitle: "Project Manager", department: "Delivery", personType: "employee",
      userId: null, reportsToKey: "sam", fte: "1.0",
    },
    {
      key: "expast",
      firstName: "Ex-Contractor", lastName: "Past", email: "past@expired.demo",
      jobTitle: "Data Engineer", department: "Engineering", personType: "contractor",
      userId: null, reportsToKey: "alex", fte: "1.0",
      endDate: new Date(Date.now() - 190 * 86400000),
    },
  ] as const;

  const idByKey: Record<string, number> = {};

  for (const spec of peopleSpec) {
    const [existing] = await db
      .select()
      .from(resources)
      .where(and(eq(resources.tenantId, TENANT_ID), eq(resources.email, spec.email)))
      .limit(1);

    const reportsToId = "reportsToKey" in spec && spec.reportsToKey
      ? idByKey[spec.reportsToKey] ?? null
      : null;

    const payload = {
      tenantId: TENANT_ID,
      userId: spec.userId,
      firstName: spec.firstName,
      lastName: spec.lastName,
      email: spec.email,
      jobTitle: spec.jobTitle,
      department: spec.department,
      personType: spec.personType,
      status: "active",
      fte: spec.fte,
      reportsToId,
      costRate: "450",
      billRate: "850",
      currency: "GBP",
      workingDaysPerWeek: "5",
      dailyHours: "8",
      weeklyCapacityHours: "40",
      rightToWorkStatus: spec.personType === "contractor" ? "verified" : "complete",
      startDate: "endDate" in spec && spec.endDate && spec.endDate.getTime() < Date.now()
        ? new Date(spec.endDate.getTime() - 300 * 86400000)
        : new Date(Date.now() - 180 * 86400000),
      endDate: "endDate" in spec ? spec.endDate : null,
      location: "London, UK",
      timeZone: "Europe/London",
    };

    if (existing) {
      const [updated] = await db.update(resources).set(payload).where(eq(resources.id, existing.id)).returning();
      idByKey[spec.key] = updated.id;
    } else {
      const [created] = await db.insert(resources).values(payload).returning();
      idByKey[spec.key] = created.id;
    }
  }

  console.log(`  People: ${Object.keys(idByKey).length} (org chart via reportsToId)`);
  console.log(`  Contractor portal user: ${contractorUserId} → Riley Chen (resource #${idByKey.riley})`);

  // --- Skills ---
  if (FORCE) {
    await db.delete(resourceSkills).where(eq(resourceSkills.resourceId, idByKey.alex));
  }

  let [techCat] = await db.select().from(skillCategories).where(and(eq(skillCategories.tenantId, TENANT_ID), eq(skillCategories.name, "Technical"))).limit(1);
  if (!techCat) {
    [techCat] = await db.insert(skillCategories).values({ tenantId: TENANT_ID, name: "Technical", color: "#6366f1" }).returning();
  }
  let [softCat] = await db.select().from(skillCategories).where(and(eq(skillCategories.tenantId, TENANT_ID), eq(skillCategories.name, "Soft Skills"))).limit(1);
  if (!softCat) {
    [softCat] = await db.insert(skillCategories).values({ tenantId: TENANT_ID, name: "Soft Skills", color: "#22c55e" }).returning();
  }

  const skillSpecs = [
    { name: "React", categoryId: techCat.id, isCertification: false },
    { name: "TypeScript", categoryId: techCat.id, isCertification: false },
    { name: "Agile Delivery", categoryId: softCat.id, isCertification: false },
    { name: "AWS Solutions Architect", categoryId: techCat.id, isCertification: true },
    { name: "Figma", categoryId: techCat.id, isCertification: false },
  ];

  const skillIds: Record<string, number> = {};
  for (const s of skillSpecs) {
    const [existing] = await db.select().from(skills).where(and(eq(skills.tenantId, TENANT_ID), eq(skills.name, s.name))).limit(1);
    if (existing) {
      skillIds[s.name] = existing.id;
    } else {
      const [row] = await db.insert(skills).values({ tenantId: TENANT_ID, ...s }).returning();
      skillIds[s.name] = row.id;
    }
  }

  const assignSkill = async (resourceId: number, skillName: string, level: number) => {
    const skillId = skillIds[skillName];
    const [exists] = await db.select().from(resourceSkills).where(and(eq(resourceSkills.resourceId, resourceId), eq(resourceSkills.skillId, skillId))).limit(1);
    if (exists) return;
    await db.insert(resourceSkills).values({
      resourceId,
      skillId,
      skillLevel: level,
      proficiencyLevel: level >= 4 ? "expert" : level >= 3 ? "practitioner" : "foundation",
      yearsExperience: String(level),
    });
  };

  await assignSkill(idByKey.alex, "React", 4);
  await assignSkill(idByKey.alex, "TypeScript", 4);
  await assignSkill(idByKey.alex, "Agile Delivery", 3);
  await assignSkill(idByKey.jordan, "Agile Delivery", 4);
  await assignSkill(idByKey.taylor, "TypeScript", 5);
  await assignSkill(idByKey.taylor, "React", 4);
  await assignSkill(idByKey.riley, "Figma", 5);
  console.log(`  Skills: ${Object.keys(skillIds).length} skills assigned across team`);

  // --- Allocations ---
  const p = projectRows[0];
  if (p) {
    const start = new Date();
    const end = new Date(Date.now() + 90 * 86400000);
    for (const [key, pct] of [["alex", 80], ["jordan", 50], ["taylor", 100]] as const) {
      const resourceId = idByKey[key];
      const [exists] = await db.select().from(resourceAllocations).where(and(
        eq(resourceAllocations.resourceId, resourceId),
        eq(resourceAllocations.projectId, p.id),
      )).limit(1);
      if (!exists) {
        await db.insert(resourceAllocations).values({
          tenantId: TENANT_ID,
          resourceId,
          projectId: p.id,
          projectName: p.name,
          allocationType: "confirmed",
          allocationPercentage: String(pct),
          daysPerWeek: String(Math.round(Number(pct) / 20)),
          role: key === "alex" ? "Senior Consultant" : key === "jordan" ? "Business Analyst" : "Developer",
          startDate: start,
          endDate: end,
          status: "active",
        });
      }
    }
    console.log(`  Allocations: team on project "${p.name}"`);
  }

  await ensureBulkApprovalTimesheets(idByKey, p);

  // --- Leave ---
  const [leaveExists] = await db.select().from(resourceLeaves).where(eq(resourceLeaves.resourceId, idByKey.jordan)).limit(1);
  if (!leaveExists) {
    await db.insert(resourceLeaves).values({
      tenantId: TENANT_ID,
      resourceId: idByKey.jordan,
      leaveType: "annual",
      startDate: new Date(Date.now() + 14 * 86400000),
      endDate: new Date(Date.now() + 21 * 86400000),
      notes: "Summer holiday",
    });
  }

  // --- Timesheet integration (webhook demo) ---
  const [intExists] = await db.select().from(timesheetIntegrations).where(and(eq(timesheetIntegrations.tenantId, TENANT_ID), eq(timesheetIntegrations.name, "Demo Payroll Export"))).limit(1);
  if (!intExists) {
    await db.insert(timesheetIntegrations).values({
      tenantId: TENANT_ID,
      name: "Demo Payroll Export",
      endpointUrl: "https://httpbin.org/post",
      authType: "bearer",
      authConfig: { token: "demo-token" },
      trigger: "on_approval",
      isActive: true,
    });
    console.log("  Integration: Demo Payroll Export (on_approval → httpbin.org)");
  }

  // --- Document link (if documents exist) ---
  const [doc] = await db.select().from(documents).where(eq(documents.tenantId, TENANT_ID)).limit(1);
  if (doc) {
    const [linkExists] = await db.select().from(documentResourceLinks).where(and(
      eq(documentResourceLinks.resourceId, idByKey.riley),
      eq(documentResourceLinks.documentId, doc.id),
    )).limit(1);
    if (!linkExists) {
      await db.insert(documentResourceLinks).values({
        tenantId: TENANT_ID,
        resourceId: idByKey.riley,
        documentId: doc.id,
        linkType: "contract",
        notes: "Contractor SOW",
        createdById: primaryUserId,
      });
      console.log(`  Document link: "${doc.title}" → Riley Chen`);
    }
  }

  console.log("\nResources demo seed complete.");
  console.log("  • Types: employee, contractor, customer staff, partner, associate");
  console.log("  • Org chart: Sam → Alex, Jordan, Marcus, Maria, David, Laura; Alex → Taylor, Riley, Ex-Contractor");
  console.log("  • Status demo: David (associate) expiring <30d, Ex-Contractor expired");
  console.log("  • Contractor login → auto-redirects to Resources → Timesheets");
  console.log("  • Manager bulk approval: /modules/resource-mgmt?tab=timesheets&timesheetView=approval");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
