import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { bpmFetchFormData } from "@/lib/bpm-api";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  reconnectEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type OnConnect,
  type OnSelectionChangeFunc,
  ReactFlowProvider,
  useReactFlow,
  BackgroundVariant,
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { nodeTypes, NODE_DEFAULTS, BpmAttrVisibilityProvider, NodeUpdateProvider, SequenceNumberProvider, DiagramNavigateProvider, type PointerPosition } from "@/components/bpm/BpmNodeTypes";
import BpmTableView, { generateCsvTemplate, generateBlankTemplate, parseCsvContent, buildDiagramFromRows, nodesToRows, type ParsedProcessRow } from "@/components/bpm/BpmTableView";
import { BpmProcessReportDialog } from "@/components/bpm/BpmProcessReportDialog";
import { BpmStepLinksPanel } from "@/components/bpm/BpmStepLinksPanel";
import { autoLayoutNodes } from "@/lib/bpm-utils";
import {
  ArrowLeft,
  Save,
  Loader2,
  Trash2,
  DollarSign,
  Clock,
  RefreshCw,
  Users,
  BookOpen,
  Square,
  Diamond,
  Circle,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  FileJson,
  Layers,
  X,
  Eye,
  PenTool,
  Cog,
  Cloud,
  RotateCcw,
  MessageSquare,
  Database,
  AlignHorizontalDistributeCenter,
  Type,
  Undo2,
  Redo2,
  Image,
  Bookmark,
  Timer,
  Monitor,
  Hexagon,
  Copy,
  HardDrive,
  ArrowUpFromLine,
  ArrowDownToLine,
  ArrowUpDown,
  Scissors,
  Cylinder,
  ExternalLink,
  StopCircle,
  Pipette,
  Check,
  Plus,
  ArrowRight,
  Table2,
  LayoutDashboard,
  Download,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Hash,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  Clipboard,
  ClipboardPaste,
  ClipboardCopy,
  FileDown,
  Link2,
  Globe,
  Router,
  Network,
  Laptop,
  Tablet,
  Smartphone,
  TerminalSquare,
  Building,
  Shield,
  Server,
  Wifi,
  Printer,
  ScanLine,
  MonitorDot,
  RectangleHorizontal,
  CircleDot,
  Triangle,
  Minus,
  MoreHorizontal,
  MoveVertical,
  Type as TypeIcon,
  ArrowBigRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FormDialogShell,
  FormDialogViewShell,
  FormSection,
  FieldGrid,
  FieldLabel,
  FormDivider,
} from "@/components/ui/form-dialog-shell";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type BpmDiagram = {
  id: number;
  tenantId: number;
  libraryId: number | null;
  name: string;
  description: string | null;
  type: string;
  status: string;
  version: number;
  ownerId: string | null;
  canvasData: any;
  metadata: any;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
};

const BPM_DEFAULTS_KEY = "bpm_user_defaults";
const BPM_LANE_ORIENTATION_KEY = "bpm_last_lane_orientation";

interface BpmUserDefaults {
  fontSize: number;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  defaultEdgeType: string;
}

const INITIAL_DEFAULTS: BpmUserDefaults = {
  fontSize: 12,
  backgroundColor: "",
  borderColor: "",
  textColor: "",
  defaultEdgeType: "smoothstep",
};

function loadUserDefaults(): BpmUserDefaults {
  try {
    const stored = localStorage.getItem(BPM_DEFAULTS_KEY);
    if (stored) return { ...INITIAL_DEFAULTS, ...JSON.parse(stored) };
  } catch {}
  return { ...INITIAL_DEFAULTS };
}

function saveUserDefaults(defaults: BpmUserDefaults) {
  localStorage.setItem(BPM_DEFAULTS_KEY, JSON.stringify(defaults));
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-status-amber/20 text-status-amber-foreground",
  review: "bg-status-blue/20 text-status-blue-foreground",
  "first_review": "bg-status-blue/20 text-status-blue-foreground",
  "second_review": "bg-status-blue/20 text-status-blue-foreground",
  "awaiting_approval": "bg-status-purple/20 text-status-purple-foreground",
  approved: "bg-status-green/20 text-status-green-foreground",
  published: "bg-status-purple/20 text-status-purple-foreground",
  final: "bg-status-green/20 text-status-green-foreground",
};

const DEFAULT_WORKFLOW_STEPS = ["draft", "review", "approved", "final"];

const WORKFLOW_PRESETS: { label: string; steps: string[] }[] = [
  { label: "Simple (Draft \u2192 Final)", steps: ["draft", "final"] },
  { label: "Standard (Draft \u2192 Review \u2192 Final)", steps: ["draft", "review", "final"] },
  { label: "Approval (Draft \u2192 Review \u2192 Awaiting Approval \u2192 Final)", steps: ["draft", "review", "awaiting_approval", "final"] },
  { label: "Full (Draft \u2192 First Review \u2192 Second Review \u2192 Awaiting Approval \u2192 Final)", steps: ["draft", "first_review", "second_review", "awaiting_approval", "final"] },
];

