import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import type { TemplateModule } from "@shared/models/templates";
import {
  bpmTemplates,
  surveyTemplates,
  surveys,
  surveyQuestions,
  signoffTemplates,
  signoffRequests,
  workspaceTemplates,
  workspaceDatabases,
  workspaceDatabaseColumns,
  bpmlTemplates,
  bpmlEntries,
  orgCharts,
  orgChartMembers,
  tmBusinessAreas,
  tmBusinessProcesses,
  tmScenarios,
  tmTestCases,
  tmTestSteps,
  whiteboards,
  stickyNotes
} from "@shared/schema";

export async function buildSnapshot(module: TemplateModule, sourceId: number, tenantId: number): Promise<Record<string, unknown>> {
  switch (module) {
    case "bpm_framework": return snapshotFramework(sourceId, tenantId);
    case "bpm_diagram": return snapshotBpmDiagram(sourceId, tenantId);
    case "bpm_orgchart": return snapshotOrgChart(sourceId, tenantId);
    case "project": return snapshotProject(sourceId, tenantId);
    case "survey": return snapshotSurvey(sourceId, tenantId);
    case "esign": return snapshotEsign(sourceId, tenantId);
    case "workspace": return snapshotWorkspace(sourceId, tenantId);
    case "test_mgmt": return snapshotTestMgmt(sourceId, tenantId);
    case "bpml": return snapshotBpml(sourceId, tenantId);
    case "whiteboard": return snapshotWhiteboard(sourceId, tenantId);
    default: throw new Error(`Unknown module: ${module}`);
  }
}

async function snapshotFramework(id: number, tenantId: number) {
  const fw = await storage.getFramework(id);
  if (!fw || fw.tenantId !== tenantId) throw new Error("Framework not found");
  return {
    name: fw.name,
    description: fw.description,
    category: fw.category,
    vendor: fw.vendor,
    version: fw.version,
    phases: fw.phases,
    metadata: fw.metadata,
    tags: fw.tags,
  };
}

async function snapshotBpmDiagram(id: number, tenantId: number) {
  const diagram = await storage.getBpmDiagram(id);
  if (!diagram || diagram.tenantId !== tenantId) throw new Error("Diagram not found");
  const nodes = await storage.getBpmNodes(id);
  const edges = await storage.getBpmEdges(id);
  return {
    name: diagram.name,
    description: diagram.description,
    type: diagram.type,
    canvasData: diagram.canvasData,
    nodes: nodes.map(n => ({
      nodeId: n.nodeId, nodeType: n.nodeType, label: n.label,
      positionX: n.positionX, positionY: n.positionY,
      width: n.width, height: n.height, attributes: n.attributes, style: n.style,
    })),
    edges: edges.map(e => ({
      edgeId: e.edgeId, sourceNodeId: e.sourceNodeId, targetNodeId: e.targetNodeId,
      label: e.label, edgeType: e.edgeType, style: e.style,
    })),
  };
}

async function snapshotOrgChart(id: number, tenantId: number) {
  const [chart] = await db.select().from(orgCharts).where(and(eq(orgCharts.id, id), eq(orgCharts.tenantId, tenantId)));
  if (!chart) throw new Error("Org chart not found");
  const members = await db.select().from(orgChartMembers).where(eq(orgChartMembers.chartId, id));
  return {
    name: chart.name,
    description: chart.description,
    chartTitle: chart.chartTitle,
    chartType: chart.chartType,
    showPhotos: false,
    layoutData: chart.layoutData,
    members: members.map((m, idx) => ({
      _idx: idx,
      _origId: m.id,
      name: m.name, title: m.title, department: m.department,
      organisation: m.organisation, email: m.email, phone: m.phone,
      engagementLevel: m.engagementLevel, notes: m.notes,
      parentMemberId: m.parentMemberId, sortOrder: m.sortOrder,
      layoutDirection: m.layoutDirection, positionX: m.positionX, positionY: m.positionY,
    })),
  };
}

