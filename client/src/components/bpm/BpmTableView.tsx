import { useMemo, useCallback, useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import { MondayTable, type ColumnDef, type GroupDef } from "@/components/MondayTable";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Trash2, Download, Upload, Search, MoreHorizontal, ArrowUp, ArrowDown } from "lucide-react";
import { NODE_DEFAULTS } from "@/components/bpm/BpmNodeTypes";
import { cn } from "@/lib/utils";

const SWIMLANE_TYPES = new Set(["swimlane_pool", "swimlane_lane"]);
const CALLOUT_TYPES = new Set(["callout_square", "callout_rounded", "callout_oval", "callout_cloud", "note_folded", "note_lined", "annotation"]);

const SHAPE_TYPE_OPTIONS = [
  { value: "start", label: "Start" },
  { value: "end", label: "End" },
  { value: "task", label: "Process / Task" },
  { value: "subprocess", label: "Sub-Process" },
  { value: "manual_process", label: "Manual Process" },
  { value: "automated_process", label: "Automated Process" },
  { value: "loop", label: "Loop / Iteration" },
  { value: "decision", label: "Decision" },
  { value: "gateway_parallel", label: "Parallel Gateway" },
  { value: "gateway_exclusive", label: "Exclusive Gateway" },
  { value: "data_object", label: "Data / Document" },
  { value: "document", label: "Document" },
  { value: "database", label: "Database" },
  { value: "manual_input", label: "Manual Input" },
  { value: "system", label: "System" },
  { value: "cloud_system", label: "External / Cloud" },
  { value: "annotation", label: "Annotation" },
  { value: "delay", label: "Delay" },
  { value: "display", label: "Display" },
  { value: "predefined_process", label: "Predefined Process" },
  { value: "multi_document", label: "Multi-Document" },
  { value: "internal_storage", label: "Internal Storage" },
  { value: "stored_data", label: "Stored Data" },
  { value: "extract", label: "Extract" },
  { value: "merge", label: "Merge" },
  { value: "sort", label: "Sort" },
  { value: "collate", label: "Collate" },
  { value: "off_page_ref", label: "Off-Page Ref" },
  { value: "terminator", label: "Terminator" },
  { value: "preparation", label: "Preparation" },
];

const SHAPE_LABEL_MAP: Record<string, string> = {};
SHAPE_TYPE_OPTIONS.forEach(o => { SHAPE_LABEL_MAP[o.value] = o.label; });

export interface TableRow {
  id: string;
  sequence: number;
  shapeType: string;
  label: string;
  lane: string;
  connectedTo: string;
  notes: string;
  owner: string;
  cost: string;
  duration: string;
  frequency: string;
  resources: string;
  department: string;
  systemUsed: string;
}

function getAbsolutePosition(node: Node, allNodes: Node[]): { x: number; y: number } {
  let pos = { x: node.position.x, y: node.position.y };
  let current = node;
  while (current.parentId) {
    const parent = allNodes.find(n => n.id === current.parentId);
    if (!parent) break;
    pos.x += parent.position.x;
    pos.y += parent.position.y;
    current = parent;
  }
  return pos;
}