function formatStepLabel(step: string): string {
  return step.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const SHAPE_PALETTE = [
  { type: "start", label: "Start", icon: Circle, category: "events" },
  { type: "end", label: "End", icon: Circle, category: "events" },
  { type: "task", label: "Process / Task", icon: Square, category: "activities" },
  { type: "subprocess", label: "Sub-Process", icon: Square, category: "activities" },
  { type: "manual_process", label: "Manual Process", icon: PenTool, category: "activities" },
  { type: "automated_process", label: "Automated Process", icon: Cog, category: "activities" },
  { type: "loop", label: "Loop / Iteration", icon: RotateCcw, category: "activities" },
  { type: "decision", label: "Decision", icon: Diamond, category: "gateways" },
  { type: "gateway_parallel", label: "Parallel Gateway", icon: Diamond, category: "gateways" },
  { type: "gateway_exclusive", label: "Exclusive Gateway", icon: Diamond, category: "gateways" },
  { type: "data_object", label: "Data / Document", icon: FileText, category: "data" },
  { type: "document", label: "Document", icon: FileText, category: "data" },
  { type: "database", label: "Database", icon: Database, category: "data" },
  { type: "manual_input", label: "Manual Input", icon: Type, category: "data" },
  { type: "system", label: "System", icon: Settings, category: "systems" },
  { type: "cloud_system", label: "External / Cloud", icon: Cloud, category: "systems" },
  { type: "annotation", label: "Annotation", icon: MessageSquare, category: "systems" },
  { type: "callout_square", label: "Square Callout", icon: MessageSquare, category: "callouts" },
  { type: "callout_rounded", label: "Rounded Callout", icon: MessageSquare, category: "callouts" },
  { type: "callout_oval", label: "Oval Callout", icon: MessageSquare, category: "callouts" },
  { type: "callout_cloud", label: "Cloud / Thought", icon: Cloud, category: "callouts" },
  { type: "note_folded", label: "Note (Folded)", icon: FileText, category: "callouts" },
  { type: "note_lined", label: "Note (Lined)", icon: FileText, category: "callouts" },
  { type: "delay", label: "Delay", icon: Timer, category: "flowchart" },
  { type: "display", label: "Display", icon: Monitor, category: "flowchart" },
  { type: "predefined_process", label: "Predefined Process", icon: Square, category: "flowchart" },
  { type: "multi_document", label: "Multi-Document", icon: Copy, category: "flowchart" },
  { type: "internal_storage", label: "Internal Storage", icon: HardDrive, category: "flowchart" },
  { type: "stored_data", label: "Stored Data", icon: Cylinder, category: "flowchart" },
  { type: "extract", label: "Extract", icon: ArrowUpFromLine, category: "flowchart" },
  { type: "merge", label: "Merge", icon: ArrowDownToLine, category: "flowchart" },
  { type: "sort", label: "Sort", icon: ArrowUpDown, category: "flowchart" },
  { type: "collate", label: "Collate", icon: Scissors, category: "flowchart" },
  { type: "off_page_ref", label: "Off-Page Ref", icon: ExternalLink, category: "flowchart" },
  { type: "terminator", label: "Terminator", icon: StopCircle, category: "flowchart" },
  { type: "preparation", label: "Preparation", icon: Hexagon, category: "flowchart" },
  { type: "swimlane_pool", label: "Pool", icon: AlignHorizontalDistributeCenter, category: "swimlanes" },
  { type: "swimlane_lane", label: "Lane", icon: Layers, category: "swimlanes" },
  { type: "infra_router", label: "Router", icon: Router, category: "infrastructure" },
  { type: "infra_workstation", label: "Workstation", icon: Monitor, category: "infrastructure" },
  { type: "infra_ethernet_switch", label: "Ethernet Switch", icon: Network, category: "infrastructure" },
  { type: "infra_computer", label: "Computer", icon: Monitor, category: "infrastructure" },
  { type: "infra_laptop", label: "Laptop", icon: Laptop, category: "infrastructure" },
  { type: "infra_mobile_device", label: "Mobile Device", icon: Tablet, category: "infrastructure" },
  { type: "infra_smartphone", label: "Smart Phone", icon: Smartphone, category: "infrastructure" },
  { type: "infra_terminal", label: "Terminal", icon: TerminalSquare, category: "infrastructure" },
  { type: "infra_isp", label: "ISP", icon: Building, category: "infrastructure" },
  { type: "infra_switch", label: "Switch", icon: Network, category: "infrastructure" },
  { type: "infra_firewall", label: "Firewall", icon: Shield, category: "infrastructure" },
  { type: "infra_server", label: "Server", icon: Server, category: "infrastructure" },
  { type: "infra_wireless_ap", label: "Wireless Access Point", icon: Wifi, category: "infrastructure" },
  { type: "infra_internet", label: "The Internet", icon: Globe, category: "infrastructure" },
  { type: "infra_cloud", label: "The Cloud", icon: Cloud, category: "infrastructure" },
  { type: "infra_printer", label: "Printer", icon: Printer, category: "infrastructure" },
  { type: "infra_scanner", label: "Scanner", icon: ScanLine, category: "infrastructure" },
  { type: "infra_desktop_pc", label: "Desktop PC", icon: MonitorDot, category: "infrastructure" },
  { type: "basic_rectangle", label: "Rectangle", icon: Square, category: "basic_shapes" },
  { type: "basic_rounded_rect", label: "Rounded Rectangle", icon: RectangleHorizontal, category: "basic_shapes" },
  { type: "basic_circle", label: "Circle", icon: Circle, category: "basic_shapes" },
  { type: "basic_oval", label: "Oval / Ellipse", icon: CircleDot, category: "basic_shapes" },
  { type: "basic_triangle", label: "Triangle", icon: Triangle, category: "basic_shapes" },
  { type: "basic_arrow", label: "Arrow", icon: ArrowBigRight, category: "basic_shapes" },
  { type: "basic_text_label", label: "Text Label", icon: TypeIcon, category: "basic_shapes" },
  { type: "line_horizontal", label: "Horizontal Line", icon: Minus, category: "basic_shapes" },
  { type: "line_horizontal_dashed", label: "Horizontal Dashed", icon: MoreHorizontal, category: "basic_shapes" },
  { type: "line_vertical", label: "Vertical Line", icon: MoveVertical, category: "basic_shapes" },
  { type: "line_vertical_dashed", label: "Vertical Dashed", icon: MoveVertical, category: "basic_shapes" },
];

function ShapePalette({ onDragStart }: { onDragStart: (type: string) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    events: true, activities: false, gateways: false, data: false, systems: false, callouts: false, flowchart: false, swimlanes: true, infrastructure: false, basic_shapes: false,
  });

  const categories = [
    { key: "swimlanes", label: "Swimlanes" },
    { key: "events", label: "Events" },
    { key: "basic_shapes", label: "Basic Shapes & Lines" },
    { key: "infrastructure", label: "Network & Infrastructure" },
    { key: "activities", label: "Activities" },
    { key: "gateways", label: "Gateways" },
    { key: "data", label: "Data & Documents" },
    { key: "systems", label: "Systems & Notes" },
    { key: "flowchart", label: "Additional Shapes" },
    { key: "callouts", label: "Callouts" },
  ];

  return (
    <div className="w-[200px] border-r bg-card flex flex-col h-full">
      <div className="p-3 border-b">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shapes</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {categories.map(cat => {
            const shapes = SHAPE_PALETTE.filter(s => s.category === cat.key);
            const isExpanded = expanded[cat.key] !== false;
            return (
              <div key={cat.key} className="mb-2">
                <button
                  className="flex items-center gap-1 w-full px-2 py-1 text-xs font-medium text-muted-foreground hover-elevate rounded"
                  onClick={() => setExpanded(prev => ({ ...prev, [cat.key]: !isExpanded }))}
                  data-testid={`button-toggle-${cat.key}`}
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {cat.label}
                </button>
                {isExpanded && (
                  <div className="mt-1 space-y-0.5">
                    {shapes.map(shape => (
                      <div
                        key={shape.type}
                        className="flex items-center gap-2 px-3 py-1.5 rounded text-sm cursor-grab hover-elevate"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/bpm-node-type", shape.type);
                          e.dataTransfer.effectAllowed = "move";
                          onDragStart(shape.type);
                        }}
                        data-testid={`shape-${shape.type}`}
                      >
                        <shape.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground truncate text-xs">{shape.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

type NodeAttributes = {
  cost?: number;
  duration?: number;
  frequency?: number;
  resources?: number;
  learning?: number;
  description?: string;
  owner?: string;
  department?: string;
  status?: string;
  sla?: string;
  systemUsed?: string;
  riskRating?: string;
  automationPercent?: number;
  dataObject?: string;
  systemName?: string;
  linkedDiagramId?: number;
  linkedDiagramName?: string;
};

const COLOR_PALETTE = {
  brand: [
    { label: "Jiganto Blue", value: "#1E88C8" },
    { label: "Green", value: "#22C55E" },
    { label: "Purple", value: "#7C3AED" },
    { label: "Orange", value: "#F59E0B" },
    { label: "Pink", value: "#EC4899" },
    { label: "Red", value: "#EF4444" },
    { label: "Indigo", value: "#6366F1" },
  ],
  neutral: [
    { label: "White", value: "#FFFFFF" },
    { label: "Light Gray", value: "#F3F4F6" },
    { label: "Gray", value: "#9CA3AF" },
    { label: "Dark Gray", value: "#4B5563" },
    { label: "Charcoal", value: "#1F2937" },
    { label: "Black", value: "#000000" },
  ],
  pastel: [
    { label: "Light Blue", value: "#DBEAFE" },
    { label: "Light Green", value: "#DCFCE7" },
    { label: "Light Yellow", value: "#FEF9C3" },
    { label: "Light Orange", value: "#FFEDD5" },
    { label: "Light Pink", value: "#FCE7F3" },
    { label: "Light Purple", value: "#EDE9FE" },
    { label: "Light Teal", value: "#CCFBF1" },
  ],
};

function ColorPalettePicker({
  value,
  onChange,
  label,
  defaultColor,
  testId,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
  defaultColor: string;
  testId: string;
}) {
  const currentColor = value || defaultColor;
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-2 w-full h-7 px-2 rounded-md border text-xs cursor-pointer hover-elevate"
            data-testid={testId}
          >
            <div
              className="h-4 w-4 rounded border shrink-0"
              style={{ backgroundColor: currentColor }}
            />
            <span className="flex-1 text-left text-muted-foreground truncate">{currentColor}</span>
            <Pipette className="h-3 w-3 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-3" align="start">
          <div className="space-y-3">
            <div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Brand</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {COLOR_PALETTE.brand.map((c) => (
                  <button
                    key={c.value}
                    className="h-6 w-6 rounded border cursor-pointer relative"
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                    onClick={() => onChange(c.value)}
                    data-testid={`swatch-${testId}-${c.label.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    {currentColor.toLowerCase() === c.value.toLowerCase() && (
                      <Check className="h-3 w-3 absolute inset-0 m-auto text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Neutrals</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {COLOR_PALETTE.neutral.map((c) => (
                  <button
                    key={c.value}
                    className="h-6 w-6 rounded border cursor-pointer relative"
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                    onClick={() => onChange(c.value)}
                    data-testid={`swatch-${testId}-${c.label.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    {currentColor.toLowerCase() === c.value.toLowerCase() && (
                      <Check className="h-3 w-3 absolute inset-0 m-auto drop-shadow" style={{ color: c.value === '#000000' || c.value === '#1F2937' || c.value === '#4B5563' ? 'white' : '#111827' }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Pastels</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {COLOR_PALETTE.pastel.map((c) => (
                  <button
                    key={c.value}
                    className="h-6 w-6 rounded border cursor-pointer relative"
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                    onClick={() => onChange(c.value)}
                    data-testid={`swatch-${testId}-${c.label.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    {currentColor.toLowerCase() === c.value.toLowerCase() && (
                      <Check className="h-3 w-3 absolute inset-0 m-auto text-gray-700 drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <Separator />
            <div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Custom</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => onChange(e.target.value)}
                  className="h-7 w-7 rounded border cursor-pointer"
                  data-testid={`custom-${testId}`}
                />
                <Input
                  value={value || ""}
                  onChange={(e) => onChange(e.target.value)}
                  className="h-7 text-xs flex-1"
                  placeholder={defaultColor}
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function findContainerAtPosition(
  allNodes: Node[],
  absPosition: { x: number; y: number },
  nodeWidth: number,
  nodeHeight: number,
  excludeId?: string,
  filterType?: string,
): Node | null {
  const candidates = allNodes.filter(n => {
    if (n.id === excludeId) return false;
    if (n.type !== 'swimlane_pool' && n.type !== 'swimlane_lane') return false;
    if (filterType && n.type !== filterType) return false;
    const nw = (n.style?.width as number) || (n.measured?.width) || 800;
    const nh = (n.style?.height as number) || (n.measured?.height) || 400;
    const cx = nodeWidth / 2;
    const cy = nodeHeight / 2;
    const absN = getAbsolutePosition(n, allNodes);
    return (
      absPosition.x + cx > absN.x &&
      absPosition.x + cx < absN.x + nw &&
      absPosition.y + cy > absN.y &&
      absPosition.y + cy < absN.y + nh
    );
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const aArea = ((a.style?.width as number) || 800) * ((a.style?.height as number) || 400);
    const bArea = ((b.style?.width as number) || 800) * ((b.style?.height as number) || 400);
    return aArea - bArea;
  });
  return candidates[0];
}

function isDescendantOf(nodeId: string, ancestorId: string, allNodes: Node[]): boolean {
  let current = allNodes.find(n => n.id === nodeId);
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    current = allNodes.find(n => n.id === current!.parentId);
  }
  return false;
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

function LinkedDiagramSelector({
  attrs,
  diagramId,
  libraryId,
  onUpdateAttributes,
}: {
  attrs: NodeAttributes;
  diagramId: number;
  libraryId?: number | null;
  onUpdateAttributes: (updates: Record<string, any>) => void;
}) {
  const { data: diagrams = [] } = useQuery<BpmDiagram[]>({
    queryKey: ["/api/bpm/diagrams"],
  });

  const availableDiagrams = diagrams.filter((d) => {
    if (d.id === diagramId) return false;
    if (libraryId && d.libraryId !== libraryId) return false;
    return true;
  });

  const handleSelect = (val: string) => {
    const selectedId = Number(val);
    const selected = availableDiagrams.find((d) => d.id === selectedId);
    if (selected) {
      onUpdateAttributes({ linkedDiagramId: selected.id, linkedDiagramName: selected.name });
    }
  };

  const handleClear = () => {
    onUpdateAttributes({ linkedDiagramId: undefined, linkedDiagramName: undefined });
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
        <Label className="text-xs text-muted-foreground">Linked Diagram</Label>
      </div>
      <Select
        value={attrs.linkedDiagramId ? String(attrs.linkedDiagramId) : ""}
        onValueChange={handleSelect}
      >
        <SelectTrigger className="h-7 text-xs" data-testid="select-linked-diagram">
          <SelectValue placeholder="Select diagram..." />
        </SelectTrigger>
        <SelectContent>
          {availableDiagrams.map((d) => (
            <SelectItem key={d.id} value={String(d.id)}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {attrs.linkedDiagramId && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-1 text-xs text-muted-foreground"
          onClick={handleClear}
          data-testid="button-clear-diagram-link"
        >
          <X className="h-3 w-3 mr-1" />
          Clear link
        </Button>
      )}
    </div>
  );
}

function PropertiesPanel({
  selectedNode,
  selectedNodes,
  selectedEdge,
  onUpdateNode,
  onUpdateMultipleNodes,
  onUpdateEdge,
  onUpdateAllEdges,
  onBringToFront,
  onSendToBack,
  onClose,
  diagramId,
  libraryId,
}: {
  selectedNode: Node | null;
  selectedNodes: Node[];
  selectedEdge: Edge | null;
  onUpdateNode: (nodeId: string, data: any) => void;
  onUpdateMultipleNodes: (nodeIds: string[], styleUpdates: Record<string, string | number | undefined>) => void;
  onUpdateEdge: (edgeId: string, updates: Partial<Edge>) => void;
  onUpdateAllEdges: (styleUpdates: { stroke?: string; strokeWidth?: number; type?: string }) => void;
  onBringToFront: (nodeId: string) => void;
  onSendToBack: (nodeId: string) => void;
  onClose: () => void;
  diagramId: number;
  libraryId?: number | null;
}) {
  const { toast } = useToast();
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['image']));
  const isMultiSelect = selectedNodes.length > 1;

  if (selectedEdge) {
    const edgeStyle = (selectedEdge.style || {}) as Record<string, any>;
    const edgeColor = edgeStyle.stroke || "hsl(var(--muted-foreground))";
    const edgeType = selectedEdge.type || "smoothstep";
    const strokeWidth = edgeStyle.strokeWidth || 1.5;

    return (
      <div className="w-[280px] border-l bg-card flex flex-col h-full">
        <div className="p-3 border-b flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Edge Properties</h3>
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-properties">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Edge Label</Label>
              <Input
                value={selectedEdge.label as string || ""}
                onChange={(e) => onUpdateEdge(selectedEdge.id, { label: e.target.value || undefined })}
                className="h-7 text-xs"
                placeholder="Optional label..."
                data-testid="input-edge-label"
              />
            </div>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground">Line Type</Label>
              <Select
                value={edgeType}
                onValueChange={(v) => onUpdateEdge(selectedEdge.id, { type: v })}
              >
                <SelectTrigger className="h-7 text-xs" data-testid="select-edge-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="straight">Straight</SelectItem>
                  <SelectItem value="smoothstep">Orthogonal (Default)</SelectItem>
                  <SelectItem value="default">Curved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Stroke Width</Label>
              <Select
                value={String(strokeWidth)}
                onValueChange={(v) => onUpdateEdge(selectedEdge.id, { style: { stroke: edgeColor, strokeWidth: Number(v) } })}
              >
                <SelectTrigger className="h-7 text-xs" data-testid="select-edge-width">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Thin (1px)</SelectItem>
                  <SelectItem value="1.5">Normal (1.5px)</SelectItem>
                  <SelectItem value="2">Medium (2px)</SelectItem>
                  <SelectItem value="3">Thick (3px)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Arrow Colour</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {[
                  { label: "Default", color: "hsl(var(--muted-foreground))" },
                  { label: "Blue", color: "#1E88C8" },
                  { label: "Green", color: "#22C55E" },
                  { label: "Red", color: "#EF4444" },
                  { label: "Orange", color: "#F59E0B" },
                  { label: "Purple", color: "#7C3AED" },
                  { label: "Pink", color: "#EC4899" },
                  { label: "Black", color: "#111827" },
                ].map(c => (
                  <button
                    key={c.label}
                    className={cn("w-6 h-6 rounded-md border-2 transition-all", edgeColor === c.color ? "border-primary ring-1 ring-primary" : "border-transparent")}
                    style={{ backgroundColor: c.color }}
                    onClick={() => onUpdateEdge(selectedEdge.id, { style: { stroke: c.color, strokeWidth }, markerEnd: { type: "arrowclosed" as any, color: c.color } })}
                    title={c.label}
                    aria-label={`Set edge colour to ${c.label}`}
                    data-testid={`button-edge-color-${c.label.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2">Bulk Actions</h4>
              <p className="text-xs text-muted-foreground mb-2">Apply to all arrows</p>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => onUpdateAllEdges({ type: "straight" })} data-testid="button-all-edges-straight">
                  Make All Straight
                </Button>
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => onUpdateAllEdges({ type: "smoothstep" })} data-testid="button-all-edges-orthogonal">
                  Make All Orthogonal
                </Button>
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => onUpdateAllEdges({ stroke: edgeColor })} data-testid="button-all-edges-color">
                  Apply This Colour to All
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (!selectedNode && !isMultiSelect) {
    return (
      <div className="w-[280px] border-l bg-card flex flex-col h-full">
        <div className="p-3 border-b">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Properties</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">Select a node or arrow to view its properties</p>
        </div>
      </div>
    );
  }

  if (isMultiSelect) {
    const multiIds = selectedNodes.map(n => n.id);
    const updateMultiStyle = (key: string, value: string | number) => {
      const finalValue = key === 'fontSize' ? (value ? Number(value) : undefined) : value;
      onUpdateMultipleNodes(multiIds, { [key]: finalValue });
    };

    return (
      <div className="w-[280px] border-l bg-card flex flex-col h-full">
        <div className="p-3 border-b flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Properties</h3>
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-properties">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground" data-testid="text-multi-select-count">
                {selectedNodes.length} nodes selected
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Changes below will apply to all selected nodes.
            </p>

            <Separator />

            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2">Appearance</h4>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Font Size</Label>
                  <Select
                    value=""
                    onValueChange={(v) => updateMultiStyle("fontSize", v)}
                  >
                    <SelectTrigger className="h-7 text-xs" data-testid="select-multi-font-size">
                      <SelectValue placeholder="Set for all..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8">8px (Default)</SelectItem>
                      <SelectItem value="10">10px</SelectItem>
                      <SelectItem value="12">12px</SelectItem>
                      <SelectItem value="14">14px</SelectItem>
                      <SelectItem value="16">16px</SelectItem>
                      <SelectItem value="18">18px</SelectItem>
                      <SelectItem value="20">20px</SelectItem>
                      <SelectItem value="24">24px</SelectItem>
                      <SelectItem value="28">28px</SelectItem>
                      <SelectItem value="32">32px</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <ColorPalettePicker
                  value=""
                  onChange={(c) => updateMultiStyle("backgroundColor", c)}
                  label="Background"
                  defaultColor="#ffffff"
                  testId="input-multi-bgcolor"
                />
                <ColorPalettePicker
                  value=""
                  onChange={(c) => updateMultiStyle("borderColor", c)}
                  label="Border"
                  defaultColor="#cccccc"
                  testId="input-multi-bordercolor"
                />
                <ColorPalettePicker
                  value=""
                  onChange={(c) => updateMultiStyle("textColor", c)}
                  label="Text Colour"
                  defaultColor="#000000"
                  testId="input-multi-textcolor"
                />
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  const singleNode = selectedNode!;
  const attrs: NodeAttributes = (singleNode.data?.attributes as NodeAttributes) || {};
  const nodeStyle: Record<string, string> = (singleNode.data?.style as Record<string, string>) || {};
  const nodeType = singleNode.type || '';
  const isSwimlane = nodeType === 'swimlane_pool' || nodeType === 'swimlane_lane';
  const isProcessType = ['task', 'subprocess', 'manual_process', 'automated_process', 'loop'].includes(nodeType);

  const updateAttribute = (key: string, value: any) => {
    const newAttrs = { ...attrs, [key]: value };
    onUpdateNode(singleNode.id, { ...singleNode.data, attributes: newAttrs });
  };

  const updateAttributes = (updates: Record<string, any>) => {
    const newAttrs = { ...attrs, ...updates };
    onUpdateNode(singleNode.id, { ...singleNode.data, attributes: newAttrs });
  };

  const updateLabel = (label: string) => {
    onUpdateNode(singleNode.id, { ...singleNode.data, label });
  };

  const updateStyle = (key: string, value: string | number) => {
    const finalValue = key === 'fontSize' ? (value ? Number(value) : undefined) : value;
    onUpdateNode(singleNode.id, { ...singleNode.data, style: { ...nodeStyle, [key]: finalValue } });
  };

  const updateOrientation = (orientation: string) => {
    onUpdateNode(singleNode.id, { ...singleNode.data, orientation });
    try { localStorage.setItem(BPM_LANE_ORIENTATION_KEY, orientation); } catch {}
  };

  const updateImageUrl = (imageUrl: string) => {
    onUpdateNode(singleNode.id, { ...singleNode.data, imageUrl: imageUrl || undefined });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be under 5MB", variant: "destructive" });
      return;
    }
    const formData = new FormData();
    formData.append('image', file);
    try {
      const data = await bpmFetchFormData<{ url: string }>('/api/bpm/upload-image', formData);
      updateImageUrl(data.url);
      toast({ title: "Image uploaded", description: "Logo/image has been added to the node" });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload image", variant: "destructive" });
      updateImageUrl('');
    }
  };

  return (
    <div className="w-[280px] border-l bg-card flex flex-col h-full">
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Properties</h3>
        <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-properties">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              value={(singleNode.data?.label as string) || ""}
              onChange={(e) => updateLabel(e.target.value)}
              className="h-7 text-xs"
              data-testid="input-node-name"
            />
          </div>

          {nodeType === 'off_page_ref' && (
            <LinkedDiagramSelector
              attrs={attrs}
              diagramId={diagramId}
              libraryId={libraryId}
              onUpdateAttributes={updateAttributes}
            />
          )}

          {nodeType === 'annotation' && (
            <div>
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Textarea
                value={attrs.description || ""}
                onChange={(e) => updateAttribute("description", e.target.value)}
                className="text-xs min-h-[80px] resize-y"
                placeholder="Add notes to this annotation..."
                data-testid="input-annotation-notes"
              />
            </div>
          )}

          {['callout_square', 'callout_rounded', 'callout_oval', 'callout_cloud'].includes(nodeType) && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Pointer Direction</Label>
                <Select
                  value={(singleNode.data?.pointerPosition as string) || 'bottom-left'}
                  onValueChange={(v) => onUpdateNode(singleNode.id, { ...singleNode.data, pointerPosition: v as PointerPosition })}
                >
                  <SelectTrigger className="h-7 text-xs" data-testid="select-pointer-direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="bottom-center">Bottom Center</SelectItem>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                    <SelectItem value="top-left">Top Left</SelectItem>
                    <SelectItem value="top-center">Top Center</SelectItem>
                    <SelectItem value="top-right">Top Right</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Text Alignment</Label>
                <div className="flex gap-1">
                  {[
                    { value: 'left', icon: AlignLeft, label: 'Left' },
                    { value: 'center', icon: AlignCenter, label: 'Center' },
                    { value: 'right', icon: AlignRight, label: 'Right' },
                  ].map(({ value, icon: Icon, label }) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={((singleNode.data as any)?.style?.textAlign || 'center') === value ? 'default' : 'outline'}
                      onClick={() => {
                        const d = singleNode.data as any;
                        onUpdateNode(singleNode.id, {
                          ...d,
                          style: { ...(d?.style || {}), textAlign: value },
                        });
                      }}
                      title={label}
                      data-testid={`button-text-align-${value}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea
                  value={attrs.description || ""}
                  onChange={(e) => updateAttribute("description", e.target.value)}
                  className="text-xs min-h-[60px] resize-y"
                  placeholder="Add notes to this callout..."
                  data-testid="input-callout-notes"
                />
              </div>
            </>
          )}

          {isSwimlane && (
            <div>
              <Label className="text-xs text-muted-foreground">Orientation</Label>
              <Select
                value={(singleNode.data?.orientation as string) || 'horizontal'}
                onValueChange={updateOrientation}
              >
                <SelectTrigger className="h-7 text-xs" data-testid="select-orientation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal">Horizontal</SelectItem>
                  <SelectItem value="vertical">Vertical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {!isSwimlane && (
            <>
              <Separator />
              <div>
                <button
                  className="flex items-center gap-1 w-full text-left mb-2 cursor-pointer"
                  onClick={() => setCollapsedSections(prev => {
                    const next = new Set(prev);
                    if (next.has('attributes')) next.delete('attributes');
                    else next.add('attributes');
                    return next;
                  })}
                  data-testid="button-toggle-section-attributes"
                >
                  {collapsedSections.has('attributes') ? (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <h4 className="text-xs font-semibold text-foreground">Custom Attributes</h4>
                </button>
                {!collapsedSections.has('attributes') && (
                  <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-brand-green" />
                      <span className="text-xs text-muted-foreground">Cost</span>
                    </div>
                    <Input type="number" value={attrs.cost ?? ""} onChange={(e) => updateAttribute("cost", e.target.value ? Number(e.target.value) : undefined)} className="w-20 h-7 text-xs text-right" placeholder="0" data-testid="input-attr-cost" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-brand-blue" />
                      <span className="text-xs text-muted-foreground">Duration</span>
                    </div>
                    <Input type="number" value={attrs.duration ?? ""} onChange={(e) => updateAttribute("duration", e.target.value ? Number(e.target.value) : undefined)} className="w-20 h-7 text-xs text-right" placeholder="h" data-testid="input-attr-duration" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5 text-brand-orange" />
                      <span className="text-xs text-muted-foreground">Frequency</span>
                    </div>
                    <Input type="number" value={attrs.frequency ?? ""} onChange={(e) => updateAttribute("frequency", e.target.value ? Number(e.target.value) : undefined)} className="w-20 h-7 text-xs text-right" placeholder="0" data-testid="input-attr-frequency" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-brand-purple" />
                      <span className="text-xs text-muted-foreground">Resources</span>
                    </div>
                    <Input type="number" value={attrs.resources ?? ""} onChange={(e) => updateAttribute("resources", e.target.value ? Number(e.target.value) : undefined)} className="w-20 h-7 text-xs text-right" placeholder="0" data-testid="input-attr-resources" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-brand-pink" />
                      <span className="text-xs text-muted-foreground">Learning</span>
                    </div>
                    <Input type="number" value={attrs.learning ?? ""} onChange={(e) => updateAttribute("learning", e.target.value ? Number(e.target.value) : undefined)} className="w-20 h-7 text-xs text-right" placeholder="0" data-testid="input-attr-learning" />
                  </div>

                  {(nodeType === 'automated_process' || isProcessType) && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Automation %</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Slider
                          value={[attrs.automationPercent ?? 0]}
                          onValueChange={([v]) => updateAttribute("automationPercent", v)}
                          max={100}
                          step={5}
                          className="flex-1"
                          data-testid="slider-automation"
                        />
                        <span className="text-xs text-muted-foreground w-8 text-right">{attrs.automationPercent ?? 0}%</span>
                      </div>
                    </div>
                  )}
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          <div>
            <button
              className="flex items-center gap-1 w-full text-left mb-2 cursor-pointer"
              onClick={() => setCollapsedSections(prev => {
                const next = new Set(prev);
                if (next.has('appearance')) next.delete('appearance');
                else next.add('appearance');
                return next;
              })}
              data-testid="button-toggle-section-appearance"
            >
              {collapsedSections.has('appearance') ? (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <h4 className="text-xs font-semibold text-foreground">Appearance</h4>
            </button>
            {!collapsedSections.has('appearance') && (
              <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Font Size</Label>
                <Select
                  value={String(nodeStyle.fontSize || '')}
                  onValueChange={(v) => updateStyle("fontSize", v)}
                >
                  <SelectTrigger className="h-7 text-xs" data-testid="select-font-size">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8">8px (Default)</SelectItem>
                    <SelectItem value="10">10px</SelectItem>
                    <SelectItem value="12">12px</SelectItem>
                    <SelectItem value="14">14px</SelectItem>
                    <SelectItem value="16">16px</SelectItem>
                    <SelectItem value="18">18px</SelectItem>
                    <SelectItem value="20">20px</SelectItem>
                    <SelectItem value="24">24px</SelectItem>
                    <SelectItem value="28">28px</SelectItem>
                    <SelectItem value="32">32px</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ColorPalettePicker
                value={nodeStyle.backgroundColor || ""}
                onChange={(c) => updateStyle("backgroundColor", c)}
                label="Background"
                defaultColor="#ffffff"
                testId="input-node-bgcolor"
              />
              <ColorPalettePicker
                value={nodeStyle.borderColor || ""}
                onChange={(c) => updateStyle("borderColor", c)}
                label="Border"
                defaultColor="#cccccc"
                testId="input-node-bordercolor"
              />
              <ColorPalettePicker
                value={nodeStyle.textColor || ""}
                onChange={(c) => updateStyle("textColor", c)}
                label="Text Colour"
                defaultColor="#000000"
                testId="input-node-textcolor"
              />
              <div>
                <Label className="text-xs text-muted-foreground">Rotation</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Slider
                    value={[Number(nodeStyle.rotation) || 0]}
                    onValueChange={([v]) => updateStyle("rotation", v)}
                    min={0}
                    max={360}
                    step={15}
                    className="flex-1"
                    data-testid="slider-rotation"
                  />
                  <span className="text-xs text-muted-foreground w-8 text-right">{Number(nodeStyle.rotation) || 0}°</span>
                </div>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {[0, 45, 90, 135, 180, 270].map(deg => (
                    <Button
                      key={deg}
                      size="sm"
                      variant={Number(nodeStyle.rotation || 0) === deg ? 'default' : 'outline'}
                      className="h-6 px-2 text-[10px]"
                      onClick={() => updateStyle("rotation", deg)}
                      data-testid={`button-rotate-${deg}`}
                    >
                      {deg}°
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Layer Order</Label>
                <div className="flex gap-1 mt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs gap-1"
                    onClick={() => onBringToFront(singleNode.id)}
                    data-testid="button-bring-to-front"
                  >
                    <ArrowUpFromLine className="h-3.5 w-3.5" />
                    Bring to Front
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs gap-1"
                    onClick={() => onSendToBack(singleNode.id)}
                    data-testid="button-send-to-back"
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    Send to Back
                  </Button>
                </div>
              </div>
              </div>
            )}
          </div>

          {!isSwimlane && (
            <>
              <Separator />
              <div>
                <button
                  className="flex items-center gap-1 w-full text-left mb-2 cursor-pointer"
                  onClick={() => setCollapsedSections(prev => {
                    const next = new Set(prev);
                    if (next.has('image')) next.delete('image');
                    else next.add('image');
                    return next;
                  })}
                  data-testid="button-toggle-section-image"
                >
                  {collapsedSections.has('image') ? (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <h4 className="text-xs font-semibold text-foreground">Image / Logo</h4>
                </button>
                {!collapsedSections.has('image') && (
                  <div className="space-y-2">
                  {(singleNode.data as any)?.imageUrl && (
                    <div className="relative">
                      <img src={(singleNode.data as any).imageUrl} alt="Node image" className="w-full h-16 object-contain rounded border bg-muted" />
                      <Button size="icon" variant="ghost" className="absolute top-0 right-0 h-5 w-5" onClick={() => updateImageUrl('')}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">Upload Image</Label>
                    <Input type="file" accept="image/*" onChange={handleImageUpload} className="h-7 text-xs" data-testid="input-upload-image" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Or paste URL</Label>
                    <Input value={(singleNode.data as any)?.imageUrl || ''} onChange={(e) => updateImageUrl(e.target.value)} className="h-7 text-xs" placeholder="https://..." data-testid="input-image-url" />
                  </div>
                  </div>
                )}
              </div>
            </>
          )}

          {!isSwimlane && (
            <>
              <Separator />
              <div>
                <button
                  className="flex items-center gap-1 w-full text-left mb-2 cursor-pointer"
                  onClick={() => setCollapsedSections(prev => {
                    const next = new Set(prev);
                    if (next.has('details')) next.delete('details');
                    else next.add('details');
                    return next;
                  })}
                  data-testid="button-toggle-section-details"
                >
                  {collapsedSections.has('details') ? (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <h4 className="text-xs font-semibold text-foreground">Details</h4>
                </button>
                {!collapsedSections.has('details') && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <Textarea value={attrs.description || ""} onChange={(e) => updateAttribute("description", e.target.value)} className="text-xs min-h-[60px]" data-testid="input-node-description" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Owner</Label>
                    <Input value={attrs.owner || ""} onChange={(e) => updateAttribute("owner", e.target.value)} className="h-7 text-xs" data-testid="input-node-owner" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Department</Label>
                    <Input value={attrs.department || ""} onChange={(e) => updateAttribute("department", e.target.value)} className="h-7 text-xs" data-testid="input-node-department" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">System Used</Label>
                    <Input value={attrs.systemUsed || ""} onChange={(e) => updateAttribute("systemUsed", e.target.value)} className="h-7 text-xs" data-testid="input-node-system" />
                  </div>
                  </div>
                )}
              </div>
            </>
          )}
          {!isSwimlane && diagramId && (
            <BpmStepLinksPanel
              diagramId={diagramId}
              nodeId={singleNode.id}
              nodeLabel={singleNode.data?.label as string || singleNode.id}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function RollupBar({ nodes }: { nodes: Node[] }) {
  const totals = useMemo(() => {
    let cost = 0, duration = 0, resources = 0, activities = 0;
    nodes.forEach(n => {
      if (n.type && !["start", "end", "swimlane_pool", "swimlane_lane", "annotation"].includes(n.type)) {
        activities++;
        const a = (n.data?.attributes as Record<string, any>) || {};
        if (a.cost) cost += Number(a.cost) || 0;
        if (a.duration) duration += Number(a.duration) || 0;
        if (a.resources) resources += Number(a.resources) || 0;
      }
    });
    return { cost, duration, resources, activities };
  }, [nodes]);

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-t bg-card text-xs">
      <span className="text-muted-foreground font-medium">Roll-up:</span>
      <div className="flex items-center gap-1.5">
        <DollarSign className="h-3.5 w-3.5 text-brand-green" />
        <span className="font-medium" data-testid="text-rollup-cost">${totals.cost.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-brand-blue" />
        <span className="font-medium" data-testid="text-rollup-duration">{totals.duration}h</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-brand-purple" />
        <span className="font-medium" data-testid="text-rollup-resources">{totals.resources}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{totals.activities} activities</span>
      </div>
    </div>
  );
}

function CanvasEditorInner({
  diagram,
  onBack,
  onSaveAsTemplate,
  onNavigateToDiagram,
}: {
  diagram: BpmDiagram;
  onBack: () => void;
  onSaveAsTemplate?: (nodes: Node[], edges: Edge[], name: string) => void;
  onNavigateToDiagram?: (diagramId: number) => void;
}) {
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const initialCanvas = diagram.canvasData as any;
  const [nodes, setNodes] = useState<Node[]>(() => {
    const raw: Node[] = initialCanvas?.nodes || [];
    return raw.map(n => {
      const style = n.style as Record<string, any> | undefined;
      if (style?.transform && typeof style.transform === 'string' && style.transform.startsWith('rotate(')) {
        const { transform, ...cleanStyle } = style;
        return { ...n, style: cleanStyle };
      }
      return n;
    });
  });
  const [edges, setEdges] = useState<Edge[]>(() => {
    const rawEdges = initialCanvas?.edges || [];
    return rawEdges.map((e: any) => ({
      ...e,
      sourceHandle: e.sourceHandle?.replace(/-source$/, '').replace(/-target$/, '') ?? e.sourceHandle,
      targetHandle: e.targetHandle?.replace(/-source$/, '').replace(/-target$/, '') ?? e.targetHandle,
    }));
  });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [showProperties, setShowProperties] = useState(true);
  const [showAttrIcons, setShowAttrIcons] = useState(false);
  const [showSequenceNumbers, setShowSequenceNumbers] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [diagramName, setDiagramName] = useState(diagram.name);
  const [diagramStatus, setDiagramStatus] = useState(diagram.status);
  const [isPublished, setIsPublished] = useState(!!(diagram as any).published);
  const [workflowSteps, setWorkflowSteps] = useState<string[]>(() => {
    const meta = diagram.metadata as any;
    return meta?.workflowSteps || DEFAULT_WORKFLOW_STEPS;
  });
  const [showWorkflowConfig, setShowWorkflowConfig] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [userDefaults, setUserDefaults] = useState<BpmUserDefaults>(loadUserDefaults);
  const [showDefaultsDialog, setShowDefaultsDialog] = useState(false);
  const [clipboard, setClipboard] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [viewMode, setViewMode] = useState<"canvas" | "table">("canvas");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importOrientation, setImportOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [importPreview, setImportPreview] = useState<Map<string, ParsedProcessRow[]> | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showProcessReport, setShowProcessReport] = useState(false);
  const [snapToGridEnabled] = useState(true);

  const updateUserDefaults = useCallback((updates: Partial<BpmUserDefaults>) => {
    setUserDefaults(prev => {
      const next = { ...prev, ...updates };
      saveUserDefaults(next);
      return next;
    });
  }, []);

  const handleAutoLayout = useCallback(() => {
    const laid = autoLayoutNodes(nodes, edges, "LR");
    setNodes(laid);
    setIsDirty(true);
    toast({ title: "Auto-layout applied" });
  }, [nodes, edges, toast]);

  const sequenceMap = useMemo(() => {
    if (!showSequenceNumbers) return new Map<string, number>();
    const rows = nodesToRows(nodes, edges);
    const map = new Map<string, number>();
    rows.forEach((r, i) => map.set(r.id, i + 1));
    return map;
  }, [showSequenceNumbers, nodes, edges]);

  const historyRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([{ nodes: initialCanvas?.nodes || [], edges: initialCanvas?.edges || [] }]);
  const historyIndexRef = useRef(0);
  const isUndoRedoRef = useRef(false);

  const pushHistory = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    if (isUndoRedoRef.current) return;
    const history = historyRef.current;
    const idx = historyIndexRef.current;
    historyRef.current = history.slice(0, idx + 1);
    historyRef.current.push({ nodes: JSON.parse(JSON.stringify(newNodes)), edges: JSON.parse(JSON.stringify(newEdges)) });
    if (historyRef.current.length > 50) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
    setIsDirty(true);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const state = historyRef.current[historyIndexRef.current];
    isUndoRedoRef.current = true;
    setNodes(state.nodes);
    setEdges(state.edges);
    setSelectedNode(null);
    setSelectedNodes([]);
    setTimeout(() => { isUndoRedoRef.current = false; }, 0);
  }, []);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    const state = historyRef.current[historyIndexRef.current];
    isUndoRedoRef.current = true;
    setNodes(state.nodes);
    setEdges(state.edges);
    setSelectedNode(null);
    setSelectedNodes([]);
    setTimeout(() => { isUndoRedoRef.current = false; }, 0);
  }, []);

  const handleCopyRef = useRef<() => void>(() => {});
  const handlePasteRef = useRef<() => void>(() => {});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !isInput) {
        e.preventDefault();
        handleCopyRef.current();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !isInput) {
        e.preventDefault();
        handlePasteRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const pushHistoryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedPushHistory = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    if (pushHistoryDebounceRef.current) clearTimeout(pushHistoryDebounceRef.current);
    pushHistoryDebounceRef.current = setTimeout(() => pushHistory(newNodes, newEdges), 300);
  }, [pushHistory]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => {
      const next = applyNodeChanges(changes, nds);
      const hasStructuralChange = changes.some(c => c.type === 'remove' || c.type === 'add');
      if (hasStructuralChange) {
        pushHistory(next, edges);
      }
      setIsDirty(true);
      return next;
    });
  }, [edges, pushHistory]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => {
      const next = applyEdgeChanges(changes, eds);
      const hasStructuralChange = changes.some(c => c.type === 'remove' || c.type === 'add');
      if (hasStructuralChange) {
        pushHistory(nodes, next);
      }
      setIsDirty(true);
      return next;
    });
  }, [nodes, pushHistory]);

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    setEdges(eds => {
      const next = addEdge({
        ...connection,
        type: userDefaults.defaultEdgeType || "smoothstep",
        animated: false,
        style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5 },
        markerEnd: { type: "arrowclosed" as any, color: "hsl(var(--muted-foreground))" },
      }, eds);
      pushHistory(nodes, next);
      return next;
    });
  }, [nodes, pushHistory, userDefaults.defaultEdgeType]);

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    setEdges(eds => {
      const next = reconnectEdge(oldEdge, newConnection, eds);
      pushHistory(nodes, next);
      setIsDirty(true);
      return next;
    });
  }, [nodes, pushHistory]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
    setSelectedNodes([node]);
    setSelectedEdge(null);
    setShowProperties(true);
  }, []);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    setSelectedNodes([]);
    setShowProperties(true);
    setEdges(eds => eds.map(e => ({ ...e, selected: e.id === edge.id })));
    setNodes(nds => nds.map(n => ({ ...n, selected: false })));
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedNodes([]);
    setSelectedEdge(null);
    setEdges(eds => eds.map(e => ({ ...e, selected: false })));
  }, []);

  const onUpdateEdge = useCallback((edgeId: string, updates: Partial<Edge>) => {
    setEdges(eds => {
      const next = eds.map(e => {
        if (e.id !== edgeId) return e;
        const merged = { ...e, ...updates };
        if (updates.style || updates.markerEnd) {
          merged.style = { ...e.style, ...updates.style };
          if (updates.markerEnd) {
            merged.markerEnd = updates.markerEnd;
          } else if (updates.style && (updates.style as any).stroke) {
            const strokeColor = (updates.style as any).stroke;
            merged.markerEnd = { type: "arrowclosed" as any, color: strokeColor };
          }
        }
        return merged;
      });
      pushHistory(nodes, next);
      return next;
    });
    setSelectedEdge(prev => {
      if (!prev || prev.id !== edgeId) return prev;
      const merged = { ...prev, ...updates };
      merged.style = { ...prev.style, ...updates.style };
      if (updates.markerEnd) merged.markerEnd = updates.markerEnd;
      else if (updates.style && (updates.style as any).stroke) {
        merged.markerEnd = { type: "arrowclosed" as any, color: (updates.style as any).stroke };
      }
      return merged;
    });
    setIsDirty(true);
  }, [nodes, pushHistory]);

  const onUpdateAllEdges = useCallback((styleUpdates: { stroke?: string; strokeWidth?: number; type?: string }) => {
    setEdges(eds => {
      const next = eds.map(e => ({
        ...e,
        ...(styleUpdates.type ? { type: styleUpdates.type } : {}),
        style: { ...e.style, ...(styleUpdates.stroke ? { stroke: styleUpdates.stroke } : {}), ...(styleUpdates.strokeWidth ? { strokeWidth: styleUpdates.strokeWidth } : {}) },
        markerEnd: styleUpdates.stroke ? { type: "arrowclosed" as any, color: styleUpdates.stroke } : e.markerEnd,
      }));
      pushHistory(nodes, next);
      return next;
    });
    setIsDirty(true);
  }, [nodes, pushHistory]);

  const handleAlignNodes = useCallback((alignment: string) => {
    if (selectedNodes.length < 2) {
      toast({ title: "Select multiple nodes", description: "Select 2 or more nodes to align them" });
      return;
    }
    const sel = selectedNodes.filter(n => n.type !== 'swimlane_pool' && n.type !== 'swimlane_lane');
    if (sel.length < 2) return;

    const getNodeWidth = (n: Node) => (n.measured?.width as number) || (n.style?.width as number) || (n.type && NODE_DEFAULTS[n.type]?.width) || 160;
    const getNodeHeight = (n: Node) => (n.measured?.height as number) || (n.style?.height as number) || (n.type && NODE_DEFAULTS[n.type]?.height) || 80;

    setNodes(nds => {
      const idSet = new Set(sel.map(n => n.id));
      const targetNodes = nds.filter(n => idSet.has(n.id));

      console.log('[Align]', alignment, 'nodes:', targetNodes.map(n => ({
        id: n.id, type: n.type,
        pos: n.position,
        measured: n.measured,
        styleW: n.style?.width, styleH: n.style?.height,
        calcW: getNodeWidth(n), calcH: getNodeHeight(n),
        centerY: n.position.y + getNodeHeight(n) / 2,
      })));

      let updates: Record<string, { x: number; y: number }> = {};

      if (alignment === 'left') {
        const minX = Math.min(...targetNodes.map(n => n.position.x));
        targetNodes.forEach(n => { updates[n.id] = { x: minX, y: n.position.y }; });
      } else if (alignment === 'center-h') {
        const centers = targetNodes.map(n => n.position.x + getNodeWidth(n) / 2);
        const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
        targetNodes.forEach(n => { updates[n.id] = { x: avgCenter - getNodeWidth(n) / 2, y: n.position.y }; });
      } else if (alignment === 'right') {
        const maxRight = Math.max(...targetNodes.map(n => n.position.x + getNodeWidth(n)));
        targetNodes.forEach(n => { updates[n.id] = { x: maxRight - getNodeWidth(n), y: n.position.y }; });
      } else if (alignment === 'top') {
        const minY = Math.min(...targetNodes.map(n => n.position.y));
        targetNodes.forEach(n => { updates[n.id] = { x: n.position.x, y: minY }; });
      } else if (alignment === 'middle') {
        const middles = targetNodes.map(n => n.position.y + getNodeHeight(n) / 2);
        const avgMiddle = middles.reduce((a, b) => a + b, 0) / middles.length;
        targetNodes.forEach(n => { updates[n.id] = { x: n.position.x, y: avgMiddle - getNodeHeight(n) / 2 }; });
      } else if (alignment === 'bottom') {
        const maxBottom = Math.max(...targetNodes.map(n => n.position.y + getNodeHeight(n)));
        targetNodes.forEach(n => { updates[n.id] = { x: n.position.x, y: maxBottom - getNodeHeight(n) }; });
      } else if (alignment === 'distribute-h') {
        const sorted = [...targetNodes].sort((a, b) => a.position.x - b.position.x);
        if (sorted.length >= 3) {
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          const startX = first.position.x;
          const endX = last.position.x + getNodeWidth(last);
          const middleNodes = sorted.slice(1, -1);
          const middleTotalWidth = middleNodes.reduce((sum, n) => sum + getNodeWidth(n), 0);
          const availableSpace = (endX - startX) - getNodeWidth(first) - getNodeWidth(last) - middleTotalWidth;
          const gap = Math.max(0, availableSpace / (sorted.length - 1));
          let currentX = startX + getNodeWidth(first) + gap;
          updates[first.id] = { x: first.position.x, y: first.position.y };
          updates[last.id] = { x: last.position.x, y: last.position.y };
          middleNodes.forEach(n => {
            updates[n.id] = { x: currentX, y: n.position.y };
            currentX += getNodeWidth(n) + gap;
          });
        }
      } else if (alignment === 'distribute-v') {
        const sorted = [...targetNodes].sort((a, b) => a.position.y - b.position.y);
        if (sorted.length >= 3) {
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          const startY = first.position.y;
          const endY = last.position.y + getNodeHeight(last);
          const middleNodes = sorted.slice(1, -1);
          const middleTotalHeight = middleNodes.reduce((sum, n) => sum + getNodeHeight(n), 0);
          const availableSpace = (endY - startY) - getNodeHeight(first) - getNodeHeight(last) - middleTotalHeight;
          const gap = Math.max(0, availableSpace / (sorted.length - 1));
          let currentY = startY + getNodeHeight(first) + gap;
          updates[first.id] = { x: first.position.x, y: first.position.y };
          updates[last.id] = { x: last.position.x, y: last.position.y };
          middleNodes.forEach(n => {
            updates[n.id] = { x: n.position.x, y: currentY };
            currentY += getNodeHeight(n) + gap;
          });
        }
      }

      const next = nds.map(n => updates[n.id] ? { ...n, position: updates[n.id] } : n);
      pushHistory(next, edges);
      return next;
    });
    setIsDirty(true);
  }, [selectedNodes, edges, pushHistory, toast]);

  const handleCopy = useCallback(() => {
    const nodesToCopy = selectedNodes.length > 0 ? selectedNodes : (selectedNode ? [selectedNode] : []);
    if (nodesToCopy.length === 0) return;
    const nodeIds = new Set(nodesToCopy.map(n => n.id));
    const relatedEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    setClipboard({
      nodes: JSON.parse(JSON.stringify(nodesToCopy)),
      edges: JSON.parse(JSON.stringify(relatedEdges)),
    });
    toast({ title: "Copied", description: `${nodesToCopy.length} shape${nodesToCopy.length > 1 ? 's' : ''} copied` });
  }, [selectedNodes, selectedNode, edges, toast]);

  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.nodes.length === 0) return;
    const idMap: Record<string, string> = {};
    const offset = 30;
    clipboard.nodes.forEach(n => {
      idMap[n.id] = `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}_${Math.random().toString(36).substr(2, 4)}`;
    });
    const newNodes = clipboard.nodes.map(n => {
      const parentIdResolved = n.parentId && idMap[n.parentId] ? idMap[n.parentId] : n.parentId;
      return {
        ...n,
        id: idMap[n.id],
        position: { x: n.position.x + offset, y: n.position.y + offset },
        selected: true,
        ...(parentIdResolved ? { parentId: parentIdResolved, extent: 'parent' as const } : {}),
      };
    });
    const newEdges = clipboard.edges.map(e => ({
      ...e,
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      source: idMap[e.source] || e.source,
      target: idMap[e.target] || e.target,
    }));
    setNodes(nds => {
      const deselected = nds.map(n => ({ ...n, selected: false }));
      const next = [...deselected, ...newNodes];
      pushHistory(next, [...edges, ...newEdges]);
      return next;
    });
    setEdges(eds => [...eds, ...newEdges]);
    setSelectedNodes(newNodes);
    setSelectedNode(newNodes.length === 1 ? newNodes[0] : null);
    setIsDirty(true);
  }, [clipboard, edges, pushHistory]);

  useEffect(() => { handleCopyRef.current = handleCopy; }, [handleCopy]);
  useEffect(() => { handlePasteRef.current = handlePaste; }, [handlePaste]);

  const onSelectionChange: OnSelectionChangeFunc = useCallback(({ nodes: selNodes }) => {
    if (selNodes.length > 1) {
      setSelectedNodes(selNodes);
      setSelectedNode(null);
      setSelectedEdge(null);
      setShowProperties(true);
    } else if (selNodes.length === 1) {
      setSelectedNode(selNodes[0]);
      setSelectedNodes(selNodes);
      setSelectedEdge(null);
    } else {
      setSelectedNodes([]);
      setSelectedNode(null);
    }
  }, []);

  const onUpdateNode = useCallback((nodeId: string, data: any) => {
    setNodes(nds => {
      const next = nds.map(n => {
        if (n.id !== nodeId) return n;
        const updated = { ...n, data };
        if (n.type === 'annotation') {
          const label = (data.label || 'Annotation') as string;
          const notes = (data.attributes?.description || '') as string;
          const fontSize = data.style?.fontSize || 8;
          const charW = fontSize * 0.6;
          const lineH = fontSize * 1.4;
          const paddingX = 40;
          const paddingY = 16;
          const maxCharsPerLine = Math.max(20, Math.floor(((n.style?.width as number || 120) - paddingX) / charW));
          const labelLines = Math.max(1, Math.ceil(label.length / maxCharsPerLine));
          const notesLines = notes ? notes.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil((line.length || 1) / maxCharsPerLine)), 0) : 0;
          const totalLines = labelLines + notesLines;
          const neededHeight = Math.max(36, (totalLines * lineH) + paddingY + (notes ? 8 : 0));
          const currentH = (n.style?.height as number) || 36;
          if (neededHeight > currentH) {
            updated.style = { ...updated.style, height: Math.ceil(neededHeight) };
          }
        }
        return updated;
      });
      debouncedPushHistory(next, edges);
      return next;
    });
    setSelectedNode(prev => prev && prev.id === nodeId ? { ...prev, data } : prev);
    setIsDirty(true);
  }, [edges, debouncedPushHistory]);

  const onBringToFront = useCallback((nodeId: string) => {
    setNodes(nds => {
      if (nds.length === 0) return nds;
      const zValues = nds.map(n => n.zIndex ?? 0);
      const maxZ = Math.max(...zValues);
      const next = nds.map(n => n.id === nodeId ? { ...n, zIndex: maxZ + 1 } : n);
      debouncedPushHistory(next, edges);
      return next;
    });
    setIsDirty(true);
  }, [edges, debouncedPushHistory]);

  const onSendToBack = useCallback((nodeId: string) => {
    setNodes(nds => {
      if (nds.length === 0) return nds;
      const zValues = nds.map(n => n.zIndex ?? 0);
      const minZ = Math.min(...zValues);
      const newZ = Math.min(minZ - 1, -1);
      const next = nds.map(n => n.id === nodeId ? { ...n, zIndex: newZ } : n);
      debouncedPushHistory(next, edges);
      return next;
    });
    setIsDirty(true);
  }, [edges, debouncedPushHistory]);

  const onUpdateMultipleNodes = useCallback((nodeIds: string[], styleUpdates: Record<string, string | number | undefined>) => {
    setNodes(nds => {
      const idSet = new Set(nodeIds);
      const next = nds.map(n => {
        if (!idSet.has(n.id)) return n;
        const existingStyle = (n.data?.style as Record<string, any>) || {};
        return { ...n, data: { ...n.data, style: { ...existingStyle, ...styleUpdates } } };
      });
      debouncedPushHistory(next, edges);
      return next;
    });
    setIsDirty(true);
  }, [edges, debouncedPushHistory]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/bpm-node-type");
    if (!type) return;

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const defaults = NODE_DEFAULTS[type] || { width: 160, height: 80, label: "New Node" };
    const isSwimlane = type === 'swimlane_pool' || type === 'swimlane_lane';
    const isBasicShape = type.startsWith('basic_') || type.startsWith('line_');

    setNodes(nds => {
      let parentId: string | undefined;
      let adjustedPosition = { ...position };

      if (type === 'swimlane_lane') {
        const pool = findContainerAtPosition(nds, position, defaults.width, defaults.height, undefined, 'swimlane_pool');
        if (pool) {
          parentId = pool.id;
          const poolAbs = getAbsolutePosition(pool, nds);
          adjustedPosition = {
            x: position.x - poolAbs.x,
            y: position.y - poolAbs.y,
          };
        }
      } else if (!isSwimlane) {
        const container = findContainerAtPosition(nds, position, defaults.width, defaults.height);
        if (container) {
          parentId = container.id;
          const containerAbs = getAbsolutePosition(container, nds);
          adjustedPosition = {
            x: position.x - containerAbs.x,
            y: position.y - containerAbs.y,
          };
        }
      }

      const defaultStyle: Record<string, any> = {};
      if (userDefaults.backgroundColor && !isSwimlane && !isBasicShape) defaultStyle.backgroundColor = userDefaults.backgroundColor;
      if (userDefaults.borderColor && !isSwimlane && !isBasicShape) defaultStyle.borderColor = userDefaults.borderColor;
      if (userDefaults.textColor && !isSwimlane && !isBasicShape) defaultStyle.color = userDefaults.textColor;
      if (userDefaults.fontSize && userDefaults.fontSize !== 12 && !isSwimlane && !isBasicShape) defaultStyle.fontSize = userDefaults.fontSize;

      const newNode: Node = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type,
        position: adjustedPosition,
        data: {
          label: defaults.label,
          attributes: type === 'automated_process' ? { automationPercent: 100 } : {},
          style: defaultStyle,
          nodeType: type,
          ...(isSwimlane ? { orientation: (() => { try { return localStorage.getItem(BPM_LANE_ORIENTATION_KEY) || 'horizontal'; } catch { return 'horizontal'; } })() } : {}),
        },
        style: { width: defaults.width, height: defaults.height },
        ...((isSwimlane || isBasicShape) ? { zIndex: -1 } : {}),
        ...(parentId ? { parentId, extent: 'parent' as const } : {}),
      };

      const next = isSwimlane && !parentId ? [newNode, ...nds] : [...nds, newNode];
      pushHistory(next, edges);
      return next;
    });
  }, [screenToFlowPosition, edges, pushHistory, userDefaults]);

  const onNodeDragStop = useCallback((_: any, draggedNode: Node) => {
    if (draggedNode.type === 'swimlane_pool') return;

    setNodes(nds => {
      const idx = nds.findIndex(n => n.id === draggedNode.id);
      if (idx === -1) return nds;
      const currentNode = nds[idx];
      const nodeW = (currentNode.style?.width as number) || (currentNode.measured?.width) || 160;
      const nodeH = (currentNode.style?.height as number) || (currentNode.measured?.height) || 80;

      const absPos = getAbsolutePosition(currentNode, nds);

      const filterType = draggedNode.type === 'swimlane_lane' ? 'swimlane_pool' : undefined;
      const container = findContainerAtPosition(
        nds,
        absPos,
        nodeW,
        nodeH,
        draggedNode.id,
        filterType,
      );

      if (container && isDescendantOf(container.id, draggedNode.id, nds)) {
        return nds;
      }

      const newParentId = container?.id;
      const oldParentId = currentNode.parentId;

      if (newParentId === oldParentId) return nds;

      let newPosition: { x: number; y: number };
      if (newParentId && container) {
        const containerAbs = getAbsolutePosition(container, nds);
        newPosition = {
          x: absPos.x - containerAbs.x,
          y: absPos.y - containerAbs.y,
        };
      } else {
        newPosition = absPos;
      }

      const next = nds.map(n => {
        if (n.id !== draggedNode.id) return n;
        return {
          ...n,
          position: newPosition,
          parentId: newParentId,
          extent: newParentId ? ('parent' as const) : undefined,
        };
      });

      pushHistory(next, edges);
      setIsDirty(true);
      return next;
    });
  }, [edges, pushHistory]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const canvasData = { nodes, edges };
      const existingMeta = (diagram.metadata as any) || {};
      await apiRequest("PATCH", `/api/bpm/diagrams/${diagram.id}`, {
        name: diagramName,
        status: diagramStatus,
        published: isPublished,
        canvasData,
        metadata: { ...existingMeta, workflowSteps },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bpm/diagrams"] });
      setIsDirty(false);
      toast({ title: "Saved", description: "Diagram saved successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, diagram.id, diagramName, diagramStatus, isPublished, workflowSteps, diagram.metadata, toast]);

  const handleStatusChange = useCallback((newStatus: string) => {
    setDiagramStatus(newStatus);
    setIsDirty(true);
  }, []);

  const handleExportJSON = useCallback(() => {
    const data = JSON.stringify({ name: diagramName, type: diagram.type, nodes, edges }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${diagramName.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, diagramName, diagram.type]);

  const handleCopyToClipboard = useCallback(async () => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (!el) return;
    setIsExporting(true);
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(el, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        filter: (node: HTMLElement) => {
          if (node?.classList?.contains("react-flow__minimap")) return false;
          if (node?.classList?.contains("react-flow__controls")) return false;
          return true;
        },
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
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (!el) return;
    setIsExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        filter: (node: HTMLElement) => {
          if (node?.classList?.contains("react-flow__minimap")) return false;
          if (node?.classList?.contains("react-flow__controls")) return false;
          return true;
        },
      });
      const link = document.createElement("a");
      link.download = `${diagramName.replace(/\s+/g, "_")}_diagram.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "PNG exported successfully" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }, [diagramName, toast]);

  const handleExportPdf = useCallback(async () => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (!el) return;
    setIsExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        filter: (node: HTMLElement) => {
          if (node?.classList?.contains("react-flow__minimap")) return false;
          if (node?.classList?.contains("react-flow__controls")) return false;
          return true;
        },
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
      pdf.save(`${diagramName.replace(/\s+/g, "_")}_diagram.pdf`);
      toast({ title: "PDF exported successfully" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }, [diagramName, toast]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedNode) {
      const idsToDelete = new Set<string>([selectedNode.id]);
      const collectChildren = (parentId: string) => {
        nodes.forEach(n => {
          if (n.parentId === parentId && !idsToDelete.has(n.id)) {
            idsToDelete.add(n.id);
            collectChildren(n.id);
          }
        });
      };
      collectChildren(selectedNode.id);

      const newNodes = nodes.filter(n => !idsToDelete.has(n.id));
      const newEdges = edges.filter(e => !idsToDelete.has(e.source) && !idsToDelete.has(e.target));
      pushHistory(newNodes, newEdges);
      setNodes(newNodes);
      setEdges(newEdges);
      setSelectedNode(null);
    }
  }, [selectedNode, nodes, edges, pushHistory]);

  const handleBack = useCallback(() => {
    if (isDirty) {
      setShowExitDialog(true);
    } else {
      onBack();
    }
  }, [isDirty, onBack]);

  const handleSaveAndExit = useCallback(async () => {
    setShowExitDialog(false);
    setIsSaving(true);
    try {
      const canvasData = { nodes, edges };
      const existingMeta = (diagram.metadata as any) || {};
      await apiRequest("PATCH", `/api/bpm/diagrams/${diagram.id}`, {
        name: diagramName,
        status: diagramStatus,
        published: isPublished,
        canvasData,
        metadata: { ...existingMeta, workflowSteps },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bpm/diagrams"] });
      setIsDirty(false);
      toast({ title: "Saved", description: "Diagram saved successfully" });
      onBack();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, diagram.id, diagram.metadata, diagramName, diagramStatus, isPublished, workflowSteps, toast, onBack]);

  const handleExitWithoutSaving = useCallback(() => {
    setShowExitDialog(false);
    onBack();
  }, [onBack]);

  const handleSaveAsTemplate = useCallback(() => {
    if (onSaveAsTemplate) {
      onSaveAsTemplate(nodes, edges, diagramName);
    }
  }, [nodes, edges, diagramName, onSaveAsTemplate]);

  const handleExportCsv = useCallback(() => {
    const processNodes = nodes.filter(n => n.type !== 'swimlane_pool' && n.type !== 'swimlane_lane');
    const csvContent = processNodes.length > 0 ? generateCsvTemplate(nodes, edges) : generateBlankTemplate();
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${diagramName.replace(/\s+/g, "_")}_export.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Current diagram exported as CSV" });
  }, [nodes, edges, diagramName, toast]);

  const handleDownloadTemplate = useCallback(() => {
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + generateBlankTemplate()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bpm_import_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Template Downloaded", description: "Blank template with example data downloaded" });
  }, [toast]);

  const handleImportCsvClick = useCallback(() => {
    setShowImportDialog(true);
    setImportPreview(null);
    setImportFileName("");
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsvContent(text);
      setImportPreview(parsed);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleImportConfirm = useCallback(() => {
    if (!importPreview || importPreview.size === 0) return;

    const allProcesses = Array.from(importPreview.entries());

    if (allProcesses.length === 1) {
      const [, rows] = allProcesses[0];
      const { nodes: newNodes, edges: newEdges } = buildDiagramFromRows(rows, importOrientation);
      pushHistory(newNodes, newEdges);
      setNodes(newNodes);
      setEdges(newEdges);
      setIsDirty(true);
      setShowImportDialog(false);
      toast({ title: "Imported", description: `${rows.length} shapes imported into current diagram` });
    } else {
      const [, firstRows] = allProcesses[0];
      const { nodes: newNodes, edges: newEdges } = buildDiagramFromRows(firstRows, importOrientation);
      pushHistory(newNodes, newEdges);
      setNodes(newNodes);
      setEdges(newEdges);
      setIsDirty(true);
      setShowImportDialog(false);
      toast({
        title: "Imported",
        description: `${firstRows.length} shapes from "${allProcesses[0][0]}" imported. ${allProcesses.length - 1} additional process(es) found — use the BPM catalogue to create separate diagrams for them.`,
      });
    }
  }, [importPreview, importOrientation, pushHistory, toast]);

  const handleTableNodesChange = useCallback((newNodes: Node[]) => {
    pushHistory(newNodes, edges);
    setNodes(newNodes);
  }, [edges, pushHistory]);

  const handleTableEdgesChange = useCallback((newEdges: Edge[]) => {
    pushHistory(nodes, newEdges);
    setEdges(newEdges);
  }, [nodes, pushHistory]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-card flex-wrap">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={handleBack} data-testid="button-back-to-catalogue">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Input
            value={diagramName}
            onChange={(e) => { setDiagramName(e.target.value); setIsDirty(true); }}
            className="h-8 text-sm font-medium w-[250px]"
            data-testid="input-diagram-name"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 gap-1" data-testid="button-status-dropdown">
                <Badge className={cn("text-xs", STATUS_COLORS[diagramStatus] || "")}>
                  {formatStepLabel(diagramStatus)}
                </Badge>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {workflowSteps.map((step, idx) => {
                const currentIdx = workflowSteps.indexOf(diagramStatus);
                const isActive = step === diagramStatus;
                const isPast = idx < currentIdx;
                return (
                  <DropdownMenuItem
                    key={step}
                    onClick={() => handleStatusChange(step)}
                    className={cn(isActive && "font-semibold")}
                    data-testid={`menu-status-${step}`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Badge className={cn("text-[10px] h-4", STATUS_COLORS[step] || "bg-muted text-muted-foreground")}>
                        {idx + 1}
                      </Badge>
                      <span>{formatStepLabel(step)}</span>
                      {isActive && <Check className="h-3 w-3 ml-auto" />}
                      {isPast && <span className="text-xs text-muted-foreground ml-auto">Done</span>}
                    </div>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuItem onClick={() => setShowWorkflowConfig(true)} data-testid="menu-configure-workflow">
                <Settings className="h-3.5 w-3.5 mr-2" />
                Configure Workflow Steps
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant={isPublished ? "default" : "outline"}
            className={cn("text-xs gap-1", isPublished && "bg-[#22C55E] hover:bg-[#22C55E]/90 text-white border-[#22C55E]")}
            onClick={() => { setIsPublished(!isPublished); setIsDirty(true); }}
            data-testid="button-toggle-published"
          >
            <Globe className="h-3.5 w-3.5" />
            {isPublished ? "Published" : "Unpublished"}
          </Button>
          {isDirty && <span className="text-xs text-muted-foreground">Unsaved</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={handleAutoLayout} data-testid="button-auto-layout" title="Auto-layout nodes">
            <AlignHorizontalDistributeCenter className="h-4 w-4 mr-1" />
            Auto-layout
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowProcessReport(true)} data-testid="button-process-report" title="Process Report">
            <FileText className="h-4 w-4 mr-1" />
            Report
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button size="icon" variant="ghost" onClick={handleUndo} disabled={historyIndexRef.current <= 0} data-testid="button-undo" title="Undo (Ctrl+Z)">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={handleRedo} disabled={historyIndexRef.current >= historyRef.current.length - 1} data-testid="button-redo" title="Redo (Ctrl+Y)">
            <Redo2 className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          {(selectedNode || selectedNodes.length > 0) && (
            <>
              <Button size="sm" variant="ghost" onClick={handleCopy} data-testid="button-copy-nodes" title="Copy (Ctrl+C)">
                <Clipboard className="h-4 w-4 mr-1" />
                Copy
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDeleteSelected} data-testid="button-delete-node">
                <Trash2 className="h-4 w-4 mr-1" />
                Delete{selectedNodes.length > 1 ? ` (${selectedNodes.length})` : ''}
              </Button>
            </>
          )}
          {clipboard && (
            <Button size="sm" variant="ghost" onClick={handlePaste} data-testid="button-paste-nodes" title="Paste (Ctrl+V)">
              <ClipboardPaste className="h-4 w-4 mr-1" />
              Paste
            </Button>
          )}
          {selectedNodes.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" data-testid="button-align-menu" title="Align & Distribute">
                  <AlignStartVertical className="h-4 w-4 mr-1" />
                  Align
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem onClick={() => handleAlignNodes('left')} data-testid="menu-align-left">
                  <AlignStartVertical className="h-4 w-4 mr-2" />
                  Align Left
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAlignNodes('center-h')} data-testid="menu-align-centre">
                  <AlignCenterVertical className="h-4 w-4 mr-2" />
                  Align Centre
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAlignNodes('right')} data-testid="menu-align-right">
                  <AlignEndVertical className="h-4 w-4 mr-2" />
                  Align Right
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAlignNodes('top')} data-testid="menu-align-top">
                  <AlignStartHorizontal className="h-4 w-4 mr-2" />
                  Align Top
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAlignNodes('middle')} data-testid="menu-align-middle">
                  <AlignCenterHorizontal className="h-4 w-4 mr-2" />
                  Align Middle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAlignNodes('bottom')} data-testid="menu-align-bottom">
                  <AlignEndHorizontal className="h-4 w-4 mr-2" />
                  Align Bottom
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAlignNodes('distribute-h')} data-testid="menu-distribute-h">
                  <AlignHorizontalSpaceAround className="h-4 w-4 mr-2" />
                  Distribute Horizontally
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAlignNodes('distribute-v')} data-testid="menu-distribute-v">
                  <AlignVerticalSpaceAround className="h-4 w-4 mr-2" />
                  Distribute Vertically
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className="flex items-center border rounded-md overflow-visible">
            <Button
              size="sm"
              variant="ghost"
              className={cn("rounded-r-none toggle-elevate", viewMode === "canvas" && "toggle-elevated")}
              onClick={() => setViewMode("canvas")}
              data-testid="button-view-canvas"
              title="Canvas View"
            >
              <LayoutDashboard className="h-4 w-4 mr-1" />
              Canvas
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={cn("rounded-l-none toggle-elevate", viewMode === "table" && "toggle-elevated")}
              onClick={() => setViewMode("table")}
              data-testid="button-view-table"
              title="Table View"
            >
              <Table2 className="h-4 w-4 mr-1" />
              Table
            </Button>
          </div>
          <Separator orientation="vertical" className="h-6" />
          {viewMode === "canvas" && (
            <>
              <Button size="sm" variant="ghost" className={cn("toggle-elevate", showAttrIcons && "toggle-elevated")} onClick={() => setShowAttrIcons(!showAttrIcons)} data-testid="button-toggle-attr-icons" title="Show/hide attribute icons on nodes">
                <DollarSign className="h-4 w-4 mr-1" />
                Attributes
              </Button>
              <Button size="sm" variant="ghost" className={cn("toggle-elevate", showSequenceNumbers && "toggle-elevated")} onClick={() => setShowSequenceNumbers(!showSequenceNumbers)} data-testid="button-toggle-sequence-numbers" title="Show/hide sequence numbers on nodes (matches table row order)">
                <Hash className="h-4 w-4 mr-1" />
                Sequence
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowDefaultsDialog(true)} data-testid="button-user-defaults" title="Configure default styling for new nodes and edges">
                <Pipette className="h-4 w-4 mr-1" />
                Defaults
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowProperties(!showProperties)} data-testid="button-toggle-properties">
                <Eye className="h-4 w-4 mr-1" />
                Properties
              </Button>
            </>
          )}
          <Separator orientation="vertical" className="h-6" />
          {onSaveAsTemplate && (
            <Button size="sm" variant="ghost" onClick={handleSaveAsTemplate} data-testid="button-save-as-template">
              <Bookmark className="h-4 w-4 mr-1" />
              Save as Template
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" disabled={isExporting} data-testid="button-diagram-export">
                {isExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleCopyToClipboard} data-testid="menuitem-diagram-clipboard">
                <ClipboardCopy className="h-4 w-4 mr-2" />Copy to Clipboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPng} data-testid="menuitem-diagram-export-png">
                <Image className="h-4 w-4 mr-2" />Export as PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf} data-testid="menuitem-diagram-export-pdf">
                <FileDown className="h-4 w-4 mr-2" />Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJSON} data-testid="button-export-json">
                <FileJson className="h-4 w-4 mr-2" />Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={handleSave} disabled={isSaving} data-testid="button-save-diagram">
            {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      {viewMode === "table" ? (
        <BpmTableView
          nodes={nodes}
          edges={edges}
          onUpdateNode={onUpdateNode}
          onNodesChange={handleTableNodesChange}
          onEdgesChange={handleTableEdgesChange}
          onSetDirty={() => setIsDirty(true)}
          onExport={handleExportCsv}
          onDownloadTemplate={handleDownloadTemplate}
          onImportCsv={handleImportCsvClick}
        />
      ) : (
      <div className="flex flex-1 overflow-hidden">
        <ShapePalette onDragStart={() => {}} />

        <div className="flex-1 flex flex-col" ref={reactFlowWrapper}>
          <div className="flex-1">
            <DiagramNavigateProvider value={onNavigateToDiagram ?? null}>
            <NodeUpdateProvider value={onUpdateNode}>
            <BpmAttrVisibilityProvider value={showAttrIcons}>
            <SequenceNumberProvider value={sequenceMap}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onReconnect={onReconnect}
              edgesReconnectable
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onPaneClick={onPaneClick}
              onSelectionChange={onSelectionChange}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onNodeDragStop={onNodeDragStop}
              nodeTypes={nodeTypes}
              defaultEdgeOptions={{
                type: "smoothstep",
                style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5 },
                markerEnd: { type: "arrowclosed" as any, color: "hsl(var(--muted-foreground))" },
              }}
              connectionMode={ConnectionMode.Loose}
              fitView
              snapToGrid={snapToGridEnabled}
              snapGrid={[15, 15]}
              multiSelectionKeyCode={["Shift", "Meta", "Control"]}
              selectionOnDrag
              panOnDrag={[1]}
              deleteKeyCode={["Backspace", "Delete"]}
              colorMode={resolvedTheme}
              className="bg-background"
              data-testid="canvas-react-flow"
            >
              <Background variant={BackgroundVariant.Dots} gap={15} size={1} color="hsl(var(--muted-foreground) / 0.2)" />
              <Controls
                showZoom
                showFitView
                showInteractive={false}
                position="bottom-left"
                className="!bg-card !border !shadow-sm"
              />
              <MiniMap
                position="bottom-right"
                className="!bg-card !border !shadow-sm"
                maskColor="hsl(var(--background) / 0.7)"
                nodeColor={(n) => {
                  if (n.type === "start" || n.type === "end") return "hsl(var(--brand-green))";
                  if (n.type === "decision" || n.type?.includes("gateway")) return "hsl(var(--primary))";
                  if (n.type === "swimlane_pool" || n.type === "swimlane_lane") return "hsl(var(--muted))";
                  return "hsl(var(--card))";
                }}
              />
            </ReactFlow>
            </SequenceNumberProvider>
            </BpmAttrVisibilityProvider>
            </NodeUpdateProvider>
            </DiagramNavigateProvider>
          </div>
          <RollupBar nodes={nodes} />
        </div>

        {showProperties && (
          <PropertiesPanel
            selectedNode={selectedNode}
            selectedNodes={selectedNodes}
            selectedEdge={selectedEdge}
            onUpdateNode={onUpdateNode}
            onUpdateMultipleNodes={onUpdateMultipleNodes}
            onUpdateEdge={onUpdateEdge}
            onUpdateAllEdges={onUpdateAllEdges}
            onBringToFront={onBringToFront}
            onSendToBack={onSendToBack}
            onClose={() => setShowProperties(false)}
            diagramId={diagram.id}
            libraryId={diagram.libraryId}
          />
        )}
      </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={handleFileSelect}
        data-testid="input-csv-file"
      />

      <FormDialogShell
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        title="Import Process from CSV"
        subtitle="Upload a CSV file to create process shapes with connections and attributes."
        saveLabel="Import"
        saveTestId="button-confirm-import"
        size="md"
        onCancel={() => setShowImportDialog(false)}
        onSubmit={handleImportConfirm}
        disabled={!importPreview || importPreview.size === 0}
      >
          <FormSection title="Import settings">
            <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use the "Download Template" button for the correct format.
            </p>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-select-csv-file"
              >
                <Upload className="h-4 w-4 mr-1" />
                {importFileName || "Select CSV File"}
              </Button>
              {importFileName && (
                <span className="text-sm text-muted-foreground">{importFileName}</span>
              )}
            </div>

            <div>
              <FieldLabel>Lane Orientation</FieldLabel>
              <Select value={importOrientation} onValueChange={(v) => setImportOrientation(v as "horizontal" | "vertical")}>
                <SelectTrigger className="mt-1" data-testid="select-import-orientation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal">Horizontal Lanes</SelectItem>
                  <SelectItem value="vertical">Vertical Lanes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {importPreview && importPreview.size > 0 && (
              <div className="border rounded-md p-3 space-y-2">
                <p className="text-sm font-medium">Preview</p>
                {Array.from(importPreview.entries()).map(([name, rows]) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{name}</span>
                    <Badge variant="secondary">{rows.length} shapes</Badge>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-2">
                  {importPreview.size === 1
                    ? "This process will be imported into the current diagram."
                    : `The first process will be imported into the current diagram. Create additional diagrams separately for the other ${importPreview.size - 1} process(es).`}
                </p>
              </div>
            )}
            </div>
          </FormSection>
      </FormDialogShell>

      <WorkflowConfigDialog
        open={showWorkflowConfig}
        onOpenChange={setShowWorkflowConfig}
        steps={workflowSteps}
        currentStatus={diagramStatus}
        onSave={(newSteps) => {
          setWorkflowSteps(newSteps);
          if (!newSteps.includes(diagramStatus)) {
            setDiagramStatus(newSteps[0]);
          }
          setIsDirty(true);
          setShowWorkflowConfig(false);
        }}
      />

      <FormDialogViewShell
        open={showDefaultsDialog}
        onOpenChange={setShowDefaultsDialog}
        onClose={() => setShowDefaultsDialog(false)}
        title="Node & Edge Defaults"
        size="md"
        footer={(
          <div className="flex justify-end">
            <Button onClick={() => setShowDefaultsDialog(false)} data-testid="button-close-defaults">
              Done
            </Button>
          </div>
        )}
      >
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">These settings apply to newly created nodes and edges. Existing elements are not affected.</p>
            <FormDivider />
            <FormSection title="Node defaults">
            <div>
              <FieldLabel>Default Font Size</FieldLabel>
              <div className="flex items-center gap-3 mt-1">
                <Slider
                  value={[userDefaults.fontSize]}
                  onValueChange={([v]) => updateUserDefaults({ fontSize: v })}
                  min={8}
                  max={24}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-8 text-right">{userDefaults.fontSize}px</span>
              </div>
            </div>
            <div>
              <FieldLabel>Default Node Background</FieldLabel>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {[
                  { label: "None", color: "" },
                  { label: "White", color: "#FFFFFF" },
                  { label: "Blue", color: "#DBEAFE" },
                  { label: "Green", color: "#DCFCE7" },
                  { label: "Purple", color: "#EDE9FE" },
                  { label: "Amber", color: "#FEF3C7" },
                  { label: "Pink", color: "#FCE7F3" },
                  { label: "Grey", color: "#F3F4F6" },
                ].map(c => (
                  <button
                    key={c.label}
                    className={cn("w-7 h-7 rounded-md border-2 transition-all", userDefaults.backgroundColor === c.color ? "border-primary ring-1 ring-primary" : "border-border")}
                    style={{ backgroundColor: c.color || "transparent" }}
                    onClick={() => updateUserDefaults({ backgroundColor: c.color })}
                    title={c.label}
                    aria-label={`Set default background to ${c.label}`}
                    data-testid={`button-default-bg-${c.label.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Default Node Border</FieldLabel>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {[
                  { label: "None", color: "" },
                  { label: "Blue", color: "#1E88C8" },
                  { label: "Green", color: "#22C55E" },
                  { label: "Red", color: "#EF4444" },
                  { label: "Orange", color: "#F59E0B" },
                  { label: "Purple", color: "#7C3AED" },
                  { label: "Grey", color: "#9CA3AF" },
                  { label: "Black", color: "#111827" },
                ].map(c => (
                  <button
                    key={c.label}
                    className={cn("w-7 h-7 rounded-md border-2 transition-all", userDefaults.borderColor === c.color ? "border-primary ring-1 ring-primary" : "border-border")}
                    style={{ backgroundColor: c.color || "transparent" }}
                    onClick={() => updateUserDefaults({ borderColor: c.color })}
                    title={c.label}
                    aria-label={`Set default border to ${c.label}`}
                    data-testid={`button-default-border-${c.label.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Default Text Colour</FieldLabel>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {[
                  { label: "None", color: "" },
                  { label: "Black", color: "#111827" },
                  { label: "Blue", color: "#1E88C8" },
                  { label: "Red", color: "#EF4444" },
                  { label: "White", color: "#FFFFFF" },
                ].map(c => (
                  <button
                    key={c.label}
                    className={cn("w-7 h-7 rounded-md border-2 transition-all", userDefaults.textColor === c.color ? "border-primary ring-1 ring-primary" : "border-border")}
                    style={{ backgroundColor: c.color || "transparent" }}
                    onClick={() => updateUserDefaults({ textColor: c.color })}
                    title={c.label}
                    aria-label={`Set default text colour to ${c.label}`}
                    data-testid={`button-default-text-${c.label.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>
            </FormSection>
            <FormDivider />
            <FormSection title="Edge defaults">
            <div>
              <FieldLabel>Default Edge Type</FieldLabel>
              <Select
                value={userDefaults.defaultEdgeType}
                onValueChange={(v) => updateUserDefaults({ defaultEdgeType: v })}
              >
                <SelectTrigger className="h-8 text-sm mt-1" data-testid="select-default-edge-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="straight">Straight</SelectItem>
                  <SelectItem value="smoothstep">Orthogonal (Default)</SelectItem>
                  <SelectItem value="default">Curved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </FormSection>
            <FormDivider />
            <Button variant="outline" size="sm" className="w-full" onClick={() => { updateUserDefaults(INITIAL_DEFAULTS); }} data-testid="button-reset-defaults">
              Reset All to Defaults
            </Button>
          </div>
      </FormDialogViewShell>

      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">You have unsaved changes. Would you like to save before leaving?</p>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="secondary" onClick={handleExitWithoutSaving} data-testid="button-exit-without-saving">
              Exit without Saving
            </Button>
            <Button onClick={handleSaveAndExit} disabled={isSaving} data-testid="button-save-and-exit">
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save &amp; Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BpmProcessReportDialog diagramId={diagram.id} open={showProcessReport} onOpenChange={setShowProcessReport} />
    </div>
  );
}

function WorkflowConfigDialog({
  open,
  onOpenChange,
  steps,
  currentStatus,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  steps: string[];
  currentStatus: string;
  onSave: (steps: string[]) => void;
}) {
  const [editSteps, setEditSteps] = useState<string[]>(steps);
  const [newStep, setNewStep] = useState("");

  useEffect(() => {
    if (open) setEditSteps(steps);
  }, [open, steps]);

  const addStep = () => {
    const step = newStep.trim().toLowerCase().replace(/\s+/g, "_");
    if (!step || editSteps.includes(step)) return;
    const lastIdx = editSteps.length - 1;
    const newSteps = [...editSteps];
    newSteps.splice(lastIdx, 0, step);
    setEditSteps(newSteps);
    setNewStep("");
  };

  const removeStep = (idx: number) => {
    if (editSteps.length <= 2) return;
    if (idx === 0 || idx === editSteps.length - 1) return;
    setEditSteps(editSteps.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 1 || newIdx >= editSteps.length - 1) return;
    if (idx === 0 || idx === editSteps.length - 1) return;
    const newSteps = [...editSteps];
    [newSteps[idx], newSteps[newIdx]] = [newSteps[newIdx], newSteps[idx]];
    setEditSteps(newSteps);
  };

  const applyPreset = (preset: string[]) => {
    setEditSteps([...preset]);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Configure Workflow Steps"
      saveLabel="Save Workflow"
      saveTestId="button-save-workflow"
      size="md"
      onCancel={() => onOpenChange(false)}
      onSubmit={() => onSave(editSteps)}
    >
          <div className="space-y-4">
          <div>
            <FieldLabel>Presets</FieldLabel>
            <div className="space-y-1">
              {WORKFLOW_PRESETS.map((preset, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-auto py-1.5"
                  onClick={() => applyPreset(preset.steps)}
                  data-testid={`button-preset-${i}`}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <FormDivider />

          <div>
            <FieldLabel>Current Workflow</FieldLabel>
            <div className="space-y-1">
              {editSteps.map((step, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === editSteps.length - 1;
                const isCurrent = step === currentStatus;
                return (
                  <div key={`${step}-${idx}`} className="flex items-center gap-2">
                    <Badge className={cn("text-[10px] h-5 w-5 flex items-center justify-center shrink-0", STATUS_COLORS[step] || "bg-muted text-muted-foreground")}>
                      {idx + 1}
                    </Badge>
                    <span className={cn("text-sm flex-1", isCurrent && "font-semibold")}>
                      {formatStepLabel(step)}
                    </span>
                    {isCurrent && <Badge variant="outline" className="text-[10px]">Current</Badge>}
                    {!isFirst && !isLast && (
                      <div className="flex items-center gap-0.5">
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveStep(idx, -1)} disabled={idx <= 1}>
                          <ArrowUpFromLine className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveStep(idx, 1)} disabled={idx >= editSteps.length - 2}>
                          <ArrowDownToLine className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => removeStep(idx)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {idx < editSteps.length - 1 && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 hidden" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <FieldGrid cols={2} className="items-end">
            <Input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              placeholder="Add custom step..."
              className="h-7 text-xs flex-1 sm:col-span-1"
              onKeyDown={(e) => e.key === "Enter" && addStep()}
              data-testid="input-new-workflow-step"
            />
            <Button size="sm" variant="outline" onClick={addStep} disabled={!newStep.trim()} data-testid="button-add-workflow-step">
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </FieldGrid>

          <p className="text-xs text-muted-foreground">
            The first step is always the starting status and the last step is the final status.
            You can add, remove, and reorder intermediate steps.
          </p>
        </div>
    </FormDialogShell>
  );
}

export default function BpmCanvasEditor({
  diagram,
  onBack,
  onSaveAsTemplate,
  onNavigateToDiagram,
}: {
  diagram: BpmDiagram;
  onBack: () => void;
  onSaveAsTemplate?: (nodes: Node[], edges: Edge[], name: string) => void;
  onNavigateToDiagram?: (diagramId: number) => void;
}) {
  return (
    <ReactFlowProvider>
      <CanvasEditorInner diagram={diagram} onBack={onBack} onSaveAsTemplate={onSaveAsTemplate} onNavigateToDiagram={onNavigateToDiagram} />
    </ReactFlowProvider>
  );
}
