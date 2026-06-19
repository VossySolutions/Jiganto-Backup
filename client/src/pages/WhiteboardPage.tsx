import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ModuleShell } from "@/components/ModuleShell";
import { cn } from "@/lib/utils";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, RefreshCw, LayoutGrid } from "lucide-react";
import type { WhiteboardListItem } from "@shared/models/whiteboard";
import { thumbnailPlaceholder } from "@/lib/whiteboard-constants";
import { fetchWhiteboards, createWhiteboard, apiErrorMessage } from "@/lib/whiteboard-api";
import {
  WhiteboardCardSkeleton,
  WhiteboardButtonSpinner,
  WhiteboardLoadingState,
} from "@/components/whiteboard/WhiteboardLoadingState";
import "@/styles/whiteboard.css";

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function WhiteboardPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("updated");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("compose") === "1") {
      setCreateOpen(true);
      const pid = params.get("projectId");
      if (pid) setProjectId(pid);
    }
  }, []);

  const queryKey = ["/api/whiteboard", filter, sort, debouncedSearch];
  const { data: boards = [], isLoading, isError, error, refetch, isFetching } = useQuery<WhiteboardListItem[]>({
    queryKey,
    queryFn: () => fetchWhiteboards({ filter, sort, search: debouncedSearch }),
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/pm/projects"],
    queryFn: async () => {
      const { apiRequest } = await import("@/lib/queryClient");
      const res = await apiRequest("GET", "/api/pm/projects");
      return res.json();
    },
  });

  const createMut = useMutation({
    mutationFn: () => createWhiteboard({
      name: name.trim(),
      description: description.trim() || undefined,
      projectId: projectId ? Number(projectId) : undefined,
    }),
    onSuccess: (board) => {
      qc.invalidateQueries({ queryKey: ["/api/whiteboard"] });
      setCreateOpen(false);
      setName("");
      setDescription("");
      setProjectId("");
      navigate(`/modules/whiteboarding/${board.id}`);
    },
    onError: (e: Error) => toast({ title: "Could not create whiteboard", description: apiErrorMessage(e), variant: "destructive" }),
  });

  return (
    <>
    <ModuleShell className="min-h-screen bg-background wb-page">
        <div className="px-4 sm:px-8 pt-3 sm:pt-4">
          <ModuleWelcomeBanner moduleKey="whiteboarding" />
        </div>

        <div className="wb-landing-padding space-y-5 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold font-display flex items-center gap-2">
                <LayoutGrid className="h-6 w-6 text-[#a855f7] hidden sm:block" />
                Whiteboards
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Collaborative sticky-note canvases for brainstorming
              </p>
            </div>
            <Button
              className="w-full sm:w-auto shrink-0"
              onClick={() => setCreateOpen(true)}
              data-testid="wb-new-btn"
            >
              <Plus className="h-4 w-4 mr-2" /> New Whiteboard
            </Button>
          </div>

          <div className="wb-filters">
            <div className="relative flex-1 min-w-0 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9"
                placeholder="Search whiteboards…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="wb-search"
              />
            </div>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="mine">My Whiteboards</SelectItem>
                  <SelectItem value="shared">Shared with me</SelectItem>
                  <SelectItem value="project">Linked to project</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">Last updated</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="created">Date created</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <WhiteboardCardSkeleton />
          ) : isError ? (
            <div className="wb-error-state">
              <p className="font-medium text-destructive mb-1">Could not load whiteboards</p>
              <p className="text-sm text-muted-foreground mb-4">{apiErrorMessage(error)}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              <button
                type="button"
                className="wb-new-card min-h-[180px] sm:min-h-[200px]"
                onClick={() => setCreateOpen(true)}
                data-testid="wb-new-card"
              >
                <Plus className="h-8 w-8 mb-2" />
                <span className="font-medium">New Whiteboard</span>
              </button>

              {boards.length === 0 && (
                <div className="wb-empty-state sm:col-span-2 lg:col-span-3">
                  <LayoutGrid className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No whiteboards yet</p>
                  <p className="text-sm mt-1">Create your first board to start collaborating.</p>
                </div>
              )}

              {boards.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="wb-card text-left overflow-hidden"
                  onClick={() => navigate(`/modules/whiteboarding/${b.id}`)}
                  data-testid={`wb-card-${b.id}`}
                >
                  <div className="aspect-video bg-muted/40 relative overflow-hidden">
                    <img
                      src={b.thumbnailUrl || thumbnailPlaceholder(b.name)}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {b.noteCount > 0 && (
                      <span className="absolute bottom-2 right-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/50 text-white">
                        {b.noteCount} note{b.noteCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="p-3 sm:p-4 space-y-1">
                    <h3 className="font-semibold truncate text-sm sm:text-base">{b.name}</h3>
                    {b.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1.5">
                      <span className="truncate mr-2">{b.ownerName ?? "Owner"}</span>
                      <span className="shrink-0">{b.memberCount} member{b.memberCount !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">Updated {fmtDate(b.updatedAt)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
    </ModuleShell>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Whiteboard</DialogTitle>
            <DialogDescription>Start with a blank canvas. Add sticky notes once inside.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); if (name.trim()) createMut.mutate(); }}
          >
            <div>
              <Label>Name *</Label>
              <Input
                className="mt-1"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sprint retrospective"
                data-testid="wb-create-name"
                autoFocus
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                className="mt-1"
                maxLength={300}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional context for this board"
              />
            </div>
            <div>
              <Label>Link to project (optional)</Label>
              {projectsLoading ? (
                <WhiteboardLoadingState label="Loading projects…" size="sm" inline className="mt-2" />
              ) : (
                <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || createMut.isPending} className="w-full sm:w-auto">
                {createMut.isPending ? <><WhiteboardButtonSpinner /> Creating…</> : "Create & open"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
