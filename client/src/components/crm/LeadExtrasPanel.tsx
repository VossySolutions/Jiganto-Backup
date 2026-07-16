import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { CrmLead, CrmNoteRecord } from "./types";
import {
  MessageSquare, Paperclip, ListTodo, Trash2, Plus, Upload, FileIcon, Loader2,
} from "lucide-react";

type CrmAttachmentRow = {
  id: number;
  fileName: string;
  fileType?: string | null;
  fileSize?: number | null;
  fileUrl?: string | null;
  createdAt: string;
};

type LeadTaskRow = {
  id: number;
  subject: string;
  status?: string | null;
  completedAt?: string | null;
};

type LeadExtrasTab = "comments" | "files" | "subtasks";

type LeadSubtask = { id: string; title: string; done: boolean };

function readSubtasks(lead: CrmLead): LeadSubtask[] {
  const raw = lead.customData && typeof lead.customData === "object"
    ? (lead.customData as Record<string, unknown>)["_subtasks"]
    : undefined;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is LeadSubtask => !!s && typeof s === "object" && typeof (s as LeadSubtask).id === "string")
    .map((s) => ({ id: s.id, title: String(s.title || ""), done: !!s.done }));
}

function formatBytes(n?: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeadExtrasPanel({
  lead,
  initialTab = "comments",
}: {
  lead: CrmLead;
  initialTab?: LeadExtrasTab;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<LeadExtrasTab>(initialTab);
  const [noteContent, setNoteContent] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notesKey = [`/api/crm/notes?entityType=lead&entityId=${lead.id}`];
  const filesKey = [`/api/crm/attachments?entityType=lead&entityId=${lead.id}`];
  const tasksKey = [`/api/crm/tasks?entityType=lead&entityId=${lead.id}`];

  const { data: notes = [], isLoading: notesLoading } = useQuery<CrmNoteRecord[]>({
    queryKey: notesKey,
  });

  const { data: attachments = [], isLoading: filesLoading } = useQuery<CrmAttachmentRow[]>({
    queryKey: filesKey,
  });

  const { data: linkedTasks = [] } = useQuery<LeadTaskRow[]>({
    queryKey: tasksKey,
  });

  const createNote = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/crm/notes", {
        entityType: "lead",
        entityId: lead.id,
        content,
      });
      return res.json() as Promise<CrmNoteRecord>;
    },
    onSuccess: (note) => {
      queryClient.setQueryData<CrmNoteRecord[]>(notesKey, (prev) => [note, ...(prev ?? [])]);
      setNoteContent("");
      toast({ title: "Comment added" });
    },
    onError: () => toast({ title: "Failed to add comment", variant: "destructive" }),
  });

  const deleteNote = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/notes/${id}`),
    onSuccess: (_r, id) => {
      queryClient.setQueryData<CrmNoteRecord[]>(notesKey, (prev) => (prev ?? []).filter((n) => n.id !== id));
    },
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      const fileUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      const res = await apiRequest("POST", "/api/crm/attachments", {
        entityType: "lead",
        entityId: lead.id,
        fileName: file.name,
        fileType: file.type || null,
        fileSize: file.size,
        fileUrl,
      });
      return res.json() as Promise<CrmAttachmentRow>;
    },
    onSuccess: (row) => {
      queryClient.setQueryData<CrmAttachmentRow[]>(filesKey, (prev) => [row, ...(prev ?? [])]);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/attachments?entityType=lead"] });
      toast({ title: "File uploaded" });
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Upload failed";
      toast({
        title: "Upload failed",
        description: /db:push|attachments table/i.test(message)
          ? message
          : "Could not upload file. Run npm run db:push if the attachments table is missing.",
        variant: "destructive",
      });
    },
  });

  const deleteFile = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/attachments/${id}`),
    onSuccess: (_r, id) => {
      queryClient.setQueryData<CrmAttachmentRow[]>(filesKey, (prev) => (prev ?? []).filter((a) => a.id !== id));
      queryClient.invalidateQueries({ queryKey: ["/api/crm/attachments?entityType=lead"] });
    },
  });

  const saveSubtasks = useMutation({
    mutationFn: (subtasks: LeadSubtask[]) =>
      apiRequest("PUT", `/api/crm/leads/${lead.id}`, {
        customData: { ...(lead.customData || {}), _subtasks: subtasks },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
    },
    onError: () => toast({ title: "Failed to update subtasks", variant: "destructive" }),
  });

  const createLinkedTask = useMutation({
    mutationFn: (subject: string) =>
      apiRequest("POST", "/api/crm/tasks", {
        subject,
        leadId: lead.id,
        status: "pending",
        priority: "normal",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks?entityType=lead"] });
      setSubtaskTitle("");
      toast({ title: "Subtask added" });
    },
    onError: () => toast({ title: "Failed to add subtask", variant: "destructive" }),
  });

  const toggleLinkedTask = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      apiRequest("PUT", `/api/crm/tasks/${id}`, {
        status: done ? "completed" : "pending",
        completedAt: done ? new Date().toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks?entityType=lead"] });
    },
  });

  const deleteLinkedTask = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks?entityType=lead"] });
    },
  });

  const localSubtasks = useMemo(() => readSubtasks(lead), [lead]);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    Array.from(fileList).forEach((f) => uploadFile.mutate(f));
  };

  const tabs: { id: LeadExtrasTab; label: string; icon: typeof MessageSquare; count?: number }[] = [
    { id: "comments", label: "Comments", icon: MessageSquare, count: notes.length },
    { id: "files", label: "Files", icon: Paperclip, count: attachments.length },
    { id: "subtasks", label: "Subtasks", icon: ListTodo, count: linkedTasks.length + localSubtasks.length },
  ];

  return (
    <div className="border-t border-border/40" data-testid="lead-extras-panel">
      <div className="flex items-center gap-1 px-4 pt-3">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                tab === t.id
                  ? "bg-[#cce5ff] text-[#0073ea]"
                  : "text-muted-foreground hover:bg-muted",
              )}
              data-testid={`lead-extras-tab-${t.id}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {typeof t.count === "number" && t.count > 0 && (
                <span className="text-[10px] opacity-70">({t.count})</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-4 py-3 space-y-3">
        {tab === "comments" && (
          <>
            <div className="space-y-2">
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Add a comment…"
                className="min-h-[72px] text-sm"
                data-testid="input-lead-comment"
              />
              <Button
                size="sm"
                disabled={!noteContent.trim() || createNote.isPending}
                onClick={() => createNote.mutate(noteContent.trim())}
                data-testid="button-add-lead-comment"
              >
                {createNote.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                Comment
              </Button>
            </div>
            {notesLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No comments yet.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-lg border border-border/40 p-2.5 bg-muted/20">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-destructive"
                        onClick={() => deleteNote.mutate(n.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "files" && (
          <>
            <div
              className={cn(
                "rounded-xl border-2 border-dashed p-6 text-center transition-colors",
                dragging ? "border-[#0073ea] bg-[#cce5ff]/40" : "border-border/60 bg-muted/10",
              )}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              data-testid="lead-file-dropzone"
            >
              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Drag files here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadFile.isPending}
              >
                {uploadFile.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Paperclip className="h-3.5 w-3.5 mr-1" />}
                Choose files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            {filesLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : attachments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No files yet.</p>
            ) : (
              <div className="space-y-1.5">
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border/40 px-2.5 py-2">
                    <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      {a.fileUrl ? (
                        <a href={a.fileUrl} download={a.fileName} className="text-sm font-medium text-[#0073ea] hover:underline truncate block">
                          {a.fileName}
                        </a>
                      ) : (
                        <p className="text-sm font-medium truncate">{a.fileName}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">{formatBytes(a.fileSize)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteFile.mutate(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "subtasks" && (
          <>
            <div className="flex gap-2">
              <Input
                value={subtaskTitle}
                onChange={(e) => setSubtaskTitle(e.target.value)}
                placeholder="Add a subtask…"
                className="h-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && subtaskTitle.trim()) {
                    createLinkedTask.mutate(subtaskTitle.trim());
                  }
                }}
                data-testid="input-lead-subtask"
              />
              <Button
                size="sm"
                className="h-8"
                disabled={!subtaskTitle.trim() || createLinkedTask.isPending}
                onClick={() => createLinkedTask.mutate(subtaskTitle.trim())}
                data-testid="button-add-lead-subtask"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-1.5">
              {linkedTasks.map((t) => {
                const done = t.status === "completed" || !!t.completedAt;
                return (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border/40 px-2.5 py-2">
                    <Checkbox
                      checked={done}
                      onCheckedChange={(c) => toggleLinkedTask.mutate({ id: t.id, done: !!c })}
                    />
                    <span className={cn("text-sm flex-1", done && "line-through text-muted-foreground")}>{t.subject}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteLinkedTask.mutate(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}

              {localSubtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border/40 px-2.5 py-2">
                  <Checkbox
                    checked={s.done}
                    onCheckedChange={(c) => {
                      const next = localSubtasks.map((x) => (x.id === s.id ? { ...x, done: !!c } : x));
                      saveSubtasks.mutate(next);
                    }}
                  />
                  <span className={cn("text-sm flex-1", s.done && "line-through text-muted-foreground")}>{s.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => saveSubtasks.mutate(localSubtasks.filter((x) => x.id !== s.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              {linkedTasks.length === 0 && localSubtasks.length === 0 && (
                <p className="text-xs text-muted-foreground">No subtasks yet.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
