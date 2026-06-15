/**
 * Seed Workspaces module with demo data for UI testing.
 *
 * Usage: npm run db:seed-workspaces
 *        FORCE=1 npm run db:seed-workspaces   (re-seed even if demo workspaces exist)
 */
import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { users, workspaces, workspaceAccessLog } from "@shared/schema";
import { SPEC_DEFAULT_COLUMNS } from "./workspaces/defaults";

const TENANT_ID = Number(process.env.SEED_TENANT_ID ?? 1);
const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true";

const DEMO_NAMES = [
  "Product Launch Hub",
  "Engineering Wiki",
  "Client Onboarding (Archived)",
] as const;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

type DemoRow = {
  name: string;
  status: string;
  priority: string;
  assignee: string;
  dueDate: string;
  notes: string;
};

const SAMPLE_ROWS: DemoRow[] = [
  {
    name: "Finalize launch checklist",
    status: "In Progress",
    priority: "High",
    assignee: "Alex Morgan",
    dueDate: daysFromNow(3),
    notes: "Review go-live criteria with delivery team.",
  },
  {
    name: "Stakeholder sign-off deck",
    status: "To Do",
    priority: "Medium",
    assignee: "Sam Patel",
    dueDate: daysFromNow(7),
    notes: "Include ROI summary and rollout timeline.",
  },
  {
    name: "Beta feedback triage",
    status: "Done",
    priority: "Low",
    assignee: "Jordan Lee",
    dueDate: daysFromNow(-2),
    notes: "Closed after sprint review.",
  },
  {
    name: "Integration smoke tests",
    status: "Blocked",
    priority: "High",
    assignee: "Alex Morgan",
    dueDate: daysFromNow(1),
    notes: "Waiting on sandbox credentials.",
  },
];

async function seedBoardRows(
  databaseId: number,
  userId: string | null,
  rows: DemoRow[],
) {
  const columns = await storage.getWorkspaceDatabaseColumns(databaseId);
  const byName = new Map(columns.map((c) => [c.name, c.id]));
  const anchorId = byName.get("Name");
  if (!anchorId) return 0;

  let created = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const data: Record<string, unknown> = {};
    if (byName.has("Name")) data[String(byName.get("Name"))] = row.name;
    if (byName.has("Status")) data[String(byName.get("Status"))] = row.status;
    if (byName.has("Priority")) data[String(byName.get("Priority"))] = row.priority;
    if (byName.has("Assignee")) data[String(byName.get("Assignee"))] = row.assignee;
    if (byName.has("Due Date")) data[String(byName.get("Due Date"))] = row.dueDate;
    if (byName.has("Notes")) data[String(byName.get("Notes"))] = row.notes;

    await storage.createWorkspaceDatabaseRow({
      databaseId,
      data,
      sortOrder: i,
      createdBy: userId,
    });
    created++;
  }
  return created;
}

