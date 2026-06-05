import type { Request } from "express";
import { storage } from "../storage";

async function clientIdFromPmProjectId(projectId: number): Promise<number | null | undefined> {
  const project = await storage.getPmProject(projectId);
  return project?.clientId;
}

async function clientIdFromPmAgileWorkstreamId(wsId: number): Promise<number | null | undefined> {
  const rows = await storage.getPmAgileWorkstreamsById(wsId);
  if (!rows?.projectId) return undefined;
  return clientIdFromPmProjectId(rows.projectId);
}

async function clientIdFromPmEpicId(epicId: number): Promise<number | null | undefined> {
  const epic = await storage.getPmEpicById(epicId);
  if (!epic?.projectId) return undefined;
  return clientIdFromPmProjectId(epic.projectId);
}

async function clientIdFromCrmAccountId(accountId: number): Promise<number | null | undefined> {
  const account = await storage.getCrmAccount(accountId);
  return account?.clientId;
}

async function clientIdFromCrmContactId(contactId: number): Promise<number | null | undefined> {
  const contact = await storage.getCrmContact(contactId);
  if (!contact?.accountId) return null;
  return clientIdFromCrmAccountId(contact.accountId);
}

async function clientIdFromCrmOpportunityId(oppId: number): Promise<number | null | undefined> {
  const opp = await storage.getCrmOpportunity(oppId);
  if (!opp?.accountId) return null;
  return clientIdFromCrmAccountId(opp.accountId);
}

async function clientIdFromCrmContractId(contractId: number): Promise<number | null | undefined> {
  const contract = await storage.getCrmContract(contractId);
  if (!contract?.accountId) return null;
  return clientIdFromCrmAccountId(contract.accountId);
}

async function clientIdFromPmWorkstreamId(wsId: number): Promise<number | null | undefined> {
  const ws = await storage.getPmWorkstream(wsId);
  if (!ws?.projectId) return undefined;
  return clientIdFromPmProjectId(ws.projectId);
}

async function clientIdFromPmSprintId(sprintId: number): Promise<number | null | undefined> {
  const sprint = await storage.getPmSprint(sprintId);
  if (!sprint?.projectId) return undefined;
  return clientIdFromPmProjectId(sprint.projectId);
}

async function clientIdFromPmChildId(
  getter: (id: number) => Promise<{ projectId?: number | null } | undefined>,
  id: number,
): Promise<number | null | undefined> {
  const row = await getter(id);
  if (!row?.projectId) return undefined;
  return clientIdFromPmProjectId(row.projectId);
}

