import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, fetchWithAuth } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, RotateCcw, History } from "lucide-react";
import { WorkspaceQueryShell } from "./loading";

interface PageComment {
  comment: {
    id: number;
    content: string;
    createdAt: string;
    userId: string;
  };
  user?: { id: string; firstName?: string | null; lastName?: string | null };
}

interface PageVersion {
  id: number;
  version: number;
  title: string;
  createdAt: string;
  authorId?: string | null;
}

export function WorkspacePageSidePanel({
  pageId,
  open,
  onOpenChange,
  readOnly = false,
  onRestored,
}: {
  pageId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
  onRestored?: () => void;
}) {
  const { toast } = useToast();
  const [commentDraft, setCommentDraft] = useState("");
  const [tab, setTab] = useState("comments");

  const commentsQuery = useQuery<PageComment[]>({
    queryKey: ["/api/workspace-pages", pageId, "comments"],
    enabled: open && pageId > 0,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/workspace-pages/${pageId}/comments`);
      if (!res.ok) throw new Error("Failed to load comments");
      return res.json();
    },
  });

  const versionsQuery = useQuery<PageVersion[]>({
    queryKey: ["/api/workspace-pages", pageId, "versions"],
    enabled: open && pageId > 0,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/workspace-pages/${pageId}/versions`);
      if (!res.ok) throw new Error("Failed to load versions");
      return res.json();
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/workspace-pages/${pageId}/comments`, { content }),
    onSuccess: () => {
      setCommentDraft("");
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-pages", pageId, "comments"] });
    },
    onError: () => toast({ title: "Failed to add comment", variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: number) =>
      apiRequest("POST", `/api/workspace-page-versions/${versionId}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-pages", pageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-pages", pageId, "versions"] });
      toast({ title: "Version restored" });
      onRestored?.();
    },
    onError: () => toast({ title: "Failed to restore version", variant: "destructive" }),
  });

  const latestVersion = versionsQuery.data?.[0]?.version;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Page collaboration</SheetTitle>
          <SheetDescription>Comments and version history for this document.</SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-4 flex flex-col flex-1 min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="comments" className="gap-1 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              Comments
            </TabsTrigger>
            <TabsTrigger value="versions" className="gap-1 text-xs">
              <History className="h-3.5 w-3.5" />
              Versions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comments" className="flex flex-col flex-1 min-h-0 mt-3">
            <ScrollArea className="flex-1 pr-3">
              <WorkspaceQueryShell query={commentsQuery} skeleton="detail">
                {(commentsQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No comments yet</p>
                ) : (
                  <div className="space-y-3">
                    {(commentsQuery.data ?? []).map(({ comment, user }) => {
                      const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || comment.userId;
                      return (
                        <div key={comment.id} className="rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-medium">{name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">{comment.content}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </WorkspaceQueryShell>
            </ScrollArea>
            {!readOnly && (
              <form
                className="flex gap-2 pt-3 border-t mt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (commentDraft.trim()) addCommentMutation.mutate(commentDraft.trim());
                }}
              >
                <Input
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Add a comment..."
                  data-testid="workspace-page-comment-input"
                />
                <Button type="submit" size="sm" disabled={addCommentMutation.isPending || !commentDraft.trim()}>
                  {addCommentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                </Button>
              </form>
            )}
          </TabsContent>

          <TabsContent value="versions" className="mt-3">
            <WorkspaceQueryShell query={versionsQuery} skeleton="detail">
              {(versionsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No saved versions yet</p>
              ) : (
                <div className="space-y-2">
                  {(versionsQuery.data ?? []).map((version) => (
                    <div key={version.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Version {version.version}</p>
                        <p className="text-xs text-muted-foreground truncate">{version.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(version.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!readOnly && version.version !== latestVersion && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 shrink-0"
                          disabled={restoreMutation.isPending}
                          onClick={() => restoreMutation.mutate(version.id)}
                          data-testid={`restore-version-${version.id}`}
                        >
                          {restoreMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          Restore
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </WorkspaceQueryShell>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
