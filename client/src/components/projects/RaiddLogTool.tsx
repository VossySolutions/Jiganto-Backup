import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ImportModal } from "@/components/ImportModal";
import { TablePagination } from "@/components/TablePagination";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useTablePagination } from "@/hooks/use-table-pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PmRiskLogIcon,
  PmIssuesLogIcon,
  PmAssumptionsLogIcon,
  PmDependenciesLogIcon,
  PmDecisionsLogIcon,
} from "@/components/icons/ModuleIcons";
import {
  X,
  Search,
  ChevronDown,
  Plus,
  Download,
  Upload,
  Share2,
  Archive,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Flag,
  Loader2,
} from "lucide-react";

type LogType = "risk" | "assumptions" | "issues" | "dependencies" | "decisions";

interface RaiddLogToolProps {
  logType: LogType;
  projectId: number;
}

interface RaiddItem {
  id: number;
  tenantId: number;
  projectId: number;
  type: string;
  code: string | null;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  category: string | null;
  workstream: string | null;
  ownerId: string | null;
  ownerName: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  resolvedDate: string | null;
  impact: string | null;
  likelihood: string | null;
  score: number | null;
  mitigation: string | null;
  contingency: string | null;
  response: string | null;
  basis: string | null;
  validationMethod: string | null;
  validationDueDate: string | null;
  timelineImpact: string | null;
  issueType: string | null;
  resolution: string | null;
  resolutionTarget: string | null;
  dependentOn: string | null;
  requiredByDate: string | null;
  providerConfirmed: boolean | null;
  decisionBody: string | null;
  decisionDate: string | null;
  rationale: string | null;
  escalated: boolean | null;
  escalationLevel: string | null;
  escalationTo: string | null;
  escalationReason: string | null;
  escalationResponse: string | null;
  escalationDays: number | null;
  archived: boolean | null;
  closed: boolean | null;
  linkedItems: Array<{ id: string; label: string }> | null;
  activityLog: Array<{ dot: string; text: string; time: string; type: string }> | null;
  tags: string[] | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ColumnDef {
  key: string;
  label: string;
  visible: boolean;
  locked?: boolean;
}

interface StatCard {
  label: string;
  filter: string;
  cls: string;
  sub: string;
  esc?: boolean;
  countFn: (items: RaiddItem[]) => number;
}

const LOG_CONFIG: Record<LogType, {
  title: string;
  addLabel: string;
  typeValue: string;
  codePrefix: string;
  iconColor: string;
  iconBg: string;
  Icon: React.ComponentType<any>;
  columns: ColumnDef[];
  categories: string[];
  statusOptions: string[];
  priorityOptions: string[];
  statCards: StatCard[];
  showHeatmap: boolean;
}> = {
  risk: {
    title: "Risk Register",
    addLabel: "Add Risk",
    typeValue: "risk",
    codePrefix: "R",
    iconColor: "#ef4444",
    iconBg: "rgba(239,68,68,0.1)",
    Icon: PmRiskLogIcon,
    columns: [
      { key: "cb", label: "", visible: true, locked: true },
      { key: "code", label: "ID", visible: true },
      { key: "title", label: "Title", visible: true },
      { key: "category", label: "Category", visible: true },
      { key: "score", label: "Score", visible: true },
      { key: "priority", label: "Priority", visible: true },
      { key: "status", label: "Status", visible: true },
      { key: "owner", label: "Owner", visible: true },
      { key: "escalation", label: "Escalation", visible: true },
      { key: "days", label: "Days Esc.", visible: true },
      { key: "actions", label: "", visible: true, locked: true },
    ],
    categories: ["Technical", "Stakeholder", "Vendor", "Compliance", "Financial", "Operational", "Resource", "Scope"],
    statusOptions: ["Open", "Mitigating", "Escalated", "Resolved", "Closed"],
    priorityOptions: ["Critical", "High", "Medium", "Low"],
    statCards: [
      { label: "Total Risks", filter: "all", cls: "", sub: "All workstreams", countFn: (items) => items.filter(r => !r.archived).length },
      { label: "Critical/High", filter: "critical_high", cls: "text-red-500", sub: "Need attention", countFn: (items) => items.filter(r => !r.archived && (r.priority === "Critical" || r.priority === "High")).length },
      { label: "Mitigating", filter: "mitigating", cls: "text-purple-500", sub: "Actions underway", countFn: (items) => items.filter(r => !r.archived && r.status === "Mitigating").length },
      { label: "Resolved", filter: "resolved", cls: "text-green-500", sub: "Closed out", countFn: (items) => items.filter(r => !r.archived && r.status === "Resolved").length },
      { label: "Escalated", filter: "escalated", cls: "text-amber-500", sub: "Awaiting response", esc: true, countFn: (items) => items.filter(r => !r.archived && r.escalated).length },
    ],
    showHeatmap: true,
  },
  assumptions: {
    title: "Assumptions Log",
    addLabel: "Add Assumption",
    typeValue: "assumption",
    codePrefix: "A",
    iconColor: "#3b82f6",
    iconBg: "rgba(59,130,246,0.1)",
    Icon: PmAssumptionsLogIcon,
    columns: [
      { key: "cb", label: "", visible: true, locked: true },
      { key: "code", label: "ID", visible: true },
      { key: "title", label: "Assumption", visible: true },
      { key: "category", label: "Category", visible: true },
      { key: "priority", label: "Impact", visible: true },
      { key: "basis", label: "Basis", visible: false },
      { key: "dueDate", label: "Validation Due", visible: true },
      { key: "status", label: "Status", visible: true },
      { key: "owner", label: "Owner", visible: true },
      { key: "escalation", label: "Escalation", visible: true },
      { key: "actions", label: "", visible: true, locked: true },
    ],
    categories: ["Technical", "Business", "Resource", "Vendor", "Regulatory", "Process"],
    statusOptions: ["Unvalidated", "Validated", "Invalidated", "Converted to Risk", "Closed"],
    priorityOptions: ["Critical", "High", "Medium", "Low"],
    statCards: [
      { label: "Total", filter: "all", cls: "", sub: "All assumptions", countFn: (items) => items.filter(r => !r.archived).length },
      { label: "Unvalidated", filter: "unvalidated", cls: "text-blue-500", sub: "Pending check", countFn: (items) => items.filter(r => !r.archived && r.status === "Unvalidated").length },
      { label: "Validated", filter: "validated", cls: "text-green-500", sub: "Confirmed true", countFn: (items) => items.filter(r => !r.archived && r.status === "Validated").length },
      { label: "Invalidated", filter: "invalidated", cls: "text-red-500", sub: "Proven false", countFn: (items) => items.filter(r => !r.archived && r.status === "Invalidated").length },
      { label: "Escalated", filter: "escalated", cls: "text-amber-500", sub: "Awaiting response", esc: true, countFn: (items) => items.filter(r => !r.archived && r.escalated).length },
    ],
    showHeatmap: false,
  },
  issues: {
    title: "Issues Log",
    addLabel: "Add Issue",
    typeValue: "issue",
    codePrefix: "I",
    iconColor: "#f59e0b",
    iconBg: "rgba(245,158,11,0.1)",
    Icon: PmIssuesLogIcon,
    columns: [
      { key: "cb", label: "", visible: true, locked: true },
      { key: "code", label: "ID", visible: true },
      { key: "title", label: "Title", visible: true },
      { key: "category", label: "Category", visible: true },
      { key: "issueType", label: "Type", visible: true },
      { key: "timelineImpact", label: "Timeline Impact", visible: true },
      { key: "resolution", label: "Resolution Plan", visible: false },
      { key: "status", label: "Status", visible: true },
      { key: "owner", label: "Owner", visible: true },
      { key: "escalation", label: "Escalation", visible: true },
      { key: "days", label: "Days Esc.", visible: true },
      { key: "actions", label: "", visible: true, locked: true },
    ],
    categories: ["Technical", "Stakeholder", "Process", "Resource", "Vendor", "Budget", "Scope"],
    statusOptions: ["Open", "In Progress", "Escalated", "Resolved", "Closed"],
    priorityOptions: ["Critical", "High", "Medium", "Low"],
    statCards: [
      { label: "Total Issues", filter: "all", cls: "", sub: "All workstreams", countFn: (items) => items.filter(r => !r.archived).length },
      { label: "Blockers", filter: "blocker", cls: "text-red-500", sub: "Stopping progress", countFn: (items) => items.filter(r => !r.archived && r.issueType === "Blocker").length },
      { label: "In Progress", filter: "inprogress", cls: "text-amber-500", sub: "Being resolved", countFn: (items) => items.filter(r => !r.archived && r.status === "In Progress").length },
      { label: "Resolved", filter: "resolved", cls: "text-green-500", sub: "Closed out", countFn: (items) => items.filter(r => !r.archived && r.status === "Resolved").length },
      { label: "Escalated", filter: "escalated", cls: "text-amber-500", sub: "Awaiting response", esc: true, countFn: (items) => items.filter(r => !r.archived && r.escalated).length },
    ],
    showHeatmap: false,
  },
  dependencies: {
    title: "Dependencies Log",
    addLabel: "Add Dependency",
    typeValue: "dependency",
    codePrefix: "D",
    iconColor: "#8b5cf6",
    iconBg: "rgba(139,92,246,0.1)",
    Icon: PmDependenciesLogIcon,
    columns: [
      { key: "cb", label: "", visible: true, locked: true },
      { key: "code", label: "ID", visible: true },
      { key: "title", label: "Deliverable", visible: true },
      { key: "issueType", label: "Type", visible: true },
      { key: "dependentOn", label: "Dependent On", visible: true },
      { key: "requiredByDate", label: "Required By", visible: true },
      { key: "providerConfirmed", label: "Confirmed", visible: true },
      { key: "priority", label: "Impact", visible: true },
      { key: "status", label: "Status", visible: true },
      { key: "escalation", label: "Escalation", visible: true },
      { key: "actions", label: "", visible: true, locked: true },
    ],
    categories: ["External", "Internal"],
    statusOptions: ["Identified", "Confirmed", "At Risk", "Delayed", "Met", "Closed"],
    priorityOptions: ["Critical", "High", "Medium", "Low"],
    statCards: [
      { label: "Total", filter: "all", cls: "", sub: "All", countFn: (items) => items.filter(r => !r.archived).length },
      { label: "At Risk", filter: "atrisk", cls: "text-red-500", sub: "Unconfirmed/delayed", countFn: (items) => items.filter(r => !r.archived && r.status === "At Risk").length },
      { label: "Confirmed", filter: "confirmed", cls: "text-blue-500", sub: "Provider confirmed", countFn: (items) => items.filter(r => !r.archived && r.status === "Confirmed").length },
      { label: "Met", filter: "met", cls: "text-green-500", sub: "Delivered", countFn: (items) => items.filter(r => !r.archived && r.status === "Met").length },
      { label: "Escalated", filter: "escalated", cls: "text-amber-500", sub: "None active", esc: true, countFn: (items) => items.filter(r => !r.archived && r.escalated).length },
    ],
    showHeatmap: false,
  },
  decisions: {
    title: "Decisions Log",
    addLabel: "Add Decision",
    typeValue: "decision",
    codePrefix: "DC",
    iconColor: "#10b981",
    iconBg: "rgba(16,185,129,0.1)",
    Icon: PmDecisionsLogIcon,
    columns: [
      { key: "cb", label: "", visible: true, locked: true },
      { key: "code", label: "ID", visible: true },
      { key: "title", label: "Decision Statement", visible: true },
      { key: "category", label: "Category", visible: true },
      { key: "decisionBody", label: "Decision Body", visible: true },
      { key: "decisionDate", label: "Decision Date", visible: true },
      { key: "owner", label: "Made By", visible: true },
      { key: "rationale", label: "Rationale", visible: false },
      { key: "status", label: "Status", visible: true },
      { key: "escalation", label: "Escalation", visible: true },
      { key: "actions", label: "", visible: true, locked: true },
    ],
    categories: ["Architecture", "Process", "Commercial", "Resource", "Scope", "Timeline", "Policy", "Vendor"],
    statusOptions: ["Proposed", "Pending Approval", "Approved", "Superseded", "Deferred", "Closed"],
    priorityOptions: ["Critical", "High", "Medium", "Low"],
    statCards: [
      { label: "Total", filter: "all", cls: "", sub: "All decisions", countFn: (items) => items.filter(r => !r.archived).length },
      { label: "Approved", filter: "approved", cls: "text-green-500", sub: "Formally approved", countFn: (items) => items.filter(r => !r.archived && r.status === "Approved").length },
      { label: "Pending", filter: "pending", cls: "text-amber-500", sub: "Awaiting approval", countFn: (items) => items.filter(r => !r.archived && r.status === "Pending Approval").length },
      { label: "Deferred", filter: "deferred", cls: "", sub: "On hold", countFn: (items) => items.filter(r => !r.archived && r.status === "Deferred").length },
      { label: "Escalated", filter: "escalated", cls: "text-amber-500", sub: "Awaiting response", esc: true, countFn: (items) => items.filter(r => !r.archived && r.escalated).length },
    ],
    showHeatmap: false,
  },
};

const PRI_STYLES: Record<string, string> = {
  Critical: "text-red-500 bg-red-500/10",
  High: "text-orange-500 bg-orange-500/10",
  Medium: "text-amber-500 bg-amber-500/10",
  Low: "text-green-500 bg-green-500/10",
};

const STATUS_STYLES: Record<string, string> = {
  Open: "text-blue-500 border-blue-500/30 bg-blue-500/5",
  Mitigating: "text-purple-500 border-purple-500/30 bg-purple-500/5",
  Escalated: "text-amber-500 border-amber-500/30 bg-amber-500/10",
  Resolved: "text-green-500 border-green-500/30 bg-green-500/10",
  Validated: "text-green-500 border-green-500/30 bg-green-500/10",
  Invalidated: "text-red-500 border-red-500/30 bg-red-500/5",
  "In Progress": "text-amber-500 border-amber-500/30 bg-amber-500/10",
  Closed: "text-gray-500 border-gray-300 bg-gray-100",
  Approved: "text-green-500 border-green-500/30 bg-green-500/10",
  "Pending Approval": "text-orange-500 border-orange-500/30 bg-orange-500/5",
  "At Risk": "text-red-500 border-red-500/30 bg-red-500/5",
  Confirmed: "text-blue-500 border-blue-500/30 bg-blue-500/5",
  Met: "text-green-500 border-green-500/30 bg-green-500/10",
  Unvalidated: "text-blue-500 border-blue-500/30 bg-blue-500/5",
  "Converted to Risk": "text-red-500 border-red-500/30 bg-red-500/5",
  Identified: "text-blue-500 border-blue-500/30 bg-blue-500/5",
  Proposed: "text-blue-500 border-blue-500/30 bg-blue-500/5",
  Deferred: "text-gray-500 border-gray-300 bg-gray-100",
  Superseded: "text-gray-500 border-gray-300 bg-gray-100",
  Delayed: "text-red-500 border-red-500/30 bg-red-500/5",
};

const SCORE_STYLES: Record<string, string> = {
  critical: "bg-red-500/15 text-red-600 border border-red-500/25",
  high: "bg-orange-500/15 text-orange-600 border border-orange-500/25",
  medium: "bg-amber-500/15 text-amber-600 border border-amber-500/25",
  low: "bg-green-500/15 text-green-600 border border-green-500/25",
};

function getScoreLevel(score: number): string {
  if (score >= 15) return "critical";
  if (score >= 10) return "high";
  if (score >= 5) return "medium";
  return "low";
}

const AVATAR_COLORS = ["#3b5bdb", "#047857", "#7c3aed", "#c2410c", "#0369a1", "#b91c1c", "#0d9488", "#7c2d12"];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(d?: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function nowStr(): string {
  const d = new Date();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const WORKSTREAMS = ["O2C", "P2P", "R2R", "H2R", "Technical", "PMO", "Cross-stream"];

export default function RaiddLogTool({ logType, projectId }: RaiddLogToolProps) {
  const config = LOG_CONFIG[logType];
  const { toast } = useToast();

  const [activeView, setActiveView] = useState<"table" | "cards">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [statFilter, setStatFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [escalatedOnly, setEscalatedOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [drawerItem, setDrawerItem] = useState<RaiddItem | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEscDialog, setShowEscDialog] = useState(false);
  const [escTargetId, setEscTargetId] = useState<number | null>(null);
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);
  const [showColsMenu, setShowColsMenu] = useState(false);
  const [colVisibility, setColVisibility] = useState<Record<string, boolean>>(() => {
    const vis: Record<string, boolean> = {};
    config.columns.forEach(c => { vis[c.key] = c.visible; });
    return vis;
  });

  const [newItem, setNewItem] = useState({ title: "", category: "", priority: "Medium", workstream: "" });
  const [escForm, setEscForm] = useState({ level: "PMO", to: "", reason: "", deadline: "" });
  const [noteText, setNoteText] = useState("");

  const colsMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading } = useQuery<RaiddItem[]>({
    queryKey: ["/api/pm/projects", projectId, "raidd", config.typeValue],
    queryFn: () => fetch(`/api/pm/projects/${projectId}/raidd?type=${config.typeValue}`).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/pm/raidd", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "raidd", config.typeValue] });
      setShowAddDialog(false);
      setNewItem({ title: "", category: "", priority: "Medium", workstream: "" });
      toast({ title: "Item created" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: any }) => apiRequest("PUT", `/api/pm/raidd/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "raidd", config.typeValue] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/pm/raidd/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "raidd", config.typeValue] });
    },
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colsMenuRef.current && !colsMenuRef.current.contains(e.target as Node)) setShowColsMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredItems = items.filter((item) => {
    if (!showArchived && item.archived) return false;
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase()) && !item.code?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (ownerFilter !== "all" && item.ownerName !== ownerFilter) return false;
    if (escalatedOnly && !item.escalated) return false;

    if (statFilter !== "all") {
      if (statFilter === "escalated" && !item.escalated) return false;
      if (statFilter === "critical_high" && item.priority !== "Critical" && item.priority !== "High") return false;
      if (statFilter === "mitigating" && item.status !== "Mitigating") return false;
      if (statFilter === "resolved" && item.status !== "Resolved") return false;
      if (statFilter === "unvalidated" && item.status !== "Unvalidated") return false;
      if (statFilter === "validated" && item.status !== "Validated") return false;
      if (statFilter === "invalidated" && item.status !== "Invalidated") return false;
      if (statFilter === "blocker" && item.issueType !== "Blocker") return false;
      if (statFilter === "inprogress" && item.status !== "In Progress") return false;
      if (statFilter === "atrisk" && item.status !== "At Risk") return false;
      if (statFilter === "confirmed" && item.status !== "Confirmed") return false;
      if (statFilter === "met" && item.status !== "Met") return false;
      if (statFilter === "approved" && item.status !== "Approved") return false;
      if (statFilter === "pending" && item.status !== "Pending Approval") return false;
      if (statFilter === "deferred" && item.status !== "Deferred") return false;
    }
    return true;
  });

  const uniqueOwners = [...new Set(items.filter(i => i.ownerName).map(i => i.ownerName!))];

  const tablePagination = useTablePagination(filteredItems, {
    resetKey: `${activeView}|${searchQuery}|${priorityFilter}|${categoryFilter}|${ownerFilter}|${statFilter}|${showArchived}|${escalatedOnly}`,
  });

  const saveField = useCallback((item: RaiddItem, field: string, value: any) => {
    const activity = item.activityLog || [];
    activity.unshift({ dot: "", text: `${field} updated`, time: nowStr(), type: "system" });
    updateMutation.mutate({ id: item.id, updates: { [field]: value, activityLog: activity, updatedAt: new Date().toISOString() } });
    if (drawerItem?.id === item.id) {
      setDrawerItem({ ...drawerItem, [field]: value, activityLog: activity });
    }
  }, [updateMutation, drawerItem]);

  const handleAddItem = () => {
    if (!newItem.title.trim()) return;
    const nextCode = `${config.codePrefix}-${String(items.length + 1).padStart(3, "0")}`;
    createMutation.mutate({
      tenantId: 1,
      projectId,
      type: config.typeValue,
      code: nextCode,
      title: newItem.title,
      category: newItem.category || config.categories[0],
      priority: newItem.priority,
      workstream: newItem.workstream,
      status: config.statusOptions[0],
      ownerName: "Current User",
      createdBy: "Current User",
      activityLog: [{ dot: "", text: `${nextCode} created`, time: nowStr(), type: "system" }],
    });
  };

  const handleEscalate = () => {
    if (!escTargetId) return;
    const item = items.find(i => i.id === escTargetId);
    if (!item) return;
    const activity = item.activityLog || [];
    activity.unshift({ dot: "amber", text: `Escalated to ${escForm.level} (${escForm.to || "unassigned"})`, time: nowStr(), type: "system" });
    updateMutation.mutate({
      id: escTargetId,
      updates: {
        escalated: true,
        escalationLevel: escForm.level,
        escalationTo: escForm.to,
        escalationReason: escForm.reason,
        escalationDays: 0,
        status: "Escalated",
        activityLog: activity,
      },
    });
    setShowEscDialog(false);
    setEscForm({ level: "PMO", to: "", reason: "", deadline: "" });
    if (drawerItem?.id === escTargetId) {
      setDrawerItem({ ...drawerItem, escalated: true, escalationLevel: escForm.level, escalationTo: escForm.to, escalationReason: escForm.reason, escalationDays: 0, status: "Escalated", activityLog: activity });
    }
  };

  const handleDeEscalate = (item: RaiddItem) => {
    const activity = item.activityLog || [];
    activity.unshift({ dot: "green", text: "De-escalated", time: nowStr(), type: "system" });
    updateMutation.mutate({
      id: item.id,
      updates: { escalated: false, escalationLevel: null, escalationDays: null, status: "Open", activityLog: activity },
    });
    if (drawerItem?.id === item.id) {
      setDrawerItem({ ...drawerItem, escalated: false, escalationLevel: null, escalationDays: null, status: "Open", activityLog: activity });
    }
  };

  const handleCloseItem = (item: RaiddItem) => {
    const activity = item.activityLog || [];
    activity.unshift({ dot: "green", text: "Item closed", time: nowStr(), type: "system" });
    updateMutation.mutate({ id: item.id, updates: { closed: true, status: "Closed", activityLog: activity } });
    if (drawerItem?.id === item.id) setDrawerItem({ ...drawerItem, closed: true, status: "Closed", activityLog: activity });
  };

  const handleArchive = (id: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const activity = item.activityLog || [];
    activity.unshift({ dot: "", text: "Archived", time: nowStr(), type: "system" });
    updateMutation.mutate({ id, updates: { archived: true, activityLog: activity } });
    if (drawerItem?.id === id) { setDrawerItem(null); }
    setArchiveTargetId(null);
  };

  const handleRestore = (item: RaiddItem) => {
    const activity = item.activityLog || [];
    activity.unshift({ dot: "green", text: "Restored from archive", time: nowStr(), type: "system" });
    updateMutation.mutate({ id: item.id, updates: { archived: false, activityLog: activity } });
    if (drawerItem?.id === item.id) setDrawerItem({ ...drawerItem, archived: false, activityLog: activity });
  };

  const handleAddNote = (item: RaiddItem) => {
    if (!noteText.trim()) return;
    const activity = item.activityLog || [];
    activity.unshift({ dot: "", text: `Note: ${noteText.trim()}`, time: nowStr(), type: "user" });
    updateMutation.mutate({ id: item.id, updates: { activityLog: activity } });
    setDrawerItem({ ...item, activityLog: activity });
    setNoteText("");
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const shareItems = (shareItems: RaiddItem[]) => {
    let text = `JIGANTO - ${config.title.toUpperCase()}\n`;
    text += `Exported: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}\n`;
    text += `${"─".repeat(60)}\n\n`;
    shareItems.forEach((row, i) => {
      text += `${i + 1}. ${row.code || row.id} - ${row.title}\n`;
      text += `   Status: ${row.status}  |  Priority: ${row.priority || "-"}  |  Owner: ${row.ownerName || "-"}\n`;
      text += `   Workstream: ${row.workstream || "-"}  |  Category: ${row.category || "-"}\n`;
      if (row.escalated) text += `   ESCALATED to ${row.escalationLevel} - ${row.escalationDays || 0} days\n`;
      if (row.mitigation) text += `   Mitigation: ${row.mitigation}\n`;
      if (row.resolution) text += `   Resolution: ${row.resolution}\n`;
      if (row.rationale) text += `   Rationale: ${row.rationale}\n`;
      text += "\n";
    });
    text += `${"─".repeat(60)}\n`;
    text += `${shareItems.length} item${shareItems.length > 1 ? "s" : ""} shared from Jiganto ${config.title}\n`;
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${shareItems.length} item${shareItems.length > 1 ? "s" : ""} copied to clipboard` });
    }).catch(() => {
      toast({ title: "Could not copy to clipboard", variant: "destructive" });
    });
  };

  const bulkClose = () => {
    selectedIds.forEach(id => {
      const item = items.find(i => i.id === id);
      if (item && !item.closed) handleCloseItem(item);
    });
    clearSelection();
  };

  const bulkArchive = () => {
    selectedIds.forEach(id => handleArchive(id));
    clearSelection();
  };

  const handleExport = () => {
    const headers = ["Code", "Title", "Status", "Priority", "Category", "Owner", "Workstream", "Escalated", "Description"];
    const csvRows = [headers.join(",")];
    items.filter(i => !i.archived).forEach(item => {
      csvRows.push([
        item.code || "", `"${(item.title || "").replace(/"/g, '""')}"`, item.status || "", item.priority || "",
        item.category || "", item.ownerName || "", item.workstream || "", item.escalated ? "Yes" : "No",
        `"${(item.description || "").replace(/"/g, '""')}"`,
      ].join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.typeValue}-log-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [importing, setImporting] = useState(false);

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { result.push(current.trim()); current = ""; }
        else { current += ch; }
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        let text = ev.target?.result as string;
        if (!text || !text.trim()) {
          toast({ title: "File is empty", variant: "destructive" });
          setImporting(false);
          return;
        }
        text = text.replace(/^\uFEFF/, "");
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
          toast({ title: "No data rows found in CSV", variant: "destructive" });
          setImporting(false);
          return;
        }
        const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
        const col = (name: string) => headers.indexOf(name);
        const titleIdx = col("title");
        const decisionIdx = col("decision statement");
        const assumptionIdx = col("assumption");
        const deliverableIdx = col("deliverable");
        const nameIdx = titleIdx >= 0 ? titleIdx : (decisionIdx >= 0 ? decisionIdx : (assumptionIdx >= 0 ? assumptionIdx : deliverableIdx));

        if (nameIdx < 0) {
          toast({ title: "CSV must have a Title, Decision Statement, Assumption, or Deliverable column", variant: "destructive" });
          setImporting(false);
          return;
        }

        const statusIdx = col("status");
        const priorityIdx = col("priority");
        const impactIdx = col("impact");
        const categoryIdx = col("category");
        const ownerIdx = col("owner");
        const madeByIdx = col("made by");
        const workstreamIdx = col("workstream");
        const escalatedIdx = col("escalated");
        const descriptionIdx = col("description");
        const codeIdx = col("code") >= 0 ? col("code") : col("id");

        const ownerColumn = ownerIdx >= 0 ? ownerIdx : madeByIdx;
        const priColumn = priorityIdx >= 0 ? priorityIdx : impactIdx;

        const rows: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = parseCsvLine(lines[i]);
          const title = nameIdx >= 0 ? vals[nameIdx] : "";
          if (!title?.trim()) continue;

          const nextCode = `${config.codePrefix}-${String(items.length + rows.length + 1).padStart(3, "0")}`;
          const escalatedVal = escalatedIdx >= 0 ? vals[escalatedIdx]?.toLowerCase() : "";
          const isEscalated = escalatedVal === "yes" || escalatedVal === "true";

          rows.push({
            tenantId: 1,
            projectId,
            type: config.typeValue,
            code: codeIdx >= 0 && vals[codeIdx] ? vals[codeIdx] : nextCode,
            title: title.trim(),
            status: statusIdx >= 0 && vals[statusIdx] ? vals[statusIdx] : config.statusOptions[0],
            priority: priColumn >= 0 && vals[priColumn] ? vals[priColumn] : "Medium",
            category: categoryIdx >= 0 && vals[categoryIdx] ? vals[categoryIdx] : "",
            ownerName: ownerColumn >= 0 && vals[ownerColumn] ? vals[ownerColumn] : "",
            workstream: workstreamIdx >= 0 && vals[workstreamIdx] ? vals[workstreamIdx] : "",
            description: descriptionIdx >= 0 && vals[descriptionIdx] ? vals[descriptionIdx] : "",
            escalated: isEscalated,
            createdBy: "Current User",
            activityLog: [{ dot: "", text: "Imported from CSV", time: nowStr(), type: "system" }],
          });
        }

        if (rows.length === 0) {
          toast({ title: "No valid rows found in CSV", variant: "destructive" });
          setImporting(false);
          return;
        }

        let successCount = 0;
        let failCount = 0;
        for (const row of rows) {
          try {
            const res = await fetch("/api/pm/raidd", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(row),
              credentials: "include",
            });
            if (res.ok) { successCount++; }
            else { failCount++; console.error("Import row failed:", await res.text()); }
          } catch (err) {
            failCount++;
            console.error("Import row error:", err);
          }
        }

        queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "raidd", config.typeValue] });

        if (failCount === 0) {
          toast({ title: `${successCount} items imported successfully` });
        } else {
          toast({ title: `${successCount} imported, ${failCount} failed`, variant: "destructive" });
        }
      } catch (err) {
        console.error("Import error:", err);
        toast({ title: "Import failed — check file format", variant: "destructive" });
      }
      setImporting(false);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  const clearFilters = () => {
    setSearchQuery("");
    setPriorityFilter("all");
    setCategoryFilter("all");
    setOwnerFilter("all");
    setStatFilter("all");
    setEscalatedOnly(false);
    setShowArchived(false);
  };

  const visibleCols = config.columns.filter(c => colVisibility[c.key]);

  const renderPriBadge = (pri: string | null) => {
    if (!pri) return <span className="text-muted-foreground">-</span>;
    return <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${PRI_STYLES[pri] || ""}`}><span className="w-[5px] h-[5px] rounded-full bg-current" />{pri}</span>;
  };

  const renderStatusBadge = (status: string | null) => {
    if (!status) return <span className="text-muted-foreground">-</span>;
    return <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${STATUS_STYLES[status] || "text-gray-500 border-gray-300 bg-gray-100"}`}>{status}</span>;
  };

  const renderOwner = (name: string | null) => {
    if (!name) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[8.5px] font-bold text-white shrink-0" style={{ background: getAvatarColor(name) }}>{getInitials(name)}</div>
        <span className="text-[12px]">{name}</span>
      </div>
    );
  };

  const renderCell = (col: ColumnDef, item: RaiddItem) => {
    const dash = <span className="text-muted-foreground">-</span>;
    switch (col.key) {
      case "code": return <span className="text-[11px] font-semibold font-mono text-indigo-600 bg-indigo-500/10 px-1.5 py-0.5 rounded" data-testid={`text-code-${item.id}`}>{item.code || item.id}</span>;
      case "title": return <span className={`font-medium text-foreground ${item.closed ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>;
      case "category": return item.category || dash;
      case "score":
        if (item.score == null) return dash;
        return <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] font-bold font-mono ${SCORE_STYLES[getScoreLevel(item.score)]}`}>{item.score}</span>;
      case "priority": return renderPriBadge(item.priority);
      case "status": return renderStatusBadge(item.status);
      case "owner": return renderOwner(item.ownerName);
      case "escalation":
        return item.escalated
          ? <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-600"><Flag className="w-2.5 h-2.5" />{item.escalationLevel}</span>
          : dash;
      case "days":
        if (!item.escalationDays && item.escalationDays !== 0) return dash;
        const daysCls = (item.escalationDays || 0) >= 10 ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600";
        return <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded font-mono ${daysCls}`}>{item.escalationDays}d</span>;
      case "issueType": return item.issueType || dash;
      case "timelineImpact":
        if (!item.timelineImpact) return dash;
        const tlCls = item.timelineImpact === "Critical Path" ? "text-red-500" : item.timelineImpact === "None" ? "text-green-500" : "text-orange-500";
        return <span className={tlCls}>{item.timelineImpact}</span>;
      case "resolution": return item.resolution || dash;
      case "basis": return item.basis || dash;
      case "dueDate": return item.dueDate ? formatDate(item.dueDate) : dash;
      case "dependentOn": return item.dependentOn || dash;
      case "requiredByDate": return item.requiredByDate ? formatDate(item.requiredByDate) : dash;
      case "providerConfirmed":
        if (item.providerConfirmed == null) return dash;
        return item.providerConfirmed ? <span className="text-green-500">Yes</span> : <span className="text-red-500">No</span>;
      case "decisionBody": return item.decisionBody || dash;
      case "decisionDate": return item.decisionDate || dash;
      case "rationale": return item.rationale ? <span className="truncate max-w-[200px] block">{item.rationale}</span> : dash;
      default: return dash;
    }
  };

  const renderDrawerFields = (item: RaiddItem) => {
    const sel = (label: string, field: string, options: string[], value: string | null) => (
      <div className="flex flex-col gap-1" key={field}>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
        <select className="w-full px-2 py-1.5 border rounded-md text-[12.5px] bg-background" value={value || ""} onChange={(e) => saveField(item, field, e.target.value)} data-testid={`select-${field}-${item.id}`}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
    const txt = (label: string, field: string, value: string | null) => (
      <div className="flex flex-col gap-1" key={field}>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
        <input className="w-full px-2 py-1.5 border rounded-md text-[12.5px] bg-background" value={value || ""} onChange={(e) => saveField(item, field, e.target.value)} data-testid={`input-${field}-${item.id}`} />
      </div>
    );
    const area = (label: string, field: string, value: string | null) => (
      <div className="flex flex-col gap-1 col-span-2" key={field}>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
        <textarea className="w-full px-2 py-1.5 border rounded-md text-[12.5px] bg-background min-h-[64px] resize-y" value={value || ""} onChange={(e) => saveField(item, field, e.target.value)} data-testid={`textarea-${field}-${item.id}`} />
      </div>
    );

    const common = [
      sel("Priority", "priority", config.priorityOptions, item.priority),
      sel("Status", "status", config.statusOptions, item.status),
      sel("Category", "category", config.categories, item.category),
      txt("Owner", "ownerName", item.ownerName),
      sel("Workstream", "workstream", WORKSTREAMS, item.workstream),
    ];

    if (logType === "risk") return [...common, txt("Risk Score (1-25)", "score", item.score?.toString() || null), area("Mitigation Action", "mitigation", item.mitigation), area("Contingency Plan", "contingency", item.contingency)];
    if (logType === "assumptions") return [...common, area("Basis for Assumption", "basis", item.basis), txt("Validation Method", "validationMethod", item.validationMethod), txt("Validation Due Date", "dueDate", item.dueDate)];
    if (logType === "issues") return [...common, sel("Issue Type", "issueType", ["Blocker", "Impediment", "Escalation", "Change Request", "Information Gap"], item.issueType), sel("Timeline Impact", "timelineImpact", ["None", "Minor Delay", "Moderate Delay", "Major Delay", "Critical Path"], item.timelineImpact), area("Resolution Plan", "resolution", item.resolution)];
    if (logType === "dependencies") return [...common, sel("Dependency Type", "issueType", ["Internal", "External", "Incoming", "Outgoing"], item.issueType), txt("Dependent On", "dependentOn", item.dependentOn), txt("Required By Date", "requiredByDate", item.requiredByDate), sel("Provider Confirmed", "providerConfirmed", ["false", "true"], item.providerConfirmed?.toString() || "false")];
    if (logType === "decisions") return [...common, sel("Decision Body", "decisionBody", ["Project Board", "Steering Committee", "PMO", "Workstream Lead", "Technical Authority"], item.decisionBody), txt("Decision Date", "decisionDate", item.decisionDate), area("Rationale", "rationale", item.rationale)];
    return common;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid={`raidd-log-${logType}`}>
      {/* Log Header */}
      <div className="bg-background border-b px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: config.iconBg }}>
            <config.Icon className="h-4 w-4" style={{ color: config.iconColor }} />
          </div>
          <span className="text-sm font-bold text-foreground">{config.title}</span>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative" ref={colsMenuRef}>
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setShowColsMenu(!showColsMenu)} data-testid="button-columns">
              Columns <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
            {showColsMenu && (
              <div className="absolute right-0 top-full mt-1 bg-background border rounded-lg shadow-lg z-50 min-w-[200px] py-1.5">
                {config.columns.filter(c => !c.locked).map(c => (
                  <div key={c.key} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] cursor-pointer hover:bg-muted" onClick={() => setColVisibility(prev => ({ ...prev, [c.key]: !prev[c.key] }))} data-testid={`col-toggle-${c.key}`}>
                    <div className={`w-3.5 h-3.5 border-[1.5px] rounded-sm flex items-center justify-center shrink-0 ${colVisibility[c.key] ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"}`}>
                      {colVisibility[c.key] && <span className="text-[9px]">✓</span>}
                    </div>
                    {c.label || c.key}
                  </div>
                ))}
              </div>
            )}
          </div>
          <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => fileInputRef.current?.click()} disabled={importing} data-testid="button-import">
            {importing ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Importing...</> : <><Upload className="h-3 w-3 mr-1" /> Import</>}
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExport} data-testid="button-export">
            <Download className="h-3 w-3 mr-1" /> Export
          </Button>
          <Button size="sm" className="text-xs h-8" onClick={() => setShowAddDialog(true)} data-testid="button-add-item">
            <Plus className="h-3 w-3 mr-1" /> {config.addLabel}
          </Button>
        </div>
      </div>

      {/* Selection Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-slate-800 text-white px-5 py-2.5 shrink-0" data-testid="selection-toolbar">
          <span className="text-[13px] font-semibold mr-1">{selectedIds.size} item{selectedIds.size > 1 ? "s" : ""} selected</span>
          <div className="w-px h-5 bg-white/20" />
          <button className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium border border-white/20 hover:bg-white/10" onClick={() => shareItems(items.filter(i => selectedIds.has(i.id)))} data-testid="button-share-selected">
            <Share2 className="w-3 h-3" /> Share Selected
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium border border-amber-500/50 text-amber-200 hover:bg-amber-500/15" onClick={bulkClose} data-testid="button-bulk-close">
            <CheckCircle2 className="w-3 h-3" /> Close Items
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium border border-red-500/50 text-red-300 hover:bg-red-500/15" onClick={bulkArchive} data-testid="button-bulk-archive">
            <Archive className="w-3 h-3" /> Archive
          </button>
          <button className="ml-auto opacity-60 hover:opacity-100 text-lg" onClick={clearSelection} data-testid="button-clear-selection">&times;</button>
        </div>
      )}

      {/* Filter Row */}
      <div className="bg-background border-b px-5 py-2 flex gap-2 items-center flex-wrap shrink-0">
        <div className="flex items-center gap-1.5 bg-muted border rounded-md px-2.5 py-1 w-[220px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input type="text" placeholder={`Search ${config.title.toLowerCase()}...`} className="bg-transparent border-none outline-none text-[12px] w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} data-testid="input-search" />
        </div>
        <select className="text-[11.5px] border rounded-md px-2.5 py-1.5 bg-background text-muted-foreground cursor-pointer" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} data-testid="select-priority-filter">
          <option value="all">All Priorities</option>
          {config.priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="text-[11.5px] border rounded-md px-2.5 py-1.5 bg-background text-muted-foreground cursor-pointer" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} data-testid="select-category-filter">
          <option value="all">All Categories</option>
          {config.categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="text-[11.5px] border rounded-md px-2.5 py-1.5 bg-background text-muted-foreground cursor-pointer" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} data-testid="select-owner-filter">
          <option value="all">All Owners</option>
          {uniqueOwners.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <button className={`text-[11.5px] border rounded-md px-2.5 py-1.5 font-semibold cursor-pointer ${escalatedOnly ? "bg-amber-500 text-white border-amber-500" : "bg-amber-500/10 border-amber-500/30 text-amber-600"}`} onClick={() => setEscalatedOnly(!escalatedOnly)} data-testid="button-escalated-filter">
          <Flag className="w-3 h-3 inline mr-1" /> Escalated
        </button>
        <button className={`text-[11.5px] border rounded-md px-2.5 py-1.5 cursor-pointer ${showArchived ? "bg-primary/10 border-primary text-primary" : "bg-background border-muted-foreground/30 text-muted-foreground"}`} onClick={() => setShowArchived(!showArchived)} data-testid="button-show-archived">
          Show Archived
        </button>
        <div className="ml-auto flex gap-1.5">
          <button className={`text-[11.5px] border rounded-md px-2.5 py-1.5 cursor-pointer ${activeView === "table" ? "bg-primary/10 border-primary text-primary" : "bg-background border-muted-foreground/30 text-muted-foreground"}`} onClick={() => setActiveView("table")} data-testid="button-table-view">Table</button>
          <button className={`text-[11.5px] border rounded-md px-2.5 py-1.5 cursor-pointer ${activeView === "cards" ? "bg-primary/10 border-primary text-primary" : "bg-background border-muted-foreground/30 text-muted-foreground"}`} onClick={() => setActiveView("cards")} data-testid="button-cards-view">Cards</button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 bg-muted/30">
        {/* Stats Strip */}
        <div className="flex gap-2.5 mb-3.5 flex-wrap">
          {config.statCards.map(s => {
            const count = s.countFn(items);
            const isOn = statFilter === s.filter;
            return (
              <div key={s.filter} className={`bg-background border rounded-lg px-4 py-3 flex-1 min-w-[90px] cursor-pointer transition-all hover:border-primary ${isOn ? "border-primary shadow-[0_0_0_2px] shadow-primary/20 bg-primary/5" : ""} ${s.esc ? "border-amber-500/30 bg-amber-500/10" : ""}`} onClick={() => setStatFilter(statFilter === s.filter ? "all" : s.filter)} data-testid={`stat-card-${s.filter}`}>
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{s.label}</div>
                <div className={`text-[22px] font-bold leading-none ${s.cls}`}>{count}</div>
                <div className="text-[10.5px] text-muted-foreground mt-0.5">{s.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Escalation Alert */}
        {items.some(i => i.escalated && !i.archived) && (
          <div className="flex items-center gap-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-500/30 rounded-lg px-3.5 py-2.5 mb-3.5 text-[12px]">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span><b className="text-amber-600">{items.filter(i => i.escalated && !i.archived).length} item{items.filter(i => i.escalated && !i.archived).length > 1 ? "s" : ""} escalated.</b> Review escalated items for timely response.</span>
          </div>
        )}

        {/* Table View */}
        {activeView === "table" && (
          <div className="bg-background border rounded-lg overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    {visibleCols.map(c => (
                      <th key={c.key} className={`text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap ${c.key === "cb" ? "w-9 px-2" : ""}`}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={visibleCols.length} className="text-center text-muted-foreground py-12">
                        <p className="text-[13px]">No items match your filters. <span className="text-primary cursor-pointer" onClick={clearFilters}>Clear filters</span></p>
                      </td>
                    </tr>
                  ) : (
                    tablePagination.paginatedItems.map(item => (
                      <tr key={item.id} className={`border-b last:border-b-0 cursor-pointer transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-500/5 ${item.escalated ? "bg-amber-50 dark:bg-amber-500/5 border-l-[3px] border-l-amber-500" : ""} ${selectedIds.has(item.id) ? "bg-primary/5" : ""} ${item.archived ? "opacity-50" : ""}`} data-testid={`row-raidd-${item.id}`}>
                        {visibleCols.map(c => {
                          if (c.key === "cb") {
                            return (
                              <td key="cb" className="px-2 py-2.5 w-9" onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" className="w-[15px] h-[15px] rounded-sm accent-primary cursor-pointer" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} data-testid={`checkbox-${item.id}`} />
                              </td>
                            );
                          }
                          if (c.key === "actions") {
                            return (
                              <td key="actions" className="px-2 py-2.5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                                <button className="text-[11px] text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded" onClick={() => setDrawerItem(item)} title="Open" data-testid={`button-edit-${item.id}`}>
                                  <Search className="w-3 h-3" />
                                </button>
                                {item.archived ? (
                                  <button className="text-[11px] text-green-500 px-1.5 py-0.5 rounded" onClick={() => handleRestore(item)} title="Restore" data-testid={`button-restore-${item.id}`}>
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <button className="text-[11px] text-muted-foreground hover:text-red-500 px-1.5 py-0.5 rounded" onClick={() => setArchiveTargetId(item.id)} title="Archive" data-testid={`button-archive-${item.id}`}>
                                    <Archive className="w-3 h-3" />
                                  </button>
                                )}
                              </td>
                            );
                          }
                          return (
                            <td key={c.key} className={`px-3 py-2.5 text-[12.5px] ${c.key === "title" ? "font-medium text-foreground" : "text-muted-foreground"}`} onClick={() => setDrawerItem(item)}>
                              {renderCell(c, item)}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5 border-t bg-muted/30 text-[11.5px] text-muted-foreground">
              <span>Showing {filteredItems.length} of {items.filter(i => !i.archived).length} items</span>
            </div>
            <TablePagination
              page={tablePagination.page}
              totalPages={tablePagination.totalPages}
              total={tablePagination.total}
              startIndex={tablePagination.startIndex}
              endIndex={tablePagination.endIndex}
              pageSize={tablePagination.pageSize}
              onPageChange={tablePagination.setPage}
              onPageSizeChange={tablePagination.setPageSize}
            />
          </div>
        )}

        {/* Card View */}
        {activeView === "cards" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {filteredItems.length === 0 ? (
              <div className="col-span-full text-center text-muted-foreground py-12">
                <p className="text-[13px]">No items match your filters. <span className="text-primary cursor-pointer" onClick={clearFilters}>Clear filters</span></p>
              </div>
            ) : (
              tablePagination.paginatedItems.map(item => (
                <div key={item.id} className={`bg-background border rounded-lg p-3.5 cursor-pointer transition-all hover:border-primary hover:shadow-sm ${item.escalated ? "border-l-[3px] border-l-amber-500 bg-amber-50 dark:bg-amber-500/5" : ""} ${selectedIds.has(item.id) ? "border-primary shadow-[0_0_0_2px] shadow-primary/20" : ""}`} onClick={() => setDrawerItem(item)} data-testid={`card-raidd-${item.id}`}>
                  <div className="flex items-center justify-between mb-2.5 gap-2">
                    <span className="text-[11px] font-semibold font-mono text-indigo-600 bg-indigo-500/10 px-1.5 py-0.5 rounded">{item.code || item.id}</span>
                    <input type="checkbox" className="w-[15px] h-[15px] accent-primary cursor-pointer" checked={selectedIds.has(item.id)} onChange={(e) => { e.stopPropagation(); toggleSelect(item.id); }} data-testid={`card-checkbox-${item.id}`} />
                  </div>
                  <div className="text-[13px] font-semibold text-foreground leading-snug mb-2">{item.title}</div>
                  <div className="flex gap-1.5 flex-wrap items-center">
                    {renderPriBadge(item.priority)}
                    {renderStatusBadge(item.status)}
                    {item.escalated && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-600"><Flag className="w-2 h-2" />{item.escalationLevel}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-[11.5px] text-muted-foreground">
                    {renderOwner(item.ownerName)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {activeView === "cards" && filteredItems.length > 0 && (
          <div className="bg-background border rounded-lg">
            <TablePagination
              page={tablePagination.page}
              totalPages={tablePagination.totalPages}
              total={tablePagination.total}
              startIndex={tablePagination.startIndex}
              endIndex={tablePagination.endIndex}
              pageSize={tablePagination.pageSize}
              onPageChange={tablePagination.setPage}
              onPageSizeChange={tablePagination.setPageSize}
            />
          </div>
        )}

        {/* Heat Map (Risk only) */}
        {config.showHeatmap && items.length > 0 && (
          <div className="bg-background border rounded-lg p-5 mb-4">
            <div className="text-[13px] font-bold text-foreground mb-3.5">Risk Score Heat Map - 5x5</div>
            <div className="flex gap-7 items-start flex-wrap">
              <div>
                <div className="grid gap-0.5" style={{ gridTemplateColumns: "22px repeat(5, 44px)", gridTemplateRows: "repeat(5, 36px) 22px" }}>
                  <div className="row-span-5 flex items-center justify-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>Probability</div>
                  {[5, 4, 3, 2, 1].map(p => (
                    [1, 2, 3, 4, 5].map(imp => {
                      const score = p * imp;
                      const count = items.filter(i => !i.archived && i.score === score).length;
                      const bg = score >= 15 ? "bg-red-400 text-white" : score >= 10 ? "bg-orange-400 text-white" : score >= 5 ? "bg-amber-200 text-amber-800" : "bg-green-100 text-green-700";
                      return (
                        <div key={`${p}-${imp}`} className={`rounded flex items-center justify-center text-[11px] font-semibold cursor-pointer hover:opacity-80 transition-opacity ${bg}`} onClick={() => setStatFilter(`score_${score}`)} data-testid={`heatmap-cell-${p}-${imp}`}>
                          {count > 0 ? <span className="bg-white/80 text-gray-800 rounded-full w-[18px] h-[18px] flex items-center justify-center text-[9px] font-bold">{count}</span> : score}
                        </div>
                      );
                    })
                  ))}
                  {["VL", "L", "M", "H", "VH"].map(l => (
                    <div key={l} className="flex items-center justify-center text-[9.5px] font-semibold text-muted-foreground">{l}</div>
                  ))}
                </div>
                <div className="flex gap-3.5 mt-2.5 flex-wrap">
                  {[{ label: "Low 1-4", bg: "bg-green-100" }, { label: "Med 5-9", bg: "bg-amber-200" }, { label: "High 10-14", bg: "bg-orange-400" }, { label: "Critical 15-25", bg: "bg-red-400" }].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><div className={`w-2.5 h-2.5 rounded-sm ${l.bg}`} />{l.label}</div>
                  ))}
                </div>
              </div>
              <div className="text-[12px] text-muted-foreground flex-1 min-w-[160px] mt-1 leading-relaxed">
                <p className="text-foreground/70 font-medium mb-1">Click cells to filter risks by score.</p>
                {items.some(i => i.escalated && !i.archived) && (
                  <p className="text-amber-600 font-medium mt-1.5">{items.filter(i => i.escalated && !i.archived).length} escalated risks</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {drawerItem && (
        <>
          <div className="fixed inset-0 bg-black/35 z-[100] backdrop-blur-[1px]" onClick={() => setDrawerItem(null)} data-testid="drawer-overlay" />
          <div className="fixed right-0 top-0 bottom-0 w-[540px] max-w-full bg-background border-l z-[101] overflow-y-auto flex flex-col animate-in slide-in-from-right duration-200" data-testid="detail-drawer">
            {/* Drawer Header */}
            <div className="px-5 pt-4 pb-3 border-b sticky top-0 bg-background z-[2]">
              <div className="flex items-start gap-2.5">
                <span className="text-[11px] font-semibold font-mono text-indigo-600 bg-indigo-500/10 px-1.5 py-0.5 rounded mt-1 shrink-0">{drawerItem.code || drawerItem.id}</span>
                <textarea className="flex-1 text-[15px] font-bold text-foreground leading-snug bg-transparent border border-transparent rounded-md px-1.5 py-0.5 resize-none min-h-[42px] hover:border-muted-foreground/20 focus:border-primary focus:bg-muted/30 outline-none" defaultValue={drawerItem.title} onBlur={(e) => { if (e.target.value !== drawerItem.title) saveField(drawerItem, "title", e.target.value); }} data-testid="drawer-title-edit" />
                <button className="w-7 h-7 rounded-md bg-muted border flex items-center justify-center cursor-pointer hover:bg-muted-foreground/10 shrink-0" onClick={() => setDrawerItem(null)} data-testid="button-close-drawer">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap items-center mt-2">
                {renderPriBadge(drawerItem.priority)}
                {renderStatusBadge(drawerItem.status)}
                {drawerItem.escalated && <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-600"><Flag className="w-2.5 h-2.5" />{drawerItem.escalationLevel}</span>}
                {drawerItem.archived && <span className="text-[11px] font-medium px-2 py-0.5 rounded border text-muted-foreground bg-muted">Archived</span>}
                {drawerItem.closed && <span className="text-[11px] font-medium px-2 py-0.5 rounded border text-muted-foreground bg-muted">Closed</span>}
              </div>
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {!drawerItem.closed && !drawerItem.archived && (
                  <button className="flex items-center gap-1 px-2.5 py-1 rounded text-[11.5px] font-medium border hover:bg-muted" onClick={() => handleCloseItem(drawerItem)} data-testid="button-drawer-close">
                    <CheckCircle2 className="w-3 h-3" /> Close
                  </button>
                )}
                {!drawerItem.archived ? (
                  <button className="flex items-center gap-1 px-2.5 py-1 rounded text-[11.5px] font-medium border border-red-500/30 text-red-500 hover:bg-red-50" onClick={() => setArchiveTargetId(drawerItem.id)} data-testid="button-drawer-archive">
                    <Archive className="w-3 h-3" /> Archive
                  </button>
                ) : (
                  <button className="flex items-center gap-1 px-2.5 py-1 rounded text-[11.5px] font-medium border hover:bg-muted" onClick={() => handleRestore(drawerItem)} data-testid="button-drawer-restore">
                    <RotateCcw className="w-3 h-3" /> Restore
                  </button>
                )}
                <button className="flex items-center gap-1 px-2.5 py-1 rounded text-[11.5px] font-medium border hover:bg-muted" onClick={() => shareItems([drawerItem])} data-testid="button-drawer-share">
                  <Share2 className="w-3 h-3" /> Share
                </button>
              </div>
            </div>

            {/* Escalation Section */}
            {drawerItem.escalated ? (
              <div className="mx-5 mt-3.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-500/30 rounded-lg p-3.5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5"><Flag className="w-3 h-3" /> Escalation Active</div>
                  <button className="text-[11.5px] text-muted-foreground hover:text-primary" onClick={() => handleDeEscalate(drawerItem)} data-testid="button-de-escalate">De-escalate</button>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div><div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Level</div><div className="text-[12.5px] bg-background border rounded-md px-2 py-1.5 italic text-muted-foreground">{drawerItem.escalationLevel}</div></div>
                  <div><div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Escalated To</div><div className="text-[12.5px] bg-background border rounded-md px-2 py-1.5 italic text-muted-foreground">{drawerItem.escalationTo || "-"}</div></div>
                  <div className="col-span-2"><div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Reason</div><textarea className="w-full px-2 py-1.5 border rounded-md text-[12.5px] bg-background min-h-[55px] resize-y" defaultValue={drawerItem.escalationReason || ""} onBlur={(e) => saveField(drawerItem, "escalationReason", e.target.value)} /></div>
                  <div><div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Days Escalated</div><div className="text-[12.5px] bg-background border rounded-md px-2 py-1.5 font-semibold text-amber-600">{drawerItem.escalationDays || 0} days</div></div>
                  <div className="col-span-2"><div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Response</div><textarea className="w-full px-2 py-1.5 border rounded-md text-[12.5px] bg-background min-h-[55px] resize-y" placeholder="Enter response..." defaultValue={drawerItem.escalationResponse || ""} onBlur={(e) => saveField(drawerItem, "escalationResponse", e.target.value)} /></div>
                </div>
              </div>
            ) : (
              <div className="mx-5 mt-3.5">
                <Button variant="outline" className="w-full justify-center text-amber-600 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20" onClick={() => { setEscTargetId(drawerItem.id); setShowEscDialog(true); }} data-testid="button-raise-escalation">
                  <Flag className="w-3 h-3 mr-1.5" /> Raise Escalation for {drawerItem.code || drawerItem.id}
                </Button>
              </div>
            )}

            {/* Detail Fields */}
            <div className="px-5 pb-6">
              <div className="mt-4.5">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2.5 mt-4">
                  {config.title.split(" ")[0]} Detail
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {renderDrawerFields(drawerItem)}
                </div>
              </div>

              {/* Linked Items */}
              <div className="mt-4.5">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2.5 mt-4">
                  Linked Items
                  <div className="flex-1 h-px bg-border" />
                </div>
                {drawerItem.linkedItems && drawerItem.linkedItems.length > 0 ? (
                  drawerItem.linkedItems.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-2 bg-muted border rounded-md text-[12px] text-muted-foreground cursor-pointer hover:border-primary mb-1.5">
                      <span className="text-[10px] font-semibold font-mono text-indigo-600 bg-indigo-500/10 px-1 py-0.5 rounded">{l.id}</span>
                      <span className="flex-1">{l.label}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[12px] text-muted-foreground">No linked items</div>
                )}
              </div>

              {/* Activity Log */}
              <div className="mt-4.5">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2.5 mt-4">
                  Activity Log
                  <div className="flex-1 h-px bg-border" />
                </div>
                {(drawerItem.activityLog || []).map((a, i) => (
                  <div key={i} className="flex gap-2.5 py-2 border-b last:border-b-0">
                    <div className={`w-[7px] h-[7px] rounded-full mt-1 shrink-0 ${a.dot === "amber" ? "bg-amber-500" : a.dot === "green" ? "bg-green-500" : a.dot === "red" ? "bg-red-500" : "bg-primary"}`} />
                    <div>
                      <div className="text-[12px] text-muted-foreground leading-snug">
                        {a.text}
                        <span className={`text-[9.5px] font-semibold uppercase px-1 py-0.5 rounded ml-1.5 ${a.type === "system" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>{a.type}</span>
                      </div>
                      <div className="text-[10.5px] text-muted-foreground mt-0.5">{a.time}</div>
                    </div>
                  </div>
                ))}
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <textarea className="w-full bg-muted border rounded-md px-2.5 py-2 text-[12px] outline-none resize-none min-h-[60px] focus:border-primary" placeholder="Add a note..." value={noteText} onChange={(e) => setNoteText(e.target.value)} data-testid="textarea-add-note" />
                  <button className="self-end px-3 py-1 bg-primary text-primary-foreground rounded text-[11.5px] font-medium hover:bg-primary/90" onClick={() => handleAddNote(drawerItem)} data-testid="button-add-note">+ Add Note</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add Item Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[460px]" data-testid="dialog-add-item">
          <DialogHeader>
            <DialogTitle>{config.addLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Title</label>
              <input className="w-full mt-1 px-2.5 py-2 border rounded-md text-[12.5px] bg-muted focus:border-primary outline-none" value={newItem.title} onChange={(e) => setNewItem({ ...newItem, title: e.target.value })} placeholder={`Enter ${config.title.toLowerCase()} title...`} data-testid="input-new-title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">Priority</label>
                <select className="w-full mt-1 px-2.5 py-2 border rounded-md text-[12.5px] bg-muted" value={newItem.priority} onChange={(e) => setNewItem({ ...newItem, priority: e.target.value })} data-testid="select-new-priority">
                  {config.priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">Category</label>
                <select className="w-full mt-1 px-2.5 py-2 border rounded-md text-[12.5px] bg-muted" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} data-testid="select-new-category">
                  <option value="">Select...</option>
                  {config.categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Workstream</label>
              <select className="w-full mt-1 px-2.5 py-2 border rounded-md text-[12.5px] bg-muted" value={newItem.workstream} onChange={(e) => setNewItem({ ...newItem, workstream: e.target.value })} data-testid="select-new-workstream">
                <option value="">Select...</option>
                {WORKSTREAMS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} data-testid="button-cancel-add">Cancel</Button>
            <Button onClick={handleAddItem} disabled={!newItem.title.trim() || createMutation.isPending} data-testid="button-confirm-add">
              {createMutation.isPending ? "Creating..." : config.addLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Escalation Dialog */}
      <Dialog open={showEscDialog} onOpenChange={setShowEscDialog}>
        <DialogContent className="sm:max-w-[460px]" data-testid="dialog-escalation">
          <DialogHeader>
            <DialogTitle>Raise Escalation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Escalation Level</label>
              <select className="w-full mt-1 px-2.5 py-2 border rounded-md text-[12.5px] bg-muted" value={escForm.level} onChange={(e) => setEscForm({ ...escForm, level: e.target.value })} data-testid="select-esc-level">
                <option value="PMO">PMO</option>
                <option value="Workstream Lead">Workstream Lead</option>
                <option value="Steering Committee">Steering Committee</option>
                <option value="Project Board">Project Board</option>
                <option value="Executive Sponsor">Executive Sponsor</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Escalated To</label>
              <input className="w-full mt-1 px-2.5 py-2 border rounded-md text-[12.5px] bg-muted" value={escForm.to} onChange={(e) => setEscForm({ ...escForm, to: e.target.value })} placeholder="Person or group..." data-testid="input-esc-to" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Reason</label>
              <textarea className="w-full mt-1 px-2.5 py-2 border rounded-md text-[12.5px] bg-muted min-h-[75px] resize-y" value={escForm.reason} onChange={(e) => setEscForm({ ...escForm, reason: e.target.value })} placeholder="Why is this being escalated..." data-testid="textarea-esc-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEscDialog(false)} data-testid="button-cancel-esc">Cancel</Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={handleEscalate} data-testid="button-confirm-esc">Escalate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <AlertDialog open={archiveTargetId !== null} onOpenChange={(open) => !open && setArchiveTargetId(null)}>
        <AlertDialogContent data-testid="dialog-archive-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this item?</AlertDialogTitle>
            <AlertDialogDescription>The item will be hidden from the main log but can be recovered using "Show Archived" in the filter bar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-archive">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveTargetId && handleArchive(archiveTargetId)} data-testid="button-confirm-archive">Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
