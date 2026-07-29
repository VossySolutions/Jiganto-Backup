import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ModuleShell } from "@/components/ModuleShell";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import {
  modulePageBannerWrapClass,
  modulePageContentOuterClass,
  modulePageContentScrollClass,
  modulePageMainClass,
  modulePageShellClass,
  modulePageStickyHeaderClass,
  modulePageTabsListClass,
  modulePageTabsWrapClass,
  modulePageTabTriggerClass,
} from "@/components/ModulePageChrome";
import { TemplatesIcon } from "@/components/icons/ModuleIcons";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FormDialogShell, FormDialogViewShell, FormSection, FieldLabel } from "@/components/ui/form-dialog-shell";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Search,
  Plus,
  Sparkles,
  Eye,
  LayoutTemplate,
  X,
  Loader2,
  TrendingUp,
  Clock,
  Star,
  Wand2,
  Send,
  ChevronRight,
  Filter,
  Menu,
  Store,
  LayoutGrid,
  LayoutList,
} from "lucide-react";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import {
  MondayBoardProvider,
  MondayBoardTable,
  MondayBoardChromeControls,
} from "@/components/MondayBoardTable";
import type { PlatformTemplateWithMeta } from "@shared/models/templates";
import {
  TEMPLATE_MODULES, CATEGORY_TAGS, SORT_OPTIONS,
  AI_GENERATE_MODULES, moduleLabel, moduleColor,
} from "@/lib/template-constants";
import {
  fetchTemplates,
  fetchTemplateModuleCounts,
  fetchTemplatesDiscovery,
  fetchMarketplaceTemplates,
  applyTemplate,
  submitTemplateForReview,
  generateTemplateWithAi
} from "@/lib/template-api";
import {
  TemplatesPageSkeleton, TemplatesGridSkeleton, TemplatesNavSkeleton,
  TemplatesErrorState, TemplatesEmptyState,
} from "@/components/templates/TemplatesLoadingState";
import { SubmittedTemplatesReview } from "@/components/templates/SubmittedTemplatesReview";
import { TemplateThumbnail } from "@/components/templates/TemplateThumbnail";
import { setSaveAsTemplateMode } from "@/components/templates/SavingAsTemplateBanner";
import { fetchWithAuth } from "@/lib/queryClient";

function TierBadge({ tier, showCredit, orgName }: { tier: string; showCredit?: boolean; orgName?: string | null }) {
  if (tier === "system" && showCredit && orgName) {
    return <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 shrink-0">Contributed</Badge>;
  }
  if (tier === "system") return <Badge variant="secondary" className="text-[10px] shrink-0">Jiganto ✓</Badge>;
  if (tier === "submitted") return <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0">Submitted</Badge>;
  if (showCredit && orgName) return <Badge variant="outline" className="text-[10px] shrink-0">By {orgName}</Badge>;
  return null;
}

function snapshotSummary(template: PlatformTemplateWithMeta): string {
  const snap = template.snapshotJsonb as Record<string, unknown>;
  if (template.module === "survey") {
    const qs = (snap.questionsJson as unknown[]) ?? [];
    return `${qs.length} questions · ${snap.surveyType ?? "Survey"}`;
  }
  if (template.module === "project") {
    const tools = (snap.tools as unknown[]) ?? [];
    const ws = (snap.workstreamNames as unknown[]) ?? [];
    return `${tools.length} tools · ${ws.length} workstreams`;
  }
  if (template.module === "bpm_framework") {
    const phases = (snap.phases as unknown[]) ?? [];
    return `${phases.length} phases · ${snap.vendor ?? "Framework"}`;
  }
  if (template.module === "esign") return snap.category ? String(snap.category) : "Document template";
  if (template.module === "workspace") return "Workspace structure with pages & boards";
  if (template.module === "bpml") {
    const entries = (snap.entries as unknown[]) ?? [];
    return `${entries.length} process rows`;
  }
  if (template.module === "whiteboard") {
    const notes = (snap.notes as unknown[]) ?? [];
    return `${notes.length} sticky note zones`;
  }
  return template.description?.slice(0, 120) ?? "Template snapshot";
}

