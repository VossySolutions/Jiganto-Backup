import { useState, useEffect, useMemo, Fragment } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Grid3X3, Search, Plus, Download, Target, Loader2, Library, ChevronDown, ChevronUp, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  getTypeConfig, PROFICIENCY_LEVELS,
  MATRIX_LEVELS, getMatrixLevel, levelToProficiencyValue,
  ASSESSMENT_SOURCES, getAssessmentSource, type AssessmentSource,
} from "./constants";
import { ResourcesTableSkeleton, ResourcesEmptyState, TypeBadge, PersonAvatar, UtilBar } from "./ResourcesUi";
import { SkillsLibraryDialog } from "./SkillsLibraryDialog";
import type { Resource, Skill, SkillCategory, ResourceSkill, ResourceAllocation } from "@shared/models/resources";

type SearchResult = Resource & { utilisationPct: number; matchingSkills: Array<{ name: string; level: number }> };

type Props = {
  resources: Resource[];
  skills: Skill[];
  categories: SkillCategory[];
  resourceSkills: Record<number, ResourceSkill[]>;
  allocations?: ResourceAllocation[];
  isLoading?: boolean;
  onOpenProfile: (r: Resource) => void;
  initialGapPlanId?: number | null;
};

type GroupDef = { id: string; label: string; color: string; skills: Skill[] };

const byOrderName = (a: Skill, b: Skill) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name);

