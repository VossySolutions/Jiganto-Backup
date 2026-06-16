/**
 * Seed eSign / signoff module with demo data for UI testing.
 *
 * Usage:
 *   npm run db:seed-esign
 *   FORCE=1 npm run db:seed-esign
 *
 * Prerequisites: users exist, npm run db:patch-esign, projects recommended (db:seed-finance).
 */
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, pmProjects } from "@shared/schema";
import { pmDeliverablePhases, pmDeliverables } from "@shared/models/projects";
import { signoffRequests } from "@shared/models/signoff";
import {
  createRequest, sendRequest, signDocument, declineDocument, voidRequest,
} from "./signoff/service";

const TENANT_ID = Number(process.env.SEED_TENANT_ID ?? 1);
const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true";

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function ensureDeliverables(projectId: number, userId: string) {
  const existing = await db.select().from(pmDeliverables)
    .where(eq(pmDeliverables.projectId, projectId)).limit(1);
  if (existing.length) return existing;

  const [phase] = await db.insert(pmDeliverablePhases).values({
    tenantId: TENANT_ID,
    projectId,
    name: "Design & Build",
    color: "#3b6cf4",
    sortOrder: 1,
  }).returning();

  const defs = [
    { name: "Solution Design Document", type: "Document", status: "In Review", progress: 80 },
    { name: "UAT Sign-off Pack", type: "Sign-off", status: "In Review", progress: 60 },
    { name: "Go-Live Checklist", type: "Sign-off", status: "Not Started", progress: 0 },
  ];

  const created = [];
  for (const d of defs) {
    const [row] = await db.insert(pmDeliverables).values({
      tenantId: TENANT_ID,
      projectId,
      phaseId: phase.id,
      phaseName: phase.name,
      name: d.name,
      type: d.type,
      status: d.status,
      ragStatus: "Green",
      progress: d.progress,
      dueDate: daysFromNow(21),
      createdBy: userId,
    }).returning();
    created.push(row);
  }
  return created;
}

