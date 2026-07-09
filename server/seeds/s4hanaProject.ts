import { db } from "../db";
import { 
  pmProjects, pmProjectPhases, pmWorkstreams, pmTasks, pmMilestones
} from "@shared/models/projects";
import { eq } from "drizzle-orm";

interface SeedResult {
  project: any;
  phases: number;
  workstreams: number;
  activities: number;
  tasks: number;
}

export async function seedS4HanaProject(tenantId: number, projectId?: number): Promise<SeedResult> {
  let project: any;
  
  if (projectId) {
    const existingProjects = await db.select().from(pmProjects).where(eq(pmProjects.id, projectId));
    if (existingProjects.length > 0) {
      project = existingProjects[0];
      await db.update(pmProjects).set({
        name: "S/4HANA Implementation",
        description: "Enterprise S/4HANA implementation project covering all phases from discovery to deployment",
        startDate: "2026-03-01",
        endDate: "2026-12-31",
        methodology: "hybrid",
        status: "active",
        progress: 0,
      }).where(eq(pmProjects.id, projectId));
      
      await db.delete(pmTasks).where(eq(pmTasks.projectId, projectId));
      await db.delete(pmMilestones).where(eq(pmMilestones.projectId, projectId));
      await db.delete(pmWorkstreams).where(eq(pmWorkstreams.projectId, projectId));
      await db.delete(pmProjectPhases).where(eq(pmProjectPhases.projectId, projectId));
    }
  }
  
  if (!project) {
    const [newProject] = await db.insert(pmProjects).values({
      tenantId,
      name: "S/4HANA Implementation",
      description: "Enterprise S/4HANA implementation project covering all phases from discovery to deployment",
      code: "S4H-2026",
      projectType: "large_project",
      methodology: "hybrid",
      status: "active",
      startDate: "2026-03-01",
      endDate: "2026-12-31",
      progress: 0,
    }).returning();
    project = newProject;
  }
  
  const projId = project.id;

  const phasesData = [
    { name: "Discovery", start: "2026-03-01", end: "2026-03-31", order: 1, phaseNumber: 1 },
    { name: "Prepare", start: "2026-04-01", end: "2026-05-15", order: 2, phaseNumber: 2 },
    { name: "Design", start: "2026-05-16", end: "2026-06-30", order: 3, phaseNumber: 3 },
    { name: "Build", start: "2026-07-01", end: "2026-09-15", order: 4, phaseNumber: 4 },
    { name: "Test", start: "2026-09-16", end: "2026-10-31", order: 5, phaseNumber: 5 },
    { name: "Deploy", start: "2026-11-01", end: "2026-11-30", order: 6, phaseNumber: 6 },
  ];

  const phaseMap: Record<string, number> = {};
  let phaseCount = 0;
  
  for (const phase of phasesData) {
    const [inserted] = await db.insert(pmProjectPhases).values({
      tenantId,
      projectId: projId,
      name: phase.name,
      phaseNumber: phase.phaseNumber,
      plannedStartDate: phase.start,
      plannedEndDate: phase.end,
      order: phase.order,
      status: "not_started",
      progress: 0,
    }).returning();
    phaseMap[phase.name] = inserted.id;
    phaseCount++;
  }

  const workstreamsData: { phase: string; name: string; start: string; end: string; order: number }[] = [
    { phase: "Discovery", name: "Requirements Gathering", start: "2026-03-01", end: "2026-03-15", order: 1 },
    { phase: "Discovery", name: "Technical Assessment", start: "2026-03-01", end: "2026-03-20", order: 2 },
    { phase: "Prepare", name: "Project Planning", start: "2026-04-01", end: "2026-04-10", order: 1 },
    { phase: "Prepare", name: "System Setup", start: "2026-04-05", end: "2026-04-25", order: 2 },
    { phase: "Design", name: "Solution Design", start: "2026-05-16", end: "2026-06-05", order: 1 },
    { phase: "Design", name: "Security & Compliance", start: "2026-05-20", end: "2026-06-15", order: 2 },
    { phase: "Build", name: "Configuration", start: "2026-07-01", end: "2026-08-15", order: 1 },
    { phase: "Build", name: "Data Migration", start: "2026-07-05", end: "2026-08-30", order: 2 },
    { phase: "Test", name: "Unit Testing", start: "2026-09-16", end: "2026-09-25", order: 1 },
    { phase: "Test", name: "Integration Testing", start: "2026-09-26", end: "2026-10-10", order: 2 },
    { phase: "Test", name: "UAT", start: "2026-10-11", end: "2026-10-31", order: 3 },
    { phase: "Deploy", name: "Cutover Planning", start: "2026-11-01", end: "2026-11-10", order: 1 },
  ];

  const wsMap: Record<string, number> = {};
  let wsCount = 0;
  
  for (const ws of workstreamsData) {
    const [inserted] = await db.insert(pmWorkstreams).values({
      tenantId,
      projectId: projId,
      phaseId: phaseMap[ws.phase],
      type: "workstream",
      name: ws.name,
      wbsCode: `1.${phasesData.findIndex(p => p.name === ws.phase) + 1}.${ws.order}`,
      plannedStartDate: ws.start,
      plannedEndDate: ws.end,
      order: ws.order,
      status: "not_started",
      progress: 0,
    }).returning();
    wsMap[`${ws.phase}-${ws.name}`] = inserted.id;
    wsCount++;
  }

  const activitiesData: { phase: string; workstream: string; name: string; start: string; end: string; order: number }[] = [
    { phase: "Discovery", workstream: "Requirements Gathering", name: "Stakeholder Interviews", start: "2026-03-01", end: "2026-03-05", order: 1 },
    { phase: "Discovery", workstream: "Requirements Gathering", name: "Process Mapping", start: "2026-03-06", end: "2026-03-12", order: 2 },
    { phase: "Discovery", workstream: "Requirements Gathering", name: "Requirement Documentation", start: "2026-03-13", end: "2026-03-15", order: 3 },
    { phase: "Discovery", workstream: "Technical Assessment", name: "System Landscape Review", start: "2026-03-01", end: "2026-03-07", order: 1 },
    { phase: "Discovery", workstream: "Technical Assessment", name: "Integration Points", start: "2026-03-08", end: "2026-03-14", order: 2 },
    { phase: "Discovery", workstream: "Technical Assessment", name: "Technical Feasibility Report", start: "2026-03-15", end: "2026-03-20", order: 3 },
    { phase: "Prepare", workstream: "Project Planning", name: "Resource Allocation", start: "2026-04-01", end: "2026-04-03", order: 1 },
    { phase: "Prepare", workstream: "Project Planning", name: "Project Schedule", start: "2026-04-04", end: "2026-04-07", order: 2 },
    { phase: "Prepare", workstream: "System Setup", name: "Hardware Provisioning", start: "2026-04-05", end: "2026-04-12", order: 1 },
    { phase: "Prepare", workstream: "System Setup", name: "Software Installation", start: "2026-04-13", end: "2026-04-20", order: 2 },
    { phase: "Prepare", workstream: "System Setup", name: "Environment Validation", start: "2026-04-21", end: "2026-04-25", order: 3 },
    { phase: "Design", workstream: "Solution Design", name: "Process Blueprint", start: "2026-05-16", end: "2026-05-25", order: 1 },
    { phase: "Design", workstream: "Solution Design", name: "Integration Design", start: "2026-05-26", end: "2026-06-05", order: 2 },
    { phase: "Design", workstream: "Security & Compliance", name: "Access Controls", start: "2026-05-20", end: "2026-05-30", order: 1 },
    { phase: "Design", workstream: "Security & Compliance", name: "Compliance Review", start: "2026-06-01", end: "2026-06-10", order: 2 },
    { phase: "Design", workstream: "Security & Compliance", name: "Risk Assessment", start: "2026-06-11", end: "2026-06-15", order: 3 },
    { phase: "Build", workstream: "Configuration", name: "Module Configuration", start: "2026-07-01", end: "2026-07-20", order: 1 },
    { phase: "Build", workstream: "Configuration", name: "Custom Development", start: "2026-07-21", end: "2026-08-05", order: 2 },
    { phase: "Build", workstream: "Configuration", name: "Unit Testing", start: "2026-08-06", end: "2026-08-15", order: 3 },
    { phase: "Build", workstream: "Data Migration", name: "Data Mapping", start: "2026-07-05", end: "2026-07-20", order: 1 },
    { phase: "Build", workstream: "Data Migration", name: "Data Load", start: "2026-07-21", end: "2026-08-10", order: 2 },
    { phase: "Build", workstream: "Data Migration", name: "Data Validation", start: "2026-08-11", end: "2026-08-30", order: 3 },
    { phase: "Test", workstream: "Unit Testing", name: "Module Testing", start: "2026-09-16", end: "2026-09-20", order: 1 },
    { phase: "Test", workstream: "Unit Testing", name: "Custom Development Testing", start: "2026-09-21", end: "2026-09-25", order: 2 },
    { phase: "Test", workstream: "Integration Testing", name: "End-to-End Scenarios", start: "2026-09-26", end: "2026-10-05", order: 1 },
    { phase: "Test", workstream: "Integration Testing", name: "Integration Validation", start: "2026-10-06", end: "2026-10-10", order: 2 },
    { phase: "Test", workstream: "UAT", name: "UAT Planning", start: "2026-10-11", end: "2026-10-15", order: 1 },
    { phase: "Test", workstream: "UAT", name: "UAT Execution", start: "2026-10-16", end: "2026-10-25", order: 2 },
    { phase: "Test", workstream: "UAT", name: "UAT Sign-Off", start: "2026-10-26", end: "2026-10-31", order: 3 },
    { phase: "Deploy", workstream: "Cutover Planning", name: "Cutover Schedule", start: "2026-11-01", end: "2026-11-05", order: 1 },
    { phase: "Deploy", workstream: "Cutover Planning", name: "Go-Live Prep", start: "2026-11-06", end: "2026-11-10", order: 2 },
  ];

  const actMap: Record<string, number> = {};
  let actCount = 0;
  
  for (const act of activitiesData) {
    const wsKey = `${act.phase}-${act.workstream}`;
    const phaseIdx = phasesData.findIndex(p => p.name === act.phase) + 1;
    const wsIdx = workstreamsData.filter(w => w.phase === act.phase).findIndex(w => w.name === act.workstream) + 1;
    
    const [inserted] = await db.insert(pmWorkstreams).values({
      tenantId,
      projectId: projId,
      phaseId: phaseMap[act.phase],
      parentWorkstreamId: wsMap[wsKey],
      type: "activity",
      name: act.name,
      wbsCode: `1.${phaseIdx}.${wsIdx}.${act.order}`,
      plannedStartDate: act.start,
      plannedEndDate: act.end,
      order: act.order,
      status: "not_started",
      progress: 0,
    }).returning();
    actMap[`${wsKey}-${act.name}`] = inserted.id;
    actCount++;
  }

  const tasksData: { phase: string; workstream: string; activity: string; name: string; start: string; end: string; duration: number; resource: string; order: number; dependency?: string }[] = [
    { phase: "Discovery", workstream: "Requirements Gathering", activity: "Stakeholder Interviews", name: "Schedule Interviews", start: "2026-03-01", end: "2026-03-01", duration: 1, resource: "PM", order: 1 },
    { phase: "Discovery", workstream: "Requirements Gathering", activity: "Stakeholder Interviews", name: "Conduct Interviews", start: "2026-03-02", end: "2026-03-05", duration: 4, resource: "BA", order: 2, dependency: "Schedule Interviews" },
    { phase: "Discovery", workstream: "Requirements Gathering", activity: "Process Mapping", name: "Map Current Processes", start: "2026-03-06", end: "2026-03-08", duration: 3, resource: "BA", order: 1 },
    { phase: "Discovery", workstream: "Requirements Gathering", activity: "Process Mapping", name: "Validate with Stakeholders", start: "2026-03-09", end: "2026-03-12", duration: 4, resource: "BA", order: 2, dependency: "Map Current Processes" },
    { phase: "Discovery", workstream: "Requirements Gathering", activity: "Requirement Documentation", name: "Draft Requirements", start: "2026-03-13", end: "2026-03-14", duration: 2, resource: "BA", order: 1 },
    { phase: "Discovery", workstream: "Requirements Gathering", activity: "Requirement Documentation", name: "Review & Finalize", start: "2026-03-15", end: "2026-03-15", duration: 1, resource: "PM", order: 2, dependency: "Draft Requirements" },
    { phase: "Discovery", workstream: "Technical Assessment", activity: "System Landscape Review", name: "Identify Current Systems", start: "2026-03-01", end: "2026-03-03", duration: 3, resource: "Tech Lead", order: 1 },
    { phase: "Discovery", workstream: "Technical Assessment", activity: "System Landscape Review", name: "Document Interfaces", start: "2026-03-04", end: "2026-03-07", duration: 4, resource: "Tech Lead", order: 2, dependency: "Identify Current Systems" },
    { phase: "Discovery", workstream: "Technical Assessment", activity: "Integration Points", name: "List Integration Dependencies", start: "2026-03-08", end: "2026-03-10", duration: 3, resource: "Tech Lead", order: 1 },
    { phase: "Discovery", workstream: "Technical Assessment", activity: "Integration Points", name: "Validate with IT", start: "2026-03-11", end: "2026-03-14", duration: 4, resource: "IT Team", order: 2, dependency: "List Integration Dependencies" },
    { phase: "Discovery", workstream: "Technical Assessment", activity: "Technical Feasibility Report", name: "Draft Report", start: "2026-03-15", end: "2026-03-18", duration: 4, resource: "Tech Lead", order: 1 },
    { phase: "Discovery", workstream: "Technical Assessment", activity: "Technical Feasibility Report", name: "Review & Approve", start: "2026-03-19", end: "2026-03-20", duration: 2, resource: "PM", order: 2, dependency: "Draft Report" },
    { phase: "Prepare", workstream: "Project Planning", activity: "Resource Allocation", name: "Assign Team Members", start: "2026-04-01", end: "2026-04-01", duration: 1, resource: "PM", order: 1 },
    { phase: "Prepare", workstream: "Project Planning", activity: "Resource Allocation", name: "Confirm Availability", start: "2026-04-02", end: "2026-04-03", duration: 2, resource: "PM", order: 2, dependency: "Assign Team Members" },
    { phase: "Prepare", workstream: "Project Planning", activity: "Project Schedule", name: "Draft Schedule", start: "2026-04-04", end: "2026-04-05", duration: 2, resource: "PM", order: 1 },
    { phase: "Prepare", workstream: "Project Planning", activity: "Project Schedule", name: "Review & Approve", start: "2026-04-06", end: "2026-04-07", duration: 2, resource: "PM", order: 2, dependency: "Draft Schedule" },
    { phase: "Prepare", workstream: "System Setup", activity: "Hardware Provisioning", name: "Order Servers & Network", start: "2026-04-05", end: "2026-04-07", duration: 3, resource: "IT Team", order: 1 },
    { phase: "Prepare", workstream: "System Setup", activity: "Hardware Provisioning", name: "Setup Hardware", start: "2026-04-08", end: "2026-04-12", duration: 5, resource: "IT Team", order: 2, dependency: "Order Servers & Network" },
    { phase: "Prepare", workstream: "System Setup", activity: "Software Installation", name: "Install OS & DB", start: "2026-04-13", end: "2026-04-16", duration: 4, resource: "IT Team", order: 1 },
    { phase: "Prepare", workstream: "System Setup", activity: "Software Installation", name: "Install SAP Components", start: "2026-04-17", end: "2026-04-20", duration: 4, resource: "IT Team", order: 2, dependency: "Install OS & DB" },
    { phase: "Prepare", workstream: "System Setup", activity: "Environment Validation", name: "Validate Dev & Test", start: "2026-04-21", end: "2026-04-23", duration: 3, resource: "IT Team", order: 1 },
    { phase: "Prepare", workstream: "System Setup", activity: "Environment Validation", name: "Validate Prod", start: "2026-04-24", end: "2026-04-25", duration: 2, resource: "IT Team", order: 2, dependency: "Validate Dev & Test" },
    { phase: "Design", workstream: "Solution Design", activity: "Process Blueprint", name: "Draft Blueprint", start: "2026-05-16", end: "2026-05-20", duration: 5, resource: "Solution Architect", order: 1 },
    { phase: "Design", workstream: "Solution Design", activity: "Process Blueprint", name: "Review Blueprint", start: "2026-05-21", end: "2026-05-25", duration: 5, resource: "PM", order: 2, dependency: "Draft Blueprint" },
    { phase: "Design", workstream: "Solution Design", activity: "Integration Design", name: "Define Interfaces", start: "2026-05-26", end: "2026-05-30", duration: 5, resource: "Tech Lead", order: 1 },
    { phase: "Design", workstream: "Solution Design", activity: "Integration Design", name: "Validate with IT", start: "2026-06-01", end: "2026-06-05", duration: 5, resource: "Tech Lead", order: 2, dependency: "Define Interfaces" },
    { phase: "Design", workstream: "Security & Compliance", activity: "Access Controls", name: "Define Roles", start: "2026-05-20", end: "2026-05-25", duration: 4, resource: "Security Lead", order: 1 },
    { phase: "Design", workstream: "Security & Compliance", activity: "Access Controls", name: "Assign Permissions", start: "2026-05-26", end: "2026-05-30", duration: 5, resource: "Security Lead", order: 2, dependency: "Define Roles" },
    { phase: "Design", workstream: "Security & Compliance", activity: "Compliance Review", name: "Internal Review", start: "2026-06-01", end: "2026-06-05", duration: 5, resource: "Security Lead", order: 1 },
    { phase: "Design", workstream: "Security & Compliance", activity: "Compliance Review", name: "Approval", start: "2026-06-06", end: "2026-06-10", duration: 5, resource: "PM", order: 2, dependency: "Internal Review" },
    { phase: "Design", workstream: "Security & Compliance", activity: "Risk Assessment", name: "Identify Risks", start: "2026-06-11", end: "2026-06-13", duration: 3, resource: "Security Lead", order: 1 },
    { phase: "Design", workstream: "Security & Compliance", activity: "Risk Assessment", name: "Mitigation Plan", start: "2026-06-14", end: "2026-06-15", duration: 2, resource: "PM", order: 2, dependency: "Identify Risks" },
    { phase: "Build", workstream: "Configuration", activity: "Module Configuration", name: "Finance Config", start: "2026-07-01", end: "2026-07-05", duration: 5, resource: "Finance Lead", order: 1 },
    { phase: "Build", workstream: "Configuration", activity: "Module Configuration", name: "Procurement Config", start: "2026-07-06", end: "2026-07-10", duration: 5, resource: "Procurement Lead", order: 2, dependency: "Finance Config" },
    { phase: "Build", workstream: "Configuration", activity: "Module Configuration", name: "Supply Chain Config", start: "2026-07-11", end: "2026-07-15", duration: 5, resource: "SC Lead", order: 3, dependency: "Procurement Config" },
    { phase: "Build", workstream: "Configuration", activity: "Custom Development", name: "Develop Reports", start: "2026-07-21", end: "2026-07-27", duration: 5, resource: "Dev Team", order: 1 },
    { phase: "Build", workstream: "Configuration", activity: "Custom Development", name: "Develop Interfaces", start: "2026-07-28", end: "2026-08-05", duration: 7, resource: "Dev Team", order: 2, dependency: "Develop Reports" },
    { phase: "Build", workstream: "Configuration", activity: "Unit Testing", name: "Test Config Modules", start: "2026-08-06", end: "2026-08-10", duration: 5, resource: "QA Team", order: 1 },
    { phase: "Build", workstream: "Configuration", activity: "Unit Testing", name: "Test Custom Dev", start: "2026-08-11", end: "2026-08-15", duration: 5, resource: "QA Team", order: 2, dependency: "Test Config Modules" },
    { phase: "Build", workstream: "Data Migration", activity: "Data Mapping", name: "Extract Legacy Data", start: "2026-07-05", end: "2026-07-10", duration: 4, resource: "Data Team", order: 1 },
    { phase: "Build", workstream: "Data Migration", activity: "Data Mapping", name: "Transform & Map", start: "2026-07-11", end: "2026-07-20", duration: 8, resource: "Data Team", order: 2, dependency: "Extract Legacy Data" },
    { phase: "Build", workstream: "Data Migration", activity: "Data Load", name: "Load to Dev", start: "2026-07-21", end: "2026-07-30", duration: 8, resource: "Data Team", order: 1 },
    { phase: "Build", workstream: "Data Migration", activity: "Data Load", name: "Load to Test", start: "2026-08-01", end: "2026-08-10", duration: 8, resource: "Data Team", order: 2, dependency: "Load to Dev" },
    { phase: "Build", workstream: "Data Migration", activity: "Data Validation", name: "Validate Dev Data", start: "2026-08-11", end: "2026-08-20", duration: 8, resource: "QA Team", order: 1 },
    { phase: "Build", workstream: "Data Migration", activity: "Data Validation", name: "Validate Test Data", start: "2026-08-21", end: "2026-08-30", duration: 8, resource: "QA Team", order: 2, dependency: "Validate Dev Data" },
    { phase: "Test", workstream: "Unit Testing", activity: "Module Testing", name: "Finance Module", start: "2026-09-16", end: "2026-09-18", duration: 3, resource: "QA Team", order: 1 },
    { phase: "Test", workstream: "Unit Testing", activity: "Module Testing", name: "Procurement Module", start: "2026-09-19", end: "2026-09-20", duration: 2, resource: "QA Team", order: 2, dependency: "Finance Module" },
    { phase: "Test", workstream: "Unit Testing", activity: "Custom Development Testing", name: "Test Reports", start: "2026-09-21", end: "2026-09-23", duration: 3, resource: "QA Team", order: 1 },
    { phase: "Test", workstream: "Unit Testing", activity: "Custom Development Testing", name: "Test Interfaces", start: "2026-09-24", end: "2026-09-25", duration: 2, resource: "QA Team", order: 2, dependency: "Test Reports" },
    { phase: "Test", workstream: "Integration Testing", activity: "End-to-End Scenarios", name: "Finance Procure Flow", start: "2026-09-26", end: "2026-09-30", duration: 5, resource: "QA Team", order: 1 },
    { phase: "Test", workstream: "Integration Testing", activity: "End-to-End Scenarios", name: "Supply Chain Flow", start: "2026-10-01", end: "2026-10-05", duration: 5, resource: "QA Team", order: 2, dependency: "Finance Procure Flow" },
    { phase: "Test", workstream: "Integration Testing", activity: "Integration Validation", name: "Validate Reports", start: "2026-10-06", end: "2026-10-08", duration: 3, resource: "QA Team", order: 1 },
    { phase: "Test", workstream: "Integration Testing", activity: "Integration Validation", name: "Validate Interfaces", start: "2026-10-09", end: "2026-10-10", duration: 2, resource: "QA Team", order: 2, dependency: "Validate Reports" },
    { phase: "Test", workstream: "UAT", activity: "UAT Planning", name: "Define UAT Scenarios", start: "2026-10-11", end: "2026-10-13", duration: 3, resource: "Business Users", order: 1 },
    { phase: "Test", workstream: "UAT", activity: "UAT Planning", name: "Assign Testers", start: "2026-10-14", end: "2026-10-15", duration: 2, resource: "PM", order: 2, dependency: "Define UAT Scenarios" },
    { phase: "Test", workstream: "UAT", activity: "UAT Execution", name: "Execute Test Cases", start: "2026-10-16", end: "2026-10-22", duration: 5, resource: "Business Users", order: 1 },
    { phase: "Test", workstream: "UAT", activity: "UAT Execution", name: "Log Defects", start: "2026-10-23", end: "2026-10-25", duration: 3, resource: "QA Team", order: 2, dependency: "Execute Test Cases" },
    { phase: "Test", workstream: "UAT", activity: "UAT Sign-Off", name: "Resolve Defects", start: "2026-10-26", end: "2026-10-29", duration: 4, resource: "QA Team", order: 1 },
    { phase: "Test", workstream: "UAT", activity: "UAT Sign-Off", name: "Sign-Off UAT", start: "2026-10-30", end: "2026-10-31", duration: 2, resource: "PM", order: 2, dependency: "Resolve Defects" },
    { phase: "Deploy", workstream: "Cutover Planning", activity: "Cutover Schedule", name: "Draft Schedule", start: "2026-11-01", end: "2026-11-03", duration: 3, resource: "PM", order: 1 },
    { phase: "Deploy", workstream: "Cutover Planning", activity: "Cutover Schedule", name: "Approve Schedule", start: "2026-11-04", end: "2026-11-05", duration: 2, resource: "PM", order: 2, dependency: "Draft Schedule" },
    { phase: "Deploy", workstream: "Cutover Planning", activity: "Go-Live Prep", name: "Prepare Teams", start: "2026-11-06", end: "2026-11-08", duration: 3, resource: "PM", order: 1 },
  ];

  const taskIdMap: Record<string, number> = {};
  let taskCount = 0;
  
  for (const task of tasksData) {
    const wsKey = `${task.phase}-${task.workstream}`;
    const actKey = `${wsKey}-${task.activity}`;
    
    let predecessorIds: number[] | undefined;
    if (task.dependency) {
      const depTaskKey = `${actKey}-${task.dependency}`;
      if (taskIdMap[depTaskKey]) {
        predecessorIds = [taskIdMap[depTaskKey]];
      }
    }
    
    const [inserted] = await db.insert(pmTasks).values({
      tenantId,
      projectId: projId,
      phaseId: phaseMap[task.phase],
      name: task.name,
      plannedStartDate: task.start,
      plannedEndDate: task.end,
      estimatedHours: String(task.duration * 8),
      status: "todo",
      priority: "medium",
      progress: 0,
      order: task.order,
      predecessorIds,
    }).returning();
    
    taskIdMap[`${actKey}-${task.name}`] = inserted.id;
    taskCount++;
  }

  return {
    project,
    phases: phaseCount,
    workstreams: wsCount,
    activities: actCount,
    tasks: taskCount,
  };
}

export async function clearS4HanaProject(_tenantId: number, projectId: number) {
  await db.delete(pmTasks).where(eq(pmTasks.projectId, projectId));
  await db.delete(pmWorkstreams).where(eq(pmWorkstreams.projectId, projectId));
  await db.delete(pmProjectPhases).where(eq(pmProjectPhases.projectId, projectId));
  
  return { message: "S/4HANA project data cleared" };
}