export function SkillsMatrixTab({ resources, skills, categories, resourceSkills, allocations = [], isLoading, onOpenProfile, initialGapPlanId = null }: Props) {
  const { toast } = useToast();
  const [view, setView] = useState<"matrix" | "search">("matrix");
  const [showLibrary, setShowLibrary] = useState(false);
  const [showGap, setShowGap] = useState(false);
  const [gapPlanId, setGapPlanId] = useState("");
  const [gapResults, setGapResults] = useState<Array<{ role: string; coverage: string; qualifiedCount: number; candidates: string[] }>>([]);
  const [gapLoading, setGapLoading] = useState(false);

  // Search view
  const [searchCriteria, setSearchCriteria] = useState<Array<{ skillId: string; minLevel: string; minYears: string }>>([{ skillId: "", minLevel: "3", minYears: "0" }]);
  const [searchLogic, setSearchLogic] = useState<"and" | "or">("and");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Matrix filters
  const [fDept, setFDept] = useState("all");
  const [fType, setFType] = useState("all");
  const [fMinProf, setFMinProf] = useState("0");
  const [fAvail, setFAvail] = useState("all");
  const [fAssess, setFAssess] = useState("all");
  const [quick, setQuick] = useState("");
  const [highlightIds, setHighlightIds] = useState<number[] | null>(null);

  // Matrix column-group state
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Cell editor
  const [editCell, setEditCell] = useState<{ resource: Resource; skill: Skill } | null>(null);

  /* ── Derived data ─────────────────────────────────────────── */
  const groups = useMemo<GroupDef[]>(() => {
    const byCat = new Map<string, Skill[]>();
    for (const s of skills) {
      const k = String(s.categoryId ?? "none");
      if (!byCat.has(k)) byCat.set(k, []);
      byCat.get(k)!.push(s);
    }
    const order = (list: Skill[]): Skill[] => {
      const tops = list.filter((s) => s.parentSkillId == null).sort(byOrderName);
      const out: Skill[] = [];
      const topIds = new Set(tops.map((t) => t.id));
      for (const t of tops) {
        out.push(t);
        list.filter((s) => s.parentSkillId === t.id).sort(byOrderName).forEach((c) => out.push(c));
      }
      list.filter((s) => s.parentSkillId != null && !topIds.has(s.parentSkillId)).forEach((o) => { if (!out.includes(o)) out.push(o); });
      return out;
    };
    const defs: GroupDef[] = [];
    [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)).forEach((c) => {
      const list = byCat.get(String(c.id));
      if (list?.length) defs.push({ id: String(c.id), label: c.name, color: c.color || "#4338CA", skills: order(list) });
    });
    const none = byCat.get("none");
    if (none?.length) defs.push({ id: "none", label: "Uncategorised", color: "#64748B", skills: order(none) });
    return defs;
  }, [skills, categories]);

  const childIds = useMemo(() => new Set(skills.filter((s) => s.parentSkillId != null).map((s) => s.id)), [skills]);

  const visibleGroups = useMemo(() => groups.filter((g) => !hiddenGroups.has(g.id)), [groups, hiddenGroups]);

  // resourceId -> skillId -> ResourceSkill
  const skillLookup = useMemo(() => {
    const map = new Map<number, Map<number, ResourceSkill>>();
    for (const [rid, list] of Object.entries(resourceSkills)) {
      const inner = new Map<number, ResourceSkill>();
      for (const rs of list) inner.set(rs.skillId, rs);
      map.set(Number(rid), inner);
    }
    return map;
  }, [resourceSkills]);

  const utilByResource = useMemo(() => {
    const m: Record<number, number> = {};
    for (const a of allocations) {
      if (a.status !== "active") continue;
      m[a.resourceId] = (m[a.resourceId] ?? 0) + Number(a.allocationPercentage || 0);
    }
    return m;
  }, [allocations]);

  const utilOf = (r: Resource) => Math.round(utilByResource[r.id] ?? 0);

  const departments = useMemo(() => Array.from(new Set(resources.map((r) => r.department).filter(Boolean))) as string[], [resources]);

  const getLevel = (rid: number, skillId: number): { level: number; assess: AssessmentSource } | null => {
    const rs = skillLookup.get(rid)?.get(skillId);
    if (!rs) return null;
    return { level: rs.skillLevel ?? 3, assess: getAssessmentSource(rs.assessmentType) };
  };

  const bestInGroup = (rid: number, g: GroupDef): { level: number; assess: AssessmentSource } | null => {
    let best: { level: number; assess: AssessmentSource } | null = null;
    for (const s of g.skills) {
      const v = getLevel(rid, s.id);
      if (v && (!best || v.level > best.level)) best = v;
    }
    return best;
  };

  /* ── Filtering ────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const minProf = Number(fMinProf);
    return resources.filter((r) => {
      if (fDept !== "all" && r.department !== fDept) return false;
      if (fType !== "all" && (r.personType ?? "employee") !== fType) return false;
      const util = utilByResource[r.id] ?? 0;
      if (fAvail === "capacity" && util >= 80) return false;
      if (fAvail === "busy" && (util < 80 || util >= 100)) return false;
      if (fAvail === "full" && util < 100) return false;
      const rs = resourceSkills[r.id] ?? [];
      if (minProf > 0 && !rs.some((s) => (s.skillLevel ?? 3) >= minProf)) return false;
      if (fAssess !== "all" && !rs.some((s) => getAssessmentSource(s.assessmentType) === fAssess)) return false;
      return true;
    });
  }, [resources, fDept, fType, fMinProf, fAvail, fAssess, resourceSkills, utilByResource]);

  const grouped = useMemo(() => {
    const m = new Map<string, Resource[]>();
    for (const r of filtered) {
      const d = r.department || "Unassigned";
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(r);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  /* ── Quick find ───────────────────────────────────────────── */
  const runQuickFind = () => {
    const q = quick.toLowerCase().trim();
    if (!q) { setHighlightIds(null); return; }
    const tokens = q.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
    const matches = filtered.filter((r) => tokens.every((token) => {
      if (/avail/.test(token)) return utilOf(r) < 80;
      const lvMatch = token.match(/(?:level\s*)?([1-4])\s*\+?/);
      const minLv = lvMatch ? Number(lvMatch[1]) : 1;
      const skillQuery = token.replace(/level\s*[1-4]\s*\+?|[1-4]\s*\+/g, "").replace(/available?/g, "").trim();
      if (!skillQuery) return true;
      const rs = resourceSkills[r.id] ?? [];
      return rs.some((s) => {
        const skill = skills.find((sk) => sk.id === s.skillId);
        return skill && skill.name.toLowerCase().includes(skillQuery) && (s.skillLevel ?? 3) >= minLv;
      });
    }));
    setHighlightIds(matches.map((r) => r.id));
    toast({ title: `${matches.length} ${matches.length === 1 ? "person" : "people"} match` });
  };

  /* ── Mutations ────────────────────────────────────────────── */
  const upsertSkill = useMutation({
    mutationFn: async (data: { resource: Resource; skill: Skill; level: number; assess: AssessmentSource; notes: string; existingId?: number }) => {
      const payload = {
        skillId: data.skill.id,
        skillLevel: data.level,
        proficiencyLevel: levelToProficiencyValue(data.level),
        assessmentType: data.assess,
        notes: data.notes || null,
      };
      if (data.existingId) return apiRequest("PUT", `/api/resources/${data.resource.id}/skills/${data.existingId}`, payload);
      return apiRequest("POST", `/api/resources/${data.resource.id}/skills`, payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/resources/skills-map"] }); setEditCell(null); toast({ title: "Assessment saved" }); },
    onError: () => toast({ title: "Failed to save assessment", variant: "destructive" }),
  });

  const clearSkill = useMutation({
    mutationFn: (data: { resourceId: number; id: number }) => apiRequest("DELETE", `/api/resources/${data.resourceId}/skills/${data.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/resources/skills-map"] }); setEditCell(null); toast({ title: "Assessment cleared" }); },
  });

  /* ── Search / Gap (kept) ──────────────────────────────────── */
  const runSearch = async () => {
    setSearchLoading(true);
    try {
      const criteria = searchCriteria.filter((c) => c.skillId).map((c) => ({ skillId: Number(c.skillId), minLevel: Number(c.minLevel), minYears: Number(c.minYears) }));
      const res = await apiRequest("POST", "/api/resources/skills/search", { criteria, logic: searchLogic });
      setSearchResults(await res.json());
    } finally { setSearchLoading(false); }
  };

  const runGap = async () => {
    if (!gapPlanId) return;
    setGapLoading(true);
    try {
      const res = await fetch(`/api/resources/skills/gap-analysis/${gapPlanId}`, { credentials: "include" });
      if (res.ok) setGapResults(await res.json());
    } finally { setGapLoading(false); }
  };

  useEffect(() => {
    if (!initialGapPlanId) return;
    setGapPlanId(String(initialGapPlanId));
    setShowGap(true);
    void (async () => {
      setGapLoading(true);
      try {
        const res = await fetch(`/api/resources/skills/gap-analysis/${initialGapPlanId}`, { credentials: "include" });
        if (res.ok) setGapResults(await res.json());
      } finally { setGapLoading(false); }
    })();
  }, [initialGapPlanId]);

  const exportMatrixCsv = () => {
    const cols = visibleGroups.flatMap((g) => expanded.has(g.id) ? g.skills.map((s) => ({ g, s })) : [{ g, s: null as Skill | null }]);
    const header = ["Name", "Role", "Department", "Type", "Utilisation", ...cols.map((c) => c.s ? c.s.name : `${c.g.label} (best)`)];
    const lines = [header.map(csv).join(",")];
    for (const r of filtered) {
      const row = [
        `${r.firstName} ${r.lastName}`, r.jobTitle ?? "", r.department ?? "", getTypeConfig(r.personType).label, `${utilOf(r)}%`,
        ...cols.map((c) => {
          if (c.s) { const v = getLevel(r.id, c.s.id); return v ? String(v.level) : ""; }
          const b = bestInGroup(r.id, c.g); return b ? String(b.level) : "";
        }),
      ];
      lines.push(row.map(csv).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "skills-matrix.csv";
    a.click();
  };

  /* ── Loading / empty ──────────────────────────────────────── */
  if (isLoading) return <ResourcesTableSkeleton rows={10} cols={8} />;

  if (skills.length === 0) {
    return (
      <>
        <Card>
          <CardContent className="py-12 text-center">
            <Library className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="font-medium">No skills defined yet</p>
            <p className="mb-4 text-sm text-muted-foreground">Build your skills library — create your own categories, skills and nested modules.</p>
            <Button onClick={() => setShowLibrary(true)}><Library className="mr-1 h-4 w-4" /> Open skills library</Button>
          </CardContent>
        </Card>
        <SkillsLibraryDialog open={showLibrary} onOpenChange={setShowLibrary} categories={categories} skills={skills} />
      </>
    );
  }

  const totalCols = 4 + visibleGroups.reduce((acc, g) => acc + (expanded.has(g.id) ? g.skills.length : 1), 0);

  /* ── Chip renderer ────────────────────────────────────────── */
  const Chip = ({ level, assess, summary }: { level: number; assess: AssessmentSource; summary?: boolean }) => {
    const cfg = getMatrixLevel(level);
    if (assess === "pending") {
      return <span className={cn("mx-auto flex items-center justify-center rounded font-extrabold", summary ? "h-6 w-10 text-[10px]" : "h-[22px] w-7 text-[11px]")}
        style={{ background: "#FEF3C7", color: "#92400E", border: "1.5px solid #D97706" }}>?</span>;
    }
    return <span className={cn("mx-auto flex items-center justify-center rounded font-extrabold", summary ? "h-6 w-10 text-[10px]" : "h-[22px] w-7 text-[11px]")}
      style={{ background: cfg.bg, color: cfg.text, border: assess === "self" ? `2px dashed ${cfg.text}` : "none" }}>{level}</span>;
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant={view === "matrix" ? "default" : "outline"} size="sm" onClick={() => setView("matrix")}><Grid3X3 className="mr-1 h-4 w-4" /> Matrix</Button>
          <Button variant={view === "search" ? "default" : "outline"} size="sm" onClick={() => setView("search")}><Search className="mr-1 h-4 w-4" /> Search</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {view === "matrix" && <Button variant="outline" size="sm" onClick={exportMatrixCsv}><Download className="mr-1 h-4 w-4" /> Export matrix</Button>}
          <Button variant="outline" size="sm" onClick={() => setShowGap(true)}><Target className="mr-1 h-4 w-4" /> Gap analysis</Button>
          <Button size="sm" onClick={() => setShowLibrary(true)}><Library className="mr-1 h-4 w-4" /> Skills library</Button>
        </div>
      </div>

      {view === "matrix" ? (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-2">
            <FilterSelect label="Department" value={fDept} onChange={setFDept} options={[{ v: "all", l: "All departments" }, ...departments.map((d) => ({ v: d, l: d }))]} />
            <FilterSelect label="Person type" value={fType} onChange={setFType} options={[{ v: "all", l: "All types" }, { v: "employee", l: "Employee" }, { v: "contractor", l: "Contractor" }, { v: "customer", l: "Customer staff" }, { v: "partner", l: "Partner" }, { v: "associate", l: "Associate" }]} />
            <FilterSelect label="Min proficiency" value={fMinProf} onChange={setFMinProf} options={[{ v: "0", l: "All levels" }, { v: "2", l: "≥ 2 Practitioner" }, { v: "3", l: "≥ 3 Advanced" }, { v: "4", l: "4 Expert only" }]} />
            <FilterSelect label="Utilisation" value={fAvail} onChange={setFAvail} options={[{ v: "all", l: "All" }, { v: "capacity", l: "Has capacity (<80%)" }, { v: "busy", l: "Busy (80–99%)" }, { v: "full", l: "Fully allocated (100%+)" }]} />
            <FilterSelect label="Assessment" value={fAssess} onChange={setFAssess} options={[{ v: "all", l: "All" }, { v: "validated", l: "Manager validated" }, { v: "self", l: "Self-assessed" }, { v: "pending", l: "Pending review" }]} />
            <div className="flex-1 min-w-[240px]">
              <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><Sparkles className="h-3 w-3" /> Quick find — who can do this?</div>
              <div className="flex gap-1.5">
                <Input className="h-8" value={quick} placeholder="e.g. Python 3+, available" onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runQuickFind()} />
                <Button size="sm" className="h-8" onClick={runQuickFind}>Find</Button>
                {highlightIds && <Button size="sm" variant="ghost" className="h-8" onClick={() => { setQuick(""); setHighlightIds(null); }}>Clear</Button>}
              </div>
            </div>
          </div>

          {/* Group toggles */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Categories:</span>
            <button type="button" onClick={() => setHiddenGroups(new Set())}
              className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold", hiddenGroups.size === 0 ? "border-transparent bg-slate-900 text-white" : "text-muted-foreground")}>All</button>
            {groups.map((g) => {
              const on = !hiddenGroups.has(g.id);
              return (
                <button key={g.id} type="button"
                  onClick={() => setHiddenGroups((prev) => { const n = new Set(prev); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}
                  className="rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors"
                  style={on ? { background: g.color, color: "#fff", borderColor: "transparent" } : { color: g.color, borderColor: `${g.color}66` }}>
                  {g.label}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2 text-[11px]">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">Proficiency:</span>
            {MATRIX_LEVELS.map((l) => (
              <span key={l.level} className="flex items-center gap-1.5">
                <span className="flex h-[18px] w-[22px] items-center justify-center rounded text-[10px] font-extrabold" style={{ background: l.bg, color: l.text }}>{l.level}</span>{l.label}
              </span>
            ))}
            <span className="hidden h-4 w-px bg-border sm:block" />
            <span className="font-bold uppercase tracking-wide text-muted-foreground">Assessment:</span>
            <span className="flex items-center gap-1.5"><span className="flex h-[18px] w-[22px] items-center justify-center rounded text-[10px] font-extrabold" style={{ background: "#5EEAD4", color: "#0F766E", border: "2px dashed #0F766E" }}>3</span>Self</span>
            <span className="flex items-center gap-1.5"><span className="flex h-[18px] w-[22px] items-center justify-center rounded text-[10px] font-extrabold" style={{ background: "#FEF3C7", color: "#92400E", border: "1.5px solid #D97706" }}>?</span>Pending</span>
            <span className="flex items-center gap-1.5"><span className="flex h-[18px] w-[22px] items-center justify-center rounded text-[10px] font-extrabold" style={{ background: "#5EEAD4", color: "#0F766E" }}>3</span>Validated</span>
            <span className="text-muted-foreground">· Click a cell to assess · Click a name for the full profile</span>
          </div>

          {/* Matrix */}
          <Card className="rounded-xl border-border/50 overflow-hidden">
          <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="sticky left-0 top-0 z-30 min-w-[210px] bg-muted p-3 text-left text-xs font-semibold text-muted-foreground">Name</th>
                  <th className="sticky top-0 z-20 min-w-[96px] bg-muted p-3 text-left text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="sticky top-0 z-20 min-w-[90px] bg-muted p-3 text-left text-xs font-semibold text-muted-foreground">Dept</th>
                  <th className="sticky top-0 z-20 min-w-[92px] border-r bg-muted p-3 text-left text-xs font-semibold text-muted-foreground">Util %</th>
                  {visibleGroups.map((g) => (
                    <th key={g.id} colSpan={expanded.has(g.id) ? g.skills.length : 1} onClick={() => setExpanded((prev) => { const n = new Set(prev); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}
                      className="sticky top-0 z-20 cursor-pointer border-l bg-muted p-2 text-center text-[11px] font-bold uppercase tracking-wide"
                      style={{ color: g.color, borderBottom: `2px solid ${g.color}` }}
                      title={`${expanded.has(g.id) ? "Collapse" : "Expand"} ${g.label}`}>
                      {g.label} {expanded.has(g.id) ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />}
                    </th>
                  ))}
                  <th className="sticky top-0 z-20 border-l bg-muted" style={{ width: "100%" }} />
                </tr>
                <tr className="border-b bg-muted/40">
                  <th className="sticky left-0 top-[41px] z-30 bg-muted" />
                  <th className="sticky top-[41px] z-20 bg-muted" colSpan={3} />
                  {visibleGroups.map((g) => expanded.has(g.id)
                    ? g.skills.map((s) => (
                      <th key={s.id} className="sticky top-[41px] z-10 h-[92px] min-w-[38px] max-w-[38px] border-l bg-muted align-bottom" title={`${s.name}${childIds.has(s.id) ? " (module)" : ""}`}>
                        <div className="mx-auto flex h-[88px] items-end justify-center pb-1">
                          <span className="[writing-mode:vertical-rl] rotate-180 whitespace-nowrap text-[10px] font-semibold text-muted-foreground">{childIds.has(s.id) ? "› " : ""}{s.name}</span>
                        </div>
                      </th>
                    ))
                    : <th key={g.id} className="sticky top-[41px] z-10 min-w-[60px] border-l bg-muted p-2 text-center text-[10px] font-bold text-muted-foreground">Best</th>)}
                  <th className="sticky top-[41px] z-10 border-l bg-muted" style={{ width: "100%" }} />
                </tr>
              </thead>
              <tbody>
                {grouped.map(([dept, people]) => (
                  <Fragment key={`d-${dept}`}>
                    <tr>
                      <td colSpan={totalCols + 1} className="sticky left-0 border-b bg-muted/60 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-foreground">
                        {dept} <span className="ml-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold">{people.length}</span>
                      </td>
                    </tr>
                    {people.map((r) => {
                      const dim = highlightIds && !highlightIds.includes(r.id);
                      const hl = highlightIds && highlightIds.includes(r.id);
                      return (
                        <tr key={r.id} className={cn("border-b hover:bg-muted/30", hl && "bg-emerald-50/60", dim && "opacity-30")}>
                          <td className={cn("sticky left-0 z-10 border-r bg-background", hl && "bg-emerald-50/60")}>
                            <button type="button" className="flex w-full items-center gap-2.5 p-3 text-left hover:bg-muted/50" onClick={() => onOpenProfile(r)}>
                              <PersonAvatar r={r} className="h-8 w-8" />
                              <span>
                                <span className="block font-medium">{r.firstName} {r.lastName}</span>
                                <span className="block text-xs text-muted-foreground">{r.jobTitle ?? ""}</span>
                              </span>
                            </button>
                          </td>
                          <td className="p-3"><TypeBadge type={r.personType} /></td>
                          <td className="p-3 text-xs text-muted-foreground">{(r.department ?? "").split(" ")[0]}</td>
                          <td className="border-r p-3"><UtilBar util={utilOf(r)} /></td>
                          {visibleGroups.map((g) => expanded.has(g.id)
                            ? g.skills.map((s) => {
                              const v = getLevel(r.id, s.id);
                              return (
                                <td key={s.id} className="cursor-pointer border-l p-1 text-center hover:bg-primary/5" onClick={() => setEditCell({ resource: r, skill: s })}>
                                  {v ? <Chip level={v.level} assess={v.assess} /> : <span className="text-muted-foreground/30">—</span>}
                                </td>
                              );
                            })
                            : (() => {
                              const b = bestInGroup(r.id, g);
                              return (
                                <td key={g.id} className="cursor-pointer border-l p-1 text-center hover:bg-primary/5" onClick={() => setExpanded((prev) => new Set(prev).add(g.id))}>
                                  {b ? <Chip level={b.level} assess={b.assess} summary /> : <span className="text-muted-foreground/30">—</span>}
                                </td>
                              );
                            })())}
                          <td className="border-l" />
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
                {/* Coverage row */}
                <tr className="border-t bg-muted/50">
                  <td colSpan={4} className="sticky left-0 z-10 border-r bg-muted/50 p-3 text-xs font-bold text-muted-foreground">Coverage · {filtered.length} shown</td>
                  {visibleGroups.map((g) => expanded.has(g.id)
                    ? g.skills.map((s) => {
                      const count = filtered.filter((r) => getLevel(r.id, s.id)).length;
                      return <td key={s.id} className="border-l bg-muted/50 p-1 text-center text-[11px] font-bold text-foreground">{count || <span className="text-muted-foreground/40">0</span>}</td>;
                    })
                    : (() => {
                      const count = filtered.filter((r) => bestInGroup(r.id, g)).length;
                      return <td key={g.id} className="border-l bg-muted/50 p-1 text-center text-[11px] font-bold text-foreground">{count || <span className="text-muted-foreground/40">0</span>}</td>;
                    })())}
                  <td className="border-l bg-muted/50" style={{ width: "100%" }} />
                </tr>
              </tbody>
            </table>
          </div>
          </Card>
          {filtered.length === 0 && <ResourcesEmptyState icon={Grid3X3} title="No people match the filters" description="Adjust the filters or quick find to see the matrix." />}
        </>
      ) : (
        /* ── SEARCH VIEW ── */
        <div className="space-y-4">
          {searchCriteria.map((c, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[160px] flex-1">
                <Label className="text-xs">Skill</Label>
                <Select value={c.skillId} onValueChange={(v) => { const next = [...searchCriteria]; next[i] = { ...next[i], skillId: v }; setSearchCriteria(next); }}>
                  <SelectTrigger><SelectValue placeholder="Skill" /></SelectTrigger>
                  <SelectContent>{skills.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="w-32">
                <Label className="text-xs">Min level</Label>
                <Select value={c.minLevel} onValueChange={(v) => { const next = [...searchCriteria]; next[i].minLevel = v; setSearchCriteria(next); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PROFICIENCY_LEVELS.map((p) => <SelectItem key={p.level} value={String(p.level)}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input className="w-24" type="number" placeholder="Yrs" value={c.minYears} onChange={(e) => { const next = [...searchCriteria]; next[i].minYears = e.target.value; setSearchCriteria(next); }} />
              {i === searchCriteria.length - 1 && <Button variant="outline" size="sm" onClick={() => setSearchCriteria([...searchCriteria, { skillId: "", minLevel: "3", minYears: "0" }])}><Plus className="h-4 w-4" /></Button>}
            </div>
          ))}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={searchLogic === "or"} onCheckedChange={(v) => setSearchLogic(v ? "or" : "and")} /> OR logic</label>
            <Button onClick={runSearch} disabled={searchLoading}>{searchLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Search</Button>
          </div>
          <div className="space-y-2">
            {searchResults.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{r.firstName} {r.lastName}</p>
                    <p className="text-sm text-muted-foreground">{r.jobTitle} · {r.utilisationPct}% allocated</p>
                    <div className="mt-1 flex flex-wrap gap-1">{r.matchingSkills.map((s, i) => <Badge key={i} variant="outline" className="text-xs">{s.name} L{s.level}</Badge>)}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onOpenProfile(r)}>View profile</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Cell editor */}
      <CellEditor
        cell={editCell}
        existing={editCell ? skillLookup.get(editCell.resource.id)?.get(editCell.skill.id) ?? null : null}
        group={editCell ? groups.find((g) => g.skills.some((s) => s.id === editCell.skill.id)) ?? null : null}
        onClose={() => setEditCell(null)}
        onSave={(level, assess, notes, existingId) => editCell && upsertSkill.mutate({ resource: editCell.resource, skill: editCell.skill, level, assess, notes, existingId })}
        onClear={(existingId) => editCell && clearSkill.mutate({ resourceId: editCell.resource.id, id: existingId })}
        saving={upsertSkill.isPending || clearSkill.isPending}
      />

      <SkillsLibraryDialog open={showLibrary} onOpenChange={setShowLibrary} categories={categories} skills={skills} />

      {/* Gap analysis */}
      <Dialog open={showGap} onOpenChange={setShowGap}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Skills gap analysis</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Input placeholder="Resource plan ID" value={gapPlanId} onChange={(e) => setGapPlanId(e.target.value)} />
            <Button onClick={runGap} disabled={gapLoading || !gapPlanId}>{gapLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Analyse</Button>
          </div>
          <div className="max-h-64 space-y-2 overflow-auto">
            {gapResults.map((g, i) => (
              <div key={i} className="rounded border p-2 text-sm">
                <div className="flex justify-between"><span className="font-medium">{g.role}</span>
                  <Badge variant={g.coverage === "full" ? "default" : g.coverage === "partial" ? "secondary" : "destructive"}>{g.coverage}</Badge></div>
                <p className="text-muted-foreground">{g.qualifiedCount} qualified · {g.candidates.join(", ") || "None"}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Filter select ────────────────────────────────────────── */
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ v: string; l: string }> }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 min-w-[130px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

/* ── Cell editor dialog ───────────────────────────────────── */
function CellEditor({ cell, existing, group, onClose, onSave, onClear, saving }: {
  cell: { resource: Resource; skill: Skill } | null;
  existing: ResourceSkill | null;
  group: GroupDef | null;
  onClose: () => void;
  onSave: (level: number, assess: AssessmentSource, notes: string, existingId?: number) => void;
  onClear: (existingId: number) => void;
  saving: boolean;
}) {
  const [level, setLevel] = useState(0);
  const [assess, setAssess] = useState<AssessmentSource>("validated");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (cell) {
      setLevel(existing?.skillLevel ?? 0);
      setAssess(getAssessmentSource(existing?.assessmentType));
      setNotes(existing?.notes ?? "");
    }
  }, [cell, existing]);

  if (!cell) return null;
  const desc = level > 0 ? getMatrixLevel(level).desc : "Select a level to see its description.";

  return (
    <Dialog open={!!cell} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{cell.resource.firstName} {cell.resource.lastName} — {cell.skill.name}</DialogTitle>
          {group && <p className="text-xs text-muted-foreground">{group.label}</p>}
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Proficiency level</div>
            <div className="grid grid-cols-4 gap-2">
              {MATRIX_LEVELS.map((l) => (
                <button key={l.level} type="button" onClick={() => setLevel(l.level)}
                  className={cn("rounded-lg border-2 p-2 text-center transition-colors", level === l.level ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                  <div className="text-lg font-extrabold" style={{ color: l.text }}>{l.level}</div>
                  <div className="text-[10px] font-semibold text-muted-foreground">{l.label}</div>
                </button>
              ))}
            </div>
            <p className="mt-2 rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">{desc}</p>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Assessment source</div>
            <div className="flex rounded-lg bg-muted p-1">
              {ASSESSMENT_SOURCES.map((a) => (
                <button key={a.value} type="button" onClick={() => setAssess(a.value)}
                  className={cn("flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors", assess === a.value ? "bg-background text-primary shadow-sm" : "text-muted-foreground")}>
                  {a.icon} {a.short}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Notes</div>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional: evidence, last used, certifications…" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          {existing ? <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" disabled={saving} onClick={() => onClear(existing.id)}><Trash2 className="mr-1 h-4 w-4" /> Clear</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={saving || level === 0} onClick={() => onSave(level, assess, notes, existing?.id)}>{saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function csv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
