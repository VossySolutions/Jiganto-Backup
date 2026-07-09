import * as sd from "./service-desk/service";

const DEMO_CATEGORIES = [
  { name: "Infrastructure", description: "Servers, networks, cloud infrastructure", sortOrder: 1 },
  { name: "Application Support", description: "Business applications and integrations", sortOrder: 2 },
  { name: "Business Process", description: "Workflow and process support", sortOrder: 3 },
  { name: "HR & Onboarding", description: "Employee onboarding and HR systems", sortOrder: 4 },
];

const DEMO_SERVICES = [
  {
    category: "Infrastructure",
    name: "New Laptop Request",
    description: "Request a new laptop or replacement device for an employee.",
    availability: "business_hours",
    costModel: "included",
    slas: [
      { priority: "p3", responseHours: 4, resolutionHours: 24 },
      { priority: "p2", responseHours: 2, resolutionHours: 8 },
    ],
    formFields: [
      { key: "employee_name", label: "Employee Name", type: "text", required: true },
      { key: "device_type", label: "Device Type", type: "select", options: ["Laptop", "Desktop", "Monitor"] },
    ],
  },
  {
    category: "Infrastructure",
    name: "VPN Access",
    description: "Request or reset VPN access for remote working.",
    availability: "24_7",
    costModel: "included",
    slas: [{ priority: "p3", responseHours: 2, resolutionHours: 8 }],
    formFields: [{ key: "username", label: "Username", type: "text", required: true }],
  },
  {
    category: "Application Support",
    name: "SAP Basis Support",
    description: "SAP system administration, transport requests, and basis support.",
    availability: "business_hours",
    costModel: "per_incident",
    costNotes: "Charged per incident under managed services contract",
    slas: [
      { priority: "p1", responseHours: 1, resolutionHours: 4 },
      { priority: "p2", responseHours: 4, resolutionHours: 8 },
    ],
    formFields: [
      { key: "system_id", label: "SAP System ID", type: "text", required: true },
      { key: "transaction", label: "Transaction Code", type: "text" },
    ],
  },
  {
    category: "Application Support",
    name: "Software License Request",
    description: "Request new software licenses or renewals.",
    availability: "business_hours",
    costModel: "per_incident",
    slas: [{ priority: "p3", responseHours: 8, resolutionHours: 48 }],
    formFields: [
      { key: "software_name", label: "Software Name", type: "text", required: true },
      { key: "license_count", label: "Number of Licenses", type: "number", required: true },
    ],
  },
  {
    category: "HR & Onboarding",
    name: "New Starter IT Setup",
    description: "Complete IT setup for new employees including accounts, email, and equipment.",
    availability: "business_hours",
    costModel: "included",
    slas: [{ priority: "p3", responseHours: 4, resolutionHours: 24 }],
    formFields: [
      { key: "start_date", label: "Start Date", type: "date", required: true },
      { key: "department", label: "Department", type: "text", required: true },
    ],
  },
];

export async function seedServiceDeskDemo(tenantId: number, adminUserId: string) {
  await sd.getOrCreateSettings(tenantId);

  const existingTeams = await sd.listTeams(tenantId);
  let infraTeamId = existingTeams.find((t) => t.name === "Infrastructure")?.id;
  let appTeamId = existingTeams.find((t) => t.name === "Application Support")?.id;

  if (!infraTeamId) {
    const t = await sd.upsertTeam(tenantId, {
      name: "Infrastructure",
      description: "Infrastructure and network support",
      roundRobinEnabled: true,
      memberIds: adminUserId ? [adminUserId] : [],
    });
    infraTeamId = t!.id;
  }
  if (!appTeamId) {
    const t = await sd.upsertTeam(tenantId, {
      name: "Application Support",
      description: "SAP and business application support",
      memberIds: adminUserId ? [adminUserId] : [],
    });
    appTeamId = t!.id;
  }

  const catMap = new Map<string, number>();
  for (const c of DEMO_CATEGORIES) {
    const cat = await sd.upsertCategory(tenantId, c);
    catMap.set(c.name, cat.id);
  }

  for (const svc of DEMO_SERVICES) {
    const teamId = svc.category === "Application Support" ? appTeamId! : infraTeamId!;
    await sd.upsertService(tenantId, adminUserId, {
      categoryId: catMap.get(svc.category),
      name: svc.name,
      description: svc.description,
      ownerTeamId: teamId,
      availability: svc.availability,
      costModel: svc.costModel,
      costNotes: svc.costNotes,
      requestFormFields: svc.formFields,
      visibility: "all_clients",
      slas: svc.slas,
    });
  }

  const rules = await sd.listRoutingRules(tenantId);
  if (rules.length === 0) {
    await sd.upsertRoutingRule(tenantId, {
      name: "P1 Incidents → Infrastructure",
      sortOrder: 1,
      conditions: { ticketType: "incident", priority: "p1" },
      actions: { assignTeamId: infraTeamId, setPriority: "p1" },
    });
    await sd.upsertRoutingRule(tenantId, {
      name: "SAP keyword → Application Support",
      sortOrder: 2,
      conditions: { keyword: "SAP" },
      actions: { assignTeamId: appTeamId },
    });
  }

  if (adminUserId) {
    await sd.setCabMembers(tenantId, [adminUserId]);
  }

  const tickets = await sd.listTickets(tenantId, { source: "service_desk" });
  if (tickets.length === 0) {
    await sd.createTicket(tenantId, adminUserId, {
      title: "Email not syncing on mobile device",
      type: "incident",
      priority: "p2",
      description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "User reports Outlook not syncing on iPhone since this morning." }] }] },
      category: "Infrastructure",
      assignedTeamId: infraTeamId,
    });
    await sd.createTicket(tenantId, adminUserId, {
      title: "SAP transport import failed in QA",
      type: "incident",
      priority: "p1",
      description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Transport DEVK900123 failed during import with RC=12." }] }] },
      category: "Application Support",
      assignedTeamId: appTeamId,
    });
    await sd.createTicket(tenantId, adminUserId, {
      title: "Upgrade production database to PostgreSQL 16",
      type: "change_request",
      priority: "p2",
      description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Planned database upgrade during maintenance window." }] }] },
      changeJustification: "Security patches and performance improvements",
      changeRiskAssessment: "Medium — rollback plan in place",
      changeRollbackPlan: "Restore from snapshot taken before upgrade",
      changeImplementationDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    await sd.createTicket(tenantId, adminUserId, {
      title: "How do I reset my MFA token?",
      type: "question",
      priority: "p4",
      description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Need guidance on MFA reset procedure." }] }] },
    });
  }

  console.log("[seed] Service Desk demo data ready for tenant", tenantId);
}

const isDirectRun = process.argv[1]?.includes("seed-service-desk-demo");
if (isDirectRun) {
  const tenantId = Number(process.env.SEED_TENANT_ID ?? 1);
  import("./db").then(async ({ db }) => {
    const { users } = await import("@shared/schema");
    const [admin] = await db.select().from(users).limit(1);
    if (!admin) {
      console.error("No users found — run auth sync first");
      process.exit(1);
    }
    await seedServiceDeskDemo(tenantId, admin.id);
    process.exit(0);
  }).catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