export function nodesToRows(nodes: Node[], edges: Edge[]): TableRow[] {
  const processNodes = nodes.filter(n => !SWIMLANE_TYPES.has(n.type || ""));
  const laneNodes = nodes.filter(n => n.type === "swimlane_lane");
  const laneMap = new Map<string, string>();
  laneNodes.forEach(ln => { laneMap.set(ln.id, (ln.data as any)?.label || "Lane"); });

  const edgeMap = new Map<string, string[]>();
  edges.forEach(e => {
    if (!edgeMap.has(e.source)) edgeMap.set(e.source, []);
    edgeMap.get(e.source)!.push(e.target);
  });

  const sorted = [...processNodes].sort((a, b) => {
    const aPos = getAbsolutePosition(a, nodes);
    const bPos = getAbsolutePosition(b, nodes);
    const aLane = a.parentId || "";
    const bLane = b.parentId || "";
    if (aLane !== bLane) return aLane.localeCompare(bLane);
    if (Math.abs(aPos.y - bPos.y) > 30) return aPos.y - bPos.y;
    return aPos.x - bPos.x;
  });

  return sorted.map((node, idx) => {
    const data = (node.data || {}) as any;
    const attrs = data.attributes || {};
    const targets = edgeMap.get(node.id) || [];
    const targetLabels = targets.map(tid => {
      const tNode = nodes.find(n => n.id === tid);
      const tData = (tNode?.data || {}) as any;
      const edge = edges.find(e => e.source === node.id && e.target === tid);
      const edgeLabel = edge?.label ? ` [${edge.label}]` : "";
      return `${tData.label || tNode?.type || tid}${edgeLabel}`;
    });

    let laneName = "";
    if (node.parentId) {
      laneName = laneMap.get(node.parentId) || node.parentId;
    }

    return {
      id: node.id,
      sequence: idx + 1,
      shapeType: node.type || "task",
      label: data.label || NODE_DEFAULTS[node.type || "task"]?.label || "",
      lane: laneName,
      connectedTo: targetLabels.join(", "),
      notes: attrs.description || "",
      owner: attrs.owner || "",
      cost: attrs.cost != null ? String(attrs.cost) : "",
      duration: attrs.duration != null ? String(attrs.duration) : "",
      frequency: attrs.frequency != null ? String(attrs.frequency) : "",
      resources: attrs.resources != null ? String(attrs.resources) : "",
      department: attrs.department || "",
      systemUsed: attrs.systemUsed || "",
    };
  });
}

interface BpmTableViewProps {
  nodes: Node[];
  edges: Edge[];
  onUpdateNode: (nodeId: string, data: any) => void;
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onSetDirty: () => void;
  onDownloadTemplate: () => void;
  onImportCsv: () => void;
}

