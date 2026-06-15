import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ServiceDeskSlaTab } from "../service-desk/ServiceDeskSlaTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  HelpDeskTabLoading,
  HelpDeskErrorState,
  HelpDeskRefreshing,
  HelpDeskCardGridSkeleton,
  HD_ACCENT,
} from "./HelpDeskUi";

export function HelpDeskSlaTab() {
  const { toast } = useToast();
  const [contractForm, setContractForm] = useState({ clientId: "", monthlyHours: "40", overageRate: "150" });
  const [mwForm, setMwForm] = useState({ name: "", startAt: "", endAt: "" });

  const { data: contracted, isLoading: contractLoading, isError: contractError, isFetching: contractFetching, refetch: refetchContract } = useQuery<{
    contracts: unknown[];
    usage: { contract: { id: number; clientId: number | null }; usedHours: number; contractedHours: number; pctUsed: number; alertAt80: boolean; overageHours: number }[];
  }>({
    queryKey: ["/api/help-desk/contracted-hours"],
  });

  const { data: windows = [], isLoading: mwLoading, isError: mwError, isFetching: mwFetching, refetch: refetchMw } = useQuery<{
    id: number; name: string; startAt: string; endAt: string;
  }[]>({
    queryKey: ["/api/help-desk/maintenance-windows"],
  });

  const contractMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/help-desk/contracted-hours", {
        clientId: contractForm.clientId ? Number(contractForm.clientId) : null,
        monthlyHours: Number(contractForm.monthlyHours),
        overageRate: Number(contractForm.overageRate),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Contract saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/help-desk/contracted-hours"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const mwMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/help-desk/maintenance-windows", mwForm);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Maintenance window added" });
      refetchMw();
      setMwForm({ name: "", startAt: "", endAt: "" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMwMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/help-desk/maintenance-windows/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Window removed" });
      refetchMw();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (contractError || mwError) {
    return (
      <HelpDeskErrorState
        message="Could not load SLA settings. Run npm run db:patch-help-desk."
        onRetry={() => { refetchContract(); refetchMw(); }}
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="hd-sla-tab">
      <ServiceDeskSlaTab apiBase="/api/help-desk" />

      <Card className="rounded-2xl border-border/50">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Clock className="h-4 w-4" style={{ color: HD_ACCENT }} />
            Contracted Support Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <HelpDeskRefreshing show={contractFetching && !contractLoading} />
          {contractLoading ? (
            <HelpDeskCardGridSkeleton count={2} />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Client ID</Label>
                  <Input value={contractForm.clientId} onChange={(e) => setContractForm({ ...contractForm, clientId: e.target.value })} placeholder="Optional" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Monthly Hours</Label>
                  <Input type="number" value={contractForm.monthlyHours} onChange={(e) => setContractForm({ ...contractForm, monthlyHours: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Overage Rate (£/hr)</Label>
                  <Input type="number" value={contractForm.overageRate} onChange={(e) => setContractForm({ ...contractForm, overageRate: e.target.value })} className="h-9" />
                </div>
              </div>
              <Button onClick={() => contractMut.mutate()} disabled={contractMut.isPending} className="w-full sm:w-auto">
                {contractMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Contract
              </Button>
              <div className="space-y-2">
                {(contracted?.usage ?? []).map((u) => (
                  <div key={u.contract.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-muted/50 rounded-xl text-xs sm:text-sm">
                    <span className="flex-1">Client #{u.contract.clientId ?? "All"}: {u.usedHours.toFixed(1)}h / {u.contractedHours}h ({u.pctUsed}%)</span>
                    <div className="flex flex-wrap gap-1.5">
                      {u.alertAt80 && <Badge variant="destructive" className="gap-1 text-[10px]"><AlertTriangle className="h-3 w-3" />80%+ used</Badge>}
                      {u.overageHours > 0 && <Badge variant="outline" className="text-[10px]">{u.overageHours.toFixed(1)}h overage</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-sm sm:text-base">Maintenance Windows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <p className="text-xs sm:text-sm text-muted-foreground">SLA clocks pause during planned maintenance windows.</p>
          <HelpDeskRefreshing show={mwFetching && !mwLoading} />
          {mwLoading ? (
            <HelpDeskCardGridSkeleton count={2} />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label className="text-xs sm:text-sm">Name</Label><Input value={mwForm.name} onChange={(e) => setMwForm({ ...mwForm, name: e.target.value })} className="h-9" /></div>
                <div className="space-y-1.5"><Label className="text-xs sm:text-sm">Start</Label><Input type="datetime-local" value={mwForm.startAt} onChange={(e) => setMwForm({ ...mwForm, startAt: e.target.value })} className="h-9" /></div>
                <div className="space-y-1.5"><Label className="text-xs sm:text-sm">End</Label><Input type="datetime-local" value={mwForm.endAt} onChange={(e) => setMwForm({ ...mwForm, endAt: e.target.value })} className="h-9" /></div>
              </div>
              <Button onClick={() => mwMut.mutate()} disabled={!mwForm.name || mwMut.isPending} className="w-full sm:w-auto">
                {mwMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Window
              </Button>
              <div className="space-y-2">
                {windows.map((w) => (
                  <div key={w.id} className="text-xs sm:text-sm p-3 border rounded-xl bg-muted/30 flex justify-between items-start gap-2">
                    <div>
                      <span className="font-medium">{w.name}</span>
                      <p className="text-muted-foreground mt-0.5">{new Date(w.startAt).toLocaleString()} – {new Date(w.endAt).toLocaleString()}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive" onClick={() => deleteMwMut.mutate(w.id)} disabled={deleteMwMut.isPending}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
