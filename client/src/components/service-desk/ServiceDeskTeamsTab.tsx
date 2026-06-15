import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Users, GitBranch, Loader2 } from "lucide-react";
import {
  ServiceDeskTabLoading,
  ServiceDeskErrorState,
  ServiceDeskEmptyState,
  SD_ACCENT,
} from "./ServiceDeskUi";
import { useToast } from "@/hooks/use-toast";
import type { AgentTeam, RoutingRule } from "./types";
import { TYPE_LABELS } from "./types";

export function ServiceDeskTeamsTab() {
  const { toast } = useToast();
  const [teamDialog, setTeamDialog] = useState(false);
  const [ruleDialog, setRuleDialog] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: "", description: "", roundRobinEnabled: false });
  const [ruleForm, setRuleForm] = useState({
    name: "",
    ticketType: "",
    priority: "",
    keyword: "",
    assignTeamId: "",
  });

  const { data: teams = [], isLoading: teamsLoading, isError: teamsError, refetch: refetchTeams } = useQuery<AgentTeam[]>({ queryKey: ["/api/service-desk/teams"] });
  const { data: rules = [], isLoading: rulesLoading, isError: rulesError, refetch: refetchRules } = useQuery<RoutingRule[]>({ queryKey: ["/api/service-desk/routing-rules"] });

  const createTeam = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/service-desk/teams", teamForm);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Team created" });
      setTeamDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/service-desk/teams"] });
    },
  });

  const createRule = useMutation({
    mutationFn: async () => {
      const conditions: Record<string, string> = {};
      if (ruleForm.ticketType) conditions.ticketType = ruleForm.ticketType;
      if (ruleForm.priority) conditions.priority = ruleForm.priority;
      if (ruleForm.keyword) conditions.keyword = ruleForm.keyword;
      const res = await apiRequest("POST", "/api/service-desk/routing-rules", {
        name: ruleForm.name,
        sortOrder: rules.length + 1,
        conditions,
        actions: ruleForm.assignTeamId ? { assignTeamId: Number(ruleForm.assignTeamId) } : {},
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Routing rule created" });
      setRuleDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/service-desk/routing-rules"] });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/service-desk/routing-rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/service-desk/routing-rules"] }),
  });

  if (teamsLoading || rulesLoading) {
    return <ServiceDeskTabLoading label="Loading teams & routing…" />;
  }

  if (teamsError || rulesError) {
    return (
      <ServiceDeskErrorState
        message="Could not load teams or routing rules."
        onRetry={() => { refetchTeams(); refetchRules(); }}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
      <Card className="rounded-2xl border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Agent Teams</CardTitle>
          <Button size="sm" onClick={() => setTeamDialog(true)}><Plus className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams configured.</p>
          ) : teams.map((t) => (
            <div key={t.id} className="p-3 rounded-xl bg-muted/40">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                {t.roundRobinEnabled && <Badge variant="secondary">Round-robin</Badge>}
              </div>
              <p className="text-xs mt-2">{t.memberIds.length} member(s)</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><GitBranch className="h-4 w-4" />Routing Rules</CardTitle>
          <Button size="sm" onClick={() => setRuleDialog(true)}><Plus className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No routing rules. Tickets go to default queue.</p>
          ) : rules.map((r) => (
            <div key={r.id} className="p-3 rounded-xl bg-muted/40 flex justify-between gap-2">
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {Object.entries(r.conditions).map(([k, v]) => `${k}: ${v}`).join(" · ") || "No conditions"}
                </p>
                <p className="text-xs text-muted-foreground">
                  → Team #{String(r.actions.assignTeamId ?? "—")}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => deleteRule.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={teamDialog} onOpenChange={setTeamDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Agent Team</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Name</Label><Input value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} /></div>
            <div><Label>Description</Label><Input value={teamForm.description} onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={teamForm.roundRobinEnabled} onCheckedChange={(v) => setTeamForm({ ...teamForm, roundRobinEnabled: v })} />
              <Label>Round-robin assignment</Label>
            </div>
            <Button className="w-full" onClick={() => createTeam.mutate()} disabled={!teamForm.name || createTeam.isPending}>
              {createTeam.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create team"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ruleDialog} onOpenChange={setRuleDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Routing Rule</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Rule name</Label><Input value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} /></div>
            <div>
              <Label>Ticket type</Label>
              <Select value={ruleForm.ticketType || "__any"} onValueChange={(v) => setRuleForm({ ...ruleForm, ticketType: v === "__any" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any">Any</SelectItem>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Keyword in title</Label><Input value={ruleForm.keyword} onChange={(e) => setRuleForm({ ...ruleForm, keyword: e.target.value })} placeholder="e.g. SAP" /></div>
            <div>
              <Label>Assign to team</Label>
              <Select value={ruleForm.assignTeamId} onValueChange={(v) => setRuleForm({ ...ruleForm, assignTeamId: v })}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  {teams.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => createRule.mutate()} disabled={!ruleForm.name}>Create rule</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