export default function BpmTableView({
  nodes,
  edges,
  onUpdateNode,
  onNodesChange,
  onEdgesChange,
  onSetDirty,
  onDownloadTemplate,
  onImportCsv,
}: BpmTableViewProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const rows = useMemo(() => nodesToRows(nodes, edges), [nodes, edges]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter(r =>
      r.label.toLowerCase().includes(term) ||
      r.notes.toLowerCase().includes(term) ||
      r.owner.toLowerCase().includes(term) ||
      r.lane.toLowerCase().includes(term) ||
      SHAPE_LABEL_MAP[r.shapeType]?.toLowerCase().includes(term)
    );
  }, [rows, searchTerm]);

  const laneNodes = useMemo(() => nodes.filter(n => n.type === "swimlane_lane"), [nodes]);
  const lanes = useMemo(() => {
    const result: string[] = [];
    laneNodes.forEach(ln => {
      const label = (ln.data as any)?.label || "Lane";
      if (!result.includes(label)) result.push(label);
    });
    return result;
  }, [laneNodes]);

  const groups = useMemo((): GroupDef<TableRow>[] | undefined => {
    if (lanes.length === 0) return undefined;

    const grouped: GroupDef<TableRow>[] = [];
    const laneItemMap = new Map<string, TableRow[]>();
    const unassigned: TableRow[] = [];

    filteredRows.forEach(row => {
      if (row.lane) {
        if (!laneItemMap.has(row.lane)) laneItemMap.set(row.lane, []);
        laneItemMap.get(row.lane)!.push(row);
      } else {
        unassigned.push(row);
      }
    });

    lanes.forEach(lane => {
      const items = laneItemMap.get(lane) || [];
      grouped.push({
        id: `lane-${lane}`,
        title: lane,
        color: "hsl(var(--primary))",
        items,
        count: items.length,
      });
    });

    if (unassigned.length > 0) {
      grouped.push({
        id: "lane-unassigned",
        title: "No Lane",
        color: "hsl(var(--muted-foreground))",
        items: unassigned,
        count: unassigned.length,
      });
    }

    return grouped;
  }, [filteredRows, lanes]);

  const handleCellEdit = useCallback((rowId: number | string, columnId: string, value: unknown) => {
    const nodeId = String(rowId);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const data = (node.data || {}) as any;
    const attrs = { ...(data.attributes || {}) };

    if (columnId === "label") {
      onUpdateNode(nodeId, { ...data, label: String(value || "") });
    } else if (columnId === "notes") {
      attrs.description = String(value || "");
      onUpdateNode(nodeId, { ...data, attributes: attrs });
    } else if (columnId === "owner") {
      attrs.owner = String(value || "");
      onUpdateNode(nodeId, { ...data, attributes: attrs });
    } else if (columnId === "cost") {
      attrs.cost = value ? String(value) : undefined;
      onUpdateNode(nodeId, { ...data, attributes: attrs });
    } else if (columnId === "duration") {
      attrs.duration = value ? String(value) : undefined;
      onUpdateNode(nodeId, { ...data, attributes: attrs });
    } else if (columnId === "frequency") {
      attrs.frequency = value ? String(value) : undefined;
      onUpdateNode(nodeId, { ...data, attributes: attrs });
    } else if (columnId === "resources") {
      attrs.resources = value ? String(value) : undefined;
      onUpdateNode(nodeId, { ...data, attributes: attrs });
    } else if (columnId === "department") {
      attrs.department = String(value || "");
      onUpdateNode(nodeId, { ...data, attributes: attrs });
    } else if (columnId === "systemUsed") {
      attrs.systemUsed = String(value || "");
      onUpdateNode(nodeId, { ...data, attributes: attrs });
    } else if (columnId === "shapeType") {
      const newType = String(value || "task");
      const defaults = NODE_DEFAULTS[newType] || NODE_DEFAULTS["task"];
      const updatedNodes = nodes.map(n => {
        if (n.id === nodeId) {
          return {
            ...n,
            type: newType,
            data: { ...data, nodeType: newType },
            style: { ...n.style, width: defaults.width, height: defaults.height },
          };
        }
        return n;
      });
      onNodesChange(updatedNodes);
    } else if (columnId === "lane") {
      const newLaneName = String(value || "");
      const targetLane = laneNodes.find(ln => (ln.data as any)?.label === newLaneName);
      const updatedNodes = nodes.map(n => {
        if (n.id === nodeId) {
          if (targetLane) {
            const laneAbs = getAbsolutePosition(targetLane, nodes);
            const nodeAbs = getAbsolutePosition(n, nodes);
            return {
              ...n,
              parentId: targetLane.id,
              position: {
                x: nodeAbs.x - laneAbs.x,
                y: nodeAbs.y - laneAbs.y,
              },
            };
          } else {
            const nodeAbs = getAbsolutePosition(n, nodes);
            return { ...n, parentId: undefined, position: nodeAbs };
          }
        }
        return n;
      });
      onNodesChange(updatedNodes);
    }
    onSetDirty();
  }, [nodes, laneNodes, onUpdateNode, onNodesChange, onSetDirty]);

  const handleAddNode = useCallback(() => {
    const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const defaults = NODE_DEFAULTS["task"];
    const maxY = nodes.reduce((max, n) => {
      if (SWIMLANE_TYPES.has(n.type || "")) return max;
      const abs = getAbsolutePosition(n, nodes);
      return Math.max(max, abs.y);
    }, 100);

    const newNode: Node = {
      id,
      type: "task",
      position: { x: 200, y: maxY + 80 },
      data: {
        label: "New Task",
        nodeType: "task",
        attributes: {},
        style: {},
      },
      style: { width: defaults.width, height: defaults.height },
    };

    onNodesChange([...nodes, newNode]);
    onSetDirty();
  }, [nodes, onNodesChange, onSetDirty]);

  const handleInsertNode = useCallback((referenceNodeId: string, position: "above" | "below") => {
    const refNode = nodes.find(n => n.id === referenceNodeId);
    if (!refNode) return;

    const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const defaults = NODE_DEFAULTS["task"];
    const refAbs = getAbsolutePosition(refNode, nodes);
    const offsetY = position === "above" ? -80 : 80;

    const newNode: Node = {
      id,
      type: "task",
      position: refNode.parentId
        ? { x: refNode.position.x, y: refNode.position.y + offsetY }
        : { x: refAbs.x, y: refAbs.y + offsetY },
      parentId: refNode.parentId,
      data: {
        label: "New Task",
        nodeType: "task",
        attributes: {},
        style: {},
      },
      style: { width: defaults.width, height: defaults.height },
    };

    onNodesChange([...nodes, newNode]);
    onSetDirty();
  }, [nodes, onNodesChange, onSetDirty]);

  const handleDeleteNodes = useCallback((ids: (number | string)[]) => {
    const idSet = new Set(ids.map(String));
    const collectChildren = (parentId: string) => {
      nodes.forEach(n => {
        if (n.parentId === parentId && !idSet.has(n.id)) {
          idSet.add(n.id);
          collectChildren(n.id);
        }
      });
    };
    ids.forEach(id => collectChildren(String(id)));

    const newNodes = nodes.filter(n => !idSet.has(n.id));
    const newEdges = edges.filter(e => !idSet.has(e.source) && !idSet.has(e.target));
    onNodesChange(newNodes);
    onEdgesChange(newEdges);
    onSetDirty();
  }, [nodes, edges, onNodesChange, onEdgesChange, onSetDirty]);

  const columns: ColumnDef<TableRow>[] = useMemo(() => [
    {
      id: "sequence",
      header: "#",
      type: "number" as const,
      accessor: "sequence" as keyof TableRow,
      width: "60px",
      editable: false,
    },
    {
      id: "shapeType",
      header: "Shape Type",
      type: "status" as const,
      accessor: "shapeType" as keyof TableRow,
      width: "160px",
      editable: true,
      options: SHAPE_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label, color: "bg-muted text-foreground" })),
    },
    {
      id: "label",
      header: "Label",
      type: "text" as const,
      accessor: "label" as keyof TableRow,
      width: "200px",
      editable: true,
    },
    {
      id: "lane",
      header: "Lane",
      type: "status" as const,
      accessor: "lane" as keyof TableRow,
      width: "140px",
      editable: lanes.length > 0,
      options: [
        { value: "", label: "None", color: "bg-muted text-muted-foreground" },
        ...lanes.map(l => ({ value: l, label: l, color: "bg-primary/10 text-primary" })),
      ],
    },
    {
      id: "connectedTo",
      header: "Connected To",
      type: "text" as const,
      accessor: "connectedTo" as keyof TableRow,
      width: "200px",
      editable: false,
    },
    {
      id: "notes",
      header: "Notes / Description",
      type: "text" as const,
      accessor: "notes" as keyof TableRow,
      width: "200px",
      editable: true,
    },
    {
      id: "owner",
      header: "Owner",
      type: "text" as const,
      accessor: "owner" as keyof TableRow,
      width: "140px",
      editable: true,
    },
    {
      id: "department",
      header: "Department",
      type: "text" as const,
      accessor: "department" as keyof TableRow,
      width: "140px",
      editable: true,
    },
    {
      id: "systemUsed",
      header: "System Used",
      type: "text" as const,
      accessor: "systemUsed" as keyof TableRow,
      width: "140px",
      editable: true,
    },
    {
      id: "cost",
      header: "Cost",
      type: "text" as const,
      accessor: "cost" as keyof TableRow,
      width: "100px",
      editable: true,
    },
    {
      id: "duration",
      header: "Duration",
      type: "text" as const,
      accessor: "duration" as keyof TableRow,
      width: "100px",
      editable: true,
    },
    {
      id: "frequency",
      header: "Frequency",
      type: "text" as const,
      accessor: "frequency" as keyof TableRow,
      width: "100px",
      editable: true,
    },
    {
      id: "resources",
      header: "Resources",
      type: "text" as const,
      accessor: "resources" as keyof TableRow,
      width: "100px",
      editable: true,
    },
  ], [lanes]);

  return (
    <div className="flex flex-col h-full" data-testid="bpm-table-view">
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search nodes..."
              className="h-8 w-[200px] pl-8 text-sm"
              data-testid="input-table-search"
            />
          </div>
          <Badge variant="secondary" className="text-xs">
            {filteredRows.length} node{filteredRows.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onDownloadTemplate} data-testid="button-download-template">
            <Download className="h-4 w-4 mr-1" />
            Download Template
          </Button>
          <Button size="sm" variant="outline" onClick={onImportCsv} data-testid="button-import-csv">
            <Upload className="h-4 w-4 mr-1" />
            Import CSV
          </Button>
          <Button size="sm" onClick={handleAddNode} data-testid="button-add-table-row">
            <Plus className="h-4 w-4 mr-1" />
            Add Shape
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <MondayTable
          columns={columns}
          data={groups ? [] : filteredRows}
          columnWidthStorageKey="jiganto-bpm-table-col-widths"
          totalCount={rows.length}
          groups={groups}
          onCellEdit={handleCellEdit}
          onDeleteItems={handleDeleteNodes}
          selectable
          renderBulkActions={(selectedIds) => (
            <>
              <Button
                size="sm"
                onClick={() => {
                  const lastId = selectedIds[selectedIds.length - 1];
                  if (lastId) handleInsertNode(String(lastId), "above");
                }}
                data-testid="button-bulk-insert-above"
              >
                <ArrowUp className="h-4 w-4 mr-1" />
                Insert Above
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const lastId = selectedIds[selectedIds.length - 1];
                  if (lastId) handleInsertNode(String(lastId), "below");
                }}
                data-testid="button-bulk-insert-below"
              >
                <ArrowDown className="h-4 w-4 mr-1" />
                Insert Below
              </Button>
            </>
          )}
          renderRowActions={(row: TableRow) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" data-testid={`button-row-actions-${row.id}`}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleInsertNode(row.id, "above")} data-testid={`button-insert-above-${row.id}`}>
                  <ArrowUp className="h-3.5 w-3.5 mr-2" />
                  Insert Above
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleInsertNode(row.id, "below")} data-testid={`button-insert-below-${row.id}`}>
                  <ArrowDown className="h-3.5 w-3.5 mr-2" />
                  Insert Below
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          emptyMessage="No process shapes in this diagram. Add shapes using the canvas or click 'Add Shape' above."
          addItemLabel="Add Shape"
          onAddItem={() => handleAddNode()}
          className="w-full"
        />
      </div>
    </div>
  );
}

