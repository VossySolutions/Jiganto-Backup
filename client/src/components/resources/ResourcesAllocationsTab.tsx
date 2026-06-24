import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell, FormSection, FieldGrid, FieldLabel, FormDivider } from "@/components/ui/form-dialog-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Briefcase, Plus, Calendar, AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials, ALLOCATION_TYPES } from "./constants";
import { ResourcesTabLoading, ResourcesTableSkeleton } from "./ResourcesUi";
import type { Resource, ResourceAllocation } from "@shared/models/resources";

type Props = {
  resources: Resource[];
  allocations: ResourceAllocation[];
  allocationsLoading?: boolean;
  onCreateAllocation: (data: object) => void;
  onDeleteAllocation: (id: number) => void;
  openCreate?: boolean;
  onOpenCreateChange?: (open: boolean) => void;
};

export function ResourcesAllocationsTab({
  resources, allocations, allocationsLoading, onCreateAllocation, onDeleteAllocation, openCreate, onOpenCreateChange,
}: Props) {
  const [viewMode, setViewMode] = useState<"by-resource" | "by-project">("by-resource");
  const [internalOpen, setInternalOpen] = useState(false);
  const showCreate = openCreate ?? internalOpen;
  const setShowCreate = onOpenCreateChange ?? setInternalOpen;

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/pm/projects"],
  });

  const [form, setForm] = useState({
    resourceId: "", projectId: "", projectName: "", allocationType: "confirmed",
    daysPerWeek: "5", allocationPercentage: "100", role: "", startDate: "", endDate: "", notes: "",
  });

  const active = allocations.filter((a) => a.status === "active");
  const byResource = useMemo(() => {
    const m: Record<number, ResourceAllocation[]> = {};
    active.forEach((a) => { if (!m[a.resourceId]) m[a.resourceId] = []; m[a.resourceId].push(a); });
    return m;
  }, [active]);

  const timelineStart = new Date();
  timelineStart.setDate(timelineStart.getDate() - ((timelineStart.getDay() + 6) % 7));
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(timelineStart);
    d.setDate(d.getDate() + i * 7);
    return d;
  });

  const barStyle = (a: ResourceAllocation) => {
    const total = 12 * 7;
    const start = Math.max(0, Math.floor((new Date(a.startDate).getTime() - timelineStart.getTime()) / 86400000));
    const end = Math.min(total, Math.ceil((new Date(a.endDate).getTime() - timelineStart.getTime()) / 86400000));
    if (start >= total || end <= 0) return null;
    return { left: `${(start / total) * 100}%`, width: `${((end - start) / total) * 100}%` };
  };

  const barClass = (type: string | null) => {
    if (type === "provisional" || type === "soft") return "bg-amber-400 bg-[length:8px_8px] bg-[linear-gradient(45deg,rgba(255,255,255,.3)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.3)_50%,rgba(255,255,255,.3)_75%,transparent_75%,transparent)]";
    if (type === "on_hold") return "border-2 border-dashed border-slate-400 bg-slate-200";
    return "bg-emerald-500";
  };

  const save = () => {
    const proj = projects.find((p) => String(p.id) === form.projectId);
    onCreateAllocation({
      resourceId: Number(form.resourceId),
      projectId: form.projectId ? Number(form.projectId) : null,
      projectName: proj?.name ?? form.projectName,
      allocationType: form.allocationType,
      daysPerWeek: form.daysPerWeek,
      allocationPercentage: form.allocationPercentage,
      role: form.role,
      startDate: form.startDate,
      endDate: form.endDate,
      notes: form.notes,
      status: "active",
    });
    setShowCreate(false);
  };

  if (allocationsLoading) {
    return <ResourcesTableSkeleton rows={8} cols={5} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <Button variant={viewMode === "by-resource" ? "default" : "outline"} size="sm" onClick={() => setViewMode("by-resource")}><Users className="h-4 w-4 mr-1" /> By Resource</Button>
          <Button variant={viewMode === "by-project" ? "default" : "outline"} size="sm" onClick={() => setViewMode("by-project")}><Briefcase className="h-4 w-4 mr-1" /> By Project</Button>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> Add Allocation</Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="flex border-b bg-muted/30">
              <div className="w-60 shrink-0 p-3 text-xs font-medium uppercase">Resource</div>
              <div className="flex-1 flex">{weeks.map((w, i) => <div key={i} className="flex-1 p-2 text-center text-xs border-l">{w.toLocaleDateString("en-GB", { month: "short", day: "numeric" })}</div>)}</div>
            </div>
            {resources.map((r) => {
              const allocs = byResource[r.id] ?? [];
              const total = allocs.reduce((s, a) => s + Number(a.allocationPercentage || 0), 0);
              return (
                <div key={r.id} className="flex border-b min-h-[48px]">
                  <div className="w-60 shrink-0 p-3 flex items-center gap-2">
                    <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{getInitials(r.firstName, r.lastName)}</AvatarFallback></Avatar>
                    <div>
                      <p className="text-sm font-medium">{r.firstName} {r.lastName}</p>
                      <p className="text-xs text-muted-foreground">{total}%</p>
                    </div>
                    {total > 100 && <AlertTriangle className="h-4 w-4 text-red-500" />}
                  </div>
                  <div className="flex-1 relative">
                    {allocs.map((a) => {
                      const style = barStyle(a);
                      if (!style) return null;
                      return (
                        <Tooltip key={a.id}>
                          <TooltipTrigger asChild>
                            <div className={cn("absolute top-2 h-7 rounded text-xs text-white px-2 flex items-center truncate", barClass(a.allocationType))} style={style}>
                              {a.projectName}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{a.projectName} · {a.daysPerWeek ?? a.allocationPercentage}d/wk</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => allocs[0] && onDeleteAllocation(allocs[0].id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <FormDialogShell
        open={showCreate}
        onOpenChange={setShowCreate}
        title="New allocation"
        subtitle="Assign a resource to a project for a date range"
        saveLabel="Create allocation"
        onCancel={() => setShowCreate(false)}
        onSubmit={save}
        disabled={!form.resourceId || !form.startDate || !form.endDate}
      >
        <FormSection icon={<Calendar className="h-3.5 w-3.5 text-blue-600" />} iconClassName="bg-blue-50 dark:bg-blue-950/40" title="Assignment">
          <FieldGrid className="mb-3.5">
            <div className="space-y-1.5"><FieldLabel required>Resource</FieldLabel>
              <Select value={form.resourceId} onValueChange={(v) => setForm({ ...form, resourceId: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{resources.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.firstName} {r.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><FieldLabel required>Project</FieldLabel>
              <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </FieldGrid>
          <FieldGrid className="mb-3.5">
            <div className="space-y-1.5"><FieldLabel>Type</FieldLabel>
              <Select value={form.allocationType} onValueChange={(v) => setForm({ ...form, allocationType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ALLOCATION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><FieldLabel>Days / week</FieldLabel><Input type="number" step="0.5" min="0" max="5" value={form.daysPerWeek} onChange={(e) => setForm({ ...form, daysPerWeek: e.target.value })} /></div>
          </FieldGrid>
          <div className="space-y-1.5"><FieldLabel>Role on project</FieldLabel><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Lead developer" /></div>
        </FormSection>

        <FormDivider />

        <FormSection icon={<Calendar className="h-3.5 w-3.5 text-violet-600" />} iconClassName="bg-violet-50 dark:bg-violet-950/40" title="Schedule">
          <FieldGrid className="mb-3.5">
            <div className="space-y-1.5"><FieldLabel required>Start</FieldLabel><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="space-y-1.5"><FieldLabel required>End</FieldLabel><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          </FieldGrid>
          <div className="space-y-1.5"><FieldLabel>Notes</FieldLabel><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Optional context for the team" /></div>
        </FormSection>
      </FormDialogShell>
    </div>
  );
}
