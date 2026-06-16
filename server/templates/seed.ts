import { eq } from "drizzle-orm";
import { db } from "../db";
import { platformTemplates } from "@shared/models/templates";
import { SYSTEM_SURVEY_TEMPLATES } from "../surveys/system-templates";
import { SYSTEM_ESIGN_TEMPLATES } from "../signoff/system-templates";

const SAP_ACTIVATE_PHASES = [
  { order: 1, name: "Discover", description: "Explore and prepare", rows: [] },
  { order: 2, name: "Prepare", description: "Project setup and planning", rows: [] },
  { order: 3, name: "Explore", description: "Fit-to-standard analysis", rows: [] },
  { order: 4, name: "Realize", description: "Build and test", rows: [] },
  { order: 5, name: "Deploy", description: "Go-live preparation", rows: [] },
  { order: 6, name: "Run", description: "Hypercare and optimisation", rows: [] },
];

const WORKDAY_PHASES = [
  { order: 1, name: "Plan", description: "Strategy and planning", rows: [] },
  { order: 2, name: "Architect", description: "Solution design", rows: [] },
  { order: 3, name: "Configure", description: "System configuration", rows: [] },
  { order: 4, name: "Test", description: "Testing and validation", rows: [] },
  { order: 5, name: "Deploy", description: "Cutover and go-live", rows: [] },
  { order: 6, name: "Support", description: "Post go-live support", rows: [] },
];

const SYSTEM_TEMPLATES = [
  {
    name: "SAP Activate — Implementation Framework",
    description: "SAP's agile implementation methodology for S/4HANA deployments.",
    module: "bpm_framework",
    categoryTags: ["SAP"],
    isFeatured: true,
    snapshot: { name: "SAP Activate", category: "project_delivery", vendor: "SAP", version: "1.0", phases: SAP_ACTIVATE_PHASES },
  },
  {
    name: "Workday — Implementation Framework",
    description: "Workday's proven methodology for HCM and Financials implementations.",
    module: "bpm_framework",
    categoryTags: ["Workday"],
    isFeatured: true,
    snapshot: { name: "Workday Implementation", category: "project_delivery", vendor: "Workday", version: "1.0", phases: WORKDAY_PHASES },
  },
  {
    name: "SAP S/4HANA Project Starter",
    description: "Pre-configured project with Gantt, RAID logs, deliverables tracker, and SAP framework link.",
    module: "project",
    categoryTags: ["SAP"],
    isFeatured: true,
    snapshot: {
      projectType: "large_project", methodology: "hybrid", framework: "SAP Activate",
      tools: [
        { toolType: "gantt_chart", toolCategory: "planning_scheduling", label: "Gantt Chart" },
        { toolType: "risk_log", toolCategory: "raid_governance", label: "Risk Log" },
        { toolType: "issues_log", toolCategory: "raid_governance", label: "Issues Log" },
        { toolType: "deliverables_tracker", toolCategory: "documentation_delivery", label: "Deliverables" },
        { toolType: "test_tracker", toolCategory: "documentation_delivery", label: "Test Tracker" },
      ],
      workstreamNames: ["Design", "Build", "Test", "Deploy"],
      complexityLevel: "high", transformationTheme: "ERP Modernisation",
    },
  },
  {
    name: "Salesforce Sales Cloud — Project Starter",
    description: "Agile project setup for Salesforce Sales Cloud implementations.",
    module: "project",
    categoryTags: ["Salesforce", "Agile"],
    isFeatured: true,
    snapshot: {
      projectType: "small_project", methodology: "agile", framework: "Agile Delivery",
      tools: [
        { toolType: "scrum_board", toolCategory: "planning_scheduling", label: "Sprint Board" },
        { toolType: "epics_stories", toolCategory: "planning_scheduling", label: "Epics & Stories" },
        { toolType: "status_reporting", toolCategory: "reporting_dashboards", label: "Status Reports" },
      ],
      workstreamNames: ["Discovery", "Configuration", "UAT", "Go-Live"],
      complexityLevel: "medium",
    },
  },
];

