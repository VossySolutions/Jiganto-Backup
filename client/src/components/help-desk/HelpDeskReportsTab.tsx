import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, BarChart3, Bug, Users, Wallet, FileText, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  HelpDeskTabLoading,
  HelpDeskErrorState,
  HelpDeskRefreshing,
  HelpDeskKpiSkeleton,
  HelpDeskTableSkeleton,
  HelpDeskTableWrap,
  HD_ACCENT,
} from "./HelpDeskUi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ReportsData {
  slaPerformance: { total: number; within: number; byType: Record<string, { total: number; within: number }> };
  volume: { byStatus: Record<string, number>; total: number };
  defectAnalysis: { byPhase: Record<string, number>; bySeverity: Record<string, number>; byStatus: Record<string, number>; total: number };
  agentPerformance: { agent: string; resolved: number; avgResolutionHours: number; csatScore: number | null }[];
  timeBilling: { totalHours: number; totalBillable: number; rows: unknown[] };
  clientSummaries: { clientId: number; clientName: string; openTickets: number; slaCompliancePct: number; avgResolutionHours: number; hoursUsed: number; hoursContracted: number }[];
}

export function HelpDeskReportsTab() {
  const { toast } = useToast();
  const [days, setDays] = useState("30");
  const [pdfLoading, setPdfLoading] = useState(false);
  const { data, isLoading, isError, isFetching, refetch } = useQuery<ReportsData>({
    queryKey: [`/api/help-desk/reports?days=${days}`],
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/help-desk/time-logs/sync-finance", {});
      return res.json() as Promise<{ total: number; synced: number; skipped: number }>;
    },
    onSuccess: (result) => {
      toast({ title: "Finance sync complete", description: `${result.synced} synced of ${result.total} logs.` });
      void refetch();
    },
    onError: (e: Error) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }),
  });

  const exportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `help-desk-reports-${days}d.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      const res = await fetchWithAuth(`/api/help-desk/reports/pdf?days=${days}`);
      if (!res.ok) throw new Error("PDF export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `help-desk-client-summary-${days}d.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "PDF export failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="hd-reports-loading">
        <HelpDeskKpiSkeleton count={2} />
        <HelpDeskTableSkeleton rows={5} cols={4} />
        <HelpDeskTableSkeleton rows={4} cols={4} />
      </div>
    );
  }

  if (isError) {
    return <HelpDeskErrorState message="Could not load reports. Run npm run db:patch-help-desk." onRetry={() => refetch()} />;
  }

  if (!data) return null;

  const slaPct = data.slaPerformance.total > 0
    ? Math.round((data.slaPerformance.within / data.slaPerformance.total) * 100)
    : 100;

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="hd-reports">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-full sm:w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground hidden sm:block" />}
          <Button variant="outline" size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending} className="w-full sm:w-auto">
            {syncMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Sync to Finance
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={pdfLoading} className="w-full sm:w-auto">
            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
            Download PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportJson} className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-1" />Export JSON
          </Button>
        </div>
      </div>
      <HelpDeskRefreshing show={isFetching && !isLoading} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" style={{ color: HD_ACCENT }} />SLA Performance</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <p className="text-2xl sm:text-3xl font-semibold">{slaPct}%</p>
            <p className="text-xs sm:text-sm text-muted-foreground">{data.slaPerformance.within} of {data.slaPerformance.total} resolved within SLA</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Ticket Volume</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <p className="text-2xl sm:text-3xl font-semibold">{data.volume.total}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">tickets in period</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/50">
        <CardHeader className="px-4 sm:px-6 pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Bug className="h-4 w-4" />Defect Analysis ({data.defectAnalysis.total})</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
          {[
            { title: "By Phase", data: data.defectAnalysis.byPhase },
            { title: "By Severity", data: data.defectAnalysis.bySeverity },
            { title: "By Status", data: data.defectAnalysis.byStatus },
          ].map((block) => (
            <div key={block.title} className="p-3 rounded-xl bg-muted/30">
              <p className="font-medium mb-2">{block.title}</p>
              {Object.keys(block.data).length === 0 ? (
                <p className="text-muted-foreground">No data</p>
              ) : Object.entries(block.data).map(([k, v]) => (
                <div key={k} className="flex justify-between py-0.5"><span className="capitalize">{k}</span><span className="font-mono">{v}</span></div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50">
        <CardHeader className="px-4 sm:px-6 pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />Agent Performance</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <HelpDeskTableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Resolved</TableHead>
                  <TableHead className="hidden sm:table-cell">Avg Resolution</TableHead>
                  <TableHead>CSAT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.agentPerformance.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No agent data in period.</TableCell></TableRow>
                ) : data.agentPerformance.map((a) => (
                  <TableRow key={a.agent}>
                    <TableCell className="text-xs sm:text-sm max-w-[120px] truncate">{a.agent}</TableCell>
                    <TableCell>{a.resolved}</TableCell>
                    <TableCell className="hidden sm:table-cell">{a.avgResolutionHours}h</TableCell>
                    <TableCell>{a.csatScore ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </HelpDeskTableWrap>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50">
        <CardHeader className="px-4 sm:px-6 pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" />Time &amp; Billing</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <p className="text-sm">{Number(data.timeBilling.totalHours ?? 0).toFixed(1)}h logged · £{Number(data.timeBilling.totalBillable ?? 0).toFixed(2)} billable</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50">
        <CardHeader className="px-4 sm:px-6 pb-2"><CardTitle className="text-sm">Client Summary</CardTitle></CardHeader>
        <CardContent className="px-2 sm:px-6">
          <HelpDeskTableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Open</TableHead>
                  <TableHead className="hidden sm:table-cell">SLA %</TableHead>
                  <TableHead>Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.clientSummaries.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No client data.</TableCell></TableRow>
                ) : data.clientSummaries.map((c) => (
                  <TableRow key={c.clientId}>
                    <TableCell className="text-xs sm:text-sm max-w-[140px] truncate">{c.clientName}</TableCell>
                    <TableCell>{c.openTickets}</TableCell>
                    <TableCell className="hidden sm:table-cell">{c.slaCompliancePct}%</TableCell>
                    <TableCell className="text-xs">{c.hoursUsed.toFixed(1)} / {c.hoursContracted}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </HelpDeskTableWrap>
        </CardContent>
      </Card>
    </div>
  );
}
