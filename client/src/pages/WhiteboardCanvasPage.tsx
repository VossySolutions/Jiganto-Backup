import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ModuleShell } from "@/components/ModuleShell";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Plus, Minus, Maximize2, Map, MoreHorizontal, Share2, History,
  Users, Copy, Trash2, StickyNote, RefreshCw, LayoutTemplate,
} from "lucide-react";
import { SaveAsPlatformTemplateDialog } from "@/components/templates/SaveAsPlatformTemplateDialog";
import type { WhiteboardDetail, WhiteboardActivity, WhiteboardPermission } from "@shared/models/whiteboard";
import { WhiteboardCanvasLazy } from "@/components/whiteboard/WhiteboardCanvasLazy";
import type { WhiteboardCanvasHandle } from "@/components/whiteboard/WhiteboardCanvas";
import { userColorFromId, initials } from "@/lib/whiteboard-constants";
import {
  fetchWhiteboard,
  fetchWhiteboardActivity,
  searchWhiteboardUsers,
  addWhiteboardMember,
  createShareToken,
  updateWhiteboard,
  deleteWhiteboard,
  apiErrorMessage,
} from "@/lib/whiteboard-api";
import {
  WhiteboardCanvasSkeleton,
  WhiteboardActivitySkeleton,
  WhiteboardMemberSearchSkeleton,
  WhiteboardButtonSpinner,
} from "@/components/whiteboard/WhiteboardLoadingState";
import "@/styles/whiteboard.css";

