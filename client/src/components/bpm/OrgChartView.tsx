import { useState, useCallback, useRef, useMemo, useEffect, memo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ArrowLeft, Plus, Search, Download, Image, Trash2, Users, Building2, Layout, Save, Loader2, ChevronDown, UserPlus, X, Upload, Palette, Type, LayoutDashboard, Table2, FileDown, FileUp, Circle, Square, ArrowDown, ArrowRight, Presentation, ClipboardCopy, LayoutGrid, List, Copy, ArrowUpDown, SortAsc, SortDesc, Calendar, MoreVertical } from "lucide-react";
import { MondayTable, type ColumnDef } from "@/components/MondayTable";
import { CHART_TYPE_THEME_COLORS, ENGAGEMENT_LEVELS } from "@shared/models/bpm-extensions";
import { bpmFetchFormData } from "@/lib/bpm-api";
import { BpmLoadingState, BpmCardGridSkeleton } from "@/components/bpm/BpmLoadingState";
import type { OrgChart, OrgChartMember, OrgChartTemplate } from "@shared/models/orgchart";
import type { Resource } from "@shared/models/resources";
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
  ReactFlowProvider,
  useReactFlow,
  BackgroundVariant,
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Dagre from "@dagrejs/dagre";
import { toPng, toBlob } from "html-to-image";

const CHART_TYPES = [
  { value: "department", label: "Department" },
  { value: "project_team", label: "Project Team" },
  { value: "steering_committee", label: "Steering Committee" },
  { value: "stakeholder_map", label: "Stakeholder Map" },
  { value: "company", label: "Company" },
  { value: "division", label: "Division" },
  { value: "custom", label: "Custom" },
] as const;

function getChartTypeLabel(type: string) {
  return CHART_TYPES.find(t => t.value === type)?.label || type;
}

const DEFAULT_TEMPLATE_COLORS = {
  nodeHeaderColor: "#1E88C8",
  nodeBodyColor: "#FFFFFF",
  nodeTextColor: "#111827",
  nodeBorderColor: "#E5E7EB",
  edgeColor: "#6B7280",
  badgeColor: "#F3F4F6",
  badgeTextColor: "#374151",
  titleColor: "#111827",
  titleBgColor: null as string | null,
};

const PRESET_TEMPLATES = [
  { name: "Jiganto Blue", nodeHeaderColor: "#1E88C8", nodeBodyColor: "#FFFFFF", nodeTextColor: "#111827", nodeBorderColor: "#BFDBFE", edgeColor: "#1E88C8", badgeColor: "#DBEAFE", badgeTextColor: "#1E40AF" },
  { name: "Corporate Navy", nodeHeaderColor: "#1E3A5F", nodeBodyColor: "#F8FAFC", nodeTextColor: "#0F172A", nodeBorderColor: "#CBD5E1", edgeColor: "#334155", badgeColor: "#E2E8F0", badgeTextColor: "#1E293B" },
  { name: "Forest Green", nodeHeaderColor: "#166534", nodeBodyColor: "#FFFFFF", nodeTextColor: "#14532D", nodeBorderColor: "#BBF7D0", edgeColor: "#16A34A", badgeColor: "#DCFCE7", badgeTextColor: "#166534" },
  { name: "Royal Purple", nodeHeaderColor: "#6D28D9", nodeBodyColor: "#FFFFFF", nodeTextColor: "#1F2937", nodeBorderColor: "#DDD6FE", edgeColor: "#7C3AED", badgeColor: "#EDE9FE", badgeTextColor: "#5B21B6" },
  { name: "Warm Orange", nodeHeaderColor: "#C2410C", nodeBodyColor: "#FFFFFF", nodeTextColor: "#1F2937", nodeBorderColor: "#FED7AA", edgeColor: "#EA580C", badgeColor: "#FFEDD5", badgeTextColor: "#9A3412" },
  { name: "Elegant Red", nodeHeaderColor: "#B91C1C", nodeBodyColor: "#FFFFFF", nodeTextColor: "#1F2937", nodeBorderColor: "#FECACA", edgeColor: "#DC2626", badgeColor: "#FEE2E2", badgeTextColor: "#991B1B" },
  { name: "Teal Modern", nodeHeaderColor: "#0F766E", nodeBodyColor: "#FFFFFF", nodeTextColor: "#1F2937", nodeBorderColor: "#99F6E4", edgeColor: "#14B8A6", badgeColor: "#CCFBF1", badgeTextColor: "#115E59" },
  { name: "Dark Slate", nodeHeaderColor: "#1E293B", nodeBodyColor: "#F1F5F9", nodeTextColor: "#0F172A", nodeBorderColor: "#94A3B8", edgeColor: "#475569", badgeColor: "#E2E8F0", badgeTextColor: "#334155" },
];

type TemplateColors = typeof DEFAULT_TEMPLATE_COLORS;

function getTemplateColors(template?: OrgChartTemplate | null): TemplateColors {
  if (!template) return DEFAULT_TEMPLATE_COLORS;
  return {
    nodeHeaderColor: template.nodeHeaderColor,
    nodeBodyColor: template.nodeBodyColor,
    nodeTextColor: template.nodeTextColor,
    nodeBorderColor: template.nodeBorderColor,
    edgeColor: template.edgeColor,
    badgeColor: template.badgeColor,
    badgeTextColor: template.badgeTextColor,
    titleColor: template.titleColor,
    titleBgColor: template.titleBgColor,
  };
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

interface ParsedOrgMemberRow {
  name: string;
  title: string;
  department: string;
  email: string;
  phone: string;
  reportsTo: string;
  photoUrl: string;
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
      } else if (ch === ",") {
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

function parseOrgChartCsv(text: string): ParsedOrgMemberRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const rows: ParsedOrgMemberRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (!cols[0]?.trim()) continue;
    rows.push({
      name: cols[0] || "",
      title: cols[1] || "",
      department: cols[2] || "",
      email: cols[3] || "",
      phone: cols[4] || "",
      reportsTo: cols[5] || "",
      photoUrl: cols[6] || "",
    });
  }
  return rows;
}

function generateOrgChartCsvContent(members: OrgChartMember[]): string {
  const header = "Name,Title,Department,Email,Phone,Reports To,Photo URL";
  if (members.length === 0) return header;
  const memberMap = new Map(members.map(m => [m.id, m]));
  const rows = members.map(m => {
    const parent = m.parentMemberId ? memberMap.get(m.parentMemberId) : null;
    return [m.name, m.title || "", m.department || "", m.email || "", m.phone || "", parent?.name || "", m.photoUrl || ""]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });
  return header + "\n" + rows.join("\n");
}

function generateOrgChartCsvTemplate(): string {
  const header = "Name,Title,Department,Email,Phone,Reports To,Photo URL";
  const examples = [
    '"Jane Smith","CEO","Executive","jane@company.com","555-0100","",""',
    '"John Doe","CTO","Technology","john@company.com","555-0101","Jane Smith",""',
    '"Alice Brown","VP Engineering","Engineering","alice@company.com","555-0102","John Doe",""',
    '"Bob Wilson","VP Product","Product","bob@company.com","555-0103","Jane Smith",""',
  ];
  return header + "\n" + examples.join("\n");
}

interface OrgChartTableRow {
  id: number;
  name: string;
  title: string;
  department: string;
  email: string;
  phone: string;
  reportsTo: string;
  photoUrl: string;
  sortOrder: number;
}

function computeNodeLevels(members: OrgChartMember[]): Map<number, number> {
  const levels = new Map<number, number>();
  const childMap = new Map<number | null, number[]>();

  members.forEach(m => {
    const parent = m.parentMemberId ?? null;
    if (!childMap.has(parent)) childMap.set(parent, []);
    childMap.get(parent)!.push(m.id);
  });

  const visited = new Set<number>();
  function setLevel(memberId: number, level: number) {
    if (visited.has(memberId)) return;
    visited.add(memberId);
    levels.set(memberId, level);
    const children = childMap.get(memberId) || [];
    children.forEach(c => setLevel(c, level + 1));
  }

  const roots = members.filter(m => !m.parentMemberId);
  roots.forEach(r => setLevel(r.id, 1));

  members.forEach(m => {
    if (!levels.has(m.id)) levels.set(m.id, 1);
  });

  return levels;
}

function computeDescendantCounts(members: OrgChartMember[]): Map<number, { direct: number; total: number }> {
  const counts = new Map<number, { direct: number; total: number }>();
  const childMap = new Map<number, OrgChartMember[]>();

  members.forEach(m => {
    if (m.parentMemberId) {
      if (!childMap.has(m.parentMemberId)) childMap.set(m.parentMemberId, []);
      childMap.get(m.parentMemberId)!.push(m);
    }
  });

  const visited = new Set<number>();
  function countTotal(memberId: number): number {
    if (visited.has(memberId)) return 0;
    visited.add(memberId);
    const children = childMap.get(memberId) || [];
    let total = children.length;
    children.forEach(c => { total += countTotal(c.id); });
    counts.set(memberId, { direct: children.length, total });
    return total;
  }

  members.forEach(m => {
    if (!counts.has(m.id)) countTotal(m.id);
  });

  return counts;
}

function membersToNodesAndEdges(
  members: OrgChartMember[],
  showPhotos: boolean,
  colors: TemplateColors = DEFAULT_TEMPLATE_COLORS,
  photoShape: "round" | "square" = "round",
  peopleCountMap?: Map<number, { direct: number; total: number }>,
) {
  const nodes: Node[] = members.map(m => ({
    id: `member-${m.id}`,
    type: "orgChartPerson",
    position: { x: Number(m.positionX) || 0, y: Number(m.positionY) || 0 },
    data: { member: m, showPhotos, colors, photoShape, peopleCount: peopleCountMap?.get(m.id) },
  }));
  const edges: Edge[] = members
    .filter(m => m.parentMemberId != null)
    .map(m => {
      const isBeside = m.layoutDirection === "beside";
      return {
        id: `edge-${m.parentMemberId}-${m.id}`,
        source: `member-${m.parentMemberId}`,
        target: `member-${m.id}`,
        sourceHandle: isBeside ? "right" : "bottom",
        targetHandle: isBeside ? "left" : "top",
        type: "smoothstep",
        style: { stroke: colors.edgeColor, strokeWidth: 1.5 },
      };
    });
  return { nodes, edges };
}

