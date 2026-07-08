import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ExternalLink, Sparkles, FileDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Report360Data } from "./types";
import { formatBudget } from "./rag-utils";
import { RAG_DOT } from "./rag-utils";
import type { RagLevel } from "./types";
import { cn } from "@/lib/utils";

export function Portfolio360ReportView({ projectId, onClose }: { projectId: number; onClose?: () => void }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<Report360Data>({
    queryKey: [`/api/portfolio/reports/360/${projectId}`],
    staleTime: 30_000,
  });
  const [narrative, setNarrative] = useState("");

  useEffect(() => {
    if (data?.executiveSummary?.narrative) setNarrative(data.executiveSummary.narrative);
  }, [data?.executiveSummary?.narrative]);

  const saveSnapshot = async () => {
    try {
      await apiRequest("POST", `/api/portfolio/reports/360/${projectId}`, { narrative });
      toast({ title: "Report snapshot saved" });
    } catch {
      toast({ title: "Failed to save report", variant: "destructive" });
    }
  };

  const exportPptx = async () => {
    try {
      const params = new URLSearchParams();
      if (narrative) params.set("narrative", narrative);
      const res = await fetch(`/api/portfolio/reports/360/${projectId}/pptx?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const safeName = (data?.executiveSummary.projectName || "report").replace(/[^a-z0-9]/gi, "_");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${safeName}_360_report.pptx`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "PowerPoint exported" });
    } catch {
      toast({ title: "PowerPoint export failed", variant: "destructive" });
    }
  };

  if (isLoading || !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const { executiveSummary: ex, raidSummary: raid, healthDashboard: health } = data;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto print:max-w-none px-0 sm:px-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden sticky top-0 z-10 bg-background/95 backdrop-blur py-2 -mx-1 px-1 sm:static sm:bg-transparent sm:backdrop-blur-none">
        <h2 className="text-base sm:text-lg font-bold leading-tight">360° Report — {ex.projectName}</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>PDF</Button>
          <Button variant="outline" size="sm" onClick={exportPptx}><FileDown className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Export </span>PPTX</Button>
          <Button variant="outline" size="sm" onClick={saveSnapshot}>Save</Button>
          {onClose && <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>}
        </div>
      </div>

      <Card className="border-border/30">
        <CardHeader><CardTitle className="text-base">1. Executive Summary</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <p><strong>Client:</strong> {ex.client || "—"}</p>
            <p><strong>PM:</strong> {ex.pm || "—"}</p>
            <p><strong>Overall RAG:</strong> <Badge>{ex.overallRag}</Badge></p>
            <p><strong>Dates:</strong> {ex.startDate} → {ex.plannedEnd} (revised: {ex.revisedEnd})</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              {ex.narrativeSource === "ai" ? "AI-drafted — edit before export" : ex.narrativeSource === "manual" ? "Edited narrative" : "Status narrative"}
            </div>
            <Textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              className="min-h-[100px] text-sm leading-relaxed"
              placeholder="Executive status narrative..."
            />
          </div>
        </CardContent>
      </Card>

      {health && (
        <Card className="border-border/30">
          <CardHeader><CardTitle className="text-base">2. Health Dashboard</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
              {(["overall", "schedule", "budget", "quality", "delivery", "risk", "resources", "stakeholders"] as const).map((dim) => (
                <div key={dim} className="text-center">
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">{dim}</p>
                  <div className={cn("h-4 w-4 rounded-full mx-auto", RAG_DOT[health[dim] as RagLevel])} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/30">
        <CardHeader><CardTitle className="text-base">3. Level 1 Plan</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.level1Plan.map((ph, i) => (
            <div key={i} className="flex items-center gap-3 text-sm border-b border-border/20 pb-2">
              <div className="flex-1 font-medium">{ph.name}</div>
              <Badge variant="outline">{ph.rag}</Badge>
              <span className="font-mono text-xs">{ph.progress}%</span>
              <span className="text-xs text-muted-foreground">{ph.plannedStart} → {ph.plannedEnd}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/30">
        <CardHeader><CardTitle className="text-base">4. Milestones</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm text-gray-700 dark:text-foreground">
            <thead><tr className="text-left text-xs text-gray-700 dark:text-foreground bg-gray-100 dark:bg-muted/80 border-b border-border/60"><th className="pb-2 font-semibold">Name</th><th className="font-semibold">Target</th><th className="font-semibold">RAG</th><th className="font-semibold">Status</th></tr></thead>
            <tbody>
              {data.milestones.map((m, i) => (
                <tr key={i} className={cn("border-b border-border/20", m.overdue && "text-red-600")}>
                  <td className="py-2">{m.name}</td>
                  <td className="font-mono text-xs">{m.targetDate}</td>
                  <td>{m.rag}</td>
                  <td>{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-border/30">
        <CardHeader><CardTitle className="text-base">5. Workstream Updates</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {data.workstreamUpdates.map((w, i) => (
            <div key={i} className="p-3 rounded-lg border border-border/30">
              <p className="font-semibold text-sm">{w.name}</p>
              <p className="text-xs text-muted-foreground">{w.owner} · {w.progress}% · RAG {w.rag}</p>
              <p className="text-xs mt-1">{w.note || "No update"}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/30">
        <CardHeader><CardTitle className="text-base">6. RAID Summary</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-sm font-bold mb-2">Top 5 Risks (Open, by severity)</h4>
            <table className="w-full text-xs text-gray-700 dark:text-foreground">
              <thead><tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground"><th className="text-left p-1 font-semibold">Ref</th><th className="font-semibold">Description</th><th className="font-semibold">Owner</th><th className="font-semibold">Severity</th><th className="font-semibold">Mitigation</th></tr></thead>
              <tbody>{raid.topRisks.map((r, i) => (
                <tr key={i} className="border-t border-border/20"><td className="p-1">{r.ref}</td><td>{r.description}</td><td>{r.owner}</td><td>{r.severity}</td><td>{r.mitigation}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <div>
            <h4 className="text-sm font-bold mb-2">Top 5 Issues (Open, by priority)</h4>
            <table className="w-full text-xs text-gray-700 dark:text-foreground">
              <thead><tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground"><th className="text-left p-1 font-semibold">Ref</th><th className="font-semibold">Description</th><th className="font-semibold">Owner</th><th className="font-semibold">Priority</th><th className="font-semibold">Target</th></tr></thead>
              <tbody>{raid.topIssues.map((r, i) => (
                <tr key={i} className="border-t border-border/20"><td className="p-1">{r.ref}</td><td>{r.description}</td><td>{r.owner}</td><td>{r.priority}</td><td>{r.targetResolution}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <div>
            <h4 className="text-sm font-bold mb-2">Open Assumptions</h4>
            <table className="w-full text-xs text-gray-700 dark:text-foreground">
              <thead><tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground"><th className="text-left p-1 font-semibold">Ref</th><th className="font-semibold">Assumption</th><th className="font-semibold">Owner</th><th className="font-semibold">Validation</th></tr></thead>
              <tbody>{raid.openAssumptions.map((r, i) => (
                <tr key={i} className="border-t border-border/20"><td className="p-1">{r.ref}</td><td>{r.assumption}</td><td>{r.owner}</td><td>{r.validationDate}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <div>
            <h4 className="text-sm font-bold mb-2">Open Dependencies</h4>
            <table className="w-full text-xs text-gray-700 dark:text-foreground">
              <thead><tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground"><th className="text-left p-1 font-semibold">Ref</th><th className="font-semibold">Description</th><th className="font-semibold">Direction</th><th className="font-semibold">Required by</th><th className="font-semibold">Status</th></tr></thead>
              <tbody>{raid.openDependencies.map((r, i) => (
                <tr key={i} className="border-t border-border/20"><td className="p-1">{r.ref}</td><td>{r.description}</td><td>{r.direction}</td><td>{r.requiredBy}</td><td>{r.status}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <Button variant="ghost" className="p-0 h-auto text-sm text-primary hover:text-primary" onClick={() => setLocation(`/modules/projects/${projectId}`)}>
            View full RAID logs <ExternalLink className="h-3.5 w-3.5 ml-1" />
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/30">
        <CardHeader><CardTitle className="text-base">7–10. Deliverables, Next Phase, Finance, Resources</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p><strong>Next phase:</strong> {data.nextPhasePreview}</p>
          <p><strong>Financial:</strong> Budget {formatBudget(data.financialSummary.budget)} · Spent {formatBudget(data.financialSummary.spent)} · Remaining {formatBudget(data.financialSummary.remaining)}</p>
          <div>
            <strong>Key resources:</strong>
            <ul className="mt-1 space-y-1">{data.resourceSummary.map((r, i) => (
              <li key={i}>{r.name} — {r.role} ({r.allocation}%)</li>
            ))}</ul>
          </div>
          <div>
            <strong>Deliverables (30d):</strong>
            <ul className="mt-1">{data.deliverablesTracker.map((d, i) => (
              <li key={i}>{d.name} — due {d.dueDate} — {d.status}</li>
            ))}</ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
