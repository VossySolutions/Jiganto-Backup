import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { Sidebar } from "@/components/Sidebar";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import { WorkspacesIcon } from "@/components/icons/ModuleIcons";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { TipTapEditor } from "@/components/TipTapEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus,
  Star,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Trash2,
  Share2,
  Sparkles,
  Search,
  X,
  GripVertical,
  Check,
  Loader2,
  ImagePlus,
  Upload,
  Pencil,
  Copy,
  Smile,
  Info,
  FolderOpen,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Eye,
  Home,
  Table2,
  History,
  MessageSquare,
  Link2,
  ClipboardList,
  LayoutDashboard,
  BookOpen,
  AlertTriangle,
  Shield,
  FileCheck,
  Flag,
  Target,
  Users,
  Lightbulb,
  BarChart3,
  Briefcase,
  LayoutGrid,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  Workspace,
  WorkspacePage,
  WorkspaceDatabase,
} from "@shared/schema";
import { format } from "date-fns";
import { useLocation } from "wouter";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { DATABASE_TEMPLATES, TEMPLATE_CATEGORIES, type DatabaseTemplate } from "@/lib/workspaceTemplates";
import { WorkspaceLanding } from "@/components/workspaces/WorkspaceLanding";
import { WorkspaceOverview } from "@/components/workspaces/WorkspaceOverview";
import { WorkspaceTableView } from "@/components/workspaces/WorkspaceTableView";
import { WorkspaceSharePanel } from "@/components/workspaces/WorkspaceSharePanel";
import { WorkspaceBottomNav } from "@/components/workspaces/WorkspaceBottomNav";
import { WorkspaceHeader } from "@/components/workspaces/WorkspaceHeader";
import { WorkspacePageSidePanel } from "@/components/workspaces/WorkspacePageSidePanel";
import { WorkspacePublicShareDialog } from "@/components/workspaces/WorkspacePublicShareDialog";
import { WorkspacePresenceAvatars, useWorkspacePageSync } from "@/components/workspaces/WorkspacePresence";
import { DocumentEditorChrome, DocumentMetadataBar } from "@/components/workspaces/DocumentEditorChrome";
import { WorkspaceIconPicker } from "@/components/workspaces/WorkspaceIconPicker";
import {
  fetchOrgMemberCandidates,
  formatOrgMemberLabel,
  formatOrgMemberSubtitle,
  getOrgMemberUserId,
} from "@/components/workspaces/orgMembers";
import { exportDocument } from "@/lib/workspaceExport";
import { WORKSPACE_FULL_TEMPLATES } from "@/lib/workspaceFullTemplates";

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  "clipboard-list": ClipboardList,
  "layout-dashboard": LayoutDashboard,
  "message-square": MessageSquare,
  "book-open": BookOpen,
  "alert-triangle": AlertTriangle,
  "shield": Shield,
  "file-check": FileCheck,
  "flag": Flag,
  "bar-chart-3": BarChart3,
  "users": Users,
  "target": Target,
  "lightbulb": Lightbulb,
  "briefcase": Briefcase,
};

