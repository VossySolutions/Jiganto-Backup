import { eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import type { TemplateModule } from "@shared/models/templates";
import { platformTemplates } from "@shared/models/templates";
import {
  frameworks, bpmDiagrams, bpmNodes, bpmEdges,
  surveys, surveyQuestions,
  signoffRequests,
  orgCharts, orgChartMembers,
  pmProjects, pmProjectTools, pmWorkstreams,
  bpmlTemplates, bpmlEntries,
  tmBusinessAreas, tmBusinessProcesses, tmScenarios, tmTestCases, tmTestSteps,
  whiteboards, stickyNotes,
} from "@shared/schema";
import * as surveyService from "../surveys/service";
import * as wsService from "../workspaces/service";

export type ApplyResult = {
  targetId: number;
  targetModule: TemplateModule;
  navigateUrl: string;
  name: string;
};

export async function applyTemplate(params: {
  templateId: number;
  tenantId: number;
  userId: string;
  userName?: string;
  name?: string;
  workspaceId?: number | null;
  projectId?: number | null;
}): Promise<ApplyResult> {
  const [tpl] = await db.select().from(platformTemplates).where(eq(platformTemplates.id, params.templateId));
  if (!tpl) throw new Error("Template not found");
  if (tpl.status === "draft" || tpl.status === "archived") throw new Error("Template is not available");
  if (tpl.tier === "customer" && tpl.tenantId !== params.tenantId) throw new Error("Template not found");
  if (tpl.tier === "submitted" && tpl.tenantId !== params.tenantId && tpl.submissionStatus !== "approved") {
    throw new Error("Template not found");
  }

  const snapshot = tpl.snapshotJsonb as Record<string, unknown>;
  const module = tpl.module as TemplateModule;
  const displayName = params.name || tpl.name;

  let result: ApplyResult;
  switch (module) {
    case "bpm_framework": result = await applyFramework(snapshot, params, displayName); break;
    case "bpm_diagram": result = await applyBpmDiagram(snapshot, params, displayName); break;
    case "bpm_orgchart": result = await applyOrgChart(snapshot, params, displayName); break;
    case "project": result = await applyProject(snapshot, params, displayName); break;
    case "survey": result = await applySurvey(tpl, params, displayName); break;
    case "esign": result = await applyEsign(snapshot, params, displayName); break;
    case "workspace": result = await applyWorkspace(tpl, params, displayName); break;
    case "test_mgmt": result = await applyTestMgmt(snapshot, params, displayName); break;
    case "bpml": result = await applyBpml(snapshot, params, displayName); break;
    case "whiteboard": result = await applyWhiteboard(snapshot, params, displayName); break;
    default: throw new Error(`Unknown module: ${module}`);
  }

  await db.update(platformTemplates)
    .set({ usageCount: (tpl.usageCount ?? 0) + 1, updatedAt: new Date() })
    .where(eq(platformTemplates.id, params.templateId));

  return result;
}

async function applyFramework(snap: Record<string, unknown>, params: { tenantId: number }, name: string): Promise<ApplyResult> {
  const [fw] = await db.insert(frameworks).values({
    tenantId: params.tenantId,
    name,
    description: (snap.description as string) ?? null,
    category: (snap.category as string) ?? "other",
    vendor: (snap.vendor as string) ?? null,
    version: (snap.version as string) ?? "1.0",
    status: "draft",
    phases: snap.phases ?? [],
    metadata: snap.metadata ?? null,
    tags: (snap.tags as string[]) ?? null,
  }).returning();
  return { targetId: fw.id, targetModule: "bpm_framework", navigateUrl: "/modules/bpm", name };
}

async function applyBpmDiagram(snap: Record<string, unknown>, params: { tenantId: number; userId: string }, name: string): Promise<ApplyResult> {
  const templateData = snap.templateData as { nodes?: unknown[]; edges?: unknown[] } | undefined;
  const nodes = (snap.nodes as unknown[]) ?? templateData?.nodes ?? [];
  const edges = (snap.edges as unknown[]) ?? templateData?.edges ?? [];

  const [diagram] = await db.insert(bpmDiagrams).values({
    tenantId: params.tenantId,
    name,
    description: (snap.description as string) ?? null,
    type: (snap.type as string) ?? "process_flow",
    status: "draft",
    ownerId: params.userId,
    canvasData: snap.canvasData ?? null,
  }).returning();

  for (const n of nodes as Record<string, unknown>[]) {
    await db.insert(bpmNodes).values({
      diagramId: diagram.id,
      nodeId: String(n.nodeId ?? n.id ?? `node_${Date.now()}`),
      nodeType: String(n.nodeType ?? n.type ?? "task"),
      label: String(n.label ?? ""),
      positionX: String(n.positionX ?? n.x ?? 0),
      positionY: String(n.positionY ?? n.y ?? 0),
      width: n.width ? String(n.width) : null,
      height: n.height ? String(n.height) : null,
      attributes: (n.attributes ?? n.data ?? {}) as Record<string, unknown>,
      style: (n.style ?? {}) as Record<string, unknown>,
    });
  }
  for (const e of edges as Record<string, unknown>[]) {
    await db.insert(bpmEdges).values({
      diagramId: diagram.id,
      edgeId: String(e.edgeId ?? e.id ?? `edge_${Date.now()}`),
      sourceNodeId: String(e.sourceNodeId ?? e.source ?? ""),
      targetNodeId: String(e.targetNodeId ?? e.target ?? ""),
      label: (e.label as string) ?? null,
      edgeType: (e.edgeType as string) ?? "default",
      style: (e.style ?? {}) as Record<string, unknown>,
    });
  }
  return { targetId: diagram.id, targetModule: "bpm_diagram", navigateUrl: "/modules/bpm", name };
}

async function applyOrgChart(snap: Record<string, unknown>, params: { tenantId: number }, name: string): Promise<ApplyResult> {
  const [chart] = await db.insert(orgCharts).values({
    tenantId: params.tenantId,
    name,
    description: (snap.description as string) ?? null,
    chartTitle: (snap.chartTitle as string) ?? name,
    chartType: (snap.chartType as string) ?? "project_team",
    showPhotos: false,
    layoutData: snap.layoutData ?? null,
  }).returning();

  const members = (snap.members as Record<string, unknown>[]) ?? [];
  const idMap = new Map<number, number>();
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const [row] = await db.insert(orgChartMembers).values({
      chartId: chart.id,
      name: String(m.name ?? "Unnamed"),
      title: (m.title as string) ?? null,
      department: (m.department as string) ?? null,
      organisation: (m.organisation as string) ?? null,
      email: (m.email as string) ?? null,
      phone: (m.phone as string) ?? null,
      engagementLevel: (m.engagementLevel as string) ?? null,
      notes: (m.notes as string) ?? null,
      parentMemberId: null,
      sortOrder: Number(m.sortOrder ?? i),
      layoutDirection: (m.layoutDirection as string) ?? "below",
      positionX: String(m.positionX ?? 0),
      positionY: String(m.positionY ?? 0),
    }).returning();
    idMap.set(Number(m._origId ?? i), row.id);
  }
  for (const m of members) {
    const parentOrig = m.parentMemberId as number | null;
    const selfOrig = Number(m._origId ?? m._idx);
    if (parentOrig != null && idMap.has(parentOrig) && idMap.has(selfOrig)) {
      await db.update(orgChartMembers)
        .set({ parentMemberId: idMap.get(parentOrig)! })
        .where(eq(orgChartMembers.id, idMap.get(selfOrig)!));
    }
  }
  return { targetId: chart.id, targetModule: "bpm_orgchart", navigateUrl: "/modules/bpm", name };
}

