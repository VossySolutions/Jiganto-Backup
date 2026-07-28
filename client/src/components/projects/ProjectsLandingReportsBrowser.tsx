import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Search,
} from "lucide-react";

const Portfolio360ReportView = lazy(() =>
  import("@/components/portfolio/Portfolio360ReportView").then((m) => ({
    default: m.Portfolio360ReportView,
  })),
);
const PmWeeklyStatusReport = lazy(() =>
  import("@/components/projects/PmWeeklyStatusReport").then((m) => ({
    default: m.PmWeeklyStatusReport,
  })),
);

export type LandingReportKind = "360" | "status";

export type ReportBrowserProject = {
  id: number;
  name: string;
  code?: string | null;
  status?: string | null;
  customer?: string | null;
  progress?: number | null;
  ragStatus?: string | null;
  financialRag?: string | null;
  scheduleRag?: string | null;
  projectManager?: string | null;
  deliveryOwner?: string | null;
  leadName?: string | null;
  metadata?: { leadName?: string } | null;
};

type Props = {
  kind: LandingReportKind;
  projects: ReportBrowserProject[];
  /** Pre-select a project (e.g. from URL `?projectId=`). */
  initialProjectId?: number | null;
  onProjectChange?: (projectId: number | null) => void;
};

function leadOf(p: ReportBrowserProject) {
  return (
    p.leadName ||
    p.metadata?.leadName ||
    p.projectManager ||
    p.deliveryOwner ||
    ""
  );
}

function ragDot(rag?: string | null) {
  const v = (rag || "").toLowerCase();
  if (v === "red" || v === "r") return "bg-red-500";
  if (v === "amber" || v === "a" || v === "yellow") return "bg-amber-500";
  if (v === "green" || v === "g") return "bg-emerald-500";
  return "bg-slate-400";
}

function worstRag(p: ReportBrowserProject) {
  const rags = [p.financialRag, p.scheduleRag, p.ragStatus].map((x) => (x || "").toLowerCase());
  if (rags.some((r) => r === "red" || r === "r")) return "red";
  if (rags.some((r) => r === "amber" || r === "a" || r === "yellow")) return "amber";
  if (rags.some((r) => r === "green" || r === "g")) return "green";
  return null;
}

const COPY: Record<
  LandingReportKind,
  { title: string; subtitle: string; openLabel: string; empty: string }
> = {
  "360": {
    title: "360° Project Reports",
    subtitle:
      "Browse full project health reports across the portfolio — without opening each project workspace.",
    openLabel: "Open 360° report",
    empty: "No projects yet. Create a work item first, then open its 360° report here.",
  },
  status: {
    title: "Status Reports",
    subtitle:
      "Browse weekly / steering status reports across projects — for leadership audiences, separate from day-to-day delivery tools.",
    openLabel: "Open status report",
    empty: "No projects yet. Create a work item first, then open its status report here.",
  },
};

