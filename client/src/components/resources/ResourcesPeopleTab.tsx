import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialogShell, FormSection, FieldGrid, FieldLabel, FormDivider } from "@/components/ui/form-dialog-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Trash2, Pencil, UserRound, Building2, DollarSign, Clock,
  Network, Workflow, Target, AlertTriangle, Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import { Label } from "@/components/ui/label";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MondayBoardShell } from "@/components/board";
import { useMondayBoardShellState } from "@/hooks/use-monday-board-shell-state";
import { matchBoardFilterValue } from "@/lib/board-filters";
import { useDebouncedValue, downloadBoardCsv, downloadImportTemplateCsv } from "@/lib/crm-monday-chrome";
import {
  PERSON_TYPES, RESOURCE_STATUSES, STATUS_FILTERS,
  getTypeConfig, getEffectiveStatus, daysUntilExpiry, STATUS_CONFIG, PERSON_TYPE_CONFIG,
  type EffectiveStatus,
} from "./constants";
import { ResourceProfilePanel } from "./ResourceProfilePanel";
import { ResourcesTableSkeleton, ResourcesEmptyState, TypeBadge, PersonAvatar, UtilBar } from "./ResourcesUi";
import type { Resource, Skill, SkillCategory, ResourceSkill, ResourceAllocation } from "@shared/models/resources";

const emptyForm = () => ({
  firstName: "", lastName: "", email: "", phone: "", jobTitle: "", department: "", location: "",
  personType: "employee", employmentType: "full-time", status: "active", fte: "1.0",
  costRate: "", billRate: "", currency: "GBP", rateCardId: "", costCentre: "", payrollId: "",
  workingDaysPerWeek: "5", dailyHours: "8", weeklyCapacityHours: "40", holidayEntitlement: "",
  noticePeriodDays: "", timeZone: "", startDate: "", endDate: "", notes: "", internalNotes: "",
  rightToWorkStatus: "incomplete", reportsToId: "",
});

type ViewMode = "table" | "hierarchy" | "org" | "project";

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
  onCreate: (data: object, opts?: { onSuccess?: () => void; onError?: (err: Error) => void }) => void;
  onUpdate: (id: number, data: object, opts?: { onSuccess?: () => void; onError?: (err: Error) => void }) => void;
  onDelete: (id: number) => void;
  onAddSkill: (data: object) => void;
  onRemoveSkill: (id: number) => void;
  canManage?: boolean;
};

function fmtDate(d?: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/* ── Shared visual atoms ─────────────────────────────────────── */

function StatusBadge({ status }: { status: EffectiveStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}

/* ── Legend ──────────────────────────────────────────────────── */

function Legend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
      {Object.values(PERSON_TYPE_CONFIG).map((c) => (
        <span key={c.label} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: c.dot }} />
          {c.label}
        </span>
      ))}
      <span className="mx-1 hidden h-3 w-px bg-border sm:inline-block" />
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_CONFIG.active.dot }} /> Active</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_CONFIG.expiring.dot }} /> Expiring &lt;30 days</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_CONFIG.expired.dot }} /> Expired</span>
    </div>
  );
}

/* ── Hierarchy view (reporting lines, left → right) ──────────── */

type PersonNode = Resource & { children: PersonNode[] };