async function applyProject(snap: Record<string, unknown>, params: { tenantId: number; userId: string }, name: string): Promise<ApplyResult> {
  const [project] = await db.insert(pmProjects).values({
    tenantId: params.tenantId,
    name,
    description: (snap.description as string) ?? null,
    projectType: (snap.projectType as string) ?? "small_project",
    methodology: (snap.methodology as string) ?? "hybrid",
    framework: (snap.framework as string) ?? null,
    status: "draft",
    ownerId: params.userId,
    complexityLevel: (snap.complexityLevel as string) ?? "medium",
    transformationTheme: (snap.transformationTheme as string) ?? null,
    tags: (snap.tags as string[]) ?? null,
    metadata: snap.frameworkId ? { frameworkId: snap.frameworkId } : null,
  }).returning();

  const tools = (snap.tools as { toolType: string; toolCategory: string; label?: string; config?: unknown }[]) ?? [];
  for (let i = 0; i < tools.length; i++) {
    const t = tools[i];
    await db.insert(pmProjectTools).values({
      tenantId: params.tenantId,
      projectId: project.id,
      toolType: t.toolType,
      toolCategory: t.toolCategory,
      label: t.label ?? null,
      isEnabled: true,
      sortOrder: i,
      config: t.config ?? null,
    });
  }
  const workstreamNames = (snap.workstreamNames as string[]) ?? [];
  for (let i = 0; i < workstreamNames.length; i++) {
    await db.insert(pmWorkstreams).values({
      tenantId: params.tenantId,
      projectId: project.id,
      name: workstreamNames[i],
      type: "workstream",
      order: i,
    });
  }
  return { targetId: project.id, targetModule: "project", navigateUrl: `/modules/projects/${project.id}`, name };
}