export function ProjectsLandingReportsBrowser({
  kind,
  projects,
  initialProjectId = null,
  onProjectChange,
}: Props) {
  const copy = COPY[kind];
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(initialProjectId);

  useEffect(() => {
    if (initialProjectId != null && initialProjectId !== selectedId) {
      setSelectedId(initialProjectId);
    }
    // Only sync when URL/parent initial id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId]);

  const selectProject = (id: number | null) => {
    setSelectedId(id);
    onProjectChange?.(id);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...projects].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (!q) return list;
    return list.filter((p) => {
      const hay = `${p.name || ""} ${p.code || ""} ${p.customer || ""} ${leadOf(p)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [projects, query]);

  const selectedIndex = useMemo(
    () => filtered.findIndex((p) => p.id === selectedId),
    [filtered, selectedId],
  );
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : projects.find((p) => p.id === selectedId) ?? null;

  const { data: fullProject, isLoading: loadingProject } = useQuery<any>({
    queryKey: ["/api/pm/projects", selectedId],
    enabled: kind === "status" && !!selectedId,
  });

  const goPrev = () => {
    if (selectedIndex <= 0) return;
    selectProject(filtered[selectedIndex - 1].id);
  };
  const goNext = () => {
    if (selectedIndex < 0 || selectedIndex >= filtered.length - 1) return;
    selectProject(filtered[selectedIndex + 1].id);
  };

  if (selectedId && selected) {
    return (
      <div className="space-y-3" data-testid={`landing-report-${kind}-view`}>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/40 bg-card px-3 py-2.5 shadow-sm">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1 shrink-0"
            onClick={() => selectProject(null)}
            data-testid="landing-report-back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All projects
          </Button>
          <div className="h-5 w-px bg-border shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate text-foreground">{selected.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {selected.code || `PRJ-${selected.id}`}
              {selected.customer ? ` · ${selected.customer}` : ""}
              {leadOf(selected) ? ` · ${leadOf(selected)}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={selectedIndex <= 0}
              onClick={goPrev}
              title="Previous project"
              data-testid="landing-report-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[11px] font-semibold text-muted-foreground tabular-nums min-w-[4.5rem] text-center">
              {selectedIndex >= 0 ? `${selectedIndex + 1} / ${filtered.length}` : "—"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={selectedIndex < 0 || selectedIndex >= filtered.length - 1}
              onClick={goNext}
              title="Next project"
              data-testid="landing-report-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <select
            className="h-8 max-w-[220px] rounded-md border border-border bg-background px-2 text-xs font-semibold"
            value={selectedId}
            onChange={(e) => selectProject(Number(e.target.value))}
            data-testid="landing-report-project-select"
          >
            {filtered.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          }
        >
          {kind === "360" ? (
            <Portfolio360ReportView projectId={selectedId} onClose={() => selectProject(null)} />
          ) : loadingProject && !fullProject ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <PmWeeklyStatusReport
              projectId={selectedId}
              project={fullProject || selected}
              onClose={() => selectProject(null)}
            />
          )}
        </Suspense>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid={`landing-report-${kind}-list`}>
      <div className="rounded-xl border border-border/40 bg-card p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <h2 className="text-sm font-extrabold text-foreground">{copy.title}</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{copy.subtitle}</p>
          </div>
          <div className="relative w-full sm:w-[260px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="h-8 pl-8 text-xs"
              data-testid="landing-report-search"
            />
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {copy.empty}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No projects match “{query}”.
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 bg-card overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_100px_120px_100px_110px_140px] gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground border-b border-border/40 bg-muted/30">
            <div>Project</div>
            <div>Status</div>
            <div>Customer</div>
            <div>Progress</div>
            <div>Health</div>
            <div className="text-right">Report</div>
          </div>
          <ul className="divide-y divide-border/40">
            {filtered.map((p) => {
              const health = worstRag(p);
              return (
                <li
                  key={p.id}
                  className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_100px_120px_100px_110px_140px] gap-2 items-center px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", ragDot(health))} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">
                        {p.code || `PRJ-${p.id}`}
                        {leadOf(p) ? ` · ${leadOf(p)}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {(p.status || "draft").replace(/_/g, " ")}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.customer || "—"}</div>
                  <div className="text-xs font-semibold tabular-nums">{p.progress ?? 0}%</div>
                  <div className="flex items-center gap-1">
                    <span className={cn("h-1.5 w-1.5 rounded-full", ragDot(p.financialRag))} title="Budget" />
                    <span className={cn("h-1.5 w-1.5 rounded-full", ragDot(p.scheduleRag))} title="Schedule" />
                    <span className={cn("h-1.5 w-1.5 rounded-full", ragDot(p.ragStatus))} title="Scope" />
                    <span className="text-[10px] text-muted-foreground ml-1 capitalize">{health || "—"}</span>
                  </div>
                  <div className="flex justify-start md:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/10"
                      onClick={() => selectProject(p.id)}
                      data-testid={`landing-report-open-${kind}-${p.id}`}
                    >
                      Open
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
