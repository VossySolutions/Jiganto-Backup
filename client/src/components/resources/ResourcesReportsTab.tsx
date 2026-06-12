import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Activity, BarChart3, Clock, Plug } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResourcesTabLoading, ResourcesErrorState } from "./ResourcesUi";
import type { Resource, ResourceAllocation } from "@shared/models/resources";

type Props = {
  resources: Resource[];
  allocations: ResourceAllocation[];
};

export function ResourcesReportsTab({ resources, allocations }: Props) {
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportFormat, setExportFormat] = useState<"standard" | "summary">("standard");
  const [integrationName, setIntegrationName] = useState("");
  const [integrationUrl, setIntegrationUrl] = useState("");

  const { data: utilisation, isLoading: utilLoading, isError: utilError, refetch: refetchUtil } = useQuery({
    queryKey: ["/api/finance/timesheets/reports/utilisation"],
  });

  const { data: missing = [], isLoading: missingLoading } = useQuery<Array<{ resourceId: number; name: string }>>({
    queryKey: ["/api/finance/timesheets/reports/missing"],
  });

  const { data: integrations = [], isLoading: intLoading } = useQuery({
    queryKey: ["/api/resources/timesheets/integrations"],
  });

  const { data: integrationLog = [], isLoading: logLoading } = useQuery({
    queryKey: ["/api/resources/timesheets/integration-log"],
  });
  const activeAllocations = allocations.filter((a) => a.status === "active");
  const utilMap: Record<number, number> = {};
  activeAllocations.forEach((a) => {
    utilMap[a.resourceId] = (utilMap[a.resourceId] || 0) + (Number(a.allocationPercentage) || 0);
  });

  const exportTimesheets = () => {
    const params = new URLSearchParams();
    if (exportFrom) params.set("from", exportFrom);
    if (exportTo) params.set("to", exportTo);
    params.set("format", exportFormat);
    window.open(`/api/resources/timesheets/export?${params}`, "_blank");
  };

  const exportUtilCsv = () => {
    const lines = ["Name,Department,Utilisation %,Risk"];
    resources.forEach((r) => {
      const u = utilMap[r.id] || 0;
      const risk = u < 75 ? "bench" : u > 100 ? "burnout" : "ok";
      lines.push(`"${r.firstName} ${r.lastName}","${r.department ?? ""}",${u},${risk}`);
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = "team-utilisation.csv";
    a.click();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {utilError && <ResourcesErrorState message="Could not load utilisation report" onRetry={() => refetchUtil()} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <Card className="rounded-xl border-border/50">
          <CardContent className="p-4">
            <h4 className="font-medium flex items-center gap-2 mb-2"><Activity className="h-4 w-4" /> Team Utilisation</h4>
            {utilLoading ? (
              <ResourcesTabLoading label="Loading utilisation..." />
            ) : (
              <>
                <p className="text-3xl font-bold text-emerald-600">{(utilisation as { pct?: number })?.pct ?? 0}%</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={exportUtilCsv}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/50">
          <CardContent className="p-4">
            <h4 className="font-medium flex items-center gap-2 mb-2"><Clock className="h-4 w-4" /> Missing Timesheets</h4>
            {missingLoading ? (
              <ResourcesTabLoading label="Checking submissions..." />
            ) : missing.length === 0 ? <p className="text-sm text-muted-foreground">All submitted</p> : (
              <ul className="text-sm space-y-1">{missing.map((m) => <li key={m.resourceId} className="text-red-600">{m.name}</li>)}</ul>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/50">
          <CardContent className="p-4">
            <h4 className="font-medium flex items-center gap-2 mb-2"><BarChart3 className="h-4 w-4" /> Bench / Burnout</h4>
            <div className="text-sm space-y-1 max-h-24 overflow-auto">
              {resources.map((r) => {
                const u = utilMap[r.id] || 0;
                if (u >= 75 && u <= 100) return null;
                return (
                  <div key={r.id} className={cn(u < 75 ? "text-amber-600" : "text-red-600")}>
                    {r.firstName} {r.lastName}: {u}%
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="font-medium flex items-center gap-2"><Download className="h-4 w-4" /> Timesheet CSV Export</h4>
          <div className="flex flex-wrap gap-3 items-end">
            <div><Label className="text-xs">From</Label><Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} /></div>
            <div><Label className="text-xs">To</Label><Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} /></div>
            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as "standard" | "summary")}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="summary">Summary</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportTimesheets}>Export</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/50">
        <CardContent className="p-4 space-y-3">
          <h4 className="font-medium flex items-center gap-2"><Plug className="h-4 w-4" /> Timesheet Integrations</h4>
          <p className="text-sm text-muted-foreground">Connect external timesheet / payroll systems via webhook.</p>
          {intLoading || logLoading ? (
            <ResourcesTabLoading label="Loading integrations..." />
          ) : (
            <>
          {(integrations as Array<{ id: number; name: string; endpointUrl: string; isActive: boolean }>).map((i) => (
            <div key={i.id} className="flex justify-between text-sm border rounded p-2">
              <span>{i.name}</span>
              <span className="text-muted-foreground truncate max-w-xs">{i.endpointUrl}</span>
            </div>
          ))}
          {(integrationLog as Array<{ id: number; status: string; recordsSent: number; createdAt: string }>).slice(0, 5).map((l) => (
            <div key={l.id} className="text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()} · {l.status} · {l.recordsSent} records</div>
          ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
