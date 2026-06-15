import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, fetchWithAuth } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Activity,
  Clock3,
  MessageSquare,
  Paperclip,
  Save,
  Send,
  Upload,
} from "lucide-react";
import type { WorkspaceDatabaseColumn, WorkspaceDatabaseRow } from "@shared/schema";
import { WorkspaceDetailSkeleton } from "./loading";
import { WorkspacePublicShareDialog } from "./WorkspacePublicShareDialog";

interface LocalComment {
  id: string;
  body: string;
  createdAt: string;
  userId: string;
}

interface LocalAttachment {
  id: string;
  filename: string;
  fileUrl: string;
  fileSize: number;
  createdAt: string;
}

interface ActivityItem {
  id: string;
  action: string;
  createdAt: string;
}

export function WorkspaceRowDetailPanel({
  rowId,
  databaseId,
  columns,
  onClose,
  readOnly = false,
}: {
  rowId: number;
  databaseId: number;
  columns: WorkspaceDatabaseColumn[];
  onClose: () => void;
  readOnly?: boolean;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [showPublicShare, setShowPublicShare] = useState(false);
  const [localComments, setLocalComments] = useState<LocalComment[]>([]);
  const [localAttachments, setLocalAttachments] = useState<LocalAttachment[]>([]);
  const [localActivity, setLocalActivity] = useState<ActivityItem[]>([]);

  const { data: rows = [], isLoading: rowsLoading } = useQuery<WorkspaceDatabaseRow[]>({
    queryKey: ["/api/workspace-databases", databaseId, "rows"],
    enabled: rowId > 0 && databaseId > 0,
  });

  const { data: serverComments = [] } = useQuery<LocalComment[]>({
    queryKey: ["/api/workspace-database-rows", rowId, "comments"],
    enabled: rowId > 0,
    queryFn: async () => {
      try {
        const res = await fetchWithAuth(`/api/workspace-database-rows/${rowId}/comments`);
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
  });

  const { data: serverActivity = [] } = useQuery<ActivityItem[]>({
    queryKey: ["/api/workspace-database-rows", rowId, "activity"],
    enabled: rowId > 0,
    queryFn: async () => {
      try {
        const res = await fetchWithAuth(`/api/workspace-database-rows/${rowId}/activity`);
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
  });

  const { data: serverAttachments = [] } = useQuery<LocalAttachment[]>({
    queryKey: ["/api/workspace-database-rows", rowId, "attachments"],
    enabled: rowId > 0,
    queryFn: async () => {
      try {
        const res = await fetchWithAuth(`/api/workspace-database-rows/${rowId}/attachments`);
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
  });

  const row = useMemo(() => rows.find((item) => item.id === rowId), [rowId, rows]);
  const rowData = ((row?.data || {}) as Record<string, unknown>) ?? {};

  useEffect(() => {
    if (rowId <= 0 || readOnly) return;
    apiRequest("POST", `/api/workspace-database-rows/${rowId}/lock`).catch(() => {});
    return () => {
      apiRequest("POST", `/api/workspace-database-rows/${rowId}/unlock`).catch(() => {});
    };
  }, [rowId, readOnly]);

  const updateRowMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const nextData = {
        ...rowData,
        [key]: value,
      };
      await apiRequest("PATCH", `/api/workspace-database-rows/${rowId}`, { data: nextData });
      return { key, value };
    },
    onSuccess: ({ key, value }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "rows"] });
      setLocalActivity((prev) => [
        {
          id: crypto.randomUUID(),
          action: `Updated ${resolveColumnName(key, columns)} to "${String(value || "")}"`,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    onError: (err: any) => {
      toast({
        title: "Failed to save field",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (body: string) => {
      try {
        await apiRequest("POST", `/api/workspace-database-rows/${rowId}/comments`, { body });
        return { persisted: true, body };
      } catch {
        return { persisted: false, body };
      }
    },
    onSuccess: ({ persisted, body }) => {
      if (persisted) {
        queryClient.invalidateQueries({ queryKey: ["/api/workspace-database-rows", rowId, "comments"] });
      } else {
        setLocalComments((prev) => [
          { id: crypto.randomUUID(), body, createdAt: new Date().toISOString(), userId: "you" },
          ...prev,
        ]);
      }
      setCommentDraft("");
    },
  });

  const comments = [...localComments, ...serverComments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const activity = [...localActivity, ...serverActivity].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const attachments = [...localAttachments, ...serverAttachments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const titleColumn = columns[0];
  const title = titleColumn ? String(rowData[String(titleColumn.id)] || `Row #${rowId}`) : `Row #${rowId}`;

  return (
    <Sheet open={Boolean(rowId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{title || "Row details"}</SheetTitle>
          <SheetDescription>
            Edit fields, comment with @mentions, review activity, and manage attachments.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="mt-6 h-[calc(100vh-9rem)] pr-4">
          {rowsLoading && !row ? (
            <WorkspaceDetailSkeleton />
          ) : (
          <>
          <section className="space-y-4">
            {columns.map((column) => {
              const key = String(column.id);
              const value = String(rowData[key] ?? "");
              return (
                <div key={column.id} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{column.name}</Label>
                  {column.type === "select" ? (
                    <Select
                      value={value}
                      onValueChange={(next) => updateRowMutation.mutate({ key, value: next })}
                      disabled={readOnly}
                    >
                      <SelectTrigger data-testid={`row-detail-select-${column.id}`}>
                        <SelectValue placeholder="Select value" />
                      </SelectTrigger>
                      <SelectContent>
                        {extractChoices(column.options).map((choice) => (
                          <SelectItem key={choice} value={choice}>
                            {choice}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : column.type === "date" ? (
                    <Input
                      type="date"
                      value={toDateInputValue(value)}
                      onChange={(e) => updateRowMutation.mutate({ key, value: e.target.value })}
                      disabled={readOnly}
                    />
                  ) : column.type === "checkbox" ? (
                    <Select
                      value={value === "true" ? "true" : "false"}
                      onValueChange={(next) => updateRowMutation.mutate({ key, value: next })}
                      disabled={readOnly}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">No</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={value}
                      onChange={(e) => updateRowMutation.mutate({ key, value: e.target.value })}
                      disabled={readOnly}
                    />
                  )}
                </div>
              );
            })}
          </section>

          <section className="mt-8 space-y-3 rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4" />
              Comments
            </div>
            <Textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Add a comment and mention teammates with @username..."
              className="min-h-[90px]"
              disabled={readOnly}
              data-testid="row-detail-comment-input"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                className="gap-1"
                disabled={!commentDraft.trim() || readOnly || addCommentMutation.isPending}
                onClick={() => addCommentMutation.mutate(commentDraft.trim())}
                data-testid="row-detail-comment-submit"
              >
                <Send className="h-3.5 w-3.5" />
                Post
              </Button>
            </div>
            <div className="space-y-2">
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground">No comments yet.</p>
              )}
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-md border p-2 text-sm">
                  <p className="mb-1 text-xs text-muted-foreground">
                    {comment.userId || "User"} · {new Date(comment.createdAt).toLocaleString()}
                  </p>
                  <p>{comment.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Paperclip className="h-4 w-4" />
                Attachments
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (readOnly) return;
                  const reader = new FileReader();
                  reader.onload = async () => {
                    const dataUrl = String(reader.result || "");
                    try {
                      await apiRequest("POST", `/api/workspace-database-rows/${rowId}/attachments`, {
                        filename: file.name,
                        fileUrl: dataUrl,
                        fileSize: file.size,
                      });
                      queryClient.invalidateQueries({ queryKey: ["/api/workspace-database-rows", rowId, "attachments"] });
                      toast({ title: "Attachment uploaded" });
                    } catch {
                      setLocalAttachments((prev) => [
                        {
                          id: crypto.randomUUID(),
                          filename: file.name,
                          fileSize: file.size,
                          fileUrl: dataUrl,
                          createdAt: new Date().toISOString(),
                        },
                        ...prev,
                      ]);
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={readOnly}
                onClick={() => fileInputRef.current?.click()}
                data-testid="row-detail-upload-button"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload
              </Button>
            </div>
            <div className="space-y-2">
              {attachments.length === 0 && (
                <p className="text-xs text-muted-foreground">No files attached yet.</p>
              )}
              {attachments.map((file) => (
                <a
                  key={file.id}
                  href={file.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-md border p-2 hover:bg-muted/40"
                >
                  <span className="text-sm">{file.filename}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {(file.fileSize / 1024).toFixed(1)} KB
                  </Badge>
                </a>
              ))}
            </div>
          </section>

          <section className="mt-8 space-y-3 rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4" />
              Activity log
            </div>
            <div className="space-y-2">
              {activity.length === 0 && (
                <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
              )}
              {activity.map((item) => (
                <div key={item.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className={cn("break-words", item.action ? "text-foreground" : "text-muted-foreground")}>
                      {item.action || "Updated row"}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          </>
          )}
        </ScrollArea>

        <div className="mt-4 flex justify-between border-t pt-4">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowPublicShare(true)} data-testid="row-public-link-btn">
            Public link
          </Button>
          <Button variant="outline" onClick={onClose} className="gap-1">
            <Save className="h-3.5 w-3.5" />
            Close
          </Button>
        </div>
        <WorkspacePublicShareDialog
          open={showPublicShare}
          onOpenChange={setShowPublicShare}
          targetType="row"
          targetId={rowId}
          label={title}
        />
      </SheetContent>
    </Sheet>
  );
}

function extractChoices(options: unknown): string[] {
  if (!options || typeof options !== "object") return [];
  const raw = (options as any).choices;
  if (!Array.isArray(raw)) return [];
  return raw.map((choice) => String(choice));
}

function resolveColumnName(key: string, columns: WorkspaceDatabaseColumn[]): string {
  const matched = columns.find((column) => String(column.id) === key);
  return matched?.name || "field";
}

function toDateInputValue(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}
