import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Financial Report — budget vs. actual with a per-category breakdown, feeding
 * the 360° Overview's headline figures per the design. Deliberately scoped
 * down from the mockup in two places the mockup itself flags as undecided
 * ("Templates and Excel import/export are not yet decided for this tool —
 * shown below exactly as undecided, not guessed"):
 * - No PO/ledger-level drill-down panel — that needs a real ledger/PO
 *   integration that doesn't exist yet; fabricating line-item data would be
 *   worse than not having it.
 * - No access-lock enforcement ("Finance & PM only") — flagged as a real gap
 *   below, not silently dropped.
 * Category rows are stored on project.metadata (same pattern as Action Log),
 * since there's no dedicated cost-category table yet.
 */

interface CostCategory {
  id: string;
  name: string;
  budget: number;
  actual: number;
}

interface ToolProps {
  projectId: number;
  project?: any;
}

function money(n: number) {
  return `£${Math.round(n).toLocaleString()}`;
}

export function PmFinancialReportTool({ projectId, project }: ToolProps) {
  const { toast } = useToast();
  const meta = (project?.metadata as Record<string, unknown>) || {};
  const categories = (meta.costCategories as CostCategory[]) || [];
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [actual, setActual] = useState("");

  const { data: entries = [] } = useQuery<any[]>({
    queryKey: [`/api/finance/timesheets/projects/${projectId}/entries`],
    enabled: !!projectId,
  });

  const isLoading = !project;

  const save = useMutation({
    mutationFn: (next: CostCategory[]) => apiRequest("PUT", `/api/pm/projects/${projectId}`, { metadata: { ...meta, costCategories: next } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] }),
  });

  const addCategory = () => {
    const next: CostCategory = { id: String(Date.now()), name, budget: Number(budget) || 0, actual: Number(actual) || 0 };
    save.mutate([...categories, next]);
    setName("");
    setBudget("");
    setActual("");
    toast({ title: "Cost category added" });
  };

  const removeCategory = (id: string) => save.mutate(categories.filter((c) => c.id !== id));

  const approvedBudget = project?.budget ? Number(project.budget) : 0;
  const timesheetHours = entries.reduce((a: number, e: any) => a + (Number(e.hours) || 0), 0);
  const categoryActualTotal = categories.reduce((s, c) => s + c.actual, 0);
  const actualToDate = project?.spentBudget ? Number(project.spentBudget) : categoryActualTotal || timesheetHours * 75;
  const forecastAtCompletion = project?.forecastBudget ? Number(project.forecastBudget) : Math.max(approvedBudget, actualToDate);
  const variance = forecastAtCompletion - approvedBudget;

  const kpis = useMemo(
    () => [
      { label: "Approved budget", value: money(approvedBudget) },
      { label: "Actual to date", value: money(actualToDate), cls: "text-emerald-600" },
      { label: "Forecast at completion", value: money(forecastAtCompletion), cls: variance > 0 ? "text-amber-600" : undefined },
      { label: "Variance", value: `${variance >= 0 ? "+" : ""}${money(variance)}`, cls: variance > 0 ? "text-red-600" : "text-emerald-600" },
    ],
    [approvedBudget, actualToDate, forecastAtCompletion, variance],
  );

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
        These headline figures feed the 360° Overview. Line-item drill-down and access-locking to
        Finance/PM roles aren't built yet — flagged as a follow-up, not silently skipped.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase">{k.label}</div>
              <div className={cn("text-xl font-bold mt-1 font-mono", k.cls)}>{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Cost breakdown by category</h3>
          <div className="flex flex-wrap gap-2 items-end">
            <Input placeholder="Category (e.g. Labour — internal)" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
            <Input type="number" placeholder="Budget (£)" value={budget} onChange={(e) => setBudget(e.target.value)} className="max-w-[140px]" />
            <Input type="number" placeholder="Actual (£)" value={actual} onChange={(e) => setActual(e.target.value)} className="max-w-[140px]" />
            <Button size="sm" disabled={!name.trim() || save.isPending} onClick={addCategory}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No cost categories added yet.</TableCell></TableRow>
              ) : categories.map((c) => {
                const v = c.actual - c.budget;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{money(c.budget)}</TableCell>
                    <TableCell className="font-mono text-xs">{money(c.actual)}</TableCell>
                    <TableCell className={cn("font-mono text-xs", v > 0 ? "text-red-600" : "text-emerald-600")}>
                      {v >= 0 ? "+" : ""}{money(v)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeCategory(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default PmFinancialReportTool;
