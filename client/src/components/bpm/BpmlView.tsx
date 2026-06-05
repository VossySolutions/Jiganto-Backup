import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import MondayTable, { type ColumnDef, type GroupDef, defaultStatusColors } from "@/components/MondayTable";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus, Search, Loader2, Trash2, Download, Upload, Settings2, GripVertical,
  ChevronDown, ChevronRight, FileText, Eye, EyeOff, Copy, LayoutTemplate,
  ArrowUp, ArrowDown, X, FolderOpen, Pencil, LayoutGrid, List, Clock,
  Filter, ArrowUpDown, Save, Bookmark, ClipboardCopy, Image as ImageIcon, FileDown,
} from "lucide-react";
import {
  BPML_FIELD_SECTIONS,
  BPML_CORE_FIELDS,
  type BpmlTemplate,
  type BpmlEntry,
  type BpmlCustomFieldDef,
  bpmlTemplateTypeEnum,
  bpmlTemplateStatusEnum,
  bpmlErpPlatformEnum,
  bpmlProcessAreaEnum,
  bpmlStatusEnum,
  bpmlFitGapEnum,
  bpmlPriorityEnum,
  bpmlComplexityEnum,
} from "@shared/models/bpml";
import * as XLSX from "xlsx";

const STATUS_COLORS = defaultStatusColors;

const BPML_CATALOGUE_COLUMNS: ColumnDef<any>[] = [
  { id: "name", header: "Name", type: "text", accessor: "name", width: "minmax(200px, 2fr)" },
  {
    id: "templateType", header: "Type", type: "status", accessor: "templateType",
    options: bpmlTemplateTypeEnum.map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1), color: STATUS_COLORS[v] || "bg-muted text-foreground" })),
  },
  { id: "erpPlatform", header: "ERP Platform", type: "text", accessor: ((row: any) => row.erpPlatform || "\u2014") as any },
  { id: "processArea", header: "Process Area", type: "text", accessor: ((row: any) => row.processArea || "\u2014") as any },
  {
    id: "status", header: "Status", type: "status", accessor: "status",
    options: bpmlTemplateStatusEnum.map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1), color: STATUS_COLORS[v] || "bg-muted text-foreground" })),
  },
  { id: "version", header: "Version", type: "text", accessor: ((row: any) => row.version || "\u2014") as any, width: "80px" },
  { id: "updatedAt", header: "Updated", type: "date", accessor: "updatedAt", width: "140px" },
];

const BPML_GROUPING_OPTIONS = [
  { value: "none", label: "No Grouping" },
  { value: "templateType", label: "Group by Type" },
  { value: "erpPlatform", label: "Group by ERP Platform" },
  { value: "status", label: "Group by Status" },
];

const BPML_SORT_OPTIONS = [
  { value: "processName", label: "Process Name" },
  { value: "sequenceOrder", label: "Sequence" },
  { value: "bpmlId", label: "BPML ID" },
  { value: "processCode", label: "Process Code" },
  { value: "level1", label: "L1 - End-to-End" },
  { value: "level2", label: "L2 - Process Group" },
  { value: "level3", label: "L3 - Business Process" },
  { value: "level4", label: "L4 - Subprocess" },
  { value: "level5", label: "L5 - Task" },
  { value: "overallStatus", label: "Overall Status" },
  { value: "fitGapStatus", label: "Fit/Gap" },
  { value: "priority", label: "Priority" },
  { value: "complexity", label: "Complexity" },
  { value: "department", label: "Department" },
  { value: "processOwner", label: "Process Owner" },
  { value: "businessOwner", label: "Business Owner" },
  { value: "designStatus", label: "Design Status" },
  { value: "buildStatus", label: "Build Status" },
  { value: "unitTestStatus", label: "Unit Test Status" },
  { value: "sitStatus", label: "SIT Status" },
  { value: "e2eStatus", label: "E2E Status" },
  { value: "uatStatus", label: "UAT Status" },
  { value: "countryScope", label: "Country Scope" },
  { value: "legalEntity", label: "Legal Entity" },
];

const BPML_ENTRY_GROUP_OPTIONS = [
  { value: "none", label: "No Grouping" },
  { value: "level1", label: "L1 - End-to-End Process" },
  { value: "level2", label: "L2 - Process Group" },
  { value: "level3", label: "L3 - Business Process" },
  { value: "overallStatus", label: "Overall Status" },
  { value: "fitGapStatus", label: "Fit/Gap Status" },
  { value: "priority", label: "Priority" },
  { value: "complexity", label: "Complexity" },
  { value: "department", label: "Department" },
  { value: "processOwner", label: "Process Owner" },
  { value: "designStatus", label: "Design Status" },
  { value: "buildStatus", label: "Build Status" },
  { value: "countryScope", label: "Country Scope" },
  { value: "erpPlatform", label: "ERP Platform" },
];

const BPML_FILTER_FIELDS: { value: string; label: string; options?: readonly string[] }[] = [
  { value: "overallStatus", label: "Overall Status", options: bpmlStatusEnum },
  { value: "fitGapStatus", label: "Fit/Gap", options: bpmlFitGapEnum },
  { value: "priority", label: "Priority", options: bpmlPriorityEnum },
  { value: "complexity", label: "Complexity", options: bpmlComplexityEnum },
  { value: "level1", label: "L1 - End-to-End" },
  { value: "level2", label: "L2 - Process Group" },
  { value: "level3", label: "L3 - Business Process" },
  { value: "processOwner", label: "Process Owner" },
  { value: "businessOwner", label: "Business Owner" },
  { value: "department", label: "Department" },
  { value: "countryScope", label: "Country Scope" },
  { value: "legalEntity", label: "Legal Entity" },
  { value: "erpPlatform", label: "ERP Platform", options: bpmlErpPlatformEnum },
  { value: "designStatus", label: "Design Status", options: bpmlStatusEnum },
  { value: "buildStatus", label: "Build Status", options: bpmlStatusEnum },
  { value: "unitTestStatus", label: "Unit Test Status", options: bpmlStatusEnum },
  { value: "sitStatus", label: "SIT Status", options: bpmlStatusEnum },
  { value: "e2eStatus", label: "E2E Status", options: bpmlStatusEnum },
  { value: "uatStatus", label: "UAT Status", options: bpmlStatusEnum },
  { value: "securityReviewStatus", label: "Security Review", options: bpmlStatusEnum },
  { value: "deploymentStatus", label: "Deployment Status", options: bpmlStatusEnum },
  { value: "migrationStatus", label: "Migration Status", options: bpmlStatusEnum },
  { value: "goLiveReadinessStatus", label: "Go-Live Readiness", options: bpmlStatusEnum },
  { value: "trainingStatus", label: "Training Status", options: bpmlStatusEnum },
];

interface SavedView {
  id: string;
  name: string;
  filters: { field: string; value: string }[];
  sortField: string;
  sortDir: "asc" | "desc";
  groupBy: string;
  hiddenColumns?: string[];
  columnOrder?: string[];
}

const DETAIL_PANEL_SIZES = {
  sm: "w-[400px] sm:max-w-[450px] sm:w-[450px]",
  md: "w-[550px] sm:max-w-[650px] sm:w-[650px]",
  lg: "w-[750px] sm:max-w-[900px] sm:w-[900px]",
};

function fieldToColumn(field: { id: string; label: string; type: string; options?: { value: string; label: string }[] }): ColumnDef<any> {
  if (field.type === "enum" && field.options) {
    return {
      id: field.id,
      header: field.label,
      type: "status" as const,
      accessor: field.id,
      width: "140px",
      editable: true,
      options: field.options.map(o => ({
        value: o.value,
        label: o.label,
        color: STATUS_COLORS[o.value] || "bg-muted text-foreground",
      })),
    };
  }
  if (field.type === "boolean") {
    return {
      id: field.id,
      header: field.label,
      type: "checkbox" as const,
      accessor: field.id,
      width: "100px",
      editable: true,
    };
  }
  if (field.type === "number") {
    return {
      id: field.id,
      header: field.label,
      type: "number" as const,
      accessor: field.id,
      width: "100px",
      editable: true,
    };
  }
  if (field.type === "date") {
    return {
      id: field.id,
      header: field.label,
      type: "date" as const,
      accessor: field.id,
      width: "140px",
      editable: true,
    };
  }
  return {
    id: field.id,
    header: field.label,
    type: "text" as const,
    accessor: field.id,
    width: field.type === "textarea" ? "200px" : "160px",
    editable: true,
  };
}