export function generateCsvTemplate(nodes: Node[], edges: Edge[]): string {
  const headers = [
    "Process Name",
    "Sequence",
    "Shape Type",
    "Label",
    "Lane",
    "Connected To (Label)",
    "Connection Label",
    "Notes / Description",
    "Owner",
    "Department",
    "System Used",
    "Cost",
    "Duration",
    "Frequency",
    "Resources",
  ];

  const rows = nodesToRows(nodes, edges);

  const csvRows = rows.map(row => {
    const targets = row.connectedTo.split(", ").filter(Boolean);
    const connLabel = targets.map(t => {
      const match = t.match(/\[(.+)\]$/);
      return match ? match[1] : "";
    });
    const connTo = targets.map(t => t.replace(/\s*\[.+\]$/, ""));

    return [
      "",
      row.sequence,
      SHAPE_LABEL_MAP[row.shapeType] || row.shapeType,
      row.label,
      row.lane,
      connTo.join("; "),
      connLabel.join("; "),
      row.notes,
      row.owner,
      row.department,
      row.systemUsed,
      row.cost,
      row.duration,
      row.frequency,
      row.resources,
    ].map(v => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }).join(",");
  });

  return [headers.join(","), ...csvRows].join("\n");
}

export function generateBlankTemplate(): string {
  const headers = [
    "Process Name",
    "Sequence",
    "Shape Type",
    "Label",
    "Lane",
    "Connected To (Next Shape Label)",
    "Connection Label",
    "Notes / Description",
    "Owner",
    "Department",
    "System Used",
    "Cost",
    "Duration",
    "Frequency",
    "Resources",
  ];

  const exampleRows = [
    ["Order to Cash","1","Start","Start","Sales","Receive Order","","Process initiation","","Sales","","","","",""],
    ["Order to Cash","2","Process / Task","Receive Order","Sales","Check Inventory","","Customer places an order","John Smith","Sales","SAP","","2h","Daily","1"],
    ["Order to Cash","3","Decision","Check Inventory","Warehouse","Ship Order; Backorder","Yes; No","Check if stock is available","","Warehouse","SAP","","30m","","1"],
    ["Order to Cash","4","Process / Task","Ship Order","Logistics","End","","Ship to customer address","","Logistics","SAP","50","1d","","2"],
    ["Order to Cash","5","Process / Task","Backorder","Procurement","Ship Order","","Place backorder with supplier","","Procurement","SAP","","3d","","1"],
    ["Order to Cash","6","End","End","Logistics","","","Process complete","","","","","","",""],
  ];

  const csvRows = exampleRows.map(row =>
    row.map(v => {
      if (v.includes(",") || v.includes('"') || v.includes("\n")) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    }).join(",")
  );

  return [headers.join(","), ...csvRows].join("\n");
}

