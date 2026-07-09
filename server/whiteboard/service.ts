import crypto from "crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  whiteboards,
  whiteboardMembers,
  whiteboardShareTokens,
  stickyNotes,
  whiteboardActivity,
  type StickyNote,
  type WhiteboardPermission,
  type WhiteboardListItem,
  type WhiteboardDetail
} from "@shared/models/whiteboard";
import { users } from "@shared/models/auth";

function genToken() {
  return crypto.randomBytes(24).toString("hex");
}

async function getUserDisplay(userId: string) {
  const [u] = await db.select({
    firstName: users.firstName, lastName: users.lastName, email: users.email,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return "Unknown";
  return u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.email ?? "Unknown");
}

export async function resolvePermission(
  whiteboardId: number,
  userId: string,
): Promise<"owner" | WhiteboardPermission | null> {
  const [board] = await db.select().from(whiteboards).where(eq(whiteboards.id, whiteboardId)).limit(1);
  if (!board) return null;
  if (board.ownerId === userId) return "owner";
  const [member] = await db.select().from(whiteboardMembers)
    .where(and(eq(whiteboardMembers.whiteboardId, whiteboardId), eq(whiteboardMembers.userId, userId)))
    .limit(1);
  return (member?.permission as WhiteboardPermission) ?? null;
}

async function logActivity(
  whiteboardId: number,
  eventType: string,
  actorId: string,
  actorName: string,
  noteId?: number | null,
  detail?: Record<string, unknown>,
) {
  await db.insert(whiteboardActivity).values({
    whiteboardId, eventType, actorId, actorName, noteId: noteId ?? null,
    detailJson: detail ?? {},
  });
}

export async function listWhiteboards(
  tenantId: number,
  userId: string,
  opts: { filter?: string; sort?: string; search?: string; projectId?: number | null },
): Promise<WhiteboardListItem[]> {
  const rows = await db.select().from(whiteboards)
    .where(eq(whiteboards.tenantId, tenantId))
    .orderBy(desc(whiteboards.updatedAt));

  const ids = rows.map(r => r.id);
  if (ids.length === 0) return [];

  const members = await db.select().from(whiteboardMembers).where(inArray(whiteboardMembers.whiteboardId, ids));
  const noteCounts = await db.select({
    whiteboardId: stickyNotes.whiteboardId,
    count: sql<number>`cast(count(*) filter (where ${stickyNotes.isDeleted} = false) as int)`,
  }).from(stickyNotes).where(inArray(stickyNotes.whiteboardId, ids)).groupBy(stickyNotes.whiteboardId);

  const countMap = new Map(noteCounts.map(n => [n.whiteboardId, n.count]));
  const memberMap = new Map<number, typeof members>();
  for (const m of members) {
    if (!memberMap.has(m.whiteboardId)) memberMap.set(m.whiteboardId, []);
    memberMap.get(m.whiteboardId)!.push(m);
  }

  const ownerIds = [...new Set(rows.map(r => r.ownerId))];
  const ownerRows = ownerIds.length
    ? await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users).where(inArray(users.id, ownerIds))
    : [];
  const ownerNameMap = new Map(ownerRows.map(u => [
    u.id,
    u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.email ?? "Unknown"),
  ]));

  let items: WhiteboardListItem[] = rows.map(r => {
    const mems = memberMap.get(r.id) ?? [];
    const isMember = r.ownerId === userId || mems.some(m => m.userId === userId);
    const myPerm = r.ownerId === userId ? "owner" as const
      : (mems.find(m => m.userId === userId)?.permission as WhiteboardPermission | undefined) ?? null;
    return {
      ...r,
      ownerName: ownerNameMap.get(r.ownerId),
      memberCount: mems.length + 1,
      noteCount: countMap.get(r.id) ?? 0,
      myPermission: myPerm ?? (isMember ? "edit" : "view"),
    };
  });

  // Access: owner, member, or no members yet (private to owner only per spec)
  items = items.filter(w => w.ownerId === userId || (memberMap.get(w.id) ?? []).some(m => m.userId === userId));

  const search = opts.search?.trim().toLowerCase();
  if (search) {
    items = items.filter(w => w.name.toLowerCase().includes(search)
      || (w.description ?? "").toLowerCase().includes(search));
  }

  switch (opts.filter) {
    case "mine":
      items = items.filter(w => w.ownerId === userId);
      break;
    case "shared":
      items = items.filter(w => w.ownerId !== userId);
      break;
    case "project":
      items = items.filter(w => w.projectId != null);
      if (opts.projectId != null) items = items.filter(w => w.projectId === opts.projectId);
      break;
    default:
      break;
  }

  switch (opts.sort) {
    case "name":
      items.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "created":
      items.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
      break;
    default:
      items.sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime());
  }

  return items;
}