async function snapshotProject(id: number, tenantId: number) {
  const project = await storage.getPmProject(id);
  if (!project || project.tenantId !== tenantId) throw new Error("Project not found");
  const tools = await storage.getPmProjectTools(id);
  const workstreams = await storage.getPmWorkstreams(id);
  return {
    name: project.name,
    description: project.description,
    projectType: project.projectType,
    methodology: project.methodology,
    framework: project.framework,
    frameworkId: (project.metadata as Record<string, unknown>)?.frameworkId ?? null,
    tools: tools.filter(t => t.isEnabled).map(t => ({
      toolType: t.toolType, toolCategory: t.toolCategory, label: t.label, config: t.config,
    })),
    workstreamNames: workstreams.map(w => w.name),
    tags: project.tags,
    complexityLevel: project.complexityLevel,
    transformationTheme: project.transformationTheme,
  };
}

async function snapshotSurvey(id: number, tenantId: number) {
  const [tpl] = await db.select().from(surveyTemplates).where(eq(surveyTemplates.id, id));
  if (tpl) {
    return {
      title: tpl.title, description: tpl.description, surveyType: tpl.surveyType,
      category: tpl.category, questionsJson: tpl.questionsJson, settingsJson: tpl.settingsJson,
    };
  }
  const survey = await db.select().from(surveys).where(and(eq(surveys.id, id), eq(surveys.tenantId, tenantId))).limit(1);
  if (!survey[0]) throw new Error("Survey not found");
  const questions = await db.select().from(surveyQuestions).where(eq(surveyQuestions.surveyId, id));
  return {
    title: survey[0].title, description: survey[0].description,
    surveyType: survey[0].surveyType, category: survey[0].category,
    questionsJson: questions.map(({ id: _id, surveyId: _s, createdAt: _c, ...q }) => q),
    settingsJson: {
      anonymous: survey[0].anonymous, showProgress: survey[0].showProgress,
      onePerPage: survey[0].onePerPage, randomizeQuestions: survey[0].randomizeQuestions,
    },
  };
}

async function snapshotEsign(id: number, tenantId: number) {
  const [tpl] = await db.select().from(signoffTemplates).where(eq(signoffTemplates.id, id));
  if (tpl && (tpl.tenantId === tenantId || tpl.tier === "system")) {
    return {
      title: tpl.title, description: tpl.description, category: tpl.category,
      sourceType: tpl.sourceType, contentHtml: tpl.contentHtml,
      fileName: tpl.fileName, fileType: tpl.fileType,
    };
  }
  const req = await db.select().from(signoffRequests).where(and(eq(signoffRequests.id, id), eq(signoffRequests.tenantId, tenantId))).limit(1);
  if (!req[0]) throw new Error("eSign document not found");
  return {
    title: req[0].title, description: req[0].description,
    sourceType: req[0].sourceType === "upload" ? "upload" : "inline_doc",
    contentHtml: req[0].contentHtml, fileName: req[0].fileName, fileType: req[0].fileType,
  };
}

async function snapshotWorkspace(id: number, tenantId: number) {
  const [tpl] = await db.select().from(workspaceTemplates).where(eq(workspaceTemplates.id, id));
  if (tpl) return { structure: tpl.structure, name: tpl.name, description: tpl.description, category: tpl.category };
  const workspace = await storage.getWorkspace(id);
  if (!workspace || workspace.tenantId !== tenantId) throw new Error("Workspace not found");
  const pages = await storage.getWorkspacePages(id);
  const pageIds = pages.map(p => p.id);
  const databases = pageIds.length
    ? await db.select().from(workspaceDatabases).where(inArray(workspaceDatabases.pageId, pageIds))
    : [];
  const databaseIds = databases.map(d => d.id);
  const columns = databaseIds.length
    ? await db.select().from(workspaceDatabaseColumns).where(inArray(workspaceDatabaseColumns.databaseId, databaseIds))
    : [];
  return {
    name: workspace.name, description: workspace.description,
    icon: workspace.icon, color: workspace.color,
    pages: pages.map(page => ({
      title: page.title, description: page.description, icon: page.icon,
      content: page.content, pageType: page.pageType, documentStatus: page.documentStatus,
      sortOrder: page.sortOrder,
      databases: databases.filter(d => d.pageId === page.id).map(dbRow => ({
        name: dbRow.name, activeView: dbRow.activeView,
        columns: columns.filter(c => c.databaseId === dbRow.id).map(col => ({
          name: col.name, type: col.type, options: col.options, sortOrder: col.sortOrder,
          width: col.width, isVisible: col.isVisible,
        })),
      })),
    })),
  };
}