function buildTree(people: Resource[]): PersonNode[] {
  const map = new Map<number, PersonNode>();
  people.forEach((p) => map.set(p.id, { ...p, children: [] }));
  const roots: PersonNode[] = [];
  map.forEach((node) => {
    if (node.reportsToId && map.has(node.reportsToId)) {
      map.get(node.reportsToId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function HierarchyNode({ node, onOpen, util }: { node: PersonNode; onOpen: (r: Resource) => void; util: Record<number, number> }) {
  const eff = getEffectiveStatus(node.status, node.endDate);
  return (
    <div className="flex items-start">
      <button
        type="button"
        onClick={() => onOpen(node)}
        className="w-[210px] shrink-0 rounded-xl border border-border/60 bg-card p-2.5 text-left transition-all hover:border-primary/40 hover:shadow-sm"
      >
        <div className="mb-1.5 flex items-center gap-2">
          <PersonAvatar r={node} className="h-7 w-7" />
          <div className="min-w-0">
            <p className="truncate text-xs font-bold">{node.firstName} {node.lastName}</p>
            <p className="truncate text-[10px] text-muted-foreground">{node.jobTitle ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <TypeBadge type={node.personType} />
          <UtilBar util={util[node.id] ?? 0} width={40} />
        </div>
        {(eff === "expiring" || eff === "expired") && (
          <div className="mt-1.5"><StatusBadge status={eff} /></div>
        )}
      </button>
      {node.children.length > 0 && (
        <div className="relative flex flex-col gap-3 pl-8 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border">
          {node.children.map((child) => (
            <div
              key={child.id}
              className="relative before:absolute before:-left-8 before:top-5 before:h-px before:w-8 before:bg-border"
            >
              <HierarchyNode node={child} onOpen={onOpen} util={util} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HierarchyView({ roots, onOpen, util }: { roots: PersonNode[]; onOpen: (r: Resource) => void; util: Record<number, number> }) {
  return (
    <Card className="rounded-xl border-border/50">
      <CardContent className="p-4 sm:p-6">
        <p className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Workflow className="h-3.5 w-3.5" /> Reporting lines, left to right. Click any card to open the full profile.
        </p>
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max flex-col gap-4">
            {roots.map((root) => (
              <HierarchyNode key={root.id} node={root} onOpen={onOpen} util={util} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Org chart view (top → bottom) ───────────────────────────── */

function OrgNode({ node, onOpen, util }: { node: PersonNode; onOpen: (r: Resource) => void; util: Record<number, number> }) {
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => onOpen(node)}
        className="w-[170px] rounded-xl border border-border/60 bg-card p-3 text-center transition-all hover:border-primary/40 hover:shadow-sm"
      >
        <PersonAvatar r={node} className="mx-auto mb-1.5 h-10 w-10" />
        <p className="truncate text-xs font-bold">{node.firstName} {node.lastName}</p>
        <p className="truncate text-[10px] text-muted-foreground">{node.jobTitle ?? "—"}</p>
        <div className="mt-1.5 flex justify-center"><TypeBadge type={node.personType} /></div>
        <div className="mt-2 flex justify-center"><UtilBar util={util[node.id] ?? 0} width={50} /></div>
      </button>
      {node.children.length > 0 && (
        <>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-start gap-4 border-t border-border pt-8 [&>*]:relative [&>*]:before:absolute [&>*]:before:-top-8 [&>*]:before:left-1/2 [&>*]:before:h-8 [&>*]:before:w-px [&>*]:before:bg-border">
            {node.children.map((child) => (
              <OrgNode key={child.id} node={child} onOpen={onOpen} util={util} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OrgView({ roots, onOpen, util }: { roots: PersonNode[]; onOpen: (r: Resource) => void; util: Record<number, number> }) {
  return (
    <Card className="rounded-xl border-border/50">
      <CardContent className="p-4 sm:p-6">
        <p className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Network className="h-3.5 w-3.5" /> Reporting structure, top to bottom. Click any card to open the full profile.
        </p>
        <div className="overflow-auto">
          <div className="flex min-w-max justify-center gap-8 px-4 py-2">
            {roots.map((root) => (
              <OrgNode key={root.id} node={root} onOpen={onOpen} util={util} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Project view (per-project reporting lines) ──────────────── */

type ProjectMember = { resource: Resource; role: string | null; reportsTo: number | null; children: ProjectMember[] };

function ProjectNode({ node, onOpen, util }: { node: ProjectMember; onOpen: (r: Resource) => void; util: Record<number, number> }) {
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => onOpen(node.resource)}
        className="w-[170px] rounded-xl border border-border/60 bg-card p-3 text-center transition-all hover:border-primary/40 hover:shadow-sm"
      >
        <PersonAvatar r={node.resource} className="mx-auto mb-1.5 h-10 w-10" />
        <p className="truncate text-xs font-bold">{node.resource.firstName} {node.resource.lastName}</p>
        <p className="truncate text-[10px] text-muted-foreground">{node.role ?? node.resource.jobTitle ?? "—"}</p>
        <div className="mt-1.5 flex justify-center"><TypeBadge type={node.resource.personType} /></div>
        <div className="mt-2 flex justify-center"><UtilBar util={util[node.resource.id] ?? 0} width={50} /></div>
      </button>
      {node.children.length > 0 && (
        <>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-start gap-4 border-t border-border pt-8 [&>*]:relative [&>*]:before:absolute [&>*]:before:-top-8 [&>*]:before:left-1/2 [&>*]:before:h-8 [&>*]:before:w-px [&>*]:before:bg-border">
            {node.children.map((c) => (
              <ProjectNode key={c.resource.id} node={c} onOpen={onOpen} util={util} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProjectView({
  resources, allocations, onOpen, util,
}: { resources: Resource[]; allocations: ResourceAllocation[]; onOpen: (r: Resource) => void; util: Record<number, number> }) {
  const resourceById = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);

  const projects = useMemo(() => {
    const active = allocations.filter((a) => a.status === "active");
    const groups = new Map<string, { name: string; members: Map<number, ProjectMember> }>();

    for (const a of active) {
      const resource = resourceById.get(a.resourceId);
      if (!resource) continue;
      const key = a.projectId != null ? `p${a.projectId}` : `n:${a.projectName ?? "Unassigned"}`;
      if (!groups.has(key)) groups.set(key, { name: a.projectName ?? "Unnamed project", members: new Map() });
      const g = groups.get(key)!;
      if (!g.members.has(a.resourceId)) {
        g.members.set(a.resourceId, { resource, role: a.role, reportsTo: a.projectReportsToId ?? null, children: [] });
      }
    }

    // Build a reporting tree per project using projectReportsToId (only when the target is on the same project).
    return Array.from(groups.values()).map((g) => {
      const roots: ProjectMember[] = [];
      for (const member of g.members.values()) {
        const parent = member.reportsTo != null ? g.members.get(member.reportsTo) : undefined;
        if (parent && parent.resource.id !== member.resource.id) parent.children.push(member);
        else roots.push(member);
      }
      return { name: g.name, count: g.members.size, roots };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [allocations, resourceById]);

  if (projects.length === 0) {
    return <ResourcesEmptyState icon={Briefcase} title="No active project assignments" description="Allocate people to projects (Capacity tab) and set their project reporting line to build this view." />;
  }

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Briefcase className="h-3.5 w-3.5" /> Project reporting lines. A person can report to a different manager per project than their org line manager.
      </p>
      {projects.map((proj) => (
        <Card key={proj.name} className="rounded-xl border-border/50">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-md bg-primary/10 p-1.5 text-primary"><Briefcase className="h-4 w-4" /></span>
              <div>
                <p className="text-sm font-bold">{proj.name}</p>
                <p className="text-[11px] text-muted-foreground">{proj.count} {proj.count === 1 ? "person" : "people"} allocated</p>
              </div>
            </div>
            <div className="overflow-auto">
              <div className="flex min-w-max justify-center gap-8 px-4 py-2">
                {proj.roots.map((root) => (
                  <ProjectNode key={root.resource.id} node={root} onOpen={onOpen} util={util} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────── */

export function ResourcesPeopleTab({
  resources, skills, resourceSkills, skillsMapLoading = false,
  searchTerm, initialProfileId, onProfileOpened, utilByResource = {},
  onCreate, onUpdate, onDelete, onAddSkill, onRemoveSkill, canManage = true,
}: Props) {
  const { toast } = useToast();
  const [localSearch, setLocalSearch] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm || localSearch);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [pinName, setPinName] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("resources-people-pin-name") !== "0";
  });
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [skillFilter, setSkillFilter] = useState("");
  const [includeExpired, setIncludeExpired] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [selected, setSelected] = useState<Resource | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  const { data: rateCards = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/resources/rate-cards"],
  });

  const { data: allocations = [] } = useQuery<ResourceAllocation[]>({
    queryKey: ["/api/resources/allocations"],
    staleTime: 30_000,
    enabled: viewMode === "project",
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

  const departments = useMemo(
    () => Array.from(new Set(resources.map((r) => r.department).filter(Boolean))) as string[],
    [resources],
  );

  const resourceById = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);
  const managerName = (r: Resource) => {
    if (!r.reportsToId) return "—";
    const m = resourceById.get(r.reportsToId);
    return m ? `${m.firstName} ${m.lastName}` : "—";
  };

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      const eff = getEffectiveStatus(r.status, r.endDate);
      if (!includeExpired && eff === "expired") return false;
      if (typeFilter !== "all" && r.personType !== typeFilter) return false;
      if (statusFilter !== "all" && eff !== statusFilter) return false;
      if (deptFilter !== "all" && r.department !== deptFilter) return false;
      if (skillFilter) {
        const rs = resourceSkills[r.id] ?? [];
        const match = rs.some((s) => skills.find((sk) => sk.id === s.skillId)?.name.toLowerCase().includes(skillFilter.toLowerCase()));
        if (!match) return false;
      }
      if (searchTerm) {
        const t = debouncedSearch.toLowerCase();
        if (![r.firstName, r.lastName, r.email, r.jobTitle, r.department].some((v) => (v || "").toLowerCase().includes(t))) return false;
      }
      return true;
    });
  }, [resources, typeFilter, statusFilter, deptFilter, skillFilter, debouncedSearch, searchTerm, resourceSkills, skills, includeExpired]);

  // Hierarchy / org views show the whole structure, gated only by the "include expired" toggle.
  const treePeople = useMemo(
    () => (includeExpired ? resources : resources.filter((r) => getEffectiveStatus(r.status, r.endDate) !== "expired")),
    [resources, includeExpired],
  );
  const roots = useMemo(() => buildTree(treePeople), [treePeople]);

  const openProfile = (r: Resource) => { setSelected(r); setShowProfile(true); };

  const mondayColumns: MondayColumnDef<Resource>[] = useMemo(() => [
    {
      id: "name",
      header: "Name",
      type: "text",
      accessor: (row) => `${row.firstName} ${row.lastName}`,
      width: "240px",
      sticky: pinName,
      editable: false, // combined first+last — edit via dialog
      render: (r) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <PersonAvatar r={r} className="h-8 w-8" />
          <div className="min-w-0">
            <p className="font-semibold truncate">{r.firstName} {r.lastName}</p>
            <p className="truncate text-xs text-muted-foreground">{r.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      type: "status",
      accessor: "personType",
      width: "120px",
      editable: !!canManage,
      options: PERSON_TYPES.map((t) => ({ value: t.value, label: t.label })),
      render: (r) => <TypeBadge type={r.personType} />,
    },
    {
      id: "role",
      header: "Role / Department",
      type: "text",
      accessor: (row) => row.jobTitle || "",
      width: "180px",
      editable: !!canManage,
      render: (r) => (
        <div>
          <p className="font-medium text-sm">{r.jobTitle ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{r.department ?? "—"}</p>
        </div>
      ),
    },
    {
      id: "manager",
      header: "Manager",
      type: "person",
      accessor: (row) => row.reportsToId,
      width: "140px",
      editable: false,
      render: (r) => <span className="text-xs text-muted-foreground">{managerName(r)}</span>,
    },
    {
      id: "skills",
      header: "Skills",
      type: "number",
      accessor: (row) => (resourceSkills[row.id] ?? []).length,
      width: "110px",
      editable: false,
      render: (r) => {
        const rSkills = resourceSkills[r.id] ?? [];
        return (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={(e) => { e.stopPropagation(); setSelected(r); setShowProfile(true); }}
          >
            <Target className="h-3 w-3" /> Skills
            <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{rSkills.length}</span>
          </button>
        );
      },
    },
    {
      id: "startDate",
      header: "Start date",
      type: "date",
      accessor: "startDate",
      width: "110px",
      editable: !!canManage,
      render: (r) => <span className="text-xs tabular-nums">{fmtDate(r.startDate)}</span>,
    },
    {
      id: "endDate",
      header: "Expiry date",
      type: "date",
      accessor: "endDate",
      width: "120px",
      editable: !!canManage,
      render: (r) => {
        const eff = getEffectiveStatus(r.status, r.endDate);
        const daysLeft = daysUntilExpiry(r.endDate);
        return r.endDate ? (
          <span className={cn("inline-flex items-center gap-1 text-xs tabular-nums font-medium", eff === "expired" && "text-red-600", eff === "expiring" && "text-amber-600")}>
            {fmtDate(r.endDate)}
            {eff === "expiring" && daysLeft != null && <AlertTriangle className="h-3 w-3" />}
          </span>
        ) : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      id: "util",
      header: "Util %",
      type: "progress",
      accessor: (row) => utilByResource[row.id] ?? 0,
      width: "100px",
      editable: false,
      render: (r) => <UtilBar util={utilByResource[r.id] ?? 0} />,
    },
    {
      id: "status",
      header: "Status",
      type: "status",
      accessor: "status",
      width: "110px",
      editable: !!canManage,
      options: RESOURCE_STATUSES.map((s) => ({ value: s.value, label: s.label })),
      render: (r) => <StatusBadge status={getEffectiveStatus(r.status, r.endDate)} />,
    },
  ], [resourceSkills, utilByResource, resourceById, pinName, canManage]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setShowDialog(true); };
  const openEdit = (r: Resource) => {
    setEditing(r);
    setForm({
      firstName: r.firstName, lastName: r.lastName, email: r.email ?? "", phone: r.phone ?? "",
      jobTitle: r.jobTitle ?? "", department: r.department ?? "", location: r.location ?? "",
      personType: r.personType ?? "employee", employmentType: r.employmentType ?? "full-time",
      status: r.status === "inactive" ? "inactive" : "active", fte: r.fte ?? "1.0", costRate: r.costRate ?? "", billRate: r.billRate ?? "",
      currency: r.currency ?? "GBP", rateCardId: r.rateCardId ? String(r.rateCardId) : "",
      costCentre: r.costCentre ?? "", payrollId: r.payrollId ?? "",
      workingDaysPerWeek: r.workingDaysPerWeek ?? "5", dailyHours: r.dailyHours ?? "8",
      weeklyCapacityHours: r.weeklyCapacityHours ?? "40", holidayEntitlement: r.holidayEntitlement ? String(r.holidayEntitlement) : "",
      noticePeriodDays: r.noticePeriodDays ? String(r.noticePeriodDays) : "",
      timeZone: r.timeZone ?? "", startDate: r.startDate ? String(r.startDate).slice(0, 10) : "",
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
    const closeDialog = () => {
      setShowDialog(false);
      setEditing(null);
      setForm(emptyForm());
    };
    if (editing) {
      onUpdate(editing.id, payload, { onSuccess: closeDialog });
    } else {
      onCreate(payload, { onSuccess: closeDialog });
    }
  };

  const PEOPLE_CSV_HEADERS = ["First Name", "Last Name", "Email", "Type", "Job Title", "Department", "Manager", "Start Date", "Expiry Date", "Status", "Utilisation %"];

  const exportCsv = () => {
    const rows = filtered.map((r) => [
      r.firstName, r.lastName, r.email ?? "", getTypeConfig(r.personType).label, r.jobTitle ?? "", r.department ?? "",
      managerName(r), r.startDate ? fmtDate(r.startDate) : "", r.endDate ? fmtDate(r.endDate) : "",
      STATUS_CONFIG[getEffectiveStatus(r.status, r.endDate)].label, String(utilByResource[r.id] ?? 0),
    ]);
    downloadBoardCsv("people-export.csv", PEOPLE_CSV_HEADERS, rows);
    toast({ title: "Exported to CSV" });
  };

  const downloadPeopleTemplate = () => {
    downloadImportTemplateCsv("people-import-template.csv", PEOPLE_CSV_HEADERS, PEOPLE_CSV_HEADERS.map(() => ""));
    toast({ title: "Import template downloaded" });
  };

  const importUnavailable = () => toast({ title: "Import is not available for this table yet" });

  const paginationResetKey = `${typeFilter}|${statusFilter}|${deptFilter}|${skillFilter}|${debouncedSearch}|${includeExpired}`;

  return (
    <div className="space-y-4">
      <MondayBoardShell.Legacy
        storageKey="jiganto-resources-people"
        entityType="resource_person"
        stateHook={useMondayBoardShellState}
        filterMatcher={matchBoardFilterValue}
      >
      <MondayBoardShell.Toolbar
        newLabel="Add person"
        onNew={canManage ? openCreate : undefined}
        searchValue={localSearch || searchTerm}
        onSearchChange={setLocalSearch}
        viewLabel={viewMode === "table" ? "Table" : viewMode === "hierarchy" ? "Hierarchy" : viewMode === "org" ? "Org Chart" : "Project"}
        viewMenu={
          <>
            <DropdownMenuItem onClick={() => setViewMode("table")} data-testid="view-table">Table</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setViewMode("hierarchy")} data-testid="view-hierarchy">Hierarchy</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setViewMode("org")} data-testid="view-org">Org Chart</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setViewMode("project")} data-testid="view-project">Project</DropdownMenuItem>
          </>
        }
        filterActive={typeFilter !== "all" || statusFilter !== "all" || deptFilter !== "all" || !!skillFilter || includeExpired}
        filterCount={(typeFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0) + (deptFilter !== "all" ? 1 : 0) + (skillFilter ? 1 : 0) + (includeExpired ? 1 : 0)}
        filterContent={
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {PERSON_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {STATUS_FILTERS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Department</Label>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Skill</Label>
              <Input className="h-8 text-xs" placeholder="Filter by skill..." value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={includeExpired} onCheckedChange={(v) => setIncludeExpired(Boolean(v))} data-testid="toggle-include-expired" />
              Include expired
            </label>
          </div>
        }
        grouped={viewMode === "table"}
        pinActive={pinName}
        onPinToggle={() => {
          setPinName((v) => {
            const next = !v;
            localStorage.setItem("resources-people-pin-name", next ? "1" : "0");
            return next;
          });
        }}
        pinTitle={pinName ? "Unpin Name column" : "Pin Name column"}
        onExport={exportCsv}
        onDownloadTemplate={downloadPeopleTemplate}
        onPaste={importUnavailable}
        onImport={importUnavailable}
        testId="resources-people-toolbar"
      />

      <Legend />

      {skillsMapLoading ? (
        <ResourcesTableSkeleton rows={8} cols={9} />
      ) : viewMode === "hierarchy" ? (
        roots.length === 0
          ? <ResourcesEmptyState icon={Workflow} title="No people to show" description="Add people and set their Reports To field to build the hierarchy." />
          : <HierarchyView roots={roots} onOpen={openProfile} util={utilByResource} />
      ) : viewMode === "org" ? (
        roots.length === 0
          ? <ResourcesEmptyState icon={Network} title="No people to show" description="Add people and set their Reports To field to build the org chart." />
          : <OrgView roots={roots} onOpen={openProfile} util={utilByResource} />
      ) : viewMode === "project" ? (
        <ProjectView resources={resources} allocations={allocations} onOpen={openProfile} util={utilByResource} />
      ) : filtered.length === 0 ? (
        <ResourcesEmptyState title="No people match your filters" description="Try adjusting filters or add a new person." />
      ) : (
        <MondayBoardShell.Table
          columns={mondayColumns}
          data={filtered}
          emptyMessage="No people match your filters."
          addItemLabel="Add person"
          onAddItem={canManage ? openCreate : undefined}
          onRowClick={openProfile}
          onCellEdit={canManage ? (rowId, columnId, value) => {
            const field = columnId === "type" ? "personType" : columnId === "role" ? "jobTitle" : columnId;
            onUpdate(Number(rowId), { [field]: value === "" ? null : value });
          } : undefined}
          searchHighlightTerm={debouncedSearch}
          columnWidthStorageKey="jiganto-resources-people-col-widths"
          paginationResetKey={paginationResetKey}
          totalCount={resources.length}
          renderRowActions={canManage ? (r) => (
            <div className="flex justify-end gap-0">
              <Button variant="ghost" size="icon" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40" onClick={() => openEdit(r)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40" onClick={() => onDelete(r.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : undefined}
        />
      )}

      </MondayBoardShell.Legacy>

      {showProfile && selected && (
        <ResourceProfilePanel
          resource={selected}
          resources={resources}
          allocationsProjectView
          skills={skills}
          resourceSkills={resourceSkills[selected.id] ?? []}
          onClose={() => setShowProfile(false)}
          onEdit={canManage ? () => { setShowProfile(false); openEdit(selected); } : undefined}
          onAddSkill={onAddSkill}
          onRemoveSkill={onRemoveSkill}
        />
      )}

      <FormDialogShell
        open={showDialog}
        onOpenChange={setShowDialog}
        title={editing ? "Edit person" : "Add person"}
        subtitle={editing ? `${form.firstName} ${form.lastName}`.trim() : "Add a team member, contractor, partner or associate to your resource pool"}
        saveLabel={editing ? "Save changes" : "Create person"}
        onCancel={() => setShowDialog(false)}
        onSubmit={save}
        disabled={!form.firstName || !form.lastName}
        size="lg"
      >
        <FormSection icon={<UserRound className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />} iconClassName="bg-blue-50 dark:bg-blue-950/40" title="Personal details">
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

        <FormSection icon={<Building2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />} iconClassName="bg-emerald-50 dark:bg-emerald-950/40" title="Role & organisation">
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
            <div className="space-y-1.5"><FieldLabel>Reports to (line manager)</FieldLabel>
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

        <FormSection icon={<DollarSign className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />} iconClassName="bg-amber-50 dark:bg-amber-950/40" title="Rates & capacity">
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
          <div className="mt-3.5 space-y-1.5"><FieldLabel>Cost centre</FieldLabel><Input value={form.costCentre} onChange={(e) => setForm({ ...form, costCentre: e.target.value })} /></div>
        </FormSection>

        <FormDivider />

        <FormSection icon={<Clock className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />} iconClassName="bg-violet-50 dark:bg-violet-950/40" title="Dates & notes">
          <FieldGrid className="mb-3.5">
            <div className="space-y-1.5"><FieldLabel>Start date</FieldLabel><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="space-y-1.5"><FieldLabel>End / expiry date</FieldLabel><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          </FieldGrid>
          <div className="space-y-1.5"><FieldLabel>Internal notes</FieldLabel><Textarea value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} rows={3} /></div>
        </FormSection>
      </FormDialogShell>
    </div>
  );
}