export async function getWhiteboardDetail(id: number, userId: string): Promise<WhiteboardDetail | null> {
  const perm = await resolvePermission(id, userId);
  if (!perm) return null;

  const [board] = await db.select().from(whiteboards).where(eq(whiteboards.id, id)).limit(1);
  if (!board) return null;

  const notes = await db.select().from(stickyNotes)
    .where(and(eq(stickyNotes.whiteboardId, id), eq(stickyNotes.isDeleted, false)))
    .orderBy(stickyNotes.id);

  const members = await db.select().from(whiteboardMembers).where(eq(whiteboardMembers.whiteboardId, id));
  const memberUserIds = members.map(m => m.userId);
  const userRows = memberUserIds.length
    ? await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users).where(inArray(users.id, memberUserIds))
    : [];
  const userMap = new Map(userRows.map(u => [u.id, u]));

  const enrichedMembers = members.map(m => {
    const u = userMap.get(m.userId);
    return {
      ...m,
      userName: u ? (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.email ?? "Unknown")) : "Unknown",
      userEmail: u?.email ?? undefined,
    };
  });

  return {
    ...board,
    notes,
    members: enrichedMembers,
    myPermission: perm,
    ownerName: await getUserDisplay(board.ownerId),
  };
}

export async function createWhiteboard(
  tenantId: number,
  userId: string,
  userName: string,
  data: { name: string; description?: string; projectId?: number | null; workspaceId?: number | null },
) {
  const [board] = await db.insert(whiteboards).values({
    tenantId,
    workspaceId: data.workspaceId ?? null,
    projectId: data.projectId ?? null,
    name: data.name,
    description: data.description ?? null,
    ownerId: userId,
  }).returning();

  await logActivity(board.id, "user_joined", userId, userName);
  return board;
}

export async function updateWhiteboard(
  id: number,
  userId: string,
  _userName: string,
  data: { name?: string; description?: string | null; projectId?: number | null; thumbnailUrl?: string | null },
) {
  const perm = await resolvePermission(id, userId);
  if (!perm || (perm !== "owner" && perm !== "admin")) {
    throw new Error("Only admins can edit whiteboard details");
  }
  const [updated] = await db.update(whiteboards).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(whiteboards.id, id)).returning();
  return updated;
}

export async function deleteWhiteboard(id: number, userId: string) {
  const perm = await resolvePermission(id, userId);
  if (!perm || (perm !== "owner" && perm !== "admin")) {
    throw new Error("Only admins can delete this whiteboard");
  }
  await db.delete(whiteboards).where(eq(whiteboards.id, id));
}

export async function createNote(
  whiteboardId: number,
  userId: string,
  userName: string,
  data: Partial<StickyNote>,
) {
  const perm = await resolvePermission(whiteboardId, userId);
  if (!perm || perm === "view") throw new Error("View-only access");

  const [note] = await db.insert(stickyNotes).values({
    whiteboardId,
    text: data.text ?? "",
    noteType: data.noteType ?? "idea",
    colourHex: data.colourHex ?? null,
    xPosition: data.xPosition ?? 0,
    yPosition: data.yPosition ?? 0,
    width: data.width ?? 200,
    height: data.height ?? 200,
    createdBy: userId,
  }).returning();

  await db.update(whiteboards).set({ updatedAt: new Date() }).where(eq(whiteboards.id, whiteboardId));
  await logActivity(whiteboardId, "note_created", userId, userName, note.id, { text: note.text });
  return note;
}

export async function updateNote(
  noteId: number,
  userId: string,
  userName: string,
  data: Partial<StickyNote>,
) {
  const [existing] = await db.select().from(stickyNotes).where(eq(stickyNotes.id, noteId)).limit(1);
  if (!existing || existing.isDeleted) throw new Error("Note not found");

  const perm = await resolvePermission(existing.whiteboardId, userId);
  if (!perm || perm === "view") throw new Error("View-only access");

  const [note] = await db.update(stickyNotes).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(stickyNotes.id, noteId)).returning();

  await db.update(whiteboards).set({ updatedAt: new Date() }).where(eq(whiteboards.id, existing.whiteboardId));

  const eventType = data.xPosition != null || data.yPosition != null ? "note_moved" : "note_edited";
  await logActivity(existing.whiteboardId, eventType, userId, userName, noteId, data as Record<string, unknown>);
  return note;
}

export async function deleteNote(noteId: number, userId: string, userName: string) {
  const [existing] = await db.select().from(stickyNotes).where(eq(stickyNotes.id, noteId)).limit(1);
  if (!existing) throw new Error("Note not found");

  const perm = await resolvePermission(existing.whiteboardId, userId);
  if (!perm || perm === "view") throw new Error("View-only access");

  await db.update(stickyNotes).set({ isDeleted: true, updatedAt: new Date() }).where(eq(stickyNotes.id, noteId));
  await db.update(whiteboards).set({ updatedAt: new Date() }).where(eq(whiteboards.id, existing.whiteboardId));
  await logActivity(existing.whiteboardId, "note_deleted", userId, userName, noteId);
}

export async function bulkDeleteNotes(noteIds: number[], userId: string, userName: string) {
  for (const id of noteIds) {
    await deleteNote(id, userId, userName);
  }
}