export interface ParsedProcessRow {
  processName: string;
  sequence: number;
  shapeType: string;
  label: string;
  lane: string;
  connectedTo: string[];
  connectionLabels: string[];
  notes: string;
  owner: string;
  department: string;
  systemUsed: string;
  cost: string;
  duration: string;
  frequency: string;
  resources: string;
}

function parseShapeType(input: string): string {
  const normalized = input.trim().toLowerCase();
  const labelToType = new Map<string, string>();
  SHAPE_TYPE_OPTIONS.forEach(o => {
    labelToType.set(o.label.toLowerCase(), o.value);
  });
  if (labelToType.has(normalized)) return labelToType.get(normalized)!;
  const directMatch = SHAPE_TYPE_OPTIONS.find(o => o.value === normalized);
  if (directMatch) return directMatch.value;
  if (normalized.includes("start")) return "start";
  if (normalized.includes("end")) return "end";
  if (normalized.includes("decision") || normalized.includes("gateway")) return "decision";
  if (normalized.includes("sub")) return "subprocess";
  if (normalized.includes("manual") && normalized.includes("process")) return "manual_process";
  if (normalized.includes("auto")) return "automated_process";
  if (normalized.includes("data")) return "data_object";
  if (normalized.includes("document")) return "document";
  if (normalized.includes("database")) return "database";
  if (normalized.includes("system")) return "system";
  return "task";
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCsvContent(csvText: string): Map<string, ParsedProcessRow[]> {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return new Map();

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());

  const getIdx = (patterns: string[]) => {
    for (const p of patterns) {
      const idx = headers.findIndex(h => h.includes(p));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const iProcess = getIdx(["process name", "process"]);
  const iSeq = getIdx(["sequence", "seq", "#", "order"]);
  const iShape = getIdx(["shape type", "shape", "type"]);
  const iLabel = getIdx(["label", "name"]);
  const iLane = getIdx(["lane", "swimlane"]);
  const iConnTo = getIdx(["connected to", "next"]);
  const iConnLabel = getIdx(["connection label", "conn label"]);
  const iNotes = getIdx(["notes", "description"]);
  const iOwner = getIdx(["owner", "responsible"]);
  const iDept = getIdx(["department", "dept"]);
  const iSystem = getIdx(["system", "tool"]);
  const iCost = getIdx(["cost"]);
  const iDuration = getIdx(["duration", "time"]);
  const iFreq = getIdx(["frequency", "freq"]);
  const iRes = getIdx(["resources", "resource", "fte"]);

  const processes = new Map<string, ParsedProcessRow[]>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.every(c => !c)) continue;

    const processName = (iProcess >= 0 ? cols[iProcess] : "") || "Untitled Process";
    const label = (iLabel >= 0 ? cols[iLabel] : "") || "";
    if (!label && !(iShape >= 0 && cols[iShape])) continue;

    const connToRaw = iConnTo >= 0 ? cols[iConnTo] || "" : "";
    const connLabelRaw = iConnLabel >= 0 ? cols[iConnLabel] || "" : "";

    const row: ParsedProcessRow = {
      processName,
      sequence: iSeq >= 0 ? parseInt(cols[iSeq]) || (i) : i,
      shapeType: iShape >= 0 ? parseShapeType(cols[iShape] || "task") : "task",
      label,
      lane: iLane >= 0 ? cols[iLane] || "" : "",
      connectedTo: connToRaw ? connToRaw.split(";").map(s => s.trim()).filter(Boolean) : [],
      connectionLabels: connLabelRaw ? connLabelRaw.split(";").map(s => s.trim()) : [],
      notes: iNotes >= 0 ? cols[iNotes] || "" : "",
      owner: iOwner >= 0 ? cols[iOwner] || "" : "",
      department: iDept >= 0 ? cols[iDept] || "" : "",
      systemUsed: iSystem >= 0 ? cols[iSystem] || "" : "",
      cost: iCost >= 0 ? cols[iCost] || "" : "",
      duration: iDuration >= 0 ? cols[iDuration] || "" : "",
      frequency: iFreq >= 0 ? cols[iFreq] || "" : "",
      resources: iRes >= 0 ? cols[iRes] || "" : "",
    };

    if (!processes.has(processName)) processes.set(processName, []);
    processes.get(processName)!.push(row);
  }

  return processes;
}