async function applySurvey(
  tpl: { sourceId: number | null; snapshotJsonb: unknown },
  params: { tenantId: number; userId: string; userName?: string; workspaceId?: number | null },
  name: string,
): Promise<ApplyResult> {
  if (tpl.sourceId) {
    const survey = await surveyService.createSurveyFromTemplate({
      templateId: tpl.sourceId,
      tenantId: params.tenantId,
      userId: params.userId,
      userName: params.userName ?? "User",
      workspaceId: params.workspaceId ?? null,
    });
    return { targetId: survey!.id, targetModule: "survey", navigateUrl: "/modules/surveys", name: survey!.title };
  }
  const snap = tpl.snapshotJsonb as Record<string, unknown>;
  const [survey] = await db.insert(surveys).values({
    tenantId: params.tenantId,
    title: name,
    description: (snap.description as string) ?? null,
    surveyType: (snap.surveyType as string) ?? null,
    category: (snap.category as string) ?? null,
    status: "draft",
    createdBy: params.userId,
    createdByName: params.userName ?? null,
    workspaceId: params.workspaceId ?? null,
  }).returning();
  const questions = (snap.questionsJson as Record<string, unknown>[]) ?? [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await db.insert(surveyQuestions).values({
      surveyId: survey.id,
      type: String(q.type ?? "mc"),
      text: String(q.text ?? "Question"),
      helpText: (q.helpText as string) ?? null,
      options: (q.options as string[]) ?? [],
      required: Boolean(q.required ?? true),
      questionOrder: i + 1,
      scaleMin: Number(q.scaleMin ?? 1),
      scaleMax: Number(q.scaleMax ?? 10),
      isSection: Boolean(q.isSection ?? false),
    });
  }
  return { targetId: survey.id, targetModule: "survey", navigateUrl: "/modules/surveys", name };
}

async function applyEsign(snap: Record<string, unknown>, params: { tenantId: number; userId: string; userName?: string }, name: string): Promise<ApplyResult> {
  const [req] = await db.insert(signoffRequests).values({
    tenantId: params.tenantId,
    title: name,
    description: (snap.description as string) ?? null,
    sourceType: (snap.sourceType as string) ?? "inline_doc",
    contentHtml: (snap.contentHtml as string) ?? null,
    fileName: (snap.fileName as string) ?? null,
    fileType: (snap.fileType as string) ?? null,
    status: "draft",
    createdBy: params.userId,
    createdByName: params.userName ?? null,
  }).returning();
  return { targetId: req.id, targetModule: "esign", navigateUrl: "/modules/e-sign", name };
}

async function applyWorkspace(
  tpl: { id: number; sourceId: number | null; snapshotJsonb: unknown },
  params: { tenantId: number; userId: string },
  name: string,
): Promise<ApplyResult> {
  if (tpl.sourceId) {
    const workspace = await wsService.createWorkspaceFromTemplate(params.tenantId, params.userId, tpl.sourceId, { name });
    return { targetId: workspace.id, targetModule: "workspace", navigateUrl: "/modules/workspaces", name: workspace.name };
  }
  const snapshot = tpl.snapshotJsonb as Record<string, unknown>;
  if (snapshot && (snapshot.pages || snapshot.structure)) {
    const workspace = await wsService.createWorkspaceFromSnapshot(
      params.tenantId,
      params.userId,
      snapshot,
      name,
    );
    return { targetId: workspace.id, targetModule: "workspace", navigateUrl: "/modules/workspaces", name: workspace.name };
  }
  throw new Error("Workspace template has no structure to apply");
}

async function applyBpml(snap: Record<string, unknown>, params: { tenantId: number }, name: string): Promise<ApplyResult> {
  const [tpl] = await db.insert(bpmlTemplates).values({
    tenantId: params.tenantId,
    name,
    description: (snap.description as string) ?? null,
    templateType: (snap.templateType as string) ?? "standard",
    erpPlatform: (snap.erpPlatform as string) ?? null,
    processArea: (snap.processArea as string) ?? null,
    visibleSections: snap.visibleSections ?? ["core", "ownership"],
    visibleFields: snap.visibleFields ?? null,
    customFields: snap.customFields ?? [],
    processIdPrefix: (snap.processIdPrefix as string) ?? "P-",
    status: "active",
  }).returning();

  const entries = (snap.entries as Record<string, unknown>[]) ?? [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    await db.insert(bpmlEntries).values({
      templateId: tpl.id,
      tenantId: params.tenantId,
      processName: String(e.processName ?? `Process ${i + 1}`),
      processCode: (e.processCode as string) ?? null,
      processShortName: (e.processShortName as string) ?? null,
      processDescription: (e.processDescription as string) ?? null,
      businessArea: (e.businessArea as string) ?? null,
      businessFunction: (e.businessFunction as string) ?? null,
      moduleArea: (e.moduleArea as string) ?? null,
      level1: (e.level1 as string) ?? null,
      level2: (e.level2 as string) ?? null,
      level3: (e.level3 as string) ?? null,
      level4: (e.level4 as string) ?? null,
      sequenceOrder: Number(e.sequenceOrder ?? i),
    });
  }
  return { targetId: tpl.id, targetModule: "bpml", navigateUrl: "/modules/bpm", name };
}

