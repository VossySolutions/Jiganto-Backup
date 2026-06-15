import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "../db";
import { storage } from "../storage";
import {
  users,
  workspaces,
  workspaceAccessLog,
  workspaceDatabaseColumns,
  workspaceDatabaseRows,
  workspaceDatabases,
  workspaceDocumentCopies,
  workspaceMembers,
  workspacePageComments,
  workspacePageVersions,
  workspacePages,
  workspacePresence,
  workspaceRowActivity,
  workspaceRowAttachments,
  workspaceRowComments,
  workspaceTemplates,
} from "@shared/schema";
import { SPEC_DEFAULT_COLUMNS } from "./defaults";

export type WorkspaceFilter = "all" | "favorites" | "recent" | "shared" | "mine";

type TemplateDatabaseStructure = {
  name: string;
  activeView?: string;
  columns: Array<{
    name: string;
    type: string;
    sortOrder?: number | null;
    options?: unknown;
    width?: number | null;
    isVisible?: boolean | null;
  }>;
};

type TemplatePageStructure = {
  title: string;
  description?: string | null;
  icon?: string | null;
  content?: string | null;
  pageType?: string | null;
  documentStatus?: string | null;
  sortOrder?: number | null;
  databases?: TemplateDatabaseStructure[];
};

type WorkspaceTemplateStructure = {
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  pages?: TemplatePageStructure[];
};

type CreateWorkspaceTemplateOverrides = Partial<{
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
}>;

type SaveWorkspaceTemplateMeta = {
  name: string;
  description?: string | null;
  category?: string | null;
  tier?: string | null;
};

type RowAttachmentInput = {
  filename: string;
  fileUrl: string;
  fileSize?: number | null;
};

type CsvImportMode = "append" | "overwrite";

const ROW_LOCK_SECONDS = 30;
const PRESENCE_WINDOW_SECONDS = 60;

function normalizeStatusValue(value?: string | null): string {
  if (!value) return "draft";
  const lowered = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (["draft", "review", "awaiting_approval", "published", "archived"].includes(lowered)) {
    return lowered;
  }
  return "draft";
}