async function main() {
  console.log(`Seeding eSign demo data for tenant ${TENANT_ID}...\n`);

  const [existing] = await db.select({ id: signoffRequests.id }).from(signoffRequests)
    .where(eq(signoffRequests.tenantId, TENANT_ID)).limit(1);

  if (existing && !FORCE) {
    console.log("eSign data already exists. Set FORCE=1 to seed again.");
    process.exit(0);
  }

  const userRows = await db.select().from(users).limit(3);
  if (!userRows.length) {
    console.error("No users found. Log in once or run db:seed-crm first.");
    process.exit(1);
  }
  const user = userRows[0];
  const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Demo User";

  const projects = await db.select().from(pmProjects).where(eq(pmProjects.tenantId, TENANT_ID)).limit(3);
  if (!projects.length) {
    console.error("No projects found. Run npm run db:seed-finance first.");
    process.exit(1);
  }
  const project = projects[0];
  const deliverables = await ensureDeliverables(project.id, user.id);
  const signoffDeliverable = deliverables.find(d => d.type === "Sign-off") ?? deliverables[0];

  const signers = [
    { name: "Alex Morgan", email: "alex.morgan@demo.local", roleTitle: "Project Sponsor", signerOrder: 1 },
    { name: "Sam Patel", email: "sam.patel@demo.local", roleTitle: "Delivery Lead", signerOrder: 2 },
  ];

  const actor = { name: userName, email: user.email ?? undefined };

  // 1. Draft
  const draft = await createRequest({
    tenantId: TENANT_ID,
    userId: user.id,
    userName,
    userEmail: user.email ?? undefined,
    body: {
      title: "NDA — Acme Corp Partnership",
      sourceType: "inline_doc",
      contentHtml: "<h1>Mutual NDA</h1><p>Confidentiality agreement for partnership discussions.</p>",
      projectId: project.id,
      deadline: daysFromNow(14),
      signers,
    },
  });
  console.log(`  Draft: "${draft?.title}" (id=${draft?.id})`);

  // 2. Pending (sequential — first signer gets token)
  const pending = await createRequest({
    tenantId: TENANT_ID,
    userId: user.id,
    userName,
    body: {
      title: "Statement of Work — Phase 2",
      sourceType: "inline_doc",
      contentHtml: "<h1>Statement of Work</h1><p>Scope, timeline, and fees for Phase 2 delivery.</p>",
      projectId: project.id,
      deliverableId: signoffDeliverable.id,
      signingOrder: "sequential",
      deadline: daysFromNow(10),
      message: "Please review and sign at your earliest convenience.",
      signers,
    },
  });
  const sentPending = pending ? await sendRequest(pending.id, actor) : null;
  const pendingToken = sentPending?.signers.find(s => s.signerOrder === 1)?.token;
  console.log(`  Pending: "${sentPending?.title}" (id=${sentPending?.id})`);
  if (pendingToken) {
    console.log(`    Portal URL: /sign/${pendingToken}`);
  }

  // 3. Partially signed
  const partial = await createRequest({
    tenantId: TENANT_ID,
    userId: user.id,
    userName,
    body: {
      title: "Change Request #12 — Scope Extension",
      sourceType: "inline_doc",
      contentHtml: "<h1>Change Request</h1><p>Approved scope extension for additional modules.</p>",
      projectId: project.id,
      signingOrder: "sequential",
      deadline: daysFromNow(7),
      signers,
    },
  });
  if (partial) {
    const sentPartial = await sendRequest(partial.id, actor);
    const first = sentPartial?.signers.find(s => s.signerOrder === 1);
    if (first?.token) {
      await signDocument(first.token, {
        signatureName: first.name,
        signatureMethod: "type",
        signatureData: JSON.stringify({ type: "typed", name: first.name }),
        ip: "127.0.0.1",
      });
    }
    console.log(`  Partially signed: "${sentPartial?.title}" (id=${sentPartial?.id})`);
  }

  // 4. Completed (linked deliverable — auto-completes on full sign)
  const completedDel = deliverables.find(d => d.name === "Go-Live Checklist") ?? signoffDeliverable;
  const completed = await createRequest({
    tenantId: TENANT_ID,
    userId: user.id,
    userName,
    body: {
      title: "Go-Live Sign-off — Production Release",
      sourceType: "inline_doc",
      contentHtml: "<h1>Go-Live Approval</h1><p>All acceptance criteria met. Approved for production.</p>",
      projectId: project.id,
      deliverableId: completedDel.id,
      signingOrder: "parallel",
      deadline: daysFromNow(5),
      signers: [{ name: "Jordan Lee", email: "jordan.lee@demo.local", roleTitle: "Release Manager", signerOrder: 1 }],
    },
  });
  if (completed) {
    const sentCompleted = await sendRequest(completed.id, actor);
    for (const s of sentCompleted?.signers ?? []) {
      if (s.token) {
        await signDocument(s.token, {
          signatureName: s.name,
          signatureMethod: "type",
          signatureData: JSON.stringify({ type: "typed", name: s.name }),
          ip: "127.0.0.1",
        });
      }
    }
    console.log(`  Completed: "${sentCompleted?.title}" (id=${sentCompleted?.id})`);
  }

  // 5. Declined
  const declined = await createRequest({
    tenantId: TENANT_ID,
    userId: user.id,
    userName,
    body: {
      title: "Vendor Agreement — Cloud Services",
      sourceType: "inline_doc",
      contentHtml: "<h1>Vendor Agreement</h1><p>Third-party cloud hosting terms.</p>",
      projectId: project.id,
      deadline: daysFromNow(14),
      signers: [{ name: "Alex Morgan", email: "alex.morgan@demo.local", roleTitle: "Legal Review", signerOrder: 1 }],
    },
  });
  if (declined) {
    const sentDeclined = await sendRequest(declined.id, actor);
    const signer = sentDeclined?.signers[0];
    if (signer?.token) {
      await declineDocument(signer.token, "Terms require legal review before signing.", "127.0.0.1");
    }
    console.log(`  Declined: "${sentDeclined?.title}" (id=${sentDeclined?.id})`);
  }

  // 6. Voided
  const voided = await createRequest({
    tenantId: TENANT_ID,
    userId: user.id,
    userName,
    body: {
      title: "Draft SOW — Superseded",
      sourceType: "inline_doc",
      contentHtml: "<h1>Old SOW</h1><p>Superseded by revised version.</p>",
      deadline: daysFromNow(14),
      signers: [{ name: "Sam Patel", email: "sam.patel@demo.local", signerOrder: 1 }],
    },
  });
  if (voided) {
    await sendRequest(voided.id, actor);
    await voidRequest(voided.id, "Superseded by revised document", actor);
    console.log(`  Voided: "${voided.title}" (id=${voided.id})`);
  }

  console.log("\neSign demo seed complete:");
  console.log(`  • Project: ${project.name}`);
  console.log(`  • ${deliverables.length} deliverables (incl. Sign-off types)`);
  console.log(`  • 6 sign-off requests (draft, pending, partial, completed, declined, voided)`);
  if (pendingToken) console.log(`  • Test signing portal: /sign/${pendingToken}`);
  console.log("\nOpen /modules/e-sign to view the dashboard.");
  process.exit(0);
}

main().catch(err => {
  console.error("eSign seed failed:", err);
  process.exit(1);
});