export async function resolveClientIdForRequest(req: Request): Promise<number | null | undefined> {
  const path = req.path;
  const p = req.params as Record<string, string>;

  const id = p.id ? Number(p.id) : NaN;
  const projectId = p.projectId ? Number(p.projectId) : NaN;
  const wsId = p.wsId ? Number(p.wsId) : NaN;

  if (path.startsWith("/api/pm/projects/") && !Number.isNaN(projectId)) {
    return clientIdFromPmProjectId(projectId);
  }
  if (path.match(/^\/api\/pm\/projects\/\d+/) && !Number.isNaN(id) && !path.includes("/portfolios")) {
    return clientIdFromPmProjectId(id);
  }

  if (path.includes("/api/pm/milestones/") && !Number.isNaN(id)) {
    return clientIdFromPmChildId((id) => storage.getPmMilestone(id), id);
  }
  if (path.includes("/api/pm/raidd") && !Number.isNaN(id)) {
    return clientIdFromPmChildId((id) => storage.getPmRaiddItem(id), id);
  }
  if (path.includes("/api/pm/phases/") && !Number.isNaN(id)) {
    return clientIdFromPmChildId((id) => storage.getPmProjectPhase(id), id);
  }
  if (path.match(/\/api\/pm\/tasks\/\d+/) && !Number.isNaN(id)) {
    return clientIdFromPmChildId((id) => storage.getPmTask(id), id);
  }
  if (path.startsWith("/api/pm/agile/workstreams/") && !Number.isNaN(wsId)) {
    return clientIdFromPmAgileWorkstreamId(wsId);
  }
  if (path.includes("/api/pm/agile/workstreams/") && !Number.isNaN(id)) {
    return clientIdFromPmAgileWorkstreamId(id);
  }
  if (path.includes("/api/pm/agile/epics/") && !Number.isNaN(id)) {
    return clientIdFromPmEpicId(id);
  }
  if (path.includes("/api/pm/agile/sprints/") && !Number.isNaN(id)) {
    const sprint = await storage.getPmAgileSprintById(id);
    if (sprint?.agileWorkstreamId) return clientIdFromPmAgileWorkstreamId(sprint.agileWorkstreamId);
  }
  if (path.includes("/api/pm/agile/stories/") && !Number.isNaN(id)) {
    const story = await storage.getPmAgileStoryById(id);
    if (story?.agileWorkstreamId) return clientIdFromPmAgileWorkstreamId(story.agileWorkstreamId);
  }
  if (path.includes("/api/pm/project-tools/") && !Number.isNaN(id)) {
    const tool = await storage.getPmProjectToolById(id);
    if (tool?.projectId) return clientIdFromPmProjectId(tool.projectId);
  }
  if (path.includes("/api/pm/workstreams/") && !Number.isNaN(id)) {
    return clientIdFromPmWorkstreamId(id);
  }
  if (path.includes("/api/pm/sprints/") && !Number.isNaN(id)) {
    return clientIdFromPmSprintId(id);
  }
  if (path.includes("/api/pm/portfolios/") && !Number.isNaN(id)) {
    return storage.getPmPortfolioClientId(id);
  }
  if (path.includes("/api/pm/programs/") && !Number.isNaN(id)) {
    return storage.getPmProgramClientId(id);
  }

  if (path.startsWith("/api/crm/accounts/") && !Number.isNaN(id)) {
    return clientIdFromCrmAccountId(id);
  }
  if (path.startsWith("/api/crm/contacts/") && !Number.isNaN(id)) {
    return clientIdFromCrmContactId(id);
  }
  if (path.startsWith("/api/crm/opportunities/") && !Number.isNaN(id)) {
    return clientIdFromCrmOpportunityId(id);
  }
  if (path.startsWith("/api/crm/contracts/") && !Number.isNaN(id)) {
    return clientIdFromCrmContractId(id);
  }
  if (path.startsWith("/api/crm/leads/") && !Number.isNaN(id)) {
    return storage.getCrmLeadClientId(id);
  }
  if (path.includes("/api/crm/activities/") && !Number.isNaN(id)) {
    return storage.getCrmActivityClientId(id);
  }
  if (path.includes("/api/crm/tasks/") && !Number.isNaN(id)) {
    return storage.getCrmTaskClientId(id);
  }

  if (path.startsWith("/api/tasks/") && !Number.isNaN(id)) {
    const task = await storage.getTask(id);
    return task?.clientId;
  }
  if (path.startsWith("/api/boards/") && !Number.isNaN(id)) {
    const board = await storage.getBoard(id);
    return board?.workspaceId ?? null;
  }
  if (path.startsWith("/api/business/strategy/") && !Number.isNaN(id)) {
    const item = await storage.getStrategyItem(id);
    return item?.clientId;
  }
  if (path.startsWith("/api/business/initiatives/") && !Number.isNaN(id)) {
    const item = await storage.getInitiative(id);
    return item?.clientId;
  }
  if (path.startsWith("/api/business/goals/") && !Number.isNaN(id)) {
    const goal = await storage.getGoal(id);
    if (goal?.strategyItemId) {
      const si = await storage.getStrategyItem(goal.strategyItemId);
      return si?.clientId;
    }
  }

  if (path.startsWith("/api/documents/") && !Number.isNaN(id) && !path.includes("/folders")) {
    const doc = await storage.getDocument(id);
    return doc?.clientId;
  }
  if (path.includes("/api/documents/folders/") && !Number.isNaN(id)) {
    const folder = await storage.getDocumentFolder(id);
    return folder?.clientId;
  }

  return undefined;
}