async function ensureDemoWorkspace(
  userId: string,
  def: {
    name: (typeof DEMO_NAMES)[number];
    description: string;
    icon: string;
    color: string;
    status: string;
    isFavorite: boolean;
    pages: Array<{
      title: string;
      pageType: string;
      content?: string;
      icon?: string;
      boardName?: string;
      rows?: DemoRow[];
    }>;
  },
) {
  const [existing] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.tenantId, TENANT_ID), eq(workspaces.name, def.name)))
    .limit(1);

  if (existing && !FORCE) {
    console.log(`  • Skipped "${def.name}" (already exists, id=${existing.id})`);
    return existing;
  }

  if (existing && FORCE) {
    await storage.deleteWorkspace(existing.id);
    console.log(`  • Removed existing "${def.name}" for re-seed`);
  }

  const workspace = await storage.createWorkspace({
    tenantId: TENANT_ID,
    name: def.name,
    description: def.description,
    icon: def.icon,
    color: def.color,
    status: def.status,
    isFavorite: def.isFavorite,
    createdBy: userId,
  });

  await storage.addWorkspaceMember({
    workspaceId: workspace.id,
    userId,
    role: "owner",
    permission: "admin",
    invitedBy: userId,
  });

  for (let pageIndex = 0; pageIndex < def.pages.length; pageIndex++) {
    const pageDef = def.pages[pageIndex];
    const page = await storage.createWorkspacePage({
      workspaceId: workspace.id,
      parentId: null,
      title: pageDef.title,
      icon: pageDef.icon ?? null,
      content: pageDef.content ?? null,
      pageType: pageDef.pageType,
      documentStatus: "Published",
      sortOrder: pageIndex,
      createdBy: userId,
      updatedBy: userId,
    });

    if (pageDef.boardName) {
      const board = await storage.createWorkspaceDatabase({
        pageId: page.id,
        name: pageDef.boardName,
        activeView: "table",
      });

      for (const col of SPEC_DEFAULT_COLUMNS) {
        await storage.createWorkspaceDatabaseColumn({
          databaseId: board.id,
          name: col.name,
          type: col.type,
          sortOrder: col.sortOrder,
          options: col.options ?? null,
          width: col.width ?? null,
          isVisible: true,
        });
      }

      if (pageDef.rows?.length) {
        await seedBoardRows(board.id, userId, pageDef.rows);
      }
    }
  }

  await db.insert(workspaceAccessLog).values({
    workspaceId: workspace.id,
    userId,
    accessedAt: daysAgo(def.isFavorite ? 0 : 2),
  });

  console.log(`  • Created "${def.name}" (id=${workspace.id})`);
  return workspace;
}

async function main() {
  console.log(`Seeding workspaces demo for tenant ${TENANT_ID}...`);

  const [user] = await db.select().from(users).limit(1);
  if (!user) {
    console.error("No users found — log in once or run another seed first.");
    process.exit(1);
  }

  const userId = user.id;

  await ensureDemoWorkspace(userId, {
    name: "Product Launch Hub",
    description: "Cross-functional launch planning — checklists, docs and tracking board.",
    icon: "rocket",
    color: "#7C3AED",
    status: "active",
    isFavorite: true,
    pages: [
      {
        title: "Launch Overview",
        pageType: "page",
        icon: "file-text",
        content: "<h2>Launch overview</h2><p>Demo workspace for product launch coordination.</p>",
      },
      {
        title: "Launch Tracker",
        pageType: "database",
        icon: "table-2",
        boardName: "Launch Tasks",
        rows: SAMPLE_ROWS,
      },
      {
        title: "Meeting Notes",
        pageType: "page",
        icon: "message-square",
        content: "<h3>Weekly sync</h3><ul><li>Review blockers</li><li>Confirm beta feedback</li></ul>",
      },
    ],
  });

  await ensureDemoWorkspace(userId, {
    name: "Engineering Wiki",
    description: "Technical documentation, runbooks and team processes.",
    icon: "book-open",
    color: "#1E88C8",
    status: "active",
    isFavorite: false,
    pages: [
      {
        title: "Architecture",
        pageType: "page",
        icon: "layout-dashboard",
        content: "<h2>System architecture</h2><p>High-level diagram and service boundaries.</p>",
      },
      {
        title: "Sprint Board",
        pageType: "database",
        icon: "clipboard-list",
        boardName: "Sprint Items",
        rows: SAMPLE_ROWS.slice(0, 3),
      },
    ],
  });

  await ensureDemoWorkspace(userId, {
    name: "Client Onboarding (Archived)",
    description: "Completed onboarding playbook — kept for reference.",
    icon: "briefcase",
    color: "#94A3B8",
    status: "archived",
    isFavorite: false,
    pages: [
      {
        title: "Onboarding Checklist",
        pageType: "page",
        icon: "file-check",
        content: "<p>Archived workspace — read-only reference for past engagements.</p>",
      },
    ],
  });

  console.log("\nWorkspaces demo seed complete.");
  console.log("Open /modules/workspaces to view the data.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Workspaces seed failed:", err);
  process.exit(1);
});
