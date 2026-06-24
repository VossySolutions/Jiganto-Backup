import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FormDialogShell, FormSection, FieldGrid, FieldLabel, FormDivider } from "@/components/ui/form-dialog-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, Download, UserCheck, List, Grid3X3, MapPin, Pencil, UserRound, Building2, DollarSign, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials, getProficiencyConfig, statusColors, PERSON_TYPES, RESOURCE_STATUSES } from "./constants";
import { ResourceProfilePanel } from "./ResourceProfilePanel";
import { ResourcesTableSkeleton, ResourcesEmptyState } from "./ResourcesUi";
import type { Resource, Skill, SkillCategory, ResourceSkill } from "@shared/models/resources";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";

const emptyForm = () => ({
  firstName: "", lastName: "", email: "", phone: "", jobTitle: "", department: "", location: "",
  personType: "employee", employmentType: "full-time", status: "active", fte: "1.0",
  costRate: "", billRate: "", currency: "GBP", rateCardId: "", costCentre: "", payrollId: "",
  workingDaysPerWeek: "5", dailyHours: "8", weeklyCapacityHours: "40", holidayEntitlement: "",
  noticePeriodDays: "", timeZone: "", startDate: "", endDate: "", notes: "", internalNotes: "",
  rightToWorkStatus: "incomplete", reportsToId: "",
});

type Props = {
  resources: Resource[];
  skills: Skill[];
  skillCategories: SkillCategory[];
  resourceSkills: Record<number, ResourceSkill[]>;
  skillsMapLoading?: boolean;
  searchTerm: string;
  initialFilter?: string;
  initialProfileId?: number | null;
  onProfileOpened?: () => void;
  utilByResource?: Record<number, number>;
  onCreate: (data: object) => void;
  onUpdate: (id: number, data: object) => void;
  onDelete: (id: number) => void;
  onAddSkill: (data: object) => void;
  onRemoveSkill: (id: number) => void;
  canManage?: boolean;
};