function entryToRow(entry: BpmlEntry): Record<string, any> {
  const row: Record<string, any> = { id: entry.id };
  const coreFieldIds = new Set(BPML_CORE_FIELDS.map(f => f.id));
  for (const f of BPML_CORE_FIELDS) {
    row[f.id] = (entry as any)[f.id] ?? "";
  }
  const custom = (entry.customFieldValues as Record<string, any>) || {};
  for (const [k, v] of Object.entries(custom)) {
    if (!coreFieldIds.has(k)) {
      row[k] = v ?? "";
    }
  }
  return row;
}

function generateBpmlCsv(entries: BpmlEntry[], fields: { id: string; label: string }[]): string {
  const bom = "\uFEFF";
  const headers = fields.map(f => f.label);
  const rows = entries.map(entry => {
    const r = entryToRow(entry);
    return fields.map(f => {
      const val = r[f.id];
      if (val === null || val === undefined || val === "") return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",");
  });
  return bom + [headers.join(","), ...rows].join("\n");
}

function parseBpmlCsv(content: string, fields: { id: string; label: string }[]): Record<string, any>[] {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const labelToId = new Map<string, string>();
  fields.forEach(f => {
    labelToId.set(f.label.toLowerCase().trim(), f.id);
    labelToId.set(f.id.toLowerCase().trim(), f.id);
  });
  const colMap = headers.map(h => labelToId.get(h.toLowerCase().trim()) || null);

  const rows: Record<string, any>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseCSVLine(line);
    const row: Record<string, any> = {};
    colMap.forEach((fieldId, idx) => {
      if (fieldId && vals[idx] !== undefined) {
        row[fieldId] = vals[idx];
      }
    });
    if (Object.keys(row).length > 0) rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { current += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { result.push(current.trim()); current = ""; }
      else { current += c; }
    }
  }
  result.push(current.trim());
  return result;
}

function parseXlsxFile(buffer: ArrayBuffer, fields: { id: string; label: string }[]): Record<string, any>[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonRows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });
  if (jsonRows.length < 2) return [];

  const headers = (jsonRows[0] as any[]).map(h => String(h ?? ""));
  const labelToId = new Map<string, string>();
  fields.forEach(f => {
    labelToId.set(f.label.toLowerCase().trim(), f.id);
    labelToId.set(f.id.toLowerCase().trim(), f.id);
  });
  const colMap = headers.map(h => labelToId.get(h.toLowerCase().trim()) || null);

  const rows: Record<string, any>[] = [];
  for (let i = 1; i < jsonRows.length; i++) {
    const vals = jsonRows[i] as any[];
    if (!vals || vals.length === 0) continue;
    const row: Record<string, any> = {};
    colMap.forEach((fieldId, idx) => {
      if (fieldId && vals[idx] !== undefined && vals[idx] !== null && String(vals[idx]).trim() !== "") {
        row[fieldId] = String(vals[idx]);
      }
    });
    if (Object.keys(row).length > 0) rows.push(row);
  }
  return rows;
}

function getColumnMapping(previewRows: Record<string, any>[], fields: { id: string; label: string }[]): { matched: string[]; unmatched: string[] } {
  if (!previewRows.length) return { matched: [], unmatched: [] };
  const fieldIds = new Set(fields.map(f => f.id));
  const usedKeys = new Set<string>();
  previewRows.forEach(row => Object.keys(row).forEach(k => usedKeys.add(k)));
  const matched: string[] = [];
  const unmatched: string[] = [];
  usedKeys.forEach(k => {
    if (fieldIds.has(k)) matched.push(k);
    else unmatched.push(k);
  });
  return { matched, unmatched };
}