async function snapshotBpml(id: number, tenantId: number) {
  const [tpl] = await db.select().from(bpmlTemplates).where(and(eq(bpmlTemplates.id, id), eq(bpmlTemplates.tenantId, tenantId)));
  if (!tpl) throw new Error("BPML template not found");
  const entries = await db.select().from(bpmlEntries).where(eq(bpmlEntries.templateId, id));
  return {
    name: tpl.name, description: tpl.description, templateType: tpl.templateType,
    erpPlatform: tpl.erpPlatform, processArea: tpl.processArea,
    visibleSections: tpl.visibleSections, visibleFields: tpl.visibleFields,
    customFields: tpl.customFields, processIdPrefix: tpl.processIdPrefix,
    entries: entries.map(e => ({
      processName: e.processName, processCode: e.processCode, processShortName: e.processShortName,
      processDescription: e.processDescription, businessArea: e.businessArea,
      businessFunction: e.businessFunction, moduleArea: e.moduleArea,
      level1: e.level1, level2: e.level2, level3: e.level3, level4: e.level4,
      sequenceOrder: e.sequenceOrder,
    })),
  };
}

async function snapshotTestMgmt(id: number, tenantId: number) {
  const areas = await db.select().from(tmBusinessAreas).where(and(eq(tmBusinessAreas.projectId, id), eq(tmBusinessAreas.tenantId, tenantId)));
  const areaIds = areas.map(a => a.id);
  const processes = areaIds.length
    ? await db.select().from(tmBusinessProcesses).where(inArray(tmBusinessProcesses.businessAreaId, areaIds))
    : [];
  const processIds = processes.map(p => p.id);
  const scenarios = processIds.length
    ? await db.select().from(tmScenarios).where(inArray(tmScenarios.businessProcessId, processIds))
    : [];
  const scenarioIds = scenarios.map(s => s.id);
  const testCases = scenarioIds.length
    ? await db.select().from(tmTestCases).where(inArray(tmTestCases.scenarioId, scenarioIds))
    : [];
  const caseIds = testCases.map(c => c.id);
  const steps = caseIds.length
    ? await db.select().from(tmTestSteps).where(inArray(tmTestSteps.testCaseId, caseIds))
    : [];
  return {
    projectId: id,
    hierarchy: {
      areas: areas.map(a => ({ name: a.name, description: a.description, sortOrder: a.sortOrder })),
      processes: processes.map(p => ({
        areaIndex: areas.findIndex(a => a.id === p.businessAreaId),
        name: p.name, description: p.description, priority: p.priority, sortOrder: p.sortOrder,
      })),
    scenarios: scenarios.map((s, idx) => ({
      processIndex: processes.findIndex(p => p.id === s.businessProcessId),
      name: s.title, description: s.description, priority: s.priority,
      scenarioId: s.scenarioId ?? `SC-${idx + 1}`,
    })),
    testCases: testCases.map(tc => ({
      scenarioIndex: scenarios.findIndex(s => s.id === tc.scenarioId),
      title: tc.title, description: tc.description, priority: tc.priority, caseType: tc.caseType,
      steps: steps.filter(st => st.testCaseId === tc.id).map(st => ({
        stepOrder: st.stepOrder, action: st.action, expectedResult: st.expectedResult,
      })),
    })),
    },
  };
}

async function snapshotWhiteboard(id: number, tenantId: number) {
  const [board] = await db.select().from(whiteboards).where(and(eq(whiteboards.id, id), eq(whiteboards.tenantId, tenantId)));
  if (!board) throw new Error("Whiteboard not found");
  const notes = await db.select().from(stickyNotes).where(
    and(eq(stickyNotes.whiteboardId, id), eq(stickyNotes.isDeleted, false)),
  );
  return {
    name: board.name,
    description: board.description,
    notes: notes.map(n => ({
      noteType: n.noteType,
      colourHex: n.colourHex,
      xPosition: n.xPosition,
      yPosition: n.yPosition,
      width: n.width,
      height: n.height,
      text: "",
    })),
  };
}

/** Build snapshot from legacy bpm_templates row */
export async function snapshotFromBpmTemplate(templateId: number) {
  const [tpl] = await db.select().from(bpmTemplates).where(eq(bpmTemplates.id, templateId));
  if (!tpl) throw new Error("BPM template not found");
  return {
    name: tpl.name, description: tpl.description, type: tpl.type,
    category: tpl.category, vendor: tpl.vendor, processType: tpl.processType,
    templateData: tpl.templateData,
  };
}