function getLayoutedElements(nodes: Node[], edges: Edge[], direction = "TB") {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 80 });

  nodes.forEach(node => {
    g.setNode(node.id, { width: 220, height: (node.data as any).showPhotos ? 140 : 100 });
  });

  const childrenByParent = new Map<string, { target: string; sortOrder: number }[]>();
  edges.forEach(edge => {
    const member = (nodes.find(n => n.id === edge.target)?.data as any)?.member;
    const sortOrder = member?.sortOrder ?? 0;
    if (!childrenByParent.has(edge.source)) childrenByParent.set(edge.source, []);
    childrenByParent.get(edge.source)!.push({ target: edge.target, sortOrder });
  });

  childrenByParent.forEach(children => children.sort((a, b) => a.sortOrder - b.sortOrder));

  childrenByParent.forEach((children, parent) => {
    children.forEach(child => {
      g.setEdge(parent, child.target);
    });
  });

  Dagre.layout(g);

  const positionMap = new Map<string, { x: number; y: number }>();
  nodes.forEach(node => {
    const nodeWithPosition = g.node(node.id);
    const showPhotos = (node.data as any).showPhotos;
    positionMap.set(node.id, {
      x: nodeWithPosition.x - 110,
      y: nodeWithPosition.y - (showPhotos ? 70 : 50),
    });
  });

  const nodeWidth = 220;
  const besideGap = 40;

  const besideByParent = new Map<string, Edge[]>();
  edges.forEach(edge => {
    const targetMember = (nodes.find(n => n.id === edge.target)?.data as any)?.member;
    if (targetMember?.layoutDirection === "beside") {
      if (!besideByParent.has(edge.source)) besideByParent.set(edge.source, []);
      besideByParent.get(edge.source)!.push(edge);
    }
  });

  const getDescendants = (nodeId: string): string[] => {
    const result: string[] = [];
    const children = childrenByParent.get(nodeId) || [];
    for (const child of children) {
      result.push(child.target);
      result.push(...getDescendants(child.target));
    }
    return result;
  };

  besideByParent.forEach((bEdges, parentId) => {
    bEdges.sort((a, b) => {
      const mA = (nodes.find(n => n.id === a.target)?.data as any)?.member;
      const mB = (nodes.find(n => n.id === b.target)?.data as any)?.member;
      return (mA?.sortOrder ?? 0) - (mB?.sortOrder ?? 0);
    });

    const parentPos = positionMap.get(parentId);
    if (!parentPos) return;

    bEdges.forEach((edge, idx) => {
      const dagrePos = positionMap.get(edge.target);
      if (!dagrePos) return;

      const targetX = parentPos.x + (nodeWidth + besideGap) * (idx + 1);
      const targetY = parentPos.y;
      const dx = targetX - dagrePos.x;
      const dy = targetY - dagrePos.y;

      positionMap.set(edge.target, { x: targetX, y: targetY });

      const descendants = getDescendants(edge.target);
      descendants.forEach(descId => {
        const descPos = positionMap.get(descId);
        if (descPos) {
          positionMap.set(descId, { x: descPos.x + dx, y: descPos.y + dy });
        }
      });
    });
  });

  const layoutedNodes = nodes.map(node => ({
    ...node,
    position: positionMap.get(node.id) || node.position,
  }));
  return { nodes: layoutedNodes, edges };
}

type OrgChartPersonNodeData = {
  member: OrgChartMember;
  showPhotos: boolean;
  colors: TemplateColors;
  searchMatch?: boolean;
  photoShape?: "round" | "square";
  peopleCount?: { direct: number; total: number };
  presentationMode?: boolean;
};

function getContrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#111827" : "#FFFFFF";
}