function normalizeTemplateStructure(value: unknown): WorkspaceTemplateStructure {
  if (!value || typeof value !== "object") return {};
  return value as WorkspaceTemplateStructure;
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function createSystemTemplateSeed(): Array<{
  name: string;
  description: string;
  category: string;
  tier: string;
  structure: WorkspaceTemplateStructure;
}> {
  return [
    {
      name: "Meeting Management",
      description: "Track meetings, agenda, actions, and owners.",
      category: "operations",
      tier: "system",
      structure: {
        name: "Meeting Management",
        pages: [
          { title: "Overview", content: "## Meeting Hub\nUse this workspace to coordinate recurring and ad hoc meetings." },
          {
            title: "Meeting Actions",
            databases: [
              {
                name: "Action Tracker",
                columns: [
                  { name: "Action", type: "text", sortOrder: 0, options: { anchor: true }, width: 260, isVisible: true },
                  { name: "Owner", type: "person", sortOrder: 1, width: 150, isVisible: true },
                  { name: "Due Date", type: "date", sortOrder: 2, width: 130, isVisible: true },
                  { name: "Status", type: "select", sortOrder: 3, options: { choices: ["Open", "In Progress", "Done"] }, width: 140, isVisible: true },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      name: "Sprint Planning",
      description: "Plan sprint backlog and monitor delivery.",
      category: "delivery",
      tier: "system",
      structure: {
        name: "Sprint Planning",
        pages: [
          { title: "Sprint Goals", content: "Define sprint goals and constraints." },
          {
            title: "Backlog",
            databases: [
              {
                name: "Sprint Board",
                columns: [
                  { name: "Story", type: "text", sortOrder: 0, options: { anchor: true }, width: 280, isVisible: true },
                  { name: "Points", type: "number", sortOrder: 1, width: 90, isVisible: true },
                  { name: "Assignee", type: "person", sortOrder: 2, width: 150, isVisible: true },
                  { name: "Status", type: "select", sortOrder: 3, options: { choices: ["Todo", "In Progress", "Review", "Done"] }, width: 140, isVisible: true },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      name: "Client Onboarding",
      description: "Run onboarding checklist and milestones.",
      category: "client_success",
      tier: "system",
      structure: {
        name: "Client Onboarding",
        pages: [
          { title: "Onboarding Notes", content: "Capture kickoff context and dependencies." },
          {
            title: "Checklist",
            databases: [
              {
                name: "Onboarding Tasks",
                columns: [
                  { name: "Task", type: "text", sortOrder: 0, options: { anchor: true }, width: 260, isVisible: true },
                  { name: "Phase", type: "select", sortOrder: 1, options: { choices: ["Prep", "Kickoff", "Configuration", "Training", "Go-live"] }, width: 140, isVisible: true },
                  { name: "Owner", type: "person", sortOrder: 2, width: 150, isVisible: true },
                  { name: "Target Date", type: "date", sortOrder: 3, width: 130, isVisible: true },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      name: "Risk Tracker",
      description: "Capture and monitor risks and mitigations.",
      category: "governance",
      tier: "system",
      structure: {
        name: "Risk Tracker",
        pages: [
          {
            title: "Risk Register",
            databases: [
              {
                name: "Risks",
                columns: [
                  { name: "Risk", type: "text", sortOrder: 0, options: { anchor: true }, width: 280, isVisible: true },
                  { name: "Impact", type: "select", sortOrder: 1, options: { choices: ["Low", "Medium", "High"] }, width: 120, isVisible: true },
                  { name: "Likelihood", type: "select", sortOrder: 2, options: { choices: ["Low", "Medium", "High"] }, width: 120, isVisible: true },
                  { name: "Mitigation", type: "long_text", sortOrder: 3, width: 320, isVisible: true },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      name: "Team OKRs",
      description: "Plan objectives and measurable key results.",
      category: "strategy",
      tier: "system",
      structure: {
        name: "Team OKRs",
        pages: [
          {
            title: "Objectives",
            databases: [
              {
                name: "OKR Board",
                columns: [
                  { name: "Objective", type: "text", sortOrder: 0, options: { anchor: true }, width: 280, isVisible: true },
                  { name: "Key Result", type: "text", sortOrder: 1, width: 240, isVisible: true },
                  { name: "Target", type: "number", sortOrder: 2, width: 110, isVisible: true },
                  { name: "Current", type: "number", sortOrder: 3, width: 110, isVisible: true },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      name: "Decision Log",
      description: "Track key decisions, rationale, and owners.",
      category: "governance",
      tier: "system",
      structure: {
        name: "Decision Log",
        pages: [
          {
            title: "Decisions",
            databases: [
              {
                name: "Decision Register",
                columns: [
                  { name: "Decision", type: "text", sortOrder: 0, options: { anchor: true }, width: 280, isVisible: true },
                  { name: "Date", type: "date", sortOrder: 1, width: 130, isVisible: true },
                  { name: "Owner", type: "person", sortOrder: 2, width: 150, isVisible: true },
                  { name: "Rationale", type: "long_text", sortOrder: 3, width: 320, isVisible: true },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      name: "Project Retrospective",
      description: "Capture wins, learnings, and action items.",
      category: "delivery",
      tier: "system",
      structure: {
        name: "Project Retrospective",
        pages: [
          { title: "Retrospective Notes", content: "Document what went well and what to improve." },
          {
            title: "Follow-up Actions",
            databases: [
              {
                name: "Retro Actions",
                columns: [
                  { name: "Action", type: "text", sortOrder: 0, options: { anchor: true }, width: 260, isVisible: true },
                  { name: "Category", type: "select", sortOrder: 1, options: { choices: ["Process", "People", "Tools", "Scope"] }, width: 140, isVisible: true },
                  { name: "Owner", type: "person", sortOrder: 2, width: 150, isVisible: true },
                  { name: "Due Date", type: "date", sortOrder: 3, width: 130, isVisible: true },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      name: "Knowledge Base",
      description: "Organize and maintain team documentation.",
      category: "knowledge",
      tier: "system",
      structure: {
        name: "Knowledge Base",
        pages: [
          { title: "How-To Guides", content: "Store operating procedures and repeatable steps." },
          {
            title: "Article Index",
            databases: [
              {
                name: "Knowledge Articles",
                columns: [
                  { name: "Title", type: "text", sortOrder: 0, options: { anchor: true }, width: 280, isVisible: true },
                  { name: "Category", type: "select", sortOrder: 1, options: { choices: ["Product", "Ops", "Engineering", "Support"] }, width: 140, isVisible: true },
                  { name: "Owner", type: "person", sortOrder: 2, width: 150, isVisible: true },
                  { name: "Last Reviewed", type: "date", sortOrder: 3, width: 130, isVisible: true },
                ],
              },
            ],
          },
        ],
      },
    },
  ];
}

export async function recordWorkspaceAccess(workspaceId: number, userId: string) {
  const existing = await db
    .select()
    .from(workspaceAccessLog)
    .where(and(eq(workspaceAccessLog.workspaceId, workspaceId), eq(workspaceAccessLog.userId, userId)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(workspaceAccessLog)
      .set({ accessedAt: new Date() })
      .where(eq(workspaceAccessLog.id, existing[0].id));
  } else {
    await db.insert(workspaceAccessLog).values({ workspaceId, userId, accessedAt: new Date() });
  }

  await db
    .update(workspaces)
    .set({ updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));
}

export async function getWorkspacesForUser(
  tenantId: number,
  userId: string,
  filter: WorkspaceFilter = "all",
) {
  const membershipRows = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId));
  const memberWorkspaceIds = membershipRows.map((row) => row.workspaceId);

  const baseConditions = [eq(workspaces.tenantId, tenantId)];
  if (memberWorkspaceIds.length > 0) {
    baseConditions.push(or(eq(workspaces.createdBy, userId), inArray(workspaces.id, memberWorkspaceIds))!);
  } else {
    baseConditions.push(eq(workspaces.createdBy, userId));
  }

  const rows = await db
    .select({
      workspace: workspaces,
      accessAt: workspaceAccessLog.accessedAt,
      memberCount: sql<number>`count(distinct ${workspaceMembers.id})::int`,
    })
    .from(workspaces)
    .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .leftJoin(
      workspaceAccessLog,
      and(eq(workspaceAccessLog.workspaceId, workspaces.id), eq(workspaceAccessLog.userId, userId)),
    )
    .where(and(...baseConditions))
    .groupBy(workspaces.id, workspaceAccessLog.accessedAt)
    .orderBy(desc(sql`coalesce(${workspaceAccessLog.accessedAt}, ${workspaces.updatedAt})`));

  const list = rows.map((row) => ({
    ...row.workspace,
    isShared: row.workspace.createdBy !== userId || (row.memberCount ?? 0) > 1,
    lastAccessedAt: row.accessAt,
  }));

  switch (filter) {
    case "favorites":
      return list.filter((w) => w.isFavorite);
    case "recent":
      return list
        .filter((w) => w.lastAccessedAt != null)
        .sort((a, b) => (b.lastAccessedAt?.getTime() ?? 0) - (a.lastAccessedAt?.getTime() ?? 0));
    case "shared":
      return list.filter((w) => w.isShared);
    case "mine":
      return list.filter((w) => w.createdBy === userId);
    default:
      return list;
  }
}

export async function duplicateWorkspace(workspaceId: number, userId: string, tenantId: number) {
  return db.transaction(async () => {
    const sourceWorkspace = await storage.getWorkspace(workspaceId);
    if (!sourceWorkspace || sourceWorkspace.tenantId !== tenantId) {
      throw new Error("Workspace not found");
    }

    const createdWorkspace = await storage.createWorkspace({
      tenantId,
      name: `${sourceWorkspace.name} (Copy)`,
      description: sourceWorkspace.description,
      icon: sourceWorkspace.icon,
      color: sourceWorkspace.color,
      status: "active",
      isFavorite: false,
      createdBy: userId,
    });

    await storage.addWorkspaceMember({
      workspaceId: createdWorkspace.id,
      userId,
      role: "owner",
      permission: "admin",
      invitedBy: userId,
    });

    const sourcePages = await storage.getWorkspacePages(workspaceId);
    const sourcePageIds = sourcePages.map((p) => p.id);
    const sourceDatabases = sourcePageIds.length
      ? await db.select().from(workspaceDatabases).where(inArray(workspaceDatabases.pageId, sourcePageIds))
      : [];

    const sourceDatabaseIds = sourceDatabases.map((d) => d.id);
    const sourceColumns = sourceDatabaseIds.length
      ? await db.select().from(workspaceDatabaseColumns).where(inArray(workspaceDatabaseColumns.databaseId, sourceDatabaseIds))
      : [];
    const sourceRows = sourceDatabaseIds.length
      ? await db.select().from(workspaceDatabaseRows).where(inArray(workspaceDatabaseRows.databaseId, sourceDatabaseIds))
      : [];

    const pageIdMap = new Map<number, number>();
    const pagesSorted = [...sourcePages].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    for (const page of pagesSorted) {
      const createdPage = await storage.createWorkspacePage({
        workspaceId: createdWorkspace.id,
        parentId: null,
        title: page.title,
        description: page.description,
        icon: page.icon,
        coverImage: page.coverImage,
        content: page.content,
        pageType: page.pageType,
        documentStatus: page.documentStatus,
        tags: page.tags,
        sharePermission: page.sharePermission,
        linkedDocumentId: null,
        isFavorite: false,
        sortOrder: page.sortOrder,
        createdBy: userId,
        updatedBy: userId,
      });
      pageIdMap.set(page.id, createdPage.id);
    }

    for (const page of pagesSorted) {
      if (!page.parentId) continue;
      const newPageId = pageIdMap.get(page.id);
      const newParentId = pageIdMap.get(page.parentId);
      if (newPageId && newParentId) {
        await storage.updateWorkspacePage(newPageId, { parentId: newParentId });
      }
    }

    const databaseIdMap = new Map<number, number>();
    for (const sourceDb of sourceDatabases) {
      const mappedPageId = sourceDb.pageId ? pageIdMap.get(sourceDb.pageId) : null;
      const createdDb = await storage.createWorkspaceDatabase({
        pageId: mappedPageId ?? null,
        projectId: sourceDb.projectId,
        name: sourceDb.name,
        activeView: sourceDb.activeView,
      });
      databaseIdMap.set(sourceDb.id, createdDb.id);
    }

    for (const column of sourceColumns) {
      const mappedDatabaseId = databaseIdMap.get(column.databaseId);
      if (!mappedDatabaseId) continue;
      await storage.createWorkspaceDatabaseColumn({
        databaseId: mappedDatabaseId,
        name: column.name,
        type: column.type,
        options: column.options,
        sortOrder: column.sortOrder,
        width: column.width,
        isVisible: column.isVisible,
      });
    }

    for (const row of sourceRows) {
      const mappedDatabaseId = databaseIdMap.get(row.databaseId);
      if (!mappedDatabaseId) continue;
      await storage.createWorkspaceDatabaseRow({
        databaseId: mappedDatabaseId,
        data: row.data,
        sortOrder: row.sortOrder,
        createdBy: userId,
        lockedBy: null,
        lockedAt: null,
      });
    }

    return createdWorkspace;
  });
}

export async function archiveWorkspace(workspaceId: number) {
  return storage.updateWorkspace(workspaceId, { status: "archived" });
}

export async function createWorkspaceFromTemplate(
  tenantId: number,
  userId: string,
  templateId: number,
  overrides: CreateWorkspaceTemplateOverrides = {},
) {
  return db.transaction(async () => {
    const [template] = await db.select().from(workspaceTemplates).where(eq(workspaceTemplates.id, templateId)).limit(1);
    if (!template) throw new Error("Template not found");

    const structure = normalizeTemplateStructure(template.structure);
    const workspace = await storage.createWorkspace({
      tenantId,
      name: overrides.name ?? structure.name ?? template.name,
      description: overrides.description ?? structure.description ?? template.description,
      icon: overrides.icon ?? structure.icon ?? null,
      color: overrides.color ?? structure.color ?? null,
      status: "active",
      isFavorite: false,
      createdBy: userId,
    });

    await storage.addWorkspaceMember({
      workspaceId: workspace.id,
      userId,
      role: "owner",
      permission: "admin",
      invitedBy: userId,
    });

    const pages = safeArray<TemplatePageStructure>(structure.pages);
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      const createdPage = await storage.createWorkspacePage({
        workspaceId: workspace.id,
        parentId: null,
        title: page.title || `Page ${pageIndex + 1}`,
        description: page.description ?? null,
        icon: page.icon ?? null,
        content: page.content ?? null,
        pageType: page.pageType ?? "page",
        documentStatus: page.documentStatus ?? "Draft",
        sortOrder: page.sortOrder ?? pageIndex,
        createdBy: userId,
        updatedBy: userId,
      });

      const databases = safeArray<TemplateDatabaseStructure>(page.databases);
      for (const templateDb of databases) {
        const createdDb = await storage.createWorkspaceDatabase({
          pageId: createdPage.id,
          name: templateDb.name,
          activeView: templateDb.activeView ?? "table",
        });

        const columns = safeArray<TemplateDatabaseStructure["columns"][number]>(templateDb.columns);
        for (let colIndex = 0; colIndex < columns.length; colIndex++) {
          const column = columns[colIndex];
          await storage.createWorkspaceDatabaseColumn({
            databaseId: createdDb.id,
            name: column.name,
            type: column.type,
            options: column.options ?? null,
            sortOrder: column.sortOrder ?? colIndex,
            width: column.width ?? null,
            isVisible: column.isVisible ?? true,
          });
        }
      }
    }

    return workspace;
  });
}

export async function saveWorkspaceAsTemplate(
  workspaceId: number,
  userId: string,
  tenantId: number,
  meta: SaveWorkspaceTemplateMeta,
) {
  const workspace = await storage.getWorkspace(workspaceId);
  if (!workspace || workspace.tenantId !== tenantId) throw new Error("Workspace not found");

  const pages = await storage.getWorkspacePages(workspaceId);
  const pageIds = pages.map((p) => p.id);
  const pageDatabases = pageIds.length
    ? await db.select().from(workspaceDatabases).where(inArray(workspaceDatabases.pageId, pageIds))
    : [];
  const databaseIds = pageDatabases.map((d) => d.id);
  const columns = databaseIds.length
    ? await db.select().from(workspaceDatabaseColumns).where(inArray(workspaceDatabaseColumns.databaseId, databaseIds))
    : [];

  const structure: WorkspaceTemplateStructure = {
    name: workspace.name,
    description: workspace.description,
    icon: workspace.icon,
    color: workspace.color,
    pages: pages
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((page) => ({
        title: page.title,
        description: page.description,
        icon: page.icon,
        content: page.content,
        pageType: page.pageType,
        documentStatus: page.documentStatus,
        sortOrder: page.sortOrder,
        databases: pageDatabases
          .filter((dbRow) => dbRow.pageId === page.id)
          .map((dbRow) => ({
            name: dbRow.name,
            activeView: dbRow.activeView,
            columns: columns
              .filter((col) => col.databaseId === dbRow.id)
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .map((col) => ({
                name: col.name,
                type: col.type,
                sortOrder: col.sortOrder,
                options: col.options,
                width: col.width,
                isVisible: col.isVisible,
              })),
          })),
      })),
  };

  const [saved] = await db
    .insert(workspaceTemplates)
    .values({
      tenantId,
      name: meta.name,
      description: meta.description ?? null,
      category: meta.category ?? "custom",
      tier: meta.tier ?? "custom",
      structure,
      createdBy: userId,
    })
    .returning();

  return saved;
}

export async function getWorkspaceTemplates(tenantId: number) {
  return db
    .select()
    .from(workspaceTemplates)
    .where(eq(workspaceTemplates.tenantId, tenantId))
    .orderBy(desc(workspaceTemplates.createdAt));
}

export async function seedSystemWorkspaceTemplates(tenantId: number) {
  const [existingCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workspaceTemplates)
    .where(eq(workspaceTemplates.tenantId, tenantId));

  if ((existingCount?.count ?? 0) > 0) {
    return [];
  }

  const seed = createSystemTemplateSeed();
  return db
    .insert(workspaceTemplates)
    .values(
      seed.map((item) => ({
        tenantId,
        name: item.name,
        description: item.description,
        category: item.category,
        tier: item.tier,
        structure: item.structure,
        createdBy: null,
      })),
    )
    .returning();
}

export async function copyPageToDocuments(
  pageId: number,
  userId: string,
  tenantId: number,
  folderId?: number,
  status?: string,
) {
  const page = await storage.getWorkspacePage(pageId);
  if (!page) throw new Error("Workspace page not found");

  const document = await storage.createDocument({
    tenantId,
    folderId: folderId ?? null,
    title: page.title,
    description: page.description,
    content: page.content,
    type: "document",
    status: normalizeStatusValue(status ?? page.documentStatus),
    ownerId: userId,
    metadata: {
      source: "workspace_page",
      workspacePageId: page.id,
      workspaceId: page.workspaceId,
    },
  });

  const [copyLog] = await db
    .insert(workspaceDocumentCopies)
    .values({
      workspacePageId: page.id,
      documentId: document.id,
      copiedBy: userId,
      copiedAt: new Date(),
    })
    .returning();

  await storage.updateWorkspacePage(page.id, {
    linkedDocumentId: document.id,
    documentStatus: "Published",
    updatedBy: userId,
  });

  return { document, copyLog };
}

export async function getRowDetail(rowId: number) {
  const [row] = await db.select().from(workspaceDatabaseRows).where(eq(workspaceDatabaseRows.id, rowId)).limit(1);
  if (!row) return null;

  const comments = await db
    .select({
      comment: workspaceRowComments,
      user: { id: users.id, firstName: users.firstName, lastName: users.lastName },
    })
    .from(workspaceRowComments)
    .leftJoin(users, eq(workspaceRowComments.userId, users.id))
    .where(eq(workspaceRowComments.rowId, rowId))
    .orderBy(workspaceRowComments.createdAt);

  const attachments = await db
    .select({
      attachment: workspaceRowAttachments,
      user: { id: users.id, firstName: users.firstName, lastName: users.lastName },
    })
    .from(workspaceRowAttachments)
    .leftJoin(users, eq(workspaceRowAttachments.createdBy, users.id))
    .where(eq(workspaceRowAttachments.rowId, rowId))
    .orderBy(desc(workspaceRowAttachments.createdAt));

  const activity = await db
    .select({
      activity: workspaceRowActivity,
      user: { id: users.id, firstName: users.firstName, lastName: users.lastName },
    })
    .from(workspaceRowActivity)
    .leftJoin(users, eq(workspaceRowActivity.userId, users.id))
    .where(eq(workspaceRowActivity.rowId, rowId))
    .orderBy(desc(workspaceRowActivity.createdAt));

  return { row, comments, attachments, activity };
}

export async function addRowComment(rowId: number, userId: string, body: string, parentId?: number) {
  const [created] = await db
    .insert(workspaceRowComments)
    .values({ rowId, userId, body, parentId: parentId ?? null })
    .returning();
  return created;
}

export async function addRowAttachment(rowId: number, userId: string, file: RowAttachmentInput) {
  const [created] = await db
    .insert(workspaceRowAttachments)
    .values({
      rowId,
      filename: file.filename,
      fileUrl: file.fileUrl,
      fileSize: file.fileSize ?? null,
      createdBy: userId,
    })
    .returning();
  return created;
}

export async function logRowActivity(
  rowId: number,
  userId: string,
  action: string,
  fieldName?: string,
  oldValue?: unknown,
  newValue?: unknown,
) {
  const [created] = await db
    .insert(workspaceRowActivity)
    .values({
      rowId,
      userId,
      action,
      fieldName: fieldName ?? null,
      oldValue: oldValue === undefined ? null : normalizeText(oldValue),
      newValue: newValue === undefined ? null : normalizeText(newValue),
    })
    .returning();
  return created;
}

export async function lockRow(rowId: number, userId: string) {
  const [row] = await db.select().from(workspaceDatabaseRows).where(eq(workspaceDatabaseRows.id, rowId)).limit(1);
  if (!row) return null;

  const now = new Date();
  const lockExpiresAt = row.lockedAt ? new Date(row.lockedAt.getTime() + ROW_LOCK_SECONDS * 1000) : null;
  const lockActive = row.lockedBy && lockExpiresAt && lockExpiresAt > now;

  if (lockActive && row.lockedBy !== userId) {
    return null;
  }

  const [updated] = await db
    .update(workspaceDatabaseRows)
    .set({ lockedBy: userId, lockedAt: now, updatedAt: now })
    .where(eq(workspaceDatabaseRows.id, rowId))
    .returning();

  return updated;
}

export async function unlockRow(rowId: number, userId: string) {
  const [row] = await db.select().from(workspaceDatabaseRows).where(eq(workspaceDatabaseRows.id, rowId)).limit(1);
  if (!row) return null;
  if (row.lockedBy && row.lockedBy !== userId) return null;

  const [updated] = await db
    .update(workspaceDatabaseRows)
    .set({ lockedBy: null, lockedAt: null, updatedAt: new Date() })
    .where(eq(workspaceDatabaseRows.id, rowId))
    .returning();
  return updated;
}

export async function updatePresence(
  workspaceId: number,
  userId: string,
  editingPageId?: number,
  editingRowId?: number,
) {
  const existing = await db
    .select()
    .from(workspacePresence)
    .where(and(eq(workspacePresence.workspaceId, workspaceId), eq(workspacePresence.userId, userId)))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(workspacePresence)
      .set({
        editingPageId: editingPageId ?? null,
        editingRowId: editingRowId ?? null,
        lastSeenAt: new Date(),
      })
      .where(eq(workspacePresence.id, existing[0].id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(workspacePresence)
    .values({
      workspaceId,
      userId,
      editingPageId: editingPageId ?? null,
      editingRowId: editingRowId ?? null,
      lastSeenAt: new Date(),
    })
    .returning();

  return created;
}

export async function getPresence(workspaceId: number) {
  const cutoff = new Date(Date.now() - PRESENCE_WINDOW_SECONDS * 1000);

  return db
    .select({
      presence: workspacePresence,
      user: { id: users.id, firstName: users.firstName, lastName: users.lastName },
    })
    .from(workspacePresence)
    .leftJoin(users, eq(workspacePresence.userId, users.id))
    .where(and(eq(workspacePresence.workspaceId, workspaceId), sql`${workspacePresence.lastSeenAt} >= ${cutoff}`))
    .orderBy(desc(workspacePresence.lastSeenAt));
}

export async function createPageVersion(pageId: number, userId: string) {
  const page = await storage.getWorkspacePage(pageId);
  if (!page) throw new Error("Workspace page not found");

  const [current] = await db
    .select({ maxVersion: sql<number>`coalesce(max(${workspacePageVersions.version}), 0)::int` })
    .from(workspacePageVersions)
    .where(eq(workspacePageVersions.pageId, pageId));

  const [created] = await db
    .insert(workspacePageVersions)
    .values({
      pageId,
      title: page.title,
      content: page.content,
      version: (current?.maxVersion ?? 0) + 1,
      authorId: userId,
      createdAt: new Date(),
    })
    .returning();

  return created;
}

export async function getPageVersions(pageId: number) {
  return db
    .select()
    .from(workspacePageVersions)
    .where(eq(workspacePageVersions.pageId, pageId))
    .orderBy(desc(workspacePageVersions.version));
}

export async function restorePageVersion(versionId: number) {
  const [version] = await db
    .select()
    .from(workspacePageVersions)
    .where(eq(workspacePageVersions.id, versionId))
    .limit(1);
  if (!version) return null;

  const [updated] = await db
    .update(workspacePages)
    .set({
      title: version.title,
      content: version.content,
      updatedBy: version.authorId,
      updatedAt: new Date(),
    })
    .where(eq(workspacePages.id, version.pageId))
    .returning();

  return updated;
}

export async function getPageComments(pageId: number) {
  return db
    .select({
      comment: workspacePageComments,
      user: { id: users.id, firstName: users.firstName, lastName: users.lastName },
    })
    .from(workspacePageComments)
    .leftJoin(users, eq(workspacePageComments.userId, users.id))
    .where(eq(workspacePageComments.pageId, pageId))
    .orderBy(workspacePageComments.createdAt);
}

export async function addPageComment(pageId: number, userId: string, content: string, parentId?: number) {
  const [created] = await db
    .insert(workspacePageComments)
    .values({
      pageId,
      userId,
      content,
      parentId: parentId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return created;
}

export async function importCsvToDatabase(
  databaseId: number,
  rows: Array<Record<string, unknown>>,
  mode: CsvImportMode,
) {
  const columns = await storage.getWorkspaceDatabaseColumns(databaseId);
  if (columns.length === 0 || rows.length === 0) return { inserted: 0 };

  if (mode === "overwrite") {
    await db.delete(workspaceDatabaseRows).where(eq(workspaceDatabaseRows.databaseId, databaseId));
  }

  const [maxSortResult] = await db
    .select({ maxSort: sql<number>`coalesce(max(${workspaceDatabaseRows.sortOrder}), -1)::int` })
    .from(workspaceDatabaseRows)
    .where(eq(workspaceDatabaseRows.databaseId, databaseId));

  const headersToColumns = new Map(
    columns.map((col) => [col.name.trim().toLowerCase(), col]),
  );
  const values = rows.map((inputRow, index) => {
    const output: Record<string, unknown> = {};
    for (const [rawKey, value] of Object.entries(inputRow)) {
      const normalized = rawKey.trim().toLowerCase();
      const matchedColumn = headersToColumns.get(normalized);
      if (matchedColumn) output[String(matchedColumn.id)] = value;
    }
    return {
      databaseId,
      data: output,
      sortOrder: (maxSortResult?.maxSort ?? -1) + index + 1,
      createdBy: null,
      lockedBy: null,
      lockedAt: null,
    };
  });

  const inserted = values.length
    ? await db.insert(workspaceDatabaseRows).values(values).returning({ id: workspaceDatabaseRows.id })
    : [];

  return { inserted: inserted.length };
}

export async function exportDatabaseCsv(databaseId: number) {
  const columns = await storage.getWorkspaceDatabaseColumns(databaseId);
  const rows = await storage.getWorkspaceDatabaseRows(databaseId);
  const orderedColumns = [...columns].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const headers = orderedColumns.map((col) => col.name);

  const dataRows = rows
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((row) => {
      const rowData = (row.data ?? {}) as Record<string, unknown>;
      return orderedColumns.map((col) => {
        const value = rowData[String(col.id)];
        if (value === undefined || value === null) return "";
        if (typeof value === "object") return JSON.stringify(value);
        return value;
      });
    });

  return { headers, rows: dataRows };
}

export async function createProjectTrackingBoard(
  projectId: number,
  tenantId: number,
  userId: string,
  name?: string,
) {
  void tenantId;
  void userId;

  const [createdBoard] = await db
    .insert(workspaceDatabases)
    .values({
      pageId: null,
      projectId,
      name: name?.trim() || "Project Tracking Board",
      activeView: "table",
    })
    .returning();

  const columnsPayload = SPEC_DEFAULT_COLUMNS.map((column, index) => ({
    databaseId: createdBoard.id,
    name: column.name,
    type: column.type,
    sortOrder: column.sortOrder ?? index,
    options: column.options ?? null,
    width: column.width ?? null,
    isVisible: true,
  }));

  if (columnsPayload.length > 0) {
    await db.insert(workspaceDatabaseColumns).values(columnsPayload);
  }

  return createdBoard;
}

export async function getProjectTrackingBoard(projectId: number) {
  const [existing] = await db
    .select()
    .from(workspaceDatabases)
    .where(eq(workspaceDatabases.projectId, projectId))
    .orderBy(desc(workspaceDatabases.id))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(workspaceDatabases)
    .values({
      pageId: null,
      projectId,
      name: "Project Tracking Board",
      activeView: "table",
    })
    .returning();

  const columnsPayload = SPEC_DEFAULT_COLUMNS.map((column, index) => ({
    databaseId: created.id,
    name: column.name,
    type: column.type,
    sortOrder: column.sortOrder ?? index,
    options: column.options ?? null,
    width: column.width ?? null,
    isVisible: true,
  }));

  if (columnsPayload.length > 0) {
    await db.insert(workspaceDatabaseColumns).values(columnsPayload);
  }

  return created;
}

export async function updateMemberPermission(memberId: number, permission: string) {
  const [updated] = await db
    .update(workspaceMembers)
    .set({ permission })
    .where(eq(workspaceMembers.id, memberId))
    .returning();
  return updated;
}

export async function getMembersWithUsers(workspaceId: number) {
  return db
    .select({
      member: workspaceMembers,
      user: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(workspaceMembers)
    .leftJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(desc(workspaceMembers.createdAt));
}

export async function getPagePublicToken(pageId: number) {
  const page = await storage.getWorkspacePage(pageId);
  return page?.publicToken ?? null;
}

export async function createPagePublicToken(pageId: number) {
  const page = await storage.getWorkspacePage(pageId);
  if (!page) throw new Error("Page not found");
  if (page.publicToken) return page.publicToken;
  const token = randomBytes(24).toString("hex");
  await db.update(workspacePages).set({ publicToken: token, updatedAt: new Date() }).where(eq(workspacePages.id, pageId));
  return token;
}

export async function revokePagePublicToken(pageId: number) {
  await db.update(workspacePages).set({ publicToken: null, updatedAt: new Date() }).where(eq(workspacePages.id, pageId));
}

export async function getPageByPublicToken(token: string) {
  const [page] = await db.select().from(workspacePages).where(eq(workspacePages.publicToken, token)).limit(1);
  return page ?? null;
}

export async function getRowPublicToken(rowId: number) {
  const [row] = await db.select().from(workspaceDatabaseRows).where(eq(workspaceDatabaseRows.id, rowId)).limit(1);
  return row?.publicToken ?? null;
}

export async function createRowPublicToken(rowId: number) {
  const [row] = await db.select().from(workspaceDatabaseRows).where(eq(workspaceDatabaseRows.id, rowId)).limit(1);
  if (!row) throw new Error("Row not found");
  if (row.publicToken) return row.publicToken;
  const token = randomBytes(24).toString("hex");
  await db
    .update(workspaceDatabaseRows)
    .set({ publicToken: token, updatedAt: new Date() })
    .where(eq(workspaceDatabaseRows.id, rowId));
  return token;
}

export async function revokeRowPublicToken(rowId: number) {
  await db
    .update(workspaceDatabaseRows)
    .set({ publicToken: null, updatedAt: new Date() })
    .where(eq(workspaceDatabaseRows.id, rowId));
}

export async function getRowByPublicToken(token: string) {
  const [row] = await db.select().from(workspaceDatabaseRows).where(eq(workspaceDatabaseRows.publicToken, token)).limit(1);
  return row ?? null;
}

export async function getMemberPermissionForUser(workspaceId: number, userId: string): Promise<string | null> {
  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return member?.permission ?? null;
}