async function applyTestMgmt(
  snap: Record<string, unknown>,
  params: { tenantId: number; userId: string; projectId?: number | null },
  _name: string,
): Promise<ApplyResult> {
  const projectId = params.projectId ?? (snap.projectId as number);
  if (!projectId) throw new Error("Target project is required for test management templates");

  const hierarchy = snap.hierarchy as {
    areas: { name: string; description?: string; sortOrder?: number }[];
    processes: { areaIndex: number; name: string; description?: string; priority?: string; sortOrder?: number }[];
    scenarios: { processIndex: number; name: string; description?: string; priority?: string; scenarioId?: string }[];
    testCases: { scenarioIndex: number; title: string; description?: string; priority?: string; caseType?: string; steps?: { stepOrder: number; action: string; expectedResult?: string }[] }[];
  };

  const areaIds: number[] = [];
  for (const a of hierarchy.areas ?? []) {
    const [row] = await db.insert(tmBusinessAreas).values({
      tenantId: params.tenantId, projectId, name: a.name,
      description: a.description ?? null, sortOrder: a.sortOrder ?? 0,
    }).returning();
    areaIds.push(row.id);
  }

  const processIds: number[] = [];
  for (const p of hierarchy.processes ?? []) {
    const areaId = areaIds[p.areaIndex];
    if (!areaId) continue;
    const [row] = await db.insert(tmBusinessProcesses).values({
      tenantId: params.tenantId, projectId, businessAreaId: areaId,
      name: p.name, description: p.description ?? null,
      priority: p.priority ?? "medium", sortOrder: p.sortOrder ?? 0,
    }).returning();
    processIds.push(row.id);
  }

  const scenarioIds: number[] = [];
  let scenarioCounter = 0;
  for (const s of hierarchy.scenarios ?? []) {
    const processId = processIds[s.processIndex];
    if (!processId) continue;
    scenarioCounter++;
    const [row] = await db.insert(tmScenarios).values({
      tenantId: params.tenantId, projectId, businessProcessId: processId,
      scenarioId: s.scenarioId ?? `SC-${scenarioCounter}`,
      title: s.name, description: s.description ?? null, priority: s.priority ?? "medium",
    }).returning();
    scenarioIds.push(row.id);
  }

  for (const tc of hierarchy.testCases ?? []) {
    const scenarioId = scenarioIds[tc.scenarioIndex];
    if (!scenarioId) continue;
    const [caseRow] = await db.insert(tmTestCases).values({
      tenantId: params.tenantId, projectId, scenarioId,
      title: tc.title, description: tc.description ?? null,
      priority: tc.priority ?? "medium", caseType: tc.caseType ?? "manual",
    }).returning();
    for (const st of tc.steps ?? []) {
      await db.insert(tmTestSteps).values({
        testCaseId: caseRow.id,
        stepOrder: st.stepOrder,
        action: st.action,
        expectedResult: st.expectedResult ?? null,
      });
    }
  }
  return { targetId: projectId, targetModule: "test_mgmt", navigateUrl: "/modules/test-mgmt", name: "Test hierarchy applied" };
}

async function applyWhiteboard(
  snap: Record<string, unknown>,
  params: { tenantId: number; userId: string; workspaceId?: number | null; projectId?: number | null },
  name: string,
): Promise<ApplyResult> {
  const [board] = await db.insert(whiteboards).values({
    tenantId: params.tenantId,
    name,
    description: (snap.description as string) ?? null,
    ownerId: params.userId,
    projectId: params.projectId ?? null,
    workspaceId: params.workspaceId ?? null,
  }).returning();

  const notes = (snap.notes as Record<string, unknown>[]) ?? [];
  for (const n of notes) {
    await db.insert(stickyNotes).values({
      whiteboardId: board.id,
      text: "",
      noteType: String(n.noteType ?? "idea"),
      colourHex: (n.colourHex as string) ?? null,
      xPosition: Number(n.xPosition ?? 0),
      yPosition: Number(n.yPosition ?? 0),
      width: Number(n.width ?? 200),
      height: Number(n.height ?? 200),
      createdBy: params.userId,
    });
  }
  return {
    targetId: board.id,
    targetModule: "whiteboard",
    navigateUrl: `/modules/whiteboarding/${board.id}`,
    name,
  };
}
