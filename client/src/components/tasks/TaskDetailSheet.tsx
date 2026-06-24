import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient, fetchWithAuth } from "@/lib/queryClient";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Trash2, Plus, ExternalLink, Paperclip, Clock, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AggregatedTask } from "@shared/models/tasks";
import { TaskSourceBadge, TaskWorkspaceBadge } from "./TaskBadges";
import { STATUS_COLORS, buildTasksQueryKey, type TaskFilters } from "./constants";
import { TaskInlineLoading } from "./loading";
import { useToast } from "@/hooks/use-toast";
import { patchTasksListCache, rollbackTasksListCache } from "./mutations";

interface TaskDetailSheetProps {
  task: AggregatedTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: TaskFilters;
}

export function TaskDetailSheet({ task, open, onOpenChange, filters }: TaskDetailSheetProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Partial<AggregatedTask>>({});
  const [newSubtask, setNewSubtask] = useState("");
  const [comment, setComment] = useState("");
  const [hours, setHours] = useState("");
  const [timeNotes, setTimeNotes] = useState("");
  const nativeId = task?.nativeId ?? (task?.id.startsWith("native:") ? Number(task.id.slice(7)) : null);

  useEffect(() => {
    setDraft({});
    setNewSubtask("");
    setComment("");
    setHours("");
    setTimeNotes("");
  }, [task?.id, open]);

  const subtasksQuery = useQuery({
    queryKey: [`/api/tasks/${task?.id}/subtasks`],
    enabled: open && !!nativeId,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/tasks/native:${nativeId}/subtasks`);
      return res.json();
    },
  });

  const commentsQuery = useQuery({
    queryKey: [`/api/tasks/${task?.id}/comments`],
    enabled: open && !!nativeId,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/tasks/native:${nativeId}/comments`);
      return res.json();
    },
  });

  const timeLogsQuery = useQuery({
    queryKey: [`/api/tasks/${task?.id}/time-logs`],
    enabled: open && !!nativeId,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/tasks/native:${nativeId}/time-logs`);
      return res.json();
    },
  });

  const attachmentsQuery = useQuery({
    queryKey: [`/api/tasks/${task?.id}/attachments`],
    enabled: open && !!nativeId,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/tasks/native:${nativeId}/attachments`);
      return res.json();
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: buildTasksQueryKey(filters) });
    if (task) void queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}`] });
  };

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const res = await apiRequest("PUT", `/api/tasks/${task!.id}`, updates);
      return res.json();
    },
    onMutate: (updates) => {
      const previous = patchTasksListCache(queryClient, filters, task!.id, updates as Partial<AggregatedTask>);
      setDraft({});
      return { previous };
    },
    onError: (_err, _vars, context) => {
      rollbackTasksListCache(queryClient, filters, context?.previous);
      toast({ title: "Update failed", variant: "destructive" });
    },
    onSettled: () => invalidate(),
  });

  const subtasksKey = [`/api/tasks/${task?.id}/subtasks`];

  const addSubtaskMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("POST", `/api/tasks/native:${nativeId}/subtasks`, { title });
      return res.json();
    },
    onMutate: async (title) => {
      await queryClient.cancelQueries({ queryKey: subtasksKey });
      const previous = queryClient.getQueryData<{ id: number; title: string; isCompleted: boolean }[]>(subtasksKey) ?? [];
      const optimistic = { id: -Date.now(), title, isCompleted: false };
      queryClient.setQueryData(subtasksKey, [...previous, optimistic]);
      setNewSubtask("");
      patchTasksListCache(queryClient, filters, task!.id, {
        subtaskTotal: previous.length + 1,
        subtaskCompleted: previous.filter((s) => s.isCompleted).length,
      });
      return { previous };
    },
    onError: (_err, _title, context) => {
      if (context?.previous) queryClient.setQueryData(subtasksKey, context.previous);
      toast({ title: "Could not add sub-task", variant: "destructive" });
    },
    onSettled: () => { void subtasksQuery.refetch(); invalidate(); },
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: number; isCompleted: boolean }) => {
      const res = await apiRequest("PUT", `/api/tasks/subtasks/${id}`, { isCompleted });
      return res.json();
    },
    onMutate: async ({ id, isCompleted }) => {
      await queryClient.cancelQueries({ queryKey: subtasksKey });
      const previous = queryClient.getQueryData<{ id: number; title: string; isCompleted: boolean }[]>(subtasksKey) ?? [];
      const next = previous.map((s) => (s.id === id ? { ...s, isCompleted } : s));
      queryClient.setQueryData(subtasksKey, next);
      patchTasksListCache(queryClient, filters, task!.id, {
        subtaskTotal: next.length,
        subtaskCompleted: next.filter((s) => s.isCompleted).length,
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(subtasksKey, context.previous);
      toast({ title: "Could not update sub-task", variant: "destructive" });
    },
    onSettled: () => { void subtasksQuery.refetch(); invalidate(); },
  });

  const commentsKey = [`/api/tasks/${task?.id}/comments`];

  const addCommentMutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await apiRequest("POST", `/api/tasks/native:${nativeId}/comments`, { body });
      return res.json();
    },
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: commentsKey });
      const previous = queryClient.getQueryData(commentsKey) ?? [];
      const optimistic = {
        comment: { id: -Date.now(), body, createdAt: new Date().toISOString() },
        user: { firstName: "You", lastName: null },
      };
      queryClient.setQueryData(commentsKey, [...(previous as unknown[]), optimistic]);
      setComment("");
      return { previous };
    },
    onError: (_err, _body, context) => {
      if (context?.previous) queryClient.setQueryData(commentsKey, context.previous);
      toast({ title: "Could not post comment", variant: "destructive" });
    },
    onSettled: () => void commentsQuery.refetch(),
  });

  const timeLogsKey = [`/api/tasks/${task?.id}/time-logs`];

  const addTimeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/tasks/native:${nativeId}/time-logs`, {
        hours: Number(hours),
        notes: timeNotes || undefined,
      });
      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: timeLogsKey });
      const previous = queryClient.getQueryData(timeLogsKey) ?? [];
      const optimistic = {
        id: -Date.now(),
        hours: String(hours),
        notes: timeNotes || null,
        loggedAt: new Date().toISOString(),
      };
      queryClient.setQueryData(timeLogsKey, [...(previous as unknown[]), optimistic]);
      setHours("");
      setTimeNotes("");
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(timeLogsKey, context.previous);
      toast({ title: "Could not log time", variant: "destructive" });
    },
    onSettled: () => void timeLogsQuery.refetch(),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/document-files/upload", { method: "POST", body: form, credentials: "include" });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploaded = await uploadRes.json() as { originalName: string; storedName: string; size: number; mimeType: string };
      const fileUrl = `/uploads/${uploaded.storedName}`;
      const res = await apiRequest("POST", `/api/tasks/native:${nativeId}/attachments`, {
        fileName: uploaded.originalName ?? file.name,
        fileUrl,
        fileSize: uploaded.size ?? file.size,
        mimeType: uploaded.mimeType ?? file.type,
      });
      return res.json();
    },
    onSuccess: () => void attachmentsQuery.refetch(),
  });

  if (!task) return null;
  const current = { ...task, ...draft };
  const subtasks = subtasksQuery.data ?? [];
  const subDone = subtasks.filter((s: { isCompleted: boolean }) => s.isCompleted).length;
  const subPct = subtasks.length ? Math.round((subDone / subtasks.length) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-4 sm:p-6">
        <SheetHeader>
          <SheetTitle className="text-left">
            <Input
              value={current.title}
              disabled={task.isReadOnly && !nativeId}
              onChange={(e) => setDraft({ title: e.target.value })}
              onBlur={() => draft.title && updateMutation.mutate({ title: draft.title })}
              className="text-lg font-semibold border-0 px-0 focus-visible:ring-0"
            />
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          <div className="flex flex-wrap gap-2">
            <TaskSourceBadge source={task.source} />
            <TaskWorkspaceBadge name={task.workspaceName} color={task.workspaceColor} />
            {task.isPersonal && <Badge variant="outline" className="text-[10px]">Private</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={current.status}
                disabled={task.isReadOnly}
                onValueChange={(status) => updateMutation.mutate({ status })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <Select
                value={current.priority}
                disabled={!nativeId && task.externalKind !== "pm" && task.externalKind !== "crm"}
                onValueChange={(priority) => updateMutation.mutate({ priority })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Due date</Label>
              <Input
                type="date"
                value={current.dueDate ?? ""}
                className={cn(task.isOverdue && "text-destructive border-destructive/50")}
                disabled={!nativeId}
                onChange={(e) => setDraft({ dueDate: e.target.value })}
                onBlur={() => draft.dueDate !== undefined && updateMutation.mutate({ dueDate: draft.dueDate })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Context</Label>
              {task.contextHref ? (
                <Link href={task.contextHref} className="flex items-center gap-1 text-primary text-sm mt-2 hover:underline">
                  {task.contextLabel ?? "Open"} <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                <p className="text-sm mt-2">{task.contextLabel ?? "—"}</p>
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              rows={4}
              value={current.description ?? ""}
              disabled={!nativeId}
              onChange={(e) => setDraft({ description: e.target.value })}
              onBlur={() => draft.description !== undefined && updateMutation.mutate({ description: draft.description })}
            />
          </div>

          {nativeId && (
            <div>
              <Label className="text-xs text-muted-foreground">Tags</Label>
              <Input
                placeholder="Comma-separated tags"
                value={(current.tags ?? []).join(", ")}
                onChange={(e) =>
                  setDraft({
                    tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                  })
                }
                onBlur={() => draft.tags && updateMutation.mutate({ tags: draft.tags })}
              />
            </div>
          )}

          {nativeId && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-muted-foreground">Sub-tasks</Label>
                  <span className="text-xs text-muted-foreground">{subPct}%</span>
                </div>
                <Progress value={subPct} className="h-1.5 mb-2" />
                {subtasksQuery.isLoading ? (
                  <TaskInlineLoading label="Loading sub-tasks…" />
                ) : (
                <div className="space-y-2">
                  {subtasks.map((s: { id: number; title: string; isCompleted: boolean }) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={s.isCompleted}
                        onCheckedChange={(v) => toggleSubtaskMutation.mutate({ id: s.id, isCompleted: Boolean(v) })}
                      />
                      <span className={cn(s.isCompleted && "line-through text-muted-foreground")}>{s.title}</span>
                    </label>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      placeholder="Add sub-task"
                      className="h-8"
                      onKeyDown={(e) => e.key === "Enter" && newSubtask.trim() && addSubtaskMutation.mutate(newSubtask.trim())}
                    />
                    <Button size="sm" variant="outline" onClick={() => newSubtask.trim() && addSubtaskMutation.mutate(newSubtask.trim())}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Paperclip className="h-3 w-3" /> Attachments</Label>
                <Input
                  type="file"
                  className="mt-2"
                  disabled={uploadMutation.isPending}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadMutation.mutate(f);
                  }}
                />
                {uploadMutation.isPending && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                  </p>
                )}
                {attachmentsQuery.isLoading ? (
                  <TaskInlineLoading label="Loading attachments…" />
                ) : (
                <div className="mt-2 space-y-1">
                  {(attachmentsQuery.data ?? []).map((a: { id: number; fileName: string; fileUrl: string }) => (
                    <a key={a.id} href={a.fileUrl} target="_blank" rel="noreferrer" className="block text-sm text-primary hover:underline">
                      {a.fileName}
                    </a>
                  ))}
                </div>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Time logged</Label>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <Input type="number" step="0.25" min="0" placeholder="Hours" className="h-8 w-full sm:w-24" value={hours} onChange={(e) => setHours(e.target.value)} />
                  <Input placeholder="Notes" className="h-8 flex-1" value={timeNotes} onChange={(e) => setTimeNotes(e.target.value)} />
                  <Button size="sm" className="h-8" disabled={!hours || addTimeMutation.isPending} onClick={() => addTimeMutation.mutate()}>
                    {addTimeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log"}
                  </Button>
                </div>
                {timeLogsQuery.isLoading ? (
                  <TaskInlineLoading label="Loading time logs…" />
                ) : (
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {(timeLogsQuery.data ?? []).map((l: { id: number; hours: string; notes: string | null; loggedAt: string }) => (
                    <div key={l.id}>{l.hours}h — {l.notes ?? "No notes"}</div>
                  ))}
                </div>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Comments</Label>
                {commentsQuery.isLoading ? (
                  <TaskInlineLoading label="Loading comments…" />
                ) : (
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                  {(commentsQuery.data ?? []).map((row: { comment: { id: number; body: string; createdAt: string }; user?: { firstName: string | null; lastName: string | null } }) => (
                    <div key={row.comment.id} className="rounded-lg bg-muted/40 p-2 text-sm">
                      <div className="text-xs text-muted-foreground mb-1">
                        {row.user?.firstName} {row.user?.lastName}
                      </div>
                      {row.comment.body}
                    </div>
                  ))}
                </div>
                )}
                <div className="flex gap-2 mt-2">
                  <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment (@mention supported in text)" className="h-8 flex-1" />
                  <Button size="sm" disabled={!comment.trim() || addCommentMutation.isPending} onClick={() => addCommentMutation.mutate(comment.trim())}>
                    {addCommentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                  </Button>
                </div>
              </div>
            </>
          )}

          {task.isReadOnly && (
            <p className="text-xs text-muted-foreground">
              This task originates from {task.source}. Open the linked context to complete approval or meeting actions.
            </p>
          )}

          <Badge className={cn("text-xs", STATUS_COLORS[current.status])}>{current.status.replace("_", " ")}</Badge>

          {nativeId && (
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                await apiRequest("DELETE", `/api/tasks/${task.id}`);
                invalidate();
                onOpenChange(false);
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete task
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