export async function seedSystemPlatformTemplates() {
  for (const st of SYSTEM_TEMPLATES) {
    const [existing] = await db.select().from(platformTemplates).where(
      eq(platformTemplates.name, st.name),
    ).limit(1);
    if (existing) continue;
    await db.insert(platformTemplates).values({
      tenantId: null,
      name: st.name,
      description: st.description,
      module: st.module,
      categoryTags: st.categoryTags,
      tier: "system",
      snapshotJsonb: st.snapshot,
      status: "active",
      isFeatured: st.isFeatured ?? false,
      marketplaceListed: true,
      createdByName: "Jiganto",
    });
  }

  for (const st of SYSTEM_SURVEY_TEMPLATES) {
    const name = st.title;
    const [existing] = await db.select().from(platformTemplates).where(eq(platformTemplates.name, name)).limit(1);
    if (existing) continue;
    await db.insert(platformTemplates).values({
      tenantId: null, name, description: st.description, module: "survey",
      categoryTags: st.category ? [st.category] : ["Generic IT"],
      tier: "system", isFeatured: true,
      snapshotJsonb: {
        title: st.title, description: st.description, surveyType: st.surveyType,
        category: st.category, questionsJson: st.questions,
        settingsJson: { anonymous: false, showProgress: true, onePerPage: true },
      },
      status: "active", createdByName: "Jiganto",
    });
  }

  for (const st of SYSTEM_ESIGN_TEMPLATES) {
    const [existing] = await db.select().from(platformTemplates).where(eq(platformTemplates.name, st.title)).limit(1);
    if (existing) continue;
    await db.insert(platformTemplates).values({
      tenantId: null, name: st.title, description: st.description, module: "esign",
      categoryTags: [st.category], tier: "system", isFeatured: true,
      snapshotJsonb: {
        title: st.title, description: st.description, category: st.category,
        sourceType: "inline_doc", contentHtml: st.contentHtml,
      },
      status: "active", createdByName: "Jiganto",
    });
  }

  const WHITEBOARD_TEMPLATES = [
    {
      name: "Retrospective — Start / Stop / Continue",
      description: "Three-column agile retrospective layout with colour-coded sticky zones.",
      categoryTags: ["Agile"],
      isFeatured: true,
      snapshot: {
        notes: [
          { noteType: "idea", colourHex: "#BBF7D0", xPosition: 80, yPosition: 120, width: 280, height: 320, text: "" },
          { noteType: "risk", colourHex: "#FECACA", xPosition: 400, yPosition: 120, width: 280, height: 320, text: "" },
          { noteType: "action", colourHex: "#BFDBFE", xPosition: 720, yPosition: 120, width: 280, height: 320, text: "" },
        ],
      },
    },
    {
      name: "Sprint Planning Board",
      description: "Backlog, in sprint, and done columns for sprint planning workshops.",
      categoryTags: ["Agile"],
      snapshot: {
        notes: [
          { noteType: "requirement", colourHex: "#E9D5FF", xPosition: 60, yPosition: 100, width: 300, height: 400, text: "" },
          { noteType: "idea", colourHex: "#FEF08A", xPosition: 400, yPosition: 100, width: 300, height: 400, text: "" },
          { noteType: "decision", colourHex: "#A7F3D0", xPosition: 740, yPosition: 100, width: 300, height: 400, text: "" },
        ],
      },
    },
    {
      name: "SWOT Workshop",
      description: "Strengths, weaknesses, opportunities, and threats quadrant layout.",
      categoryTags: ["Management Consulting", "Generic IT"],
      snapshot: {
        notes: [
          { noteType: "opportunity", colourHex: "#BBF7D0", xPosition: 80, yPosition: 80, width: 360, height: 280, text: "" },
          { noteType: "risk", colourHex: "#FECACA", xPosition: 480, yPosition: 80, width: 360, height: 280, text: "" },
          { noteType: "idea", colourHex: "#BFDBFE", xPosition: 80, yPosition: 400, width: 360, height: 280, text: "" },
          { noteType: "issue", colourHex: "#FDE68A", xPosition: 480, yPosition: 400, width: 360, height: 280, text: "" },
        ],
      },
    },
  ];

  for (const wb of WHITEBOARD_TEMPLATES) {
    const [existing] = await db.select().from(platformTemplates).where(eq(platformTemplates.name, wb.name)).limit(1);
    if (existing) continue;
    await db.insert(platformTemplates).values({
      tenantId: null,
      name: wb.name,
      description: wb.description,
      module: "whiteboard",
      categoryTags: wb.categoryTags,
      tier: "system",
      isFeatured: wb.isFeatured ?? false,
      marketplaceListed: true,
      snapshotJsonb: wb.snapshot,
      status: "active",
      createdByName: "Jiganto",
    });
  }
}