export function buildDiagramFromRows(
  processRows: ParsedProcessRow[],
  orientation: "horizontal" | "vertical" = "horizontal"
): { nodes: Node[]; edges: Edge[] } {
  const sorted = [...processRows].sort((a, b) => a.sequence - b.sequence);

  const laneSet = new Set(sorted.map(r => r.lane).filter(Boolean));
  const laneNames = Array.from(laneSet);
  const hasLanes = laneNames.length > 0;

  const LANE_GAP = 20;
  const NODE_GAP_X = 160;
  const NODE_GAP_Y = 120;
  const LANE_PADDING = 60;
  const LANE_HEADER = 40;

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  if (hasLanes) {
    const poolId = `pool_${Date.now()}`;
    const laneIds = new Map<string, string>();

    laneNames.forEach((name, idx) => {
      const laneId = `lane_${Date.now()}_${idx}`;
      laneIds.set(name, laneId);
    });

    const laneNodeCounts = new Map<string, number>();
    sorted.forEach(row => {
      const lane = row.lane || laneNames[0];
      laneNodeCounts.set(lane, (laneNodeCounts.get(lane) || 0) + 1);
    });

    const isHorizontal = orientation === "horizontal";
    let totalPoolWidth = 0;
    let totalPoolHeight = 0;

    if (isHorizontal) {
      const maxNodesInLane = Math.max(...laneNames.map(l => laneNodeCounts.get(l) || 0), 1);
      const laneWidth = LANE_HEADER + LANE_PADDING * 2 + maxNodesInLane * NODE_GAP_X;
      const laneHeight = 180;

      laneNames.forEach((name, idx) => {
        const laneId = laneIds.get(name)!;
        nodes.push({
          id: laneId,
          type: "swimlane_lane",
          position: { x: 0, y: idx * (laneHeight + LANE_GAP) },
          parentId: poolId,
          data: { label: name, orientation, nodeType: "swimlane_lane" },
          style: { width: laneWidth, height: laneHeight },
        });
      });

      totalPoolWidth = laneWidth + 60;
      totalPoolHeight = laneNames.length * (laneHeight + LANE_GAP) + 40;
    } else {
      const maxNodesInLane = Math.max(...laneNames.map(l => laneNodeCounts.get(l) || 0), 1);
      const laneWidth = 250;
      const laneHeight = LANE_HEADER + LANE_PADDING * 2 + maxNodesInLane * NODE_GAP_Y;

      laneNames.forEach((name, idx) => {
        const laneId = laneIds.get(name)!;
        nodes.push({
          id: laneId,
          type: "swimlane_lane",
          position: { x: idx * (laneWidth + LANE_GAP), y: 0 },
          parentId: poolId,
          data: { label: name, orientation, nodeType: "swimlane_lane" },
          style: { width: laneWidth, height: laneHeight },
        });
      });

      totalPoolWidth = laneNames.length * (laneWidth + LANE_GAP) + 60;
      totalPoolHeight = LANE_HEADER + LANE_PADDING * 2 + Math.max(...laneNames.map(l => laneNodeCounts.get(l) || 0), 1) * NODE_GAP_Y + 40;
    }

    nodes.push({
      id: poolId,
      type: "swimlane_pool",
      position: { x: 50, y: 50 },
      data: { label: "Pool", orientation, nodeType: "swimlane_pool" },
      style: { width: totalPoolWidth, height: totalPoolHeight },
    });

    const laneCounters = new Map<string, number>();
    const labelToNodeId = new Map<string, string>();

    sorted.forEach((row, idx) => {
      const shapeType = row.shapeType;
      const defaults = NODE_DEFAULTS[shapeType] || NODE_DEFAULTS["task"];
      const nodeId = `n_${Date.now()}_${idx}`;
      labelToNodeId.set(row.label, nodeId);

      const lane = row.lane || laneNames[0];
      const laneId = laneIds.get(lane) || laneIds.get(laneNames[0])!;
      const laneIdx = laneCounters.get(lane) || 0;
      laneCounters.set(lane, laneIdx + 1);

      let position: { x: number; y: number };
      if (isHorizontal) {
        position = {
          x: LANE_HEADER + LANE_PADDING + laneIdx * NODE_GAP_X,
          y: (180 - defaults.height) / 2,
        };
      } else {
        position = {
          x: (250 - defaults.width) / 2,
          y: LANE_HEADER + LANE_PADDING + laneIdx * NODE_GAP_Y,
        };
      }

      nodes.push({
        id: nodeId,
        type: shapeType,
        position,
        parentId: laneId,
        data: {
          label: row.label,
          nodeType: shapeType,
          attributes: {
            description: row.notes || undefined,
            owner: row.owner || undefined,
            department: row.department || undefined,
            systemUsed: row.systemUsed || undefined,
            cost: row.cost || undefined,
            duration: row.duration || undefined,
            frequency: row.frequency || undefined,
            resources: row.resources || undefined,
          },
          style: {},
        },
        style: { width: defaults.width, height: defaults.height },
      });
    });

    sorted.forEach((row, idx) => {
      const sourceId = labelToNodeId.get(row.label);
      if (!sourceId) return;

      if (row.connectedTo.length > 0) {
        row.connectedTo.forEach((targetLabel, ci) => {
          const targetId = labelToNodeId.get(targetLabel);
          if (targetId) {
            edges.push({
              id: `e_${sourceId}_${targetId}`,
              source: sourceId,
              target: targetId,
              type: "smoothstep",
              label: row.connectionLabels[ci] || undefined,
            });
          }
        });
      } else if (idx < sorted.length - 1) {
        const nextRow = sorted[idx + 1];
        const nextId = labelToNodeId.get(nextRow.label);
        if (nextId) {
          edges.push({
            id: `e_${sourceId}_${nextId}`,
            source: sourceId,
            target: nextId,
            type: "smoothstep",
          });
        }
      }
    });
  } else {
    const labelToNodeId = new Map<string, string>();
    const isHorizontal = orientation === "horizontal";

    sorted.forEach((row, idx) => {
      const shapeType = row.shapeType;
      const defaults = NODE_DEFAULTS[shapeType] || NODE_DEFAULTS["task"];
      const nodeId = `n_${Date.now()}_${idx}`;
      labelToNodeId.set(row.label, nodeId);

      const position = isHorizontal
        ? { x: 100 + idx * NODE_GAP_X, y: 200 }
        : { x: 200, y: 100 + idx * NODE_GAP_Y };

      nodes.push({
        id: nodeId,
        type: shapeType,
        position,
        data: {
          label: row.label,
          nodeType: shapeType,
          attributes: {
            description: row.notes || undefined,
            owner: row.owner || undefined,
            department: row.department || undefined,
            systemUsed: row.systemUsed || undefined,
            cost: row.cost || undefined,
            duration: row.duration || undefined,
            frequency: row.frequency || undefined,
            resources: row.resources || undefined,
          },
          style: {},
        },
        style: { width: defaults.width, height: defaults.height },
      });
    });

    sorted.forEach((row, idx) => {
      const sourceId = labelToNodeId.get(row.label);
      if (!sourceId) return;

      if (row.connectedTo.length > 0) {
        row.connectedTo.forEach((targetLabel, ci) => {
          const targetId = labelToNodeId.get(targetLabel);
          if (targetId) {
            edges.push({
              id: `e_${sourceId}_${targetId}`,
              source: sourceId,
              target: targetId,
              type: "smoothstep",
              label: row.connectionLabels[ci] || undefined,
            });
          }
        });
      } else if (idx < sorted.length - 1) {
        const nextRow = sorted[idx + 1];
        const nextId = labelToNodeId.get(nextRow.label);
        if (nextId) {
          edges.push({
            id: `e_${sourceId}_${nextId}`,
            source: sourceId,
            target: nextId,
            type: "smoothstep",
          });
        }
      }
    });
  }

  return { nodes, edges };
}
