import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  buildWorkItemPayload,
  emptyWorkItemForm,
  projectToWorkItemForm,
  validateQuickEditForm,
  type LoadedProject,
  type LoadedTeamRow,
  type WorkItemFormData,
} from "@/lib/pm-work-item-form";
import {
  fetchOrgMemberCandidates,
  type OrgMemberCandidate,
} from "@/components/workspaces/orgMembers";
import { WORK_TYPES } from "@/components/projects/CreateWorkItemWizard";
import { Loader2 } from "lucide-react";

type PortfolioRow = { id: number; name: string };

const CHIP_COLORS = ["#4338CA", "#0D9488", "#7C3AED", "#D97706", "#059669", "#DC2626"];

function chipColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return CHIP_COLORS[h % CHIP_COLORS.length];
}

function chipInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function personDisplayName(user: OrgMemberCandidate | undefined, fallback = ""): string {
  if (!user) return fallback;
  const full = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  if (full) return full;
  if (user.email?.trim()) return user.email.trim();
  return fallback || "Unnamed user";
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
      {children}{required && <span className="text-red-600 ml-0.5">*</span>}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[11px] text-red-600 font-medium" role="alert">{message}</p>;
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30 flex items-start gap-3">
        <span className="text-lg">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function UserPicker({
  users,
  value,
  displayName,
  onChange,
  placeholder,
  testId,
  allowClear,
}: {
  users: OrgMemberCandidate[];
  value: string;
  displayName?: string;
  onChange: (userId: string, label: string) => void;
  placeholder: string;
  testId?: string;
  allowClear?: boolean;
}) {
  const selected = users.find((u) => u.id === value);
  const label = personDisplayName(selected, displayName?.trim() || "");
  return (
    <div className={cn("flex items-center gap-2 h-[38px] px-2 rounded-lg border bg-background", value ? "border-primary/40" : "border-input")}>
      {label && (
        <span
          className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
          style={{ backgroundColor: chipColor(label) }}
        >
          {chipInitials(label)}
        </span>
      )}
      <Select
        value={value || undefined}
        onValueChange={(id) => {
          const u = users.find((x) => x.id === id);
          onChange(id, personDisplayName(u));
        }}
      >
        <SelectTrigger className="h-8 border-0 shadow-none focus:ring-0 px-1 flex-1" data-testid={testId}>
          {label ? (
            <span className="truncate text-left text-sm font-semibold">{label}</span>
          ) : (
            <SelectValue placeholder={placeholder} />
          )}
        </SelectTrigger>
        <SelectContent>
          {users.map((u) => {
            const name = personDisplayName(u);
            return (
              <SelectItem key={u.id} value={u.id} textValue={name}>
                <div className="flex flex-col gap-0.5 py-0.5">
                  <span className="text-sm font-medium">{name}</span>
                  {u.email && u.email !== name && (
                    <span className="text-[11px] text-muted-foreground">{u.email}</span>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {allowClear && value && (
        <button type="button" className="text-[10px] font-bold text-primary pr-2" onClick={() => onChange("", "")}>
          Clear
        </button>
      )}
    </div>
  );
}

function ChipInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border p-2 min-h-[38px] bg-background">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">
          {v}
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => onChange(values.filter((x) => x !== v))}>✕</button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[80px] text-sm bg-transparent outline-none"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        placeholder={placeholder}
      />
    </div>
  );
}

const RAG_OPTIONS = [
  { value: "green", label: "Green — on track" },
  { value: "amber", label: "Amber — at risk" },
  { value: "red", label: "Red — off track" },
] as const;

export function EditWorkItemPanel({
  projectId,
  open,
  onOpenChange,
  onSaved,
}: {
  projectId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState("details");
  const [form, setForm] = useState<WorkItemFormData>(emptyWorkItemForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [teamLabels, setTeamLabels] = useState<Record<string, string>>({});
  const initialTeamRef = useRef<LoadedTeamRow[]>([]);
  const existingMetaRef = useRef<Record<string, unknown>>({});

  const { data: project, isLoading: projectLoading } = useQuery<LoadedProject>({
    queryKey: ["/api/pm/projects", projectId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pm/projects/${projectId}`);
      return res.json();
    },
    enabled: open && projectId != null,
  });

  const { data: teamRows = [], isLoading: teamLoading } = useQuery<LoadedTeamRow[]>({
    queryKey: ["/api/pm/projects", projectId, "team"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pm/projects/${projectId}/team`);
      return res.json();
    },
    enabled: open && projectId != null,
  });

  const { data: orgUsers = [] } = useQuery({
    queryKey: ["/api/chat/users", "edit-panel"],
    queryFn: fetchOrgMemberCandidates,
    enabled: open,
    staleTime: 60_000,
  });

  const { data: portfolios = [] } = useQuery<PortfolioRow[]>({
    queryKey: ["/api/pm/portfolios"],
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open || !project || teamLoading) return;
    const mapped = projectToWorkItemForm(project, teamRows);
    setForm(mapped);
    initialTeamRef.current = teamRows;
    existingMetaRef.current = (project.metadata && typeof project.metadata === "object" ? project.metadata : {}) as Record<string, unknown>;
    const labels: Record<string, string> = {};
    for (const m of teamRows) labels[m.userId] = "";
    setTeamLabels(labels);
    setErrors({});
    setTab("details");
  }, [open, project, teamRows, teamLoading]);

  const updateField = <K extends keyof WorkItemFormData>(field: K, value: WorkItemFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field as string]) return prev;
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
  };

  const userLabel = (id: string) => {
    const u = orgUsers.find((x) => x.id === id);
    return personDisplayName(u, teamLabels[id] || "");
  };

  const addTeamMember = (userId: string) => {
    if (!userId || form.teamMemberIds.includes(userId)) return;
    const u = orgUsers.find((x) => x.id === userId);
    const label = personDisplayName(u);
    setTeamLabels((prev) => ({ ...prev, [userId]: label }));
    updateField("teamMemberIds", [...form.teamMemberIds, userId]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("No project");
      const payload = buildWorkItemPayload(form, existingMetaRef.current);
      const res = await apiRequest("PUT", `/api/pm/projects/${projectId}`, payload);
      const projectData = await res.json();

      const desiredTeamIds = new Set(form.teamMemberIds.filter(Boolean));
      const initialRows = initialTeamRef.current.filter((m) => m.role === "team_member");
      for (const row of initialRows) {
        if (!desiredTeamIds.has(row.userId)) {
          await apiRequest("DELETE", `/api/pm/team/${row.id}`);
        }
      }
      const existingTeamUserIds = new Set(initialRows.map((m) => m.userId));
      for (const memberUserId of desiredTeamIds) {
        if (existingTeamUserIds.has(memberUserId)) continue;
        await apiRequest("POST", "/api/pm/team", {
          projectId,
          userId: memberUserId,
          role: "team_member",
          isActive: true,
        });
      }
      const leadOnTeam = initialTeamRef.current.some((m) => m.userId === form.leadId);
      if (form.leadId && !leadOnTeam && !desiredTeamIds.has(form.leadId)) {
        try {
          await apiRequest("POST", "/api/pm/team", {
            projectId,
            userId: form.leadId,
            role: "project_manager",
            isActive: true,
          });
        } catch {
          // non-fatal
        }
      }
      return projectData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "team"] });
      toast({ title: "Project updated" });
      onOpenChange(false);
      onSaved?.();
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    const nextErrors = validateQuickEditForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast({
        title: "Please fix the highlighted fields",
        description: Object.values(nextErrors)[0],
        variant: "destructive",
      });
      if (nextErrors.name || nextErrors.description || nextErrors.code) setTab("details");
      else if (nextErrors.leadId || nextErrors.sponsor || nextErrors.contactEmail) setTab("people");
      else setTab("planning");
      return;
    }
    saveMutation.mutate();
  };

  const workTypeLabel = [...WORK_TYPES.main, ...WORK_TYPES.extended].find((t) => t.id === form.workType)?.name || form.workType;
  const loading = projectLoading || teamLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl w-[95vw] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden"
        data-testid="edit-work-item-panel"
      >
        <DialogHeader className="px-6 py-4 border-b shrink-0 text-left">
          <DialogTitle className="text-lg font-semibold">Edit work item</DialogTitle>
          <p className="text-sm text-muted-foreground">Update key project information — changes save to the landing list immediately.</p>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
              <div className="px-6 pt-4 shrink-0">
                <div className="rounded-lg border bg-muted/30 px-3 py-2 flex items-center gap-2 mb-3">
                  <span className="text-lg">📁</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{form.name || "Project"}</div>
                    <div className="text-[11px] text-muted-foreground">{workTypeLabel}{form.code ? ` · ${form.code}` : ""}</div>
                  </div>
                </div>
                <TabsList className="w-full justify-start h-9">
                  <TabsTrigger value="details" className="text-xs" data-testid="edit-tab-details">Project details</TabsTrigger>
                  <TabsTrigger value="people" className="text-xs" data-testid="edit-tab-people">People & governance</TabsTrigger>
                  <TabsTrigger value="planning" className="text-xs" data-testid="edit-tab-planning">Planning & finance</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                <TabsContent value="details" className="mt-0 space-y-4">
                  <SectionCard icon="📋" title="Identity" subtitle="What is this work item and what is it trying to achieve?">
                    <div className="md:col-span-2 space-y-1">
                      <FieldLabel required>Project / work item name</FieldLabel>
                      <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} className={cn(errors.name && "border-red-500")} data-testid="edit-input-name" />
                      <FieldError message={errors.name} />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <FieldLabel>Reference / contract number</FieldLabel>
                      <Input value={form.code} onChange={(e) => updateField("code", e.target.value)} className={cn(errors.code && "border-red-500")} data-testid="edit-input-code" />
                      <FieldError message={errors.code} />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <FieldLabel required>Description</FieldLabel>
                      <Textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} className={cn("min-h-[72px]", errors.description && "border-red-500")} data-testid="edit-input-description" />
                      <FieldError message={errors.description} />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <FieldLabel>Objective / scope statement</FieldLabel>
                      <Textarea value={form.strategicObjective} onChange={(e) => updateField("strategicObjective", e.target.value)} className="min-h-[72px]" data-testid="edit-input-objective" />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <FieldLabel>Tags</FieldLabel>
                      <ChipInput values={form.tags} onChange={(tags) => updateField("tags", tags)} placeholder="+ add tag…" />
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Visibility / access</FieldLabel>
                      <Select value={form.visibility} onValueChange={(v) => updateField("visibility", v)}>
                        <SelectTrigger data-testid="edit-select-visibility"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="organisation">Organisation-wide</SelectItem>
                          <SelectItem value="team">Team only</SelectItem>
                          <SelectItem value="private">Private</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Work type</FieldLabel>
                      <Select value={form.workType} onValueChange={(v) => updateField("workType", v)}>
                        <SelectTrigger data-testid="edit-select-work-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[...WORK_TYPES.main, ...WORK_TYPES.extended].map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </SectionCard>
                </TabsContent>

                <TabsContent value="people" className="mt-0 space-y-4">
                  <SectionCard icon="👥" title="People & governance" subtitle="Who is leading, governing and delivering this work?">
                    <div className="space-y-1 md:col-span-2">
                      <FieldLabel required>Lead (PM / programme manager)</FieldLabel>
                      <UserPicker
                        users={orgUsers}
                        value={form.leadId}
                        displayName={form.lead}
                        onChange={(id, label) => setForm((prev) => ({ ...prev, leadId: id, lead: label }))}
                        placeholder="Select lead…"
                        testId="edit-select-lead"
                      />
                      <FieldError message={errors.leadId} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <FieldLabel>PMO owner</FieldLabel>
                      <UserPicker
                        users={orgUsers}
                        value={form.pmoOwnerId}
                        displayName={form.pmoOwner}
                        onChange={(id, label) => setForm((prev) => ({ ...prev, pmoOwnerId: id, pmoOwner: label }))}
                        placeholder="Select PMO owner…"
                        testId="edit-select-pmo"
                        allowClear
                      />
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Customer / client</FieldLabel>
                      <Input value={form.customer} onChange={(e) => updateField("customer", e.target.value)} data-testid="edit-input-customer" />
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Customer contact / sponsor</FieldLabel>
                      <Input value={form.sponsor} onChange={(e) => updateField("sponsor", e.target.value)} className={cn(errors.sponsor && "border-red-500")} data-testid="edit-input-sponsor" />
                      <FieldError message={errors.sponsor} />
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Contact email</FieldLabel>
                      <Input type="email" value={form.contactEmail} onChange={(e) => updateField("contactEmail", e.target.value)} className={cn(errors.contactEmail && "border-red-500")} data-testid="edit-input-email" />
                      <FieldError message={errors.contactEmail} />
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Contact phone</FieldLabel>
                      <Input type="tel" value={form.contactPhone} onChange={(e) => updateField("contactPhone", e.target.value)} className={cn(errors.contactPhone && "border-red-500")} data-testid="edit-input-phone" />
                      <FieldError message={errors.contactPhone} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <FieldLabel>Team members</FieldLabel>
                      <div className="rounded-lg border p-2.5 space-y-2 bg-background">
                        {form.teamMemberIds.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pb-1.5 border-b">
                            {form.teamMemberIds.map((id) => {
                              const label = userLabel(id);
                              return (
                                <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/30 px-2.5 py-0.5 text-[11px] font-semibold">
                                  <span className="h-4 w-4 rounded-full text-[7px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: chipColor(label) }}>
                                    {chipInitials(label)}
                                  </span>
                                  {label}
                                  <button type="button" className="text-primary font-bold" onClick={() => updateField("teamMemberIds", form.teamMemberIds.filter((x) => x !== id))}>✕</button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <Select onValueChange={addTeamMember}>
                          <SelectTrigger className="h-8 text-xs" data-testid="edit-select-team">
                            <SelectValue placeholder="Add team member…" />
                          </SelectTrigger>
                          <SelectContent>
                            {orgUsers
                              .filter((u) => !form.teamMemberIds.includes(u.id) && u.id !== form.leadId)
                              .map((u) => {
                                const name = personDisplayName(u);
                                return (
                                  <SelectItem key={u.id} value={u.id} textValue={name}>
                                    {name}
                                  </SelectItem>
                                );
                              })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Priority</FieldLabel>
                      <Select value={form.priority} onValueChange={(v) => updateField("priority", v)}>
                        <SelectTrigger data-testid="edit-select-priority"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Risk level</FieldLabel>
                      <Select value={form.complexityLevel} onValueChange={(v) => updateField("complexityLevel", v)}>
                        <SelectTrigger data-testid="edit-select-risk"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="very_high">Very High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </SectionCard>
                </TabsContent>

                <TabsContent value="planning" className="mt-0 space-y-4">
                  <SectionCard icon="📅" title="Planning" subtitle="When does this run and how will it be reported?">
                    <div className="space-y-1">
                      <FieldLabel required>Start date</FieldLabel>
                      <Input type="date" value={form.startDate} onChange={(e) => updateField("startDate", e.target.value)} className={cn(errors.startDate && "border-red-500")} data-testid="edit-input-start" />
                      <FieldError message={errors.startDate} />
                    </div>
                    <div className="space-y-1">
                      <FieldLabel required>End date</FieldLabel>
                      <Input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => updateField("endDate", e.target.value)} className={cn(errors.endDate && "border-red-500")} data-testid="edit-input-end" />
                      <FieldError message={errors.endDate} />
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Status reporting cadence</FieldLabel>
                      <Select value={form.statusCadence} onValueChange={(v) => updateField("statusCadence", v)}>
                        <SelectTrigger data-testid="edit-select-cadence"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="fortnightly">Fortnightly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Report audience</FieldLabel>
                      <Select value={form.reportAudience} onValueChange={(v) => updateField("reportAudience", v)}>
                        <SelectTrigger data-testid="edit-select-audience"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="steering_committee">Steering Committee</SelectItem>
                          <SelectItem value="sponsor">Sponsor</SelectItem>
                          <SelectItem value="pmo">PMO</SelectItem>
                          <SelectItem value="team">Project team</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Status</FieldLabel>
                      <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
                        <SelectTrigger data-testid="edit-select-status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["draft", "planning", "active", "on_hold", "completed", "cancelled"].map((s) => (
                            <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </SectionCard>

                  <SectionCard icon="🚦" title="Health & RAG" subtitle="Overall delivery health indicators.">
                    <div className="space-y-1">
                      <FieldLabel>Scope RAG</FieldLabel>
                      <Select value={form.ragStatus} onValueChange={(v) => updateField("ragStatus", v)}>
                        <SelectTrigger data-testid="edit-select-rag-scope"><SelectValue /></SelectTrigger>
                        <SelectContent>{RAG_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Budget RAG</FieldLabel>
                      <Select value={form.financialRag} onValueChange={(v) => updateField("financialRag", v)}>
                        <SelectTrigger data-testid="edit-select-rag-budget"><SelectValue /></SelectTrigger>
                        <SelectContent>{RAG_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Schedule RAG</FieldLabel>
                      <Select value={form.scheduleRag} onValueChange={(v) => updateField("scheduleRag", v)}>
                        <SelectTrigger data-testid="edit-select-rag-schedule"><SelectValue /></SelectTrigger>
                        <SelectContent>{RAG_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </SectionCard>

                  <SectionCard icon="💰" title="Finance" subtitle="Budget, portfolio linkage and financial governance.">
                    <div className="space-y-1 md:col-span-2">
                      <FieldLabel>Budget</FieldLabel>
                      <div className="flex gap-1.5">
                        <Select value={form.currency} onValueChange={(v) => updateField("currency", v)}>
                          <SelectTrigger className="w-[96px]" data-testid="edit-select-currency"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GBP">GBP £</SelectItem>
                            <SelectItem value="USD">USD $</SelectItem>
                            <SelectItem value="EUR">EUR €</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input className={cn("flex-1", errors.budget && "border-red-500")} value={form.budget} onChange={(e) => updateField("budget", e.target.value)} placeholder="2,400,000" data-testid="edit-input-budget" />
                      </div>
                      <FieldError message={errors.budget} />
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Contract value (revenue)</FieldLabel>
                      <Input value={form.contractValue} onChange={(e) => updateField("contractValue", e.target.value)} className={cn(errors.contractValue && "border-red-500")} data-testid="edit-input-contract" />
                      <FieldError message={errors.contractValue} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <FieldLabel>Parent programme / portfolio</FieldLabel>
                      <Select value={form.portfolioId || "none"} onValueChange={(v) => updateField("portfolioId", v === "none" ? "" : v)}>
                        <SelectTrigger data-testid="edit-select-portfolio"><SelectValue placeholder="Select portfolio…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Not linked —</SelectItem>
                          {portfolios.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </SectionCard>
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}

        <DialogFooter className="px-6 py-4 border-t shrink-0 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending} data-testid="edit-button-cancel">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending || loading} data-testid="edit-button-save">
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