export default function BpmlView() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const catalogueImportRef = useRef<HTMLInputElement>(null);
  const bpmlContentRef = useRef<HTMLDivElement>(null);
  const tenantId = 1;

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [showCreateTemplateDialog, setShowCreateTemplateDialog] = useState(false);
  const [showEditTemplateDialog, setShowEditTemplateDialog] = useState(false);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [detailPanelSize, setDetailPanelSize] = useState<"sm" | "md" | "lg">("md");
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [importPreview, setImportPreview] = useState<Record<string, any>[] | null>(null);
  const [importFileName, setImportFileName] = useState("");

  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");
  const [newTemplateType, setNewTemplateType] = useState("standard");
  const [newTemplateErp, setNewTemplateErp] = useState("");
  const [newTemplateArea, setNewTemplateArea] = useState("");

  const [editingTemplate, setEditingTemplate] = useState<BpmlTemplate | null>(null);
  const [customFieldName, setCustomFieldName] = useState("");
  const [customFieldType, setCustomFieldType] = useState("text");
  const [customFieldSection, setCustomFieldSection] = useState("custom");
  const [customFieldOptions, setCustomFieldOptions] = useState<string[]>([]);
  const [customFieldOptionInput, setCustomFieldOptionInput] = useState("");

  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [catalogueFilterType, setCatalogueFilterType] = useState("all");
  const [catalogueFilterErp, setCatalogueFilterErp] = useState("all");
  const [catalogueFilterArea, setCatalogueFilterArea] = useState("all");
  const [catalogueFilterStatus, setCatalogueFilterStatus] = useState("all");
  const [catalogueGroupBy, setCatalogueGroupBy] = useState("none");
  const [catalogueViewMode, setCatalogueViewMode] = useState<"grid" | "table">("grid");

  const [entryFilters, setEntryFilters] = useState<{ field: string; value: string }[]>([]);
  const [entrySortField, setEntrySortField] = useState("sequenceOrder");
  const [entrySortDir, setEntrySortDir] = useState<"asc" | "desc">("asc");
  const [entryGroupBy, setEntryGroupBy] = useState("none");
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showSaveViewDialog, setShowSaveViewDialog] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [dragColumnId, setDragColumnId] = useState<string | null>(null);

  const [showImportLibraryDialog, setShowImportLibraryDialog] = useState(false);
  const [importLibraryName, setImportLibraryName] = useState("");
  const [importLibraryFile, setImportLibraryFile] = useState<File | null>(null);
  const [importLibraryPreview, setImportLibraryPreview] = useState<Record<string, any>[] | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [pendingFilterField, setPendingFilterField] = useState("");
  const [pendingFilterValue, setPendingFilterValue] = useState("");

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<BpmlTemplate[]>({
    queryKey: [`/api/bpml/templates?tenantId=${tenantId}`],
  });

  const selectedTemplate = useMemo(() => templates.find(t => t.id === selectedTemplateId), [templates, selectedTemplateId]);

  const { data: entries = [], isLoading: loadingEntries } = useQuery<BpmlEntry[]>({
    queryKey: [`/api/bpml/entries?templateId=${selectedTemplateId}&tenantId=${tenantId}`],
    enabled: !!selectedTemplateId,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/bpml/templates", data);
      return res.json();
    },
    onSuccess: (template: BpmlTemplate) => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/bpml/templates") });
      setSelectedTemplateId(template.id);
      setShowCreateTemplateDialog(false);
      toast({ title: "Library created" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/bpml/templates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/bpml/templates") });
      setShowEditTemplateDialog(false);
      toast({ title: "Library updated" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/bpml/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/bpml/templates") });
      if (selectedTemplateId) setSelectedTemplateId(null);
      toast({ title: "Library deleted" });
    },
  });

  const createEntryMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/bpml/entries", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/bpml/entries") });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (entries: any[]) => {
      const res = await apiRequest("POST", "/api/bpml/entries/bulk", { entries });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/bpml/entries") });
      toast({ title: "Entries imported successfully" });
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/bpml/entries/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/bpml/entries") });
    },
  });

  const deleteEntriesMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await apiRequest("POST", "/api/bpml/entries/bulk-delete", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/bpml/entries") });
      toast({ title: "Entries deleted" });
    },
  });

  const visibleSections = useMemo(() => {
    if (!selectedTemplate) return ["core", "ownership"];
    return (selectedTemplate.visibleSections as string[]) || ["core", "ownership"];
  }, [selectedTemplate]);

  const customFields = useMemo(() => {
    if (!selectedTemplate) return [];
    return (selectedTemplate.customFields as BpmlCustomFieldDef[]) || [];
  }, [selectedTemplate]);

  const templateSavedViews = useMemo(() => {
    if (!selectedTemplate) return [];
    const vf = selectedTemplate.visibleFields as any;
    return (vf?.savedViews as SavedView[]) || [];
  }, [selectedTemplate]);

  const activeFields = useMemo(() => {
    const fields = BPML_CORE_FIELDS.filter(f => visibleSections.includes(f.section));
    customFields.forEach(cf => {
      if (!cf.hidden) {
        fields.push({
          id: cf.id,
          label: cf.label,
          section: cf.section || "custom",
          type: cf.type,
          options: cf.options?.map(o => ({ value: o, label: o })),
        });
      }
    });
    return fields;
  }, [visibleSections, customFields]);

  const columns = useMemo<ColumnDef<any>[]>(() => {
    let fields = activeFields.filter(f => !hiddenColumnIds.has(f.id));
    if (columnOrder.length > 0) {
      const orderMap = new Map(columnOrder.map((id, idx) => [id, idx]));
      fields = [...fields].sort((a, b) => {
        const aIdx = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
        const bIdx = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
        return aIdx - bIdx;
      });
    }
    return fields.map(f => fieldToColumn(f));
  }, [activeFields, hiddenColumnIds, columnOrder]);

  const tableData = useMemo(() => entries.map(entryToRow), [entries]);

  const workstreamTabs = useMemo(() => {
    const l1Values = new Set<string>();
    tableData.forEach(row => {
      const v = String(row.level1 || "").trim();
      if (v) l1Values.add(v);
    });
    return Array.from(l1Values).sort();
  }, [tableData]);

  const filteredData = useMemo(() => {
    let data = tableData;

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(row =>
        Object.values(row).some(v => v && String(v).toLowerCase().includes(lower))
      );
    }

    if (entryFilters.length > 0) {
      const enumFields = new Set(BPML_FILTER_FIELDS.filter(f => f.options).map(f => f.value));
      data = data.filter(row =>
        entryFilters.every(f => {
          const val = String(row[f.field] || "").toLowerCase();
          const filterVal = f.value.toLowerCase();
          return enumFields.has(f.field) ? val === filterVal : val.includes(filterVal);
        })
      );
    }

    if (entrySortField && entrySortField !== "none") {
      data = [...data].sort((a, b) => {
        const aVal = String(a[entrySortField] || "");
        const bVal = String(b[entrySortField] || "");
        const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
        return entrySortDir === "asc" ? cmp : -cmp;
      });
    }

    return data;
  }, [tableData, searchTerm, entryFilters, entrySortField, entrySortDir]);

  const groups = useMemo<GroupDef<any>[] | undefined>(() => {
    if (entryGroupBy === "none") return undefined;
    const grouped = new Map<string, any[]>();
    filteredData.forEach(r => {
      const key = String(r[entryGroupBy] || "Ungrouped");
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    });
    return Array.from(grouped.entries()).map(([name, items]) => ({
      id: name,
      title: name,
      items,
      color: "bg-primary/10 text-primary",
    }));
  }, [filteredData, entryGroupBy]);

  const filteredCatalogueData = useMemo(() => {
    let data = [...templates];
    if (catalogueSearch) {
      const lower = catalogueSearch.toLowerCase();
      data = data.filter(t => t.name.toLowerCase().includes(lower) || (t.description || "").toLowerCase().includes(lower));
    }
    if (catalogueFilterType !== "all") data = data.filter(t => t.templateType === catalogueFilterType);
    if (catalogueFilterErp !== "all") data = data.filter(t => t.erpPlatform === catalogueFilterErp);
    if (catalogueFilterArea !== "all") data = data.filter(t => t.processArea === catalogueFilterArea);
    if (catalogueFilterStatus !== "all") data = data.filter(t => t.status === catalogueFilterStatus);
    return data;
  }, [templates, catalogueSearch, catalogueFilterType, catalogueFilterErp, catalogueFilterArea, catalogueFilterStatus]);

  const catalogueTableGroups = useMemo<GroupDef<any>[] | undefined>(() => {
    if (catalogueGroupBy === "none") return undefined;
    const grouped = new Map<string, any[]>();
    filteredCatalogueData.forEach(t => {
      const key = String((t as any)[catalogueGroupBy] || "Ungrouped");
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(t);
    });
    return Array.from(grouped.entries()).map(([name, items]) => ({
      id: name,
      title: name,
      items,
      color: "bg-primary/10 text-primary",
    }));
  }, [filteredCatalogueData, catalogueGroupBy]);

  const handleCellEdit = useCallback((rowId: number | string, columnId: string, value: unknown) => {
    const entry = entries.find(e => e.id === Number(rowId));
    if (!entry) return;
    const coreFieldIds = new Set(BPML_CORE_FIELDS.map(f => f.id));
    if (coreFieldIds.has(columnId)) {
      updateEntryMutation.mutate({ id: Number(rowId), [columnId]: value });
    } else {
      const existing = (entry.customFieldValues as Record<string, any>) || {};
      updateEntryMutation.mutate({
        id: Number(rowId),
        customFieldValues: { ...existing, [columnId]: value },
      });
    }
  }, [entries, updateEntryMutation]);

  const handleAddEntry = useCallback(() => {
    if (!selectedTemplateId) return;
    const maxSeq = entries.reduce((max, e) => Math.max(max, e.sequenceOrder ?? 0), 0);
    createEntryMutation.mutate({
      templateId: selectedTemplateId,
      tenantId,
      processName: "New Process",
      sequenceOrder: maxSeq + 1,
    });
  }, [selectedTemplateId, entries, createEntryMutation]);

  const handleInsertEntry = useCallback((referenceId: string, position: "above" | "below") => {
    if (!selectedTemplateId) return;
    const refEntry = entries.find(e => e.id === Number(referenceId));
    if (!refEntry) return;
    const refSeq = refEntry.sequenceOrder ?? 0;
    createEntryMutation.mutate({
      templateId: selectedTemplateId,
      tenantId,
      processName: "New Process",
      sequenceOrder: position === "above" ? refSeq : refSeq + 1,
    });
  }, [selectedTemplateId, entries, createEntryMutation]);

  const handleDeleteEntries = useCallback((ids: (number | string)[]) => {
    deleteEntriesMutation.mutate(ids.map(Number));
  }, [deleteEntriesMutation]);

  const handleCreateTemplate = () => {
    createTemplateMutation.mutate({
      tenantId,
      name: newTemplateName,
      description: newTemplateDesc || undefined,
      templateType: newTemplateType,
      erpPlatform: newTemplateErp || undefined,
      processArea: newTemplateArea || undefined,
      visibleSections: ["core", "ownership"],
      customFields: [],
    });
  };

  const handleDownloadTemplate = () => {
    if (!selectedTemplate) return;
    const csv = generateBpmlCsv(entries, activeFields);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTemplate.name.replace(/\s+/g, "_")}_BPML.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadBlankTemplate = () => {
    if (!selectedTemplate) return;
    const csv = generateBpmlCsv([], activeFields);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTemplate.name.replace(/\s+/g, "_")}_BPML_Template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = useCallback(async () => {
    if (!bpmlContentRef.current) return;
    setIsExporting(true);
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(bpmlContentRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        toast({ title: "Copied to clipboard", description: "Paste directly into PowerPoint or any other app" });
      }
    } catch (err: any) {
      toast({ title: "Copy failed", description: "Your browser may not support copying images to clipboard", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }, [toast]);

  const handleExportPng = useCallback(async () => {
    if (!bpmlContentRef.current) return;
    setIsExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(bpmlContentRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `${(selectedTemplate?.name || "BPML").replace(/\s+/g, "_")}_library.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "PNG exported successfully" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }, [selectedTemplate, toast]);

  const handleExportPdf = useCallback(async () => {
    if (!bpmlContentRef.current) return;
    setIsExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(bpmlContentRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const { jsPDF } = await import("jspdf");
      const img = new window.Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      const pdfWidth = img.width;
      const pdfHeight = img.height;
      const orientation = pdfWidth > pdfHeight ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "px", format: [pdfWidth / 2, pdfHeight / 2] });
      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth / 2, pdfHeight / 2);
      pdf.save(`${(selectedTemplate?.name || "BPML").replace(/\s+/g, "_")}_library.pdf`);
      toast({ title: "PDF exported successfully" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }, [selectedTemplate, toast]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);

    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const buffer = ev.target?.result as ArrayBuffer;
        const rows = parseXlsxFile(buffer, activeFields);
        setImportPreview(rows);
        setShowImportDialog(true);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const rows = parseBpmlCsv(text, activeFields);
        setImportPreview(rows);
        setShowImportDialog(true);
      };
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  const handleImportConfirm = () => {
    if (!importPreview || !selectedTemplateId) return;
    const entriesToCreate = importPreview.map((row, idx) => {
      const coreFieldIds = new Set(BPML_CORE_FIELDS.map(f => f.id));
      const entry: Record<string, any> = {
        templateId: selectedTemplateId,
        tenantId,
        processName: row.processName || `Process ${idx + 1}`,
        sequenceOrder: idx + 1,
      };
      const customVals: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        if (coreFieldIds.has(k)) {
          entry[k] = v;
        } else {
          customVals[k] = v;
        }
      }
      if (Object.keys(customVals).length > 0) {
        entry.customFieldValues = customVals;
      }
      return entry;
    });
    bulkCreateMutation.mutate(entriesToCreate);
    setShowImportDialog(false);
    setImportPreview(null);
  };

  const handleCatalogueImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLibraryFile(file);
    setImportFileName(file.name);

    const allFields = BPML_CORE_FIELDS;
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const buffer = ev.target?.result as ArrayBuffer;
        const rows = parseXlsxFile(buffer, allFields);
        setImportLibraryPreview(rows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const rows = parseBpmlCsv(text, allFields);
        setImportLibraryPreview(rows);
      };
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  const handleImportLibraryConfirm = async () => {
    if (!importLibraryName.trim() || !importLibraryPreview || importLibraryPreview.length === 0) {
      toast({ title: "Please provide a library name and a file with at least one data row", variant: "destructive" });
      return;
    }
    try {
      const res = await apiRequest("POST", "/api/bpml/templates", {
        tenantId,
        name: importLibraryName,
        templateType: "standard",
        visibleSections: ["core", "ownership"],
        customFields: [],
      });
      const template = await res.json();
      const coreFieldIds = new Set(BPML_CORE_FIELDS.map(f => f.id));
      const entriesToCreate = importLibraryPreview.map((row, idx) => {
        const entry: Record<string, any> = {
          templateId: template.id,
          tenantId,
          processName: row.processName || `Process ${idx + 1}`,
          sequenceOrder: idx + 1,
        };
        const customVals: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) {
          if (coreFieldIds.has(k)) {
            entry[k] = v;
          } else {
            customVals[k] = v;
          }
        }
        if (Object.keys(customVals).length > 0) {
          entry.customFieldValues = customVals;
        }
        return entry;
      });
      await apiRequest("POST", "/api/bpml/entries/bulk", { entries: entriesToCreate });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/bpml") });
      setShowImportLibraryDialog(false);
      setImportLibraryName("");
      setImportLibraryFile(null);
      setImportLibraryPreview(null);
      setSelectedTemplateId(template.id);
      toast({ title: "Library created and data imported" });
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    }
  };

  const handleToggleSection = (sectionId: string) => {
    if (!selectedTemplate) return;
    const current = [...visibleSections];
    const idx = current.indexOf(sectionId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(sectionId);
    }
    updateTemplateMutation.mutate({ id: selectedTemplate.id, visibleSections: current });
  };

  const handleAddCustomField = () => {
    if (!selectedTemplate || !customFieldName.trim()) return;
    if (customFieldType === "enum" && customFieldOptions.length === 0) {
      toast({ title: "Please add at least one dropdown option", variant: "destructive" });
      return;
    }
    const existing = [...customFields];
    const fieldId = `cf_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const newField: BpmlCustomFieldDef = {
      id: fieldId,
      label: customFieldName.trim(),
      type: customFieldType as any,
      section: customFieldSection,
    };
    if (customFieldType === "enum") {
      newField.options = [...customFieldOptions];
    }
    existing.push(newField);
    updateTemplateMutation.mutate({ id: selectedTemplate.id, customFields: existing });
    setCustomFieldName("");
    setCustomFieldOptions([]);
    setCustomFieldOptionInput("");
  };

  const handleRemoveCustomField = (fieldId: string) => {
    if (!selectedTemplate) return;
    const existing = customFields.filter(f => f.id !== fieldId);
    updateTemplateMutation.mutate({ id: selectedTemplate.id, customFields: existing });
  };

  const handleSaveView = () => {
    if (!saveViewName.trim() || !selectedTemplate) return;
    const view: SavedView = {
      id: `sv_${Date.now()}`,
      name: saveViewName.trim(),
      filters: [...entryFilters],
      sortField: entrySortField,
      sortDir: entrySortDir,
      groupBy: entryGroupBy,
      hiddenColumns: Array.from(hiddenColumnIds),
      columnOrder: columnOrder.length > 0 ? [...columnOrder] : [],
    };
    const currentViews = templateSavedViews;
    const newViews = [...currentViews, view];
    updateTemplateMutation.mutate({
      id: selectedTemplate.id,
      visibleFields: { ...(selectedTemplate.visibleFields as any || {}), savedViews: newViews },
    });
    setActiveViewId(view.id);
    setShowSaveViewDialog(false);
    setSaveViewName("");
    toast({ title: "View saved" });
  };

  const handleApplyView = (view: SavedView) => {
    setEntryFilters(view.filters);
    setEntrySortField(view.sortField);
    setEntrySortDir(view.sortDir);
    setEntryGroupBy(view.groupBy);
    setHiddenColumnIds(new Set(view.hiddenColumns || []));
    setColumnOrder(view.columnOrder || []);
    setActiveViewId(view.id);
  };

  const handleDeleteView = (viewId: string) => {
    if (!selectedTemplate) return;
    const newViews = templateSavedViews.filter(v => v.id !== viewId);
    updateTemplateMutation.mutate({
      id: selectedTemplate.id,
      visibleFields: { ...(selectedTemplate.visibleFields as any || {}), savedViews: newViews },
    });
    if (activeViewId === viewId) setActiveViewId(null);
  };

  const handleResetView = () => {
    setEntryFilters([]);
    setEntrySortField("sequenceOrder");
    setEntrySortDir("asc");
    setEntryGroupBy("none");
    setHiddenColumnIds(new Set());
    setColumnOrder([]);
    setActiveViewId(null);
  };

  const handleAddFilter = () => {
    if (!pendingFilterField || !pendingFilterValue) return;
    setEntryFilters(prev => [...prev, { field: pendingFilterField, value: pendingFilterValue }]);
    setPendingFilterField("");
    setPendingFilterValue("");
    setActiveViewId(null);
  };

  const handleRemoveFilter = (idx: number) => {
    setEntryFilters(prev => prev.filter((_, i) => i !== idx));
    setActiveViewId(null);
  };

  const uniqueFieldValues = useCallback((fieldId: string): string[] => {
    const vals = new Set<string>();
    tableData.forEach(row => {
      const v = String(row[fieldId] || "").trim();
      if (v) vals.add(v);
    });
    return Array.from(vals).sort();
  }, [tableData]);

  const importColumnMapping = useMemo(() => {
    if (!importPreview) return null;
    return getColumnMapping(importPreview, activeFields);
  }, [importPreview, activeFields]);

  const importLibraryColumnMapping = useMemo(() => {
    if (!importLibraryPreview) return null;
    return getColumnMapping(importLibraryPreview, BPML_CORE_FIELDS);
  }, [importLibraryPreview]);

  if (loadingTemplates) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!selectedTemplateId) {
    const hasActiveFilters = catalogueSearch || catalogueFilterType !== "all" || catalogueFilterErp !== "all" || catalogueFilterArea !== "all" || catalogueFilterStatus !== "all";
    const recentLibraries = [...templates].sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime()).slice(0, 6);

    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-bpml-title">
                Business Process Master List
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Select or create a BPML library to manage your process hierarchy and implementation lifecycle.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => setShowCreateTemplateDialog(true)} data-testid="button-create-bpml-library">
                <Plus className="h-4 w-4 mr-2" />
                Create BPML Library
              </Button>
              <Button variant="outline" onClick={() => setShowImportLibraryDialog(true)} data-testid="button-import-bpml-library">
                <Upload className="h-4 w-4 mr-2" />
                Import BPML Library
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search libraries..."
                value={catalogueSearch}
                onChange={(e) => setCatalogueSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-libraries"
              />
            </div>
            <Select value={catalogueFilterType} onValueChange={setCatalogueFilterType}>
              <SelectTrigger className="w-[160px]" data-testid="select-filter-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {bpmlTemplateTypeEnum.map(t => (
                  <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={catalogueFilterErp} onValueChange={setCatalogueFilterErp}>
              <SelectTrigger className="w-[160px]" data-testid="select-filter-erp">
                <SelectValue placeholder="All ERP" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ERP Platforms</SelectItem>
                {bpmlErpPlatformEnum.map(e => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={catalogueFilterArea} onValueChange={setCatalogueFilterArea}>
              <SelectTrigger className="w-[160px]" data-testid="select-filter-area">
                <SelectValue placeholder="All Areas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Process Areas</SelectItem>
                {bpmlProcessAreaEnum.map(a => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={catalogueFilterStatus} onValueChange={setCatalogueFilterStatus}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {bpmlTemplateStatusEnum.map(s => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={catalogueGroupBy} onValueChange={setCatalogueGroupBy}>
              <SelectTrigger className="w-[180px]" data-testid="select-catalogue-group-by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BPML_GROUPING_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center border rounded-md">
              <Button size="icon" variant="ghost" className={cn("rounded-none rounded-l-md toggle-elevate", catalogueViewMode === "grid" && "toggle-elevated")} onClick={() => setCatalogueViewMode("grid")} data-testid="button-view-grid">
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className={cn("rounded-none rounded-r-md toggle-elevate", catalogueViewMode === "table" && "toggle-elevated")} onClick={() => setCatalogueViewMode("table")} data-testid="button-view-table">
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!hasActiveFilters && templates.length > 0 && recentLibraries.length > 0 && (
            <div className="mb-6" data-testid="section-recent-libraries">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recently Edited</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {recentLibraries.map(lib => (
                  <Card
                    key={`recent-${lib.id}`}
                    className="hover-elevate cursor-pointer"
                    onClick={() => setSelectedTemplateId(lib.id)}
                    data-testid={`card-recent-library-${lib.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-xs font-medium truncate">{lib.name}</span>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <Badge className={cn("text-[10px] px-1.5 py-0", STATUS_COLORS[lib.status] || "")}>
                          {lib.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{lib.updatedAt ? new Date(lib.updatedAt).toLocaleDateString() : ""}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Separator className="mt-6" />
            </div>
          )}

          {templates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <LayoutTemplate className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2" data-testid="text-no-libraries">No BPML Libraries</h3>
                <p className="text-sm text-muted-foreground mb-4">Create your first library to start managing your business process master list.</p>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setShowCreateTemplateDialog(true)} data-testid="button-create-first-library">
                    <Plus className="h-4 w-4 mr-1" />
                    Create Library
                  </Button>
                  <Button variant="outline" onClick={() => setShowImportLibraryDialog(true)} data-testid="button-import-first-library">
                    <Upload className="h-4 w-4 mr-1" />
                    Import Library
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : filteredCatalogueData.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No libraries match your filters</h3>
                <p className="text-sm text-muted-foreground mb-4">Try adjusting your search or filter criteria.</p>
              </CardContent>
            </Card>
          ) : catalogueViewMode === "table" ? (
            <MondayTable
              columns={BPML_CATALOGUE_COLUMNS}
              data={catalogueGroupBy !== "none" ? [] : filteredCatalogueData}
              columnWidthStorageKey="jiganto-bpml-catalogue-col-widths"
              totalCount={templates.length}
              groups={catalogueTableGroups}
              onRowClick={(row: any) => setSelectedTemplateId(row.id)}
              selectable
              emptyMessage="No libraries match your filters"
              data-testid="table-libraries"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCatalogueData.map(t => (
                <Card
                  key={t.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => setSelectedTemplateId(t.id)}
                  data-testid={`card-bpml-library-${t.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground truncate">{t.name}</h3>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {t.templateType}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {t.erpPlatform && <Badge variant="outline" className="text-xs">{t.erpPlatform}</Badge>}
                      {t.processArea && <Badge variant="outline" className="text-xs">{t.processArea}</Badge>}
                      <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[t.status] || "")}>
                        {t.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">v{t.version}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Dialog open={showCreateTemplateDialog} onOpenChange={setShowCreateTemplateDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create BPML Library</DialogTitle>
              <DialogDescription>Define a new BPML library to organise your process hierarchy.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Library Name</Label>
                <Input
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  placeholder="e.g., SAP S/4HANA OTC"
                  data-testid="input-library-name"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newTemplateDesc}
                  onChange={e => setNewTemplateDesc(e.target.value)}
                  placeholder="Purpose and scope..."
                  data-testid="input-library-desc"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={bpmlTemplateTypeEnum.includes(newTemplateType as any) ? newTemplateType : "custom"} onValueChange={v => {
                    if (v === "custom") { setNewTemplateType(""); return; }
                    setNewTemplateType(v);
                  }}>
                    <SelectTrigger data-testid="select-library-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {bpmlTemplateTypeEnum.map(t => (
                        <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                      ))}
                      <SelectItem value="custom">Custom...</SelectItem>
                    </SelectContent>
                  </Select>
                  {!bpmlTemplateTypeEnum.includes(newTemplateType as any) && (
                    <Input
                      value={newTemplateType}
                      onChange={e => setNewTemplateType(e.target.value)}
                      placeholder="Custom type name..."
                      className="mt-1"
                      data-testid="input-create-custom-type"
                    />
                  )}
                </div>
                <div>
                  <Label>ERP Platform</Label>
                  <Select value={newTemplateErp} onValueChange={setNewTemplateErp}>
                    <SelectTrigger data-testid="select-library-erp"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {bpmlErpPlatformEnum.map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Process Area</Label>
                  <Select value={newTemplateArea} onValueChange={setNewTemplateArea}>
                    <SelectTrigger data-testid="select-library-area"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {bpmlProcessAreaEnum.map(a => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateTemplateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateTemplate} disabled={!newTemplateName.trim() || createTemplateMutation.isPending} data-testid="button-confirm-create-library">
                {createTemplateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showImportLibraryDialog} onOpenChange={setShowImportLibraryDialog}>
          <DialogContent className="sm:max-w-[650px]">
            <DialogHeader>
              <DialogTitle>Import BPML Library</DialogTitle>
              <DialogDescription>Create a new library and import process data from a CSV or Excel file.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Library Name</Label>
                <Input
                  value={importLibraryName}
                  onChange={e => setImportLibraryName(e.target.value)}
                  placeholder="e.g., SAP OTC Processes"
                  data-testid="input-import-library-name"
                />
              </div>
              <div>
                <Label>Upload File</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button variant="outline" size="sm" onClick={() => catalogueImportRef.current?.click()} data-testid="button-import-library-file">
                    <Upload className="h-4 w-4 mr-1" />
                    {importLibraryFile ? importLibraryFile.name : "Choose .csv or .xlsx file"}
                  </Button>
                  <input ref={catalogueImportRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCatalogueImportFile} />
                </div>
              </div>
              {importLibraryPreview && importLibraryPreview.length > 0 && (
                <>
                  {importLibraryColumnMapping && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {importLibraryColumnMapping.matched.length} columns matched
                      </Badge>
                      {importLibraryColumnMapping.unmatched.length > 0 && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          {importLibraryColumnMapping.unmatched.length} unmatched
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="max-h-[250px] overflow-auto border rounded-md">
                    <table className="w-full text-xs min-w-[600px]">
                      <thead className="bg-muted sticky top-0 z-10">
                        <tr>
                          <th className="px-2 py-1 text-left">#</th>
                          <th className="px-2 py-1 text-left">Process Name</th>
                          <th className="px-2 py-1 text-left">L1</th>
                          <th className="px-2 py-1 text-left">L2</th>
                          <th className="px-2 py-1 text-left">L3</th>
                          <th className="px-2 py-1 text-left">Status</th>
                          <th className="px-2 py-1 text-left">Fit/Gap</th>
                          <th className="px-2 py-1 text-left">Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importLibraryPreview.slice(0, 20).map((row, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-2 py-1">{i + 1}</td>
                            <td className="px-2 py-1">{row.processName || "-"}</td>
                            <td className="px-2 py-1">{row.level1 || "-"}</td>
                            <td className="px-2 py-1">{row.level2 || "-"}</td>
                            <td className="px-2 py-1">{row.level3 || "-"}</td>
                            <td className="px-2 py-1">{row.overallStatus || "-"}</td>
                            <td className="px-2 py-1">{row.fitGapStatus || "-"}</td>
                            <td className="px-2 py-1">{row.priority || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importLibraryPreview.length > 20 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        ...and {importLibraryPreview.length - 20} more rows
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowImportLibraryDialog(false); setImportLibraryName(""); setImportLibraryFile(null); setImportLibraryPreview(null); }}>Cancel</Button>
              <Button onClick={handleImportLibraryConfirm} disabled={!importLibraryName.trim() || !importLibraryPreview || importLibraryPreview.length === 0} data-testid="button-confirm-import-library">
                Create & Import {importLibraryPreview?.length || 0} Entries
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="bpml-table-view">
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="ghost" onClick={() => { setSelectedTemplateId(null); setSearchTerm(""); setEntryFilters([]); setEntrySortField("sequenceOrder"); setEntrySortDir("asc"); setEntryGroupBy("none"); setActiveViewId(null); }} data-testid="button-back-to-libraries">
            <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <h2 className="font-medium text-foreground truncate max-w-[200px]" data-testid="text-library-name">
            {selectedTemplate?.name}
          </h2>
          {selectedTemplate?.erpPlatform && (
            <Badge variant="outline" className="text-xs">{selectedTemplate.erpPlatform}</Badge>
          )}
          {selectedTemplate?.processArea && (
            <Badge variant="outline" className="text-xs">{selectedTemplate.processArea}</Badge>
          )}
          <Badge variant="secondary" className="text-xs">{filteredData.length} entries</Badge>
          <Separator orientation="vertical" className="h-5" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="h-8 w-[180px] pl-8 text-sm"
              data-testid="input-bpml-search"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Popover open={showFilterPopover} onOpenChange={setShowFilterPopover}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" data-testid="button-entry-filter"
                className={cn(entryFilters.length > 0 && "bg-green-50 border-green-500 text-green-700 dark:bg-green-950/40 dark:border-green-500 dark:text-green-400")}>
                <Filter className="h-4 w-4 mr-1" />
                Filter
                {entryFilters.length > 0 && (
                  <Badge className="ml-1 text-[10px] px-1 bg-green-500 text-white no-default-hover-elevate no-default-active-elevate">{entryFilters.length}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px]" align="end">
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Filters</h4>
                {entryFilters.map((f, idx) => {
                  const fieldDef = BPML_FILTER_FIELDS.find(ff => ff.value === f.field);
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs shrink-0">{fieldDef?.label || f.field}</Badge>
                      <span className="text-xs text-muted-foreground">= {f.value.replace(/_/g, " ")}</span>
                      <Button size="icon" variant="ghost" className="h-5 w-5 ml-auto shrink-0" onClick={() => handleRemoveFilter(idx)} data-testid={`button-remove-filter-${idx}`}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
                <Separator />
                <div className="space-y-2">
                  <Select value={pendingFilterField} onValueChange={v => { setPendingFilterField(v); setPendingFilterValue(""); }}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-filter-field"><SelectValue placeholder="Select field..." /></SelectTrigger>
                    <SelectContent>
                      {BPML_FILTER_FIELDS.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {pendingFilterField && (
                    <Select value={pendingFilterValue} onValueChange={setPendingFilterValue}>
                      <SelectTrigger className="h-8 text-xs" data-testid="select-filter-value"><SelectValue placeholder="Select value..." /></SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const fieldDef = BPML_FILTER_FIELDS.find(f => f.value === pendingFilterField);
                          if (fieldDef?.options) {
                            return fieldDef.options.map(o => (
                              <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>
                            ));
                          }
                          return uniqueFieldValues(pendingFilterField).map(v => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  )}
                  <Button size="sm" className="w-full" disabled={!pendingFilterField || !pendingFilterValue} onClick={handleAddFilter} data-testid="button-add-filter">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Filter
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" data-testid="button-entry-sort"
                className={cn(entrySortField && entrySortField !== "sequenceOrder" && "bg-green-50 border-green-500 text-green-700 dark:bg-green-950/40 dark:border-green-500 dark:text-green-400")}>
                <ArrowUpDown className="h-4 w-4 mr-1" />
                Sort
                {entrySortField && entrySortField !== "sequenceOrder" && (
                  <Badge className="ml-1 text-[10px] px-1 bg-green-500 text-white no-default-hover-elevate no-default-active-elevate">
                    {entrySortDir === "asc" ? "A-Z" : "Z-A"}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[400px] overflow-y-auto">
              {entrySortField && entrySortField !== "sequenceOrder" && (
                <>
                  <DropdownMenuItem onClick={() => { setEntrySortField("sequenceOrder"); setEntrySortDir("asc"); setActiveViewId(null); }} data-testid="menuitem-sort-clear">
                    <X className="h-3.5 w-3.5 mr-1.5 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">Clear Sort</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {BPML_SORT_OPTIONS.map(opt => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => {
                    if (entrySortField === opt.value) {
                      setEntrySortDir(prev => prev === "asc" ? "desc" : "asc");
                    } else {
                      setEntrySortField(opt.value);
                      setEntrySortDir("asc");
                    }
                    setActiveViewId(null);
                  }}
                  data-testid={`menuitem-sort-${opt.value}`}
                >
                  <span className="flex-1">{opt.label}</span>
                  {entrySortField === opt.value && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">{entrySortDir}</Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" data-testid="button-entry-group-by"
                className={cn(entryGroupBy !== "none" && "bg-green-50 border-green-500 text-green-700 dark:bg-green-950/40 dark:border-green-500 dark:text-green-400")}>
                <ChevronDown className="h-4 w-4 mr-1" />
                Group
                {entryGroupBy !== "none" && (
                  <Badge className="ml-1 text-[10px] px-1 bg-green-500 text-white no-default-hover-elevate no-default-active-elevate">
                    {BPML_ENTRY_GROUP_OPTIONS.find(o => o.value === entryGroupBy)?.label || entryGroupBy}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[400px] overflow-y-auto">
              {entryGroupBy !== "none" && (
                <>
                  <DropdownMenuItem onClick={() => { setEntryGroupBy("none"); setActiveViewId(null); }} data-testid="menuitem-group-clear">
                    <X className="h-3.5 w-3.5 mr-1.5 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">Clear Group</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {BPML_ENTRY_GROUP_OPTIONS.map(opt => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => { setEntryGroupBy(opt.value); setActiveViewId(null); }}
                  data-testid={`menuitem-group-${opt.value}`}
                >
                  <span className="flex-1">{opt.label}</span>
                  {entryGroupBy === opt.value && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">Active</Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-5" />

          <Button size="sm" onClick={handleAddEntry} data-testid="button-add-bpml-entry">
            <Plus className="h-4 w-4 mr-1" />
            Add Entry
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={isExporting} data-testid="button-download-bpml">
                {isExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopyToClipboard} data-testid="menuitem-bpml-clipboard">
                <ClipboardCopy className="h-4 w-4 mr-2" />Copy to Clipboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPng} data-testid="menuitem-bpml-export-png">
                <ImageIcon className="h-4 w-4 mr-2" />Export as PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf} data-testid="menuitem-bpml-export-pdf">
                <FileDown className="h-4 w-4 mr-2" />Export as PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDownloadTemplate} data-testid="menuitem-download-data">
                Download Data (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadBlankTemplate} data-testid="menuitem-download-blank">
                Download Blank CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-upload-bpml">
            <Upload className="h-4 w-4 mr-1" />
            Import
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          <Button size="sm" variant="outline" onClick={() => setShowColumnConfig(true)} data-testid="button-column-config"
            className={cn((hiddenColumnIds.size > 0 || columnOrder.length > 0) && "bg-green-50 border-green-500 text-green-700 dark:bg-green-950/40 dark:border-green-500 dark:text-green-400")}>
            <Settings2 className="h-4 w-4 mr-1" />
            Columns
            {hiddenColumnIds.size > 0 && (
              <Badge className="ml-1 text-[10px] px-1 bg-green-500 text-white no-default-hover-elevate no-default-active-elevate">
                {hiddenColumnIds.size} hidden
              </Badge>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            setEditingTemplate(selectedTemplate || null);
            setShowEditTemplateDialog(true);
          }} data-testid="button-edit-library">
            <Pencil className="h-4 w-4 mr-1" />
            Edit Library
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 px-4 py-1.5 border-b bg-muted/20 flex-wrap">
        <Button
          size="sm"
          variant="ghost"
          className={cn("text-xs toggle-elevate", !activeViewId && "toggle-elevated")}
          onClick={handleResetView}
          data-testid="button-view-all"
        >
          All
        </Button>
        {workstreamTabs.map(ws => (
          <Button
            key={ws}
            size="sm"
            variant="ghost"
            className={cn("text-xs toggle-elevate",
              activeViewId === `ws_${ws}` && "toggle-elevated")}
            onClick={() => {
              setEntryFilters([{ field: "level1", value: ws }]);
              setEntrySortField("sequenceOrder");
              setEntrySortDir("asc");
              setEntryGroupBy("none");
              setActiveViewId(`ws_${ws}`);
            }}
            data-testid={`button-view-ws-${ws.replace(/\s+/g, '-').toLowerCase()}`}
          >
            {ws}
          </Button>
        ))}
        {workstreamTabs.length > 0 && <Separator orientation="vertical" className="h-4" />}
        {templateSavedViews.map(view => (
          <div key={view.id} className="flex items-center gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              className={cn("text-xs toggle-elevate", activeViewId === view.id && "toggle-elevated")}
              onClick={() => handleApplyView(view)}
              data-testid={`button-view-${view.id}`}
            >
              <Bookmark className="h-3 w-3 mr-1" />
              {view.name}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5"
              onClick={(e) => { e.stopPropagation(); handleDeleteView(view.id); }}
              data-testid={`button-delete-view-${view.id}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="text-xs"
          onClick={() => setShowSaveViewDialog(true)}
          data-testid="button-save-view"
        >
          <Save className="h-3 w-3 mr-1" />
          Save View
        </Button>
      </div>

      <div ref={bpmlContentRef} className="flex-1 overflow-auto p-4">
        {loadingEntries ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <MondayTable
            columns={columns}
            data={groups ? [] : filteredData}
            columnWidthStorageKey="jiganto-bpml-list-col-widths"
            groups={groups}
            onCellEdit={handleCellEdit}
            onDeleteItems={(ids) => handleDeleteEntries(ids)}
            selectable
            gridLines
            renderBulkActions={(selectedIds) => (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    const lastId = selectedIds[selectedIds.length - 1];
                    if (lastId) handleInsertEntry(String(lastId), "above");
                  }}
                  data-testid="button-bpml-bulk-insert-above"
                >
                  <ArrowUp className="h-4 w-4 mr-1" />
                  Insert Above
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const lastId = selectedIds[selectedIds.length - 1];
                    if (lastId) handleInsertEntry(String(lastId), "below");
                  }}
                  data-testid="button-bpml-bulk-insert-below"
                >
                  <ArrowDown className="h-4 w-4 mr-1" />
                  Insert Below
                </Button>
              </>
            )}
            onRowClick={(row) => {
              setSelectedEntryId(row.id);
              setShowDetailPanel(true);
            }}
            emptyMessage="No entries yet. Add entries manually or import from CSV/Excel."
            addItemLabel="Add Entry"
            onAddItem={handleAddEntry}
            className="w-full"
            totalCount={tableData.length}
            onColumnReorder={(fromId, toId) => {
              const baseOrder = columnOrder.length > 0
                ? columnOrder.filter(id => activeFields.some(af => af.id === id))
                : activeFields.map(af => af.id);
              const missing = activeFields.filter(af => !baseOrder.includes(af.id)).map(af => af.id);
              const newOrder = [...baseOrder, ...missing];
              const fromIdx = newOrder.indexOf(fromId);
              const toIdx = newOrder.indexOf(toId);
              if (fromIdx >= 0 && toIdx >= 0) {
                newOrder.splice(fromIdx, 1);
                newOrder.splice(toIdx, 0, fromId);
                setColumnOrder(newOrder);
                setActiveViewId(null);
              }
            }}
          />
        )}
      </div>

      <Sheet open={showColumnConfig} onOpenChange={setShowColumnConfig}>
        <SheetContent side="right" className="w-[380px] sm:max-w-[450px] sm:w-[450px]">
          <SheetHeader>
            <div className="flex items-center justify-between gap-2">
              <SheetTitle>Columns & Sections</SheetTitle>
              {(hiddenColumnIds.size > 0 || columnOrder.length > 0) && (
                <Button size="sm" variant="outline" onClick={() => { setHiddenColumnIds(new Set()); setColumnOrder([]); setActiveViewId(null); }} data-testid="button-reset-columns">
                  Reset All
                </Button>
              )}
            </div>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-4">
            <div className="space-y-4 pr-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Toggle columns on/off and drag to reorder. Changes are included when you save a view.</p>
              </div>

              {BPML_FIELD_SECTIONS.map(section => {
                const isActive = visibleSections.includes(section.id);
                const sectionFields = BPML_CORE_FIELDS.filter(f => f.section === section.id);
                const customSectionFields = customFields.filter(f => f.section === section.id);
                const allSectionFields = [...sectionFields, ...customSectionFields.map(cf => ({ id: cf.id, label: cf.label, section: cf.section || "custom", type: cf.type }))];
                const isCore = section.id === "core";
                const visibleCount = allSectionFields.filter(f => !hiddenColumnIds.has(f.id)).length;
                return (
                  <div key={section.id} className="border rounded-md">
                    <div
                      className={cn(
                        "flex items-center justify-between px-3 py-2 cursor-pointer",
                        isActive ? "bg-primary/5" : "bg-muted/30"
                      )}
                      onClick={() => !isCore && handleToggleSection(section.id)}
                    >
                      <div className="flex items-center gap-2">
                        {isActive ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                        <span className={cn("text-sm font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                          {section.label}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {visibleCount}/{allSectionFields.length}
                      </Badge>
                    </div>
                    {isActive && (
                      <div className="py-1 border-t">
                        {allSectionFields.map(f => {
                          const isHidden = hiddenColumnIds.has(f.id);
                          const isCustom = customSectionFields.some(cf => cf.id === f.id);
                          return (
                            <div
                              key={f.id}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 text-xs cursor-grab",
                                isHidden ? "text-muted-foreground/50" : "text-foreground",
                                dragColumnId === f.id && "bg-primary/10 border-y border-primary/30"
                              )}
                              draggable
                              onDragStart={(e) => {
                                setDragColumnId(f.id);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (!dragColumnId || dragColumnId === f.id) return;
                                const baseOrder = columnOrder.length > 0
                                  ? columnOrder.filter(id => activeFields.some(af => af.id === id))
                                  : activeFields.map(af => af.id);
                                const missing = activeFields.filter(af => !baseOrder.includes(af.id)).map(af => af.id);
                                const currentOrder = [...baseOrder, ...missing];
                                const fromIdx = currentOrder.indexOf(dragColumnId);
                                const toIdx = currentOrder.indexOf(f.id);
                                if (fromIdx >= 0 && toIdx >= 0) {
                                  currentOrder.splice(fromIdx, 1);
                                  currentOrder.splice(toIdx, 0, dragColumnId);
                                  setColumnOrder(currentOrder);
                                  setActiveViewId(null);
                                }
                                setDragColumnId(null);
                              }}
                              onDragEnd={() => setDragColumnId(null)}
                              data-testid={`column-toggle-${f.id}`}
                            >
                              <GripVertical className="h-3 w-3 opacity-30 shrink-0 cursor-grab" />
                              <Checkbox
                                checked={!isHidden}
                                onCheckedChange={(checked) => {
                                  const newHidden = new Set(hiddenColumnIds);
                                  if (checked) {
                                    newHidden.delete(f.id);
                                  } else {
                                    newHidden.add(f.id);
                                  }
                                  setHiddenColumnIds(newHidden);
                                  setActiveViewId(null);
                                }}
                                className="h-3.5 w-3.5"
                                data-testid={`checkbox-column-${f.id}`}
                              />
                              <span className={cn("flex-1", isHidden && "line-through")}>{f.label}</span>
                              {isCustom && (
                                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); handleRemoveCustomField(f.id); }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Add Custom Field</h4>
                <div className="flex gap-2">
                  <Input
                    value={customFieldName}
                    onChange={e => setCustomFieldName(e.target.value)}
                    placeholder="Field name"
                    className="h-8 text-sm"
                    data-testid="input-custom-field-name"
                  />
                  <Select value={customFieldType} onValueChange={(v) => { setCustomFieldType(v); if (v !== "enum") { setCustomFieldOptions([]); setCustomFieldOptionInput(""); } }}>
                    <SelectTrigger className="h-8 w-[100px]" data-testid="select-custom-field-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="boolean">Yes/No</SelectItem>
                      <SelectItem value="textarea">Long Text</SelectItem>
                      <SelectItem value="url">URL</SelectItem>
                      <SelectItem value="enum">Dropdown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {customFieldType === "enum" && (
                  <div className="space-y-2 p-3 rounded-md border bg-muted/30">
                    <p className="text-xs text-muted-foreground font-medium">Dropdown Options</p>
                    <div className="flex gap-2">
                      <Input
                        value={customFieldOptionInput}
                        onChange={e => setCustomFieldOptionInput(e.target.value)}
                        placeholder="Type an option and press Add"
                        className="h-8 text-sm"
                        data-testid="input-custom-field-option"
                        onKeyDown={e => {
                          if (e.key === "Enter" && customFieldOptionInput.trim()) {
                            e.preventDefault();
                            if (!customFieldOptions.includes(customFieldOptionInput.trim())) {
                              setCustomFieldOptions([...customFieldOptions, customFieldOptionInput.trim()]);
                            }
                            setCustomFieldOptionInput("");
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (customFieldOptionInput.trim() && !customFieldOptions.includes(customFieldOptionInput.trim())) {
                            setCustomFieldOptions([...customFieldOptions, customFieldOptionInput.trim()]);
                          }
                          setCustomFieldOptionInput("");
                        }}
                        disabled={!customFieldOptionInput.trim()}
                        data-testid="button-add-custom-field-option"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {customFieldOptions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {customFieldOptions.map((opt, i) => (
                          <Badge key={i} variant="secondary" className="text-xs gap-1">
                            {opt}
                            <button
                              onClick={() => setCustomFieldOptions(customFieldOptions.filter((_, idx) => idx !== i))}
                              className="ml-0.5 hover:text-destructive"
                              data-testid={`button-remove-option-${i}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    {customFieldOptions.length === 0 && (
                      <p className="text-xs text-muted-foreground">No options added yet. Add at least one option for the dropdown.</p>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Select value={customFieldSection} onValueChange={setCustomFieldSection}>
                    <SelectTrigger className="h-8" data-testid="select-custom-field-section"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BPML_FIELD_SECTIONS.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleAddCustomField} disabled={!customFieldName.trim() || (customFieldType === "enum" && customFieldOptions.length === 0)} data-testid="button-add-custom-field">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[750px]">
          <DialogHeader>
            <DialogTitle>Import Data</DialogTitle>
            <DialogDescription>
              Importing {importPreview?.length || 0} rows from {importFileName}
            </DialogDescription>
          </DialogHeader>
          {importColumnMapping && (
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {importColumnMapping.matched.length} columns matched
              </Badge>
              {importColumnMapping.unmatched.length > 0 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {importColumnMapping.unmatched.length} unmatched
                </Badge>
              )}
            </div>
          )}
          {importPreview && importPreview.length > 0 && (
            <div className="max-h-[300px] overflow-auto border rounded-md">
              <table className="w-full text-xs min-w-[700px]">
                <thead className="bg-muted sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1 text-left">#</th>
                    <th className="px-2 py-1 text-left">Process Name</th>
                    <th className="px-2 py-1 text-left">L1</th>
                    <th className="px-2 py-1 text-left">L2</th>
                    <th className="px-2 py-1 text-left">L3</th>
                    <th className="px-2 py-1 text-left">Status</th>
                    <th className="px-2 py-1 text-left">Fit/Gap</th>
                    <th className="px-2 py-1 text-left">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">{i + 1}</td>
                      <td className="px-2 py-1">{row.processName || "-"}</td>
                      <td className="px-2 py-1">{row.level1 || "-"}</td>
                      <td className="px-2 py-1">{row.level2 || "-"}</td>
                      <td className="px-2 py-1">{row.level3 || "-"}</td>
                      <td className="px-2 py-1">{row.overallStatus || "-"}</td>
                      <td className="px-2 py-1">{row.fitGapStatus || "-"}</td>
                      <td className="px-2 py-1">{row.priority || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importPreview.length > 20 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  ...and {importPreview.length - 20} more rows
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
            <Button onClick={handleImportConfirm} disabled={bulkCreateMutation.isPending} data-testid="button-confirm-import">
              {bulkCreateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Import {importPreview?.length || 0} Entries
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditTemplateDialog} onOpenChange={setShowEditTemplateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Library</DialogTitle>
            <DialogDescription>Update library settings and metadata.</DialogDescription>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-4">
              <div>
                <Label>Library Name</Label>
                <Input
                  value={editingTemplate.name}
                  onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  data-testid="input-edit-library-name"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editingTemplate.description || ""}
                  onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                  data-testid="input-edit-library-desc"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={bpmlTemplateTypeEnum.includes(editingTemplate.templateType as any) ? editingTemplate.templateType : "custom"} onValueChange={v => {
                    if (v === "custom") { setEditingTemplate({ ...editingTemplate, templateType: "" }); return; }
                    setEditingTemplate({ ...editingTemplate, templateType: v });
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {bpmlTemplateTypeEnum.map(t => (
                        <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                      ))}
                      <SelectItem value="custom">Custom...</SelectItem>
                    </SelectContent>
                  </Select>
                  {!bpmlTemplateTypeEnum.includes(editingTemplate.templateType as any) && (
                    <Input
                      value={editingTemplate.templateType}
                      onChange={e => setEditingTemplate({ ...editingTemplate, templateType: e.target.value })}
                      placeholder="Custom type name..."
                      className="mt-1"
                      data-testid="input-custom-type"
                    />
                  )}
                </div>
                <div>
                  <Label>Version</Label>
                  <Input
                    value={editingTemplate.version || "1.0"}
                    onChange={e => setEditingTemplate({ ...editingTemplate, version: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>ERP Platform</Label>
                  <Select value={editingTemplate.erpPlatform || ""} onValueChange={v => setEditingTemplate({ ...editingTemplate, erpPlatform: v })}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {bpmlErpPlatformEnum.map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Process Area</Label>
                  <Select value={editingTemplate.processArea || ""} onValueChange={v => setEditingTemplate({ ...editingTemplate, processArea: v })}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {bpmlProcessAreaEnum.map(a => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editingTemplate.status} onValueChange={v => setEditingTemplate({ ...editingTemplate, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (editingTemplate) {
                  deleteTemplateMutation.mutate(editingTemplate.id);
                  setShowEditTemplateDialog(false);
                }
              }}
              data-testid="button-delete-library"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Library
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEditTemplateDialog(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (editingTemplate) {
                    updateTemplateMutation.mutate({
                      id: editingTemplate.id,
                      name: editingTemplate.name,
                      description: editingTemplate.description,
                      templateType: editingTemplate.templateType,
                      erpPlatform: editingTemplate.erpPlatform,
                      processArea: editingTemplate.processArea,
                      version: editingTemplate.version,
                      status: editingTemplate.status,
                    });
                  }
                }}
                disabled={updateTemplateMutation.isPending}
                data-testid="button-save-library"
              >
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSaveViewDialog} onOpenChange={setShowSaveViewDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
            <DialogDescription>Save the current filter, sort, and grouping configuration as a named view.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>View Name</Label>
            <Input
              value={saveViewName}
              onChange={e => setSaveViewName(e.target.value)}
              placeholder="e.g., High Priority Gaps"
              data-testid="input-save-view-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveViewDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveView} disabled={!saveViewName.trim()} data-testid="button-confirm-save-view">
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={showDetailPanel} onOpenChange={setShowDetailPanel}>
        <SheetContent side="right" className={DETAIL_PANEL_SIZES[detailPanelSize]}>
          <SheetHeader>
            <div className="flex items-center justify-between gap-2">
              <SheetTitle>Entry Details</SheetTitle>
              <div className="flex items-center gap-1">
                <div className="flex items-center border rounded-md mr-2">
                  <Button size="icon" variant="ghost" className={cn("h-7 w-7 rounded-none rounded-l-md",
                      detailPanelSize === "sm" ? "bg-green-100 text-green-700 border-green-400 dark:bg-green-950/50 dark:text-green-400" : "toggle-elevate")}
                    onClick={() => setDetailPanelSize("sm")}
                    data-testid="button-panel-size-sm">
                    <span className="text-[10px] font-medium">S</span>
                  </Button>
                  <Button size="icon" variant="ghost" className={cn("h-7 w-7 rounded-none border-x border-border/30",
                      detailPanelSize === "md" ? "bg-green-100 text-green-700 border-green-400 dark:bg-green-950/50 dark:text-green-400" : "toggle-elevate")}
                    onClick={() => setDetailPanelSize("md")}
                    data-testid="button-panel-size-md">
                    <span className="text-[10px] font-medium">M</span>
                  </Button>
                  <Button size="icon" variant="ghost" className={cn("h-7 w-7 rounded-none rounded-r-md",
                      detailPanelSize === "lg" ? "bg-green-100 text-green-700 border-green-400 dark:bg-green-950/50 dark:text-green-400" : "toggle-elevate")}
                    onClick={() => setDetailPanelSize("lg")}
                    data-testid="button-panel-size-lg">
                    <span className="text-[10px] font-medium">L</span>
                  </Button>
                </div>
                <Button size="icon" variant="ghost"
                  disabled={!selectedEntryId || filteredData.findIndex(r => r.id === selectedEntryId) <= 0}
                  onClick={() => {
                    const idx = filteredData.findIndex(r => r.id === selectedEntryId);
                    if (idx > 0) setSelectedEntryId(filteredData[idx - 1].id);
                  }}
                  data-testid="button-prev-entry">
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {selectedEntryId ? `${filteredData.findIndex(r => r.id === selectedEntryId) + 1} / ${filteredData.length}` : ""}
                </span>
                <Button size="icon" variant="ghost"
                  disabled={!selectedEntryId || filteredData.findIndex(r => r.id === selectedEntryId) >= filteredData.length - 1}
                  onClick={() => {
                    const idx = filteredData.findIndex(r => r.id === selectedEntryId);
                    if (idx >= 0 && idx < filteredData.length - 1) setSelectedEntryId(filteredData[idx + 1].id);
                  }}
                  data-testid="button-next-entry">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-4">
            {selectedEntryId && (() => {
              const entry = entries.find(e => e.id === selectedEntryId);
              if (!entry) return <p className="text-sm text-muted-foreground">Entry not found</p>;
              return (
                <div className="space-y-4 pr-4">
                  {BPML_FIELD_SECTIONS.filter(s => visibleSections.includes(s.id)).map(section => {
                    const sectionFields = activeFields.filter(f => f.section === section.id);
                    if (sectionFields.length === 0) return null;
                    return (
                      <Collapsible key={section.id} defaultOpen>
                        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2">
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{section.label}</span>
                          <Separator className="flex-1" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="grid grid-cols-2 gap-3 pl-6 py-2">
                            {sectionFields.map(field => {
                              const row = entryToRow(entry);
                              const val = row[field.id];
                              return (
                                <div key={field.id}>
                                  <Label className="text-xs text-muted-foreground">{field.label}</Label>
                                  <p className="text-sm mt-0.5">{val || <span className="text-muted-foreground">-</span>}</p>
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              );
            })()}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