const CATEGORY_COLORS: Record<string, string> = {
  "Project Management": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "Governance": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "Business": "bg-green-500/10 text-green-600 dark:text-green-400",
  "Strategy": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

function getPageIcon(iconName: string | null | undefined, sizeClass?: string) {
  if (!iconName || iconName === "file") {
    return <FileText className={cn("h-4 w-4 text-muted-foreground", sizeClass)} />;
  }
  return <span className={cn("text-sm leading-none", sizeClass)}>{iconName}</span>;
}

const WORKSPACE_COLORS = [
  "#7C3AED", "#1E88C8", "#22C55E", "#F59E0B", "#EC4899",
  "#EF4444", "#6366F1", "#14B8A6", "#F97316", "#8B5CF6",
];

function getWorkspaceColor(id: number, color?: string | null): string {
  if (color) return color;
  return WORKSPACE_COLORS[id % WORKSPACE_COLORS.length];
}

function SidebarRowCount({ pageId }: { pageId: number }) {
  const { data: databases = [] } = useQuery<any[]>({
    queryKey: ["/api/workspace-pages", pageId, "databases"],
    enabled: !!pageId,
  });
  const dbId = databases.length > 0 ? databases[0].id : null;
  const { data: rows = [] } = useQuery<any[]>({
    queryKey: ["/api/workspace-databases", dbId, "rows"],
    enabled: !!dbId,
  });
  if (!dbId) return null;
  return (
    <span className="text-[10px] text-muted-foreground tabular-nums ml-auto flex-shrink-0" data-testid={`row-count-${pageId}`}>
      ({rows.length})
    </span>
  );
}

function WorkspaceSidebar({
  workspaceId,
  selectedPageId,
  onSelectPage,
  onCreatePage,
  onDeselectPage,
  onCreateFromTemplate,
}: {
  workspaceId: number;
  selectedPageId: number | null;
  onSelectPage: (id: number) => void;
  onCreatePage: (parentId?: number, pageType?: string) => void;
  onDeselectPage: () => void;
  onCreateFromTemplate?: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: pages = [], isLoading } = useQuery<WorkspacePage[]>({
    queryKey: ["/api/workspaces", workspaceId, "pages"],
    enabled: !!workspaceId,
  });

  const deletePageMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/workspace-pages/${id}`),
    onSuccess: (_res, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "pages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-pages/favorites"] });
      if (selectedPageId === deletedId) onDeselectPage();
    },
  });

  const renamePageMutation = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) =>
      apiRequest("PATCH", `/api/workspace-pages/${id}`, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "pages"] });
    },
  });

  const duplicatePageMutation = useMutation({
    mutationFn: async (page: WorkspacePage) => {
      const res = await apiRequest("POST", `/api/workspaces/${workspaceId}/pages`, {
        title: `${page.title || "Untitled"} (Copy)`,
        icon: page.icon,
        pageType: page.pageType,
        content: page.content,
        sortOrder: (page.sortOrder || 0) + 1,
        skipDefaultTemplate: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "pages"] });
    },
  });

  const togglePageFavoriteMutation = useMutation({
    mutationFn: (page: WorkspacePage) =>
      apiRequest("PATCH", `/api/workspace-pages/${page.id}`, { isFavorite: !page.isFavorite }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "pages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-pages/favorites"] });
    },
  });

  const reorderPagesMutation = useMutation({
    mutationFn: (updates: { id: number; sortOrder: number }[]) =>
      apiRequest("POST", "/api/workspace-pages/reorder", { updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "pages"] });
    },
  });

  const [draggedPageId, setDraggedPageId] = useState<number | null>(null);

  const reorderList = (list: WorkspacePage[], draggedId: number, targetId: number) => {
    const fromIdx = list.findIndex((p) => p.id === draggedId);
    const toIdx = list.findIndex((p) => p.id === targetId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    const next = [...list];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    reorderPagesMutation.mutate(next.map((p, i) => ({ id: p.id, sortOrder: i })));
  };

  const renderDraggablePage = (page: WorkspacePage, icon: React.ReactNode, list: WorkspacePage[]) => (
    <div key={page.id} data-testid={`sidebar-board-${page.id}`}>
      <div
        className={cn(
          "group flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer text-sm",
          selectedPageId === page.id ? "bg-accent/50 text-foreground" : "text-muted-foreground hover-elevate",
          draggedPageId === page.id && "opacity-50"
        )}
        draggable
        onDragStart={() => setDraggedPageId(page.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (draggedPageId) reorderList(list, draggedPageId, page.id);
          setDraggedPageId(null);
        }}
        onDragEnd={() => setDraggedPageId(null)}
        onClick={() => onSelectPage(page.id)}
        data-testid={`page-item-${page.id}`}
      >
        <GripVertical className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-40 cursor-grab" />
        {icon}
        <span className="flex-1 truncate">{page.title || "Untitled"}</span>
        <SidebarRowCount pageId={page.id} />
        <button
          className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover-elevate"
          onClick={(e) => { e.stopPropagation(); togglePageFavoriteMutation.mutate(page); }}
          data-testid={`sidebar-fav-${page.id}`}
        >
          <Star className={cn("h-3 w-3", page.isFavorite && "fill-amber-400 text-amber-400")} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover-elevate" onClick={(e) => e.stopPropagation()} data-testid={`page-menu-${page.id}`}>
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); const t = prompt("Rename", page.title || ""); if (t?.trim()) renamePageMutation.mutate({ id: page.id, title: t.trim() }); }} data-testid={`rename-page-${page.id}`}>
              <Pencil className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicatePageMutation.mutate(page); }} data-testid={`duplicate-page-${page.id}`}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => deletePageMutation.mutate(page.id)} className="text-destructive" data-testid={`delete-page-${page.id}`}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const boards = pages
    .filter((p) => !p.parentId && p.pageType === "database")
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const documents = pages
    .filter((p) => !p.parentId && p.pageType === "page")
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const filteredBoards = searchQuery
    ? boards.filter((p) => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : boards;
  const filteredDocuments = searchQuery
    ? documents.filter((p) => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : documents;

  return (
    <div className="flex flex-col flex-1 overflow-hidden" data-testid="workspace-sidebar">
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={onDeselectPage}
          className={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm font-medium",
            selectedPageId === null ? "bg-accent/50 text-foreground" : "text-muted-foreground hover-elevate"
          )}
          data-testid="sidebar-overview-link"
        >
          <LayoutGrid className="h-4 w-4" />
          Overview
        </button>
      </div>

      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-8 text-xs"
            data-testid="search-pages-input"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-4">
        <div>
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/60 mb-1">
            <div className="flex items-center gap-1.5">
              <Table2 className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
              <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">Boards</span>
            </div>
            <button
              onClick={() => onCreatePage(undefined, "database")}
              className="p-0.5 rounded hover-elevate"
              title="Add Board"
              data-testid="sidebar-add-board"
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filteredBoards.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">No boards yet</p>
          ) : (
            filteredBoards.map((page) =>
              renderDraggablePage(
                page,
                <Table2 className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />,
                filteredBoards,
              ),
            )
          )}
          <button
            onClick={() => onCreatePage(undefined, "database")}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            data-testid="sidebar-add-board-inline"
          >
            <Plus className="h-3 w-3" />
            Add Board
          </button>
          {onCreateFromTemplate && (
            <button
              onClick={onCreateFromTemplate}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
              data-testid="sidebar-add-board-from-template"
            >
              <ClipboardList className="h-3 w-3" />
              From Template
            </button>
          )}
        </div>

        <div className="pt-1 border-t border-border/40">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/60 mb-1">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
              <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">Documents</span>
            </div>
            <button
              onClick={() => onCreatePage(undefined, "page")}
              className="p-0.5 rounded hover-elevate"
              title="Add Document"
              data-testid="sidebar-add-document"
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">No documents yet</p>
          ) : (
            filteredDocuments.map((page) =>
              renderDraggablePage(page, getPageIcon(page.icon, "h-3.5 w-3.5"), filteredDocuments),
            )
          )}
          <button
            onClick={() => onCreatePage(undefined, "page")}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            data-testid="sidebar-add-document-inline"
          >
            <Plus className="h-3 w-3" />
            Add Document
          </button>
        </div>
      </div>
    </div>
  );
}

function EmojiPicker({
  currentEmoji,
  onSelect,
  onRemove,
  triggerSize = "md",
}: {
  currentEmoji: string | null | undefined;
  onSelect: (emoji: string) => void;
  onRemove?: () => void;
  triggerSize?: "sm" | "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const sizeClasses = { sm: "text-base", md: "text-xl", lg: "text-4xl" };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="rounded hover-elevate flex items-center justify-center p-1" data-testid="emoji-picker-trigger">
          {currentEmoji && currentEmoji !== "file" ? (
            <span className={sizeClasses[triggerSize]}>{currentEmoji}</span>
          ) : (
            <Smile className={cn("text-muted-foreground", triggerSize === "lg" ? "h-8 w-8" : triggerSize === "md" ? "h-5 w-5" : "h-4 w-4")} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" data-testid="emoji-picker-popover">
        <Picker
          data={data}
          onEmojiSelect={(emoji: any) => { onSelect(emoji.native); setOpen(false); }}
          theme="light"
          previewPosition="none"
          skinTonePosition="none"
        />
        {onRemove && currentEmoji && currentEmoji !== "file" && (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" onClick={() => { onRemove(); setOpen(false); }} className="w-full text-xs text-muted-foreground" data-testid="remove-emoji-button">
              <X className="h-3 w-3 mr-1" />
              Remove icon
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const COVER_IMAGES = [
  { label: "Gradient Blue", url: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { label: "Gradient Sunset", url: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { label: "Gradient Ocean", url: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
  { label: "Gradient Forest", url: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
  { label: "Gradient Warm", url: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" },
  { label: "Gradient Night", url: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)" },
  { label: "Gradient Slate", url: "linear-gradient(135deg, #89ABE3 0%, #EA738D 100%)" },
  { label: "Gradient Mint", url: "linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)" },
  { label: "Gradient Dark", url: "linear-gradient(135deg, #0c3547 0%, #134e5e 100%)" },
  { label: "Gradient Sand", url: "linear-gradient(135deg, #e6b980 0%, #eacda3 100%)" },
];

function CoverImagePicker({
  currentCover,
  onSelect,
  onRemove,
  className,
}: {
  currentCover: string | null | undefined;
  onSelect: (url: string) => void;
  onRemove: () => void;
  className?: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [urlError, setUrlError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlSubmit = () => {
    const url = customUrl.trim();
    if (!url) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setUrlError("Please enter a full URL starting with https://");
      return;
    }
    setUrlError("");
    onSelect(url);
    setCustomUrl("");
    setOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file (JPG, PNG, or WebP).", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Cover images must be under 5 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetchWithAuth("/api/workspace-pages/upload-cover", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      onSelect(url);
      setOpen(false);
    } catch {
      toast({ title: "Upload failed", description: "Could not upload the image. Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("gap-1 text-xs", className)} data-testid="cover-image-picker">
          <ImagePlus className="h-3.5 w-3.5" />
          {currentCover ? "Change cover" : "Add cover"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-4" align="start" side="bottom" data-testid="cover-picker-popover">
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>Best size: 1500 x 300 px (5:1 ratio). Wide landscape images work best.</span>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Upload Image</div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileUpload} data-testid="cover-file-input" />
            <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploading} data-testid="cover-upload-button">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? "Uploading..." : "Choose image file"}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP or GIF. Max 5 MB.</p>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Image URL</div>
            <div className="flex gap-1">
              <Input value={customUrl} onChange={(e) => { setCustomUrl(e.target.value); setUrlError(""); }} placeholder="https://example.com/image.jpg" className="h-8 text-xs flex-1" onKeyDown={(e) => { if (e.key === "Enter") handleUrlSubmit(); }} data-testid="cover-url-input" />
              <Button variant="outline" size="sm" onClick={handleUrlSubmit} data-testid="cover-url-submit">Add</Button>
            </div>
            {urlError && <p className="text-xs text-destructive mt-1">{urlError}</p>}
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Gradients</div>
            <div className="grid grid-cols-5 gap-1.5">
              {COVER_IMAGES.map((cover) => (
                <button key={cover.label} onClick={() => { onSelect(cover.url); setOpen(false); }} className="h-8 rounded-md hover-elevate border" style={{ background: cover.url }} title={cover.label} data-testid={`cover-option-${cover.label.toLowerCase().replace(/\s/g, "-")}`} />
              ))}
            </div>
          </div>
          {currentCover && (
            <Button variant="ghost" size="sm" onClick={() => { onRemove(); setOpen(false); }} className="w-full text-xs text-muted-foreground" data-testid="remove-cover-button">
              <X className="h-3 w-3 mr-1" />
              Remove cover
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EditableDatabaseName({ name, onRename, dbId }: { name: string; onRename: (name: string) => void; dbId: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  useEffect(() => { setValue(name); }, [name]);

  if (editing) {
    return (
      <div className="flex items-center gap-2 mb-2">
        <Table2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => { if (value.trim() && value.trim() !== name) onRename(value.trim()); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) { onRename(value.trim()); setEditing(false); } if (e.key === "Escape") { setValue(name); setEditing(false); } }}
          className="text-sm font-medium bg-transparent outline-none border-b border-primary/30 py-0.5 flex-1"
          autoFocus
          data-testid={`board-name-input-${dbId}`}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mb-2 group">
      <Table2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="text-sm font-medium cursor-pointer hover:border-b hover:border-muted-foreground/30 py-0.5" onClick={() => setEditing(true)} data-testid={`board-name-${dbId}`}>{name}</span>
      <button className="p-0.5 rounded invisible group-hover:visible hover-elevate" onClick={() => setEditing(true)} data-testid={`rename-board-${dbId}`}>
        <Pencil className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}

function DatabaseBlockWrapper({ isExpanded, children }: { isExpanded: boolean; children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [expandStyle, setExpandStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!isExpanded || !wrapperRef.current) { setExpandStyle({}); return; }
    const scrollContainer = document.getElementById("page-content-scroll");
    if (!scrollContainer) return;
    const updateWidth = () => {
      if (!wrapperRef.current) return;
      const containerRect = scrollContainer.getBoundingClientRect();
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const computedStyle = getComputedStyle(scrollContainer);
      const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
      const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
      const offsetLeft = wrapperRect.left - containerRect.left;
      const availableWidth = containerRect.width - paddingLeft - paddingRight;
      setExpandStyle({
        marginLeft: -(offsetLeft - paddingLeft),
        width: availableWidth,
        transition: "margin-left 0.2s ease, width 0.2s ease",
      });
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(scrollContainer);
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    window.addEventListener("resize", updateWidth);
    return () => { observer.disconnect(); window.removeEventListener("resize", updateWidth); };
  }, [isExpanded]);

  return (
    <div ref={wrapperRef} style={isExpanded ? expandStyle : undefined}>
      {children}
    </div>
  );
}

function PageView({
  pageId,
  workspaceId,
  onDeletePage,
  onSelectPage,
  isFullScreen,
  onToggleFullScreen,
  readOnly = false,
}: {
  pageId: number;
  workspaceId: number;
  onDeletePage?: () => void;
  onSelectPage?: (id: number) => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  readOnly?: boolean;
}) {
  const { toast } = useToast();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showPageSidePanel, setShowPageSidePanel] = useState(false);
  const [showPublicShare, setShowPublicShare] = useState(false);
  const [remoteUpdateBanner, setRemoteUpdateBanner] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedDatabases, setExpandedDatabases] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const toggleDatabaseExpand = useCallback((dbId: number) => {
    setExpandedDatabases((prev) => {
      const next = new Set(prev);
      if (next.has(dbId)) next.delete(dbId);
      else next.add(dbId);
      return next;
    });
  }, []);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingContentRef = useRef<string | null>(null);

  const { data: page, isLoading } = useQuery<WorkspacePage>({
    queryKey: ["/api/workspace-pages", pageId],
    enabled: !!pageId,
  });

  const { data: databases = [] } = useQuery<WorkspaceDatabase[]>({
    queryKey: ["/api/workspace-pages", pageId, "databases"],
    enabled: !!pageId,
  });

  const { data: allPages = [] } = useQuery<WorkspacePage[]>({
    queryKey: ["/api/workspaces", workspaceId, "pages"],
    enabled: !!workspaceId,
  });

  const { data: workspacesData = [] } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const childPages = allPages
    .filter((p) => p.parentId === pageId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const currentWorkspace = workspacesData.find((w) => w.id === workspaceId);

  const saveContentDirectly = useCallback(async (content: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const res = await fetchWithAuth(`/api/workspace-pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Save failed");
      setIsSaving(false);
      pendingContentRef.current = null;
      apiRequest("POST", `/api/workspace-pages/${pageId}/versions`).catch(() => {});
    } catch (err: any) {
      if (err.name === "AbortError") return;
      pendingContentRef.current = content;
      setTimeout(() => {
        if (pendingContentRef.current !== null) {
          saveContentDirectly(pendingContentRef.current);
        }
      }, 3000);
    }
  }, [pageId]);

  const updatePageMutation = useMutation({
    mutationFn: (data: Partial<WorkspacePage>) =>
      apiRequest("PATCH", `/api/workspace-pages/${pageId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-pages", pageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "pages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-pages/favorites"] });
      setIsSaving(false);
    },
  });

  const createDatabaseMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/workspace-pages/${pageId}/databases`, { name: "Untitled Board" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-pages", pageId, "databases"] });
      toast({ title: "Board added", description: "Scroll down to see your new board." });
      setTimeout(() => {
        const container = document.getElementById("page-content-scroll");
        if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }, 300);
    },
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: (template: DatabaseTemplate) =>
      apiRequest("POST", `/api/workspace-pages/${pageId}/databases/from-template`, {
        name: template.name,
        columns: template.columns,
        rows: template.sampleRows,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-pages", pageId, "databases"] });
      setShowTemplateDialog(false);
      toast({ title: "Board created from template" });
      setTimeout(() => {
        const container = document.getElementById("page-content-scroll");
        if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }, 300);
    },
  });

  const createChildPageMutation = useMutation({
    mutationFn: (data: { parentId: number; pageType?: string }) =>
      apiRequest("POST", `/api/workspaces/${workspaceId}/pages`, {
        title: "Untitled",
        icon: "file",
        parentId: data.parentId,
        pageType: data.pageType || "page",
        sortOrder: Math.max(0, ...childPages.map((p) => p.sortOrder || 0)) + 1,
      }),
    onSuccess: async (res: Response) => {
      const newPage = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "pages"] });
      if (onSelectPage) onSelectPage(newPage.id);
    },
  });

  const autoSave = useCallback(
    (content: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setIsSaving(true);
      pendingContentRef.current = content;
      saveTimerRef.current = setTimeout(() => {
        saveContentDirectly(content);
      }, 1500);
    },
    [pageId, saveContentDirectly]
  );

  useWorkspacePageSync(pageId, !!page && ((page as any).pageType || "page") === "page" && !readOnly, () => {
    setRemoteUpdateBanner(true);
    queryClient.invalidateQueries({ queryKey: ["/api/workspace-pages", pageId] });
  });

  useEffect(() => {
    if (page) {
      setTitleValue(page.title || "");
    }
  }, [page]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (pendingContentRef.current !== null && pageId) {
        fetchWithAuth(`/api/workspace-pages/${pageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: pendingContentRef.current }),
          keepalive: true,
        }).catch(() => {});
        pendingContentRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [pageId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Page not found
      </div>
    );
  }

  const isGradient = page.coverImage?.startsWith("linear-gradient");
  const pageType = (page as any).pageType || "page";
  const pageHeader = page.coverImage ? (
    <div className="relative w-full h-48 flex-shrink-0" style={isGradient ? { background: page.coverImage } : { backgroundImage: `url(${page.coverImage})`, backgroundSize: "cover", backgroundPosition: "center" }} data-testid="page-cover-image">
      <div className="absolute bottom-3 right-3 flex items-center gap-1 z-10">
        <CoverImagePicker currentCover={page.coverImage} onSelect={(url) => updatePageMutation.mutate({ coverImage: url })} onRemove={() => updatePageMutation.mutate({ coverImage: null })} className="bg-background/70 backdrop-blur-sm text-foreground" />
      </div>
    </div>
  ) : null;

  const pageTitle = (
    <div className={cn("relative", page.coverImage && pageType !== "page" ? "-mt-8" : "mt-2")}>
      {page.coverImage && (
        <div className="mb-2">
          <EmojiPicker currentEmoji={page.icon} onSelect={(emoji) => updatePageMutation.mutate({ icon: emoji })} onRemove={() => updatePageMutation.mutate({ icon: "file" })} triggerSize="lg" />
        </div>
      )}
      {!page.coverImage && (
        <div className="group flex items-center gap-2 mb-2">
          <EmojiPicker currentEmoji={page.icon} onSelect={(emoji) => updatePageMutation.mutate({ icon: emoji })} onRemove={() => updatePageMutation.mutate({ icon: "file" })} triggerSize="lg" />
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <CoverImagePicker currentCover={page.coverImage} onSelect={(url) => updatePageMutation.mutate({ coverImage: url })} onRemove={() => updatePageMutation.mutate({ coverImage: null })} />
          </div>
        </div>
      )}

      {isEditingTitle ? (
        <Input
          ref={titleInputRef}
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={() => { setIsEditingTitle(false); if (titleValue !== page.title) updatePageMutation.mutate({ title: titleValue }); }}
          onKeyDown={(e) => { if (e.key === "Enter") { setIsEditingTitle(false); if (titleValue !== page.title) updatePageMutation.mutate({ title: titleValue }); } }}
          className="text-4xl font-bold border-0 p-0 h-auto focus-visible:ring-0 bg-transparent mb-2"
          autoFocus
          data-testid="page-title-input"
        />
      ) : (
        <h1 className="text-4xl font-bold cursor-text mb-2" onClick={() => { setIsEditingTitle(true); setTitleValue(page.title || ""); }} data-testid="page-title">
          {page.title || "Untitled"}
        </h1>
      )}

      {pageType === "page" && (
        <>
          <DocumentMetadataBar
            createdByName={(page as any).createdByName}
            updatedByName={(page as any).updatedByName}
            createdAt={page.createdAt}
            updatedAt={page.updatedAt}
            documentStatus={(page as any).documentStatus}
            onStatusChange={(status) => !readOnly && updatePageMutation.mutate({ documentStatus: status } as any)}
          />
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setShowPageSidePanel(true)} data-testid="page-comments-versions-btn">
              <MessageSquare className="h-3.5 w-3.5" />
              Comments & versions
            </Button>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setShowPublicShare(true)} data-testid="page-public-link-btn">
              <Link2 className="h-3.5 w-3.5" />
              Public link
            </Button>
          </div>
          {remoteUpdateBanner && (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              This page was updated by another collaborator.{" "}
              <button className="underline font-medium" onClick={() => setRemoteUpdateBanner(false)}>Dismiss</button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const childPagesGrid = childPages.length > 0 && (
    <div className="mb-8" data-testid="child-pages-grid">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Sub-pages</div>
      <div className="grid grid-cols-2 gap-2">
        {childPages.map((child) => (
          <Card key={child.id} className="p-3 cursor-pointer hover-elevate" onClick={() => onSelectPage?.(child.id)} data-testid={`child-page-card-${child.id}`}>
            <div className="flex items-center gap-2">
              {getPageIcon(child.icon)}
              <span className="text-sm font-medium truncate">{child.title || "Untitled"}</span>
            </div>
            {child.description && <p className="text-xs text-muted-foreground mt-1 truncate">{child.description}</p>}
          </Card>
        ))}
      </div>
    </div>
  );


  const renderDatabaseBlocks = (dbList: WorkspaceDatabase[]) =>
    dbList.map((db) => {
      const dbExpanded = expandedDatabases.has(db.id);
      return (
        <div key={db.id} className="mb-6" data-testid={`database-block-${db.id}`}>
          <DatabaseBlockWrapper isExpanded={dbExpanded}>
            <WorkspaceTableView databaseId={db.id} workspaceId={workspaceId} isExpanded={dbExpanded} onToggleExpand={() => toggleDatabaseExpand(db.id)} readOnly={readOnly} />
          </DatabaseBlockWrapper>
        </div>
      );
    });

  const siblingNav = (() => {
    const siblings = allPages.filter((p) => p.parentId === page.parentId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const currentIndex = siblings.findIndex((p) => p.id === pageId);
    const prevPage = currentIndex > 0 ? siblings[currentIndex - 1] : null;
    const nextPage = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;
    const parentPage = page.parentId ? allPages.find((p) => p.id === page.parentId) : null;
    const firstChild = childPages.length > 0 ? childPages[0] : null;
    const hasLeftNav = prevPage || parentPage;
    const hasRightNav = nextPage || firstChild;
    if (!hasLeftNav && !hasRightNav) return null;

    return (
      <div className="border-t mt-8 pt-6 pb-4" data-testid="page-sibling-nav">
        <div className="flex items-stretch justify-between gap-4">
          {prevPage ? (
            <button onClick={() => onSelectPage?.(prevPage.id)} className="flex-1 flex items-center gap-3 p-3 rounded-lg border hover-elevate text-left group max-w-[50%]" data-testid={`nav-prev-page-${prevPage.id}`}>
              <ChevronLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Previous</p>
                <div className="flex items-center gap-1.5">
                  {getPageIcon(prevPage.icon)}
                  <span className="text-sm font-medium truncate">{prevPage.title || "Untitled"}</span>
                </div>
              </div>
            </button>
          ) : parentPage ? (
            <button onClick={() => onSelectPage?.(parentPage.id)} className="flex-1 flex items-center gap-3 p-3 rounded-lg border hover-elevate text-left group max-w-[50%]" data-testid={`nav-parent-page-${parentPage.id}`}>
              <ChevronLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Up to parent</p>
                <div className="flex items-center gap-1.5">
                  {getPageIcon(parentPage.icon)}
                  <span className="text-sm font-medium truncate">{parentPage.title || "Untitled"}</span>
                </div>
              </div>
            </button>
          ) : (
            <div className="flex-1" />
          )}
          {nextPage ? (
            <button onClick={() => onSelectPage?.(nextPage.id)} className="flex-1 flex items-center justify-end gap-3 p-3 rounded-lg border hover-elevate text-right group max-w-[50%]" data-testid={`nav-next-page-${nextPage.id}`}>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Next</p>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-sm font-medium truncate">{nextPage.title || "Untitled"}</span>
                  {getPageIcon(nextPage.icon)}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>
          ) : firstChild ? (
            <button onClick={() => onSelectPage?.(firstChild.id)} className="flex-1 flex items-center justify-end gap-3 p-3 rounded-lg border hover-elevate text-right group max-w-[50%]" data-testid={`nav-child-page-${firstChild.id}`}>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Go into</p>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-sm font-medium truncate">{firstChild.title || "Untitled"}</span>
                  {getPageIcon(firstChild.icon)}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      </div>
    );
  })();

  if (pageType === "page") {
    return (
      <div className="flex flex-col h-full overflow-hidden" data-testid="page-view">
        {pageHeader}
        <DocumentEditorChrome
          content={page.content || ""}
          isSaving={isSaving}
          isExpanded={isFullScreen}
          onToggleExpand={onToggleFullScreen}
        >
          <div id="page-content-scroll" className="w-full">
            {pageTitle}
            {childPagesGrid}
            <div className="mb-8" data-testid="page-editor">
              <TipTapEditor
                content={page.content || ""}
                onChange={readOnly ? undefined : autoSave}
                onExport={(format) => exportDocument(format, page.title || "Untitled", page.content || "")}
                placeholder="Start writing... Use the menu above to add a board."
                editable={!readOnly}
              />
            </div>
            {renderDatabaseBlocks(databases)}
            {siblingNav}
          </div>
        </DocumentEditorChrome>
        <WorkspacePageSidePanel
          pageId={pageId}
          open={showPageSidePanel}
          onOpenChange={setShowPageSidePanel}
          readOnly={readOnly}
          onRestored={() => queryClient.invalidateQueries({ queryKey: ["/api/workspace-pages", pageId] })}
        />
        <WorkspacePublicShareDialog
          open={showPublicShare}
          onOpenChange={setShowPublicShare}
          targetType="page"
          targetId={pageId}
          label={page.title || "Untitled"}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" data-testid="page-view" id="page-content-scroll">
      {pageHeader}
      <div className="w-full px-6 flex-1">
        {pageTitle}
        {childPagesGrid}

        {pageType === "database" && (
          <div className="mb-8">
            {databases.length === 0 ? (
              <div className="text-center py-8">
                <Table2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">No board yet</p>
                <Button variant="outline" size="sm" onClick={() => createDatabaseMutation.mutate()} data-testid="create-board-for-db-page">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create Board
                </Button>
              </div>
            ) : (
              renderDatabaseBlocks(databases)
            )}
          </div>
        )}

        {pageType === "section" && childPages.length === 0 && (
          <div className="text-center py-12">
            <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">This section has no pages yet</p>
            <Button variant="outline" size="sm" onClick={() => createChildPageMutation.mutate({ parentId: pageId })} data-testid="create-page-in-section">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Page
            </Button>
          </div>
        )}

        {siblingNav}
      </div>

      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Board from Template</DialogTitle>
            <DialogDescription>Choose a template to get started quickly with pre-configured columns and sample data.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 px-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search templates..." value={templateSearchQuery} onChange={(e) => setTemplateSearchQuery(e.target.value)} className="pl-9 h-9" data-testid="template-search-input" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <Button variant={selectedCategory === null ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(null)} data-testid="template-category-all">All</Button>
            {TEMPLATE_CATEGORIES.map((cat) => (
              <Button key={cat} variant={selectedCategory === cat ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)} data-testid={`template-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}>{cat}</Button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto px-1 pb-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DATABASE_TEMPLATES.filter((t) => {
                const matchesCategory = !selectedCategory || t.category === selectedCategory;
                const matchesSearch = !templateSearchQuery || t.name.toLowerCase().includes(templateSearchQuery.toLowerCase()) || t.description.toLowerCase().includes(templateSearchQuery.toLowerCase());
                return matchesCategory && matchesSearch;
              }).map((template) => {
                const IconComponent = TEMPLATE_ICONS[template.icon] || Table2;
                return (
                  <Card key={template.id} className="p-4 cursor-pointer hover-elevate" onClick={() => createFromTemplateMutation.mutate(template)} data-testid={`template-card-${template.id}`}>
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded-md flex-shrink-0", CATEGORY_COLORS[template.category] || "bg-muted")}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm truncate">{template.name}</h4>
                          <Badge variant="secondary" className="text-[10px] flex-shrink-0">{template.category}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{template.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {template.columns.slice(0, 5).map((col) => (
                            <span key={col.name} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{col.name}</span>
                          ))}
                          {template.columns.length > 5 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">+{template.columns.length - 5} more</span>}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            {DATABASE_TEMPLATES.filter((t) => {
              const matchesCategory = !selectedCategory || t.category === selectedCategory;
              const matchesSearch = !templateSearchQuery || t.name.toLowerCase().includes(templateSearchQuery.toLowerCase()) || t.description.toLowerCase().includes(templateSearchQuery.toLowerCase());
              return matchesCategory && matchesSearch;
            }).length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Table2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No templates match your search</p>
              </div>
            )}
          </div>
          {createFromTemplateMutation.isPending && (
            <div className="flex items-center justify-center py-3 border-t gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Creating board...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const PAGE_TYPES = [
  { type: "page", label: "Page", icon: FileText, description: "Rich text editor with optional boards" },
  { type: "database", label: "Board", icon: Table2, description: "Board table only, no editor" },
  { type: "section", label: "Section", icon: FolderOpen, description: "Container for child pages" },
];

function NewPageDialog({
  open,
  onOpenChange,
  onCreatePage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePage: (pageType: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create New Page</DialogTitle>
          <DialogDescription>Select a page type to create.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {PAGE_TYPES.map((pt) => (
            <button
              key={pt.type}
              onClick={() => { onCreatePage(pt.type); onOpenChange(false); }}
              className="w-full flex items-start gap-3 p-3 rounded-md text-left hover-elevate"
              data-testid={`new-page-type-${pt.type}`}
            >
              <pt.icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">{pt.label}</div>
                <div className="text-xs text-muted-foreground">{pt.description}</div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type NavigationState = "landing" | "overview" | "page";

export default function WorkspacesPage() {
  const { mainOffset, mobileTopOffset } = useShellLayout();
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [navState, setNavState] = useState<NavigationState>("landing");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [newPageDialogOpen, setNewPageDialogOpen] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<number | undefined>(undefined);
  const [showBoardTemplateDialog, setShowBoardTemplateDialog] = useState(false);
  const [boardTemplateSearch, setBoardTemplateSearch] = useState("");
  const [boardTemplateCategory, setBoardTemplateCategory] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("jiganto_workspace_sidebar_width");
    return saved ? Number(saved) : 256;
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("");
  const [newWorkspaceIcon, setNewWorkspaceIcon] = useState<string | null>(null);
  const [newWorkspaceColor, setNewWorkspaceColor] = useState<string>(WORKSPACE_COLORS[0]);
  const [newWorkspaceColorCustom, setNewWorkspaceColorCustom] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [shareWorkspaceId, setShareWorkspaceId] = useState<number | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIcon, setEditIcon] = useState<string | null>(null);
  const [editColor, setEditColor] = useState<string>(WORKSPACE_COLORS[0]);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [sidebarPanelOpen, setSidebarPanelOpen] = useState(true);
  const [landingSearch, setLandingSearch] = useState("");
  const isResizingRef = useRef(false);

  const { data: pages = [] } = useQuery<WorkspacePage[]>({
    queryKey: ["/api/workspaces", selectedWorkspaceId, "pages"],
    enabled: !!selectedWorkspaceId,
  });

  const { data: allWorkspaces = [] } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const { data: workspaceTemplates = [] } = useQuery<any[]>({
    queryKey: ["/api/workspace-templates"],
  });

  const { data: orgMembers = [] } = useQuery({
    queryKey: ["/api/chat/users", "workspace-create"],
    queryFn: fetchOrgMemberCandidates,
  });

  const { data: selectedWorkspaceMembers = [] } = useQuery<any[]>({
    queryKey: ["/api/workspaces", selectedWorkspaceId, "members-with-users"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/workspaces/${selectedWorkspaceId}/members-with-users`);
      if (!res.ok) return [];
      const raw = await res.json();
      return Array.isArray(raw)
        ? raw.map((entry: any) => ({ ...(entry.member || entry), user: entry.user }))
        : [];
    },
    enabled: !!selectedWorkspaceId,
  });

  const { data: myPermissionData } = useQuery<{ permission: string }>({
    queryKey: ["/api/workspaces", selectedWorkspaceId, "my-permission"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/workspaces/${selectedWorkspaceId}/my-permission`);
      if (!res.ok) return { permission: "edit" };
      return res.json();
    },
    enabled: !!selectedWorkspaceId,
  });

  const { data: globalFavorites = [] } = useQuery<WorkspacePage[]>({
    queryKey: ["/api/workspace-pages/favorites"],
  });

  const editWorkspaceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; description?: string; icon?: string | null; color?: string } }) =>
      apiRequest("PATCH", `/api/workspaces/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      setEditingWorkspace(null);
      toast({ title: "Workspace updated" });
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/workspaces/${id}/favorite`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
    },
  });

  const openEditDialog = (ws: Workspace) => {
    setEditingWorkspace(ws);
    setEditName(ws.name);
    setEditDescription(ws.description || "");
    setEditIcon(ws.icon || null);
    setEditColor(ws.color || WORKSPACE_COLORS[ws.id % WORKSPACE_COLORS.length]);
  };

  const createWorkspaceMutation = useMutation({
    mutationFn: async ({
      name,
      icon,
      description,
      color,
      templateId,
      memberIds,
    }: {
      name: string;
      icon?: string | null;
      description?: string;
      color?: string;
      templateId?: string;
      memberIds?: string[];
    }) => {
      let workspace: any;
      if (templateId) {
        const templateResponse = await apiRequest("POST", `/api/workspaces/from-template/${templateId}`, {
          name,
          description: description || undefined,
          color: color || undefined,
          icon: icon || undefined,
        });
        workspace = await templateResponse.json();
      } else {
        const response = await apiRequest("POST", "/api/workspaces", {
          name,
          icon: icon || undefined,
          description: description || undefined,
          color: color || undefined,
          tenantId: 1,
        });
        workspace = await response.json();
      }

      if (workspace?.id && memberIds && memberIds.length > 0) {
        await Promise.all(
          memberIds.map((memberId) =>
            apiRequest("POST", `/api/workspaces/${workspace.id}/members`, { userId: memberId, role: "member" }),
          ),
        );
      }
      return workspace;
    },
    onSuccess: async (workspace: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/list"] });
      setSelectedWorkspaceId(workspace.id);
      setNavState("overview");
      setShowCreateDialog(false);
      setNewWorkspaceName("");
      setNewWorkspaceDescription("");
      setNewWorkspaceIcon(null);
      setNewWorkspaceColor(WORKSPACE_COLORS[0]);
      setNewWorkspaceColorCustom("");
      setSelectedTemplateId("");
      setSelectedMemberIds([]);
      const recentIds: number[] = (() => { try { return JSON.parse(localStorage.getItem("jiganto_recent_workspaces") || "[]"); } catch { return []; } })();
      const updated = [workspace.id, ...recentIds.filter((r: number) => r !== workspace.id)].slice(0, 5);
      localStorage.setItem("jiganto_recent_workspaces", JSON.stringify(updated));
    },
  });

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.max(200, Math.min(480, startWidth + (e.clientX - startX)));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      isResizingRef.current = false;
      localStorage.setItem("jiganto_workspace_sidebar_width", String(sidebarWidth));
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem("jiganto_workspace_sidebar_width", String(sidebarWidth));
  }, [sidebarWidth]);

  const createPageMutation = useMutation({
    mutationFn: (data: { parentId?: number; pageType?: string }) => {
      const existingPages = pages.filter((p) => data.parentId ? p.parentId === data.parentId : !p.parentId);
      const maxSort = existingPages.length > 0 ? Math.max(...existingPages.map((p) => p.sortOrder || 0)) : 0;
      return apiRequest("POST", `/api/workspaces/${selectedWorkspaceId}/pages`, { title: "Untitled", icon: "file", sortOrder: maxSort + 1, ...data });
    },
    onSuccess: async (res: Response) => {
      const page = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", selectedWorkspaceId, "pages"] });
      setSelectedPageId(page.id);
      setNavState("page");
    },
  });

  const createPageFromTemplateMutation = useMutation({
    mutationFn: async (template: DatabaseTemplate) => {
      const existingPages = pages.filter((p) => !p.parentId);
      const maxSort = existingPages.length > 0 ? Math.max(...existingPages.map((p) => p.sortOrder || 0)) : 0;
      const pageRes = await apiRequest("POST", `/api/workspaces/${selectedWorkspaceId}/pages`, {
        title: template.name,
        icon: "file",
        sortOrder: maxSort + 1,
        pageType: "database",
        skipDefaultTemplate: true,
      });
      const page = await pageRes.json();
      await apiRequest("POST", `/api/workspace-pages/${page.id}/databases/from-template`, {
        name: template.name,
        columns: template.columns,
        rows: template.sampleRows,
      });
      return page;
    },
    onSuccess: (page: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", selectedWorkspaceId, "pages"] });
      setSelectedPageId(page.id);
      setNavState("page");
      setShowBoardTemplateDialog(false);
      toast({ title: "Board created from template" });
    },
  });

  const handleCreatePage = (parentId?: number, pageType?: string) => {
    if (pageType) {
      createPageMutation.mutate({ parentId, pageType });
    } else {
      setPendingParentId(parentId);
      setNewPageDialogOpen(true);
    }
  };

  const handleNewPageDialogCreate = (pageType: string) => {
    createPageMutation.mutate({ parentId: pendingParentId, pageType });
    setPendingParentId(undefined);
  };

  const handleSelectWorkspace = (id: number) => {
    setSelectedWorkspaceId(id);
    setSelectedPageId(null);
    setNavState("overview");
    if (isMobile) setSidebarPanelOpen(true);
    apiRequest("POST", `/api/workspaces/${id}/access`).catch(() => {});
    const recentIds: number[] = (() => { try { return JSON.parse(localStorage.getItem("jiganto_recent_workspaces") || "[]"); } catch { return []; } })();
    const updated = [id, ...recentIds.filter((r: number) => r !== id)].slice(0, 5);
    localStorage.setItem("jiganto_recent_workspaces", JSON.stringify(updated));
  };

  const handleSelectPage = (id: number) => {
    setSelectedPageId(id);
    setNavState("page");
    if (isMobile) setSidebarPanelOpen(false);
  };

  const getWorkspaceName = (wsId: number) => {
    const ws = allWorkspaces.find((w) => w.id === wsId);
    return ws?.name || "Unknown";
  };

  const selectedPageData = pages.find((p) => p.id === selectedPageId);
  const selectedWorkspace = allWorkspaces.find((w) => w.id === selectedWorkspaceId) || null;
  const workspaceReadOnly =
    selectedWorkspace?.status === "archived" ||
    myPermissionData?.permission === "view";

  const togglePageFavoriteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("PATCH", `/api/workspace-pages/${id}`, { isFavorite: !pages.find((p) => p.id === id)?.isFavorite }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-pages", selectedPageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", selectedWorkspaceId, "pages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-pages/favorites"] });
    },
  });

  const deletePageFromBarMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/workspace-pages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", selectedWorkspaceId, "pages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-pages/favorites"] });
      setSelectedPageId(null);
      setNavState("overview");
      toast({ title: "Page deleted" });
    },
  });

  const duplicateWorkspaceMutation = useMutation({
    mutationFn: (workspaceId: number) => apiRequest("POST", `/api/workspaces/${workspaceId}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/list"] });
      toast({ title: "Workspace duplicated" });
    },
  });

  const archiveWorkspaceMutation = useMutation({
    mutationFn: (workspaceId: number) => apiRequest("POST", `/api/workspaces/${workspaceId}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/list"] });
      toast({ title: "Workspace archived" });
    },
  });

  const copyPageToDocumentsMutation = useMutation({
    mutationFn: (pageId: number) => apiRequest("POST", `/api/workspace-pages/${pageId}/copy-to-documents`, {}),
    onSuccess: () => {
      toast({ title: "Copied to documents" });
    },
  });

  const getPageTitle = (pageId: number) => {
    const page = pages.find((p) => p.id === pageId);
    return page?.title || "Untitled";
  };

  const getPageParentChain = (pageId: number): WorkspacePage[] => {
    const chain: WorkspacePage[] = [];
    let current = pages.find((p) => p.id === pageId);
    while (current?.parentId) {
      const parent = pages.find((p) => p.id === current!.parentId);
      if (parent) {
        chain.unshift(parent);
        current = parent;
      } else break;
    }
    return chain;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setIsFullScreen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ws = params.get("workspace");
    const page = params.get("page");
    if (ws && !Number.isNaN(Number(ws))) {
      setSelectedWorkspaceId(Number(ws));
      setNavState(page ? "page" : "overview");
      if (page && !Number.isNaN(Number(page))) setSelectedPageId(Number(page));
    }
  }, []);

  useEffect(() => {
    if (navState === "landing") {
      setLocation("/modules/workspaces");
      return;
    }
    if (selectedWorkspaceId) {
      const params = new URLSearchParams();
      params.set("workspace", String(selectedWorkspaceId));
      if (selectedPageId) params.set("page", String(selectedPageId));
      setLocation(`/modules/workspaces?${params.toString()}`);
    }
  }, [selectedWorkspaceId, selectedPageId, navState, setLocation]);

  useEffect(() => {
    if (!selectedWorkspaceId || navState === "landing") return;
    const sendHeartbeat = () => {
      apiRequest("POST", `/api/workspaces/${selectedWorkspaceId}/presence`, {
        editingPageId: selectedPageId || undefined,
      }).catch(() => {});
    };
    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 20000);
    return () => window.clearInterval(timer);
  }, [selectedWorkspaceId, selectedPageId, navState]);

  const showSidebar = navState !== "landing" && !isFullScreen;
  const sidebarVisible = showSidebar && (!isMobile || sidebarPanelOpen);

  return (
    <div
      className={cn(navState === "landing" ? "min-h-screen bg-background" : "h-screen")}
      data-testid="workspaces-page"
    >
      <Sidebar />
      {navState === "landing" ? (
        <main className={cn("transition-all duration-300 min-h-screen flex flex-col", mainOffset, mobileTopOffset)}>
          <div className="px-3 sm:px-4 pt-3 sm:pt-4">
            <ModuleWelcomeBanner
              moduleKey="workspaces"
              features={[
                "Docs, boards & wikis in one place",
                "Table, Kanban & calendar views",
                "Share with members or public links",
                "Project tracking boards",
              ]}
            />
          </div>

          <div className="border-b border-border/30 bg-card/95 backdrop-blur sticky top-0 z-40">
            <ModuleHeader
              icon={WorkspacesIcon}
              title="Workspaces"
              subtitle="Collaborative spaces for notes, boards and wikis"
              searchPlaceholder="Search workspaces..."
              searchValue={landingSearch}
              onSearchChange={setLandingSearch}
              searchTestId="landing-search-input"
              titleTestId="workspaces-title"
              actions={
                <Button onClick={() => setShowCreateDialog(true)} className="gap-1.5" data-testid="create-workspace-button">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Workspace</span>
                  <span className="sm:hidden">New</span>
                </Button>
              }
            />
          </div>

          <WorkspaceLanding
            onSelectWorkspace={handleSelectWorkspace}
            onEditWorkspace={openEditDialog}
            onToggleFavorite={(id) => toggleFavoriteMutation.mutate(id)}
            onShareWorkspace={(id) => { setShareWorkspaceId(id); setSharePanelOpen(true); }}
            searchQuery={landingSearch}
            onSearchQueryChange={setLandingSearch}
          />
        </main>
      ) : (
      <div className={cn("flex h-full transition-all duration-300", mainOffset, mobileTopOffset)}>
        {showSidebar && isMobile && sidebarPanelOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-label="Close sidebar"
            onClick={() => setSidebarPanelOpen(false)}
            data-testid="workspace-sidebar-backdrop"
          />
        )}
        {sidebarVisible && (
          <div
            className={cn(
              "flex-shrink-0 flex flex-col border-r bg-muted/20 relative z-50",
              isMobile && "fixed left-0 top-0 bottom-0 shadow-xl"
            )}
            style={{ width: isMobile ? "min(100vw - 3rem, 280px)" : `${sidebarWidth}px` }}
            data-testid="workspace-sidebar-panel"
          >
            <div className="px-3 pt-3 pb-2 border-b">
              <button
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full"
                onClick={() => { setNavState("landing"); setSelectedWorkspaceId(null); setSelectedPageId(null); }}
                data-testid="back-to-all-workspaces"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All Workspaces
              </button>
            </div>

            {selectedWorkspaceId && (
              <>
                <div className="px-3 py-2 border-b">
                  <button
                    className={cn(
                      "flex items-center gap-2 text-sm font-medium w-full rounded-md px-2 py-1.5",
                      navState === "overview" ? "bg-accent/50" : "hover:bg-muted/50"
                    )}
                    onClick={() => { setNavState("overview"); setSelectedPageId(null); }}
                    data-testid="sidebar-overview-link"
                  >
                    <span
                      className="h-5 w-5 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: getWorkspaceColor(selectedWorkspaceId, allWorkspaces.find((w) => w.id === selectedWorkspaceId)?.color) }}
                    >
                      {allWorkspaces.find((w) => w.id === selectedWorkspaceId)?.name?.charAt(0).toUpperCase() || "W"}
                    </span>
                    <span className="truncate">{allWorkspaces.find((w) => w.id === selectedWorkspaceId)?.name || "Workspace"}</span>
                  </button>
                  <button
                    className={cn(
                      "flex items-center gap-2 text-sm w-full rounded-md px-2 py-1.5 mt-0.5",
                      navState === "overview" && !selectedPageId ? "bg-accent/30 text-foreground" : "text-muted-foreground hover:bg-muted/50"
                    )}
                    onClick={() => { setNavState("overview"); setSelectedPageId(null); }}
                    data-testid="sidebar-overview-button"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Overview
                  </button>
                </div>

                {globalFavorites.filter((f) => f.workspaceId === selectedWorkspaceId).length > 0 && (
                  <div className="px-2 pt-2 pb-1 border-b max-h-[150px] overflow-y-auto">
                    <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <Star className="h-3 w-3" />
                      Favorites
                    </div>
                    {globalFavorites
                      .filter((f) => f.workspaceId === selectedWorkspaceId)
                      .map((page) => (
                        <button
                          key={`fav-${page.id}`}
                          className={cn(
                            "w-full flex items-center gap-2 py-1 px-2 rounded-md cursor-pointer text-sm text-left",
                            selectedPageId === page.id ? "bg-accent/50 text-foreground" : "text-muted-foreground hover-elevate"
                          )}
                          onClick={() => handleSelectPage(page.id)}
                          data-testid={`sidebar-favorite-${page.id}`}
                        >
                          {getPageIcon(page.icon)}
                          <span className="flex-1 truncate">{page.title || "Untitled"}</span>
                        </button>
                      ))}
                  </div>
                )}

                <WorkspaceSidebar
                  workspaceId={selectedWorkspaceId}
                  selectedPageId={selectedPageId}
                  onSelectPage={handleSelectPage}
                  onCreatePage={handleCreatePage}
                  onDeselectPage={() => { setSelectedPageId(null); setNavState("overview"); }}
                  onCreateFromTemplate={() => { setShowBoardTemplateDialog(true); setBoardTemplateSearch(""); setBoardTemplateCategory(null); }}
                />
              </>
            )}

            <div
              className={cn(
                "absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/50 z-50",
                isMobile && "hidden"
              )}
              onMouseDown={handleResizeStart}
              data-testid="sidebar-resize-handle"
            />
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col">
          {(!selectedWorkspaceId || navState === "page") && (
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/10 flex-shrink-0" data-testid="workspace-breadcrumb-bar">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      className="cursor-pointer text-xs"
                      onClick={() => { setNavState("landing"); setSelectedWorkspaceId(null); setSelectedPageId(null); }}
                      data-testid="breadcrumb-workspaces"
                    >
                      Workspaces
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {selectedWorkspaceId && (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {navState === "overview" ? (
                          <BreadcrumbPage className="text-xs" data-testid="breadcrumb-workspace-name">
                            {getWorkspaceName(selectedWorkspaceId)}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink
                            className="cursor-pointer text-xs"
                            onClick={() => { setNavState("overview"); setSelectedPageId(null); }}
                            data-testid="breadcrumb-workspace-name"
                          >
                            {getWorkspaceName(selectedWorkspaceId)}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </>
                  )}
                  {navState === "page" && selectedPageId && (
                    <>
                      {getPageParentChain(selectedPageId).map((parent) => (
                        <span key={parent.id} className="contents">
                          <BreadcrumbSeparator />
                          <BreadcrumbItem>
                            <BreadcrumbLink
                              className="cursor-pointer text-xs"
                              onClick={() => handleSelectPage(parent.id)}
                              data-testid={`breadcrumb-page-${parent.id}`}
                            >
                              {parent.title || "Untitled"}
                            </BreadcrumbLink>
                          </BreadcrumbItem>
                        </span>
                      ))}
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage className="text-xs" data-testid="breadcrumb-current-page">
                          {getPageTitle(selectedPageId)}
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  )}
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex items-center gap-1">
                {navState === "page" && selectedPageData && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => togglePageFavoriteMutation.mutate(selectedPageData.id)} className="gap-1 text-xs h-7" data-testid="toggle-page-favorite">
                      <Star className={cn("h-3.5 w-3.5", selectedPageData.isFavorite && "text-yellow-500 fill-yellow-500")} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(window.location.href); toast({ title: "Link copied", description: "Page link copied to clipboard" }); }} className="gap-1 text-xs h-7" data-testid="share-page">
                      <Share2 className="h-3.5 w-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="page-more-menu">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => copyPageToDocumentsMutation.mutate(selectedPageData.id)} data-testid="copy-page-to-documents-menu">
                          <Copy className="h-4 w-4 mr-2" />
                          Copy to Documents
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => deletePageFromBarMutation.mutate(selectedPageData.id)} className="text-destructive" data-testid="delete-page-menu">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Page
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
                <button
                  onClick={() => setIsFullScreen((prev) => !prev)}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title={isFullScreen ? "Exit full screen (Ctrl+Shift+F)" : "Full screen (Ctrl+Shift+F)"}
                  data-testid="fullscreen-toggle"
                >
                  {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
          {selectedWorkspace && (
            <WorkspaceHeader
              workspace={selectedWorkspace}
              members={selectedWorkspaceMembers}
              readOnly={workspaceReadOnly}
              workspaceId={selectedWorkspace.id}
              currentPageId={selectedPageId}
              onBack={() => { setNavState("landing"); setSelectedWorkspaceId(null); setSelectedPageId(null); }}
              onShare={() => { setShareWorkspaceId(selectedWorkspace.id); setSharePanelOpen(true); }}
              onToggleFavorite={() => toggleFavoriteMutation.mutate(selectedWorkspace.id)}
              onToggleSidebar={() => setSidebarPanelOpen((prev) => !prev)}
              onUpdateWorkspace={(updates) => editWorkspaceMutation.mutate({ id: selectedWorkspace.id, data: updates })}
              onDuplicate={() => duplicateWorkspaceMutation.mutate(selectedWorkspace.id)}
              onArchive={() => archiveWorkspaceMutation.mutate(selectedWorkspace.id)}
            />
          )}

          <div className="flex-1 overflow-hidden">
          {navState === "overview" && selectedWorkspaceId && (
            <WorkspaceOverview
              workspaceId={selectedWorkspaceId}
              onBack={() => { setNavState("landing"); setSelectedWorkspaceId(null); }}
              onSelectPage={handleSelectPage}
              onCreatePage={handleCreatePage}
              onEditWorkspace={openEditDialog}
              onToggleFavorite={(id) => toggleFavoriteMutation.mutate(id)}
              onCreateFromTemplate={() => { setShowBoardTemplateDialog(true); setBoardTemplateSearch(""); setBoardTemplateCategory(null); }}
            />
          )}

          {navState === "page" && selectedPageId && selectedWorkspaceId && (
            <PageView
              pageId={selectedPageId}
              workspaceId={selectedWorkspaceId}
              readOnly={workspaceReadOnly}
              onDeletePage={() => { setSelectedPageId(null); setNavState("overview"); }}
              onSelectPage={handleSelectPage}
              isFullScreen={isFullScreen}
              onToggleFullScreen={() => setIsFullScreen((prev) => !prev)}
            />
          )}

          {navState === "page" && !selectedPageId && selectedWorkspaceId && (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <Sparkles className="h-12 w-12 mb-4" style={{ color: "#F59E0B", opacity: 0.4 }} />
              <h2 className="text-xl font-semibold mb-2">Select or create a page</h2>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                Choose a page from the sidebar or create a new one to start writing.
              </p>
              <Button onClick={() => handleCreatePage()} className="gap-1" data-testid="create-page-empty-state">
                <Plus className="h-4 w-4" />
                New Page
              </Button>
            </div>
          )}
          </div>
          {(navState === "overview" || navState === "page") && selectedWorkspaceId && (
            <WorkspaceBottomNav
              pages={pages.filter((p) => !p.parentId).map((p) => ({ id: p.id, title: p.title || "Untitled" }))}
              currentPageId={selectedPageId}
              onSelectPage={(pageId) => {
                setSelectedPageId(pageId);
                setNavState("page");
              }}
            />
          )}
        </div>
      </div>
      )}

      <NewPageDialog
        open={newPageDialogOpen}
        onOpenChange={setNewPageDialogOpen}
        onCreatePage={handleNewPageDialogCreate}
      />

      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setNewWorkspaceName("");
            setNewWorkspaceDescription("");
            setNewWorkspaceIcon(null);
            setNewWorkspaceColor(WORKSPACE_COLORS[0]);
            setNewWorkspaceColorCustom("");
            setSelectedTemplateId("");
            setSelectedMemberIds([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>Give your workspace a name, pick an icon, and choose a color.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-4">
              <WorkspaceIconPicker
                selectedIcon={newWorkspaceIcon}
                onSelect={setNewWorkspaceIcon}
              />
              <div className="flex-1 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
                  <Input
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="Workspace name..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newWorkspaceName.trim()) {
                        createWorkspaceMutation.mutate({
                          name: newWorkspaceName.trim(),
                          icon: newWorkspaceIcon,
                          description: newWorkspaceDescription.trim() || undefined,
                          color: newWorkspaceColorCustom || newWorkspaceColor,
                          templateId: selectedTemplateId || undefined,
                          memberIds: selectedMemberIds,
                        });
                      }
                    }}
                    data-testid="create-workspace-name-input"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Template (optional)</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    data-testid="create-workspace-template-select"
                  >
                    <option value="">No template</option>
                    {workspaceTemplates.map((template) => (
                      <option key={template.id} value={String(template.id)}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  {workspaceTemplates.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {WORKSPACE_FULL_TEMPLATES.length} built-in templates available once API templates load.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Description (optional)</label>
                  <textarea
                    value={newWorkspaceDescription}
                    onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                    placeholder="What is this workspace for?"
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    data-testid="create-workspace-description-input"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Members</label>
              <div className="max-h-28 overflow-y-auto rounded-md border p-2 space-y-1">
                {orgMembers.length === 0 && (
                  <p className="text-xs text-muted-foreground">No members available.</p>
                )}
                {orgMembers.map((member) => {
                  const userId = getOrgMemberUserId(member);
                  const label = formatOrgMemberLabel(member);
                  const subtitle = formatOrgMemberSubtitle(member);
                  const checked = selectedMemberIds.includes(userId);
                  return (
                    <label key={userId} className="flex items-center gap-2 text-xs py-0.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedMemberIds((prev) =>
                            e.target.checked ? [...prev, userId] : prev.filter((id) => id !== userId),
                          );
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{label}</span>
                        {subtitle && (
                          <span className="block truncate text-muted-foreground">{subtitle}</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {WORKSPACE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewWorkspaceColor(c)}
                    className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center transition-transform",
                      newWorkspaceColor === c && "ring-2 ring-offset-2 ring-primary scale-110"
                    )}
                    style={{ backgroundColor: c }}
                    data-testid={`create-workspace-color-${c.replace("#", "")}`}
                  >
                    {newWorkspaceColor === c && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                ))}
              </div>
              <Input
                value={newWorkspaceColorCustom}
                onChange={(e) => setNewWorkspaceColorCustom(e.target.value)}
                placeholder="#7C3AED"
                className="mt-2 h-8"
                data-testid="create-workspace-custom-color-input"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewWorkspaceName("");
                  setNewWorkspaceDescription("");
                  setNewWorkspaceIcon(null);
                  setNewWorkspaceColor(WORKSPACE_COLORS[0]);
                  setNewWorkspaceColorCustom("");
                  setSelectedTemplateId("");
                  setSelectedMemberIds([]);
                }}
                data-testid="cancel-create-workspace"
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  newWorkspaceName.trim() &&
                  createWorkspaceMutation.mutate({
                    name: newWorkspaceName.trim(),
                    icon: newWorkspaceIcon,
                    description: newWorkspaceDescription.trim() || undefined,
                    color: newWorkspaceColorCustom || newWorkspaceColor,
                    templateId: selectedTemplateId || undefined,
                    memberIds: selectedMemberIds,
                  })
                }
                disabled={!newWorkspaceName.trim() || createWorkspaceMutation.isPending}
                data-testid="confirm-create-workspace"
              >
                {createWorkspaceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editingWorkspace !== null} onOpenChange={(open) => { if (!open) setEditingWorkspace(null); }}>
        <DialogContent className="sm:max-w-md" data-testid="edit-workspace-dialog">
          <DialogHeader>
            <DialogTitle>Edit Workspace</DialogTitle>
            <DialogDescription>Update your workspace icon, name, description, and color.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-4">
              <WorkspaceIconPicker
                selectedIcon={editIcon}
                onSelect={setEditIcon}
              />
              <div className="flex-1 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Workspace name..."
                    autoFocus
                    data-testid="edit-workspace-name-input"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Description (optional)</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="What is this workspace for?"
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    data-testid="edit-workspace-description-input"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {WORKSPACE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditColor(c)}
                    className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center transition-transform",
                      editColor === c && "ring-2 ring-offset-2 ring-primary scale-110"
                    )}
                    style={{ backgroundColor: c }}
                    data-testid={`edit-workspace-color-${c.replace("#", "")}`}
                  >
                    {editColor === c && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingWorkspace(null)} data-testid="cancel-edit-workspace">Cancel</Button>
              <Button
                onClick={() => {
                  if (editingWorkspace && editName.trim()) {
                    editWorkspaceMutation.mutate({
                      id: editingWorkspace.id,
                      data: { name: editName.trim(), description: editDescription.trim() || undefined, icon: editIcon, color: editColor },
                    });
                  }
                }}
                disabled={!editName.trim() || editWorkspaceMutation.isPending}
                data-testid="confirm-edit-workspace"
              >
                {editWorkspaceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBoardTemplateDialog} onOpenChange={setShowBoardTemplateDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="board-template-dialog">
          <DialogHeader>
            <DialogTitle>Create Board from Template</DialogTitle>
            <DialogDescription>Choose a template to get started quickly with pre-configured columns and sample data.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search templates..." value={boardTemplateSearch} onChange={(e) => setBoardTemplateSearch(e.target.value)} className="pl-9 h-9" data-testid="board-template-search-input" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant={boardTemplateCategory === null ? "default" : "outline"} size="sm" onClick={() => setBoardTemplateCategory(null)} data-testid="board-template-category-all">All</Button>
              {TEMPLATE_CATEGORIES.map((cat) => (
                <Button key={cat} variant={boardTemplateCategory === cat ? "default" : "outline"} size="sm" onClick={() => setBoardTemplateCategory(boardTemplateCategory === cat ? null : cat)} data-testid={`board-template-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}>{cat}</Button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pr-1">
              {DATABASE_TEMPLATES.filter((t) => {
                const matchesSearch = !boardTemplateSearch || t.name.toLowerCase().includes(boardTemplateSearch.toLowerCase()) || t.description.toLowerCase().includes(boardTemplateSearch.toLowerCase());
                const matchesCategory = !boardTemplateCategory || t.category === boardTemplateCategory;
                return matchesSearch && matchesCategory;
              }).map((template) => {
                const IconComponent = TEMPLATE_ICONS[template.icon] || Table2;
                return (
                  <Card key={template.id} className="p-4 cursor-pointer hover-elevate" onClick={() => createPageFromTemplateMutation.mutate(template)} data-testid={`board-template-card-${template.id}`}>
                    <div className="flex items-start gap-3 mb-2">
                      <div className={cn("p-2 rounded-md flex-shrink-0", CATEGORY_COLORS[template.category] || "bg-muted")}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-sm truncate">{template.name}</h4>
                        <Badge variant="secondary" className="text-[10px] flex-shrink-0">{template.category}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{template.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {template.columns.slice(0, 5).map((col) => (
                        <Badge key={col.name} variant="outline" className="text-[10px]">{col.name}</Badge>
                      ))}
                      {template.columns.length > 5 && <Badge variant="outline" className="text-[10px]">+{template.columns.length - 5}</Badge>}
                    </div>
                  </Card>
                );
              })}
              {DATABASE_TEMPLATES.filter((t) => {
                const matchesSearch = !boardTemplateSearch || t.name.toLowerCase().includes(boardTemplateSearch.toLowerCase()) || t.description.toLowerCase().includes(boardTemplateSearch.toLowerCase());
                const matchesCategory = !boardTemplateCategory || t.category === boardTemplateCategory;
                return matchesSearch && matchesCategory;
              }).length === 0 && (
                <div className="text-center py-12 text-muted-foreground col-span-full">
                  <Table2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No templates match your search</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <WorkspaceSharePanel
        workspaceId={shareWorkspaceId || selectedWorkspaceId || 0}
        open={sharePanelOpen}
        onOpenChange={setSharePanelOpen}
        readOnly={workspaceReadOnly}
      />
    </div>
  );
}