const OrgChartPersonNode = memo(({ data, selected }: NodeProps) => {
  const { member, showPhotos, colors, searchMatch, photoShape, peopleCount, presentationMode } = data as unknown as OrgChartPersonNodeData;
  const c = colors || DEFAULT_TEMPLATE_COLORS;
  const headerTextColor = getContrastText(c.nodeHeaderColor);
  return (
    <div
      className={cn(
        "rounded-md shadow-sm w-[200px] transition-shadow overflow-visible",
        selected && "ring-2 ring-primary",
        searchMatch === false && "opacity-30",
      )}
      style={{ border: `1px solid ${c.nodeBorderColor}`, backgroundColor: c.nodeBodyColor }}
      data-testid={`node-member-${member.id}`}
    >
      <Handle type="target" position={Position.Top} id="top" className={cn("!w-3 !h-3 !bg-muted-foreground/50 !border-background", presentationMode && "!opacity-0 !w-1 !h-1")} />
      <Handle type="target" position={Position.Left} id="left" className={cn("!w-3 !h-3 !bg-muted-foreground/50 !border-background", presentationMode && "!opacity-0 !w-1 !h-1")} />
      <div
        className="rounded-t-md px-3 py-1.5"
        style={{ backgroundColor: c.nodeHeaderColor }}
      >
        {showPhotos ? (
          <div className="flex items-center gap-2">
            <Avatar className={cn(
              "h-8 w-8",
              photoShape === "square"
                ? "rounded-sm border-0 after:hidden"
                : "rounded-full border border-white/30"
            )}>
              <AvatarImage src={member.photoUrl || undefined} alt={member.name} className={cn("object-cover", photoShape === "square" ? "rounded-sm" : "")} />
              <AvatarFallback className={cn("text-xs", photoShape === "square" ? "rounded-sm" : "")} style={{ backgroundColor: c.nodeBorderColor, color: c.nodeTextColor }}>{getInitials(member.name)}</AvatarFallback>
            </Avatar>
            <p className="text-sm font-semibold truncate flex-1" style={{ color: headerTextColor }}>{member.name}</p>
          </div>
        ) : (
          <p className="text-sm font-semibold truncate text-center" style={{ color: headerTextColor }}>{member.name}</p>
        )}
      </div>
      <div className="p-2.5 flex flex-col items-center gap-1">
        {member.title && (
          <p className="text-xs truncate w-full text-center" style={{ color: c.nodeTextColor }}>{member.title}</p>
        )}
        {member.department && (
          <span
            className="mt-0.5 text-[10px] px-2 py-0.5 rounded-full"
            style={{ backgroundColor: c.badgeColor, color: c.badgeTextColor }}
          >
            {member.department}
          </span>
        )}
        {peopleCount && (peopleCount.direct > 0 || peopleCount.total > 0) && (
          <div className="flex items-center justify-center gap-1 mt-1">
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
              {peopleCount.direct} direct
            </Badge>
            {peopleCount.total > peopleCount.direct && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                {peopleCount.total} total
              </Badge>
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} id="bottom" className={cn("!w-3 !h-3 !bg-muted-foreground/50 !border-background", presentationMode && "!opacity-0 !w-1 !h-1")} />
      <Handle type="source" position={Position.Right} id="right" className={cn("!w-3 !h-3 !bg-muted-foreground/50 !border-background", presentationMode && "!opacity-0 !w-1 !h-1")} />
    </div>
  );
});

OrgChartPersonNode.displayName = "OrgChartPersonNode";

const orgChartNodeTypes = {
  orgChartPerson: OrgChartPersonNode,
};

function MemberPropertiesPanel({
  member,
  members,
  onUpdate,
  onClose,
  onPhotoUpload,
  onDelete,
}: {
  member: OrgChartMember;
  members: OrgChartMember[];
  onUpdate: (id: number, data: Partial<OrgChartMember>) => void;
  onClose: () => void;
  onPhotoUpload: (memberId: number, file: File) => void;
  onDelete?: (id: number) => void;
}) {
  const [name, setName] = useState(member.name);
  const [title, setTitle] = useState(member.title || "");
  const [department, setDepartment] = useState(member.department || "");
  const [email, setEmail] = useState(member.email || "");
  const [phone, setPhone] = useState(member.phone || "");
  const [photoUrl, setPhotoUrl] = useState(member.photoUrl || "");
  const [reportsTo, setReportsTo] = useState<string>(member.parentMemberId ? String(member.parentMemberId) : "none");
  const [layoutDirection, setLayoutDirection] = useState<string>(member.layoutDirection || "below");
  const [photoMode, setPhotoMode] = useState<"url" | "upload">("url");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(member.name);
    setTitle(member.title || "");
    setDepartment(member.department || "");
    setEmail(member.email || "");
    setPhone(member.phone || "");
    setPhotoUrl(member.photoUrl || "");
    setReportsTo(member.parentMemberId ? String(member.parentMemberId) : "none");
    setLayoutDirection(member.layoutDirection || "below");
  }, [member]);

  const availableParents = useMemo(() => {
    const descendants = new Set<number>();
    const findDescendants = (id: number) => {
      members.filter(m => m.parentMemberId === id).forEach(child => {
        descendants.add(child.id);
        findDescendants(child.id);
      });
    };
    findDescendants(member.id);
    return members.filter(m => m.id !== member.id && !descendants.has(m.id));
  }, [members, member.id]);

  const handleSave = () => {
    onUpdate(member.id, {
      name,
      title: title || null,
      department: department || null,
      email: email || null,
      phone: phone || null,
      photoUrl: photoUrl || null,
      parentMemberId: reportsTo === "none" ? null : parseInt(reportsTo),
      layoutDirection,
    });
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      onPhotoUpload(member.id, file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      onPhotoUpload(member.id, file);
    }
  };

  return (
    <div className="w-[280px] border-l bg-card flex flex-col h-full">
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member Properties</h3>
        <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-properties">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" data-testid="input-member-name" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-sm" data-testid="input-member-title" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Department</Label>
            <Input value={department} onChange={e => setDepartment(e.target.value)} className="h-8 text-sm" data-testid="input-member-department" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} className="h-8 text-sm" data-testid="input-member-email" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-8 text-sm" data-testid="input-member-phone" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Reports To</Label>
            <Select value={reportsTo} onValueChange={setReportsTo}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-member-reports-to">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None - Top Level</SelectItem>
                {availableParents.map(m => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {reportsTo !== "none" && (
            <div>
              <Label className="text-xs text-muted-foreground">Layout Direction</Label>
              <Select value={layoutDirection} onValueChange={setLayoutDirection}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-layout-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="below">
                    <span className="flex items-center gap-2">
                      <ArrowDown className="h-3 w-3" />
                      Below Parent
                    </span>
                  </SelectItem>
                  <SelectItem value="beside">
                    <span className="flex items-center gap-2">
                      <ArrowRight className="h-3 w-3" />
                      Beside Parent
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs text-muted-foreground">Photo</Label>
            <Tabs value={photoMode} onValueChange={(v) => setPhotoMode(v as "url" | "upload")} className="mt-1">
              <TabsList className="w-full h-7">
                <TabsTrigger value="url" className="flex-1 text-xs h-6" data-testid="tab-photo-url">URL / Path</TabsTrigger>
                <TabsTrigger value="upload" className="flex-1 text-xs h-6" data-testid="tab-photo-upload">Upload</TabsTrigger>
              </TabsList>
              <TabsContent value="url" className="mt-2">
                <Input
                  value={photoUrl}
                  onChange={e => setPhotoUrl(e.target.value)}
                  placeholder="URL or file path..."
                  className="h-8 text-sm"
                  data-testid="input-member-photo"
                />
              </TabsContent>
              <TabsContent value="upload" className="mt-2">
                <div
                  className={cn(
                    "border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors",
                    isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30",
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleFileDrop}
                  data-testid="dropzone-member-photo"
                >
                  <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">
                    {isDragOver ? "Drop image here" : "Click or drag & drop"}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                  data-testid="input-file-photo"
                />
              </TabsContent>
            </Tabs>
          </div>
          {photoUrl && (
            <div className="flex justify-center">
              <Avatar className="h-16 w-16">
                <AvatarImage src={photoUrl} alt={name} />
                <AvatarFallback>{getInitials(name)}</AvatarFallback>
              </Avatar>
            </div>
          )}
          <Button onClick={handleSave} className="w-full" data-testid="button-save-member-props">
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
          {onDelete && (
            <Button variant="destructive" onClick={() => onDelete(member.id)} className="w-full" data-testid="button-delete-member">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Member
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function OrgChartEditorInner({
  chart,
  onBack,
}: {
  chart: OrgChart;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const edgeReconnectSuccessful = useRef(true);
  const { fitView } = useReactFlow();

  const [chartName, setChartName] = useState(chart.name);
  const [chartType, setChartType] = useState(chart.chartType || "department");
  const [chartTitle, setChartTitle] = useState(chart.chartTitle || "");
  const [showPhotos, setShowPhotos] = useState(chart.showPhotos);
  const [searchQuery, setSearchQuery] = useState("");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedMember, setSelectedMember] = useState<OrgChartMember | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(chart.templateId ?? null);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number | null>(
    (chart.metadata as any)?.selectedPresetIndex ?? null
  );
  const [photoShape, setPhotoShape] = useState<"round" | "square">("round");
  const [collapseLevel, setCollapseLevel] = useState<number | null>(null);
  const [showPeopleCount, setShowPeopleCount] = useState(false);
  const [engagementFilter, setEngagementFilter] = useState<string>("all");
  const [presentationMode, setPresentationMode] = useState(false);
  const [viewMode, setViewMode] = useState<"canvas" | "table">("canvas");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importPreview, setImportPreview] = useState<ParsedOrgMemberRow[] | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; memberId: number } | null>(null);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const hasUnsavedChanges = useRef(false);
  const initialLoadDoneForDirty = useRef(false);

  const { data: members = [], isLoading: membersLoading } = useQuery<OrgChartMember[]>({
    queryKey: [`/api/org-charts/${chart.id}/members`],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<OrgChartTemplate[]>({
    queryKey: [`/api/org-chart-templates?tenantId=1`],
  });

  const activeTemplate = useMemo(() => {
    if (selectedTemplateId) {
      return templates.find(t => t.id === selectedTemplateId) || null;
    }
    return null;
  }, [selectedTemplateId, templates]);

  const templateColors = useMemo(() => {
    if (selectedPresetIndex !== null && selectedPresetIndex >= 0 && selectedPresetIndex < PRESET_TEMPLATES.length) {
      const preset = PRESET_TEMPLATES[selectedPresetIndex];
      return {
        ...preset,
        titleColor: DEFAULT_TEMPLATE_COLORS.titleColor,
        titleBgColor: DEFAULT_TEMPLATE_COLORS.titleBgColor,
      } as TemplateColors;
    }
    if (activeTemplate) {
      return getTemplateColors(activeTemplate);
    }
    const typeTheme = CHART_TYPE_THEME_COLORS[chartType];
    if (typeTheme) {
      return {
        ...DEFAULT_TEMPLATE_COLORS,
        nodeHeaderColor: typeTheme.header,
        edgeColor: typeTheme.edge,
        nodeBorderColor: typeTheme.edge,
        badgeColor: `${typeTheme.header}22`,
        badgeTextColor: typeTheme.header,
      } as TemplateColors;
    }
    return getTemplateColors(activeTemplate);
  }, [activeTemplate, selectedPresetIndex, chartType]);

  const handleSelectTemplate = useCallback((id: number | null) => {
    setSelectedTemplateId(id);
    setSelectedPresetIndex(null);
  }, []);

  const handleSelectPreset = useCallback((index: number) => {
    setSelectedPresetIndex(index);
    setSelectedTemplateId(null);
  }, []);

  const handleSelectDefault = useCallback(() => {
    setSelectedTemplateId(null);
    setSelectedPresetIndex(null);
  }, []);

  const initialLoadDone = useRef(false);
  const showPhotosRef = useRef(showPhotos);
  showPhotosRef.current = showPhotos;
  const templateColorsRef = useRef(templateColors);
  templateColorsRef.current = templateColors;
  const photoShapeRef = useRef(photoShape);
  photoShapeRef.current = photoShape;
  const collapseLevelRef = useRef(collapseLevel);
  collapseLevelRef.current = collapseLevel;
  const showPeopleCountRef = useRef(showPeopleCount);
  showPeopleCountRef.current = showPeopleCount;
  const membersRef = useRef(members);
  membersRef.current = members;
  const presentationModeRef = useRef(presentationMode);
  presentationModeRef.current = presentationMode;

  useEffect(() => {
    if (members.length > 0) {
      const currentColors = templateColorsRef.current;
      const currentShowPhotos = showPhotosRef.current;
      const currentPhotoShape = photoShapeRef.current;
      const currentCollapseLevel = collapseLevelRef.current;
      const currentShowPeopleCount = showPeopleCountRef.current;

      const levelMap = computeNodeLevels(members);
      let filteredMembers = currentCollapseLevel !== null
        ? members.filter(m => (levelMap.get(m.id) || 1) <= currentCollapseLevel)
        : members;
      if (chart.chartType === "stakeholder_map" && engagementFilter !== "all") {
        filteredMembers = filteredMembers.filter(m => (m.engagementLevel || "neutral") === engagementFilter);
      }

      const peopleCountMap = currentShowPeopleCount ? computeDescendantCounts(members) : undefined;

      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setTimeout(() => { initialLoadDoneForDirty.current = true; }, 500);
        const { nodes: n, edges: e } = membersToNodesAndEdges(filteredMembers, currentShowPhotos, currentColors, currentPhotoShape, peopleCountMap);
        const allAtOrigin = n.every(node => node.position.x === 0 && node.position.y === 0);
        if (allAtOrigin && n.length > 1) {
          const layouted = getLayoutedElements(n, e);
          setNodes(layouted.nodes);
          setEdges(layouted.edges);
        } else {
          setNodes(n);
          setEdges(e);
        }
        setTimeout(() => fitView({ padding: 0.2 }), 100);
      } else {
        setNodes(prev => {
          const posMap = new Map(prev.map(n => [n.id, n.position]));
          return filteredMembers.map(m => {
            const nodeId = `member-${m.id}`;
            const existingPos = posMap.get(nodeId);
            return {
              id: nodeId,
              type: "orgChartPerson",
              position: existingPos || { x: Number(m.positionX) || 0, y: Number(m.positionY) || 0 },
              data: { member: m, showPhotos: currentShowPhotos, colors: currentColors, photoShape: currentPhotoShape, peopleCount: peopleCountMap?.get(m.id), presentationMode: presentationModeRef.current },
            };
          });
        });
        setEdges(filteredMembers
          .filter(m => m.parentMemberId != null)
          .map(m => {
            const isBeside = m.layoutDirection === "beside";
            return {
              id: `edge-${m.parentMemberId}-${m.id}`,
              source: `member-${m.parentMemberId}`,
              target: `member-${m.id}`,
              sourceHandle: isBeside ? "right" : "bottom",
              targetHandle: isBeside ? "left" : "top",
              type: "smoothstep",
              style: { stroke: currentColors.edgeColor, strokeWidth: 1.5 },
            };
          })
        );
      }
    } else {
      setNodes([]);
      setEdges([]);
      initialLoadDone.current = false;
    }
  }, [members, fitView, collapseLevel, showPeopleCount]);

  const prevShowPhotos = useRef(showPhotos);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    const photoToggled = prevShowPhotos.current !== showPhotos;
    prevShowPhotos.current = showPhotos;

    const peopleCountMap = showPeopleCount ? computeDescendantCounts(members) : undefined;

    if (photoToggled) {
      const updatedNodes = nodes.map(node => ({
        ...node,
        data: { ...node.data, showPhotos, colors: templateColors, photoShape, presentationMode, peopleCount: peopleCountMap?.get((node.data as any).member?.id) },
      }));
      const updatedEdges = edges.map(edge => ({
        ...edge,
        style: { ...edge.style, stroke: templateColors.edgeColor },
      }));
      if (updatedNodes.length > 1) {
        const layouted = getLayoutedElements(updatedNodes, updatedEdges);
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
      } else {
        setNodes(updatedNodes);
        setEdges(updatedEdges);
      }
    } else {
      setNodes(prev => prev.map(node => ({
        ...node,
        data: { ...node.data, showPhotos, colors: templateColors, photoShape, presentationMode, peopleCount: peopleCountMap?.get((node.data as any).member?.id) },
      })));
      setEdges(prev => prev.map(edge => ({
        ...edge,
        style: { ...edge.style, stroke: templateColors.edgeColor },
      })));
    }
  }, [showPhotos, templateColors, photoShape, presentationMode]);

  useEffect(() => {
    if (searchQuery && nodes.length > 0) {
      const q = searchQuery.toLowerCase();
      setNodes(prev => prev.map(node => {
        const member = (node.data as any).member as OrgChartMember;
        const match = member.name.toLowerCase().includes(q) ||
          (member.title || "").toLowerCase().includes(q) ||
          (member.department || "").toLowerCase().includes(q);
        return { ...node, data: { ...node.data, searchMatch: match } };
      }));
    } else if (!searchQuery && nodes.length > 0) {
      setNodes(prev => prev.map(node => ({
        ...node,
        data: { ...node.data, searchMatch: undefined },
      })));
    }
  }, [searchQuery]);

  const updateChartMutation = useMutation({
    mutationFn: (data: Partial<OrgChart>) => apiRequest("PATCH", `/api/org-charts/${chart.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/org-charts") });
      toast({ title: "Chart updated" });
    },
  });

  const createMemberMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/org-charts/${chart.id}/members`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/org-charts/${chart.id}/members`] });
      toast({ title: "Member added" });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/org-charts/members/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/org-charts/${chart.id}/members`] });
      toast({ title: "Member updated" });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (id: number) => {
      const children = members.filter(m => m.parentMemberId === id);
      for (const child of children) {
        await apiRequest("PATCH", `/api/org-charts/members/${child.id}`, { parentMemberId: null });
      }
      return apiRequest("DELETE", `/api/org-charts/members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/org-charts/${chart.id}/members`] });
      setSelectedMember(null);
      toast({ title: "Member deleted" });
    },
  });

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const filtered = changes.filter(c => c.type !== "remove");
    if (initialLoadDoneForDirty.current) {
      const hasMeaningful = filtered.some(c => c.type === "position" && (c as any).dragging === false);
      if (hasMeaningful) hasUnsavedChanges.current = true;
    }
    setNodes(nds => applyNodeChanges(filtered, nds));
  }, []);

  const markDirty = useCallback(() => {
    if (initialLoadDoneForDirty.current) hasUnsavedChanges.current = true;
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (initialLoadDoneForDirty.current && changes.some(c => c.type === "remove")) {
      hasUnsavedChanges.current = true;
    }
    const removals = changes.filter((c): c is EdgeChange & { type: "remove"; id: string } => c.type === "remove");
    if (removals.length > 0) {
      setEdges(currentEdges => {
        removals.forEach(removal => {
          const edge = currentEdges.find(e => e.id === removal.id);
          if (edge?.target) {
            const childId = parseInt(edge.target.replace("member-", ""));
            if (!isNaN(childId)) {
              updateMemberMutation.mutate({ id: childId, data: { parentMemberId: null } });
            }
          }
        });
        return applyEdgeChanges(changes, currentEdges);
      });
    } else {
      setEdges(eds => applyEdgeChanges(changes, eds));
    }
  }, [updateMemberMutation]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const targetId = parseInt(connection.target.replace("member-", ""));
    const sourceId = parseInt(connection.source.replace("member-", ""));
    if (isNaN(targetId) || isNaN(sourceId)) return;
    const targetMember = membersRef.current.find(m => m.id === targetId);
    const isBeside = targetMember?.layoutDirection === "beside";
    updateMemberMutation.mutate({ id: targetId, data: { parentMemberId: sourceId } });
    markDirty();
    setEdges(eds => addEdge({
      ...connection,
      id: `edge-${sourceId}-${targetId}`,
      sourceHandle: isBeside ? "right" : "bottom",
      targetHandle: isBeside ? "left" : "top",
      type: "smoothstep",
      style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5 },
    }, eds));
  }, [updateMemberMutation, markDirty]);

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    edgeReconnectSuccessful.current = true;
    if (newConnection.target && newConnection.source) {
      const targetId = parseInt(newConnection.target.replace("member-", ""));
      const sourceId = parseInt(newConnection.source.replace("member-", ""));
      if (!isNaN(targetId) && !isNaN(sourceId)) {
        updateMemberMutation.mutate({ id: targetId, data: { parentMemberId: sourceId } });
      }
    }
    setEdges(eds => {
      const updated = reconnectEdge(oldEdge, newConnection, eds);
      return updated.map(e => {
        if (e.source && e.target) {
          const sId = e.source.replace("member-", "");
          const tId = e.target.replace("member-", "");
          const expectedId = `edge-${sId}-${tId}`;
          const targetMember = membersRef.current.find(m => m.id === parseInt(tId));
          const isBeside = targetMember?.layoutDirection === "beside";
          if (e.id === oldEdge.id || e.id !== expectedId) {
            return {
              ...e,
              id: expectedId,
              sourceHandle: isBeside ? "right" : "bottom",
              targetHandle: isBeside ? "left" : "top",
            };
          }
        }
        return e;
      });
    });
  }, [updateMemberMutation]);

  const onReconnectEnd = useCallback((_: any, edge: Edge) => {
    if (!edgeReconnectSuccessful.current) {
      if (edge.target) {
        const childId = parseInt(edge.target.replace("member-", ""));
        if (!isNaN(childId)) {
          updateMemberMutation.mutate({ id: childId, data: { parentMemberId: null } });
        }
      }
      setEdges(eds => eds.filter(e => e.id !== edge.id));
    }
    edgeReconnectSuccessful.current = true;
  }, [updateMemberMutation]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[]; edges: Edge[] }) => {
    if (selectedNodes.length === 1) {
      const member = (selectedNodes[0].data as any).member as OrgChartMember;
      setSelectedMember(member);
    } else {
      setSelectedMember(null);
    }
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    const member = (node.data as any).member as OrgChartMember;
    if (!member.parentMemberId) return;
    setContextMenu({ x: event.clientX, y: event.clientY, memberId: member.id });
  }, []);

  const handleToggleLayoutDirection = useCallback((memberId: number) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    const newDirection = member.layoutDirection === "beside" ? "below" : "beside";
    updateMemberMutation.mutate({ id: memberId, data: { layoutDirection: newDirection } });
    setContextMenu(null);
  }, [members, updateMemberMutation]);

  const handleAutoLayout = useCallback(() => {
    const layouted = getLayoutedElements(nodes, edges);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
    setTimeout(() => fitView({ padding: 0.2 }), 50);
  }, [nodes, edges, fitView]);

  const handleSave = useCallback(async () => {
    const positionUpdates = nodes.map(node => {
      const memberId = parseInt(node.id.replace("member-", ""));
      return { id: memberId, positionX: String(node.position.x), positionY: String(node.position.y) };
    });
    const edgeUpdates = edges.map(edge => {
      const targetId = parseInt(edge.target.replace("member-", ""));
      const sourceId = parseInt(edge.source.replace("member-", ""));
      return { id: targetId, parentMemberId: sourceId };
    });
    const memberIdsWithParent = new Set(edgeUpdates.map(e => e.id));
    const orphans = members
      .filter(m => !memberIdsWithParent.has(m.id) && m.parentMemberId != null)
      .map(m => ({ id: m.id, parentMemberId: null }));

    const allUpdates = [...positionUpdates, ...edgeUpdates, ...orphans];
    const merged = new Map<number, any>();
    for (const u of allUpdates) {
      merged.set(u.id, { ...(merged.get(u.id) || {}), ...u });
    }

    try {
      const entries = Array.from(merged.entries());
      for (let i = 0; i < entries.length; i++) {
        const [id, data] = entries[i];
        const { id: _id, ...rest } = data;
        await apiRequest("PATCH", `/api/org-charts/members/${id}`, rest);
      }
      await apiRequest("PATCH", `/api/org-charts/${chart.id}`, {
        name: chartName,
        chartType,
        chartTitle: chartTitle || null,
        showPhotos,
        templateId: selectedTemplateId,
        metadata: { memberCount: members.length, selectedPresetIndex },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/org-charts/${chart.id}/members`] });
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/org-charts") });
      hasUnsavedChanges.current = false;
      toast({ title: "Org chart saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
  }, [nodes, edges, members, chart.id, chartName, showPhotos, selectedTemplateId, selectedPresetIndex, toast]);

  const handleExportPng = useCallback(async () => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (!el) return;
    try {
      const dataUrl = await toPng(el, {
        backgroundColor: "transparent",
        quality: 1,
        filter: (node: HTMLElement) => {
          if (node?.classList?.contains("react-flow__background")) return false;
          if (node?.classList?.contains("react-flow__minimap")) return false;
          if (node?.classList?.contains("react-flow__controls")) return false;
          if (node?.classList?.contains("react-flow__handle")) return false;
          return true;
        },
      });
      const link = document.createElement("a");
      link.download = `${chartName || "orgchart"}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "PNG exported" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  }, [chartName, toast]);

  const handleCopyToClipboard = useCallback(async () => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (!el) return;
    try {
      const blob = await toBlob(el, {
        backgroundColor: "transparent",
        quality: 1,
        filter: (node: HTMLElement) => {
          if (node?.classList?.contains("react-flow__background")) return false;
          if (node?.classList?.contains("react-flow__minimap")) return false;
          if (node?.classList?.contains("react-flow__controls")) return false;
          if (node?.classList?.contains("react-flow__handle")) return false;
          return true;
        },
      });
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        toast({ title: "Copied to clipboard", description: "Paste directly into PowerPoint or any other app" });
      }
    } catch {
      toast({ title: "Copy failed", description: "Your browser may not support copying images to clipboard", variant: "destructive" });
    }
  }, [toast]);

  const handleExportCsv = useCallback(() => {
    const csv = generateOrgChartCsvContent(members);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.download = `${chartName || "orgchart"}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
    toast({ title: "CSV exported" });
  }, [members, chartName, toast]);

  const handleUpdateMember = useCallback((id: number, data: Partial<OrgChartMember>) => {
    updateMemberMutation.mutate({ id, data });
  }, [updateMemberMutation]);

  const handlePhotoUpload = useCallback(async (memberId: number, file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const { url } = await bpmFetchFormData<{ url: string }>("/api/org-charts/upload-photo", formData);
      updateMemberMutation.mutate({ id: memberId, data: { photoUrl: url } });
      toast({ title: "Photo uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  }, [updateMemberMutation, toast]);

  const handleDownloadTemplate = useCallback(() => {
    const csv = generateOrgChartCsvTemplate();
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.download = "orgchart_template.csv";
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast({ title: "Template Downloaded", description: "CSV template with example data downloaded" });
  }, [toast]);

  const handleImportFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseOrgChartCsv(text);
      setImportPreview(parsed);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleImportConfirm = useCallback(async (mode: "replace" | "merge") => {
    if (!importPreview || importPreview.length === 0) return;

    try {
      if (mode === "replace") {
        for (const m of members) {
          await apiRequest("DELETE", `/api/org-charts/members/${m.id}`);
        }
      }

      const existingByName = new Map(members.map(m => [m.name.toLowerCase(), m]));
      const nameToId = new Map<string, number>();

      if (mode === "merge") {
        for (const m of members) {
          nameToId.set(m.name.toLowerCase(), m.id);
        }
      }

      for (const row of importPreview) {
        if (mode === "merge" && existingByName.has(row.name.toLowerCase())) {
          const existing = existingByName.get(row.name.toLowerCase())!;
          await apiRequest("PATCH", `/api/org-charts/members/${existing.id}`, {
            title: row.title || existing.title,
            department: row.department || existing.department,
            email: row.email || existing.email,
            phone: row.phone || existing.phone,
            photoUrl: row.photoUrl || existing.photoUrl,
          });
          nameToId.set(row.name.toLowerCase(), existing.id);
        } else {
          const resp = await apiRequest("POST", `/api/org-charts/${chart.id}/members`, {
            chartId: chart.id,
            name: row.name,
            title: row.title || null,
            department: row.department || null,
            email: row.email || null,
            phone: row.phone || null,
            photoUrl: row.photoUrl || null,
            parentMemberId: null,
          });
          const created = await resp.json();
          nameToId.set(row.name.toLowerCase(), created.id);
        }
      }

      const unresolvedParents: string[] = [];
      for (const row of importPreview) {
        if (!row.reportsTo.trim()) continue;
        const memberId = nameToId.get(row.name.toLowerCase());
        const parentId = nameToId.get(row.reportsTo.toLowerCase());
        if (memberId && parentId) {
          await apiRequest("PATCH", `/api/org-charts/members/${memberId}`, { parentMemberId: parentId });
        } else if (memberId && !parentId) {
          unresolvedParents.push(`${row.name} -> ${row.reportsTo}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: [`/api/org-charts/${chart.id}/members`] });
      setShowImportDialog(false);
      setImportPreview(null);
      setImportFileName("");
      const desc = unresolvedParents.length > 0
        ? `${importPreview.length} members imported. Could not resolve parent for: ${unresolvedParents.join(", ")}`
        : `${importPreview.length} members imported`;
      toast({ title: "Import successful", description: desc });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    }
  }, [importPreview, members, chart.id, toast]);

  const handleTableCellEdit = useCallback((rowId: number | string, columnId: string, value: unknown) => {
    const memberId = Number(rowId);
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    if (columnId === "reportsTo") {
      const parentName = String(value || "").trim();
      if (!parentName) {
        updateMemberMutation.mutate({ id: memberId, data: { parentMemberId: null } });
      } else {
        const parent = members.find(m => m.name.toLowerCase() === parentName.toLowerCase() && m.id !== memberId);
        if (parent) {
          updateMemberMutation.mutate({ id: memberId, data: { parentMemberId: parent.id } });
        }
      }
    } else {
      updateMemberMutation.mutate({ id: memberId, data: { [columnId]: value || null } });
    }
  }, [members, updateMemberMutation]);

  const tableRows = useMemo<OrgChartTableRow[]>(() => {
    const memberMap = new Map(members.map(m => [m.id, m]));
    return members.map(m => ({
      id: m.id,
      name: m.name,
      title: m.title || "",
      department: m.department || "",
      email: m.email || "",
      phone: m.phone || "",
      reportsTo: m.parentMemberId ? (memberMap.get(m.parentMemberId)?.name || "") : "",
      photoUrl: m.photoUrl || "",
      sortOrder: m.sortOrder,
    }));
  }, [members]);

  const tableColumns = useMemo<ColumnDef<OrgChartTableRow>[]>(() => [
    { id: "name", header: "Name", type: "text", accessor: "name", width: "200px", editable: true },
    { id: "title", header: "Title", type: "text", accessor: "title", width: "180px", editable: true },
    { id: "department", header: "Department", type: "text", accessor: "department", width: "150px", editable: true },
    { id: "email", header: "Email", type: "text", accessor: "email", width: "200px", editable: true },
    { id: "phone", header: "Phone", type: "text", accessor: "phone", width: "140px", editable: true },
    {
      id: "reportsTo",
      header: "Reports To",
      type: "status",
      accessor: "reportsTo",
      width: "180px",
      editable: true,
      options: members
        .map(m => ({ value: m.name, label: m.name, color: "bg-muted text-foreground" })),
    },
    { id: "photoUrl", header: "Photo URL", type: "text", accessor: "photoUrl", width: "200px", editable: true },
  ], [members]);

  const handleDeleteKeydown = useCallback((e: KeyboardEvent) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedMember) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      e.preventDefault();
      setShowDeleteConfirm(selectedMember.id);
    }
  }, [selectedMember]);

  useEffect(() => {
    window.addEventListener("keydown", handleDeleteKeydown);
    return () => window.removeEventListener("keydown", handleDeleteKeydown);
  }, [handleDeleteKeydown]);

  const handleToggleShowPhotos = useCallback((checked: boolean) => {
    setShowPhotos(checked);
    updateChartMutation.mutate({ showPhotos: checked });
  }, [updateChartMutation]);

  if (membersLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-3 border-b flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => {
          if (hasUnsavedChanges.current) {
            setShowUnsavedPrompt(true);
          } else {
            onBack();
          }
        }} data-testid="button-back-catalogue">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={chartName}
          onChange={e => { setChartName(e.target.value); markDirty(); }}
          className="h-8 text-sm font-semibold w-[180px]"
          data-testid="input-chart-name"
        />
        <Select value={chartType} onValueChange={(v) => {
          setChartType(v);
          markDirty();
          if (CHART_TYPE_THEME_COLORS[v] && selectedTemplateId === null && selectedPresetIndex === null) {
            const theme = CHART_TYPE_THEME_COLORS[v];
            const matchIdx = PRESET_TEMPLATES.findIndex(p => p.nodeHeaderColor === theme.header);
            if (matchIdx >= 0) setSelectedPresetIndex(matchIdx);
          }
        }}>
          <SelectTrigger className="h-8 w-[160px] text-xs" data-testid="select-chart-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHART_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        {viewMode === "canvas" && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Photos</Label>
            <Switch checked={showPhotos} onCheckedChange={handleToggleShowPhotos} data-testid="toggle-show-photos" />
          </div>
        )}
        {viewMode === "canvas" && showPhotos && (
          <div className="flex items-center gap-1">
            <Label className="text-xs text-muted-foreground">Shape:</Label>
            <div className="flex items-center border rounded-md overflow-visible">
              <Button
                size="sm"
                variant="ghost"
                className={cn("rounded-r-none toggle-elevate px-2", photoShape === "round" && "toggle-elevated")}
                onClick={() => setPhotoShape("round")}
                data-testid="button-photo-round"
              >
                <Circle className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={cn("rounded-l-none toggle-elevate px-2", photoShape === "square" && "toggle-elevated")}
                onClick={() => setPhotoShape("square")}
                data-testid="button-photo-square"
              >
                <Square className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
        {viewMode === "canvas" && (
          <div className="flex items-center gap-1">
            <Label className="text-xs text-muted-foreground">Level:</Label>
            <Select
              value={collapseLevel === null ? "all" : String(collapseLevel)}
              onValueChange={(v) => setCollapseLevel(v === "all" ? null : Number(v))}
            >
              <SelectTrigger className="h-7 w-[80px] text-xs" data-testid="select-collapse-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="1">L1</SelectItem>
                <SelectItem value="2">L2</SelectItem>
                <SelectItem value="3">L3</SelectItem>
                <SelectItem value="4">L4</SelectItem>
                <SelectItem value="5">L5</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {viewMode === "canvas" && (
          <div className="flex items-center gap-1.5">
            <Switch
              checked={showPeopleCount}
              onCheckedChange={setShowPeopleCount}
              data-testid="switch-people-count"
            />
            <Label className="text-xs text-muted-foreground cursor-pointer">Count</Label>
          </div>
        )}
        {viewMode === "canvas" && chart.chartType === "stakeholder_map" && (
          <Select value={engagementFilter} onValueChange={setEngagementFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs" data-testid="select-engagement-filter">
              <SelectValue placeholder="Engagement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All engagement</SelectItem>
              {ENGAGEMENT_LEVELS.map(l => (
                <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {viewMode === "canvas" && (
          <Button
            size="sm"
            variant={presentationMode ? "default" : "outline"}
            onClick={() => setPresentationMode(p => !p)}
            data-testid="button-presentation-mode"
            title={presentationMode ? "Exit Presentation Mode" : "Presentation Mode (hides connection handles)"}
          >
            <Presentation className="h-4 w-4 mr-1" />
            Present
          </Button>
        )}
        {viewMode === "canvas" && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search members..."
              className="h-8 text-sm pl-8 w-[160px]"
              data-testid="input-search-members"
            />
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)} data-testid="button-add-member">
            <UserPlus className="h-4 w-4 mr-1" />
            Add Member
          </Button>
          {viewMode === "canvas" && (
            <Button variant="outline" size="sm" onClick={() => setShowTemplateDialog(true)} data-testid="button-template">
              <Palette className="h-4 w-4 mr-1" />
              Theme
            </Button>
          )}
          {viewMode === "canvas" && (
            <Button variant="outline" size="sm" onClick={handleAutoLayout} data-testid="button-auto-layout">
              <Layout className="h-4 w-4 mr-1" />
              Auto Layout
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-export">
                <Download className="h-4 w-4 mr-1" />
                Export
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {viewMode === "canvas" && (
                <DropdownMenuItem onClick={handleCopyToClipboard} data-testid="button-copy-clipboard">
                  <ClipboardCopy className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </DropdownMenuItem>
              )}
              {viewMode === "canvas" && (
                <DropdownMenuItem onClick={handleExportPng} data-testid="button-export-png">
                  <Image className="h-4 w-4 mr-2" />
                  Export as PNG
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleExportCsv} data-testid="button-export-csv">
                <Download className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadTemplate} data-testid="button-download-template">
                <FileDown className="h-4 w-4 mr-2" />
                Download CSV Template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setShowImportDialog(true); setImportPreview(null); setImportFileName(""); }} data-testid="button-import-csv">
                <FileUp className="h-4 w-4 mr-2" />
                Import from CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={handleSave} data-testid="button-save-orgchart">
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      {chartTitle && (
        <div
          className="text-center py-2.5 px-4 border-b"
          style={{
            backgroundColor: templateColors.titleBgColor || undefined,
            color: templateColors.titleColor,
          }}
        >
          <h2 className="text-lg font-bold" data-testid="text-chart-title">{chartTitle}</h2>
        </div>
      )}

      {viewMode === "table" ? (
        <div className="flex-1 overflow-auto p-3">
          <MondayTable
            columns={tableColumns}
            data={tableRows}
            columnWidthStorageKey="jiganto-orgchart-col-widths"
            onCellEdit={handleTableCellEdit}
            onDeleteItems={(ids) => {
              for (const id of ids) {
                deleteMemberMutation.mutate(Number(id));
              }
            }}
            selectable
            gridLines
            emptyMessage="No members yet. Add members or import from CSV."
            addItemLabel="Add Member"
            onAddItem={() => setShowAddDialog(true)}
            className="min-h-[300px]"
          />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onReconnect={onReconnect}
              onReconnectStart={onReconnectStart}
              onReconnectEnd={onReconnectEnd}
              onSelectionChange={onSelectionChange}
              onNodeContextMenu={onNodeContextMenu}
              onPaneClick={() => setContextMenu(null)}
              nodeTypes={orgChartNodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              deleteKeyCode={presentationMode ? null : "Delete"}
              nodesDraggable={!presentationMode}
              nodesConnectable={!presentationMode}
              elementsSelectable={!presentationMode}
              className="bg-background"
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
              <Controls />
              <MiniMap
                nodeStrokeColor="hsl(var(--border))"
                nodeColor="hsl(var(--card))"
                maskColor="hsl(var(--background) / 0.7)"
              />
            </ReactFlow>
            {contextMenu && (
              <div
                className="fixed z-50 bg-card border rounded-md shadow-lg py-1 min-w-[180px]"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                data-testid="context-menu-layout-direction"
              >
                {(() => {
                  const member = members.find(m => m.id === contextMenu.memberId);
                  if (!member) return null;
                  const isBeside = member.layoutDirection === "beside";
                  return (
                    <button
                      className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover-elevate"
                      onClick={() => handleToggleLayoutDirection(contextMenu.memberId)}
                      data-testid="button-toggle-layout-direction"
                    >
                      {isBeside ? (
                        <>
                          <ArrowDown className="h-4 w-4 text-muted-foreground" />
                          <span>Position Below Parent</span>
                        </>
                      ) : (
                        <>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span>Position Beside Parent</span>
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            )}
          </div>

          {selectedMember && (
            <MemberPropertiesPanel
              member={selectedMember}
              members={members}
              onUpdate={handleUpdateMember}
              onClose={() => setSelectedMember(null)}
              onPhotoUpload={handlePhotoUpload}
              onDelete={(id) => { setShowDeleteConfirm(id); }}
            />
          )}
        </div>
      )}

      <AddMemberDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        members={members}
        chartId={chart.id}
        onAdd={(data) => {
          createMemberMutation.mutate(data);
          setShowAddDialog(false);
        }}
      />

      <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Member</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this member? Any direct reports will become top-level members.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (showDeleteConfirm !== null) {
                  deleteMemberMutation.mutate(showDeleteConfirm);
                  setShowDeleteConfirm(null);
                }
              }}
              data-testid="button-confirm-delete-member"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        selectedPresetIndex={selectedPresetIndex}
        chartTitle={chartTitle}
        onSelectTemplate={handleSelectTemplate}
        onSelectPreset={handleSelectPreset}
        onSelectDefault={handleSelectDefault}
        onChartTitleChange={setChartTitle}
      />

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import from CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file with columns: Name, Title, Department, Email, Phone, Reports To, Photo URL.
              You can download a template first to see the expected format.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} data-testid="button-import-download-template">
                <FileDown className="h-4 w-4 mr-1" />
                Download Template
              </Button>
            </div>
            <div className="border-2 border-dashed rounded-md p-4">
              <input
                type="file"
                accept=".csv"
                onChange={handleImportFileSelect}
                className="text-sm"
                data-testid="input-import-file"
              />
            </div>
            {importFileName && (
              <p className="text-sm text-muted-foreground">
                File: {importFileName}
              </p>
            )}
            {importPreview && importPreview.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{importPreview.length} members found in CSV</p>
                <div className="border rounded-md max-h-[200px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-1.5 font-medium">Name</th>
                        <th className="text-left p-1.5 font-medium">Title</th>
                        <th className="text-left p-1.5 font-medium">Department</th>
                        <th className="text-left p-1.5 font-medium">Reports To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((row, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-1.5">{row.name}</td>
                          <td className="p-1.5">{row.title}</td>
                          <td className="p-1.5">{row.department}</td>
                          <td className="p-1.5">{row.reportsTo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {members.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    This chart currently has {members.length} members. Choose how to handle the import:
                  </p>
                )}
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
                  {members.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => handleImportConfirm("merge")}
                      data-testid="button-import-merge"
                    >
                      Merge with Existing
                    </Button>
                  )}
                  <Button
                    onClick={() => handleImportConfirm("replace")}
                    data-testid="button-import-replace"
                  >
                    {members.length > 0 ? "Replace All" : "Import"}
                  </Button>
                </DialogFooter>
              </div>
            )}
            {importPreview && importPreview.length === 0 && (
              <p className="text-sm text-destructive">No valid rows found in the CSV file. Make sure the file has a header row.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUnsavedPrompt} onOpenChange={setShowUnsavedPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You have unsaved changes to this org chart. Would you like to save before leaving?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setShowUnsavedPrompt(false);
              hasUnsavedChanges.current = false;
              onBack();
            }} data-testid="button-discard-changes">
              Discard
            </Button>
            <Button onClick={async () => {
              setShowUnsavedPrompt(false);
              await handleSave();
              onBack();
            }} data-testid="button-save-and-leave">
              Save & Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateDialog({
  open,
  onOpenChange,
  templates,
  selectedTemplateId,
  selectedPresetIndex,
  chartTitle,
  onSelectTemplate,
  onSelectPreset,
  onSelectDefault,
  onChartTitleChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: OrgChartTemplate[];
  selectedTemplateId: number | null;
  selectedPresetIndex: number | null;
  chartTitle: string;
  onSelectTemplate: (id: number | null) => void;
  onSelectPreset: (index: number) => void;
  onSelectDefault: () => void;
  onChartTitleChange: (title: string) => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState("apply");
  const [newName, setNewName] = useState("");
  const [newHeaderColor, setNewHeaderColor] = useState("#1E88C8");
  const [newBodyColor, setNewBodyColor] = useState("#FFFFFF");
  const [newTextColor, setNewTextColor] = useState("#111827");
  const [newBorderColor, setNewBorderColor] = useState("#E5E7EB");
  const [newEdgeColor, setNewEdgeColor] = useState("#6B7280");
  const [newBadgeColor, setNewBadgeColor] = useState("#F3F4F6");
  const [newBadgeTextColor, setNewBadgeTextColor] = useState("#374151");

  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/org-chart-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/org-chart-templates?tenantId=1`] });
      toast({ title: "Template created" });
      setNewName("");
      setTab("apply");
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/org-chart-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/org-chart-templates?tenantId=1`] });
      toast({ title: "Template deleted" });
    },
  });

  const handleCreateTemplate = () => {
    if (!newName.trim()) return;
    createTemplateMutation.mutate({
      tenantId: 1,
      name: newName.trim(),
      nodeHeaderColor: newHeaderColor,
      nodeBodyColor: newBodyColor,
      nodeTextColor: newTextColor,
      nodeBorderColor: newBorderColor,
      edgeColor: newEdgeColor,
      badgeColor: newBadgeColor,
      badgeTextColor: newBadgeTextColor,
    });
  };

  const applyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setNewHeaderColor(preset.nodeHeaderColor);
    setNewBodyColor(preset.nodeBodyColor);
    setNewTextColor(preset.nodeTextColor);
    setNewBorderColor(preset.nodeBorderColor);
    setNewEdgeColor(preset.edgeColor);
    setNewBadgeColor(preset.badgeColor);
    setNewBadgeTextColor(preset.badgeTextColor);
    setNewName(preset.name);
    setTab("create");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Chart Theme & Title</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mb-3">
          <div>
            <Label className="text-xs text-muted-foreground">Chart Title (displayed above the org chart)</Label>
            <Input
              value={chartTitle}
              onChange={e => onChartTitleChange(e.target.value)}
              placeholder="e.g., Acme Corp - Engineering Organization"
              className="h-8 text-sm"
              data-testid="input-chart-title"
            />
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="apply" className="flex-1" data-testid="tab-apply-template">Apply Theme</TabsTrigger>
            <TabsTrigger value="create" className="flex-1" data-testid="tab-create-template">Create Theme</TabsTrigger>
          </TabsList>

          <TabsContent value="apply" className="mt-3 space-y-3">
            <div
              className={cn(
                "p-3 rounded-md border cursor-pointer hover-elevate",
                selectedTemplateId === null && selectedPresetIndex === null && "ring-2 ring-primary",
              )}
              onClick={() => onSelectDefault()}
              data-testid="template-default"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: "#1E88C8" }} />
                <span className="text-sm font-medium">Default (Jiganto Blue)</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider pt-2">Built-in Themes</div>
            {PRESET_TEMPLATES.slice(1).map((preset, idx) => (
              <div
                key={idx + 1}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-md border cursor-pointer hover-elevate",
                  selectedPresetIndex === idx + 1 && "ring-2 ring-primary",
                )}
                onClick={() => onSelectPreset(idx + 1)}
                data-testid={`template-preset-${idx + 1}`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-5 h-5 rounded-full border shrink-0" style={{ backgroundColor: preset.nodeHeaderColor }} />
                  <span className="text-sm font-medium truncate">{preset.name}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    applyPreset(preset);
                  }}
                  data-testid={`button-use-preset-${idx + 1}`}
                >
                  Customize
                </Button>
              </div>
            ))}

            {templates.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider pt-2">Saved Themes</div>
                {templates.map(template => (
                  <div
                    key={template.id}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-md border cursor-pointer hover-elevate",
                      selectedTemplateId === template.id && "ring-2 ring-primary",
                    )}
                    onClick={() => onSelectTemplate(template.id)}
                    data-testid={`template-saved-${template.id}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-5 h-5 rounded-full border shrink-0" style={{ backgroundColor: template.nodeHeaderColor }} />
                      <span className="text-sm font-medium truncate">{template.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedTemplateId === template.id) onSelectDefault();
                        deleteTemplateMutation.mutate(template.id);
                      }}
                      data-testid={`button-delete-template-${template.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="create" className="mt-3 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Theme Name *</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} className="h-8 text-sm" placeholder="e.g., My Brand" data-testid="input-template-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Header Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={newHeaderColor} onChange={e => setNewHeaderColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" data-testid="color-header" />
                  <Input value={newHeaderColor} onChange={e => setNewHeaderColor(e.target.value)} className="h-8 text-sm flex-1 font-mono" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Body Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={newBodyColor} onChange={e => setNewBodyColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" data-testid="color-body" />
                  <Input value={newBodyColor} onChange={e => setNewBodyColor(e.target.value)} className="h-8 text-sm flex-1 font-mono" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Text Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={newTextColor} onChange={e => setNewTextColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" data-testid="color-text" />
                  <Input value={newTextColor} onChange={e => setNewTextColor(e.target.value)} className="h-8 text-sm flex-1 font-mono" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Border Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={newBorderColor} onChange={e => setNewBorderColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" data-testid="color-border" />
                  <Input value={newBorderColor} onChange={e => setNewBorderColor(e.target.value)} className="h-8 text-sm flex-1 font-mono" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Edge/Line Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={newEdgeColor} onChange={e => setNewEdgeColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" data-testid="color-edge" />
                  <Input value={newEdgeColor} onChange={e => setNewEdgeColor(e.target.value)} className="h-8 text-sm flex-1 font-mono" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Badge Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={newBadgeColor} onChange={e => setNewBadgeColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" data-testid="color-badge" />
                  <Input value={newBadgeColor} onChange={e => setNewBadgeColor(e.target.value)} className="h-8 text-sm flex-1 font-mono" />
                </div>
              </div>
            </div>
            <div className="border rounded-md p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground mb-2">Preview</p>
              <div className="flex justify-center">
                <div className="w-[160px] rounded-md shadow-sm" style={{ border: `1px solid ${newBorderColor}`, backgroundColor: newBodyColor }}>
                  <div className="rounded-t-md px-2 py-1" style={{ backgroundColor: newHeaderColor }}>
                    <p className="text-xs font-semibold text-center" style={{ color: getContrastText(newHeaderColor) }}>Sample Name</p>
                  </div>
                  <div className="p-2 text-center">
                    <p className="text-[10px]" style={{ color: newTextColor }}>Job Title</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full mt-1 inline-block" style={{ backgroundColor: newBadgeColor, color: newBadgeTextColor }}>Department</span>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTab("apply")}>Cancel</Button>
              <Button onClick={handleCreateTemplate} disabled={!newName.trim() || createTemplateMutation.isPending} data-testid="button-save-template">
                {createTemplateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Theme
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function AddMemberDialog({
  open,
  onOpenChange,
  members,
  chartId,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: OrgChartMember[];
  chartId: number;
  onAdd: (data: any) => void;
}) {
  const [tab, setTab] = useState("resources");
  const [resourceSearch, setResourceSearch] = useState("");
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [parentMemberId, setParentMemberId] = useState<string>("none");

  const [manualName, setManualName] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualDept, setManualDept] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualPhotoUrl, setManualPhotoUrl] = useState("");
  const [manualParent, setManualParent] = useState<string>("none");

  const { data: resources = [], isLoading: resourcesLoading } = useQuery<Resource[]>({
    queryKey: [`/api/resources?tenantId=1`],
    enabled: open,
  });

  const filteredResources = useMemo(() => {
    if (!resourceSearch) return resources;
    const q = resourceSearch.toLowerCase();
    return resources.filter(r =>
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
      (r.jobTitle || "").toLowerCase().includes(q) ||
      (r.department || "").toLowerCase().includes(q)
    );
  }, [resources, resourceSearch]);

  const handleReset = () => {
    setSelectedResource(null);
    setParentMemberId("none");
    setManualName("");
    setManualTitle("");
    setManualDept("");
    setManualEmail("");
    setManualPhone("");
    setManualPhotoUrl("");
    setManualParent("none");
    setResourceSearch("");
  };

  const handleAddFromResource = () => {
    if (!selectedResource) return;
    onAdd({
      chartId,
      resourceId: selectedResource.id,
      name: `${selectedResource.firstName} ${selectedResource.lastName}`,
      title: selectedResource.jobTitle || null,
      department: selectedResource.department || null,
      email: selectedResource.email || null,
      phone: selectedResource.phone || null,
      photoUrl: selectedResource.photoUrl || null,
      parentMemberId: parentMemberId === "none" ? null : parseInt(parentMemberId),
      sortOrder: 0,
    });
    handleReset();
  };

  const handleAddManual = () => {
    if (!manualName.trim()) return;
    onAdd({
      chartId,
      name: manualName.trim(),
      title: manualTitle || null,
      department: manualDept || null,
      email: manualEmail || null,
      phone: manualPhone || null,
      photoUrl: manualPhotoUrl || null,
      parentMemberId: manualParent === "none" ? null : parseInt(manualParent),
      sortOrder: 0,
    });
    handleReset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) handleReset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="resources" className="flex-1" data-testid="tab-from-resources">From Resources</TabsTrigger>
            <TabsTrigger value="manual" className="flex-1" data-testid="tab-manual-entry">Manual Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="resources" className="mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={resourceSearch}
                onChange={e => setResourceSearch(e.target.value)}
                placeholder="Search resources..."
                className="pl-8 h-8 text-sm"
                data-testid="input-search-resources"
              />
            </div>
            <ScrollArea className="h-[240px] border rounded-md">
              {filteredResources.length === 0 ? (
                <div className="flex items-center justify-center h-full py-8">
                  <p className="text-sm text-muted-foreground">No resources found</p>
                </div>
              ) : (
                <div className="p-1">
                  {filteredResources.map(r => (
                    <div
                      key={r.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded cursor-pointer hover-elevate",
                        selectedResource?.id === r.id && "bg-primary/10 ring-1 ring-primary/30",
                      )}
                      onClick={() => setSelectedResource(r)}
                      data-testid={`resource-item-${r.id}`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={r.photoUrl || undefined} />
                        <AvatarFallback className="text-xs">{getInitials(`${r.firstName} ${r.lastName}`)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{r.firstName} {r.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.jobTitle || "No title"}{r.department ? ` - ${r.department}` : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div>
              <Label className="text-xs text-muted-foreground">Reports To</Label>
              <Select value={parentMemberId} onValueChange={setParentMemberId}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-parent-resource">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None - Top Level</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleAddFromResource} disabled={!selectedResource} data-testid="button-add-from-resource">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="manual" className="mt-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Name *</Label>
              <Input value={manualName} onChange={e => setManualName(e.target.value)} className="h-8 text-sm" data-testid="input-manual-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Title</Label>
                <Input value={manualTitle} onChange={e => setManualTitle(e.target.value)} className="h-8 text-sm" data-testid="input-manual-title" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Department</Label>
                <Input value={manualDept} onChange={e => setManualDept(e.target.value)} className="h-8 text-sm" data-testid="input-manual-department" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={manualEmail} onChange={e => setManualEmail(e.target.value)} className="h-8 text-sm" data-testid="input-manual-email" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input value={manualPhone} onChange={e => setManualPhone(e.target.value)} className="h-8 text-sm" data-testid="input-manual-phone" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Photo URL</Label>
              <Input value={manualPhotoUrl} onChange={e => setManualPhotoUrl(e.target.value)} className="h-8 text-sm" data-testid="input-manual-photo" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Reports To</Label>
              <Select value={manualParent} onValueChange={setManualParent}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-parent-manual">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None - Top Level</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleAddManual} disabled={!manualName.trim()} data-testid="button-add-manual">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function OrgChartEditor({ chart, onBack }: { chart: OrgChart; onBack: () => void }) {
  return (
    <ReactFlowProvider>
      <OrgChartEditorInner chart={chart} onBack={onBack} />
    </ReactFlowProvider>
  );
}

type CatalogueViewMode = "grid" | "list";
type SortField = "name" | "createdAt" | "memberCount";
type SortDir = "asc" | "desc";

function OrgChartCatalogue({ onSelectChart }: { onSelectChart: (chart: OrgChart) => void }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createType, setCreateType] = useState("department");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState<OrgChart | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [catalogueView, setCatalogueView] = useState<CatalogueViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data: charts = [], isLoading } = useQuery<OrgChart[]>({
    queryKey: [`/api/org-charts?tenantId=1`],
  });

  const filteredAndSortedCharts = useMemo(() => {
    let result = [...charts];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
      );
    }
    if (filterType !== "all") {
      result = result.filter(c => c.chartType === filterType);
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === "createdAt") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === "memberCount") {
        const aCount = (a.metadata as any)?.memberCount ?? 0;
        const bCount = (b.metadata as any)?.memberCount ?? 0;
        cmp = aCount - bCount;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [charts, searchQuery, filterType, sortField, sortDir]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/org-charts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/org-charts") });
      setShowCreate(false);
      setCreateName("");
      setCreateDescription("");
      setCreateType("department");
      toast({ title: "Org chart created" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/org-charts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/org-charts") });
      toast({ title: "Org chart deleted" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      apiRequest("POST", `/api/org-charts/${id}/duplicate`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/org-charts") });
      setShowDuplicateDialog(null);
      setDuplicateName("");
      toast({ title: "Org chart duplicated" });
    },
    onError: (err: any) => {
      toast({ title: "Duplicate failed", description: err.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!createName.trim()) return;
    createMutation.mutate({
      tenantId: 1,
      name: createName.trim(),
      description: createDescription || null,
      chartType: createType,
      showPhotos: true,
    });
  };

  const handleDuplicate = () => {
    if (!duplicateName.trim() || !showDuplicateDialog) return;
    duplicateMutation.mutate({ id: showDuplicateDialog.id, name: duplicateName.trim() });
  };

  const getMemberCount = (chart: OrgChart) => {
    if (chart.metadata && typeof chart.metadata === "object" && "memberCount" in (chart.metadata as any)) {
      return (chart.metadata as any).memberCount;
    }
    return 0;
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const deleteChartName = showDeleteConfirm !== null
    ? charts.find(c => c.id === showDeleteConfirm)?.name || "this org chart"
    : "";

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-orgcharts-title">Org Charts</h1>
            <p className="text-sm text-muted-foreground mt-1">Create and manage organizational charts</p>
          </div>
          <Button onClick={() => setShowCreate(true)} data-testid="button-create-orgchart">
            <Plus className="h-4 w-4 mr-2" />
            New Org Chart
          </Button>
        </div>

        {charts.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-[300px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search org charts..."
                className="h-8 text-sm pl-8"
                data-testid="input-search-catalogue"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 w-[150px] text-xs" data-testid="select-filter-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {CHART_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-sort">
                  <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => toggleSort("name")} data-testid="sort-name">
                  <Type className="h-3.5 w-3.5 mr-2" />
                  Name {sortField === "name" && (sortDir === "asc" ? "\u2191" : "\u2193")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleSort("createdAt")} data-testid="sort-date">
                  <Calendar className="h-3.5 w-3.5 mr-2" />
                  Date Created {sortField === "createdAt" && (sortDir === "asc" ? "\u2191" : "\u2193")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleSort("memberCount")} data-testid="sort-members">
                  <Users className="h-3.5 w-3.5 mr-2" />
                  Members {sortField === "memberCount" && (sortDir === "asc" ? "\u2191" : "\u2193")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex items-center border rounded-md overflow-visible ml-auto">
              <Button
                size="sm"
                variant="ghost"
                className={cn("rounded-r-none toggle-elevate px-2", catalogueView === "grid" && "toggle-elevated")}
                onClick={() => setCatalogueView("grid")}
                data-testid="button-view-grid"
                title="Thumbnail View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={cn("rounded-l-none toggle-elevate px-2", catalogueView === "list" && "toggle-elevated")}
                onClick={() => setCatalogueView("list")}
                data-testid="button-view-list"
                title="List View"
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <BpmCardGridSkeleton count={6} />
        ) : charts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2" data-testid="text-no-orgcharts">No Org Charts Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create your first organizational chart to visualize your team structure</p>
              <Button onClick={() => setShowCreate(true)} data-testid="button-create-first-orgchart">
                <Plus className="h-4 w-4 mr-2" />
                Create Org Chart
              </Button>
            </CardContent>
          </Card>
        ) : filteredAndSortedCharts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Search className="h-8 w-8 mb-3" />
            <p className="text-sm">No org charts match your search or filter</p>
          </div>
        ) : catalogueView === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedCharts.map(chart => (
              <Card
                key={chart.id}
                className="hover-elevate cursor-pointer group"
                onClick={() => onSelectChart(chart)}
                data-testid={`card-orgchart-${chart.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground truncate" data-testid={`text-orgchart-name-${chart.id}`}>{chart.name}</h3>
                      {chart.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{chart.description}</p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="shrink-0 invisible group-hover:visible"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`button-actions-orgchart-${chart.id}`}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          onClick={() => {
                            setShowDuplicateDialog(chart);
                            setDuplicateName(`${chart.name} (Copy)`);
                          }}
                          data-testid={`button-duplicate-orgchart-${chart.id}`}
                        >
                          <Copy className="h-3.5 w-3.5 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setShowDeleteConfirm(chart.id)}
                          data-testid={`button-delete-orgchart-${chart.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Badge variant="outline" className="text-xs">{getChartTypeLabel(chart.chartType)}</Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {getMemberCount(chart)} members
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Created {new Date(chart.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="divide-y">
              {filteredAndSortedCharts.map(chart => (
                <div
                  key={chart.id}
                  className="flex items-center gap-4 px-4 py-3 hover-elevate cursor-pointer group"
                  onClick={() => onSelectChart(chart)}
                  data-testid={`row-orgchart-${chart.id}`}
                >
                  <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground truncate" data-testid={`text-orgchart-name-${chart.id}`}>{chart.name}</h3>
                    {chart.description && (
                      <p className="text-xs text-muted-foreground truncate">{chart.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{getChartTypeLabel(chart.chartType)}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 w-[80px]">
                    <Users className="h-3 w-3" />
                    {getMemberCount(chart)} members
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 w-[100px]">
                    {new Date(chart.createdAt).toLocaleDateString()}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 invisible group-hover:visible"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`button-actions-orgchart-list-${chart.id}`}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem
                        onClick={() => {
                          setShowDuplicateDialog(chart);
                          setDuplicateName(`${chart.name} (Copy)`);
                        }}
                        data-testid={`button-duplicate-orgchart-list-${chart.id}`}
                      >
                        <Copy className="h-3.5 w-3.5 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setShowDeleteConfirm(chart.id)}
                        data-testid={`button-delete-orgchart-list-${chart.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Org Chart</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Name *</Label>
              <Input
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="e.g., Engineering Department"
                className="h-8 text-sm"
                data-testid="input-create-name"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                value={createDescription}
                onChange={e => setCreateDescription(e.target.value)}
                placeholder="Optional description..."
                className="text-sm"
                rows={3}
                data-testid="input-create-description"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Chart Type</Label>
              <Select value={createType} onValueChange={setCreateType}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-create-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHART_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!createName.trim() || createMutation.isPending}
              data-testid="button-submit-create"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Org Chart</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong className="text-foreground">{deleteChartName}</strong>? This action cannot be undone and all members will be permanently removed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (showDeleteConfirm !== null) {
                  deleteMutation.mutate(showDeleteConfirm);
                  setShowDeleteConfirm(null);
                }
              }}
              data-testid="button-confirm-delete-orgchart"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDuplicateDialog !== null} onOpenChange={() => { setShowDuplicateDialog(null); setDuplicateName(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Org Chart</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            Create a copy of <strong className="text-foreground">{showDuplicateDialog?.name}</strong> with all its members.
          </p>
          <div>
            <Label className="text-xs text-muted-foreground">New Chart Name *</Label>
            <Input
              value={duplicateName}
              onChange={e => setDuplicateName(e.target.value)}
              placeholder="Enter name for the copy..."
              className="h-8 text-sm"
              autoFocus
              data-testid="input-duplicate-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDuplicateDialog(null); setDuplicateName(""); }}>Cancel</Button>
            <Button
              onClick={handleDuplicate}
              disabled={!duplicateName.trim() || duplicateMutation.isPending}
              data-testid="button-submit-duplicate"
            >
              {duplicateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function OrgChartView() {
  const [selectedChart, setSelectedChart] = useState<OrgChart | null>(null);

  if (selectedChart) {
    return <OrgChartEditor chart={selectedChart} onBack={() => setSelectedChart(null)} />;
  }

  return <OrgChartCatalogue onSelectChart={setSelectedChart} />;
}