export function WhiteboardCanvasPage() {
  const [, params] = useRoute("/modules/whiteboarding/:id");
  const boardId = Number(params?.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const userId = user?.id ?? "";
  const userName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : (user?.email ?? "User");

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [memberSearchInput, setMemberSearchInput] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [activityFilter, setActivityFilter] = useState({ userId: "", eventType: "" });
  const [savedVisible, setSavedVisible] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const canvasRef = useRef<WhiteboardCanvasHandle | null>(null);
  const [zoomLabel, setZoomLabel] = useState(100);
  const memberSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (memberSearchTimer.current) clearTimeout(memberSearchTimer.current);
    memberSearchTimer.current = setTimeout(() => setMemberSearch(memberSearchInput), 300);
    return () => { if (memberSearchTimer.current) clearTimeout(memberSearchTimer.current); };
  }, [memberSearchInput]);

  const { data: board, isLoading, isError, error, refetch } = useQuery<WhiteboardDetail>({
    queryKey: ["/api/whiteboard", boardId],
    queryFn: () => fetchWhiteboard(boardId),
    enabled: Number.isFinite(boardId) && boardId > 0,
    retry: 1,
  });

  const { data: activity = [], isLoading: activityLoading } = useQuery<WhiteboardActivity[]>({
    queryKey: ["/api/whiteboard", boardId, "activity", activityFilter],
    queryFn: () => fetchWhiteboardActivity(boardId, activityFilter),
    enabled: activityOpen && Number.isFinite(boardId),
  });

  const { data: memberResults = [], isFetching: membersSearching } = useQuery({
    queryKey: ["/api/whiteboard/users/search", memberSearch],
    queryFn: () => searchWhiteboardUsers(memberSearch),
    enabled: shareOpen && memberSearch.length >= 2,
  });

  const canEdit = board ? board.myPermission !== "view" : false;
  const isAdmin = board ? board.myPermission === "owner" || board.myPermission === "admin" : false;

  const updateMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => updateWhiteboard(boardId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/whiteboard", boardId] });
      qc.invalidateQueries({ queryKey: ["/api/whiteboard"] });
      toast({ title: "Saved" });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: apiErrorMessage(e), variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteWhiteboard(boardId),
    onSuccess: () => {
      toast({ title: "Whiteboard deleted" });
      navigate("/modules/whiteboarding");
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: apiErrorMessage(e), variant: "destructive" }),
  });

  const addMemberMut = useMutation({
    mutationFn: ({ userId: uid, permission }: { userId: string; permission: WhiteboardPermission }) =>
      addWhiteboardMember(boardId, uid, permission),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/whiteboard", boardId] });
      setMemberSearchInput("");
      setMemberSearch("");
      toast({ title: "Member added" });
    },
    onError: (e: Error) => toast({ title: "Could not add member", description: apiErrorMessage(e), variant: "destructive" }),
  });

  const shareTokenMut = useMutation({
    mutationFn: (permission: WhiteboardPermission) => createShareToken(boardId, permission),
    onSuccess: (token) => {
      const url = `${window.location.origin}/modules/whiteboarding/${boardId}?token=${token.token}`;
      setShareLink(url);
    },
    onError: (e: Error) => toast({ title: "Could not create link", description: apiErrorMessage(e), variant: "destructive" }),
  });

  const onMemberSearchChange = useCallback((q: string) => {
    setMemberSearchInput(q);
  }, []);

  useEffect(() => {
    if (board) {
      setNameDraft(board.name);
      setDescDraft(board.description ?? "");
    }
  }, [board]);

  if (!Number.isFinite(boardId) || boardId <= 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">Invalid whiteboard link.</p>
          <Button variant="outline" onClick={() => navigate("/modules/whiteboarding")}>Back to whiteboards</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <ModuleShell className="min-h-screen bg-background wb-page" mainClassName="flex flex-col min-h-screen">
          <WhiteboardCanvasSkeleton />
      </ModuleShell>
    );
  }

  if (isError || !board) {
    return (
      <ModuleShell className="min-h-screen bg-background wb-page" mainClassName="flex flex-col min-h-screen items-center justify-center p-6">
          <div className="wb-error-state max-w-md w-full">
            <p className="font-medium text-destructive mb-1">
              {error && apiErrorMessage(error).includes("404") ? "Whiteboard not found" : "Could not load whiteboard"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">{apiErrorMessage(error)}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" /> Try again
              </Button>
              <Button size="sm" onClick={() => navigate("/modules/whiteboarding")}>Back to list</Button>
            </div>
          </div>
      </ModuleShell>
    );
  }

  const noteCount = board.notes.length;
  const needsTypedDelete = noteCount > 10;

  const presenceUsers = [
    { userId: board.ownerId, userName: board.ownerName ?? "Owner" },
    ...board.members.slice(0, 5).map((m) => ({ userId: m.userId, userName: m.userName ?? "User" })),
  ].slice(0, 6);

  return (
    <>
    <ModuleShell className="min-h-screen bg-background flex flex-col wb-page h-[100dvh] overflow-hidden" mainClassName="flex flex-col flex-1 min-h-0">
        <header className="wb-header">
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => navigate("/modules/whiteboarding")} data-testid="wb-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {renaming && isAdmin ? (
            <Input
              className="h-8 flex-1 sm:max-w-xs font-semibold text-sm"
              value={nameDraft}
              autoFocus
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => {
                setRenaming(false);
                if (nameDraft.trim() && nameDraft !== board.name) {
                  updateMut.mutate({ name: nameDraft.trim() });
                }
              }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          ) : (
            <button
              type="button"
              className="wb-header-title text-left hover:underline"
              onClick={() => isAdmin && setRenaming(true)}
              data-testid="wb-title"
            >
              {board.name}
            </button>
          )}

          {!canEdit && <span className="wb-view-only-badge shrink-0">View only</span>}

          <span className={cn("wb-saved-indicator shrink-0", savedVisible && "visible")}>Saved</span>

          <div className="wb-presence -space-x-2">
            {presenceUsers.map((p) => (
              <div
                key={p.userId}
                title={p.userName}
                className="h-7 w-7 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-bold text-white"
                style={{ background: userColorFromId(p.userId) }}
              >
                {initials(p.userName)}
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" className="shrink-0 h-8 px-2 sm:px-3" onClick={() => setShareOpen(true)}>
            <Share2 className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Share</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAdmin && (
                <DropdownMenuItem onClick={() => setDetailsOpen(true)}>Edit details</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setActivityOpen(true)}>
                <History className="h-4 w-4 mr-2" /> Activity history
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowMinimap((v) => !v)}>
                <Map className="h-4 w-4 mr-2" /> {showMinimap ? "Hide" : "Show"} minimap
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => setShowSaveTemplate(true)} data-testid="menu-save-whiteboard-template">
                  <LayoutTemplate className="h-4 w-4 mr-2" /> Save as Template
                </DropdownMenuItem>
              )}
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete whiteboard
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <div className="wb-toolbar-wrap">
          <div className="wb-canvas-toolbar">
            {canEdit && (
              <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3" onClick={() => canvasRef.current?.addNote()} data-testid="wb-add-note">
                <StickyNote className="h-4 w-4 sm:mr-1" />
                <span className="wb-toolbar-label">Add Note</span>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => canvasRef.current?.zoomOut()} aria-label="Zoom out">
              <Minus className="h-4 w-4" />
            </Button>
            <button
              type="button"
              className="text-xs font-medium px-2 min-w-[44px] h-8 hover:bg-muted rounded"
              onClick={() => canvasRef.current?.resetZoom()}
            >
              {zoomLabel}%
            </button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => canvasRef.current?.zoomIn()} aria-label="Zoom in">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hidden xs:flex sm:flex" onClick={() => canvasRef.current?.fitToScreen()} title="Fit to screen" aria-label="Fit to screen">
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant={showMinimap ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 hidden sm:flex"
              onClick={() => setShowMinimap((v) => !v)}
              title="Toggle minimap"
              aria-label="Toggle minimap"
            >
              <Map className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative">
          <WhiteboardCanvasLazy
            ref={canvasRef}
            board={board}
            canEdit={canEdit}
            userId={userId}
            userName={userName}
            showMinimap={showMinimap}
            onSaved={() => {
              setSavedVisible(true);
              if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
              savedTimerRef.current = setTimeout(() => setSavedVisible(false), 1500);
            }}
            onZoomChange={setZoomLabel}
          />
        </div>
    </ModuleShell>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit whiteboard details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Description</Label>
              <Input className="mt-1" maxLength={300} value={descDraft} onChange={(e) => setDescDraft(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>Cancel</Button>
            <Button
              disabled={updateMut.isPending}
              onClick={() => { updateMut.mutate({ description: descDraft || null }); setDetailsOpen(false); }}
            >
              {updateMut.isPending ? <WhiteboardButtonSpinner /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete whiteboard?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{board.name}</strong> and all its sticky notes.
              {needsTypedDelete && <span className="block mt-2">Type the whiteboard name to confirm:</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {needsTypedDelete && (
            <Input value={deleteConfirmName} onChange={(e) => setDeleteConfirmName(e.target.value)} placeholder={board.name} />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              disabled={(needsTypedDelete && deleteConfirmName !== board.name) || deleteMut.isPending}
              onClick={() => deleteMut.mutate()}
            >
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={shareOpen} onOpenChange={setShareOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Share whiteboard</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div>
              <Label>Add people</Label>
              <Input
                className="mt-1"
                placeholder="Search by name or email…"
                value={memberSearchInput}
                onChange={(e) => onMemberSearchChange(e.target.value)}
              />
              {membersSearching && memberSearch.length >= 2 && <WhiteboardMemberSearchSkeleton />}
              {!membersSearching && memberResults.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b gap-2">
                  <span className="text-sm truncate min-w-0">
                    {u.firstName} {u.lastName}
                    <span className="text-muted-foreground block text-xs truncate">{u.email}</span>
                  </span>
                  <Select onValueChange={(perm) => addMemberMut.mutate({ userId: u.id, permission: perm as WhiteboardPermission })}>
                    <SelectTrigger className="w-24 h-8 shrink-0"><SelectValue placeholder="Add" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">View</SelectItem>
                      <SelectItem value="edit">Edit</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {board.members.length > 0 && (
              <div>
                <Label>Members ({board.members.length})</Label>
                <ul className="mt-2 space-y-2">
                  {board.members.map((m) => (
                    <li key={m.id} className="flex justify-between text-sm gap-2">
                      <span className="truncate">{m.userName}</span>
                      <span className="text-muted-foreground capitalize shrink-0">{m.permission}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <Label>Shareable link</Label>
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <Button size="sm" variant="outline" disabled={shareTokenMut.isPending} onClick={() => shareTokenMut.mutate("view")}>
                  {shareTokenMut.isPending ? <WhiteboardButtonSpinner /> : "View link"}
                </Button>
                <Button size="sm" variant="outline" disabled={shareTokenMut.isPending} onClick={() => shareTokenMut.mutate("edit")}>
                  Edit link
                </Button>
              </div>
              {shareLink && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded text-xs">
                  <span className="truncate flex-1">{shareLink}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => {
                    void navigator.clipboard.writeText(shareLink);
                    toast({ title: "Link copied" });
                  }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={activityOpen} onOpenChange={setActivityOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Activity history</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <Select value={activityFilter.eventType || "all"} onValueChange={(v) => setActivityFilter((f) => ({ ...f, eventType: v === "all" ? "" : v }))}>
              <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Event type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                <SelectItem value="note_created">Note created</SelectItem>
                <SelectItem value="note_edited">Note edited</SelectItem>
                <SelectItem value="note_moved">Note moved</SelectItem>
                <SelectItem value="note_deleted">Note deleted</SelectItem>
                <SelectItem value="user_joined">User joined</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {activityLoading ? (
            <WhiteboardActivitySkeleton />
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No activity yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="text-sm border-b border-border pb-3">
                  <div className="font-medium">{a.actorName ?? "Someone"}</div>
                  <div className="text-muted-foreground capitalize text-xs">{a.eventType.replace(/_/g, " ")}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{new Date(a.createdAt!).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </SheetContent>
      </Sheet>

      {board && (
        <SaveAsPlatformTemplateDialog
          open={showSaveTemplate}
          onOpenChange={setShowSaveTemplate}
          endpoint={`/api/whiteboard/${board.id}/save-as-template`}
          defaultName={board.name}
          defaultDescription={board.description ?? ""}
        />
      )}
    </>
  );
}