function TemplateCard({
  template,
  onPreview,
  onUse,
  using,
  isMobile,
}: {
  template: PlatformTemplateWithMeta;
  onPreview: () => void;
  onUse: () => void;
  using?: boolean;
  isMobile?: boolean;
}) {
  const color = moduleColor(template.module);
  return (
    <Card className="group flex flex-col overflow-hidden hover:shadow-md transition-shadow h-full" data-testid={`template-card-${template.id}`}>
      <div className="relative h-28 sm:h-32 border-b overflow-hidden">
        <TemplateThumbnail template={template} className="h-full w-full" />
        {!isMobile && (
          <div className="absolute inset-0 bg-background/85 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
            <Button size="sm" variant="secondary" onClick={onPreview} data-testid={`preview-${template.id}`}>
              <Eye className="h-3.5 w-3.5 mr-1" /> Preview
            </Button>
            <Button size="sm" onClick={onUse} disabled={using} data-testid={`use-${template.id}`}>
              {using ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Use template"}
            </Button>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1 gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2">{template.name}</h3>
          <TierBadge tier={template.tier} showCredit={template.showContributorCredit ?? false} orgName={template.contributorOrgName} />
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px]" style={{ borderColor: color, color }}>
            {moduleLabel(template.module)}
          </Badge>
          {template.isAiGenerated && (
            <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-600 dark:text-violet-300">AI</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
          {template.description || snapshotSummary(template)}
        </p>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
          <span>{template.usageCount ?? 0} uses</span>
          <span className="truncate max-w-[45%] text-right">{template.creatorName ?? "—"}</span>
        </div>
        {isMobile && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" className="flex-1 h-8" onClick={onPreview}>Preview</Button>
            <Button size="sm" className="flex-1 h-8" onClick={onUse} disabled={using}>
              {using ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Use"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function ModuleNav({
  selectedModule,
  moduleCounts,
  onSelect,
  total,
  className,
}: {
  selectedModule: string | null;
  moduleCounts: Record<string, number>;
  onSelect: (m: string | null) => void;
  total: number;
  className?: string;
}) {
  return (
    <nav className={cn("space-y-0.5", className)} data-testid="template-module-nav">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between transition-colors",
          !selectedModule ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground",
        )}
        data-testid="nav-all-modules"
      >
        <span>All modules</span>
        <span className="text-xs tabular-nums bg-muted px-1.5 py-0.5 rounded">{total}</span>
      </button>
      {TEMPLATE_MODULES.map(m => (
        <button
          key={m.key}
          type="button"
          onClick={() => onSelect(m.key)}
          className={cn(
            "w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between transition-colors",
            selectedModule === m.key ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground",
          )}
          data-testid={`nav-module-${m.key}`}
        >
          <span className="truncate pr-2">{m.label}</span>
          <span className="text-xs tabular-nums flex-shrink-0 text-muted-foreground">
            {moduleCounts[m.key] ?? 0}
          </span>
        </button>
      ))}
    </nav>
  );
}

function DiscoveryStrip({
  title, icon: Icon, items, onPreview, onUse, usingId, isMobile, loading,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: PlatformTemplateWithMeta[];
  onPreview: (t: PlatformTemplateWithMeta) => void;
  onUse: (t: PlatformTemplateWithMeta) => void;
  usingId?: number;
  isMobile?: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <section className="mb-8">
        <div className="h-5 w-40 bg-muted rounded animate-pulse mb-3" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="min-w-[240px] h-[200px] rounded-xl bg-muted animate-pulse shrink-0" />
          ))}
        </div>
      </section>
    );
  }
  if (!items.length) return null;
  return (
    <section className="mb-8" data-testid={`discovery-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <h2 className="text-sm font-semibold">{title}</h2>
        <Badge variant="secondary" className="text-[10px] ml-auto">{items.length}</Badge>
      </div>
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 snap-x snap-mandatory -mx-1 px-1 scrollbar-thin">
        {items.map(t => (
          <div key={t.id} className="min-w-[240px] sm:min-w-[260px] max-w-[280px] flex-shrink-0 snap-start">
            <TemplateCard
              template={t}
              onPreview={() => onPreview(t)}
              onUse={() => onUse(t)}
              using={usingId === t.id}
              isMobile={isMobile}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TemplatesPage() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [createdByFilter, setCreatedByFilter] = useState("all");
  const [sort, setSort] = useState("most_used");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"library" | "marketplace">("library");
  const [catalogLayout, setCatalogLayout] = useState<"cards" | "table">("cards");

  const [previewTpl, setPreviewTpl] = useState<PlatformTemplateWithMeta | null>(null);
  const [applyTpl, setApplyTpl] = useState<PlatformTemplateWithMeta | null>(null);
  const [applyName, setApplyName] = useState("");
  const [applyProjectId, setApplyProjectId] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createModule, setCreateModule] = useState("");
  const [showAi, setShowAi] = useState(false);
  const [aiModule, setAiModule] = useState("survey");
  const [aiPrompt, setAiPrompt] = useState("");

  const [submitTpl, setSubmitTpl] = useState<PlatformTemplateWithMeta | null>(null);
  const [submitNote, setSubmitNote] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (selectedModule) p.set("module", selectedModule);
    if (tierFilter !== "all") p.set("tier", tierFilter);
    if (tagFilter) p.set("tag", tagFilter);
    if (createdByFilter !== "all") p.set("createdBy", createdByFilter);
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    p.set("sort", sort);
    return p.toString();
  }, [selectedModule, tierFilter, tagFilter, createdByFilter, debouncedSearch, sort]);

  const templatesQuery = useQuery({
    queryKey: ["/api/templates", queryParams],
    queryFn: () => fetchTemplates(queryParams),
    staleTime: 30_000,
  });

  const countsQuery = useQuery({
    queryKey: ["/api/templates/module-counts"],
    queryFn: fetchTemplateModuleCounts,
    staleTime: 60_000,
  });

  const discoveryQuery = useQuery({
    queryKey: ["/api/templates/discovery"],
    queryFn: fetchTemplatesDiscovery,
    enabled: viewMode === "library",
    staleTime: 60_000,
  });

  const marketplaceQuery = useQuery({
    queryKey: ["/api/templates/marketplace"],
    queryFn: fetchMarketplaceTemplates,
    enabled: viewMode === "marketplace",
    staleTime: 60_000,
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/pm/projects"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/pm/projects");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: applyTpl?.module === "test_mgmt",
    staleTime: 60_000,
  });

  const templates = viewMode === "marketplace" ? (marketplaceQuery.data ?? []) : (templatesQuery.data ?? []);
  const moduleCounts = countsQuery.data ?? {};
  const discovery = discoveryQuery.data;
  const totalCount = Object.values(moduleCounts).reduce((a, b) => a + b, 0);

  const applyMut = useMutation({
    mutationFn: applyTemplate,
    onSuccess: (result) => {
      qc.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/templates") });
      setApplyTpl(null);
      toast({ title: `✓ ${result.name} created from template` });
      setTimeout(() => navigate(result.navigateUrl), 800);
    },
    onError: (e: Error) => toast({ title: "Failed to apply template", description: e.message, variant: "destructive" }),
  });

  const submitMut = useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) => submitTemplateForReview(id, note),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/templates") });
      setSubmitTpl(null);
      setSubmitNote("");
      toast({ title: "Submitted for review ✓" });
    },
    onError: (e: Error) => toast({ title: "Submit failed", description: e.message, variant: "destructive" }),
  });

  const aiMut = useMutation({
    mutationFn: generateTemplateWithAi,
    onSuccess: () => {
      qc.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/templates") });
      setShowAi(false);
      setAiPrompt("");
      toast({ title: "AI template generated — review in your library" });
    },
    onError: (e: Error) => toast({ title: "AI generation failed", description: e.message, variant: "destructive" }),
  });

  const showDiscovery = viewMode === "library" && !selectedModule && !debouncedSearch && tierFilter === "all" && !tagFilter && createdByFilter === "all";
  const isInitialLoading = viewMode === "marketplace"
    ? marketplaceQuery.isLoading && !marketplaceQuery.data
    : templatesQuery.isLoading && !templatesQuery.data;
  const hasFilters = !!(selectedModule || tierFilter !== "all" || tagFilter || createdByFilter !== "all" || debouncedSearch);

  const templateTableColumns: MondayColumnDef<PlatformTemplateWithMeta>[] = useMemo(() => [
    {
      id: "name",
      header: "Template",
      type: "text",
      accessor: "name",
      width: "240px",
      sticky: true,
      editable: false,
      render: (t) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{t.name}</div>
          <div className="text-xs text-muted-foreground truncate">{snapshotSummary(t)}</div>
        </div>
      ),
    },
    {
      id: "module",
      header: "Module",
      type: "text",
      accessor: "module",
      width: "120px",
      editable: false,
      render: (t) => {
        const color = moduleColor(t.module);
        return <Badge variant="outline" className="text-[10px]" style={{ borderColor: color, color }}>{moduleLabel(t.module)}</Badge>;
      },
    },
    {
      id: "uses",
      header: "Uses",
      type: "number",
      accessor: (t) => t.usageCount ?? 0,
      width: "70px",
      editable: false,
    },
    {
      id: "tier",
      header: "Tier",
      type: "text",
      accessor: "tier",
      width: "100px",
      editable: false,
      render: (t) => <TierBadge tier={t.tier} showCredit={t.showContributorCredit ?? false} orgName={t.contributorOrgName} />,
    },
  ], []);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (selectedModule) chips.push({ key: "module", label: moduleLabel(selectedModule), clear: () => setSelectedModule(null) });
    if (tierFilter !== "all") chips.push({ key: "tier", label: tierFilter === "system" ? "Jiganto" : "Customer", clear: () => setTierFilter("all") });
    if (tagFilter) chips.push({ key: "tag", label: tagFilter, clear: () => setTagFilter(null) });
    if (createdByFilter !== "all") chips.push({ key: "by", label: createdByFilter === "mine" ? "My templates" : "My org", clear: () => setCreatedByFilter("all") });
    if (debouncedSearch) chips.push({ key: "q", label: `"${debouncedSearch}"`, clear: () => setSearch("") });
    return chips;
  }, [selectedModule, tierFilter, tagFilter, createdByFilter, debouncedSearch]);

  const clearFilters = () => {
    setSelectedModule(null);
    setTierFilter("all");
    setTagFilter(null);
    setCreatedByFilter("all");
    setSearch("");
  };

  const openApply = (t: PlatformTemplateWithMeta) => {
    setApplyTpl(t);
    setApplyName(t.name);
    setApplyProjectId("");
  };

  const confirmApply = () => {
    if (!applyTpl) return;
    if (applyTpl.module === "test_mgmt" && !applyProjectId) {
      toast({ title: "Select a target project", variant: "destructive" });
      return;
    }
    applyMut.mutate({
      templateId: applyTpl.id,
      name: applyName.trim() || applyTpl.name,
      projectId: applyTpl.module === "test_mgmt" ? Number(applyProjectId) : undefined,
    });
  };

  const handleCreateRedirect = () => {
    const mod = TEMPLATE_MODULES.find(m => m.key === createModule);
    if (mod) {
      setShowCreate(false);
      setSaveAsTemplateMode(createModule);
      navigate(mod.createPath);
      toast({ title: "Create content in the module, then Save as Template" });
    }
  };

  const retryAll = () => {
    if (viewMode === "marketplace") marketplaceQuery.refetch();
    else {
      templatesQuery.refetch();
      countsQuery.refetch();
      discoveryQuery.refetch();
    }
  };

  const activeQueryError = viewMode === "marketplace" ? marketplaceQuery : templatesQuery;

  const headerActions = (
    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
      <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setShowAi(true)} data-testid="btn-ai-generate">
        <Sparkles className="h-4 w-4 mr-1" /> <span className="hidden xs:inline">Generate with</span> AI
      </Button>
      <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setShowCreate(true)} data-testid="btn-create-template">
        <Plus className="h-4 w-4 mr-1" /> Create
      </Button>
    </div>
  );

  return (
    <>
    <ModuleShell className={modulePageShellClass} mainClassName={modulePageMainClass}>
        <div className={modulePageBannerWrapClass}>
          <ModuleWelcomeBanner moduleKey="templates" />
        </div>
        <div className={modulePageStickyHeaderClass}>
          <ModuleHeader
            icon={TemplatesIcon}
            title="Templates"
            subtitle="Browse, apply, and manage starters across all modules"
            actions={headerActions}
          />

          <div className={modulePageTabsWrapClass}>
            <div className={cn(modulePageTabsListClass, "pb-1")}>
              <button
                type="button"
                onClick={() => setViewMode("library")}
                data-testid="tab-template-library"
                className={cn(
                  modulePageTabTriggerClass,
                  "inline-flex items-center py-1.5 font-medium transition-colors gap-1.5",
                  viewMode === "library" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutTemplate className="h-4 w-4" /> My library
              </button>
              <button
                type="button"
                onClick={() => setViewMode("marketplace")}
                data-testid="tab-template-marketplace"
                className={cn(
                  modulePageTabTriggerClass,
                  "inline-flex items-center py-1.5 font-medium transition-colors gap-1.5",
                  viewMode === "marketplace" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Store className="h-4 w-4" /> Marketplace
              </button>
            </div>
          </div>
        </div>

        <div className={modulePageContentOuterClass}>
          <div className={modulePageContentScrollClass}>
        <SubmittedTemplatesReview />

        <div className="flex flex-col lg:flex-row min-h-0 flex-1">
          <aside className="hidden lg:block w-56 xl:w-60 border-r bg-card/40 flex-shrink-0">
            <div className="p-4 border-b sticky top-0 bg-card/80 backdrop-blur-sm z-10">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Modules</p>
            </div>
            <div className="p-2 overflow-y-auto max-h-[calc(100vh-14rem)]">
              {countsQuery.isLoading ? <TemplatesNavSkeleton /> : (
                <ModuleNav
                  selectedModule={selectedModule}
                  moduleCounts={moduleCounts}
                  onSelect={setSelectedModule}
                  total={totalCount}
                />
              )}
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b px-4 sm:px-6 py-3 space-y-3">
              <div className="flex gap-2">
                <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="lg:hidden shrink-0" data-testid="mobile-module-nav">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[280px] p-0">
                    <SheetHeader className="p-4 border-b text-left">
                      <SheetTitle className="text-sm">Filter by module</SheetTitle>
                    </SheetHeader>
                    <div className="p-2">
                      <ModuleNav
                        selectedModule={selectedModule}
                        moduleCounts={moduleCounts}
                        total={totalCount}
                        onSelect={(m) => { setSelectedModule(m); setMobileNavOpen(false); }}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search templates…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                    data-testid="template-search"
                  />
                </div>
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger className="w-[130px] sm:w-[160px] shrink-0" data-testid="template-sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <Filter className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="filter-tier">
                    <SelectValue placeholder="Tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tiers</SelectItem>
                    <SelectItem value="system">Jiganto</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={tagFilter ?? "all"} onValueChange={v => setTagFilter(v === "all" ? null : v)}>
                  <SelectTrigger className="w-[130px] h-8 text-xs hidden sm:flex" data-testid="filter-tag">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {CATEGORY_TAGS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={createdByFilter} onValueChange={setCreatedByFilter}>
                  <SelectTrigger className="w-[120px] h-8 text-xs hidden md:flex" data-testid="filter-created-by">
                    <SelectValue placeholder="Created by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everyone</SelectItem>
                    <SelectItem value="mine">My templates</SelectItem>
                    <SelectItem value="org">My organisation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {activeChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  {activeChips.map(c => (
                    <Badge key={c.key} variant="secondary" className="gap-1 pr-1 text-xs">
                      {c.label}
                      <button type="button" onClick={c.clear} className="ml-0.5 rounded-full hover:bg-muted p-0.5" aria-label={`Remove ${c.label}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs px-2" data-testid="clear-filters">
                    Clear all
                  </Button>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6">
              {viewMode === "marketplace" && (
                <p className="text-sm text-muted-foreground mb-4">
                  Community-contributed and Jiganto-curated templates available to all organisations.
                </p>
              )}
              {activeQueryError.isError ? (
                <TemplatesErrorState
                  message={(activeQueryError.error as Error).message}
                  onRetry={retryAll}
                />
              ) : (
                <>
                  {showDiscovery && (
                    <>
                      <DiscoveryStrip title="Featured" icon={Star} items={discovery?.featured ?? []} loading={discoveryQuery.isLoading} onPreview={setPreviewTpl} onUse={openApply} usingId={applyMut.isPending ? applyTpl?.id : undefined} isMobile={isMobile} />
                      <DiscoveryStrip title="Recently used" icon={Clock} items={discovery?.recentlyUsed ?? []} loading={discoveryQuery.isLoading} onPreview={setPreviewTpl} onUse={openApply} usingId={applyMut.isPending ? applyTpl?.id : undefined} isMobile={isMobile} />
                      <DiscoveryStrip title="Popular in your org" icon={TrendingUp} items={discovery?.popular ?? []} loading={discoveryQuery.isLoading} onPreview={setPreviewTpl} onUse={openApply} usingId={applyMut.isPending ? applyTpl?.id : undefined} isMobile={isMobile} />
                      <DiscoveryStrip title="Recommended for you" icon={Wand2} items={discovery?.recommended ?? []} loading={discoveryQuery.isLoading} onPreview={setPreviewTpl} onUse={openApply} usingId={applyMut.isPending ? applyTpl?.id : undefined} isMobile={isMobile} />
                      <DiscoveryStrip title="New & updated" icon={Sparkles} items={discovery?.newUpdated ?? []} loading={discoveryQuery.isLoading} onPreview={setPreviewTpl} onUse={openApply} usingId={applyMut.isPending ? applyTpl?.id : undefined} isMobile={isMobile} />
                    </>
                  )}

                  <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                    <h2 className="text-sm font-semibold text-muted-foreground truncate">
                      {viewMode === "marketplace"
                        ? "Marketplace"
                        : selectedModule ? moduleLabel(selectedModule) : "All templates"}
                      <span className="ml-2 text-foreground tabular-nums">
                        ({(viewMode === "marketplace" ? marketplaceQuery.isFetching : templatesQuery.isFetching) && !isInitialLoading ? "…" : templates.length})
                      </span>
                    </h2>
                    <div className="flex items-center gap-2">
                      <div className="flex border rounded-lg overflow-hidden">
                        <Button variant={catalogLayout === "cards" ? "secondary" : "ghost"} size="sm" className="h-8 rounded-none" onClick={() => setCatalogLayout("cards")}>
                          <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Cards
                        </Button>
                        <Button variant={catalogLayout === "table" ? "secondary" : "ghost"} size="sm" className="h-8 rounded-none" onClick={() => setCatalogLayout("table")}>
                          <LayoutList className="h-3.5 w-3.5 mr-1" /> Table
                        </Button>
                      </div>
                      {(viewMode === "marketplace" ? marketplaceQuery.isFetching : templatesQuery.isFetching) && !isInitialLoading && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                      )}
                    </div>
                  </div>

                  {isInitialLoading ? (
                    hasFilters ? <TemplatesGridSkeleton count={6} /> : <TemplatesPageSkeleton />
                  ) : templates.length === 0 ? (
                    <TemplatesEmptyState filtered={hasFilters} />
                  ) : catalogLayout === "table" ? (
                    <MondayBoardProvider storageKey="jiganto-templates-catalog">
                    <div className="space-y-2">
                      <div className="flex justify-end">
                        <MondayBoardChromeControls />
                      </div>
                    <MondayBoardTable
                      columns={templateTableColumns}
                      data={templates}
                      gridLines
                      emptyMessage="No templates match your filters."
                      onRowClick={(t) => setPreviewTpl(t)}
                      searchHighlightTerm={debouncedSearch}
                      paginationResetKey={`${debouncedSearch}-${selectedModule}-${tierFilter}-${viewMode}`}
                      renderRowActions={(t) => (
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setPreviewTpl(t); }}>Preview</Button>
                          <Button size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); openApply(t); }} disabled={applyMut.isPending && applyTpl?.id === t.id}>Use</Button>
                        </div>
                      )}
                      alwaysShowRowActions
                    />
                    </div>
                    </MondayBoardProvider>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="template-grid">
                      {templates.map(t => (
                        <TemplateCard
                          key={t.id}
                          template={t}
                          onPreview={() => setPreviewTpl(t)}
                          onUse={() => openApply(t)}
                          using={applyMut.isPending && applyTpl?.id === t.id}
                          isMobile={isMobile}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
          </div>
        </div>
    </ModuleShell>

      <FormDialogViewShell
        open={!!previewTpl}
        onOpenChange={() => setPreviewTpl(null)}
        title={previewTpl?.name ?? "Template preview"}
        subtitle={previewTpl ? `${moduleLabel(previewTpl.module)} · v${previewTpl.version} · ${previewTpl.usageCount ?? 0} uses` : undefined}
        onClose={() => setPreviewTpl(null)}
        size="lg"
        testId="template-preview-dialog"
        footer={
          previewTpl ? (
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              {previewTpl.tier === "customer" && (
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setSubmitTpl(previewTpl); setPreviewTpl(null); }}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Submit to Jiganto
                </Button>
              )}
              <Button className="w-full sm:w-auto" onClick={() => { openApply(previewTpl); setPreviewTpl(null); }}>
                Use this template <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          ) : null
        }
      >
        {previewTpl && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{previewTpl.description || snapshotSummary(previewTpl)}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" style={{ borderColor: moduleColor(previewTpl.module), color: moduleColor(previewTpl.module) }}>
                {moduleLabel(previewTpl.module)}
              </Badge>
              {(previewTpl.categoryTags ?? []).map(tag => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <p className="font-medium text-xs text-muted-foreground mb-1">What&apos;s included</p>
              <p>{snapshotSummary(previewTpl)}</p>
              {previewTpl.creatorName && (
                <p className="text-xs text-muted-foreground mt-2">Created by {previewTpl.creatorName}</p>
              )}
            </div>
          </div>
        )}
      </FormDialogViewShell>

      <FormDialogShell
        open={!!applyTpl}
        onOpenChange={() => setApplyTpl(null)}
        title="Use template"
        subtitle={applyTpl ? `Create a new ${moduleLabel(applyTpl.module).toLowerCase()} from this template` : undefined}
        saveLabel="Create"
        onCancel={() => setApplyTpl(null)}
        onSubmit={confirmApply}
        saving={applyMut.isPending}
        disabled={!applyName.trim()}
        size="sm"
        testId="template-apply-dialog"
        saveTestId="confirm-apply"
      >
        {applyTpl && (
          <>
            <div className="rounded-lg border p-3 text-sm bg-muted/30 mb-4">
              <p className="font-medium">{applyTpl.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{snapshotSummary(applyTpl)}</p>
            </div>
            <FormSection icon={<LayoutTemplate className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />} iconClassName="bg-blue-50 dark:bg-blue-950/40" title="New item">
              <div className="space-y-1.5 mb-3.5">
                <FieldLabel required>Name</FieldLabel>
                <Input id="apply-name" value={applyName} onChange={e => setApplyName(e.target.value)} data-testid="apply-name-input" />
              </div>
              {applyTpl.module === "project" && (
                <p className="text-xs text-muted-foreground rounded-md bg-muted/50 p-2">
                  Tools and workstreams from the template will be pre-configured.
                </p>
              )}
              {applyTpl.module === "test_mgmt" && (
                <div className="space-y-1.5">
                  <FieldLabel>Target project</FieldLabel>
                  {projectsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading projects…
                    </div>
                  ) : (
                    <Select value={applyProjectId} onValueChange={setApplyProjectId}>
                      <SelectTrigger data-testid="apply-project-select">
                        <SelectValue placeholder="Select project…" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </FormSection>
          </>
        )}
      </FormDialogShell>

      <FormDialogShell
        open={showCreate}
        onOpenChange={setShowCreate}
        title="Create template"
        subtitle="Templates are usually saved from the source module. Pick a module to get started."
        saveLabel="Go to module"
        onCancel={() => setShowCreate(false)}
        onSubmit={handleCreateRedirect}
        disabled={!createModule}
        size="sm"
        testId="create-template-dialog"
        saveTestId="create-template-go"
      >
        <FormSection icon={<Plus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />} iconClassName="bg-blue-50 dark:bg-blue-950/40" title="Module type">
          <div className="space-y-1.5">
            <FieldLabel required>Module type</FieldLabel>
            <Select value={createModule || undefined} onValueChange={setCreateModule}>
              <SelectTrigger data-testid="create-module-select">
                <SelectValue placeholder="Select module…" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_MODULES.map(m => (
                  <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormSection>
      </FormDialogShell>

      <FormDialogShell
        open={showAi}
        onOpenChange={setShowAi}
        title="Generate with AI"
        subtitle="Describe your template in plain English. Uses your AI token balance."
        saveLabel="Generate"
        onCancel={() => setShowAi(false)}
        onSubmit={() => aiMut.mutate({ module: aiModule, prompt: aiPrompt })}
        saving={aiMut.isPending}
        disabled={!aiPrompt.trim()}
        size="sm"
        testId="ai-generate-dialog"
        saveTestId="ai-generate-submit"
      >
        <FormSection icon={<Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />} iconClassName="bg-violet-50 dark:bg-violet-950/40" title="AI generation">
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel>Module</FieldLabel>
            <Select value={aiModule} onValueChange={setAiModule}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AI_GENERATE_MODULES.map(m => (
                  <SelectItem key={m} value={m}>{moduleLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FieldLabel required>Describe your template</FieldLabel>
            <Textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="e.g. SAP FI end-to-end test scenario hierarchy for a greenfield implementation…"
              rows={4}
              data-testid="ai-prompt-input"
            />
          </div>
        </FormSection>
      </FormDialogShell>

      <FormDialogShell
        open={!!submitTpl}
        onOpenChange={() => setSubmitTpl(null)}
        title="Submit to Jiganto"
        subtitle="Share with all customers if approved (typically 2–4 weeks review)."
        saveLabel="Submit for review"
        onCancel={() => setSubmitTpl(null)}
        onSubmit={() => submitTpl && submitMut.mutate({ id: submitTpl.id, note: submitNote })}
        saving={submitMut.isPending}
        size="sm"
        testId="submit-template-dialog"
      >
        <FormSection icon={<Send className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />} iconClassName="bg-blue-50 dark:bg-blue-950/40" title="Review note">
          <div className="space-y-1.5">
            <FieldLabel>Optional note for reviewers</FieldLabel>
            <Textarea
              value={submitNote}
              onChange={e => setSubmitNote(e.target.value)}
              placeholder="Optional note for reviewers…"
              rows={3}
            />
          </div>
        </FormSection>
      </FormDialogShell>
    </>
  );
}
