import { apiRequest } from "@/lib/queryClient";
import type { WhiteboardListItem, WhiteboardDetail, WhiteboardActivity, StickyNote } from "@shared/models/whiteboard";

export async function fetchWhiteboards(params: { filter?: string; sort?: string; search?: string; projectId?: number }) {
  const qs = new URLSearchParams();
  if (params.filter) qs.set("filter", params.filter);
  if (params.sort) qs.set("sort", params.sort);
  if (params.search) qs.set("search", params.search);
  if (params.projectId) qs.set("projectId", String(params.projectId));
  const res = await apiRequest("GET", `/api/whiteboard?${qs}`);
  return res.json() as Promise<WhiteboardListItem[]>;
}

export async function fetchWhiteboard(id: number) {
  const res = await apiRequest("GET", `/api/whiteboard/${id}`);
  return res.json() as Promise<WhiteboardDetail>;
}

export async function createWhiteboard(body: { name: string; description?: string; projectId?: number }) {
  const res = await apiRequest("POST", "/api/whiteboard", body);
  return res.json() as Promise<WhiteboardListItem>;
}

export async function updateWhiteboard(id: number, body: Record<string, unknown>) {
  const res = await apiRequest("PATCH", `/api/whiteboard/${id}`, body);
  return res.json();
}

export async function deleteWhiteboard(id: number) {
  await apiRequest("DELETE", `/api/whiteboard/${id}`);
}

export async function fetchWhiteboardActivity(id: number, filters?: { userId?: string; eventType?: string }) {
  const qs = new URLSearchParams();
  if (filters?.userId) qs.set("userId", filters.userId);
  if (filters?.eventType) qs.set("eventType", filters.eventType);
  const res = await apiRequest("GET", `/api/whiteboard/${id}/activity?${qs}`);
  return res.json() as Promise<WhiteboardActivity[]>;
}

export async function searchWhiteboardUsers(q: string) {
  if (q.length < 2) return [];
  const res = await apiRequest("GET", `/api/whiteboard/users/search?q=${encodeURIComponent(q)}`);
  return res.json() as Promise<{ id: string; firstName?: string; lastName?: string; email?: string }[]>;
}

export async function addWhiteboardMember(boardId: number, userId: string, permission: string) {
  const res = await apiRequest("POST", `/api/whiteboard/${boardId}/members`, { userId, permission });
  return res.json();
}

export async function createShareToken(boardId: number, permission: string) {
  const res = await apiRequest("POST", `/api/whiteboard/${boardId}/share-token`, { permission });
  return res.json() as Promise<{ token: string }>;
}

export async function createNote(boardId: number, body: Record<string, unknown>) {
  const res = await apiRequest("POST", `/api/whiteboard/${boardId}/notes`, body);
  return res.json() as Promise<StickyNote>;
}

export async function patchNote(noteId: number, body: Record<string, unknown>) {
  const res = await apiRequest("PATCH", `/api/whiteboard/notes/${noteId}`, body);
  return res.json() as Promise<StickyNote>;
}

export async function deleteNote(noteId: number) {
  await apiRequest("DELETE", `/api/whiteboard/notes/${noteId}`);
}

export function apiErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
