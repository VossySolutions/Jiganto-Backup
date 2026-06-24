import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Clock, Wallet, Loader2, RefreshCw } from "lucide-react";
import {
  ServiceDeskKpiSkeleton,
  ServiceDeskTableSkeleton,
  ServiceDeskErrorState,
  ServiceDeskEmptyState,
  ServiceDeskTableWrap,
} from "./ServiceDeskUi";
import { useToast } from "@/hooks/use-toast";

interface TimeAnalysisReport {
  rows: {
    ticketId: number;
    ticketRef: string;
    clientId: number | null;
    projectId: number | null;
    hours: number;
    rate: number;
    amount: number;
    description: string | null;
    logDate: string;
  }[];
  summary: { ref: string; hours: number; amount: number }[];
  totalHours: number;
  totalBillable: number;
}

export function ServiceDeskReportsTab() {
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useQuery<TimeAnalysisReport>({
    queryKey: ["/api/service-desk/reports/time-analysis"],
    staleTime: 60_000,
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/service-desk/time-logs/sync-finance", {});
      return res.json() as Promise<{ total: number; synced: number; skipped: number }>;
    },
    onSuccess: (result) => {
      toast({
        title: "Finance sync complete",
        description: `${result.synced} synced, ${result.skipped} skipped of ${result.total} billable logs.`,
      });
      void refetch();
    },
    onError: (e: Error) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }),
  });

  const exportCsv = () => {
    if (!data?.rows.length) return;
    const header = "Ticket,Date,Hours,Rate,Amount,Description\n";
    const lines = data.rows.map((r) =>
      `${r.ticketRef},${r.logDate},${r.hours},${r.rate},${r.amount},"${(r.description ?? "").replace(/"/g, '""')}"`,
    );
    const blob = new Blob([header + lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "service-desk-time-analysis.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="sd-reports-loading">
        <ServiceDeskKpiSkeleton count={2} />
        <ServiceDeskTableSkeleton rows={5} cols={6} />
      </div>
    );
  }

  if (isError) {
    return <ServiceDeskErrorState message="Could not load time analysis report." onRetry={() => refetch()} />;
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <Clock className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total hours logged</p>
              <p className="text-2xl font-semibold">{data.totalHours.toFixed(1)}h</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <Wallet className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-sm text-muted-foreground">Total billable</p>
              <p className="text-2xl font-semibold">£{data.totalBillable.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/50">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-base">Time Analysis by Ticket</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={syncMut.isPending}
              onClick={() => syncMut.mutate()}
            >
              {syncMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Sync to Finance
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data.rows.length}>
              <Download className="h-4 w-4 mr-1" />Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Billable time on tickets with a linked project syncs automatically to Finance timesheets when logged. Use &quot;Sync to Finance&quot; to backfill any unlinked billable logs.
          </p>
          <ServiceDeskTableWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No time logs recorded yet.</TableCell></TableRow>
              ) : data.summary.map((s) => (
                <TableRow key={s.ref}>
                  <TableCell className="font-mono">{s.ref}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>{s.hours.toFixed(1)}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>£{s.amount.toFixed(2)}</TableCell>
                  <TableCell>Aggregated</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </ServiceDeskTableWrap>
        </CardContent>
      </Card>
    </div>
  );
}
