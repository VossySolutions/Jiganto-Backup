import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "./db";
import * as sd from "./service-desk/service";
import { hdPortalConfigs } from "@shared/models/service-desk";

export async function seedHelpDeskDemo(tenantId: number, userId: string) {
  const tickets = [
    { title: "Login fails on UAT after patch", type: "defect" as const, priority: "p2" as const, defectSeverity: "high", defectEnvironment: "uat", sprintPhase: "UAT Phase 2", defectStepsToReproduce: "1. Login\n2. Observe error" },
    { title: "Report export timeout in production", type: "incident" as const, priority: "p1" as const },
    { title: "Request additional user licences", type: "service_request" as const, priority: "p3" as const },
    { title: "How to configure SSO for client portal?", type: "question" as const, priority: "p4" as const },
  ];

  for (const t of tickets) {
    await sd.createTicket(tenantId, userId, { ...t, source: "help_desk" });
  }

  const existing = await db.select().from(hdPortalConfigs).where(eq(hdPortalConfigs.tenantId, tenantId));
  let portalToken = existing[0]?.token;
  if (!portalToken) {
    portalToken = randomBytes(16).toString("hex");
    await db.insert(hdPortalConfigs).values({
      tenantId,
      token: portalToken,
      portalName: "Client Support Portal",
      allowedEmailDomains: ["example.com"],
      isActive: true,
      createdBy: userId,
      customBranding: { headerColor: "#0EA5E9" },
    });
  }

  return { tickets: tickets.length, portalToken };
}

const isDirectRun = process.argv[1]?.includes("seed-help-desk-demo");
if (isDirectRun) {
  const tenantId = Number(process.env.SEED_TENANT_ID ?? 1);
  import("./db").then(async ({ db }) => {
    const { users } = await import("@shared/schema");
    const [admin] = await db.select().from(users).limit(1);
    if (!admin) {
      console.error("No users found — sign in once or run auth sync first");
      process.exit(1);
    }
    const result = await seedHelpDeskDemo(tenantId, admin.id);
    console.log(`Help Desk demo seeded: ${result.tickets} tickets, portal token ${result.portalToken}`);
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
