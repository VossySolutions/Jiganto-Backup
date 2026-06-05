import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// Note: Dialog is still used for delete confirmation
import { useToast } from "@/hooks/use-toast";
import { useClientContext } from "@/hooks/use-client-context";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import {
  Plus,
  MoreHorizontal,
  Sparkles,
  Search,
  LayoutGrid,
  List,
  Trash2,
  Pencil,
  Clock,
  ArrowRight,
  Check,
  X,
  Loader2,
  Users,
  Star,
  SlidersHorizontal,
} from "lucide-react";
import type { Workspace, WorkspacePage, WorkspaceMember } from "@shared/schema";
import { WorkspaceIconRenderer, getWorkspaceIconDef } from "@/components/workspaces/WorkspaceIconPicker";

const WORKSPACE_COLORS = [
  "#7C3AED", "#1E88C8", "#22C55E", "#F59E0B", "#EC4899",
  "#EF4444", "#6366F1", "#14B8A6", "#F97316", "#8B5CF6",
];

function getWorkspaceColor(id: number, color?: string | null): string {
  if (color) return color;
  return WORKSPACE_COLORS[id % WORKSPACE_COLORS.length];
}

function getRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek}w ago`;
  return d.toLocaleDateString();
}

const MEMBER_AVATAR_COLORS = [
  "#7C3AED", "#1E88C8", "#22C55E", "#EC4899", "#F59E0B",
  "#EF4444", "#6366F1", "#14B8A6",
];

function MemberAvatars({ members, workspaceColor }: { members: WorkspaceMember[]; workspaceColor: string }) {
  const maxShow = 3;
  const shown = members.slice(0, maxShow);

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {shown.map((m, i) => {
          const color = MEMBER_AVATAR_COLORS[i % MEMBER_AVATAR_COLORS.length];
          const initials = (m.userId || "?").slice(0, 2).toUpperCase();
          return (
            <div
              key={m.id}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-background"
              style={{ backgroundColor: color, zIndex: maxShow - i }}
              data-testid={`member-avatar-${m.id}`}
            >
              {initials}
            </div>
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground" data-testid="member-count">
        {members.length} member{members.length !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

function WorkspaceCardGrid({
  ws,
  onSelectWorkspace,
  renamingId,
  setRenamingId,
  renameValue,
  setRenameValue,
  renameMutation,
  setDeleteConfirmId,
  onEditWorkspace,
  onToggleFavorite,
}: {
  ws: Workspace;
  onSelectWorkspace: (id: number) => void;
  renamingId: number | null;
  setRenamingId: (id: number | null) => void;
  renameValue: string;
  setRenameValue: (v: string) => void;
  renameMutation: any;
  setDeleteConfirmId: (id: number | null) => void;
  onEditWorkspace: (ws: Workspace) => void;
  onToggleFavorite: (id: number) => void;
}) {
  const wsColor = getWorkspaceColor(ws.id, ws.color);

  const { data: pages = [] } = useQuery<WorkspacePage[]>({
    queryKey: ["/api/workspaces", ws.id, "pages"],
    queryFn: () => fetch(`/api/workspaces/${ws.id}/pages`).then(r => r.json()),
  });

  const { data: members = [] } = useQuery<WorkspaceMember[]>({
    queryKey: ["/api/workspaces", ws.id, "members"],
    queryFn: () => fetch(`/api/workspaces/${ws.id}/members`).then(r => r.json()),
  });

  const boardPages = pages.filter(p => p.pageType === "database" || p.pageType === "board");
  const docPages = pages.filter(p => p.pageType === "page" || p.pageType === "document");
  const totalBoards = boardPages.length;
  const totalDocs = docPages.length;

  const boardPillNames = boardPages.slice(0, 2).map(p => p.title || "Untitled");
  const extraBoards = totalBoards > 2 ? totalBoards - 2 : 0;

  const progressTotal = totalBoards > 0 ? totalBoards * 10 : pages.length * 5;
  const progressDone = Math.floor(progressTotal * 0.46);
  const progressPct = progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0;

  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-shadow overflow-visible"
      onClick={() => onSelectWorkspace(ws.id)}
      data-testid={`workspace-card-${ws.id}`}
    >
      <div
        className="h-[3px] w-full rounded-t-md"
        style={{ backgroundColor: wsColor }}
      />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-4">
          <WorkspaceIconRenderer
            iconKey={getWorkspaceIconDef(ws.icon) ? ws.icon : null}
            size={48}
            fallbackLetter={ws.name.charAt(0).toUpperCase()}
            fallbackColor={wsColor}
          />
          <div className="flex items-center gap-0.5">
            <button
              className="p-1 rounded hover:bg-muted"
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(ws.id); }}
              data-testid={`favorite-toggle-${ws.id}`}
            >
              <Star className={cn("h-4 w-4", ws.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
            </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1 rounded invisible group-hover:visible hover:bg-muted"
                onClick={(e) => e.stopPropagation()}
                data-testid={`workspace-menu-${ws.id}`}
              >
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelectWorkspace(ws.id); }} data-testid={`open-workspace-${ws.id}`}>
                <ArrowRight className="h-4 w-4 mr-2" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditWorkspace(ws); }} data-testid={`edit-workspace-${ws.id}`}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenamingId(ws.id); setRenameValue(ws.name); }} data-testid={`rename-workspace-${ws.id}`}>
                <Pencil className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(ws.id); }} className="text-destructive" data-testid={`delete-workspace-${ws.id}`}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        {renamingId === ws.id ? (
          <div className="flex items-center gap-1 mb-2" onClick={(e) => e.stopPropagation()}>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameValue.trim()) renameMutation.mutate({ id: ws.id, name: renameValue.trim() });
                if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
              }}
              data-testid={`rename-workspace-input-${ws.id}`}
            />
            <button onClick={() => renameValue.trim() && renameMutation.mutate({ id: ws.id, name: renameValue.trim() })} className="p-1" data-testid={`rename-confirm-${ws.id}`}>
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { setRenamingId(null); setRenameValue(""); }} className="p-1" data-testid={`rename-cancel-${ws.id}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <h3 className="font-bold text-base mb-1 truncate" data-testid={`workspace-title-${ws.id}`}>{ws.name}</h3>
        )}

        {ws.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-1" data-testid={`workspace-description-${ws.id}`}>{ws.description}</p>
        )}
        {!ws.description && <div className="mb-3" />}

        <div className="text-xs text-muted-foreground mb-3" data-testid={`workspace-summary-${ws.id}`}>
          {members.length} Member{members.length !== 1 ? "s" : ""}
          {" · "}{totalBoards} Board{totalBoards !== 1 ? "s" : ""}
          {" · "}{totalDocs} Document{totalDocs !== 1 ? "s" : ""}
          {ws.status ? ` · ${ws.status.charAt(0).toUpperCase() + ws.status.slice(1)}` : " · Active"}
        </div>

        {boardPillNames.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3 flex-wrap" data-testid={`workspace-board-pills-${ws.id}`}>
            {boardPillNames.map((name, i) => (
              <span
                key={i}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs border text-foreground"
                data-testid={`board-pill-${ws.id}-${i}`}
              >
                {name}
              </span>
            ))}
            {extraBoards > 0 && (
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs border text-muted-foreground"
                data-testid={`board-pill-extra-${ws.id}`}
              >
                +{extraBoards}
              </span>
            )}
          </div>
        )}

        {progressTotal > 0 && (
          <div className="mb-4" data-testid={`workspace-progress-${ws.id}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Progress</span>
              <span className="text-xs text-muted-foreground">{progressPct}% · {progressDone}/{progressTotal}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progressPct}%`, backgroundColor: wsColor }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1 border-t">
          <div className="pt-2">
            {members.length > 0 ? (
              <MemberAvatars members={members} workspaceColor={wsColor} />
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                0 members
              </span>
            )}
          </div>
          {ws.updatedAt && (
            <span className="text-xs text-muted-foreground pt-2" data-testid={`workspace-time-${ws.id}`}>
              {getRelativeTime(ws.updatedAt)}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function WorkspaceCardList({
  ws,
  onSelectWorkspace,
  setRenamingId,
  setRenameValue,
  setDeleteConfirmId,
  onEditWorkspace,
  onToggleFavorite,
}: {
  ws: Workspace;
  onSelectWorkspace: (id: number) => void;
  setRenamingId: (id: number | null) => void;
  setRenameValue: (v: string) => void;
  setDeleteConfirmId: (id: number | null) => void;
  onEditWorkspace: (ws: Workspace) => void;
  onToggleFavorite: (id: number) => void;
}) {
  const wsColor = getWorkspaceColor(ws.id, ws.color);

  const { data: pages = [] } = useQuery<WorkspacePage[]>({
    queryKey: ["/api/workspaces", ws.id, "pages"],
    queryFn: () => fetch(`/api/workspaces/${ws.id}/pages`).then(r => r.json()),
  });

  const { data: members = [] } = useQuery<WorkspaceMember[]>({
    queryKey: ["/api/workspaces", ws.id, "members"],
    queryFn: () => fetch(`/api/workspaces/${ws.id}/members`).then(r => r.json()),
  });

  const boardPages = pages.filter(p => p.pageType === "database" || p.pageType === "board");
  const docPages = pages.filter(p => p.pageType === "page" || p.pageType === "document");

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-lg border bg-card hover:shadow-sm transition-shadow cursor-pointer group"
      onClick={() => onSelectWorkspace(ws.id)}
      data-testid={`workspace-list-item-${ws.id}`}
    >
      <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: wsColor }} />
      <WorkspaceIconRenderer
        iconKey={getWorkspaceIconDef(ws.icon) ? ws.icon : null}
        size={36}
        fallbackLetter={ws.name.charAt(0).toUpperCase()}
        fallbackColor={wsColor}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{ws.name}</div>
        {ws.description && <p className="text-xs text-muted-foreground truncate">{ws.description}</p>}
      </div>
      <div className="hidden sm:flex items-center gap-1.5">
        {boardPages.slice(0, 2).map((p, i) => (
          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border text-muted-foreground">
            {p.title || "Untitled"}
          </span>
        ))}
        {boardPages.length > 2 && (
          <span className="text-[11px] text-muted-foreground">+{boardPages.length - 2}</span>
        )}
      </div>
      <div className="hidden md:flex items-center gap-1">
        {members.length > 0 && (
          <div className="flex -space-x-1.5">
            {members.slice(0, 3).map((m, i) => (
              <div
                key={m.id}
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold border-2 border-background"
                style={{ backgroundColor: MEMBER_AVATAR_COLORS[i % MEMBER_AVATAR_COLORS.length], zIndex: 3 - i }}
              >
                {(m.userId || "?").slice(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
        )}
        <span className="text-xs text-muted-foreground ml-1">{members.length}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{boardPages.length}B · {docPages.length}D</span>
        {ws.updatedAt && <span>{getRelativeTime(ws.updatedAt)}</span>}
      </div>
      <button
        className="p-1 rounded hover:bg-muted"
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(ws.id); }}
        data-testid={`favorite-toggle-list-${ws.id}`}
      >
        <Star className={cn("h-4 w-4", ws.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1 rounded invisible group-hover:visible hover:bg-muted"
            onClick={(e) => e.stopPropagation()}
            data-testid={`workspace-list-menu-${ws.id}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditWorkspace(ws); }} data-testid={`edit-workspace-list-${ws.id}`}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenamingId(ws.id); setRenameValue(ws.name); }} data-testid={`rename-workspace-list-${ws.id}`}>
            <Pencil className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(ws.id); }} className="text-destructive" data-testid={`delete-workspace-list-${ws.id}`}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function WorkspaceLanding({
  onSelectWorkspace,
  onCreateWorkspace,
  onEditWorkspace,
  onToggleFavorite,
}: {
  onSelectWorkspace: (id: number) => void;
  onCreateWorkspace: () => void;
  onEditWorkspace: (ws: Workspace) => void;
  onToggleFavorite: (id: number) => void;
}) {
  const { toast } = useToast();
  const { isMasterView } = useClientContext();
  const { platformRole } = usePermissions();
  const workspacesHiddenForRole =
    !isMasterView &&
    (platformRole === "client_project_user" || platformRole === "client_executive");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("updated");
  const [favoritesFirst, setFavoritesFirst] = useState(false);

  const { data: workspaces = [], isLoading } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const { data: favorites = [] } = useQuery<WorkspacePage[]>({
    queryKey: ["/api/workspace-pages/favorites"],
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      apiRequest("PATCH", `/api/workspaces/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      setRenamingId(null);
      setRenameValue("");
      toast({ title: "Workspace renamed" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/workspaces/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      setDeleteConfirmId(null);
      toast({ title: "Workspace deleted" });
    },
  });

  const filteredWorkspaces = (() => {
    let list = [...workspaces];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((w) => w.name.toLowerCase().includes(q) || (w.description && w.description.toLowerCase().includes(q)));
    }
    if (statusFilter !== "all") {
      list = list.filter((w) => (w.status || "active") === statusFilter);
    }
    list.sort((a, b) => {
      if (favoritesFirst) {
        const aFav = a.isFavorite ? 1 : 0;
        const bFav = b.isFavorite ? 1 : 0;
        if (bFav !== aFav) return bFav - aFav;
      }
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "created") return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });
    return list;
  })();

  const favoriteWorkspaces = workspaces.filter((w) => w.isFavorite);

  const recentWorkspaceIds: number[] = (() => {
    try {
      return JSON.parse(localStorage.getItem("jiganto_recent_workspaces") || "[]");
    } catch {
      return [];
    }
  })();

  const recentWorkspaces = recentWorkspaceIds
    .map((id) => workspaces.find((w) => w.id === id))
    .filter(Boolean) as Workspace[];

  return (
    <div className="h-full overflow-y-auto" data-testid="workspace-landing">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: "rgba(245, 158, 11, 0.1)" }}>
              <Sparkles className="h-7 w-7" style={{ color: "#F59E0B" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="landing-title">Workspaces</h1>
              <p className="text-sm text-muted-foreground">
                {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""} 
                {favorites.length > 0 && ` · ${favorites.length} favorite${favorites.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
        </div>

        {recentWorkspaces.length > 0 && !searchQuery && (
          <div className="mb-8">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Continue where you left off</h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {recentWorkspaces.slice(0, 4).map((ws) => (
                <button
                  key={`recent-${ws.id}`}
                  onClick={() => onSelectWorkspace(ws.id)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card hover:shadow-md transition-shadow min-w-[200px] text-left"
                  data-testid={`recent-workspace-${ws.id}`}
                >
                  <WorkspaceIconRenderer
                    iconKey={getWorkspaceIconDef(ws.icon) ? ws.icon : null}
                    size={32}
                    fallbackLetter={ws.name.charAt(0).toUpperCase()}
                    fallbackColor={getWorkspaceColor(ws.id, ws.color)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{ws.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Recent
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workspaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="landing-search-input"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-md">
              <button
                className={cn("p-1.5 rounded-l-md", viewMode === "grid" ? "bg-muted" : "hover:bg-muted/50")}
                onClick={() => setViewMode("grid")}
                data-testid="view-mode-grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                className={cn("p-1.5 rounded-r-md", viewMode === "list" ? "bg-muted" : "hover:bg-muted/50")}
                onClick={() => setViewMode("list")}
                data-testid="view-mode-list"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={onCreateWorkspace} className="gap-1" data-testid="create-workspace-button">
              <Plus className="h-4 w-4" />
              New Workspace
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap" data-testid="landing-filters">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            data-testid="filter-status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="closed">Closed</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            data-testid="filter-sort"
          >
            <option value="updated">Last Updated</option>
            <option value="name">Name (A-Z)</option>
            <option value="created">Recently Created</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none" data-testid="filter-favorites-first">
            <input
              type="checkbox"
              checked={favoritesFirst}
              onChange={(e) => setFavoritesFirst(e.target.checked)}
              className="rounded border-input"
              data-testid="favorites-first-checkbox"
            />
            <Star className="h-3 w-3" />
            Favorites first
          </label>
        </div>

        {favoriteWorkspaces.length > 0 && !searchQuery && (
          <div className="mb-6" data-testid="favorites-section">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              Favorites
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {favoriteWorkspaces.map((ws) => (
                <button
                  key={`fav-ws-${ws.id}`}
                  onClick={() => onSelectWorkspace(ws.id)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card hover:shadow-md transition-shadow min-w-[200px] text-left"
                  data-testid={`favorite-workspace-${ws.id}`}
                >
                  <WorkspaceIconRenderer
                    iconKey={getWorkspaceIconDef(ws.icon) ? ws.icon : null}
                    size={32}
                    fallbackLetter={ws.name.charAt(0).toUpperCase()}
                    fallbackColor={getWorkspaceColor(ws.id, ws.color)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{ws.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      Favorite
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredWorkspaces.length === 0 ? (
          <div className="text-center py-16">
            {searchQuery ? (
              <>
                <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">No workspaces match "{searchQuery}"</p>
              </>
            ) : workspacesHiddenForRole ? (
              <>
                <h2 className="text-lg font-semibold mb-2">Not available in this company view</h2>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  Collaborative Workspaces are for your consulting team at organisation level. Switch to{" "}
                  <strong>Master org · All projects</strong> in the sidebar if your role allows it, or ask your
                  administrator.
                </p>
              </>
            ) : (
              <>
                <div className="inline-flex p-4 rounded-2xl mb-3" style={{ backgroundColor: "rgba(245, 158, 11, 0.1)" }}>
                  <Sparkles className="h-10 w-10" style={{ color: "#F59E0B" }} />
                </div>
                <h2 className="text-lg font-semibold mb-2">Create your first workspace</h2>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  Workspaces are collaborative spaces for meeting notes, checklists, task boards, and more.
                </p>
                <Button onClick={onCreateWorkspace} data-testid="empty-create-workspace">
                  <Plus className="h-4 w-4 mr-1" />
                  New Workspace
                </Button>
              </>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }} data-testid="workspace-grid">
            {filteredWorkspaces.map((ws) => (
              <WorkspaceCardGrid
                key={ws.id}
                ws={ws}
                onSelectWorkspace={onSelectWorkspace}
                renamingId={renamingId}
                setRenamingId={setRenamingId}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                renameMutation={renameMutation}
                setDeleteConfirmId={setDeleteConfirmId}
                onEditWorkspace={onEditWorkspace}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
            <Card
              className="border-dashed cursor-pointer hover:shadow-md transition-shadow flex items-center justify-center min-h-[200px]"
              onClick={onCreateWorkspace}
              data-testid="new-workspace-card"
            >
              <div className="text-center p-6">
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center mx-auto mb-3">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">New Workspace</span>
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-1" data-testid="workspace-list">
            {filteredWorkspaces.map((ws) => (
              <WorkspaceCardList
                key={ws.id}
                ws={ws}
                onSelectWorkspace={onSelectWorkspace}
                setRenamingId={setRenamingId}
                setRenameValue={setRenameValue}
                setDeleteConfirmId={setDeleteConfirmId}
                onEditWorkspace={onEditWorkspace}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Workspace</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this workspace and all its pages? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="cancel-delete-workspace">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId); }}
              data-testid="confirm-delete-workspace"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
