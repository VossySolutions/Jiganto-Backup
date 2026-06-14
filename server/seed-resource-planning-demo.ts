/**
 * Seed Resource Planning module: languages/grade on resources, recruitment recs, scenarios.
 * Run after db:seed-resources and db:seed-crm.
 *
 * Usage: npm run db:seed-resource-planning
 *        FORCE=1 npm run db:seed-resource-planning
 */
import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  resources,
  resourceAllocations,
  recruitmentRecommendations,
  resourcePlanningScenarios,
} from "@shared/schema";
import { generateRecruitmentRecommendations } from "./resource-planning/service";

const TENANT_ID = Number(process.env.SEED_TENANT_ID ?? 1);
const FORCE = process.env.FORCE === "1";

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function enrichResources() {
  const people = await db.select().from(resources).where(eq(resources.tenantId, TENANT_ID));
  const grades = ["Grade 2", "Grade 3", "Grade 4", "Grade 5", "Senior"];
  const langs = ["English", "English, French", "English, German", "English, Mandarin", "English, Spanish"];

  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    if (p.languages && p.grade && !FORCE) continue;
    await db.update(resources).set({
      languages: langs[i % langs.length],
      grade: grades[i % grades.length],
      updatedAt: new Date(),
    }).where(eq(resources.id, p.id));
  }
  console.log(`  Enriched ${people.length} resources with languages + grade`);
}

async function ensurePipelineBookings() {
  const existing = await db.select().from(resourceAllocations).where(
    and(eq(resourceAllocations.tenantId, TENANT_ID), eq(resourceAllocations.allocationType, "pipeline")),
  );
  if (existing.length >= 2 && !FORCE) {
    console.log(`  Pipeline bookings: ${existing.length} already exist`);
    return;
  }

  const people = await db.select().from(resources).where(eq(resources.tenantId, TENANT_ID)).limit(5);
  for (let i = 0; i < Math.min(3, people.length); i++) {
    const p = people[i];
    const [dup] = await db.select().from(resourceAllocations).where(and(
      eq(resourceAllocations.resourceId, p.id),
      eq(resourceAllocations.allocationType, "pipeline"),
    )).limit(1);
    if (dup && !FORCE) continue;

    await db.insert(resourceAllocations).values({
      tenantId: TENANT_ID,
      resourceId: p.id,
      projectName: `Pipeline Opp ${i + 1}`,
      role: p.jobTitle,
      allocationType: "pipeline",
      daysPerWeek: "3",
      startDate: new Date(daysFromNow(30)),
      endDate: new Date(daysFromNow(120)),
      status: "active",
    });
  }
  console.log("  Created soft pipeline bookings");
}

async function ensureScenarios() {
  const existing = await db.select().from(resourcePlanningScenarios).where(eq(resourcePlanningScenarios.tenantId, TENANT_ID));
  if (existing.length >= 3 && !FORCE) {
    console.log(`  Scenarios: ${existing.length} already exist`);
    return;
  }
  if (FORCE && existing.length) {
    await db.delete(resourcePlanningScenarios).where(eq(resourcePlanningScenarios.tenantId, TENANT_ID));
  }
  console.log("  Scenarios will be auto-generated on first API load");
}

async function ensureRecruitment() {
  const existing = await db.select().from(recruitmentRecommendations).where(eq(recruitmentRecommendations.tenantId, TENANT_ID));
  if (existing.length >= 2 && !FORCE) {
    console.log(`  Recruitment recs: ${existing.length} already exist`);
    return;
  }
  if (FORCE && existing.length) {
    await db.delete(recruitmentRecommendations).where(eq(recruitmentRecommendations.tenantId, TENANT_ID));
  }
  await generateRecruitmentRecommendations(TENANT_ID);
  const after = await db.select().from(recruitmentRecommendations).where(eq(recruitmentRecommendations.tenantId, TENANT_ID));
  console.log(`  Generated ${after.length} recruitment recommendations`);
}

async function main() {
  console.log(`Seeding Resource Planning for tenant ${TENANT_ID}...`);
  await enrichResources();
  await ensurePipelineBookings();
  await ensureScenarios();
  await ensureRecruitment();
  console.log("Resource Planning seed complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