export async function duplicateNote(noteId: number, userId: string, userName: string) {
  const [existing] = await db.select().from(stickyNotes).where(eq(stickyNotes.id, noteId)).limit(1);
  if (!existing || existing.isDeleted) throw new Error("Note not found");

  return createNote(existing.whiteboardId, userId, userName, {
    text: existing.text,
    noteType: existing.noteType,
    colourHex: existing.colourHex,
    xPosition: existing.xPosition + 20,
    yPosition: existing.yPosition + 20,
    width: existing.width,
    height: existing.height,
  });
}

export async function listActivity(whiteboardId: number, userId: string, filters?: { userId?: string; eventType?: string }) {
  const perm = await resolvePermission(whiteboardId, userId);
  if (!perm) throw new Error("Access denied");

  const conditions = [eq(whiteboardActivity.whiteboardId, whiteboardId)];
  if (filters?.userId) conditions.push(eq(whiteboardActivity.actorId, filters.userId));
  if (filters?.eventType) conditions.push(eq(whiteboardActivity.eventType, filters.eventType));

  return db.select().from(whiteboardActivity)
    .where(and(...conditions))
    .orderBy(desc(whiteboardActivity.createdAt))
    .limit(200);
}

export async function listMembers(whiteboardId: number, userId: string) {
  const perm = await resolvePermission(whiteboardId, userId);
  if (!perm) throw new Error("Access denied");
  return getWhiteboardDetail(whiteboardId, userId);
}

export async function addMember(
  whiteboardId: number,
  actorId: string,
  targetUserId: string,
  permission: WhiteboardPermission,
) {
  const perm = await resolvePermission(whiteboardId, actorId);
  if (!perm || (perm !== "owner" && perm !== "admin")) throw new Error("Only admins can manage access");

  const [board] = await db.select().from(whiteboards).where(eq(whiteboards.id, whiteboardId)).limit(1);
  if (!board) throw new Error("Not found");
  if (board.ownerId === targetUserId) throw new Error("Owner already has full access");

  const [existing] = await db.select().from(whiteboardMembers)
    .where(and(eq(whiteboardMembers.whiteboardId, whiteboardId), eq(whiteboardMembers.userId, targetUserId)))
    .limit(1);

  if (existing) {
    const [updated] = await db.update(whiteboardMembers)
      .set({ permission })
      .where(eq(whiteboardMembers.id, existing.id))
      .returning();
    return updated;
  }

  const [member] = await db.insert(whiteboardMembers).values({
    whiteboardId, userId: targetUserId, permission, invitedBy: actorId,
  }).returning();
  return member;
}

export async function removeMember(whiteboardId: number, actorId: string, targetUserId: string) {
  const perm = await resolvePermission(whiteboardId, actorId);
  if (!perm || (perm !== "owner" && perm !== "admin")) throw new Error("Only admins can manage access");

  const [board] = await db.select().from(whiteboards).where(eq(whiteboards.id, whiteboardId)).limit(1);
  if (board?.ownerId === targetUserId) throw new Error("Cannot remove owner");

  await db.delete(whiteboardMembers)
    .where(and(eq(whiteboardMembers.whiteboardId, whiteboardId), eq(whiteboardMembers.userId, targetUserId)));
}

export async function createShareToken(whiteboardId: number, actorId: string, permission: WhiteboardPermission, allowAnonymous = false) {
  const perm = await resolvePermission(whiteboardId, actorId);
  if (!perm || (perm !== "owner" && perm !== "admin")) throw new Error("Only admins can create share links");

  const [token] = await db.insert(whiteboardShareTokens).values({
    whiteboardId, token: genToken(), permission, allowAnonymous,
  }).returning();
  return token;
}

export async function getWhiteboardByShareToken(token: string) {
  const [row] = await db.select().from(whiteboardShareTokens).where(eq(whiteboardShareTokens.token, token)).limit(1);
  if (!row) return null;
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null;
  const [board] = await db.select().from(whiteboards).where(eq(whiteboards.id, row.whiteboardId)).limit(1);
  return board ? { board, share: row } : null;
}

export async function getWhiteboardDetailByShareToken(token: string) {
  const resolved = await getWhiteboardByShareToken(token);
  if (!resolved) return null;
  const notes = await db.select().from(stickyNotes)
    .where(and(eq(stickyNotes.whiteboardId, resolved.board.id), eq(stickyNotes.isDeleted, false)))
    .orderBy(stickyNotes.id);
  return {
    board: resolved.board,
    permission: resolved.share.permission as WhiteboardPermission,
    notes,
  };
}

export async function searchOrgUsers(tenantId: number, query: string) {
  const { storage } = await import("../storage");
  return storage.searchUsers(tenantId, query);
}

export async function logUserJoined(whiteboardId: number, userId: string, userName: string) {
  await logActivity(whiteboardId, "user_joined", userId, userName);
}

export async function countNotes(whiteboardId: number) {
  const [row] = await db.select({
    count: sql<number>`cast(count(*) as int)`,
  }).from(stickyNotes)
    .where(and(eq(stickyNotes.whiteboardId, whiteboardId), eq(stickyNotes.isDeleted, false)));
  return row?.count ?? 0;
}
