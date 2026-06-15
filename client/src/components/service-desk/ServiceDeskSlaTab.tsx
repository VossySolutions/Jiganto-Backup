import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Clock, Settings, Loader2 } from "lucide-react";
import {
  ServiceDeskTabLoading,
  ServiceDeskErrorState,
  ServiceDeskCardGridSkeleton,
} from "./ServiceDeskUi";
import { useToast } from "@/hooks/use-toast";
import type { SlaConfigRow } from "./types";
import { PRIORITY_LABELS } from "./types";
import { useState } from "react";

interface BusinessCalendar {
  config: {
    businessHoursStart?: string;
    businessHoursEnd?: string;
    holidays?: string[];
    timezone?: string;
  };
  isBusinessTimeNow: boolean;
}

export function ServiceDeskSlaTab() {
  const { toast } = useToast();
  const [form, setForm] = useState({ clientId: "", priority: "p1", responseHours: "1", resolutionHours: "4" });

  const { data: configs = [], isLoading: configsLoading, isError: configsError, refetch } = useQuery<SlaConfigRow[]>({ queryKey: ["/api/service-desk/sla-configs"] });
  const { data: calendar, isLoading: calLoading } = useQuery<BusinessCalendar>({ queryKey: ["/api/settings/business-calendar"] });

  const createConfig = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/service-desk/sla-configs", {
        clientId: form.clientId ? Number(form.clientId) : null,
        priority: form.priority,
        responseHours: Number(form.responseHours),
        resolutionHours: Number(form.resolutionHours),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "SLA override saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/service-desk/sla-configs"] });
    },
  });

  if (configsLoading || calLoading) {
    return (
      <div className="space-y-4">
        <ServiceDeskCardGridSkeleton count={2} />
        <ServiceDeskTabLoading label="Loading SLA configuration…" />
      </div>
    );
  }

  if (configsError) {
    return <ServiceDeskErrorState message="Could not load SLA overrides." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />Business Hours</CardTitle>
          <CardDescription>SLA clocks pause outside business hours and on public holidays (configured in Settings).</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {calendar ? (
            <>
              <p>Hours: <strong>{calendar.config.businessHoursStart ?? "09:00"} – {calendar.config.businessHoursEnd ?? "18:00"}</strong> (Mon–Fri)</p>
              <p>Timezone: {calendar.config.timezone ?? "UTC"}</p>
              <p>Public holidays loaded: {(calendar.config.holidays ?? []).length}</p>
              <p>Business time now: {calendar.isBusinessTimeNow ? "Yes — SLA clocks running" : "No — SLA clocks paused"}</p>
            </>
          ) : (
            <p className="text-muted-foreground">Loading calendar config…</p>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href="/settings/system"><Settings className="h-4 w-4 mr-1" />Configure in Settings</a>
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50">
        <CardHeader>
          <CardTitle className="text-base">SLA Clock Behaviour</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>• <strong>Starts</strong> when ticket is created</p>
          <p>• <strong>Pauses</strong> when status is Pending (waiting for client)</p>
          <p>• <strong>Response SLA stops</strong> on first public agent comment</p>
          <p>• <strong>Resolution SLA stops</strong> when status changes to Resolved / Completed</p>
          <p>• <strong>Visual indicators:</strong> Green = within SLA · Amber = within 20% of deadline · Red = breached</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50">
        <CardHeader><CardTitle className="text-base">Per-Client SLA Overrides</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {configs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No client-specific overrides. Default SLAs apply per service and priority.</p>
          ) : configs.map((c) => (
            <div key={c.config.id} className="flex justify-between text-sm p-2 bg-muted/40 rounded-lg">
              <span>{c.clientName ?? "All clients"} — {PRIORITY_LABELS[c.config.priority as keyof typeof PRIORITY_LABELS]}</span>
              <span>{c.config.responseHours}h / {c.config.resolutionHours}h</span>
            </div>
          ))}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t">
            <div>
              <Label>Client ID (optional)</Label>
              <Input value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} placeholder="Premium client" />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Response (hrs)</Label>
              <Input type="number" value={form.responseHours} onChange={(e) => setForm({ ...form, responseHours: e.target.value })} />
            </div>
            <div>
              <Label>Resolution (hrs)</Label>
              <Input type="number" value={form.resolutionHours} onChange={(e) => setForm({ ...form, resolutionHours: e.target.value })} />
            </div>
          </div>
          <Button onClick={() => createConfig.mutate()} disabled={createConfig.isPending}>
            {createConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Add SLA override
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
