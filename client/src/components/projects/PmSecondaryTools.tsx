import { Fragment, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, ExternalLink } from "lucide-react";
import { Link } from "wouter";

interface ToolProps {
  projectId: number;
  project?: any;
}

export function PmTeamOrgTool({ projectId }: ToolProps) {
  const { data: team = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/pm/projects", projectId, "team"],
  });
  const { data: orgCharts = [] } = useQuery<any[]>({
    queryKey: ["/api/org-charts"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/org-charts");
      if (!res.ok) throw new Error("Failed to load org charts");
      return res.json();
    },
  });
  const projectChart = orgCharts.find((c: any) => c.metadata?.projectId === projectId);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Project Team & Org Structure</h3>
            <Link href={projectChart ? `/modules/bpm` : `/modules/bpm`}>
              <Button variant="outline" size="sm">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                {projectChart ? "Open Org Chart in BPM" : "Create in BPM"}
              </Button>
            </Link>
          </div>
          {team.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No team members assigned. Add members via Project Settings → People.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {team.map((m: any) => {
                const name = m.user?.firstName
                  ? `${m.user.firstName} ${m.user.lastName || ""}`.trim()
                  : m.name || "Member";
                const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <div key={m.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                      {initials}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{name}</div>
                      <div className="text-xs text-muted-foreground">{m.role || m.title || "Team Member"}</div>
                      {m.allocation != null && <div className="text-xs text-muted-foreground">{m.allocation}% allocated</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function PmRaciTool({ projectId }: ToolProps) {
  const { toast } = useToast();
  const [roleName, setRoleName] = useState("");
  const [activityName, setActivityName] = useState("");
  const { data: roles = [], isLoading: rolesLoading } = useQuery<any[]>({
    queryKey: [`/api/pm/raci/roles?projectId=${projectId}`],
  });
  const { data: activities = [], isLoading: activitiesLoading } = useQuery<any[]>({
    queryKey: [`/api/pm/raci/activities?projectId=${projectId}`],
  });
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: [`/api/pm/raci/assignments?projectId=${projectId}`],
  });
  const { data: raciTypes = [] } = useQuery<any[]>({
    queryKey: ["/api/pm/raci/types"],
  });

  const raciLoading = rolesLoading || activitiesLoading || assignmentsLoading;

  const createRole = useMutation({
    mutationFn: () => apiRequest("POST", "/api/pm/raci/roles", { projectId, name: roleName, sortOrder: roles.length }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pm/raci/roles?projectId=${projectId}`] });
      setRoleName("");
      toast({ title: "Role added" });
    },
  });

  const createActivity = useMutation({
    mutationFn: () => apiRequest("POST", "/api/pm/raci/activities", { projectId, name: activityName, sortOrder: activities.length }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pm/raci/activities?projectId=${projectId}`] });
      setActivityName("");
      toast({ title: "Activity added" });
    },
  });

  const setAssignment = useMutation({
    mutationFn: async ({ activityId, roleId, raciTypeId }: { activityId: number; roleId: number; raciTypeId: number | null }) => {
      const existing = assignments.find((a: any) => a.activityId === activityId && a.roleId === roleId);
      if (raciTypeId === null) {
        if (existing) await apiRequest("DELETE", `/api/pm/raci/assignments/${existing.id}`);
        return;
      }
      if (existing) {
        await apiRequest("PUT", `/api/pm/raci/assignments/${existing.id}`, { raciTypeId });
      } else {
        await apiRequest("POST", "/api/pm/raci/assignments", { projectId, activityId, roleId, raciTypeId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pm/raci/assignments?projectId=${projectId}`] });
    },
  });

  const typeOptions = raciTypes.length > 0
    ? raciTypes.filter((t: any) => t.isActive !== false)
    : [{ id: 1, code: "R", name: "Responsible" }, { id: 2, code: "A", name: "Accountable" }, { id: 3, code: "C", name: "Consulted" }, { id: 4, code: "I", name: "Informed" }];

  const getAssignment = (activityId: number, roleId: number) =>
    assignments.find((a: any) => a.activityId === activityId && a.roleId === roleId);

  if (raciLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Input placeholder="New RACI role…" value={roleName} onChange={(e) => setRoleName(e.target.value)} className="max-w-xs" />
        <Button size="sm" disabled={!roleName.trim() || createRole.isPending} onClick={() => createRole.mutate()}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Role
        </Button>
        <Input placeholder="New activity…" value={activityName} onChange={(e) => setActivityName(e.target.value)} className="max-w-xs" />
        <Button size="sm" disabled={!activityName.trim() || createActivity.isPending} onClick={() => createActivity.mutate()}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Activity
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {roles.length === 0 || activities.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              {roles.length === 0 && activities.length === 0
                ? "Add roles and activities to build your RACI matrix."
                : roles.length === 0 ? "Add at least one role." : "Add at least one activity."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px] sticky left-0 bg-card z-10">Activity</TableHead>
                  {roles.map((r: any) => (
                    <TableHead key={r.id} className="text-center min-w-[80px]">{r.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((act: any) => (
                  <TableRow key={act.id}>
                    <TableCell className="font-medium sticky left-0 bg-card">{act.name}</TableCell>
                    {roles.map((r: any) => {
                      const assign = getAssignment(act.id, r.id);
                      const currentTypeId = assign?.raciTypeId ?? "";
                      return (
                        <TableCell key={r.id} className="text-center p-1">
                          <Select
                            value={currentTypeId ? String(currentTypeId) : "none"}
                            onValueChange={(v) => setAssignment.mutate({
                              activityId: act.id,
                              roleId: r.id,
                              raciTypeId: v === "none" ? null : Number(v),
                            })}
                          >
                            <SelectTrigger className="h-8 text-xs w-[72px] mx-auto">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {typeOptions.map((t: any) => (
                                <SelectItem key={t.id} value={String(t.id)}>{t.code || t.name?.[0]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function PmResourceTrackerTool({ projectId }: ToolProps) {
  const { data: allocations = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/resources/allocations?projectId=${projectId}`],
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Resource</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Allocation</TableHead>
              <TableHead>Period</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No resource allocations for this project.</TableCell></TableRow>
            ) : allocations.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell>{a.resourceName || a.personName || "—"}</TableCell>
                <TableCell>{a.role || "—"}</TableCell>
                <TableCell>{a.allocationPercent != null ? `${a.allocationPercent}%` : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{a.startDate || "—"} → {a.endDate || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function PmTimesheetsTool({ projectId }: ToolProps) {
  const { data: entries = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/finance/timesheets/projects/${projectId}/entries`],
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Person</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No timesheet entries for this project.</TableCell></TableRow>
            ) : entries.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell>{e.entryDate || e.date || "—"}</TableCell>
                <TableCell>{e.personName || e.userName || "—"}</TableCell>
                <TableCell>{e.hours ?? "—"}</TableCell>
                <TableCell className="max-w-[200px] truncate">{e.description || "—"}</TableCell>
                <TableCell>{e.status || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function PmFinanceTrackerTool({ projectId, project }: ToolProps) {
  const { toast } = useToast();
  const [budgetInput, setBudgetInput] = useState(String(project?.budget ?? ""));
  const { data: entries = [] } = useQuery<any[]>({
    queryKey: [`/api/finance/timesheets/projects/${projectId}/entries`],
    enabled: !!projectId,
  });

  const budget = project?.budget ? Number(project.budget) : 0;
  const timesheetHours = entries.reduce((a: number, e: any) => a + (Number(e.hours) || 0), 0);
  const spent = project?.spentBudget ? Number(project.spentBudget) : timesheetHours * 75;
  const remaining = budget - spent;
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;

  const saveBudget = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/pm/projects/${projectId}`, { budget: budgetInput }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: [`/api/portfolio/reports/360/${projectId}`] });
      toast({ title: "Budget updated" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Budget", value: `$${budget.toLocaleString()}` },
          { label: "Spent (est.)", value: `$${spent.toLocaleString()}` },
          { label: "Remaining", value: `$${remaining.toLocaleString()}` },
          { label: "Utilisation", value: `${pct}%` },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase">{item.label}</div>
              <div className="text-lg font-bold mt-1">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="text-xs text-muted-foreground mb-2">Budget burn</div>
          <div className="h-3 bg-muted rounded-full overflow-hidden mb-4">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Update budget ($)</label>
              <Input value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} type="number" className="mt-1" />
            </div>
            <Button size="sm" disabled={saveBudget.isPending} onClick={() => saveBudget.mutate()}>Save</Button>
          </div>
          <p className="text-xs text-muted-foreground">{timesheetHours.toFixed(1)} hours logged · est. $75/hr if spent not set</p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * CCN Detail — the design shows this as a drill-down of a single change
 * request (breadcrumbed "← Change Request Register"), not a separate
 * attachable tool, so it lives here as an expandable panel per row rather
 * than its own pmToolTypeEnum entry. Built entirely on pmRaiddItems columns
 * that already exist — no migration:
 *   description → reason for change, response → technical impact assessment,
 *   timelineImpact → schedule impact, decisionBody → decision owner,
 *   decisionDate → target decision date, activityLog → contributor sign-off
 * Not built (scoped down from the mockup, not silently dropped): a numeric
 * cost-impact field (no matching column — would need real reuse of an
 * unrelated field or a migration) and file attachments.
 */
function CcnDetailPanel({ item, projectId }: { item: any; projectId: number }) {
  const { toast } = useToast();
  const [reason, setReason] = useState(item.description || "");
  const [techImpact, setTechImpact] = useState(item.response || "");
  const [scheduleImpact, setScheduleImpact] = useState(item.timelineImpact || "");
  const [decisionOwner, setDecisionOwner] = useState(item.decisionBody || "");
  const [decisionDate, setDecisionDate] = useState(item.decisionDate || "");
  const [contributorName, setContributorName] = useState("");
  const contributors = (item.activityLog as Array<{ dot: string; text: string; time: string; type: string }>) || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/pm/projects/${projectId}/raidd?type=change`] });

  const saveDetail = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/pm/raidd/${item.id}`, {
      description: reason,
      response: techImpact,
      timelineImpact: scheduleImpact,
      decisionBody: decisionOwner,
      decisionDate: decisionDate || null,
    }),
    onSuccess: () => { invalidate(); toast({ title: "CCN detail saved" }); },
  });

  const addContributor = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/pm/raidd/${item.id}`, {
      activityLog: [...contributors, { dot: "person", text: `${contributorName} — Awaiting`, time: new Date().toISOString(), type: "contributor" }],
    }),
    onSuccess: () => { invalidate(); setContributorName(""); },
  });

  return (
    <div className="px-4 py-4 bg-muted/20 border-t space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">Reason for change</label>
          <textarea className="w-full min-h-[60px] rounded-md border px-3 py-2 text-sm mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">Technical impact assessment</label>
          <textarea className="w-full min-h-[60px] rounded-md border px-3 py-2 text-sm mt-1" value={techImpact} onChange={(e) => setTechImpact(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">Schedule impact</label>
          <Input value={scheduleImpact} onChange={(e) => setScheduleImpact(e.target.value)} placeholder="e.g. +3 weeks" className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">Decision owner</label>
          <Input value={decisionOwner} onChange={(e) => setDecisionOwner(e.target.value)} placeholder="e.g. Steering Committee" className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase">Target decision date</label>
          <Input type="date" value={decisionDate ? String(decisionDate).slice(0, 10) : ""} onChange={(e) => setDecisionDate(e.target.value)} className="mt-1" />
        </div>
      </div>
      <Button size="sm" disabled={saveDetail.isPending} onClick={() => saveDetail.mutate()}>
        {saveDetail.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null} Save detail
      </Button>

      <div className="pt-2 border-t">
        <label className="text-xs font-semibold text-muted-foreground uppercase">Contributors — sign-off</label>
        {contributors.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-1">No contributors added yet.</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {contributors.map((c, idx) => (
              <li key={idx} className="text-sm flex items-center justify-between">
                <span>{c.text}</span>
                <span className="text-xs text-muted-foreground">{new Date(c.time).toLocaleDateString("en-GB")}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2 mt-2">
          <Input placeholder="Name — role" value={contributorName} onChange={(e) => setContributorName(e.target.value)} className="max-w-xs h-8 text-xs" />
          <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!contributorName.trim() || addContributor.isPending} onClick={() => addContributor.mutate()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add contributor
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PmChangeLogTool({ projectId }: ToolProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/pm/projects/${projectId}/raidd?type=change`],
  });

  const createChange = useMutation({
    mutationFn: () => apiRequest("POST", "/api/pm/raidd", {
      projectId,
      type: "change",
      title,
      description,
      status: "open",
      priority: "medium",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pm/projects/${projectId}/raidd?type=change`] });
      setTitle("");
      setDescription("");
      toast({ title: "Change request logged" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PUT", `/api/pm/raidd/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pm/projects/${projectId}/raidd?type=change`] });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Input placeholder="Change title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="w-full min-h-[60px] rounded-md border px-3 py-2 text-sm" placeholder="Description / impact…" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button size="sm" disabled={!title.trim() || createChange.isPending} onClick={() => createChange.mutate()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Log Change Request
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead>Owner</TableHead><TableHead className="w-[180px]">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No change requests yet.</TableCell></TableRow>
              ) : items.map((i: any) => (
                <Fragment key={i.id}>
                  <TableRow>
                    <TableCell className="font-medium">{i.title}</TableCell>
                    <TableCell>{i.status}</TableCell>
                    <TableCell>{i.priority}</TableCell>
                    <TableCell>{i.ownerName || i.owner || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setExpandedId(expandedId === i.id ? null : i.id)}>
                        {expandedId === i.id ? "Hide detail" : "CCN detail"}
                      </Button>
                      {i.status !== "approved" && (
                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => updateStatus.mutate({ id: i.id, status: "approved" })}>Approve</Button>
                      )}
                      {i.status !== "closed" && (
                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => updateStatus.mutate({ id: i.id, status: "closed" })}>Close</Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedId === i.id && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <CcnDetailPanel item={i} projectId={projectId} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function PmDocumentationTool({ projectId, project }: ToolProps) {
  const { toast } = useToast();
  const [newDocTitle, setNewDocTitle] = useState("");
  const meta = (project?.metadata as Record<string, unknown>) || {};
  const folderId = typeof meta.documentFolderId === "number" ? (meta.documentFolderId as number) : null;

  const { data: docs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/pm/projects", projectId, "documents"],
  });
  const { data: rootFolders = [] } = useQuery<any[]>({
    queryKey: ["/api/documents/folders?parentId=null"],
  });
  const linkedFolder = rootFolders.find((f: any) => f.id === folderId);

  const linkFolder = useMutation({
    mutationFn: (id: number) => apiRequest("PUT", `/api/pm/projects/${projectId}`, { metadata: { ...meta, documentFolderId: id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] });
      toast({ title: "Folder linked" });
    },
  });

  const createFolder = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/documents/folders", {
        name: project?.name || "Project documents",
        parentId: null,
        clientId: project?.clientId ?? null,
      });
      const folder = await res.json();
      await apiRequest("PUT", `/api/pm/projects/${projectId}`, { metadata: { ...meta, documentFolderId: folder.id } });
      return folder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/folders?parentId=null"] });
      toast({ title: "Project folder created and linked" });
    },
  });

  const createDoc = useMutation({
    mutationFn: () => apiRequest("POST", "/api/documents", {
      title: newDocTitle,
      content: "",
      type: "document",
      status: "draft",
      folderId,
      clientId: project?.clientId ?? null,
      metadata: { projectId },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "documents"] });
      setNewDocTitle("");
      toast({ title: "Document created" });
    },
  });

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2 justify-between">
          <div className="text-sm">
            {linkedFolder ? (
              <span>Linked folder: <span className="font-medium">{linkedFolder.name}</span></span>
            ) : (
              <span className="text-muted-foreground">No project folder linked yet — new documents won't be organised in the Documents module.</span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {!linkedFolder && (
              <>
                <Select onValueChange={(v) => linkFolder.mutate(Number(v))}>
                  <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Link existing folder…" /></SelectTrigger>
                  <SelectContent>
                    {rootFolders.map((f: any) => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" disabled={createFolder.isPending} onClick={() => createFolder.mutate()}>
                  {createFolder.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                  Create project folder
                </Button>
              </>
            )}
            <Link href="/modules/documents">
              <Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Open Documents Module</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Input placeholder="New document title…" value={newDocTitle} onChange={(e) => setNewDocTitle(e.target.value)} className="max-w-xs" />
        <Button size="sm" disabled={!newDocTitle.trim() || createDoc.isPending} onClick={() => createDoc.mutate()}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New Document
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader>
              <TableBody>
                {docs.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No linked documents.</TableCell></TableRow>
                ) : docs.slice(0, 20).map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.title || d.name}</TableCell>
                    <TableCell>{d.status || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.updatedAt ? String(d.updatedAt).slice(0, 10) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function PmTestTrackerTool({ projectId }: ToolProps) {
  const { data: pmProject } = useQuery<{ id: number; name: string }>({
    queryKey: ["/api/pm/projects", projectId],
    enabled: !!projectId,
  });
  const { data: tmProjects = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/tm/projects"],
  });
  const tmProjectId = tmProjects.find((p) => p.name === pmProject?.name)?.id;
  const { data: testCases = [], isLoading } = useQuery<any[]>({
    queryKey: tmProjectId ? [`/api/tm/cases?projectId=${tmProjectId}`] : ["/api/tm/cases?disabled=1"],
    enabled: !!tmProjectId,
  });
  const total = testCases.length;
  const passed = testCases.filter((t: any) => (t.status || "").toLowerCase() === "passed").length;
  const failed = testCases.filter((t: any) => (t.status || "").toLowerCase() === "failed").length;
  const pending = total - passed - failed;

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Tests", value: total },
          { label: "Passed", value: passed },
          { label: "Failed", value: failed },
          { label: "Pending", value: pending },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{item.value}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      {testCases.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Test Case</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead></TableRow></TableHeader>
              <TableBody>
                {testCases.slice(0, 15).map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.title || t.name}</TableCell>
                    <TableCell>{t.status || "—"}</TableCell>
                    <TableCell>{t.priority || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-6 text-center space-y-4">
          <Link href="/modules/test-mgmt">
            <Button><ExternalLink className="h-4 w-4 mr-2" /> Open Test Management</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export function PmSowTrackerTool({ projectId, project }: ToolProps) {
  const { toast } = useToast();
  const meta = (project?.metadata as Record<string, unknown>) || {};
  const sow = (meta.statementOfWork as { scope?: string; deliverables?: string; acceptance?: string; updatedAt?: string }) || {};
  const [scope, setScope] = useState(sow.scope || "");
  const [deliverables, setDeliverables] = useState(sow.deliverables || "");
  const [acceptance, setAcceptance] = useState(sow.acceptance || "");

  const saveSow = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/pm/projects/${projectId}`, {
      metadata: {
        ...meta,
        statementOfWork: { scope, deliverables, acceptance, updatedAt: new Date().toISOString() },
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] });
      toast({ title: "Statement of Work saved" });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Scope</label>
            <textarea className="w-full min-h-[80px] rounded-md border px-3 py-2 text-sm mt-1" value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Project scope and boundaries…" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Deliverables</label>
            <textarea className="w-full min-h-[80px] rounded-md border px-3 py-2 text-sm mt-1" value={deliverables} onChange={(e) => setDeliverables(e.target.value)} placeholder="Key deliverables and outputs…" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Acceptance Criteria</label>
            <textarea className="w-full min-h-[80px] rounded-md border px-3 py-2 text-sm mt-1" value={acceptance} onChange={(e) => setAcceptance(e.target.value)} placeholder="How success will be measured…" />
          </div>
          {sow.updatedAt && <p className="text-xs text-muted-foreground">Last updated: {String(sow.updatedAt).slice(0, 10)}</p>}
          <Button size="sm" disabled={saveSow.isPending} onClick={() => saveSow.mutate()}>
            {saveSow.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving…</> : "Save SoW"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function PmWbsTool({ projectId }: ToolProps) {
  const { data: tasks = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/pm/projects", projectId, "tasks"],
  });
  const { data: phases = [] } = useQuery<any[]>({
    queryKey: ["/api/pm/projects", projectId, "phases"],
  });

  const wbsItems = [
    ...phases.map((p: any) => ({ id: `ph-${p.id}`, wbs: p.wbsCode || `P${p.id}`, name: p.name, type: "Phase", progress: p.progress ?? 0 })),
    ...tasks.map((t: any) => ({ id: `t-${t.id}`, wbs: t.wbsCode || `T${t.id}`, name: t.name, type: t.isSummary ? "Activity" : "Task", progress: t.progress ?? 0 })),
  ].sort((a, b) => a.wbs.localeCompare(b.wbs, undefined, { numeric: true }));

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">WBS</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-[80px]">Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wbsItems.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No WBS items. Add phases and tasks in the Gantt chart.</TableCell></TableRow>
            ) : wbsItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">{item.wbs}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.type}</TableCell>
                <TableCell>{item.progress}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function PmStakeholderTool({ projectId, project }: ToolProps) {
  const { toast } = useToast();
  const meta = (project?.metadata as Record<string, unknown>) || {};
  const extraStakeholders = (meta.stakeholders as { id: string; role: string; name: string; influence: string; interest?: string }[]) || [];
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [influence, setInfluence] = useState("Medium");

  const coreStakeholders = [
    project?.executiveSponsor && { id: "core-exec", role: "Executive Sponsor", name: project.executiveSponsor, influence: "High", core: true },
    project?.projectManager && { id: "core-pm", role: "Project Manager", name: project.projectManager, influence: "High", core: true },
    project?.businessOwner && { id: "core-bo", role: "Business Owner", name: project.businessOwner, influence: "Medium", core: true },
    project?.deliveryOwner && { id: "core-do", role: "Delivery Owner", name: project.deliveryOwner, influence: "Medium", core: true },
    project?.customer && { id: "core-cust", role: "Customer", name: project.customer, influence: "High", core: true },
  ].filter(Boolean) as { id: string; role: string; name: string; influence: string; core?: boolean }[];

  const allStakeholders = [...coreStakeholders, ...extraStakeholders.map((s) => ({ ...s, core: false }))];

  const addStakeholder = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/pm/projects/${projectId}`, {
      metadata: {
        ...meta,
        stakeholders: [{ id: String(Date.now()), role, name, influence }, ...extraStakeholders],
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] });
      setRole("");
      setName("");
      toast({ title: "Stakeholder added" });
    },
  });

  const removeStakeholder = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/pm/projects/${projectId}`, {
      metadata: { ...meta, stakeholders: extraStakeholders.filter((s) => s.id !== id) },
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} />
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Select value={influence} onValueChange={setInfluence}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["High", "Medium", "Low"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" disabled={!role.trim() || !name.trim() || addStakeholder.isPending} onClick={() => addStakeholder.mutate()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Stakeholder
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Name</TableHead><TableHead>Influence</TableHead><TableHead className="w-[80px]" /></TableRow></TableHeader>
            <TableBody>
              {allStakeholders.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No stakeholders yet.</TableCell></TableRow>
              ) : allStakeholders.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.role}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.influence}</TableCell>
                  <TableCell>
                    {!s.core && (
                      <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive" onClick={() => removeStakeholder.mutate(s.id)}>Remove</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function PmBpmTool({ projectId }: ToolProps) {
  const { data: libraries = [] } = useQuery<Array<{ id: number; projectId?: number | null }>>({
    queryKey: ["/api/bpm/libraries"],
  });
  const { data: diagrams = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/bpm/diagrams"],
  });
  const libraryIdsForProject = new Set(
    libraries.filter((lib) => lib.projectId === projectId).map((lib) => lib.id),
  );
  const projectDiagrams = diagrams.filter((d: any) => d.libraryId && libraryIdsForProject.has(d.libraryId));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{isLoading ? "…" : projectDiagrams.length || diagrams.length}</div>
            <div className="text-xs text-muted-foreground">BPM Diagrams</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{projectId ? "Linked" : "—"}</div>
            <div className="text-xs text-muted-foreground">Project context</div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">Create and edit process flows, BPML, and org charts in the BPM module.</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Link href="/modules/bpm">
              <Button variant="outline"><ExternalLink className="h-4 w-4 mr-2" /> Open BPM</Button>
            </Link>
            <Link href="/bpm">
              <Button variant="ghost" size="sm">Process Portal</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