export function ResourcesPeopleTab({
  resources, skills, skillCategories, resourceSkills, skillsMapLoading = false,
  searchTerm, initialFilter, initialProfileId, onProfileOpened, utilByResource = {},
  onCreate, onUpdate, onDelete, onAddSkill, onRemoveSkill, canManage = true,
}: Props) {
  const { toast } = useToast();
  const csvRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(initialFilter === "bench" ? "bench" : "all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [skillFilter, setSkillFilter] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [selected, setSelected] = useState<Resource | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  const { data: rateCards = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/resources/rate-cards"],
  });

  useEffect(() => {
    if (initialProfileId) {
      const r = resources.find((res) => res.id === initialProfileId);
      if (r) {
        setSelected(r);
        setShowProfile(true);
        onProfileOpened?.();
      }
    }
  }, [initialProfileId, resources, onProfileOpened]);

  const departments = useMemo(() => Array.from(new Set(resources.map((r) => r.department).filter(Boolean))), [resources]);

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      if (typeFilter !== "all" && r.personType !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (deptFilter !== "all" && r.department !== deptFilter) return false;
      if (skillFilter) {
        const rs = resourceSkills[r.id] ?? [];
        const match = rs.some((s) => skills.find((sk) => sk.id === s.skillId)?.name.toLowerCase().includes(skillFilter.toLowerCase()));
        if (!match) return false;
      }
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        if (![r.firstName, r.lastName, r.email, r.jobTitle, r.department].some((v) => (v || "").toLowerCase().includes(t))) return false;
      }
      return true;
    });
  }, [resources, typeFilter, statusFilter, deptFilter, skillFilter, searchTerm, resourceSkills, skills]);

  const pagination = useTablePagination(filtered, {
    resetKey: `${typeFilter}-${statusFilter}-${deptFilter}-${skillFilter}-${searchTerm}`,
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setShowDialog(true); };
  const openEdit = (r: Resource) => {
    setEditing(r);
    setForm({
      firstName: r.firstName, lastName: r.lastName, email: r.email ?? "", phone: r.phone ?? "",
      jobTitle: r.jobTitle ?? "", department: r.department ?? "", location: r.location ?? "",
      personType: r.personType ?? "employee", employmentType: r.employmentType ?? "full-time",
      status: r.status ?? "active", fte: r.fte ?? "1.0", costRate: r.costRate ?? "", billRate: r.billRate ?? "",
      currency: r.currency ?? "GBP", rateCardId: r.rateCardId ? String(r.rateCardId) : "",
      costCentre: r.costCentre ?? "", payrollId: r.payrollId ?? "",
      workingDaysPerWeek: r.workingDaysPerWeek ?? "5", dailyHours: r.dailyHours ?? "8",
      weeklyCapacityHours: r.weeklyCapacityHours ?? "40", holidayEntitlement: r.holidayEntitlement ? String(r.holidayEntitlement) : "",
      noticePeriodDays: r.noticePeriodDays ? String(r.noticePeriodDays) : "",
      timeZone: r.timeZone ?? "",       startDate: r.startDate ? String(r.startDate).slice(0, 10) : "",
      endDate: r.endDate ? String(r.endDate).slice(0, 10) : "", notes: r.notes ?? "", internalNotes: r.internalNotes ?? "",
      rightToWorkStatus: r.rightToWorkStatus ?? "incomplete",
      reportsToId: r.reportsToId ? String(r.reportsToId) : "",
    });
    setShowDialog(true);
  };

  const save = () => {
    const payload = {
      ...form,
      rateCardId: form.rateCardId ? Number(form.rateCardId) : null,
      holidayEntitlement: form.holidayEntitlement ? Number(form.holidayEntitlement) : null,
      noticePeriodDays: form.noticePeriodDays ? Number(form.noticePeriodDays) : null,
      reportsToId: form.reportsToId ? Number(form.reportsToId) : null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };
    if (editing) onUpdate(editing.id, payload);
    else onCreate(payload);
    setShowDialog(false);
  };

  const exportCsv = () => {
    const headers = ["First Name", "Last Name", "Email", "Type", "Job Title", "Department", "Status", "Utilisation %"];
    const rows = filtered.map((r) => [
      r.firstName, r.lastName, r.email ?? "", r.personType ?? "", r.jobTitle ?? "", r.department ?? "",
      r.status ?? "", utilByResource[r.id] ?? 0,
    ]);
    const csv = [headers.join(","), ...rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "people-export.csv";
    a.click();
    toast({ title: "Exported to CSV" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}><List className="h-4 w-4 mr-1" /> Table</Button>
          <Button variant={viewMode === "cards" ? "default" : "outline"} size="sm" onClick={() => setViewMode("cards")}><Grid3X3 className="h-4 w-4 mr-1" /> Cards</Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => csvRef.current?.click()}><Upload className="h-4 w-4 mr-1" /> Import CSV</Button>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export</Button>
          {canManage && <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Person</Button>}
          <input ref={csvRef} type="file" accept=".csv" className="hidden" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {PERSON_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            {RESOURCE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => <SelectItem key={d} value={d!}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="w-48" placeholder="Filter by skill..." value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} />
      </div>

      {skillsMapLoading ? (
        <ResourcesTableSkeleton rows={8} cols={7} />
      ) : viewMode === "list" ? (
        filtered.length === 0 ? (
          <ResourcesEmptyState title="No people match your filters" description="Try adjusting filters or add a new person." />
        ) : (
        <Card className="rounded-xl border-border/50 overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Role / Dept</th>
                  <th className="text-left p-3">Skills</th>
                  <th className="text-left p-3">Util %</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map((r) => {
                  const rSkills = resourceSkills[r.id] ?? [];
                  const util = utilByResource[r.id] ?? 0;
                  return (
                    <tr key={r.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => { setSelected(r); setShowProfile(true); }}>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={r.photoUrl ?? undefined} />
                            <AvatarFallback className="text-xs">{getInitials(r.firstName, r.lastName)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{r.firstName} {r.lastName}</p>
                            <p className="text-xs text-muted-foreground">{r.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 capitalize">{r.personType ?? "employee"}</td>
                      <td className="p-3"><p>{r.jobTitle}</p><p className="text-xs text-muted-foreground">{r.department}</p></td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {rSkills.slice(0, 3).map((rs) => {
                            const sk = skills.find((s) => s.id === rs.skillId);
                            return <Badge key={rs.id} variant="outline" className="text-xs">{sk?.name}</Badge>;
                          })}
                        </div>
                      </td>
                      <td className="p-3">{util}%</td>
                      <td className="p-3"><Badge className={cn("text-xs", statusColors[r.status ?? "active"])}>{r.status}</Badge></td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)}><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              startIndex={pagination.startIndex}
              endIndex={pagination.endIndex}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          </CardContent>
        </Card>
        )
      ) : filtered.length === 0 ? (
        <ResourcesEmptyState title="No people match your filters" />
      ) : (
        <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {pagination.paginatedItems.map((r) => (
            <Card key={r.id} className="cursor-pointer hover:shadow-md rounded-xl border-border/50 transition-shadow" onClick={() => { setSelected(r); setShowProfile(true); }}>
              <CardContent className="p-4 text-center">
                <Avatar className="h-16 w-16 mx-auto mb-2">
                  <AvatarImage src={r.photoUrl ?? undefined} />
                  <AvatarFallback>{getInitials(r.firstName, r.lastName)}</AvatarFallback>
                </Avatar>
                <p className="font-semibold">{r.firstName} {r.lastName}</p>
                <p className="text-sm text-muted-foreground">{r.jobTitle}</p>
                <Badge className="mt-2 text-xs capitalize">{r.personType ?? "employee"}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
        <TablePagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
        </div>
      )}

      {showProfile && selected && (
        <ResourceProfilePanel
          resource={selected}
          skills={skills}
          resourceSkills={resourceSkills[selected.id] ?? []}
          onClose={() => setShowProfile(false)}
          onEdit={() => { setShowProfile(false); openEdit(selected); }}
          onAddSkill={onAddSkill}
          onRemoveSkill={onRemoveSkill}
        />
      )}

      <FormDialogShell
        open={showDialog}
        onOpenChange={setShowDialog}
        title={editing ? "Edit person" : "Add person"}
        subtitle={editing ? `${form.firstName} ${form.lastName}`.trim() : "Add a team member or contractor to your resource pool"}
        saveLabel={editing ? "Save changes" : "Create person"}
        onCancel={() => setShowDialog(false)}
        onSubmit={save}
        disabled={!form.firstName || !form.lastName}
        size="lg"
      >
        <FormSection icon={<UserRound className="h-3.5 w-3.5 text-blue-600" />} iconClassName="bg-blue-50 dark:bg-blue-950/40" title="Personal details">
          <FieldGrid className="mb-3.5">
            <div className="space-y-1.5"><FieldLabel required>First name</FieldLabel><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
            <div className="space-y-1.5"><FieldLabel required>Last name</FieldLabel><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
          </FieldGrid>
          <FieldGrid>
            <div className="space-y-1.5"><FieldLabel>Email</FieldLabel><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><FieldLabel>Phone</FieldLabel><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </FieldGrid>
        </FormSection>

        <FormDivider />

        <FormSection icon={<Building2 className="h-3.5 w-3.5 text-emerald-600" />} iconClassName="bg-emerald-50 dark:bg-emerald-950/40" title="Role & organisation">
          <FieldGrid className="mb-3.5">
            <div className="space-y-1.5"><FieldLabel>Type</FieldLabel>
              <Select value={form.personType} onValueChange={(v) => setForm({ ...form, personType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PERSON_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><FieldLabel>Status</FieldLabel>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RESOURCE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </FieldGrid>
          <FieldGrid className="mb-3.5">
            <div className="space-y-1.5"><FieldLabel>Job title</FieldLabel><Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></div>
            <div className="space-y-1.5"><FieldLabel>Department</FieldLabel><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
          </FieldGrid>
          <FieldGrid>
            <div className="space-y-1.5"><FieldLabel>Reports to</FieldLabel>
              <Select value={form.reportsToId || "none"} onValueChange={(v) => setForm({ ...form, reportsToId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {resources.filter((r) => !editing || r.id !== editing.id).map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.firstName} {r.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><FieldLabel>Location</FieldLabel><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          </FieldGrid>
        </FormSection>

        <FormDivider />

        <FormSection icon={<DollarSign className="h-3.5 w-3.5 text-amber-600" />} iconClassName="bg-amber-50 dark:bg-amber-950/40" title="Rates & capacity">
          <FieldGrid className="mb-3.5">
            <div className="space-y-1.5"><FieldLabel>FTE</FieldLabel><Input type="number" step="0.1" min="0.1" max="1" value={form.fte} onChange={(e) => setForm({ ...form, fte: e.target.value })} /></div>
            <div className="space-y-1.5"><FieldLabel>Rate card</FieldLabel>
              <Select value={form.rateCardId || "none"} onValueChange={(v) => setForm({ ...form, rateCardId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {rateCards.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </FieldGrid>
          <FieldGrid>
            <div className="space-y-1.5"><FieldLabel>Charge rate (daily)</FieldLabel><Input value={form.billRate} onChange={(e) => setForm({ ...form, billRate: e.target.value })} /></div>
            <div className="space-y-1.5"><FieldLabel>Cost rate (daily)</FieldLabel><Input value={form.costRate} onChange={(e) => setForm({ ...form, costRate: e.target.value })} /></div>
          </FieldGrid>
          <div className="space-y-1.5 mt-3.5"><FieldLabel>Cost centre</FieldLabel><Input value={form.costCentre} onChange={(e) => setForm({ ...form, costCentre: e.target.value })} /></div>
        </FormSection>

        <FormDivider />

        <FormSection icon={<Clock className="h-3.5 w-3.5 text-violet-600" />} iconClassName="bg-violet-50 dark:bg-violet-950/40" title="Dates & notes">
          <FieldGrid className="mb-3.5">
            <div className="space-y-1.5"><FieldLabel>Start date</FieldLabel><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="space-y-1.5"><FieldLabel>End date</FieldLabel><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          </FieldGrid>
          <div className="space-y-1.5"><FieldLabel>Internal notes</FieldLabel><Textarea value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} rows={3} /></div>
        </FormSection>
      </FormDialogShell>
    </div>
  );
}
