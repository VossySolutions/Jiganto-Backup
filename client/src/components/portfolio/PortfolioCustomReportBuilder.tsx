import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Download, Play, Plus, Trash2, Save } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type CustomReportConfig = {
  fields: string[];
  filters?: Record<string, string>;
  groupBy?: string | null;
  sortBy?: { field: string; direction: "asc" | "desc" };
};

type SavedReport = {
  id: number;
  name: string;
  description: string | null;
  dataSource: string;
  config: CustomReportConfig;
};

type RunResult = {
  fields: string[];
  totalRows: number;
  rows: Record<string, unknown>[];
  groups: { key: string; rows: Record<string, unknown>[] }[];
  generatedAt: string;
};

const DATA_SOURCES = [
  { id: "projects", label: "Projects" },
  { id: "milestones", label: "Milestones" },
  { id: "raid", label: "RAID" },
] as const;

const emptyConfig = (): CustomReportConfig => ({ fields: [], filters: {}, groupBy: null });

export function PortfolioCustomReportBuilder() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dataSource, setDataSource] = useState<string>("projects");
  const [config, setConfig] = useState<CustomReportConfig>(emptyConfig());
  const [filterField, setFilterField] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  const { data: saved = [], isLoading } = useQuery<SavedReport[]>({
    queryKey: ["/api/portfolio/custom-reports"],
  });

  const { data: availableFields = [] } = useQuery<string[]>({
    queryKey: [`/api/portfolio/custom-reports/fields/${dataSource}`],
  });

  const selectedFields = useMemo(() => {
    if (config.fields.length) return config.fields;
    return availableFields;
  }, [config.fields, availableFields]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setDataSource("projects");
    setConfig(emptyConfig());
    setRunResult(null);
  };

  const loadReport = (r: SavedReport) => {
    setEditingId(r.id);
    setName(r.name);
    setDescription(r.description || "");
    setDataSource(r.dataSource);
    setConfig(r.config || emptyConfig());
    setRunResult(null);
  };

  const toggleField = (field: string) => {
    setConfig((c) => {
      const base = c.fields.length ? c.fields : [...availableFields];
      const next = base.includes(field) ? base.filter((f) => f !== field) : [...base, field];
      return { ...c, fields: next };
    });
  };

  const addFilter = () => {
    if (!filterField || !filterValue) return;
    setConfig((c) => ({
      ...c,
      filters: { ...c.filters, [filterField]: filterValue },
    }));
    setFilterField("");
    setFilterValue("");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description: description || null,
        dataSource,
        config: { ...config, fields: selectedFields },
      };
      if (editingId) {
        return apiRequest("PUT", `/api/portfolio/custom-reports/${editingId}`, payload);
      }
      return apiRequest("POST", "/api/portfolio/custom-reports", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/custom-reports"] });
      toast({ title: editingId ? "Report updated" : "Report saved" });
    },
    onError: () => toast({ title: "Failed to save report", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/portfolio/custom-reports/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/custom-reports"] });
      resetForm();
      toast({ title: "Report deleted" });
    },
  });

  const runReport = async () => {
    try {
      const payload = { dataSource, config: { ...config, fields: selectedFields } };
      const res = await apiRequest("POST", "/api/portfolio/custom-reports/run", payload);
      const result = (await res.json()) as RunResult;
      setRunResult(result);
      toast({ title: `Report generated — ${result.totalRows} rows` });
    } catch {
      toast({ title: "Failed to run report", variant: "destructive" });
    }
  };

  const exportCsv = () => {
    if (!runResult?.rows.length) return;
    const header = runResult.fields.join(",");
    const body = runResult.rows.map((row) =>
      runResult.fields.map((f) => String(row[f] ?? "").replace(/,/g, ";")).join(","),
    ).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name || "custom-report"}.csv`;
    a.click();
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_1fr] lg:grid-cols-[280px_1fr]">
      <Card className="border-border/30 h-fit">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold">Saved Reports</CardTitle>
          <Button variant="ghost" size="sm" onClick={resetForm}><Plus className="h-3.5 w-3.5" /></Button>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-1">
          {saved.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => loadReport(r)}
              className={`w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-muted/50 ${editingId === r.id ? "bg-primary/10" : ""}`}
            >
              <div className="font-medium truncate">{r.name}</div>
              <div className="text-[10px] text-muted-foreground capitalize">{r.dataSource}</div>
            </button>
          ))}
          {!saved.length && <p className="text-xs text-muted-foreground">No saved reports yet</p>}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-border/30">
          <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-bold">Custom Report Builder</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Report name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. At-risk projects by portfolio" className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Data source</label>
                <select
                  value={dataSource}
                  onChange={(e) => { setDataSource(e.target.value); setConfig(emptyConfig()); }}
                  className="mt-1 w-full text-sm border rounded-lg px-2 py-2 bg-background"
                >
                  {DATA_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 min-h-[60px] text-sm" />
            </div>

            <div>
              <p className="text-xs font-medium mb-2">Fields</p>
              <div className="flex flex-wrap gap-1.5">
                {availableFields.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleField(f)}
                    className={`text-xs px-2 py-1 rounded-full border ${selectedFields.includes(f) ? "bg-primary/10 border-primary/30" : "opacity-50"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <select value={config.groupBy || ""} onChange={(e) => setConfig((c) => ({ ...c, groupBy: e.target.value || null }))} className="text-sm border rounded-lg px-2 py-1.5 bg-background">
                <option value="">No grouping</option>
                {selectedFields.map((f) => <option key={f} value={f}>Group by {f}</option>)}
              </select>
              <select
                value={config.sortBy?.field || ""}
                onChange={(e) => setConfig((c) => ({ ...c, sortBy: e.target.value ? { field: e.target.value, direction: c.sortBy?.direction || "asc" } : undefined }))}
                className="text-sm border rounded-lg px-2 py-1.5 bg-background"
              >
                <option value="">No sort</option>
                {selectedFields.map((f) => <option key={f} value={f}>Sort by {f}</option>)}
              </select>
              <select
                value={config.sortBy?.direction || "asc"}
                onChange={(e) => setConfig((c) => ({ ...c, sortBy: c.sortBy ? { ...c.sortBy, direction: e.target.value as "asc" | "desc" } : undefined }))}
                className="text-sm border rounded-lg px-2 py-1.5 bg-background"
                disabled={!config.sortBy?.field}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-2 items-end">
              <select value={filterField} onChange={(e) => setFilterField(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5 bg-background">
                <option value="">Filter field…</option>
                {selectedFields.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <Input value={filterValue} onChange={(e) => setFilterValue(e.target.value)} placeholder="Contains…" className="w-40" />
              <Button variant="outline" size="sm" onClick={addFilter}>Add filter</Button>
            </div>
            {config.filters && Object.keys(config.filters).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {Object.entries(config.filters).map(([k, v]) => (
                  <span key={k} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                    {k}: {v}
                    <button type="button" className="ml-1 text-muted-foreground" onClick={() => setConfig((c) => {
                      const next = { ...c.filters };
                      delete next[k];
                      return { ...c, filters: next };
                    })}>×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={runReport} disabled={!selectedFields.length}>
                <Play className="h-3.5 w-3.5 mr-1" /> Run report
              </Button>
              <Button size="sm" variant="outline" onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending}>
                <Save className="h-3.5 w-3.5 mr-1" /> {editingId ? "Update" : "Save"}
              </Button>
              {editingId && (
                <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(editingId)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {runResult && (
          <Card className="border-border/30">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Results — {runResult.totalRows} rows</CardTitle>
              <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-1" /> Export CSV</Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {runResult.groups.map((g) => (
                <div key={g.key} className="border-b border-border/20 last:border-0">
                  {runResult.groups.length > 1 && (
                    <div className="px-4 py-2 text-xs font-bold bg-muted/30">{g.key} ({g.rows.length})</div>
                  )}
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b bg-muted/20">
                        {runResult.fields.map((f) => <th key={f} className="p-2">{f}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.slice(0, 100).map((row, i) => (
                        <tr key={i} className="border-b border-border/10">
                          {runResult.fields.map((f) => <td key={f} className="p-2">{String(row[f] ?? "—")}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
