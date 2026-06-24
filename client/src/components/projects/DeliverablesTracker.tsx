import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PmDeliverablePhase, PmDeliverable } from "@shared/models/projects";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogShell, FormSection, FieldGrid, FieldLabel, FormDivider } from "@/components/ui/form-dialog-shell";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
import {
  Search, ChevronRight, Settings, Upload, Download, Plus, Trash2,
  Pencil, ClipboardList, X, GripVertical, FileText, BarChart3,
  ClipboardCheck, FileSpreadsheet, Presentation, FileSignature,
  Pin, FileCheck, MoreHorizontal, Loader2,
} from "lucide-react";

const PHASE_PAL = ["#3b6cf4","#7c3aed","#059669","#db2777","#d97706","#dc2626","#4f46e5","#0891b2","#65a30d","#9333ea"];
const AV_COL = ["#3b6cf4","#7c3aed","#059669","#db2777","#d97706","#dc2626","#4f46e5","#0891b2"];
const TYPE_ICONS: Record<string, typeof FileText> = {
  Document: FileText, Report: BarChart3, Plan: ClipboardCheck,
  Specification: FileSpreadsheet, Presentation: Presentation,
  Template: FileSignature, "Sign-off": FileCheck,
  Strategy: ClipboardList, "Design Doc": FileSpreadsheet,
  Milestone: FileCheck, "Test Doc": FileText, "Test Cycle": ClipboardCheck,
  Assessment: ClipboardList, Development: FileSignature,
  Data: FileSpreadsheet, Handover: FileText, Review: ClipboardList,
  Other: Pin,
};
const DELIVERABLE_TYPES = ["Document","Report","Plan","Specification","Presentation","Template","Sign-off","Strategy","Design Doc","Milestone","Test Doc","Test Cycle","Assessment","Development","Data","Handover","Review","Other"];
const STATUS_OPTIONS = ["Not Started","In Progress","In Review","Approved","Completed","Overdue"];
const RAG_OPTIONS = ["Green","Amber","Red","Blue","N/A"];
const STATUS_CYCLE = ["Not Started","In Progress","In Review","Approved","Completed"];
const RAG_CYCLE = ["Green","Amber","Red","Blue"];

const TPLS: Record<string, { name: string; color: string }[]> = {
  agile: [
    { name: "Discovery", color: "#3b6cf4" },{ name: "Sprint Planning", color: "#7c3aed" },
    { name: "Sprint 1", color: "#059669" },{ name: "Sprint 2", color: "#db2777" },
    { name: "Sprint 3", color: "#d97706" },{ name: "UAT", color: "#4f46e5" },
    { name: "Release", color: "#dc2626" },{ name: "Retrospective", color: "#9ca3af" },
  ],
  waterfall: [
    { name: "Initiation", color: "#3b6cf4" },{ name: "Planning", color: "#7c3aed" },
    { name: "Design", color: "#059669" },{ name: "Build", color: "#db2777" },
    { name: "Testing", color: "#d97706" },{ name: "Go Live", color: "#dc2626" },
    { name: "Closure", color: "#9ca3af" },
  ],
  erp: [
    { name: "Initiation", color: "#3b6cf4" },{ name: "Blueprinting", color: "#7c3aed" },
    { name: "Realisation", color: "#059669" },{ name: "Testing", color: "#db2777" },
    { name: "Cutover Prep", color: "#d97706" },{ name: "Go Live", color: "#dc2626" },
    { name: "Stabilisation", color: "#9ca3af" },
  ],
  saas: [
    { name: "Assessment", color: "#3b6cf4" },{ name: "Vendor Selection", color: "#7c3aed" },
    { name: "Configuration", color: "#059669" },{ name: "Integration", color: "#db2777" },
    { name: "Testing", color: "#d97706" },{ name: "Migration", color: "#dc2626" },
    { name: "Hypercare", color: "#9ca3af" },
  ],
};

interface KpiDef {
  key: string;
  label: string;
  color: string;
  filter: string | null;
}

const KPI_DEFS: KpiDef[] = [
  { key: "total", label: "Total", color: "#3b6cf4", filter: null },
  { key: "completed", label: "Completed", color: "#1E88C8", filter: "Completed" },
  { key: "approved", label: "Approved", color: "#059669", filter: "Approved" },
  { key: "inprog", label: "In Progress", color: "#3b6cf4", filter: "In Progress" },
  { key: "inreview", label: "In Review", color: "#d97706", filter: "In Review" },
  { key: "overdue", label: "Overdue", color: "#dc2626", filter: "Overdue" },
  { key: "notstart", label: "Not Started", color: "#7c3aed", filter: "Not Started" },
];

function initials(name: string) {
  return (name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function ragClasses(r: string) {
  if (r === "Green") return "bg-green-100 text-green-800";
  if (r === "Amber") return "bg-amber-100 text-amber-900";
  if (r === "Red") return "bg-red-100 text-red-800";
  if (r === "Blue") return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-gray-500";
}

function ragDot(r: string) {
  if (r === "Green") return "#22c55e";
  if (r === "Amber") return "#f59e0b";
  if (r === "Red") return "#ef4444";
  if (r === "Blue") return "#3b82f6";
  return "#9ca3af";
}

function statusClasses(s: string) {
  if (s === "Completed") return "bg-sky-100 text-sky-800";
  if (s === "Approved") return "bg-green-100 text-green-800";
  if (s === "In Progress") return "bg-blue-100 text-blue-700";
  if (s === "In Review") return "bg-amber-100 text-amber-900";
  if (s === "Overdue") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-500";
}

function progColor(p: number) {
  if (p === 100) return "#059669";
  if (p >= 60) return "#3b6cf4";
  if (p >= 30) return "#d97706";
  return "#dc2626";
}

function formatDate(ds: string | null | undefined) {
  if (!ds) return "—";
  const parts = ds.split("-");
  const dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((dt.getTime() - today.getTime()) / 86400000);
  const str = dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (diff < 0) return { text: `⚠ ${str}`, className: "text-red-600 font-semibold" };
  if (diff <= 14) return { text: str, className: "text-amber-600 font-medium" };
  return { text: str, className: "text-foreground" };
}

type AuditEntry = { who: string; action: string; comment: string; time: string };

function approvalInfo(d: PmDeliverable) {
  const audit = (d.auditLog || []) as AuditEntry[];
  const approvers = (d.approvers || []) as string[];
  const approved = approvers.filter(a => audit.some(x => x.action === "approve" && x.who === a));
  const hasChanges = audit.some(x => x.action === "changes");
  const total = approvers.length;
  const done = approved.length;
  if (!total) return { cls: "border-gray-200 bg-gray-50 text-gray-500", label: "No approvers", icon: "—", done: 0, total: 0 };
  if (hasChanges) return { cls: "border-red-300 bg-red-50 text-red-800", label: "Blocked", icon: "🔴", done, total };
  if (done === total) return { cls: "border-green-300 bg-green-50 text-green-800", label: `${done}/${total} Approved`, icon: "✓", done, total };
  if (done > 0) return { cls: "border-amber-300 bg-amber-50 text-amber-900", label: `${done}/${total} Approved`, icon: "◑", done, total };
  return { cls: "border-gray-200 bg-gray-50 text-gray-500", label: `0/${total} Pending`, icon: "○", done: 0, total };
}

interface PeopleEditorProps {
  label: string;
  hint: string;
  people: string[];
  onChange: (people: string[]) => void;
}

function PeopleEditor({ label, hint, people, onChange }: PeopleEditorProps) {
  const [inputVal, setInputVal] = useState("");

  const add = () => {
    const v = inputVal.trim();
    if (!v) return;
    onChange([...people, v]);
    setInputVal("");
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label} — {hint}</label>
      <div className="border rounded-lg overflow-hidden">
        <div className="px-3 py-1.5 bg-muted/50 border-b text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="p-2 flex flex-col gap-1.5 min-h-[32px]">
          {people.length === 0 && <span className="text-xs text-muted-foreground/60 px-1">None added</span>}
          {people.map((name, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-md border">
              <div className="w-[22px] h-[22px] rounded-full text-[9px] font-bold text-white flex items-center justify-center shrink-0" style={{ background: AV_COL[i % AV_COL.length] }}>
                {initials(name)}
              </div>
              <span className="flex-1 text-[13px]">{name}</span>
              <button className="text-muted-foreground/60 hover:text-red-500 text-sm" onClick={() => onChange(people.filter((_, j) => j !== i))} data-testid={`remove-person-${label.toLowerCase()}-${i}`}>✕</button>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 px-2 py-1.5 border-t">
          <Input
            className="flex-1 h-7 text-[13px]"
            placeholder="Add name…"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
            data-testid={`input-person-${label.toLowerCase()}`}
          />
          <Button size="sm" className="h-7 px-3 text-xs" onClick={add} data-testid={`add-person-${label.toLowerCase()}`}>＋</Button>
        </div>
      </div>
    </div>
  );
}

export default function DeliverablesTracker({ projectId }: { projectId: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: phases = [], isLoading: phasesLoading } = useQuery<PmDeliverablePhase[]>({
    queryKey: ["/api/pm/projects", projectId, "deliverable-phases"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/pm/projects/${projectId}/deliverable-phases`);
      if (!res.ok) throw new Error("Failed to load deliverable phases");
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: deliverables = [], isLoading: delsLoading } = useQuery<PmDeliverable[]>({
    queryKey: ["/api/pm/projects", projectId, "deliverables"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/pm/projects/${projectId}/deliverables`);
      if (!res.ok) throw new Error("Failed to load deliverables");
      return res.json();
    },
    staleTime: 30_000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "deliverable-phases"] });
    queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "deliverables"] });
  };

  const createPhaseMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/pm/deliverable-phases", data),
  });

  const updatePhaseMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/pm/deliverable-phases/${id}`, data),
  });

  const deletePhaseMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/pm/deliverable-phases/${id}`),
  });

  const applyTemplateMut = useMutation({
    mutationFn: (data: { template: string }) =>
      apiRequest("POST", `/api/pm/projects/${projectId}/deliverable-phases/template`, data),
    onSuccess: invalidateAll,
  });

  const createDelMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/pm/deliverables", data),
  });

  const updateDelMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/pm/deliverables/${id}`, data),
  });

  const deleteDelMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/pm/deliverables/${id}`),
  });

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [ragFilter, setRagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<number>>(new Set());
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [openDrawerId, setOpenDrawerId] = useState<number | null>(null);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editDelId, setEditDelId] = useState<number | null>(null);
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [savingPhases, setSavingPhases] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewDelId, setReviewDelId] = useState<number | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditDelId, setAuditDelId] = useState<number | null>(null);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [bulkMoveTarget, setBulkMoveTarget] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhase, setFormPhase] = useState("");
  const [formType, setFormType] = useState("Document");
  const [formStatus, setFormStatus] = useState("Not Started");
  const [formRag, setFormRag] = useState("Green");
  const [formDue, setFormDue] = useState("");
  const [formProg, setFormProg] = useState(0);
  const [formNotes, setFormNotes] = useState("");
  const [formOwners, setFormOwners] = useState<string[]>([]);
  const [formReviewers, setFormReviewers] = useState<string[]>([]);
  const [formApprovers, setFormApprovers] = useState<string[]>([]);

  // Review form
  const [reviewWho, setReviewWho] = useState("");
  const [reviewComment, setReviewComment] = useState("");

  // Phase editor state
  const [tempPhases, setTempPhases] = useState<{ id?: number; name: string; color: string; sortOrder: number }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Import state
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importTab, setImportTab] = useState<"upload" | "template">("upload");
  const [importStatus, setImportStatus] = useState<{ msg: string; type: "ok" | "err" | "" }>({ msg: "", type: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived data
  const filteredDeliverables = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return deliverables.filter(d => {
      if (q) {
        const owners = (d.owners as string[] || []).join(" ").toLowerCase();
        const reviewers = (d.reviewers as string[] || []).join(" ").toLowerCase();
        const approvers = (d.approvers as string[] || []).join(" ").toLowerCase();
        if (!d.name.toLowerCase().includes(q) && !owners.includes(q) && !reviewers.includes(q) && !approvers.includes(q)) return false;
      }
      if (phaseFilter && d.phaseName !== phaseFilter) return false;
      if (ragFilter && d.ragStatus !== ragFilter) return false;
      const effectiveStatus = statusFilter || activeKpi;
      if (effectiveStatus && d.status !== effectiveStatus) return false;
      return true;
    });
  }, [deliverables, searchQuery, phaseFilter, ragFilter, statusFilter, activeKpi]);

  const kpiCounts = useMemo(() => {
    const counts: Record<string, number> = { total: deliverables.length };
    STATUS_OPTIONS.forEach(s => { counts[s] = deliverables.filter(d => d.status === s).length; });
    return counts;
  }, [deliverables]);

  // Handlers
  const toggleKpi = (filter: string | null) => {
    setActiveKpi(prev => prev === filter ? null : filter);
  };

  const toggleCollapse = (phaseId: number) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      next.has(phaseId) ? next.delete(phaseId) : next.add(phaseId);
      return next;
    });
  };

  const toggleCollapseAll = () => {
    if (allCollapsed) {
      setCollapsedPhases(new Set());
    } else {
      setCollapsedPhases(new Set(phases.map(p => p.id)));
    }
    setAllCollapsed(!allCollapsed);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const togglePhaseSelect = (phaseName: string, checked: boolean) => {
    const phaseDelIds = deliverables.filter(d => d.phaseName === phaseName).map(d => d.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      phaseDelIds.forEach(id => checked ? next.add(id) : next.delete(id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const cycleStatus = async (del: PmDeliverable) => {
    const i = STATUS_CYCLE.indexOf(del.status);
    const newStatus = STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
    const updates: any = { status: newStatus };
    if (newStatus === "Approved") updates.version = del.version + 1;
    await updateDelMut.mutateAsync({ id: del.id, data: updates });
    invalidateAll();
  };

  const cycleRag = async (del: PmDeliverable) => {
    const i = RAG_CYCLE.indexOf(del.ragStatus);
    const newRag = RAG_CYCLE[(i + 1) % RAG_CYCLE.length];
    await updateDelMut.mutateAsync({ id: del.id, data: { ragStatus: newRag } });
    invalidateAll();
  };

  // Add/Edit Modal
  const openAddModal = () => {
    setEditDelId(null);
    setFormName(""); setFormPhase(phases[0]?.name || ""); setFormType("Document");
    setFormStatus("Not Started"); setFormRag("Green"); setFormDue(""); setFormProg(0);
    setFormNotes(""); setFormOwners([]); setFormReviewers([]); setFormApprovers([]);
    setShowAddModal(true);
  };

  const openEditModal = (del: PmDeliverable) => {
    setEditDelId(del.id);
    setFormName(del.name); setFormPhase(del.phaseName || ""); setFormType(del.type);
    setFormStatus(del.status); setFormRag(del.ragStatus); setFormDue(del.dueDate || "");
    setFormProg(del.progress); setFormNotes(del.notes || "");
    setFormOwners((del.owners as string[]) || []);
    setFormReviewers((del.reviewers as string[]) || []);
    setFormApprovers((del.approvers as string[]) || []);
    setShowAddModal(true);
  };

  const saveDeliverable = async () => {
    const data: any = {
      name: formName || "Untitled",
      phaseName: formPhase,
      type: formType,
      status: formStatus,
      ragStatus: formRag,
      dueDate: formDue || null,
      progress: formProg,
      notes: formNotes,
      owners: formOwners,
      reviewers: formReviewers,
      approvers: formApprovers,
    };

    if (editDelId) {
      await updateDelMut.mutateAsync({ id: editDelId, data });
    } else {
      data.projectId = projectId;
      data.version = 1;
      data.auditLog = [];
      await createDelMut.mutateAsync(data);
    }
    setShowAddModal(false);
    invalidateAll();
    toast({ title: editDelId ? "Deliverable updated" : "Deliverable created" });
  };

  const deleteDeliverable = async (id: number) => {
    if (!confirm("Delete this deliverable?")) return;
    if (openDrawerId === id) setOpenDrawerId(null);
    await deleteDelMut.mutateAsync(id);
    invalidateAll();
    toast({ title: "Deliverable deleted" });
  };

  // Bulk actions
  const bulkSetStatus = async (status: string) => {
    for (const id of selectedIds) {
      const del = deliverables.find(d => d.id === id);
      if (!del) continue;
      const updates: any = { status };
      if (status === "Approved") updates.version = del.version + 1;
      await updateDelMut.mutateAsync({ id, data: updates });
    }
    clearSelection();
    invalidateAll();
    toast({ title: `${selectedIds.size} deliverables updated` });
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} deliverable(s)?`)) return;
    for (const id of selectedIds) {
      await deleteDelMut.mutateAsync(id);
    }
    clearSelection();
    invalidateAll();
    toast({ title: "Deliverables deleted" });
  };

  const bulkMove = async () => {
    if (!bulkMoveTarget) return;
    for (const id of selectedIds) {
      await updateDelMut.mutateAsync({ id, data: { phaseName: bulkMoveTarget } });
    }
    clearSelection();
    setShowBulkMoveModal(false);
    invalidateAll();
    toast({ title: "Deliverables moved" });
  };

  // Phase modal
  const openPhaseModal = () => {
    setTempPhases(phases.map(p => ({ id: p.id, name: p.name, color: p.color, sortOrder: p.sortOrder })));
    setSelectedTemplate(null);
    setShowPhaseModal(true);
  };

  const addTempPhase = () => {
    setTempPhases(prev => [...prev, { name: "New Phase", color: PHASE_PAL[prev.length % PHASE_PAL.length], sortOrder: prev.length }]);
  };

  const cyclePhaseColor = (idx: number) => {
    setTempPhases(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      const ci = PHASE_PAL.indexOf(p.color);
      return { ...p, color: PHASE_PAL[(ci + 1) % PHASE_PAL.length] };
    }));
  };

  const applyTemplate = (key: string) => {
    setSelectedTemplate(key);
    if (key === "custom") {
      setTempPhases([]);
      return;
    }
    const tpl = TPLS[key];
    if (tpl) {
      setTempPhases(tpl.map((p, i) => ({ name: p.name, color: p.color, sortOrder: i })));
    }
  };

  const savePhases = async () => {
    if (savingPhases) return;
    setSavingPhases(true);
    try {
      const deliverableUpdates: Array<{ id: number; phaseName: string | null }> = [];
      const oldNameToNew = new Map<string, string | null>();
      const newPhaseNames = new Set(tempPhases.map(tp => tp.name));

      for (const oldPhase of phases) {
        const match = tempPhases.find(tp => tp.id === oldPhase.id);
        if (match && match.name !== oldPhase.name) {
          oldNameToNew.set(oldPhase.name, match.name);
        } else if (!match) {
          oldNameToNew.set(oldPhase.name, null);
        }
      }

      for (const [oldName, newName] of oldNameToNew) {
        for (const del of deliverables) {
          if (del.phaseName === oldName) {
            deliverableUpdates.push({ id: del.id, phaseName: newName });
          }
        }
      }

      const phasesToSave = tempPhases.map((tp, i) => ({
        projectId,
        name: tp.name,
        color: tp.color,
        sortOrder: i,
      }));

      await apiRequest("PUT", `/api/pm/projects/${projectId}/deliverable-phases/replace`, {
        phases: phasesToSave,
        deliverableUpdates,
      });

      setShowPhaseModal(false);
      invalidateAll();
      toast({ title: "Phases saved" });
    } catch (err) {
      toast({ title: "Error saving phases. Please try again.", variant: "destructive" });
    } finally {
      setSavingPhases(false);
    }
  };

  // Review modal
  const openReviewModal = (delId: number) => {
    setReviewDelId(delId);
    setReviewWho("");
    setReviewComment("");
    setShowReviewModal(true);
  };

  const submitReview = async (type: "approve" | "changes" | "comment") => {
    if (!reviewDelId) return;
    const del = deliverables.find(d => d.id === reviewDelId);
    if (!del) return;

    if (type === "changes" && !reviewComment.trim()) {
      toast({ title: "Please add a comment when requesting changes", variant: "destructive" });
      return;
    }

    const who = reviewWho.trim() || "Unknown";
    const now = new Date().toLocaleString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "");
    const audit = [...((del.auditLog as AuditEntry[]) || []), { who, action: type, comment: reviewComment.trim(), time: now }];

    const updates: any = { auditLog: audit };
    const approvers = (del.approvers as string[]) || [];
    if (type === "approve") {
      const allSigned = approvers.length > 0 && approvers.every(a => audit.some(x => x.action === "approve" && x.who === a));
      updates.status = allSigned ? "Approved" : "In Review";
      if (allSigned) updates.version = del.version + 1;
    } else if (type === "changes") {
      updates.status = "In Progress";
    }

    await updateDelMut.mutateAsync({ id: reviewDelId, data: updates });
    setShowReviewModal(false);
    invalidateAll();
    toast({ title: type === "approve" ? "Approved" : type === "changes" ? "Changes requested" : "Comment added" });
  };

  // Audit modal
  const openAuditModal = (delId: number) => {
    setAuditDelId(delId);
    setShowAuditModal(true);
  };

  // Import/Export
  const exportCSV = () => {
    const headers = ["Name","Phase","Type","Owners","Reviewers","Approvers","Due Date","Status","RAG","Progress %","Notes"];
    const rows = deliverables.map(d => [
      `"${(d.name || "").replace(/"/g, '""')}"`,
      `"${(d.phaseName || "").replace(/"/g, '""')}"`,
      `"${(d.type || "").replace(/"/g, '""')}"`,
      `"${((d.owners as string[]) || []).join("|").replace(/"/g, '""')}"`,
      `"${((d.reviewers as string[]) || []).join("|").replace(/"/g, '""')}"`,
      `"${((d.approvers as string[]) || []).join("|").replace(/"/g, '""')}"`,
      `"${(d.dueDate || "").replace(/"/g, '""')}"`,
      `"${(d.status || "").replace(/"/g, '""')}"`,
      `"${(d.ragStatus || "").replace(/"/g, '""')}"`,
      `"${d.progress || 0}"`,
      `"${(d.notes || "").replace(/"/g, '""')}"`,
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "deliverables-export.csv"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported" });
  };

  const downloadTemplate = () => {
    const headers = "Name,Phase,Type,Owners,Reviewers,Approvers,Due Date,Status,RAG,Progress %,Notes";
    const example = '"Project Charter","Initiation","Document","Sarah R","James M|Karen L","Alex B","2025-03-15","Not Started","Green","0","Example note here"';
    const blob = new Blob([headers + "\n" + example], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "deliverables-import-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const openImportModal = () => {
    setImportRows([]);
    setImportStatus({ msg: "", type: "" });
    setImportTab("upload");
    setShowImportModal(true);
  };

  const parseCSVRow = (line: string) => {
    const result: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) { result.push(cur); cur = ""; }
      else cur += ch;
    }
    result.push(cur);
    return result;
  };

  const parseCSVFile = (file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setImportStatus({ msg: "Please upload a .csv file.", type: "err" });
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const text = (e.target?.result as string || "").trim();
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) {
        setImportStatus({ msg: "The file appears empty or has no data rows.", type: "err" });
        return;
      }
      const headers = parseCSVRow(lines[0]).map(h => h.trim().toLowerCase());
      const col = (name: string) => headers.indexOf(name);
      const parsed: any[] = [];
      const errors: string[] = [];

      lines.slice(1).forEach((line, i) => {
        const cells = parseCSVRow(line);
        const get = (name: string, fallback = "") => (cells[col(name)] || fallback).trim();
        const name = get("name");
        const phase = get("phase");
        if (!name) { errors.push(`Row ${i + 2}: Name is required`); return; }
        if (!phase) { errors.push(`Row ${i + 2}: Phase is required`); return; }
        const splitPipe = (v: string) => v ? v.split("|").map(x => x.trim()).filter(Boolean) : [];
        const prog = Math.min(100, Math.max(0, parseInt(get("progress %", "0")) || 0));
        const validStatuses = STATUS_OPTIONS;
        const rawStatus = get("status", "Not Started");
        const status = validStatuses.includes(rawStatus) ? rawStatus : "Not Started";
        const validRags = RAG_OPTIONS;
        const rawRag = get("rag", "Green");
        const rag = validRags.includes(rawRag) ? rawRag : "Green";
        const validTypes = DELIVERABLE_TYPES;
        const rawType = get("type", "Document");
        const type = validTypes.includes(rawType) ? rawType : "Document";
        parsed.push({
          name, phaseName: phase, type,
          owners: splitPipe(get("owners")),
          reviewers: splitPipe(get("reviewers")),
          approvers: splitPipe(get("approvers")),
          dueDate: get("due date"),
          status, ragStatus: rag, progress: prog,
          notes: get("notes"), version: 1, auditLog: [],
        });
      });

      setImportRows(parsed);
      if (errors.length) {
        setImportStatus({ msg: `⚠ ${errors.length} row(s) skipped: ${errors.slice(0, 2).join("; ")}${errors.length > 2 ? " …" : ""}`, type: "err" });
      }
      if (!parsed.length) {
        setImportStatus({ msg: "No valid rows found. Check that Name and Phase columns are present.", type: "err" });
        return;
      }
      setImportStatus({ msg: `✓ ${parsed.length} deliverable${parsed.length > 1 ? "s" : ""} ready to import${errors.length ? ` (${errors.length} skipped)` : ""}`, type: "ok" });
    };
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    if (!importRows.length) return;
    const createdPhaseNames = new Set(phases.map(p => p.name));
    const existingDelKeys = new Set(deliverables.map(d => `${d.name}|||${d.phaseName || ""}`));
    let skipped = 0;
    for (const r of importRows) {
      if (r.phaseName && !createdPhaseNames.has(r.phaseName)) {
        const c = PHASE_PAL[createdPhaseNames.size % PHASE_PAL.length];
        await createPhaseMut.mutateAsync({ projectId, name: r.phaseName, color: c, sortOrder: createdPhaseNames.size });
        createdPhaseNames.add(r.phaseName);
      }
      const key = `${r.name}|||${r.phaseName || ""}`;
      if (existingDelKeys.has(key)) {
        skipped++;
        continue;
      }
      existingDelKeys.add(key);
      await createDelMut.mutateAsync({
        ...r,
        projectId,
      });
    }
    const imported = importRows.length - skipped;
    setShowImportModal(false);
    invalidateAll();
    toast({ title: `${imported} deliverable${imported !== 1 ? "s" : ""} imported${skipped > 0 ? ` (${skipped} duplicate${skipped !== 1 ? "s" : ""} skipped)` : ""}` });
    setImportRows([]);
  };

  // Group deliverables by phase
  const phaseGroups = useMemo(() => {
    const phaseNames = phases.map(p => p.name);
    const unassignedDels = filteredDeliverables.filter(d => !phaseNames.includes(d.phaseName || ""));
    const allDelsForPhase = (pn: string) => deliverables.filter(d => d.phaseName === pn);
    const groups: { phase: PmDeliverablePhase | null; phaseName: string; items: PmDeliverable[]; allItems: PmDeliverable[] }[] = [];

    phases.forEach(p => {
      const all = allDelsForPhase(p.name);
      const items = filteredDeliverables.filter(d => d.phaseName === p.name);
      if (items.length > 0 || all.length > 0 || (!searchQuery && !ragFilter && !statusFilter && !activeKpi)) {
        groups.push({ phase: p, phaseName: p.name, items, allItems: all });
      }
    });

    if (unassignedDels.length > 0) {
      groups.push({ phase: null, phaseName: "Unassigned", items: unassignedDels, allItems: unassignedDels });
    }

    return groups;
  }, [phases, filteredDeliverables, deliverables, searchQuery, ragFilter, statusFilter, activeKpi]);

  const isLoading = phasesLoading || delsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="deliverables-loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const activeFilters = [];
  if (activeKpi) activeFilters.push({ label: `Status: ${activeKpi}`, clear: () => setActiveKpi(null) });
  if (phaseFilter) activeFilters.push({ label: `Phase: ${phaseFilter}`, clear: () => setPhaseFilter("") });
  if (ragFilter) activeFilters.push({ label: `RAG: ${ragFilter}`, clear: () => setRagFilter("") });
  if (statusFilter) activeFilters.push({ label: `Status: ${statusFilter}`, clear: () => setStatusFilter("") });

  return (
    <div className="space-y-4" data-testid="deliverables-tracker">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5" data-testid="deliverables-kpi-row">
        {KPI_DEFS.map(kpi => {
          const count = kpi.filter ? (kpiCounts[kpi.filter] || 0) : kpiCounts.total;
          const pct = kpiCounts.total ? Math.round(count / kpiCounts.total * 100) : 0;
          const isActive = activeKpi === kpi.filter;
          return (
            <div
              key={kpi.key}
              className={`relative overflow-hidden rounded-xl border-2 p-3.5 cursor-pointer select-none transition-all hover:-translate-y-0.5 hover:shadow-md ${
                isActive ? "shadow-md" : ""
              }`}
              style={{
                borderColor: isActive ? kpi.color : "var(--border)",
                background: isActive ? `color-mix(in srgb, ${kpi.color} 6%, white)` : "white",
              }}
              onClick={() => toggleKpi(kpi.filter)}
              data-testid={`kpi-${kpi.key}`}
            >
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: kpi.color }} />
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{kpi.label}</div>
              <div className="text-[28px] font-serif leading-none" style={{ color: kpi.color }}>{count}</div>
              <div className="text-[11px] text-muted-foreground/60 mt-1">{kpi.filter ? `${pct}% of total` : "deliverables"}</div>
              <div className={`absolute bottom-2 right-2.5 text-[10px] font-bold uppercase tracking-wide transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} style={{ color: kpi.color }}>
                {isActive ? "✕ Clear" : "Filter ↓"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-600 text-white rounded-lg px-4 py-2.5 flex items-center gap-3 flex-wrap animate-in slide-in-from-top-2" data-testid="bulk-action-bar">
          <span className="font-bold text-sm">{selectedIds.size} selected</span>
          <span className="opacity-30 text-lg">|</span>
          <button className="px-3 py-1 rounded-md text-xs font-semibold bg-white/15 border border-white/30 hover:bg-white/25 transition" onClick={() => bulkSetStatus("Approved")} data-testid="bulk-approve">✅ Mark Approved</button>
          <button className="px-3 py-1 rounded-md text-xs font-semibold bg-white/15 border border-white/30 hover:bg-white/25 transition" onClick={() => bulkSetStatus("In Progress")} data-testid="bulk-inprogress">🔵 In Progress</button>
          <button className="px-3 py-1 rounded-md text-xs font-semibold bg-white/15 border border-white/30 hover:bg-white/25 transition" onClick={() => { setBulkMoveTarget(""); setShowBulkMoveModal(true); }} data-testid="bulk-move">📁 Move Phase</button>
          <button className="px-3 py-1 rounded-md text-xs font-semibold bg-red-500/40 border border-red-500/50 hover:bg-red-500/60 transition" onClick={bulkDelete} data-testid="bulk-delete">🗑 Delete</button>
          <button className="ml-auto px-3 py-1 rounded-md text-xs font-semibold bg-white/15 border border-white/30 hover:bg-white/25 transition" onClick={clearSelection} data-testid="bulk-clear">✕ Clear</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap" data-testid="deliverables-toolbar">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-background flex-1 min-w-[180px] max-w-[280px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground/60" />
          <input
            type="text"
            className="border-none outline-none bg-transparent text-[13px] w-full placeholder:text-muted-foreground/40"
            placeholder="Search deliverables…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            data-testid="input-search-deliverables"
          />
        </div>
        <select className="h-8 px-2.5 pr-7 border rounded-lg bg-background text-[13px] outline-none appearance-none cursor-pointer" value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)} data-testid="select-phase-filter">
          <option value="">All Phases</option>
          {phases.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        <select className="h-8 px-2.5 pr-7 border rounded-lg bg-background text-[13px] outline-none appearance-none cursor-pointer" value={ragFilter} onChange={e => setRagFilter(e.target.value)} data-testid="select-rag-filter">
          <option value="">All RAG</option>
          {RAG_OPTIONS.filter(r => r !== "N/A").map(r => <option key={r}>{r}</option>)}
        </select>
        <select className="h-8 px-2.5 pr-7 border rounded-lg bg-background text-[13px] outline-none appearance-none cursor-pointer" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} data-testid="select-status-filter">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>

        {activeFilters.map((f, i) => (
          <div key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white rounded-full text-xs font-semibold cursor-pointer" onClick={f.clear} data-testid={`filter-pill-${i}`}>
            {f.label} <span className="opacity-70">✕</span>
          </div>
        ))}

        <div className="flex-1" />
        <button className="h-8 px-3 border rounded-lg bg-background text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition cursor-pointer" onClick={toggleCollapseAll} data-testid="button-collapse-all">
          {allCollapsed ? "⊞ Expand All" : "⊟ Collapse All"}
        </button>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button className="h-8 px-3 border rounded-lg bg-background text-[13px] font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition flex items-center gap-1.5 cursor-pointer" onClick={openPhaseModal} data-testid="button-manage-phases">
          <Settings className="h-3.5 w-3.5" /> Manage Phases
        </button>
        <button className="h-8 px-3 border rounded-lg bg-background text-[13px] font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition flex items-center gap-1.5 cursor-pointer" onClick={openImportModal} data-testid="button-import">
          <Upload className="h-3.5 w-3.5" /> Import
        </button>
        <button className="h-8 px-3 border rounded-lg bg-background text-[13px] font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition flex items-center gap-1.5 cursor-pointer" onClick={exportCSV} data-testid="button-export">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
        <div className="flex-1" />
        <Button size="sm" className="h-8 gap-1.5" onClick={openAddModal} data-testid="button-add-deliverable">
          <Plus className="h-3.5 w-3.5" /> Add Deliverable
        </Button>
      </div>

      {/* Phase Groups */}
      <div className="space-y-3" data-testid="phase-groups">
        {phaseGroups.length === 0 && (
          <div className="text-center py-12 text-muted-foreground" data-testid="empty-deliverables">
            <div className="text-3xl mb-2">📭</div>
            <p>No deliverables found. Add phases first, then create deliverables.</p>
          </div>
        )}

        {phaseGroups.map(group => {
          const { phase, phaseName, items, allItems } = group;
          const phaseId = phase?.id || -1;
          const phaseColor = phase?.color || "#888";
          const approved = allItems.filter(d => d.status === "Approved").length;
          const total = allItems.length;
          const pct = total ? Math.round(approved / total * 100) : 0;
          const isCollapsed = collapsedPhases.has(phaseId);
          const phaseComplete = total > 0 && approved === total;

          return (
            <div key={phaseName} className="rounded-xl border overflow-hidden shadow-sm" data-testid={`phase-group-${phaseName}`}>
              {/* Phase Header */}
              <div
                className="flex items-center gap-2.5 px-4 py-2.5 bg-muted/50 cursor-pointer select-none border-b hover:bg-muted/70 transition"
                onClick={() => toggleCollapse(phaseId)}
                data-testid={`phase-header-${phaseName}`}
              >
                <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: phaseColor }} />
                <span className="text-[13px] font-bold flex-1" style={{ color: phaseColor }}>{phaseName}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: phaseColor }} />
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{approved}/{total} approved</span>
                </div>
                {phaseComplete && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Complete</span>}
                <span className="text-[11.5px] text-muted-foreground bg-border px-2 py-0.5 rounded-full whitespace-nowrap">{items.length}{items.length !== total ? ` shown / ${total}` : ` / ${total}`}</span>
              </div>

              {/* Table */}
              {!isCollapsed && (
                <PhaseGroupTable
                  phaseName={phaseName}
                  items={items}
                  selectedIds={selectedIds}
                  openDrawerId={openDrawerId}
                  deliverables={deliverables}
                  onToggleSelect={toggleSelect}
                  onCycleStatus={cycleStatus}
                  onCycleRag={cycleRag}
                  onToggleDrawer={(id) => setOpenDrawerId(prev => prev === id ? null : id)}
                  onEdit={openEditModal}
                  onAudit={openAuditModal}
                  onDelete={deleteDeliverable}
                  onReview={openReviewModal}
                  onTogglePhaseSelect={togglePhaseSelect}
                  onRequestSignoff={(del) => {
                    const params = new URLSearchParams({
                      compose: "1",
                      projectId: String(projectId),
                      deliverableId: String(del.id),
                      deliverableTitle: del.name,
                    });
                    setLocation(`/modules/e-sign?${params.toString()}`);
                  }}
                  paginationResetKey={`${phaseName}|${searchQuery}|${phaseFilter}|${ragFilter}|${statusFilter}|${activeKpi}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      <FormDialogShell
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onCancel={() => setShowAddModal(false)}
        onSubmit={saveDeliverable}
        title={editDelId ? "Edit Deliverable" : "Add Deliverable"}
        saveLabel="Save Deliverable"
        saveTestId="button-save-deliverable"
        size="lg"
      >
        <FormSection title="Deliverable details" icon={<span className="h-2 w-2 rounded-full bg-blue-500" />}>
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel>Deliverable Name</FieldLabel>
            <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Business Requirements Document" data-testid="input-deliverable-name" />
          </div>
          <FieldGrid className="mb-3.5">
            <div className="space-y-1.5">
              <FieldLabel>Phase</FieldLabel>
              <select className="w-full h-9 px-3 border rounded-lg bg-background text-[13px] outline-none" value={formPhase} onChange={e => setFormPhase(e.target.value)} data-testid="select-deliverable-phase">
                {phases.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Type</FieldLabel>
              <select className="w-full h-9 px-3 border rounded-lg bg-background text-[13px] outline-none" value={formType} onChange={e => setFormType(e.target.value)} data-testid="select-deliverable-type">
                {DELIVERABLE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </FieldGrid>
          <FieldGrid className="mb-3.5">
            <div className="space-y-1.5">
              <FieldLabel>Status</FieldLabel>
              <select className="w-full h-9 px-3 border rounded-lg bg-background text-[13px] outline-none" value={formStatus} onChange={e => setFormStatus(e.target.value)} data-testid="select-deliverable-status">
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>RAG</FieldLabel>
              <select className="w-full h-9 px-3 border rounded-lg bg-background text-[13px] outline-none" value={formRag} onChange={e => setFormRag(e.target.value)} data-testid="select-deliverable-rag">
                {RAG_OPTIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </FieldGrid>
          <FieldGrid>
            <div className="space-y-1.5">
              <FieldLabel>Due Date</FieldLabel>
              <Input type="date" value={formDue} onChange={e => setFormDue(e.target.value)} data-testid="input-deliverable-due" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Progress %</FieldLabel>
              <div className="flex items-center gap-2">
                <input type="range" className="flex-1 accent-blue-600" min={0} max={100} value={formProg} onChange={e => setFormProg(Number(e.target.value))} data-testid="input-deliverable-progress" />
                <span className="text-xs text-muted-foreground w-8">{formProg}%</span>
              </div>
            </div>
          </FieldGrid>
        </FormSection>

        <FormDivider />

        <FormSection title="Stakeholders & notes" icon={<span className="h-2 w-2 rounded-full bg-emerald-500" />}>
          <div className="mb-3.5">
            <PeopleEditor label="Owners" hint="responsible for authoring & delivering" people={formOwners} onChange={setFormOwners} />
          </div>
          <div className="mb-3.5">
            <PeopleEditor label="Reviewers" hint="review content before approval" people={formReviewers} onChange={setFormReviewers} />
          </div>
          <div className="mb-3.5">
            <PeopleEditor label="Approvers" hint="formal sign-off required from each" people={formApprovers} onChange={setFormApprovers} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Notes</FieldLabel>
            <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optional context, links, blockers…" data-testid="input-deliverable-notes" />
          </div>
        </FormSection>
      </FormDialogShell>

      {/* Review Modal */}
      <FormDialogShell
        open={showReviewModal}
        onOpenChange={setShowReviewModal}
        onCancel={() => setShowReviewModal(false)}
        onSubmit={() => submitReview("approve")}
        title={reviewDelId ? `Review: ${deliverables.find(d => d.id === reviewDelId)?.name}` : "Review Deliverable"}
        saveLabel="Approve"
        saveTestId="button-review-approve"
        size="md"
      >
        <FormSection title="Review details" icon={<span className="h-2 w-2 rounded-full bg-amber-500" />}>
          {reviewDelId && (() => {
            const del = deliverables.find(d => d.id === reviewDelId);
            if (!del) return null;
            return (
              <div className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg border text-[13px]">
                  <strong>{del.name}</strong><br />
                  Phase: {del.phaseName} · Status: {del.status} · RAG: {del.ragStatus}<br />
                  Approvers: {((del.approvers as string[]) || []).join(", ") || "None set"}
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Your Name / Initials</FieldLabel>
                  <Input value={reviewWho} onChange={e => setReviewWho(e.target.value)} placeholder="e.g. AB" data-testid="input-review-who" />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Comment</FieldLabel>
                  <Textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Add a note, feedback, or approval comment…" data-testid="input-review-comment" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Audit Trail</div>
                  <AuditList audit={(del.auditLog as AuditEntry[]) || []} />
                </div>
              </div>
            );
          })()}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => submitReview("comment")} data-testid="button-review-comment">💬 Comment</Button>
            <Button variant="destructive" onClick={() => submitReview("changes")} data-testid="button-review-changes">🔴 Request Changes</Button>
          </div>
        </FormSection>
      </FormDialogShell>

      {/* Audit Trail Modal */}
      <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
        <DialogContent className="max-w-[580px]">
          <DialogHeader>
            <DialogTitle>📋 Audit Trail</DialogTitle>
          </DialogHeader>
          {auditDelId && (() => {
            const del = deliverables.find(d => d.id === auditDelId);
            if (!del) return null;
            return (
              <div>
                <div className="mb-3 text-[13px]">
                  <strong>{del.name}</strong> · <span className="px-1.5 py-0.5 rounded bg-muted text-[10.5px] font-mono font-bold text-muted-foreground">v{del.version}.0</span>
                </div>
                <AuditList audit={(del.auditLog as AuditEntry[]) || []} />
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuditModal(false)} data-testid="button-close-audit">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phase Manager Modal */}
      <FormDialogShell
        open={showPhaseModal}
        onOpenChange={(open) => { if (!savingPhases) setShowPhaseModal(open); }}
        onCancel={() => setShowPhaseModal(false)}
        onSubmit={savePhases}
        title="Manage Phases"
        saveLabel={savingPhases ? "Saving..." : "Save Phases"}
        saving={savingPhases}
        saveTestId="button-save-phases"
        size="md"
      >
        <FormSection title="Phase configuration" icon={<span className="h-2 w-2 rounded-full bg-violet-500" />}>
          <div className="flex flex-col gap-4 overflow-hidden min-h-0">
            <p className="text-[13px] text-muted-foreground shrink-0">Choose a template or customise. Drag to reorder.</p>
            <div className="shrink-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Templates</div>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { key: "agile", label: "🔄 Agile" },
                  { key: "waterfall", label: "💧 Waterfall" },
                  { key: "erp", label: "🏗 ERP" },
                  { key: "saas", label: "☁️ SaaS" },
                  { key: "custom", label: "✏️ Start Fresh" },
                ].map(t => (
                  <button
                    key={t.key}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition ${
                      selectedTemplate === t.key ? "border-blue-500 text-blue-600 bg-blue-50" : "border-border text-muted-foreground bg-muted/50 hover:border-blue-400 hover:text-blue-500"
                    }`}
                    onClick={() => applyTemplate(t.key)}
                    data-testid={`template-${t.key}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col min-h-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 shrink-0">Phases</div>
              <div className="flex flex-col gap-1.5 overflow-y-auto min-h-0 pr-1">
                {tempPhases.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border shrink-0">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab" />
                    <div
                      className="w-3 h-3 rounded-full cursor-pointer hover:scale-125 transition-transform shrink-0"
                      style={{ background: p.color }}
                      onClick={() => cyclePhaseColor(i)}
                      data-testid={`phase-color-${i}`}
                    />
                    <input
                      className="flex-1 bg-transparent border-none outline-none text-[13.5px] font-medium focus:bg-background focus:ring-2 focus:ring-blue-500 rounded px-1"
                      value={p.name}
                      onChange={e => setTempPhases(prev => prev.map((ph, j) => j === i ? { ...ph, name: e.target.value } : ph))}
                      data-testid={`input-phase-name-${i}`}
                    />
                    <button
                      className="text-muted-foreground/40 hover:text-red-500 transition cursor-pointer text-sm"
                      onClick={() => setTempPhases(prev => prev.filter((_, j) => j !== i))}
                      data-testid={`delete-phase-${i}`}
                    >✕</button>
                  </div>
                ))}
              </div>
              <button
                className="w-full mt-2 h-8 border rounded-lg bg-background text-[13px] font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                onClick={addTempPhase}
                data-testid="button-add-phase"
              >
                ＋ Add Phase
              </button>
            </div>
          </div>
        </FormSection>
      </FormDialogShell>

      {/* Import Modal */}
      <FormDialogShell
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onCancel={() => setShowImportModal(false)}
        onSubmit={confirmImport}
        title="Import Deliverables"
        saveLabel={`Add ${importRows.length} Deliverables`}
        disabled={importRows.length === 0 || importTab !== "upload"}
        saveTestId="button-confirm-import"
        size="xl"
      >
        <FormSection title="Import options" icon={<span className="h-2 w-2 rounded-full bg-cyan-500" />}>
          <div>
            <div className="flex border-b mb-5">
              <button className={`px-5 py-2 text-[13px] font-semibold border-b-[2.5px] -mb-px transition ${importTab === "upload" ? "text-blue-600 border-blue-600" : "text-muted-foreground border-transparent hover:text-foreground"}`} onClick={() => setImportTab("upload")} data-testid="import-tab-upload">📂 Upload CSV</button>
              <button className={`px-5 py-2 text-[13px] font-semibold border-b-[2.5px] -mb-px transition ${importTab === "template" ? "text-blue-600 border-blue-600" : "text-muted-foreground border-transparent hover:text-foreground"}`} onClick={() => setImportTab("template")} data-testid="import-tab-template">📋 Download Template</button>
            </div>

            {importTab === "upload" && (
              <div>
                <div
                  className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition hover:border-blue-500 hover:bg-blue-50/50"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-blue-500", "bg-blue-50/50"); }}
                  onDragLeave={e => { e.currentTarget.classList.remove("border-blue-500", "bg-blue-50/50"); }}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("border-blue-500", "bg-blue-50/50");
                    const file = e.dataTransfer.files[0];
                    if (file) parseCSVFile(file);
                  }}
                  data-testid="drop-zone"
                >
                  <div className="text-3xl mb-2">📂</div>
                  <div className="font-semibold text-sm mb-1">Drop your CSV here, or click to browse</div>
                  <div className="text-xs text-muted-foreground">Accepts .csv files · All columns from the template are supported</div>
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) parseCSVFile(f); }} data-testid="input-file" />
                </div>

                {importStatus.msg && (
                  <div className={`mt-3 p-2.5 rounded-lg text-[13px] flex items-center gap-2 border ${
                    importStatus.type === "ok" ? "bg-green-50 text-green-800 border-green-300" : "bg-red-50 text-red-800 border-red-300"
                  }`}>
                    {importStatus.msg}
                  </div>
                )}

                {importRows.length > 0 && (
                  <div className="mt-4 border rounded-lg overflow-hidden max-h-[220px] overflow-y-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-2.5 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                          <th className="px-2.5 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Phase</th>
                          <th className="px-2.5 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Type</th>
                          <th className="px-2.5 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                          <th className="px-2.5 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">RAG</th>
                          <th className="px-2.5 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 8).map((r, i) => (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="px-2.5 py-1.5 truncate max-w-[160px]" title={r.name}>{r.name}</td>
                            <td className="px-2.5 py-1.5">{r.phaseName}</td>
                            <td className="px-2.5 py-1.5">{r.type}</td>
                            <td className="px-2.5 py-1.5">{r.status}</td>
                            <td className="px-2.5 py-1.5">{r.ragStatus}</td>
                            <td className="px-2.5 py-1.5">{r.dueDate || "—"}</td>
                          </tr>
                        ))}
                        {importRows.length > 8 && (
                          <tr><td colSpan={6} className="text-center py-2 text-muted-foreground italic">…and {importRows.length - 8} more</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {importTab === "template" && (
              <div>
                <div className="bg-muted/50 border rounded-xl p-5 mb-4">
                  <h3 className="text-sm font-bold mb-1">📋 Import Template</h3>
                  <p className="text-[13px] text-muted-foreground mb-3 leading-relaxed">Download the CSV template below. Fill in one deliverable per row. Required fields are highlighted — all other fields are optional and will default to sensible values if left blank.</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {[
                      { label: "Name ✱", req: true }, { label: "Phase ✱", req: true },
                      { label: "Type" }, { label: "Owners" }, { label: "Reviewers" },
                      { label: "Approvers" }, { label: "Due Date" }, { label: "Status" },
                      { label: "RAG" }, { label: "Progress %" }, { label: "Notes" },
                    ].map(f => (
                      <span key={f.label} className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${
                        f.req ? "border-blue-400 text-blue-600 bg-blue-50" : "border-border text-muted-foreground"
                      }`}>{f.label}</span>
                    ))}
                  </div>
                  <Button size="sm" onClick={downloadTemplate} data-testid="button-download-template">⬇ Download CSV Template</Button>
                </div>
                <div className="text-[13px] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Field guidance:</strong><br />
                  • <strong>Owners / Reviewers / Approvers</strong> — separate multiple names with a pipe <code className="bg-muted px-1 rounded text-xs">|</code> e.g. <em>James M|Karen L</em><br />
                  • <strong>Type</strong> — one of: Document, Report, Plan, Specification, Presentation, Template, Sign-off, Other<br />
                  • <strong>Status</strong> — one of: Not Started, In Progress, In Review, Approved, Overdue<br />
                  • <strong>RAG</strong> — one of: Green, Amber, Red, N/A<br />
                  • <strong>Due Date</strong> — format <em>YYYY-MM-DD</em> e.g. 2025-09-01<br />
                  • <strong>Progress %</strong> — number 0–100
                </div>
              </div>
            )}
          </div>
        </FormSection>
      </FormDialogShell>

      {/* Bulk Move Phase Modal */}
      <Dialog open={showBulkMoveModal} onOpenChange={setShowBulkMoveModal}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Move to Phase</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Target Phase</label>
            <select className="w-full h-9 px-3 border rounded-lg bg-background text-[13px] outline-none" value={bulkMoveTarget} onChange={e => setBulkMoveTarget(e.target.value)} data-testid="select-bulk-move-target">
              <option value="">Select phase…</option>
              {phases.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkMoveModal(false)}>Cancel</Button>
            <Button onClick={bulkMove} data-testid="button-confirm-bulk-move">Move Selected</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PhaseGroupTable({
  phaseName,
  items,
  selectedIds,
  openDrawerId,
  deliverables,
  onToggleSelect,
  onCycleStatus,
  onCycleRag,
  onToggleDrawer,
  onEdit,
  onAudit,
  onDelete,
  onReview,
  onTogglePhaseSelect,
  onRequestSignoff,
  paginationResetKey,
}: {
  phaseName: string;
  items: PmDeliverable[];
  selectedIds: Set<number>;
  openDrawerId: number | null;
  deliverables: PmDeliverable[];
  onToggleSelect: (id: number) => void;
  onCycleStatus: (del: PmDeliverable) => Promise<void>;
  onCycleRag: (del: PmDeliverable) => Promise<void>;
  onToggleDrawer: (id: number) => void;
  onEdit: (del: PmDeliverable) => void;
  onAudit: (id: number) => void;
  onDelete: (id: number) => Promise<void>;
  onReview: (id: number) => void;
  onTogglePhaseSelect: (phaseName: string, checked: boolean) => void;
  onRequestSignoff: (del: PmDeliverable) => void;
  paginationResetKey: string;
}) {
  const pagination = useTablePagination(items, { resetKey: paginationResetKey });

  return (
    <div className="bg-background overflow-x-auto">
      <table className="w-full border-collapse min-w-[900px]">
        <thead>
          <tr className="border-b">
            <th className="w-9 px-3 py-2 text-left">
              <input
                type="checkbox"
                className="accent-blue-600 cursor-pointer"
                onChange={e => onTogglePhaseSelect(phaseName, e.target.checked)}
                data-testid={`checkbox-phase-all-${phaseName}`}
              />
            </th>
            <th className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2 text-left">Deliverable</th>
            <th className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2 text-left w-[100px]">Type</th>
            <th className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2 text-left w-[100px]">Due</th>
            <th className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2 text-left w-[110px]">Status</th>
            <th className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2 text-left w-[86px]">RAG</th>
            <th className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2 text-left w-[96px]">Progress</th>
            <th className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2 text-center w-[54px]">Ver</th>
            <th className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2 text-center w-[130px]">Approvals</th>
            <th className="w-[68px]" />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={10} className="text-center py-8 text-muted-foreground">
                <div className="text-2xl mb-1">🔍</div>
                <p className="text-sm">No deliverables match filters</p>
              </td>
            </tr>
          )}
          {pagination.paginatedItems.map(d => {
            const isSel = selectedIds.has(d.id);
            const isDrawerOpen = openDrawerId === d.id;
            const ai = approvalInfo(d);
            const TypeIcon = TYPE_ICONS[d.type] || FileText;
            const dateInfo = formatDate(d.dueDate);
            const dateDisplay = typeof dateInfo === "string" ? { text: dateInfo, className: "" } : dateInfo;

            return (
              <PhaseRow
                key={d.id}
                d={d}
                isSel={isSel}
                isDrawerOpen={isDrawerOpen}
                ai={ai}
                TypeIcon={TypeIcon}
                dateDisplay={dateDisplay}
                onToggleSelect={onToggleSelect}
                onCycleStatus={() => onCycleStatus(d)}
                onCycleRag={() => onCycleRag(d)}
                onToggleDrawer={() => onToggleDrawer(d.id)}
                onEdit={() => onEdit(d)}
                onAudit={() => onAudit(d.id)}
                onDelete={() => onDelete(d.id)}
                onReview={() => onReview(d.id)}
                deliverables={deliverables}
                onRequestSignoff={onRequestSignoff}
              />
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
    </div>
  );
}

// Phase table row with approval drawer
function PhaseRow({
  d, isSel, isDrawerOpen, ai, TypeIcon, dateDisplay,
  onToggleSelect, onCycleStatus, onCycleRag, onToggleDrawer,
  onEdit, onAudit, onDelete, onReview, deliverables, onRequestSignoff,
}: {
  d: PmDeliverable;
  isSel: boolean;
  isDrawerOpen: boolean;
  ai: ReturnType<typeof approvalInfo>;
  TypeIcon: typeof FileText;
  dateDisplay: { text: string; className: string };
  onToggleSelect: (id: number) => void;
  onCycleStatus: () => void;
  onCycleRag: () => void;
  onToggleDrawer: () => void;
  onEdit: () => void;
  onAudit: () => void;
  onDelete: () => void;
  onReview: (prefill: string) => void;
  deliverables: PmDeliverable[];
  onRequestSignoff: (del: PmDeliverable) => void;
}) {
  const audit = (d.auditLog as AuditEntry[]) || [];
  const approvers = (d.approvers as string[]) || [];
  const owners = (d.owners as string[]) || [];
  const reviewers = (d.reviewers as string[]) || [];
  const approvedSet = new Set(audit.filter(a => a.action === "approve").map(a => a.who));
  const changesBy = new Set(audit.filter(a => a.action === "changes").map(a => a.who));
  const reviewedBy = new Set(audit.filter(a => a.action === "comment").map(a => a.who));
  const lastAudit = audit.length ? audit[audit.length - 1] : null;

  return (
    <>
      <tr
        className={`group border-b transition cursor-pointer hover:bg-muted/30 ${isSel ? "bg-blue-50/50" : ""} ${isDrawerOpen ? "bg-purple-50/30 border-b-0" : ""}`}
        onClick={onEdit}
        data-testid={`row-deliverable-${d.id}`}
      >
        <td className="px-3 py-2">
          <input type="checkbox" className="accent-blue-600 cursor-pointer" checked={isSel} onChange={() => onToggleSelect(d.id)} onClick={e => e.stopPropagation()} data-testid={`checkbox-deliverable-${d.id}`} />
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium leading-tight">{d.name}</div>
              {d.notes && <div className="text-[11.5px] text-muted-foreground truncate mt-0.5">{d.notes}</div>}
            </div>
          </div>
        </td>
        <td className="px-3 py-2 text-[12.5px] text-muted-foreground">{d.type}</td>
        <td className="px-3 py-2"><span className={`text-[12.5px] ${dateDisplay.className}`}>{dateDisplay.text}</span></td>
        <td className="px-3 py-2">
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-[11.5px] font-semibold cursor-pointer transition hover:scale-105 ${statusClasses(d.status)}`}
            onClick={e => { e.stopPropagation(); onCycleStatus(); }}
            title="Click to cycle"
            data-testid={`status-pill-${d.id}`}
          >{d.status}</span>
        </td>
        <td className="px-3 py-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-semibold cursor-pointer transition hover:scale-105 ${ragClasses(d.ragStatus)}`}
            onClick={e => { e.stopPropagation(); onCycleRag(); }}
            title="Click to cycle"
            data-testid={`rag-pill-${d.id}`}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ragDot(d.ragStatus) }} />
            {d.ragStatus}
          </span>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <div className="w-14 h-1 bg-border rounded-full overflow-hidden shrink-0">
              <div className="h-full rounded-full" style={{ width: `${d.progress}%`, background: progColor(d.progress) }} />
            </div>
            <span className="text-[11.5px] text-muted-foreground">{d.progress}%</span>
          </div>
        </td>
        <td className="px-3 py-2 text-center">
          <span className="px-1.5 py-0.5 rounded bg-muted text-[10.5px] font-mono font-bold text-muted-foreground">v{d.version}.0</span>
        </td>
        <td className="px-3 py-2 text-center">
          <button
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold cursor-pointer transition hover:scale-105 whitespace-nowrap ${ai.cls} ${isDrawerOpen ? "ring-2 ring-current" : ""}`}
            onClick={e => { e.stopPropagation(); onToggleDrawer(); }}
            title="Click to see people & approvals"
            data-testid={`approval-chip-${d.id}`}
          >
            {ai.icon} {ai.label}
          </button>
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
            {(d.type === "Sign-off" || d.status === "In Review") && (
              <button
                className="w-6 h-6 rounded-md border flex items-center justify-center text-primary hover:text-primary hover:border-primary/30 transition cursor-pointer"
                title="Request e-Sign"
                onClick={e => { e.stopPropagation(); onRequestSignoff(d); }}
                data-testid={`button-signoff-${d.id}`}
              >
                <FileSignature className="h-3 w-3" />
              </button>
            )}
            <button className="w-6 h-6 rounded-md border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition cursor-pointer" title="Edit" onClick={e => { e.stopPropagation(); onEdit(); }} data-testid={`button-edit-${d.id}`}>
              <Pencil className="h-3 w-3" />
            </button>
            <button className="w-6 h-6 rounded-md border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition cursor-pointer" title="Audit trail" onClick={e => { e.stopPropagation(); onAudit(); }} data-testid={`button-audit-${d.id}`}>
              <ClipboardList className="h-3 w-3" />
            </button>
            <button className="w-6 h-6 rounded-md border flex items-center justify-center text-muted-foreground hover:text-red-500 hover:border-red-300 transition cursor-pointer" title="Delete" onClick={e => { e.stopPropagation(); onDelete(); }} data-testid={`button-delete-${d.id}`}>
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </td>
      </tr>

      {/* Approval Drawer */}
      {isDrawerOpen && (
        <tr className="border-b" data-testid={`drawer-${d.id}`}>
          <td colSpan={10} className="p-0">
            <div className="bg-gradient-to-b from-purple-50/80 to-muted/30 border-t border-purple-200 p-4 pl-12 animate-in slide-in-from-top-1">
              <div className="grid grid-cols-3 gap-0">
                {/* Owners */}
                <div className="px-4 relative">
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2.5 flex items-center gap-1.5">
                    <span className="w-[18px] h-[18px] rounded bg-blue-100 flex items-center justify-center text-[10px]">✍️</span>
                    Owner(s)
                  </div>
                  {owners.length === 0 && <div className="text-xs text-muted-foreground/40 px-1">None assigned</div>}
                  {owners.map((name, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-blue-50/50 transition mb-1">
                      <div className="w-7 h-7 rounded-full text-[11px] font-bold text-white flex items-center justify-center shrink-0" style={{ background: AV_COL[i % AV_COL.length] }}>
                        {initials(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate">{name}</div>
                        <div className="text-[11px] text-muted-foreground/50">Document Owner</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reviewers */}
                <div className="px-4 relative border-l">
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2.5 flex items-center gap-1.5">
                    <span className="w-[18px] h-[18px] rounded bg-amber-100 flex items-center justify-center text-[10px]">👁️</span>
                    Reviewer(s)
                  </div>
                  {reviewers.length === 0 && <div className="text-xs text-muted-foreground/40 px-1">None assigned</div>}
                  {reviewers.map((name, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-amber-50/50 transition mb-1">
                      <div className="w-7 h-7 rounded-full text-[11px] font-bold text-white flex items-center justify-center shrink-0" style={{ background: AV_COL[i % AV_COL.length] }}>
                        {initials(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate">{name}</div>
                        <div className="text-[11px] text-muted-foreground/50">Reviewer</div>
                      </div>
                      <div>
                        {changesBy.has(name) ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-bold">⚠ Changes</span>
                        ) : reviewedBy.has(name) ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">Reviewed</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-bold">Pending</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Approvers */}
                <div className="px-4 relative border-l">
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2.5 flex items-center gap-1.5">
                    <span className="w-[18px] h-[18px] rounded bg-green-100 flex items-center justify-center text-[10px]">✅</span>
                    Approver(s)
                  </div>
                  {approvers.length === 0 && <div className="text-xs text-muted-foreground/40 px-1">None assigned</div>}
                  {approvers.map((name, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-green-50/50 transition mb-1">
                      <div className="w-7 h-7 rounded-full text-[11px] font-bold text-white flex items-center justify-center shrink-0" style={{ background: AV_COL[i % AV_COL.length] }}>
                        {initials(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate">{name}</div>
                        <div className="text-[11px] text-muted-foreground/50">Approver</div>
                      </div>
                      <div>
                        {approvedSet.has(name) ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 text-[11px] font-bold">✓ Approved</span>
                        ) : changesBy.has(name) ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-bold">⚠ Changes</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-bold">Pending</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="col-span-3 border-t mt-3 pt-2.5 flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs text-muted-foreground">
                  {lastAudit
                    ? <>Last activity: <strong>{lastAudit.who}</strong> {lastAudit.action === "approve" ? "approved" : lastAudit.action === "changes" ? "requested changes" : "commented"} · {lastAudit.time}</>
                    : "No activity yet"
                  }
                  {" "}·{" "}<strong>v{d.version}.0</strong>
                </div>
                <div className="flex gap-1.5">
                  <button className="px-2.5 py-1 rounded-md border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition cursor-pointer" onClick={e => { e.stopPropagation(); onAudit(); }} data-testid={`drawer-history-${d.id}`}>📋 History</button>
                  <button className="px-2.5 py-1 rounded-md bg-red-600 border-red-600 text-white text-xs font-semibold hover:brightness-110 transition cursor-pointer" onClick={e => { e.stopPropagation(); onReview("changes"); }} data-testid={`drawer-changes-${d.id}`}>🔴 Request Changes</button>
                  <button className="px-2.5 py-1 rounded-md bg-green-600 border-green-600 text-white text-xs font-semibold hover:brightness-110 transition cursor-pointer" onClick={e => { e.stopPropagation(); onReview("approve"); }} data-testid={`drawer-approve-${d.id}`}>✅ Approve</button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function AuditList({ audit }: { audit: AuditEntry[] }) {
  if (!audit.length) {
    return <div className="text-[13px] text-muted-foreground/50 text-center py-5">No activity recorded yet</div>;
  }

  return (
    <div className="space-y-1.5">
      {audit.slice().reverse().map((a, i) => {
        const label = a.action === "approve" ? "Approved" : a.action === "changes" ? "Requested Changes" : "Commented";
        const cls = a.action === "approve" ? "text-green-600" : a.action === "changes" ? "text-red-600" : "text-blue-600";
        return (
          <div key={i} className="flex gap-2.5 items-start p-2.5 bg-muted/50 rounded-lg border" data-testid={`audit-entry-${i}`}>
            <div className="w-[26px] h-[26px] rounded-full text-[10px] font-bold text-white flex items-center justify-center shrink-0" style={{ background: AV_COL[i % AV_COL.length] }}>
              {initials(a.who)}
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-medium">
                <strong>{a.who}</strong>{" "}
                <span className={`font-bold ${cls}`}>{label}</span>
              </div>
              {a.comment && <div className="text-xs text-muted-foreground italic mt-0.5">"{a.comment}"</div>}
              <div className="text-[11.5px] text-muted-foreground/50 mt-0.5">{a.time}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
