import { useState, useMemo, lazy, Suspense, useRef, useCallback } from "react";
import { useModuleTabUrl } from "@/hooks/use-module-tab-url";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  FormDialogShell,
  FormDialogViewShell,
  FieldGrid,
  FieldLabel
} from "@/components/ui/form-dialog-shell";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { type ColumnDef, type GroupDef } from "@/components/MondayTable";
import { MondayBoardShell } from "@/components/board";
import { useMondayBoardShellState } from "@/hooks/use-monday-board-shell-state";
import { matchBoardFilterValue } from "@/lib/board-filters";
import { useDebouncedValue, downloadBoardCsv, downloadImportTemplateCsv } from "@/lib/crm-monday-chrome";
import { useToast } from "@/hooks/use-toast";
import { ModuleShell } from "@/components/ModuleShell";
import { cn } from "@/lib/utils";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import {
  modulePageBannerWrapClass,
  modulePageContentOuterClass,
  modulePageContentScrollClass,
  modulePageMainClass,
  modulePageShellClass,
  modulePageStickyHeaderClass,
  modulePageTabsListClass,
  modulePageTabsWrapClass,
  modulePageTabTriggerClass,
  ModuleTabLoading,
} from "@/components/ModulePageChrome";
import {
  Plus, Search, Loader2, Trash2, Bookmark, LayoutTemplate, Upload,
  Workflow, FileText, Building2, Network, Database, GitBranch, Layers,
  FolderOpen, Library, ChevronDown, ChevronRight, BookOpen, LayoutGrid, List, Clock,
  Target, Users, Lightbulb, CheckCircle2, Play, Eye, Edit3,
  LogIn, LogOut, Timer, X, Link2, Unlink, ExternalLink, Rows3, Columns3,
  Download, Image, FileDown, LayoutList, Columns2, ClipboardCopy, MoreVertical, Copy, ClipboardList,
  ArrowLeftRight, FolderTree, Sparkles, PanelRightOpen, PanelRightClose,
  ChevronsDownUp, Server,
} from "lucide-react";
import {
  BpmLibraryIcon,
  BpmDiagramsIcon,
  BpmPortalIcon,
  BpmArchitectureIcon,
  BpmOrgChartIcon,
  BpmFrameworksIcon,
} from "@/components/icons/ModuleIcons";

import type { ProcessResource } from "@shared/models/bpm";
import { parseCsvContent, buildDiagramFromRows, generateBlankTemplate, type ParsedProcessRow } from "@/components/bpm/BpmTableView";
const BpmlView = lazy(() => import("@/components/bpm/BpmlView"));
const OrgChartView = lazy(() => import("@/components/bpm/OrgChartView"));
import { PortalAssetPanel } from "@/components/bpm/PortalAssetPanel";
import { PortalSettingsDialog } from "@/components/bpm/PortalSettingsDialog";
import { BpmDeltaReportTable } from "@/components/bpm/BpmDeltaReportTable";
import { BpmTemplatePipeline } from "@/components/bpm/BpmTemplatePipeline";
import { SaveAsPlatformTemplateDialog } from "@/components/templates/SaveAsPlatformTemplateDialog";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { BpmLoadingState, BpmCardGridSkeleton } from "@/components/bpm/BpmLoadingState";
import { bpmFetchJson } from "@/lib/bpm-api";
import { ModuleTrackingBoard } from "@/components/workspaces/ModuleTrackingBoard";

import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
  BackgroundVariant,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "@/components/bpm/BpmNodeTypes";

const BpmCanvasEditor = lazy(() => import("@/components/bpm/BpmCanvasEditor"));

const BPM_QUERY_STALE_MS = 30_000;

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

type BpmLibrary = {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  vendor: string | null;
  projectId?: number | null;
  status?: string | null;
  ownerId?: string | null;
  systemTag?: string | null;
  isTemplateLibrary?: boolean | null;
  createdAt: string;
};

type FrameworkDocLink = {
  itemText: string;
  documentId: number;
  documentTitle: string;
};

type FrameworkPhase = {
  id: string;
  name: string;
  description: string;
  order: number;
  deliverables: string[];
  gates: string[];
  color?: string;
  purpose?: string;
  activities?: string[];
  inputs?: string[];
  outputs?: string[];
  owners?: string[];
  duration?: string;
  tips?: string[];
  docLinks?: FrameworkDocLink[];
};

type FrameworkItem = {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  category: string;
  vendor: string | null;
  version: string | null;
  status: string;
  phases: FrameworkPhase[];
  metadata: any;
  tags: string[] | null;
  isBuiltIn: boolean | null;
  createdAt: string;
  updatedAt: string;
};

const DIAGRAM_TYPE_OPTIONS = [
  { value: "process_flow", label: "Business Process Flow", icon: Workflow, description: "Swimlane process diagrams with BPMN notation" },
  { value: "flowchart", label: "Flowchart", icon: GitBranch, description: "Simple flow diagrams" },
  { value: "org_chart", label: "Org Chart", icon: Building2, description: "Organization structure" },
  { value: "architecture", label: "Architecture Diagram", icon: Layers, description: "System architecture views" },
  { value: "system_landscape", label: "System Landscape", icon: Layers, description: "All systems in scope and relationships" },
  { value: "integration_architecture", label: "Integration Architecture", icon: Network, description: "Interfaces and data flows between systems" },
  { value: "data_flow", label: "Data Flow Diagram", icon: GitBranch, description: "Data movement through systems" },
  { value: "network", label: "Network Diagram", icon: Network, description: "Network topology" },
  { value: "raci_matrix", label: "RACI Matrix", icon: Users, description: "Responsibility assignment matrix" },
  { value: "deployment", label: "Deployment Diagram", icon: Server, description: "Software deployment across infrastructure" },
  { value: "database_diagram", label: "Database Diagram", icon: Database, description: "ER diagrams" },
  { value: "workflow", label: "Workflow Diagram", icon: GitBranch, description: "Approval and automation flows" },
  { value: "custom", label: "Custom", icon: FolderOpen, description: "User-defined diagram type" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-status-amber/20 text-status-amber-foreground",
  review: "bg-status-blue/20 text-status-blue-foreground",
  first_review: "bg-status-blue/20 text-status-blue-foreground",
  second_review: "bg-status-blue/20 text-status-blue-foreground",
  awaiting_approval: "bg-status-purple/20 text-status-purple-foreground",
  approved: "bg-status-green/20 text-status-green-foreground",
  published: "bg-status-purple/20 text-status-purple-foreground",
  final: "bg-status-green/20 text-status-green-foreground",
};

const SECTION_TYPE_FILTERS: Record<string, string[]> = {
  process: ["process_flow", "flowchart", "workflow"],
  architecture: ["architecture", "network", "database_diagram", "system_landscape", "integration_architecture", "data_flow", "raci_matrix", "deployment", "custom"],
};

const PROCESS_TEMPLATES: Record<string, { name: string; description: string; nodes: any[]; edges: any[] }> = {
  purchase_to_pay: {
    name: "Purchase to Pay (P2P)",
    description: "End-to-end purchasing process from requisition to payment",
    nodes: [
      { id: "p2p_start", type: "start", position: { x: 50, y: 200 }, data: { label: "Start", attributes: {}, style: {}, nodeType: "start" } },
      { id: "p2p_1", type: "task", position: { x: 200, y: 180 }, data: { label: "Create Purchase Requisition", attributes: { cost: 50, duration: 1, resources: 1, department: "Procurement" }, style: {}, nodeType: "task" } },
      { id: "p2p_d1", type: "decision", position: { x: 420, y: 190 }, data: { label: "Approved?", attributes: {}, style: {}, nodeType: "decision" } },
      { id: "p2p_2", type: "task", position: { x: 600, y: 180 }, data: { label: "Create Purchase Order", attributes: { cost: 30, duration: 0.5, resources: 1, department: "Procurement", systemUsed: "ERP" }, style: {}, nodeType: "task" } },
      { id: "p2p_3", type: "task", position: { x: 820, y: 180 }, data: { label: "Send PO to Supplier", attributes: { cost: 10, duration: 0.25, resources: 1 }, style: {}, nodeType: "task" } },
      { id: "p2p_4", type: "task", position: { x: 200, y: 340 }, data: { label: "Receive Goods / Services", attributes: { cost: 100, duration: 2, resources: 2, department: "Warehouse" }, style: {}, nodeType: "task" } },
      { id: "p2p_5", type: "task", position: { x: 420, y: 340 }, data: { label: "Three-Way Match", attributes: { cost: 40, duration: 1, resources: 1, department: "Finance", systemUsed: "ERP" }, style: {}, nodeType: "task" } },
      { id: "p2p_d2", type: "decision", position: { x: 640, y: 350 }, data: { label: "Match OK?", attributes: {}, style: {}, nodeType: "decision" } },
      { id: "p2p_6", type: "task", position: { x: 820, y: 340 }, data: { label: "Process Invoice Payment", attributes: { cost: 25, duration: 0.5, resources: 1, department: "Finance" }, style: {}, nodeType: "task" } },
      { id: "p2p_end", type: "end", position: { x: 1040, y: 355 }, data: { label: "End", attributes: {}, style: {}, nodeType: "end" } },
      { id: "p2p_doc1", type: "document", position: { x: 820, y: 60 }, data: { label: "Purchase Order", attributes: {}, style: {}, nodeType: "document" } },
    ],
    edges: [
      { id: "p2p_e1", source: "p2p_start", target: "p2p_1", type: "smoothstep" },
      { id: "p2p_e2", source: "p2p_1", target: "p2p_d1", type: "smoothstep" },
      { id: "p2p_e3", source: "p2p_d1", target: "p2p_2", type: "smoothstep", label: "Yes" },
      { id: "p2p_e4", source: "p2p_d1", target: "p2p_1", type: "smoothstep", label: "No" },
      { id: "p2p_e5", source: "p2p_2", target: "p2p_3", type: "smoothstep" },
      { id: "p2p_e6", source: "p2p_3", target: "p2p_4", type: "smoothstep" },
      { id: "p2p_e7", source: "p2p_4", target: "p2p_5", type: "smoothstep" },
      { id: "p2p_e8", source: "p2p_5", target: "p2p_d2", type: "smoothstep" },
      { id: "p2p_e9", source: "p2p_d2", target: "p2p_6", type: "smoothstep", label: "Yes" },
      { id: "p2p_e10", source: "p2p_d2", target: "p2p_5", type: "smoothstep", label: "No" },
      { id: "p2p_e11", source: "p2p_6", target: "p2p_end", type: "smoothstep" },
      { id: "p2p_e12", source: "p2p_2", target: "p2p_doc1", type: "smoothstep" },
    ],
  },
  order_to_cash: {
    name: "Order to Cash (O2C)",
    description: "End-to-end sales process from order to revenue collection",
    nodes: [
      { id: "o2c_start", type: "start", position: { x: 50, y: 200 }, data: { label: "Start", attributes: {}, style: {}, nodeType: "start" } },
      { id: "o2c_1", type: "task", position: { x: 200, y: 180 }, data: { label: "Receive Customer Order", attributes: { cost: 20, duration: 0.5, resources: 1, department: "Sales" }, style: {}, nodeType: "task" } },
      { id: "o2c_d1", type: "decision", position: { x: 420, y: 190 }, data: { label: "Credit Check OK?", attributes: {}, style: {}, nodeType: "decision" } },
      { id: "o2c_2", type: "task", position: { x: 600, y: 180 }, data: { label: "Create Sales Order", attributes: { cost: 15, duration: 0.25, resources: 1, department: "Sales", systemUsed: "CRM" }, style: {}, nodeType: "task" } },
      { id: "o2c_3", type: "task", position: { x: 820, y: 180 }, data: { label: "Pick, Pack & Ship", attributes: { cost: 200, duration: 4, resources: 3, department: "Warehouse" }, style: {}, nodeType: "task" } },
      { id: "o2c_4", type: "task", position: { x: 200, y: 340 }, data: { label: "Generate Invoice", attributes: { cost: 25, duration: 0.5, resources: 1, department: "Finance", systemUsed: "ERP" }, style: {}, nodeType: "task" } },
      { id: "o2c_5", type: "task", position: { x: 420, y: 340 }, data: { label: "Send Invoice to Customer", attributes: { cost: 5, duration: 0.25, resources: 1 }, style: {}, nodeType: "task" } },
      { id: "o2c_6", type: "task", position: { x: 640, y: 340 }, data: { label: "Receive Payment", attributes: { cost: 10, duration: 1, resources: 1, department: "Finance" }, style: {}, nodeType: "task" } },
      { id: "o2c_7", type: "task", position: { x: 860, y: 340 }, data: { label: "Record & Reconcile", attributes: { cost: 30, duration: 1, resources: 1, department: "Finance", systemUsed: "ERP" }, style: {}, nodeType: "task" } },
      { id: "o2c_end", type: "end", position: { x: 1060, y: 355 }, data: { label: "End", attributes: {}, style: {}, nodeType: "end" } },
      { id: "o2c_sys1", type: "system", position: { x: 600, y: 60 }, data: { label: "CRM System", attributes: {}, style: {}, nodeType: "system" } },
    ],
    edges: [
      { id: "o2c_e1", source: "o2c_start", target: "o2c_1", type: "smoothstep" },
      { id: "o2c_e2", source: "o2c_1", target: "o2c_d1", type: "smoothstep" },
      { id: "o2c_e3", source: "o2c_d1", target: "o2c_2", type: "smoothstep", label: "Yes" },
      { id: "o2c_e4", source: "o2c_d1", target: "o2c_1", type: "smoothstep", label: "No" },
      { id: "o2c_e5", source: "o2c_2", target: "o2c_3", type: "smoothstep" },
      { id: "o2c_e6", source: "o2c_3", target: "o2c_4", type: "smoothstep" },
      { id: "o2c_e7", source: "o2c_4", target: "o2c_5", type: "smoothstep" },
      { id: "o2c_e8", source: "o2c_5", target: "o2c_6", type: "smoothstep" },
      { id: "o2c_e9", source: "o2c_6", target: "o2c_7", type: "smoothstep" },
      { id: "o2c_e10", source: "o2c_7", target: "o2c_end", type: "smoothstep" },
      { id: "o2c_e11", source: "o2c_2", target: "o2c_sys1", type: "smoothstep" },
    ],
  },
  blank: {
    name: "Blank Canvas",
    description: "Start from scratch with an empty canvas",
    nodes: [],
    edges: [],
  },
};

const FRAMEWORK_CATEGORIES = [
  { value: "project_delivery", label: "Project Delivery", icon: Workflow },
  { value: "customer_lifecycle", label: "Customer Lifecycle", icon: Network },
  { value: "itsm", label: "IT Service Management", icon: Layers },
  { value: "pm_standards", label: "Project Management", icon: FileText },
  { value: "quality_testing", label: "Quality & Testing", icon: GitBranch },
  { value: "support_ops", label: "Support & Operations", icon: Building2 },
  { value: "change_risk", label: "Change & Risk", icon: Database },
  { value: "sdlc", label: "Software Development", icon: GitBranch },
  { value: "other", label: "Other", icon: FolderOpen },
];

const FRAMEWORK_STATUS_COLORS: Record<string, string> = {
  draft: "bg-status-amber/20 text-status-amber-foreground",
  review: "bg-status-blue/20 text-status-blue-foreground",
  approved: "bg-status-green/20 text-status-green-foreground",
  published: "bg-status-purple/20 text-status-purple-foreground",
  archived: "bg-muted text-muted-foreground",
};

const PHASE_COLORS = [
  "#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
];

const SAP_ACTIVATE_PHASES: FrameworkPhase[] = [
  {
    id: "phase_sap_1", name: "Discover", description: "Understand the business needs, evaluate SAP solutions, and build the business case", order: 0,
    color: "#3B82F6", deliverables: ["Business Case Document", "Solution Scope Definition", "High-Level Architecture"],
    gates: ["Business Case Approved", "Executive Sponsorship Confirmed"],
    purpose: "Evaluate the organization's current landscape and future requirements. Understand SAP solution capabilities and build a compelling business case for transformation.",
    activities: ["Conduct stakeholder interviews and workshops", "Analyze current business processes and pain points", "Evaluate SAP solution fit and capabilities", "Develop high-level solution architecture", "Prepare total cost of ownership analysis", "Create transformation roadmap"],
    inputs: ["Current IT landscape documentation", "Business strategy documents", "Industry best practices", "SAP reference architectures"],
    outputs: ["Business Case Document", "Solution Scope Definition", "High-Level Architecture", "Transformation Roadmap"],
    owners: ["Executive Sponsor", "Program Director", "Solution Architect", "Business Process Owners"],
    duration: "4-8 weeks",
    tips: ["Engage C-level stakeholders early for alignment", "Use SAP Model Company as a starting accelerator", "Focus on business outcomes rather than technical features", "Document assumptions and constraints clearly"],
  },
  {
    id: "phase_sap_2", name: "Prepare", description: "Set up the project governance, team, infrastructure, and detailed planning", order: 1,
    color: "#22C55E", deliverables: ["Project Charter", "Detailed Project Plan", "Team Onboarding Complete", "System Provisioned"],
    gates: ["Project Team Mobilized", "Governance Structure Approved", "Environment Ready"],
    purpose: "Establish project foundations including governance, team structure, methodology, tools, and infrastructure to ensure successful delivery.",
    activities: ["Define project governance and RACI matrix", "Mobilize and onboard project team", "Provision SAP environments (sandbox, dev, QA)", "Set up project management tools and standards", "Conduct solution overview workshops", "Establish change management approach"],
    inputs: ["Approved business case", "SAP best practice content", "Organization structure", "Resource availability"],
    outputs: ["Project Charter", "Detailed Project Plan", "Team Onboarding Package", "Communication Plan", "Risk Register"],
    owners: ["Project Manager", "PMO Lead", "Basis Administrator", "Change Manager"],
    duration: "3-5 weeks",
    tips: ["Invest in proper team onboarding and SAP training", "Establish clear escalation paths from day one", "Set up automated CI/CD pipelines early", "Define clear roles especially for hybrid teams"],
  },
  {
    id: "phase_sap_3", name: "Explore", description: "Validate standard SAP processes, identify gaps, and confirm the solution design", order: 2,
    color: "#F59E0B", deliverables: ["Fit-to-Standard Analysis", "Solution Design Document", "Gap Analysis Report", "Process Flow Diagrams"],
    gates: ["Solution Design Approved", "Gap Resolution Strategy Agreed", "Backlog Prioritized"],
    purpose: "Conduct fit-to-standard workshops to validate SAP best practices against business requirements. Identify gaps and define the target solution design.",
    activities: ["Run fit-to-standard workshops per business area", "Demonstrate SAP best practice processes", "Document confirmed processes and delta requirements", "Perform gap analysis and categorize gaps", "Define integration requirements", "Create solution design documentation"],
    inputs: ["SAP Best Practice process flows", "Business requirements", "Current process documentation", "Integration landscape map"],
    outputs: ["Fit-to-Standard Analysis", "Solution Design Document", "Gap Analysis Report", "Integration Design", "Data Migration Strategy"],
    owners: ["Solution Architect", "Business Process Leads", "Integration Architect", "Functional Consultants"],
    duration: "6-10 weeks",
    tips: ["Challenge every custom requirement against SAP standard", "Prioritize gaps using MoSCoW method", "Involve end users in fit-to-standard workshops", "Document decisions and rationale for future reference"],
  },
  {
    id: "phase_sap_4", name: "Realize", description: "Configure, develop, test, and validate the solution iteratively", order: 3,
    color: "#8B5CF6", deliverables: ["Configured SAP System", "Custom Developments", "Test Results", "Training Materials"],
    gates: ["Unit Testing Complete", "Integration Testing Passed", "User Acceptance Sign-off"],
    purpose: "Build and validate the SAP solution through iterative configuration, development, testing, and knowledge transfer in sprint cycles.",
    activities: ["Configure SAP system per solution design", "Develop custom objects (reports, interfaces, conversions, enhancements, forms, workflows)", "Execute unit and integration testing", "Perform data migration dry runs", "Develop end-user training materials", "Conduct sprint demos and retrospectives"],
    inputs: ["Approved solution design", "Gap resolution approach", "Test strategy", "Data migration strategy"],
    outputs: ["Configured SAP System", "Custom Development Objects", "Test Results and Defect Log", "Training Materials", "Migration Scripts"],
    owners: ["Technical Lead", "Functional Consultants", "ABAP Developers", "Test Manager", "Training Lead"],
    duration: "10-16 weeks",
    tips: ["Use agile sprints with 2-3 week iterations", "Automate regression testing early", "Conduct data migration rehearsals before go-live", "Track technical debt and address it within the project"],
  },
  {
    id: "phase_sap_5", name: "Deploy", description: "Execute cutover, go-live preparation, and transition to production", order: 4,
    color: "#EC4899", deliverables: ["Go-Live Checklist", "Cutover Plan Executed", "Production System Live", "Hypercare Support Plan"],
    gates: ["Go-Live Readiness Approved", "Cutover Rehearsal Successful", "Production Validation Complete"],
    purpose: "Prepare for and execute the transition to the production environment, including final data migration, cutover activities, and go-live validation.",
    activities: ["Execute go-live readiness assessment", "Perform cutover rehearsal", "Execute final data migration", "Conduct end-user training sessions", "Activate production system", "Begin hypercare support period"],
    inputs: ["Tested and signed-off system", "Cutover plan", "Training materials", "Go-live readiness checklist"],
    outputs: ["Go-Live Checklist Complete", "Production System Active", "Hypercare Support Plan", "Known Issues Log", "Operational Handover Document"],
    owners: ["Project Manager", "Cutover Lead", "Basis Team", "Change Manager", "Support Lead"],
    duration: "3-5 weeks",
    tips: ["Rehearse cutover at least twice before actual go-live", "Have rollback plan ready and tested", "Ensure 24/7 support coverage for first week", "Communicate go-live milestones to all stakeholders"],
  },
  {
    id: "phase_sap_6", name: "Run", description: "Stabilize operations, optimize processes, and transition to BAU support", order: 5,
    color: "#14B8A6", deliverables: ["Operational Handbook", "Optimization Roadmap", "BAU Support Model", "Lessons Learned Report"],
    gates: ["Hypercare Period Closed", "BAU Support Transitioned", "Project Closure Approved"],
    purpose: "Stabilize the production environment, optimize business processes based on real usage data, and formally transition to business-as-usual operations.",
    activities: ["Monitor system performance and resolve issues", "Optimize business processes based on feedback", "Transition knowledge to BAU support team", "Conduct lessons learned workshops", "Plan continuous improvement initiatives", "Execute formal project closure"],
    inputs: ["Production system metrics", "User feedback", "Known issues log", "Support ticket trends"],
    outputs: ["Operational Handbook", "Optimization Roadmap", "BAU Support Model", "Lessons Learned Report", "Project Closure Report"],
    owners: ["IT Operations Manager", "Business Process Owners", "Support Team Lead", "Project Manager"],
    duration: "4-8 weeks (then ongoing)",
    tips: ["Establish KPIs to measure adoption and value realization", "Create a community of practice for SAP users", "Plan quarterly business reviews to identify optimization opportunities", "Document workarounds and ensure they are resolved in future releases"],
  },
];

const WORKDAY_PHASES: FrameworkPhase[] = [
  {
    id: "phase_wd_1", name: "Planning & Initiation", description: "Set project foundation, scope, governance, timelines", order: 0,
    color: "#3B82F6", deliverables: ["Project charter", "RACI matrix", "High-level project plan", "Kick-off presentation"],
    gates: ["Scope Signed Off", "Governance Structure Approved", "Project Team Confirmed"],
    purpose: "Set project foundation, scope, governance, timelines. Align stakeholders early and set expectations for scope, timelines, and roles.",
    activities: ["Define project scope & objectives", "Establish governance structure", "Identify project team & RACI", "Kick-off meeting"],
    inputs: ["Business goals", "Current systems landscape", "Organizational charts"],
    outputs: ["Project charter", "RACI matrix", "High-level project plan", "Kick-off presentation"],
    owners: ["Project Manager", "Client Sponsor", "Workday Consultant"],
    duration: "2-4 weeks",
    tips: ["Align stakeholders early; set expectations for scope, timelines, and roles", "Define clear decision-making authority from day one", "Establish communication cadence with all stakeholder groups"],
  },
  {
    id: "phase_wd_2", name: "Discovery / Requirements", description: "Capture current state, business processes, and requirements", order: 1,
    color: "#22C55E", deliverables: ["Detailed requirements document", "Business process maps", "Gap analysis report"],
    gates: ["Requirements Signed Off", "Gap Analysis Complete", "Integration Requirements Defined"],
    purpose: "Capture current state, business processes, and requirements. Identify gaps versus Workday standard and define reporting and integration requirements.",
    activities: ["Conduct workshops & interviews", "Document current processes", "Identify gaps vs Workday standard", "Define reporting & integration requirements"],
    inputs: ["Existing process documentation", "Stakeholder interviews", "Compliance & regulatory info"],
    outputs: ["Detailed requirements document", "Business process maps", "Gap analysis report"],
    owners: ["Functional Consultant", "Business Analyst", "Client SME"],
    duration: "4-6 weeks",
    tips: ["Use Jiganto to map Level 1-5 processes; highlight gaps & improvements", "Engage subject matter experts from every business area", "Document not just what processes exist but why they exist"],
  },
  {
    id: "phase_wd_3", name: "Design", description: "Translate requirements into Workday configuration blueprint", order: 2,
    color: "#F59E0B", deliverables: ["Configuration design workbook", "Integration & report design documents", "Design sign-off"],
    gates: ["Design Sign-Off Obtained", "Security Model Approved", "Integration Design Validated"],
    purpose: "Translate requirements into Workday configuration blueprint. Define the configuration approach, security roles, integrations, and reporting strategy.",
    activities: ["Define configuration approach", "Design security roles", "Map integrations & reporting", "Validate with stakeholders"],
    inputs: ["Requirements document", "Gap analysis", "Best practices & Workday templates"],
    outputs: ["Configuration design workbook", "Integration & report design documents", "Design sign-off"],
    owners: ["Functional Consultant", "Integration Lead", "Security Specialist"],
    duration: "3-5 weeks",
    tips: ["Review Workday standard processes vs client needs; formal sign-off required", "Leverage Workday delivered reports before building custom ones", "Consider future scalability in security role design"],
  },
  {
    id: "phase_wd_4", name: "Prototype / Build", description: "Configure Workday modules and build integrations", order: 3,
    color: "#8B5CF6", deliverables: ["Configured Workday tenant", "Unit test cases", "Integration designs built", "Reports/dashboards ready"],
    gates: ["Configuration Complete", "Unit Testing Passed", "Integration Build Verified"],
    purpose: "Configure Workday modules and build integrations. Develop security roles, reports, dashboards, and business process workflows in the tenant.",
    activities: ["Configure tenant modules", "Build business processes", "Develop security & roles", "Build reports & dashboards", "Configure integrations"],
    inputs: ["Design documents", "Workday tenant access", "Test data"],
    outputs: ["Configured Workday tenant", "Unit test cases", "Integration designs built", "Reports/dashboards ready"],
    owners: ["Workday Consultant", "Integration Lead", "Report Specialist"],
    duration: "6-10 weeks",
    tips: ["Iterative build recommended: one module at a time; use sandbox tenant", "Conduct weekly demo sessions to validate configurations with business users", "Track configuration decisions in a log for audit and future reference"],
  },
  {
    id: "phase_wd_5", name: "Testing", description: "Validate end-to-end processes, integrations, and reporting", order: 4,
    color: "#EC4899", deliverables: ["Test execution reports", "Defect logs", "Test sign-off", "Updated configuration"],
    gates: ["All Critical Defects Resolved", "End-to-End Testing Passed", "Test Sign-Off Obtained"],
    purpose: "Validate end-to-end processes, integrations, and reporting. Execute comprehensive test cycles covering unit, integration, and user acceptance testing.",
    activities: ["Unit testing per module", "Integration testing", "End-to-end business process testing", "Record defects & resolutions"],
    inputs: ["Configured tenant", "Test scenarios & scripts", "Test data"],
    outputs: ["Test execution reports", "Defect logs", "Test sign-off", "Updated configuration"],
    owners: ["QA Lead", "Functional Consultant", "Client SME"],
    duration: "4-6 weeks",
    tips: ["Include parallel testing tracks for Payroll, Finance, HCM; cover all Level 1-5 processes", "Involve end users in UAT early to build confidence", "Maintain a clear defect triage process with severity levels"],
  },
  {
    id: "phase_wd_6", name: "Deployment / Cutover", description: "Prepare for production go-live with minimal disruption", order: 5,
    color: "#F97316", deliverables: ["Cutover plan", "Data migration load files", "Training materials", "Go-live checklist"],
    gates: ["Cutover Rehearsal Complete", "Data Migration Validated", "Training Delivered"],
    purpose: "Prepare for production go-live with minimal disruption. Execute data migration, finalize training, and obtain final approvals for the production cutover.",
    activities: ["Develop cutover plan", "Data migration preparation", "Final approvals", "End-user communications", "Training plan finalized"],
    inputs: ["Test results", "Configuration & integration documentation", "Data migration templates"],
    outputs: ["Cutover plan", "Data migration load files", "Training materials", "Go-live checklist"],
    owners: ["Project Manager", "Data Migration Lead", "Client SME"],
    duration: "3-4 weeks",
    tips: ["Include parallel tracks for data conversion, user training, and change management", "Rehearse the cutover plan at least twice before the real event", "Prepare rollback procedures for critical data loads"],
  },
  {
    id: "phase_wd_7", name: "Go-Live", description: "Transition from legacy systems to Workday production", order: 6,
    color: "#14B8A6", deliverables: ["Live Workday system", "Initial support log", "User adoption metrics"],
    gates: ["Production System Active", "Legacy Systems Decommissioned", "Initial Support Coverage Confirmed"],
    purpose: "Transition from legacy systems to Workday production. Execute the cutover plan, load production data, activate security, and support initial operations.",
    activities: ["Execute cutover plan", "Load production data", "Activate security & roles", "Support initial operations"],
    inputs: ["Cutover plan", "Production tenant access", "Migrated data"],
    outputs: ["Live Workday system", "Initial support log", "User adoption metrics"],
    owners: ["Project Manager", "Workday Consultant", "IT Support"],
    duration: "1-2 weeks",
    tips: ["Plan for early hypercare support; ensure key users available during first days", "Have a war room setup for rapid issue resolution", "Communicate go-live success milestones to maintain momentum"],
  },
  {
    id: "phase_wd_8", name: "Post Go-Live / Hypercare", description: "Stabilize system, resolve issues, optimize processes", order: 7,
    color: "#6366F1", deliverables: ["Resolved issue log", "Operational handover documentation", "Optimization roadmap", "Lessons learned report"],
    gates: ["Hypercare Period Closed", "Operational Handover Complete", "Optimization Plan Approved"],
    purpose: "Stabilize system, resolve issues, optimize processes. Monitor performance, gather user feedback, conduct lessons learned, and plan future enhancements.",
    activities: ["Monitor system performance", "Resolve incidents & defects", "Review user feedback", "Conduct lessons learned sessions", "Plan optimization & enhancements"],
    inputs: ["Go-live feedback", "Incident logs", "Usage metrics"],
    outputs: ["Resolved issue log", "Operational handover documentation", "Optimization roadmap", "Lessons learned report"],
    owners: ["Project Manager", "Workday Consultant", "Support Team"],
    duration: "4-12 weeks",
    tips: ["Hypercare typically lasts 4-12 weeks; plan future improvements based on adoption data", "Track user adoption metrics weekly during hypercare", "Prioritize quick wins to build user confidence in the new system"],
  },
];

const FW_GROUPING_OPTIONS = [
  { value: "none", label: "No Grouping" },
  { value: "category", label: "Group by Category" },
  { value: "status", label: "Group by Status" },
  { value: "vendor", label: "Group by Vendor" },
];

const FW_TABLE_COLUMNS: ColumnDef<FrameworkItem>[] = [
  { id: "name", header: "Name", type: "text", accessor: "name", width: "minmax(200px, 2fr)", editable: true },
  {
    id: "category", header: "Category", type: "status", accessor: "category", editable: true,
    options: FRAMEWORK_CATEGORIES.map(c => ({ value: c.value, label: c.label, color: "bg-primary/10 text-primary" })),
  },
  {
    id: "status", header: "Status", type: "status", accessor: "status", editable: true,
    options: [
      { value: "draft", label: "Draft", color: FRAMEWORK_STATUS_COLORS.draft },
      { value: "review", label: "Review", color: FRAMEWORK_STATUS_COLORS.review },
      { value: "approved", label: "Approved", color: FRAMEWORK_STATUS_COLORS.approved },
      { value: "published", label: "Published", color: FRAMEWORK_STATUS_COLORS.published },
      { value: "archived", label: "Archived", color: FRAMEWORK_STATUS_COLORS.archived },
    ],
  },
  { id: "vendor", header: "Vendor", type: "text", accessor: (row: FrameworkItem) => row.vendor || "", editable: true },
  { id: "version", header: "Version", type: "text", accessor: (row: FrameworkItem) => row.version || "", width: "80px", editable: true },
  { id: "phases", header: "Phases", type: "number", accessor: (row: FrameworkItem) => Array.isArray(row.phases) ? row.phases.length : 0, width: "80px", editable: false },
  { id: "updatedAt", header: "Last Updated", type: "date", accessor: "updatedAt", width: "140px", editable: false },
];

function FrameworksCatalogue({ onOpenFramework, onCreateNew }: { onOpenFramework: (fw: FrameworkItem) => void; onCreateNew: () => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [filterCategory, setFilterCategory] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [groupBy, setGroupBy] = useState("none");

  const { data: frameworksList = [], isLoading } = useQuery<FrameworkItem[]>({
    queryKey: [`/api/frameworks`],
    staleTime: BPM_QUERY_STALE_MS,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/frameworks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/frameworks`] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/frameworks/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/frameworks`] }),
  });
  const filtered = useMemo(() => frameworksList.filter(fw => {
    const matchesSearch = !debouncedSearch || fw.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || fw.description?.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesCategory = filterCategory === "all" || fw.category === filterCategory;
    return matchesSearch && matchesCategory;
  }), [frameworksList, debouncedSearch, filterCategory]);
  const getCategoryLabel = (cat: string) => FRAMEWORK_CATEGORIES.find(c => c.value === cat)?.label || cat;
  const getCategoryIcon = (cat: string) => FRAMEWORK_CATEGORIES.find(c => c.value === cat)?.icon || FolderOpen;

  const FW_CSV_HEADERS = ["Name", "Category", "Status", "Vendor", "Version", "Phases", "Last Updated"];

  const exportFrameworks = () => {
    const rows = filtered.map((fw) => [
      fw.name || "",
      getCategoryLabel(fw.category),
      fw.status || "",
      fw.vendor || "",
      fw.version || "",
      String(Array.isArray(fw.phases) ? fw.phases.length : 0),
      fw.updatedAt ? String(fw.updatedAt) : "",
    ]);
    downloadBoardCsv(`frameworks-${new Date().toISOString().split("T")[0]}.csv`, FW_CSV_HEADERS, rows);
    toast({ title: "Frameworks exported to CSV" });
  };

  const downloadFrameworksTemplate = () => {
    downloadImportTemplateCsv("frameworks-import-template.csv", FW_CSV_HEADERS, FW_CSV_HEADERS.map(() => ""));
    toast({ title: "Import template downloaded" });
  };

  const importUnavailable = () => toast({ title: "Import is not available for this table yet" });

  const fwTableGroups = useMemo((): GroupDef<FrameworkItem>[] | undefined => {
    if (groupBy === "none") return undefined;
    const groupMap = new Map<string, FrameworkItem[]>();
    filtered.forEach(fw => {
      let key: string;
      if (groupBy === "category") key = fw.category;
      else if (groupBy === "status") key = fw.status;
      else key = fw.vendor || "No Vendor";
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(fw);
    });
    return Array.from(groupMap.entries()).map(([key, items]) => ({
      id: key,
      title: groupBy === "category" ? getCategoryLabel(key) : key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      color: groupBy === "status"
        ? { draft: "hsl(38, 92%, 50%)", review: "hsl(210, 100%, 50%)", approved: "hsl(142, 71%, 45%)", published: "hsl(270, 91%, 60%)", archived: "hsl(0, 0%, 50%)" }[key] || "hsl(221, 83%, 53%)"
        : "hsl(221, 83%, 53%)",
      items,
      count: items.length,
    }));
  }, [filtered, groupBy]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-frameworks-title">Frameworks & Methodologies</h1>
            <p className="text-sm text-muted-foreground mt-1">Define, document, and publish lifecycle frameworks and delivery methodologies</p>
          </div>
          <Button onClick={onCreateNew} data-testid="button-create-framework">
            <Plus className="h-4 w-4 mr-2" />
            New Framework
          </Button>
        </div>
        <MondayBoardShell.Legacy
          storageKey="jiganto-bpm-frameworks"
          entityType="bpm_framework"
          stateHook={useMondayBoardShellState}
          filterMatcher={matchBoardFilterValue}
        >
        <MondayBoardShell.Toolbar
          newLabel="New Framework"
          onNew={onCreateNew}
          newTestId="button-create-framework-toolbar"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search frameworks..."
          searchTestId="input-search-frameworks"
          viewLabel={viewMode === "table" ? "Table" : "Grid"}
          viewIcon={viewMode === "table" ? <List className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
          viewMenu={
            <>
              <DropdownMenuItem onClick={() => setViewMode("grid")} data-testid="button-fw-view-grid">Grid</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewMode("table")} data-testid="button-fw-view-table">Table</DropdownMenuItem>
            </>
          }
          filterActive={filterCategory !== "all"}
          filterCount={filterCategory !== "all" ? 1 : 0}
          filterContent={
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-filter-fw-category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {FRAMEWORK_CATEGORIES.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          }
          groupActive={groupBy !== "none"}
          groupLabel={groupBy === "none" ? "Group by" : (FW_GROUPING_OPTIONS.find(o => o.value === groupBy)?.label ?? "Group by")}
          groupContent={
            <>
              {FW_GROUPING_OPTIONS.map(opt => (
                <DropdownMenuItem key={opt.value} onClick={() => setGroupBy(opt.value)} data-testid={`fw-group-${opt.value}`}>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </>
          }
          grouped={viewMode === "table" && groupBy !== "none"}
          onExport={exportFrameworks}
          onDownloadTemplate={downloadFrameworksTemplate}
          onPaste={importUnavailable}
          onImport={importUnavailable}
          className="mb-6"
          testId="frameworks-toolbar"
        />
        {isLoading ? (
          <ModuleTabLoading label="Loading frameworks…" />
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2" data-testid="text-no-frameworks">{frameworksList.length === 0 ? "No Frameworks Yet" : "No Matching Frameworks"}</h3>
              <p className="text-sm text-muted-foreground mb-4">{frameworksList.length === 0 ? "Create your first methodology framework to define delivery processes" : "Try adjusting your search or category filter"}</p>
              {frameworksList.length === 0 && <Button onClick={onCreateNew} data-testid="button-create-first-framework"><Plus className="h-4 w-4 mr-2" />Create Framework</Button>}
            </CardContent>
          </Card>
        ) : viewMode === "table" ? (
          <MondayBoardShell.Table
            columns={FW_TABLE_COLUMNS}
            data={filtered}
            columnWidthStorageKey="jiganto-bpm-frameworks-col-widths"
            totalCount={frameworksList.length}
            groups={fwTableGroups}
            onRowClick={onOpenFramework}
            onCellEdit={(rowId, columnId, value) => {
              updateMutation.mutate({
                id: Number(rowId),
                payload: { [columnId]: value === "" ? null : value },
              });
            }}
            selectable
            gridLines
            paginationResetKey={`${debouncedSearch}|${filterCategory}|${groupBy}`}
            renderRowActions={(row: FrameworkItem) => (
              <Button size="icon" variant="ghost" onClick={(e) => {
                e.stopPropagation();
                if (!window.confirm(`Delete framework "${row.name}"?`)) return;
                deleteMutation.mutate(row.id);
              }} data-testid={`button-delete-fw-${row.id}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            emptyMessage="No frameworks match your filters"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(fw => {
              const CatIcon = getCategoryIcon(fw.category);
              return (
                <Card key={fw.id} className="hover-elevate cursor-pointer group" onClick={() => onOpenFramework(fw)} data-testid={`card-framework-${fw.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CatIcon className="h-5 w-5 text-primary shrink-0" />
                        <CardTitle className="text-base truncate" data-testid={`text-fw-name-${fw.id}`}>{fw.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge className={cn("text-xs", FRAMEWORK_STATUS_COLORS[fw.status] || "")} data-testid={`badge-fw-status-${fw.id}`}>{fw.status}</Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7 invisible group-hover:visible" onClick={(e) => {
                          e.stopPropagation();
                          if (!window.confirm(`Delete framework "${fw.name}"?`)) return;
                          deleteMutation.mutate(fw.id);
                        }} data-testid={`button-delete-fw-${fw.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {fw.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2" data-testid={`text-fw-desc-${fw.id}`}>{fw.description}</p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{getCategoryLabel(fw.category)}</Badge>
                      {fw.vendor && <Badge variant="secondary" className="text-xs">{fw.vendor}</Badge>}
                      {fw.version && <span className="text-xs text-muted-foreground">v{fw.version}</span>}
                    </div>
                    {Array.isArray(fw.phases) && fw.phases.length > 0 && (
                      <div className="mt-3 flex items-center gap-1">
                        {fw.phases.map((phase: FrameworkPhase, idx: number) => (
                          <div key={phase.id} className="flex-1 h-2 rounded-full" style={{ backgroundColor: phase.color || PHASE_COLORS[idx % PHASE_COLORS.length] }} title={phase.name} />
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">{Array.isArray(fw.phases) ? fw.phases.length : 0} phases</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        </MondayBoardShell.Legacy>
      </div>
    </div>
  );
}

const PHASE_SECTION_CONFIG = [
  { key: "purpose", label: "Purpose & Objectives", icon: Target, placeholder: "Define the goals and objectives of this phase..." },
  { key: "activities", label: "Key Activities", icon: Play, placeholder: "Add key activity..." },
  { key: "inputs", label: "Inputs", icon: LogIn, placeholder: "Add input..." },
  { key: "outputs", label: "Outputs & Deliverables", icon: LogOut, placeholder: "Add output/deliverable..." },
  { key: "owners", label: "Owners & Roles", icon: Users, placeholder: "Add role..." },
  { key: "gates", label: "Quality Gates", icon: CheckCircle2, placeholder: "Add quality gate..." },
  { key: "duration", label: "Duration", icon: Timer, placeholder: "e.g., 4-6 weeks" },
  { key: "tips", label: "Tips & Best Practices", icon: Lightbulb, placeholder: "Add tip..." },
] as const;

function PhaseChevron({ phase, index, total, isSelected, onClick, color }: {
  phase: FrameworkPhase; index: number; total: number; isSelected: boolean; onClick: () => void; color: string;
}) {
  const arrowDepth = 16;
  const isFirst = index === 0;
  const isLast = index === total - 1;

  const clipPath = isFirst
    ? `polygon(0 0, calc(100% - ${arrowDepth}px) 0, 100% 50%, calc(100% - ${arrowDepth}px) 100%, 0 100%)`
    : isLast
    ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${arrowDepth}px 50%)`
    : `polygon(0 0, calc(100% - ${arrowDepth}px) 0, 100% 50%, calc(100% - ${arrowDepth}px) 100%, 0 100%, ${arrowDepth}px 50%)`;

  return (
    <div
      className={cn(
        "relative cursor-pointer transition-all duration-200 flex-1 min-w-0",
        isSelected && "z-10 scale-[1.04]"
      )}
      style={{ clipPath, marginLeft: index > 0 ? "-6px" : 0 }}
      onClick={onClick}
      data-testid={`phase-chevron-${phase.id}`}
    >
      <div
        className={cn(
          "flex flex-col items-center justify-center py-4 px-6 text-white transition-all",
          isSelected ? "brightness-110 shadow-lg" : "brightness-100"
        )}
        style={{
          backgroundColor: color,
          paddingLeft: isFirst ? "16px" : `${arrowDepth + 8}px`,
          paddingRight: isLast ? "16px" : `${arrowDepth + 8}px`,
          minHeight: "72px",
        }}
      >
        <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">Phase {index + 1}</span>
        <span className="text-sm font-bold mt-0.5 text-center leading-tight truncate w-full">{phase.name}</span>
      </div>
      {isSelected && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] z-20" style={{ borderTopColor: color }} />
      )}
    </div>
  );
}

function PhaseListEditor({ items, onAdd, onRemove, placeholder, editMode, docLinks, onLinkDoc, onUnlinkDoc, sectionKey }: {
  items: string[]; onAdd: (val: string) => void; onRemove: (idx: number) => void; placeholder: string; editMode: boolean;
  docLinks?: FrameworkDocLink[]; onLinkDoc?: (itemText: string) => void; onUnlinkDoc?: (itemText: string) => void; sectionKey?: string;
}) {
  const [val, setVal] = useState("");
  const handleAdd = () => { if (val.trim()) { onAdd(val.trim()); setVal(""); } };
  const isLinkable = sectionKey === "inputs" || sectionKey === "outputs";
  const getDocLink = (itemText: string) => docLinks?.find(l => l.itemText === itemText);

  if (!editMode) {
    return items.length > 0 ? (
      <ul className="space-y-1.5">
        {items.map((item, i) => {
          const link = getDocLink(item);
          return (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-foreground/40 shrink-0" />
              <span className="flex-1">{item}</span>
              {link && (
                <button
                  onClick={() => window.open(`/modules/documents?docId=${link.documentId}`, "_blank")}
                  className="inline-flex items-center gap-1 text-xs text-primary shrink-0 mt-0.5"
                  title={`Open: ${link.documentTitle}`}
                  data-testid={`link-doc-${i}`}
                >
                  <FileText className="h-3 w-3" />
                  <span className="underline">{link.documentTitle}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    ) : <p className="text-sm text-muted-foreground italic">None defined</p>;
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => {
        const link = getDocLink(item);
        return (
          <div key={i} className="flex items-center gap-2 group">
            <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-foreground/40 shrink-0" />
            <span className="text-sm flex-1">{item}</span>
            {isLinkable && link && (
              <button
                onClick={() => window.open(`/modules/documents?docId=${link.documentId}`, "_blank")}
                className="inline-flex items-center gap-1 text-xs text-primary shrink-0"
                title={`Open: ${link.documentTitle}`}
                data-testid={`link-open-${i}`}
              >
                <FileText className="h-3 w-3" />
              </button>
            )}
            {isLinkable && !link && onLinkDoc && (
              <Button size="icon" variant="ghost" onClick={() => onLinkDoc(item)} title="Link document" data-testid={`button-link-doc-${i}`}>
                <Link2 className="h-3 w-3" />
              </Button>
            )}
            {isLinkable && link && onUnlinkDoc && (
              <Button size="icon" variant="ghost" onClick={() => onUnlinkDoc(item)} title="Unlink document" data-testid={`button-unlink-doc-${i}`}>
                <Unlink className="h-3 w-3" />
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => onRemove(i)} data-testid={`button-remove-item-${i}`}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        );
      })}
      <div className="flex items-center gap-2 mt-2">
        <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder} className="text-sm flex-1" onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }} data-testid="input-add-list-item" />
        <Button size="sm" variant="outline" onClick={handleAdd} disabled={!val.trim()} data-testid="button-add-list-item">Add</Button>
      </div>
    </div>
  );
}

function DocumentLinkDialog({ open, onClose, onSelect, itemText }: {
  open: boolean; onClose: () => void; onSelect: (doc: { id: number; title: string }) => void; itemText: string;
}) {
  const [search, setSearch] = useState("");
  const { data: allDocs = [] } = useQuery<{ id: number; title: string; type: string; status: string }[]>({
    queryKey: [`/api/documents`],
    enabled: open,
    staleTime: BPM_QUERY_STALE_MS,
  });

  const filtered = useMemo(() => {
    if (!search) return allDocs;
    const s = search.toLowerCase();
    return allDocs.filter(d => d.title.toLowerCase().includes(s));
  }, [allDocs, search]);

  return (
    <FormDialogViewShell
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      onClose={onClose}
      title="Link Document"
      subtitle={`Link a document to "${itemText}"`}
      size="sm"
    >
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..." className="pl-9" autoFocus data-testid="input-search-doc-link" />
          </div>
          <div className="max-h-[300px] overflow-auto border rounded-md">
            {filtered.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                {allDocs.length === 0 ? "No documents found. Create documents in the Documents module first." : "No matching documents"}
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map(doc => (
                  <button
                    key={doc.id}
                    className="w-full text-left px-3 py-2 hover-elevate flex items-center gap-2"
                    onClick={() => { onSelect({ id: doc.id, title: doc.title }); onClose(); }}
                    data-testid={`doc-link-option-${doc.id}`}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{doc.title}</span>
                      <span className="text-xs text-muted-foreground">{doc.type} &middot; {doc.status}</span>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
    </FormDialogViewShell>
  );
}

function PhaseDetailPanel({ phase, onUpdate, editMode, color, compact, singleColumn }: {
  phase: FrameworkPhase; onUpdate: (updates: Partial<FrameworkPhase>) => void; editMode: boolean; color: string; compact?: boolean; singleColumn?: boolean;
}) {
  const safeList = (arr: string[] | undefined) => arr || [];
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingItemText, setLinkingItemText] = useState("");

  const sectionMapping: Record<string, { value: string | string[]; isText: boolean; field: keyof FrameworkPhase }> = {
    purpose: { value: phase.purpose || "", isText: true, field: "purpose" },
    activities: { value: safeList(phase.activities), isText: false, field: "activities" },
    inputs: { value: safeList(phase.inputs), isText: false, field: "inputs" },
    outputs: { value: phase.deliverables, isText: false, field: "deliverables" },
    owners: { value: safeList(phase.owners), isText: false, field: "owners" },
    gates: { value: phase.gates, isText: false, field: "gates" },
    duration: { value: phase.duration || "", isText: true, field: "duration" },
    tips: { value: safeList(phase.tips), isText: false, field: "tips" },
  };

  const handleLinkDoc = (itemText: string) => {
    setLinkingItemText(itemText);
    setLinkDialogOpen(true);
  };

  const handleSelectDoc = (doc: { id: number; title: string }) => {
    const existing = (phase.docLinks || []) as FrameworkDocLink[];
    const filtered = existing.filter((l: FrameworkDocLink) => l.itemText !== linkingItemText);
    onUpdate({ docLinks: [...filtered, { itemText: linkingItemText, documentId: doc.id, documentTitle: doc.title }] });
  };

  const handleUnlinkDoc = (itemText: string) => {
    const existing = (phase.docLinks || []) as FrameworkDocLink[];
    onUpdate({ docLinks: existing.filter((l: FrameworkDocLink) => l.itemText !== itemText) });
  };

  return (
    <div className={compact ? "" : "mt-6"}>
      {editMode && !compact && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="text-xs text-muted-foreground">Phase Name</Label>
            <Input value={phase.name} onChange={(e) => onUpdate({ name: e.target.value })} className="text-sm mt-1" data-testid="input-phase-name" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Input value={phase.description} onChange={(e) => onUpdate({ description: e.target.value })} className="text-sm mt-1" data-testid="input-phase-description" />
          </div>
        </div>
      )}

      {!editMode && phase.description && !compact && (
        <p className="text-sm text-muted-foreground mb-4 italic">{phase.description}</p>
      )}

      <div className={compact ? "space-y-3" : singleColumn ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
        {PHASE_SECTION_CONFIG.map((section) => {
          const data = sectionMapping[section.key];
          const Icon = section.icon;
          const hasContent = Array.isArray(data.value) ? data.value.length > 0 : !!data.value;

          return (
            <Card key={section.key} className={cn("transition-all", !hasContent && !editMode && "opacity-60")} data-testid={`section-${section.key}`}>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: color + "20" }}>
                    <Icon className="h-3.5 w-3.5" style={{ color }} />
                  </div>
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {data.isText ? (
                  editMode ? (
                    section.key === "purpose" ? (
                      <Textarea
                        value={data.value as string}
                        onChange={(e) => onUpdate({ [data.field]: e.target.value })}
                        placeholder={section.placeholder}
                        className="resize-none text-sm"
                        rows={compact ? 2 : 3}
                        data-testid={`textarea-${section.key}`}
                      />
                    ) : (
                      <Input
                        value={data.value as string}
                        onChange={(e) => onUpdate({ [data.field]: e.target.value })}
                        placeholder={section.placeholder}
                        className="text-sm"
                        data-testid={`input-${section.key}`}
                      />
                    )
                  ) : (
                    <p className={cn("text-sm", hasContent ? "" : "text-muted-foreground italic")}>
                      {(data.value as string) || "Not specified"}
                    </p>
                  )
                ) : (
                  <PhaseListEditor
                    items={data.value as string[]}
                    onAdd={(val) => {
                      const current = Array.isArray(data.value) ? data.value as string[] : [];
                      onUpdate({ [data.field]: [...current, val] });
                    }}
                    onRemove={(idx) => {
                      const list = data.value as string[];
                      onUpdate({ [data.field]: list.filter((_, i) => i !== idx) });
                    }}
                    placeholder={section.placeholder}
                    editMode={editMode}
                    sectionKey={section.key}
                    docLinks={phase.docLinks}
                    onLinkDoc={editMode ? handleLinkDoc : undefined}
                    onUnlinkDoc={editMode ? handleUnlinkDoc : undefined}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editMode && !compact && (
        <div className="mt-4">
          <Label className="text-xs text-muted-foreground">Phase Color</Label>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {PHASE_COLORS.map(c => (
              <button key={c} className={cn("w-7 h-7 rounded-full border-2 transition-all", color === c ? "border-foreground scale-110" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => onUpdate({ color: c })} data-testid={`color-swatch-${c}`} />
            ))}
          </div>
        </div>
      )}

      <DocumentLinkDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        onSelect={handleSelectDoc}
        itemText={linkingItemText}
      />
    </div>
  );
}

function FrameworkDetailView({ framework, onBack, onUpdate }: { framework: FrameworkItem; onBack: () => void; onUpdate: (fw: FrameworkItem) => void }) {
  const { toast } = useToast();
  const [editName, setEditName] = useState(framework.name);
  const [editDescription, setEditDescription] = useState(framework.description || "");
  const [editStatus, setEditStatus] = useState(framework.status);
  const [editVersion, setEditVersion] = useState(framework.version || "1.0");
  const [phases, setPhases] = useState<FrameworkPhase[]>(Array.isArray(framework.phases) ? framework.phases : []);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(phases.length > 0 ? phases[0].id : null);
  const [presentMode, setPresentMode] = useState(false);
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState("");
  const [newPhaseDescription, setNewPhaseDescription] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"phase" | "consolidated">("phase");
  const [detailColumns, setDetailColumns] = useState<1 | 2>(2);
  const [isExporting, setIsExporting] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const frameworkContentRef = useRef<HTMLDivElement>(null);

  const selectedPhase = phases.find(p => p.id === selectedPhaseId);
  const editMode = !presentMode;

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/frameworks/${framework.id}`, data),
    onSuccess: async (res) => {
      const updated = await res.json();
      onUpdate(updated);
      setIsDirty(false);
      toast({ title: "Saved", description: "Framework updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({ name: editName, description: editDescription || null, status: editStatus, version: editVersion, phases });
  };

  const addPhase = () => {
    if (!newPhaseName.trim()) return;
    const newPhase: FrameworkPhase = {
      id: `phase_${Date.now()}`, name: newPhaseName, description: newPhaseDescription, order: phases.length,
      deliverables: [], gates: [], color: PHASE_COLORS[phases.length % PHASE_COLORS.length],
      purpose: "", activities: [], inputs: [], outputs: [], owners: [], duration: "", tips: [],
    };
    setPhases(prev => [...prev, newPhase]);
    setSelectedPhaseId(newPhase.id);
    setNewPhaseName(""); setNewPhaseDescription(""); setShowAddPhase(false); setIsDirty(true);
  };

  const removePhase = (phaseId: string) => {
    const newPhases = phases.filter(p => p.id !== phaseId).map((p, i) => ({ ...p, order: i }));
    setPhases(newPhases);
    if (selectedPhaseId === phaseId) setSelectedPhaseId(newPhases.length > 0 ? newPhases[0].id : null);
    setIsDirty(true);
  };

  const movePhase = (index: number, direction: number) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= phases.length) return;
    const updated = [...phases];
    [updated[index], updated[newIdx]] = [updated[newIdx], updated[index]];
    setPhases(updated.map((p, i) => ({ ...p, order: i }))); setIsDirty(true);
  };

  const updatePhase = (phaseId: string, updates: Partial<FrameworkPhase>) => {
    setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, ...updates } : p)); setIsDirty(true);
  };

  const handleExportPng = useCallback(async () => {
    if (!frameworkContentRef.current) return;
    setIsExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(frameworkContentRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        filter: (node: HTMLElement) => {
          if (node?.dataset?.testid === "button-add-phase") return false;
          if (node?.dataset?.testid === "button-add-first-phase") return false;
          return true;
        },
      });
      const link = document.createElement("a");
      link.download = `${editName.replace(/\s+/g, "_")}_framework.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "PNG exported successfully" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }, [editName, toast]);

  const handleExportPdf = useCallback(async () => {
    if (!frameworkContentRef.current) return;
    setIsExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(frameworkContentRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        filter: (node: HTMLElement) => {
          if (node?.dataset?.testid === "button-add-phase") return false;
          if (node?.dataset?.testid === "button-add-first-phase") return false;
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
      pdf.save(`${editName.replace(/\s+/g, "_")}_framework.pdf`);
      toast({ title: "PDF exported successfully" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }, [editName, toast]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!frameworkContentRef.current) return;
    setIsExporting(true);
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(frameworkContentRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        filter: (node: HTMLElement) => {
          if (node?.dataset?.testid === "button-add-phase") return false;
          if (node?.dataset?.testid === "button-add-first-phase") return false;
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

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-card border-b px-4 py-2 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={onBack} data-testid="button-back-from-fw">
            <ChevronRight className="h-4 w-4 rotate-180" />
          </Button>
          <BookOpen className="h-5 w-5 text-primary" />
          {editMode ? (
            <Input value={editName} onChange={(e) => { setEditName(e.target.value); setIsDirty(true); }} className="h-8 text-sm font-semibold border-none bg-transparent focus-visible:ring-1 max-w-xs" data-testid="input-fw-name" />
          ) : (
            <span className="text-sm font-semibold" data-testid="text-fw-name">{editName}</span>
          )}
          <Badge className={cn("text-xs", FRAMEWORK_STATUS_COLORS[editStatus] || "")}>{editStatus}</Badge>
          {isDirty && <span className="text-xs text-status-amber-foreground">Unsaved</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center border rounded-md">
            <Button size="icon" variant="ghost" className={cn("rounded-none rounded-l-md toggle-elevate", layoutMode === "phase" && "toggle-elevated")} onClick={() => setLayoutMode("phase")} title="Phase view" data-testid="button-layout-phase">
              <Rows3 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className={cn("rounded-none rounded-r-md toggle-elevate", layoutMode === "consolidated" && "toggle-elevated")} onClick={() => setLayoutMode("consolidated")} title="Consolidated view" data-testid="button-layout-consolidated">
              <Columns3 className="h-4 w-4" />
            </Button>
          </div>
          {layoutMode === "phase" && (
            <div className="flex items-center border rounded-md">
              <Button size="icon" variant="ghost" className={cn("rounded-none rounded-l-md toggle-elevate", detailColumns === 2 && "toggle-elevated")} onClick={() => setDetailColumns(2)} title="Two columns" data-testid="button-detail-2col">
                <Columns2 className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className={cn("rounded-none rounded-r-md toggle-elevate", detailColumns === 1 && "toggle-elevated")} onClick={() => setDetailColumns(1)} title="Single column" data-testid="button-detail-1col">
                <LayoutList className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Button
            size="sm"
            variant={presentMode ? "default" : "outline"}
            onClick={() => setPresentMode(!presentMode)}
            data-testid="button-toggle-present-mode"
          >
            {presentMode ? <Edit3 className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {presentMode ? "Edit" : "Present"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={isExporting} data-testid="button-fw-export">
                {isExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleCopyToClipboard} data-testid="button-export-clipboard">
                <ClipboardCopy className="h-4 w-4 mr-2" />Copy to Clipboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPng} data-testid="button-export-png">
                <Image className="h-4 w-4 mr-2" />Export as PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf} data-testid="button-export-pdf">
                <FileDown className="h-4 w-4 mr-2" />Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowSaveTemplate(true)} data-testid="button-save-fw-template">
                <LayoutTemplate className="h-4 w-4 mr-2" />Save as Template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SaveAsPlatformTemplateDialog
            open={showSaveTemplate}
            onOpenChange={setShowSaveTemplate}
            endpoint={`/api/frameworks/${framework.id}/save-as-template`}
            defaultName={editName}
            defaultDescription={editDescription}
          />
          {editMode && (
            <>
              <Select value={editStatus} onValueChange={(v) => { setEditStatus(v); setIsDirty(true); }}>
                <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-fw-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Input value={editVersion} onChange={(e) => { setEditVersion(e.target.value); setIsDirty(true); }} className="h-8 w-20 text-xs" placeholder="v1.0" data-testid="input-fw-version" />
              <Button size="sm" onClick={handleSave} disabled={!isDirty || updateMutation.isPending} data-testid="button-save-fw">
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={cn("p-6 mx-auto space-y-6", layoutMode === "consolidated" ? "w-full" : "max-w-6xl")}>
        {editMode && (
          <Card>
            <CardHeader><CardTitle className="text-base">Framework Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Textarea value={editDescription} onChange={(e) => { setEditDescription(e.target.value); setIsDirty(true); }} placeholder="Describe the purpose and scope of this framework..." className="resize-none mt-1" rows={3} data-testid="textarea-fw-description" />
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <p className="text-sm" data-testid="text-fw-category">{FRAMEWORK_CATEGORIES.find(c => c.value === framework.category)?.label || framework.category}</p>
                </div>
                {framework.vendor && <div><Label className="text-xs text-muted-foreground">Vendor</Label><p className="text-sm" data-testid="text-fw-vendor">{framework.vendor}</p></div>}
              </div>
            </CardContent>
          </Card>
        )}

        {presentMode && (
          <div className="text-center mb-2">
            <h2 className="text-xl font-bold" data-testid="text-fw-present-title">{editName}</h2>
            {editDescription && <p className="text-sm text-muted-foreground mt-1 max-w-2xl mx-auto">{editDescription}</p>}
            <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
              {framework.vendor && <span className="text-xs text-muted-foreground">{framework.vendor}</span>}
              <Badge className={cn("text-xs", FRAMEWORK_STATUS_COLORS[editStatus] || "")}>{editStatus}</Badge>
              {editVersion && <span className="text-xs text-muted-foreground">v{editVersion}</span>}
            </div>
          </div>
        )}

        <div ref={frameworkContentRef}>
          <div className="flex items-center justify-between gap-2 mb-3">
            {editMode && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold">Implementation Phases</h3>
                  {layoutMode === "phase" && selectedPhase && (
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { const idx = phases.findIndex(p => p.id === selectedPhaseId); movePhase(idx, -1); }} disabled={!selectedPhaseId || phases.findIndex(p => p.id === selectedPhaseId) === 0} data-testid="button-move-phase-left">
                        <ChevronRight className="h-4 w-4 rotate-180" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { const idx = phases.findIndex(p => p.id === selectedPhaseId); movePhase(idx, 1); }} disabled={!selectedPhaseId || phases.findIndex(p => p.id === selectedPhaseId) === phases.length - 1} data-testid="button-move-phase-right">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (selectedPhaseId) removePhase(selectedPhaseId); }} data-testid="button-remove-phase">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowAddPhase(true)} data-testid="button-add-phase">
                  <Plus className="h-4 w-4 mr-1" />Add Phase
                </Button>
              </>
            )}
          </div>

          {phases.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-md">
              <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No phases defined yet</p>
              <Button size="sm" variant="outline" onClick={() => setShowAddPhase(true)} data-testid="button-add-first-phase">
                <Plus className="h-4 w-4 mr-1" />Add First Phase
              </Button>
            </div>
          ) : layoutMode === "consolidated" ? (
            <div className="overflow-x-auto" data-testid="consolidated-view">
              <div style={{ minWidth: `${Math.max(phases.length * 220, 600)}px` }}>
                <div className="sticky top-0 z-30 bg-background pb-2">
                  <div className="flex gap-0 items-start">
                    {phases.map((phase, idx) => (
                      <PhaseChevron
                        key={phase.id}
                        phase={phase}
                        index={idx}
                        total={phases.length}
                        isSelected={selectedPhaseId === phase.id}
                        onClick={() => setSelectedPhaseId(phase.id)}
                        color={phase.color || PHASE_COLORS[idx % PHASE_COLORS.length]}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-0 items-start">
                  {phases.map((phase, idx) => {
                    const color = phase.color || PHASE_COLORS[idx % PHASE_COLORS.length];
                    return (
                      <div key={phase.id} className="flex-1 px-2 min-w-0" data-testid={`consolidated-column-${phase.id}`}>
                        <div className="text-center mb-3">
                          <h4 className="text-sm font-bold" style={{ color }}>{phase.name}</h4>
                          {phase.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{phase.description}</p>}
                        </div>
                        <PhaseDetailPanel
                          phase={phase}
                          onUpdate={(updates) => updatePhase(phase.id, updates)}
                          editMode={editMode}
                          color={color}
                          compact
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-30 bg-background pb-2 -mx-6 px-6">
                <div className="flex items-start" data-testid="chevron-flow-bar">
                  {phases.map((phase, idx) => (
                    <PhaseChevron
                      key={phase.id}
                      phase={phase}
                      index={idx}
                      total={phases.length}
                      isSelected={selectedPhaseId === phase.id}
                      onClick={() => setSelectedPhaseId(phase.id)}
                      color={phase.color || PHASE_COLORS[idx % PHASE_COLORS.length]}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {showAddPhase && editMode && (
            <Card className="mt-4 border-dashed">
              <CardContent className="pt-4 space-y-3">
                <div><Label className="text-xs">Phase Name</Label><Input value={newPhaseName} onChange={(e) => setNewPhaseName(e.target.value)} placeholder="e.g., Discover, Prepare, Realize..." className="text-sm mt-1" autoFocus data-testid="input-new-phase-name" /></div>
                <div><Label className="text-xs">Description</Label><Textarea value={newPhaseDescription} onChange={(e) => setNewPhaseDescription(e.target.value)} placeholder="What happens in this phase..." className="resize-none text-sm mt-1" rows={2} data-testid="textarea-new-phase-desc" /></div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={addPhase} disabled={!newPhaseName.trim()} data-testid="button-confirm-add-phase">Add Phase</Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowAddPhase(false); setNewPhaseName(""); setNewPhaseDescription(""); }} data-testid="button-cancel-add-phase">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {layoutMode === "phase" && selectedPhase && (
            <PhaseDetailPanel
              phase={selectedPhase}
              onUpdate={(updates) => updatePhase(selectedPhase.id, updates)}
              editMode={editMode}
              color={selectedPhase.color || PHASE_COLORS[phases.findIndex(p => p.id === selectedPhase.id) % PHASE_COLORS.length]}
              singleColumn={detailColumns === 1}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const DIAGRAM_GROUPING_OPTIONS = [
  { value: "none", label: "No Grouping" },
  { value: "type", label: "Group by Type" },
  { value: "status", label: "Group by Status" },
];

const DIAGRAM_TABLE_COLUMNS: ColumnDef<BpmDiagram>[] = [
  { id: "name", header: "Name", type: "text", accessor: "name", width: "minmax(200px, 2fr)", editable: true },
  {
    id: "type", header: "Type", type: "status", accessor: "type", editable: true,
    options: DIAGRAM_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label, color: "bg-primary/10 text-primary" })),
  },
  {
    id: "status", header: "Status", type: "status", accessor: "status", editable: true,
    options: [
      { value: "draft", label: "Draft", color: STATUS_COLORS.draft },
      { value: "active", label: "Active", color: STATUS_COLORS.active },
      { value: "review", label: "Review", color: STATUS_COLORS.review || "bg-status-blue/20 text-status-blue-foreground" },
      { value: "archived", label: "Archived", color: STATUS_COLORS.archived },
    ],
  },
  { id: "version", header: "Version", type: "number", accessor: (row: BpmDiagram) => row.version, width: "80px", editable: true },
  { id: "updatedAt", header: "Last Updated", type: "date", accessor: "updatedAt", width: "140px", editable: false },
];

function DiagramCatalogue({
  onOpenDiagram,
  onCreateNew,
  onCreateLibrary,
  onCreateTemplate,
  onImportCsv,
  onCompare,
  typeFilter,
  libraries,
}: {
  onOpenDiagram: (d: BpmDiagram) => void;
  onCreateNew: () => void;
  onCreateLibrary: () => void;
  onCreateTemplate: () => void;
  onImportCsv: () => void;
  onCompare?: (asIsId: number, toBeId: number) => void;
  typeFilter?: string[];
  libraries: BpmLibrary[];
}) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [filterType, setFilterType] = useState("all");
  const [filterLibrary, setFilterLibrary] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [groupBy, setGroupBy] = useState("none");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<BpmDiagram | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [compareAsIs, setCompareAsIs] = useState<number | null>(null);
  const [compareToBe, setCompareToBe] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: diagrams = [], isLoading } = useQuery<BpmDiagram[]>({
    queryKey: ["/api/bpm/diagrams"],
    staleTime: BPM_QUERY_STALE_MS,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/bpm/diagrams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bpm/diagrams"] });
      toast({ title: "Diagram deleted" });
    },
  });

  const updateDiagramMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/bpm/diagrams/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bpm/diagrams"] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      apiRequest("POST", `/api/bpm/diagrams/${id}/duplicate`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bpm/diagrams"] });
      setDuplicateSource(null);
      setDuplicateName("");
      toast({ title: "Diagram duplicated" });
    },
    onError: () => {
      toast({ title: "Failed to duplicate diagram", variant: "destructive" });
    },
  });

  const availableTypes = useMemo(() => {
    if (!typeFilter) return DIAGRAM_TYPE_OPTIONS;
    return DIAGRAM_TYPE_OPTIONS.filter(opt => typeFilter.includes(opt.value));
  }, [typeFilter]);

  const filtered = useMemo(() => {
    return diagrams.filter(d => {
      const matchesSearch = !debouncedSearch || d.name.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesTypeFilter = !typeFilter || typeFilter.includes(d.type);
      const matchesDropdown = filterType === "all" || d.type === filterType;
      const matchesLibrary = filterLibrary === "all" || (filterLibrary === "unassigned" ? d.libraryId === null : d.libraryId === Number(filterLibrary));
      return matchesSearch && matchesTypeFilter && matchesDropdown && matchesLibrary;
    });
  }, [diagrams, debouncedSearch, filterType, filterLibrary, typeFilter]);

  const getTypeIcon = (type: string) => {
    const opt = DIAGRAM_TYPE_OPTIONS.find(o => o.value === type);
    return opt ? opt.icon : Workflow;
  };

  const getTypeLabel = (type: string) => {
    const opt = DIAGRAM_TYPE_OPTIONS.find(o => o.value === type);
    return opt ? opt.label : type;
  };

  const tableGroups = useMemo((): GroupDef<BpmDiagram>[] | undefined => {
    if (groupBy === "none") return undefined;
    const groupMap = new Map<string, BpmDiagram[]>();
    filtered.forEach(d => {
      const key = groupBy === "type" ? d.type : d.status;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(d);
    });
    const groupColors: Record<string, string> = {
      draft: "hsl(38, 92%, 50%)", active: "hsl(142, 71%, 45%)", review: "hsl(210, 100%, 50%)", archived: "hsl(0, 0%, 50%)",
      process_flow: "hsl(221, 83%, 53%)", flowchart: "hsl(152, 69%, 45%)", architecture: "hsl(270, 91%, 60%)",
      value_stream: "hsl(38, 92%, 50%)", data_flow: "hsl(199, 89%, 50%)",
    };
    return Array.from(groupMap.entries()).map(([key, items]) => ({
      id: key,
      title: groupBy === "type" ? getTypeLabel(key) : key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      color: groupColors[key] || "hsl(221, 83%, 53%)",
      items,
      count: items.length,
    }));
  }, [filtered, groupBy]);

  const DIAGRAM_CSV_HEADERS = ["Name", "Type", "Status", "Version", "Last Updated"];

  const exportDiagrams = () => {
    const rows = filtered.map((d) => [
      d.name || "",
      getTypeLabel(d.type),
      d.status || "",
      String(d.version ?? ""),
      d.updatedAt ? String(d.updatedAt) : "",
    ]);
    downloadBoardCsv(`diagrams-${new Date().toISOString().split("T")[0]}.csv`, DIAGRAM_CSV_HEADERS, rows);
    toast({ title: "Diagrams exported to CSV" });
  };

  const downloadDiagramImportTemplate = () => {
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + generateBlankTemplate()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bpm_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Import template downloaded" });
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-bpm-title">Business Process Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Design, document, and manage business processes</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={onCreateNew} data-testid="button-create-diagram">
              <Plus className="h-4 w-4 mr-2" />
              New Diagram
            </Button>
            <Button variant="outline" onClick={onCreateLibrary} data-testid="button-create-library">
              <Plus className="h-4 w-4 mr-2" />
              New Library
            </Button>
            <Button variant="outline" onClick={onCreateTemplate} data-testid="button-create-template">
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
            <Button variant="outline" onClick={onImportCsv} data-testid="button-import-csv">
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
          </div>
        </div>

        <MondayBoardShell.Legacy
          storageKey="jiganto-bpm-diagrams"
          entityType="bpm_diagram"
          stateHook={useMondayBoardShellState}
          filterMatcher={matchBoardFilterValue}
        >
        <MondayBoardShell.Toolbar
          newLabel="New Diagram"
          onNew={onCreateNew}
          newTestId="button-create-diagram-toolbar"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search diagrams..."
          searchTestId="input-search-diagrams"
          viewLabel={viewMode === "table" ? "Table" : "Grid"}
          viewIcon={viewMode === "table" ? <List className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
          viewMenu={
            <>
              <DropdownMenuItem onClick={() => setViewMode("grid")} data-testid="button-view-grid">Grid</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewMode("table")} data-testid="button-view-table">Table</DropdownMenuItem>
            </>
          }
          filterActive={filterLibrary !== "all" || filterType !== "all"}
          filterCount={(filterLibrary !== "all" ? 1 : 0) + (filterType !== "all" ? 1 : 0)}
          filterContent={
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Library</Label>
                <Select value={filterLibrary} onValueChange={setFilterLibrary}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-filter-library">
                    <SelectValue placeholder="All Libraries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Libraries</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {libraries.map(lib => (
                      <SelectItem key={lib.id} value={String(lib.id)}>{lib.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-filter-type">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {availableTypes.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          }
          groupActive={groupBy !== "none"}
          groupLabel={groupBy === "none" ? "Group by" : (DIAGRAM_GROUPING_OPTIONS.find(o => o.value === groupBy)?.label ?? "Group by")}
          groupContent={
            <>
              {DIAGRAM_GROUPING_OPTIONS.map(opt => (
                <DropdownMenuItem key={opt.value} onClick={() => setGroupBy(opt.value)} data-testid={`diagram-group-${opt.value}`}>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </>
          }
          grouped={viewMode === "table" && groupBy !== "none"}
          onImport={onImportCsv}
          onPaste={onImportCsv}
          onExport={exportDiagrams}
          onDownloadTemplate={downloadDiagramImportTemplate}
          moreMenuItems={
            <>
              <DropdownMenuItem onClick={onCreateLibrary} data-testid="button-create-library-menu">New Library</DropdownMenuItem>
              <DropdownMenuItem onClick={onCreateTemplate} data-testid="button-create-template-menu">New Template</DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowCompareDialog(true)}
                disabled={diagrams.length < 2}
                data-testid="button-compare-diagrams-menu"
              >
                Compare diagrams
              </DropdownMenuItem>
            </>
          }
          afterGroupSlot={
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setShowCompareDialog(true)} disabled={diagrams.length < 2} data-testid="button-compare-diagrams">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Compare
            </Button>
          }
          className="mb-6"
          testId="diagrams-toolbar"
        />

        {!isLoading && diagrams.length > 0 && !search && filterType === "all" && filterLibrary === "all" && (
          (() => {
            const sectionDiagrams = typeFilter ? diagrams.filter(d => typeFilter.includes(d.type)) : diagrams;
            const recent = [...sectionDiagrams].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 6);
            if (recent.length === 0) return null;
            return (
              <div className="mb-6" data-testid="section-recent-diagrams">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recently Edited</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {recent.map(diagram => {
                    const TypeIcon = getTypeIcon(diagram.type);
                    return (
                      <Card
                        key={`recent-${diagram.id}`}
                        className="hover-elevate cursor-pointer"
                        onClick={() => onOpenDiagram(diagram)}
                        data-testid={`card-recent-diagram-${diagram.id}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <TypeIcon className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-xs font-medium truncate">{diagram.name}</span>
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <Badge className={cn("text-[10px] px-1.5 py-0", STATUS_COLORS[diagram.status] || "")}>
                              {diagram.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{new Date(diagram.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <Separator className="mt-6" />
              </div>
            );
          })()
        )}

        {isLoading ? (
          <ModuleTabLoading label="Loading diagrams…" className="py-20" />
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2" data-testid="text-empty-state">No diagrams yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create your first process flow, flowchart, or architecture diagram</p>
              <Button onClick={onCreateNew} data-testid="button-create-first-diagram">
                <Plus className="h-4 w-4 mr-2" />
                Create Diagram
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === "table" ? (
          <MondayBoardShell.Table
            columns={DIAGRAM_TABLE_COLUMNS}
            data={filtered}
            columnWidthStorageKey="jiganto-bpm-diagrams-col-widths"
            totalCount={diagrams.length}
            groups={tableGroups}
            onRowClick={onOpenDiagram}
            onCellEdit={(rowId, columnId, value) => {
              updateDiagramMutation.mutate({
                id: Number(rowId),
                payload: { [columnId]: value === "" ? null : value },
              });
            }}
            selectable
            gridLines
            paginationResetKey={`${debouncedSearch}|${filterType}|${filterLibrary}|${groupBy}`}
            renderRowActions={(row: BpmDiagram) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()} data-testid={`button-diagram-actions-${row.id}`}>
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => { const d = diagrams.find(x => x.id === row.id); if (d) { setDuplicateSource(d); setDuplicateName(`${d.name} (Copy)`); } }} data-testid={`menuitem-duplicate-diagram-${row.id}`}>
                    <Copy className="h-4 w-4 mr-2" />Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDeleteConfirmId(row.id)} className="text-destructive" data-testid={`menuitem-delete-diagram-${row.id}`}>
                    <Trash2 className="h-4 w-4 mr-2" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            emptyMessage="No diagrams match your filters"
            data-testid="table-diagrams"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(diagram => {
              const TypeIcon = getTypeIcon(diagram.type);
              return (
                <Card
                  key={diagram.id}
                  className="hover-elevate cursor-pointer group"
                  onClick={() => onOpenDiagram(diagram)}
                  data-testid={`card-diagram-${diagram.id}`}
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-md bg-primary/10">
                        <TypeIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-medium truncate">{diagram.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{getTypeLabel(diagram.type)}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`button-diagram-actions-${diagram.id}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => { setDuplicateSource(diagram); setDuplicateName(`${diagram.name} (Copy)`); }} data-testid={`menuitem-duplicate-diagram-${diagram.id}`}>
                          <Copy className="h-4 w-4 mr-2" />Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteConfirmId(diagram.id)} className="text-destructive" data-testid={`menuitem-delete-diagram-${diagram.id}`}>
                          <Trash2 className="h-4 w-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {diagram.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{diagram.description}</p>
                    )}
                    {diagram.libraryId && (() => {
                      const lib = libraries.find(l => l.id === diagram.libraryId);
                      return lib ? (
                        <div className="flex items-center gap-1.5 mb-2">
                          <FolderOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-[11px] text-muted-foreground truncate">{lib.name}</span>
                        </div>
                      ) : null;
                    })()}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Badge className={cn("text-xs", STATUS_COLORS[diagram.status] || "")}>
                        {diagram.status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        v{diagram.version} · {new Date(diagram.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        </MondayBoardShell.Legacy>
      </div>

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Diagram</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this diagram? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-diagram">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId !== null) {
                  deleteMutation.mutate(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
              data-testid="button-confirm-delete-diagram"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FormDialogShell
        open={duplicateSource !== null}
        onOpenChange={() => { setDuplicateSource(null); setDuplicateName(""); }}
        title="Duplicate Diagram"
        subtitle={`Create a copy of ${duplicateSource?.name ?? "this diagram"} with all its nodes, edges, and swimlanes.`}
        saveLabel="Duplicate"
        saveTestId="button-submit-duplicate-diagram"
        onCancel={() => { setDuplicateSource(null); setDuplicateName(""); }}
        onSubmit={() => {
          if (duplicateSource && duplicateName.trim()) {
            duplicateMutation.mutate({ id: duplicateSource.id, name: duplicateName.trim() });
          }
        }}
        disabled={!duplicateName.trim() || duplicateMutation.isPending}
        saving={duplicateMutation.isPending}
      >
          <div className="space-y-2">
            <FieldLabel>Name</FieldLabel>
            <Input
              value={duplicateName}
              onChange={e => setDuplicateName(e.target.value)}
              placeholder="Enter name for duplicate"
              autoFocus
              data-testid="input-duplicate-diagram-name"
            />
          </div>
      </FormDialogShell>

      <FormDialogShell
        open={showCompareDialog}
        onOpenChange={(open) => {
          setShowCompareDialog(open);
          if (!open) {
            setCompareAsIs(null);
            setCompareToBe(null);
          }
        }}
        title="Compare Diagrams"
        subtitle="Select an As-Is and To-Be diagram to compare and identify differences."
        saveLabel="Compare"
        saveTestId="button-submit-compare"
        onCancel={() => {
          setShowCompareDialog(false);
          setCompareAsIs(null);
          setCompareToBe(null);
        }}
        onSubmit={() => {
          if (compareAsIs && compareToBe && onCompare) {
            onCompare(compareAsIs, compareToBe);
            setShowCompareDialog(false);
            setCompareAsIs(null);
            setCompareToBe(null);
          }
        }}
        disabled={!compareAsIs || !compareToBe || compareAsIs === compareToBe}
        size="sm"
      >
          <div className="space-y-4 py-2">
            <div>
              <Label>As-Is Diagram</Label>
              <Select value={compareAsIs ? String(compareAsIs) : undefined} onValueChange={(v) => setCompareAsIs(Number(v))}>
                <SelectTrigger data-testid="select-compare-as-is">
                  <SelectValue placeholder="Select As-Is diagram..." />
                </SelectTrigger>
                <SelectContent>
                  {diagrams.filter(d => d.id !== compareToBe).map(d => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To-Be Diagram</Label>
              <Select value={compareToBe ? String(compareToBe) : undefined} onValueChange={(v) => setCompareToBe(Number(v))}>
                <SelectTrigger data-testid="select-compare-to-be">
                  <SelectValue placeholder="Select To-Be diagram..." />
                </SelectTrigger>
                <SelectContent>
                  {diagrams.filter(d => d.id !== compareAsIs).map(d => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
      </FormDialogShell>
    </div>
  );
}

type BpmTemplate = {
  id: number;
  libraryId: number | null;
  name: string;
  description: string | null;
  type: string;
  category: string | null;
  vendor: string | null;
  processType: string | null;
  templateData: any;
  isSystem: boolean | null;
  tier?: string | null;
  submissionStatus?: string | null;
  createdAt: string;
};

const VENDOR_OPTIONS = [
  { value: "sap", label: "SAP" },
  { value: "workday", label: "Workday" },
  { value: "oracle", label: "Oracle" },
  { value: "netsuite", label: "NetSuite" },
  { value: "microsoft", label: "Microsoft" },
  { value: "jiganto", label: "Jiganto" },
  { value: "itil", label: "ITIL / PeopleCert" },
  { value: "axelos", label: "AXELOS (PRINCE2)" },
  { value: "pmi", label: "PMI" },
  { value: "custom", label: "Custom / Internal" },
  { value: "other", label: "Other" },
];

const PROCESS_TYPE_OPTIONS = [
  { value: "otc", label: "Order to Cash (OTC)" },
  { value: "ptp", label: "Purchase to Pay (PTP)" },
  { value: "rtr", label: "Record to Report (RTR)" },
  { value: "htr", label: "Hire to Retire (HTR)" },
];

const SUB_NAV_ITEMS = [
  { key: "bpml" as const, label: "BPML", icon: BpmLibraryIcon },
  { key: "process" as const, label: "Process Diagrams", icon: BpmDiagramsIcon },
  { key: "task-tracker" as const, label: "Task Tracker", icon: ClipboardList },
  { key: "portal" as const, label: "Process Portal", icon: BpmPortalIcon },
  { key: "architecture" as const, label: "Architecture", icon: BpmArchitectureIcon },
  { key: "orgchart" as const, label: "Org Charts", icon: BpmOrgChartIcon },
  { key: "frameworks" as const, label: "Frameworks", icon: BpmFrameworksIcon },
];

type ActiveSection = "process" | "architecture" | "portal" | "frameworks" | "bpml" | "orgchart" | "task-tracker";

type CompareStatus = "added" | "removed" | "changed" | "unchanged";

function diffCanvasData(
  asIsNodes: any[],
  toBeNodes: any[],
  asIsEdges: any[],
  toBeEdges: any[],
) {
  const asIsNodeMap = new Map(asIsNodes.map((n: any) => [n.id, n]));
  const toBeNodeMap = new Map(toBeNodes.map((n: any) => [n.id, n]));
  const asIsEdgeMap = new Map(asIsEdges.map((e: any) => [e.id, e]));
  const toBeEdgeMap = new Map(toBeEdges.map((e: any) => [e.id, e]));

  const nodeStatuses = new Map<string, CompareStatus>();
  const edgeStatuses = new Map<string, CompareStatus>();

  asIsNodeMap.forEach((node, id) => {
    if (!toBeNodeMap.has(id)) {
      nodeStatuses.set(id, "removed");
    } else {
      const toBeNode = toBeNodeMap.get(id)!;
      const labelChanged = (node.data?.label || "") !== (toBeNode.data?.label || "");
      const typeChanged = node.type !== toBeNode.type;
      const posChanged = Math.abs((node.position?.x || 0) - (toBeNode.position?.x || 0)) > 5 ||
        Math.abs((node.position?.y || 0) - (toBeNode.position?.y || 0)) > 5;
      nodeStatuses.set(id, (labelChanged || typeChanged || posChanged) ? "changed" : "unchanged");
    }
  });
  toBeNodeMap.forEach((_, id) => {
    if (!asIsNodeMap.has(id)) {
      nodeStatuses.set(id, "added");
    }
  });

  asIsEdgeMap.forEach((edge, id) => {
    if (!toBeEdgeMap.has(id)) {
      edgeStatuses.set(id, "removed");
    } else {
      const toBeEdge = toBeEdgeMap.get(id)!;
      const sourceChanged = edge.source !== toBeEdge.source;
      const targetChanged = edge.target !== toBeEdge.target;
      const labelChanged = (edge.label || "") !== (toBeEdge.label || "");
      edgeStatuses.set(id, (sourceChanged || targetChanged || labelChanged) ? "changed" : "unchanged");
    }
  });
  toBeEdgeMap.forEach((_, id) => {
    if (!asIsEdgeMap.has(id)) {
      edgeStatuses.set(id, "added");
    }
  });

  return { nodeStatuses, edgeStatuses };
}

function applyCompareStyleToNodes(nodes: any[], statuses: Map<string, CompareStatus>, side: "asIs" | "toBe"): Node[] {
  return nodes.map((node: any) => {
    const status = statuses.get(node.id);
    let style = { ...(node.style || {}) };
    if (status === "added" && side === "toBe") {
      style = { ...style, border: "3px solid #22C55E", boxShadow: "0 0 12px rgba(34, 197, 94, 0.3)" };
    } else if (status === "removed" && side === "asIs") {
      style = { ...style, border: "3px dashed #EF4444", opacity: 0.7, boxShadow: "0 0 12px rgba(239, 68, 68, 0.3)" };
    } else if (status === "changed") {
      style = { ...style, border: "3px solid #F59E0B", boxShadow: "0 0 12px rgba(245, 158, 11, 0.3)" };
    }
    return { ...node, style, draggable: false, connectable: false, selectable: false };
  });
}

function applyCompareStyleToEdges(edges: any[], statuses: Map<string, CompareStatus>, side: "asIs" | "toBe"): Edge[] {
  return edges.map((edge: any) => {
    const status = statuses.get(edge.id);
    let style = { ...(edge.style || {}) };
    if (status === "added" && side === "toBe") {
      style = { ...style, stroke: "#22C55E", strokeWidth: 3 };
    } else if (status === "removed" && side === "asIs") {
      style = { ...style, stroke: "#EF4444", strokeWidth: 3, strokeDasharray: "8 4" };
    } else if (status === "changed") {
      style = { ...style, stroke: "#F59E0B", strokeWidth: 3 };
    }
    return { ...edge, style, selectable: false };
  });
}

function DiagramCompareView({ asIsId, toBeId, onBack }: { asIsId: number; toBeId: number; onBack: () => void }) {
  const { resolvedTheme } = useTheme();
  const { data: asIsDiagram } = useQuery<BpmDiagram>({ queryKey: ["/api/bpm/diagrams", asIsId], staleTime: BPM_QUERY_STALE_MS });
  const { data: toBeDiagram } = useQuery<BpmDiagram>({ queryKey: ["/api/bpm/diagrams", toBeId], staleTime: BPM_QUERY_STALE_MS });

  const diffResult = useMemo(() => {
    if (!asIsDiagram || !toBeDiagram) return null;
    const asIsNodes = (asIsDiagram.canvasData as any)?.nodes || [];
    const toBeNodes = (toBeDiagram.canvasData as any)?.nodes || [];
    const asIsEdges = (asIsDiagram.canvasData as any)?.edges || [];
    const toBeEdges = (toBeDiagram.canvasData as any)?.edges || [];
    return diffCanvasData(asIsNodes, toBeNodes, asIsEdges, toBeEdges);
  }, [asIsDiagram, toBeDiagram]);

  const { asIsStyledNodes, asIsStyledEdges, toBeStyledNodes, toBeStyledEdges, counts } = useMemo(() => {
    if (!asIsDiagram || !toBeDiagram || !diffResult) {
      return { asIsStyledNodes: [], asIsStyledEdges: [], toBeStyledNodes: [], toBeStyledEdges: [], counts: { added: 0, removed: 0, changed: 0 } };
    }
    const asIsNodes = (asIsDiagram.canvasData as any)?.nodes || [];
    const toBeNodes = (toBeDiagram.canvasData as any)?.nodes || [];
    const asIsEdges = (asIsDiagram.canvasData as any)?.edges || [];
    const toBeEdges = (toBeDiagram.canvasData as any)?.edges || [];

    let added = 0, removed = 0, changed = 0;
    diffResult.nodeStatuses.forEach(s => { if (s === "added") added++; else if (s === "removed") removed++; else if (s === "changed") changed++; });
    diffResult.edgeStatuses.forEach(s => { if (s === "added") added++; else if (s === "removed") removed++; else if (s === "changed") changed++; });

    return {
      asIsStyledNodes: applyCompareStyleToNodes(asIsNodes, diffResult.nodeStatuses, "asIs"),
      asIsStyledEdges: applyCompareStyleToEdges(asIsEdges, diffResult.edgeStatuses, "asIs"),
      toBeStyledNodes: applyCompareStyleToNodes(toBeNodes, diffResult.nodeStatuses, "toBe"),
      toBeStyledEdges: applyCompareStyleToEdges(toBeEdges, diffResult.edgeStatuses, "toBe"),
      counts: { added, removed, changed },
    };
  }, [asIsDiagram, toBeDiagram, diffResult]);

  if (!asIsDiagram || !toBeDiagram) {
    return <ModuleTabLoading label="Loading comparison…" className="flex-1" />;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="diagram-compare-view">
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-card flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" variant="outline" onClick={onBack} data-testid="button-compare-back">
            <ArrowLeftRight className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <Badge variant="outline" data-testid="badge-as-is-name">{asIsDiagram.name}</Badge>
            <span className="text-muted-foreground text-sm">vs</span>
            <Badge variant="outline" data-testid="badge-to-be-name">{toBeDiagram.name}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border-2 border-[#22C55E]" />
            <span className="text-xs text-muted-foreground">Added</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border-2 border-dashed border-[#EF4444]" />
            <span className="text-xs text-muted-foreground">Removed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border-2 border-[#F59E0B]" />
            <span className="text-xs text-muted-foreground">Changed</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col border-r">
          <div className="px-3 py-2 border-b bg-muted/30 text-sm font-medium text-muted-foreground" data-testid="text-as-is-header">
            As-Is: {asIsDiagram.name}
          </div>
          <div className="flex-1">
            <ReactFlowProvider>
              <ReactFlow
                nodes={asIsStyledNodes}
                edges={asIsStyledEdges}
                nodeTypes={nodeTypes}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag
                zoomOnScroll
                fitView
                colorMode={resolvedTheme}
                proOptions={{ hideAttribution: true }}
                className="bg-background"
                data-testid="reactflow-as-is"
              >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--muted-foreground) / 0.2)" />
                <Controls showInteractive={false} className="!bg-card !border !shadow-sm" />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="px-3 py-2 border-b bg-muted/30 text-sm font-medium text-muted-foreground" data-testid="text-to-be-header">
            To-Be: {toBeDiagram.name}
          </div>
          <div className="flex-1">
            <ReactFlowProvider>
              <ReactFlow
                nodes={toBeStyledNodes}
                edges={toBeStyledEdges}
                nodeTypes={nodeTypes}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag
                zoomOnScroll
                fitView
                colorMode={resolvedTheme}
                proOptions={{ hideAttribution: true }}
                className="bg-background"
                data-testid="reactflow-to-be"
              >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--muted-foreground) / 0.2)" />
                <Controls showInteractive={false} className="!bg-card !border !shadow-sm" />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t bg-card flex items-center gap-4 flex-wrap" data-testid="compare-summary">
        <span className="text-sm font-medium text-muted-foreground">Summary:</span>
        <Badge variant="outline" className="border-[#22C55E] text-[#22C55E]" data-testid="badge-added-count">{counts.added} added</Badge>
        <Badge variant="outline" className="border-[#EF4444] text-[#EF4444]" data-testid="badge-removed-count">{counts.removed} removed</Badge>
        <Badge variant="outline" className="border-[#F59E0B] text-[#F59E0B]" data-testid="badge-changed-count">{counts.changed} changed</Badge>
      </div>
      <BpmDeltaReportTable
        asIsNodes={(asIsDiagram.canvasData as any)?.nodes || []}
        toBeNodes={(toBeDiagram.canvasData as any)?.nodes || []}
      />
    </div>
  );
}

type BpmlEntry = {
  id: number;
  templateId: number;
  tenantId: number;
  processName: string;
  processDescription: string | null;
  businessArea?: string | null;
  level1: string | null;
  level2: string | null;
  level3: string | null;
  level4: string | null;
  level5: string | null;
  sequenceOrder: number | null;
  overallStatus: string | null;
  processOwner: string | null;
  department: string | null;
};

type BpmlTemplate = {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  status: string;
};

type TreeNodeData = {
  value: string;
  name: string;
  count: number;
  entries: BpmlEntry[];
  level: number;
  path: string;
};

const BPM_PORTAL_TABS = ["library", "diagrams"] as const;

function ProcessPortal() {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [activeTab, setActiveTab] = useModuleTabUrl(BPM_PORTAL_TABS, "library");
  const [selectedLibrary, setSelectedLibrary] = useState<number | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [viewingDiagram, setViewingDiagram] = useState<BpmDiagram | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
  const [newNodeName, setNewNodeName] = useState("");
  const [assignDialogNodeId, setAssignDialogNodeId] = useState<number | null>(null);
  const [selectedMenuNodeId, setSelectedMenuNodeId] = useState<number | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<{ node: TreeNodeData; entry: BpmlEntry } | null>(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [videoLightbox, setVideoLightbox] = useState<string | null>(null);

  const { data: bpmlLibraries = [], isLoading: librariesLoading } = useQuery<BpmlTemplate[]>({
    queryKey: [`/api/bpml/templates`],
    staleTime: BPM_QUERY_STALE_MS,
  });

  const { data: allEntries = [], isLoading: entriesLoading } = useQuery<BpmlEntry[]>({
    queryKey: [`/api/bpml/entries?templateId=${selectedLibrary}`],
    enabled: !!selectedLibrary,
    staleTime: BPM_QUERY_STALE_MS,
  });

  const { data: allDiagrams = [], isLoading: diagramsLoading } = useQuery<BpmDiagram[]>({
    queryKey: [`/api/bpm/diagrams`],
    staleTime: BPM_QUERY_STALE_MS,
  });

  const { data: menuNodes = [], isLoading: menuNodesLoading } = useQuery<any[]>({
    queryKey: [`/api/portal/menu-nodes`],
    staleTime: BPM_QUERY_STALE_MS,
  });

  const { data: portalAssignments = [], isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: [`/api/portal/assignments`],
    staleTime: BPM_QUERY_STALE_MS,
  });

  const { data: allResources = [], isLoading: resourcesLoading } = useQuery<ProcessResource[]>({
    queryKey: [`/api/process-resources`],
    staleTime: BPM_QUERY_STALE_MS,
  });

  const { data: portalSettings, isLoading: portalSettingsLoading } = useQuery<any>({
    queryKey: [`/api/bpm/portal-settings${selectedLibrary ? `?libraryId=${selectedLibrary}` : ""}`],
    enabled: !!selectedLibrary,
    staleTime: BPM_QUERY_STALE_MS,
  });

  const areaColorMap: Record<string, string> = (portalSettings?.businessAreaColors as Record<string, string>) || {};

  const entries = useMemo(() => {
    let data = allEntries.filter(e => e.templateId === selectedLibrary);
    if (portalSettings?.accessModel === "tag_based" && user?.id) {
      const userAreaTags = (portalSettings.userAreaTags as Record<string, string[]>) || {};
      const userTags = userAreaTags[user.id] || [];
      if (userTags.length > 0) {
        const tagSet = new Set(userTags.map(t => t.toLowerCase()));
        data = data.filter(e => {
          const area = (e.businessArea || e.level1 || "").trim().toLowerCase();
          return area && tagSet.has(area);
        });
      }
    }
    return data;
  }, [allEntries, selectedLibrary, portalSettings, user?.id]);

  const createMenuNodeMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/portal/menu-nodes", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/menu-nodes"] });
    },
  });

  const updateMenuNodeMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => apiRequest("PATCH", `/api/portal/menu-nodes/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/menu-nodes"] });
    },
  });

  const deleteMenuNodeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/portal/menu-nodes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/menu-nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portal/assignments"] });
    },
  });

  const createAssignmentMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/portal/assignments", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/assignments"] });
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/portal/assignments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/assignments"] });
    },
  });

  const levelKey = (level: number): keyof BpmlEntry => {
    const keys: Record<number, keyof BpmlEntry> = { 1: "level1", 2: "level2", 3: "level3", 4: "level4", 5: "level5" };
    return keys[level] || "level1";
  };

  const levelColorDots: Record<number, string> = {
    1: "bg-[#1E88C8]",
    2: "bg-[#7C3AED]",
    3: "bg-[#22C55E]",
    4: "bg-[#F59E0B]",
    5: "bg-[#EC4899]",
  };

  const levelLabels: Record<number, string> = {
    1: "End-to-End Process",
    2: "Process Group",
    3: "Business Process",
    4: "Sub-Process",
    5: "Task",
  };

  const resourceColumns = ["Process Flow Diagram", "User Guide", "Quick Ref", "Simulation Video", "SOP", "Data Entry Guides"] as const;

  const findMatchingDiagram = useCallback((levelValue: string) => {
    return allDiagrams.find(d =>
      d.name.toLowerCase().trim() === levelValue.toLowerCase().trim()
    );
  }, [allDiagrams]);

  const toggleNode = (nodeKey: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeKey)) next.delete(nodeKey);
      else next.add(nodeKey);
      return next;
    });
  };

  function buildTreeLevel(filteredEntries: BpmlEntry[], level: number, parentPath: string): TreeNodeData[] {
    if (level > 5) return [];
    const key = levelKey(level);
    const valuesMap = new Map<string, { name: string; count: number; entries: BpmlEntry[] }>();
    for (const e of filteredEntries) {
      const val = (e[key] as string || "").trim();
      if (!val) continue;
      const existing = valuesMap.get(val);
      if (existing) {
        existing.count++;
        existing.entries.push(e);
      } else {
        valuesMap.set(val, { name: val, count: 1, entries: [e] });
      }
    }
    return Array.from(valuesMap.entries())
      .map(([value, data]) => ({
        value,
        ...data,
        level,
        path: parentPath ? `${parentPath}/${value}` : value,
      }))
      .sort((a, b) => {
        const seqA = Math.min(...a.entries.map(e => e.sequenceOrder ?? 9999));
        const seqB = Math.min(...b.entries.map(e => e.sequenceOrder ?? 9999));
        return seqA - seqB || a.name.localeCompare(b.name);
      });
  }

  const featuredProcesses = useMemo(() => {
    if (!selectedLibrary || entries.length === 0) return [];
    const seen = new Set<string>();
    const featured: { entry: BpmlEntry; diagram: BpmDiagram; l1: string }[] = [];
    for (const entry of entries) {
      const levels = [entry.level5, entry.level4, entry.level3, entry.level2, entry.level1].filter(Boolean) as string[];
      for (const lvl of levels) {
        if (seen.has(lvl)) continue;
        seen.add(lvl);
        const diagram = findMatchingDiagram(lvl);
        if (diagram) {
          featured.push({ entry, diagram, l1: entry.level1 || "" });
          if (featured.length >= 3) return featured;
        }
      }
    }
    return featured;
  }, [entries, selectedLibrary, findMatchingDiagram]);

  function LibraryTreeNode({ node, depth }: { node: TreeNodeData; depth: number }) {
    const isExpanded = expandedNodes.has(node.path);
    const matchingDiagram = findMatchingDiagram(node.value);
    const isSelected = selectedEntry?.node.path === node.path;

    const childEntries = node.entries;
    const children = node.level < 5 ? buildTreeLevel(childEntries, node.level + 1, node.path) : [];
    const hasChildren = children.length > 0;
    const isLeaf = !hasChildren;

    const entryIds = node.entries.map(e => e.id);
    const entryResources = allResources.filter(r =>
      (r.entryId && entryIds.includes(r.entryId)) ||
      (r.menuNodeId && menuNodes.some((mn: any) => mn.id === r.menuNodeId && mn.name === node.value))
    );

    const hasDiagram = !!findMatchingDiagram(node.value);
    const hasGuide = entryResources.some(r => r.resourceType === "user_guide");
    const hasQuickRef = entryResources.some(r => r.resourceType === "quick_reference");
    const hasSimVideo = entryResources.some(r => r.resourceType === "simulation" || r.resourceType === "video");
    const hasSop = entryResources.some(r => r.resourceType === "sop");
    const hasDataEntry = entryResources.some(r => r.resourceType === "template" || r.resourceType === "tool");
    const indicators = [hasDiagram, hasGuide, hasQuickRef, hasSimVideo, hasSop, hasDataEntry];

    return (
      <div data-testid={`tree-node-${node.path.replace(/\s+/g, '-').toLowerCase()}`}>
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer group",
            isSelected ? "bg-accent" : "hover-elevate"
          )}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => {
            if (isLeaf) {
              setSelectedEntry(isSelected ? null : { node, entry: node.entries[0] });
            } else {
              toggleNode(node.path);
            }
          }}
          data-testid={`tree-row-${node.path.replace(/\s+/g, '-').toLowerCase()}`}
        >
          {hasChildren ? (
            <button
              className="shrink-0"
              onClick={(e) => { e.stopPropagation(); toggleNode(node.path); }}
              data-testid={`button-toggle-${node.path.replace(/\s+/g, '-').toLowerCase()}`}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <div className={cn("w-2 h-2 rounded-full shrink-0", levelColorDots[node.level] || "bg-muted-foreground")}
            style={node.level === 1 && areaColorMap[node.name] ? { backgroundColor: areaColorMap[node.name] } : undefined}
          />
          <span className="text-sm min-w-0 truncate">{node.name}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">{node.count}</Badge>
          <div className="flex items-center gap-1.5 shrink-0 ml-1" data-testid={`resource-indicators-${node.path.replace(/\s+/g, '-').toLowerCase()}`}>
            {resourceColumns.map((col, i) => {
              const has = indicators[i];
              return (
                <div key={col} className="relative group/tip" title={col}>
                  <div className={cn("w-2 h-2 rounded-full", has ? "bg-status-green" : "bg-muted-foreground/20")} />
                </div>
              );
            })}
          </div>
          {matchingDiagram && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ visibility: "visible" }}
              onClick={(e) => {
                e.stopPropagation();
                setViewingDiagram(matchingDiagram);
              }}
              data-testid={`button-view-diagram-${node.path.replace(/\s+/g, '-').toLowerCase()}`}
            >
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
          )}
        </div>
        {isExpanded && hasChildren && (
          <div data-testid={`tree-children-${node.path.replace(/\s+/g, '-').toLowerCase()}`}>
            {children.map(child => (
              <LibraryTreeNode key={child.path} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  function MenuTreeNode({ node, depth }: { node: any; depth: number }) {
    const nodeKey = `menu-${node.id}`;
    const isExpanded = expandedNodes.has(nodeKey);
    const childNodes = menuNodes.filter((n: any) => n.parentId === node.id);
    const hasChildren = childNodes.length > 0;
    const nodeAssignments = portalAssignments.filter((a: any) => a.menuNodeId === node.id);
    const isEditing = editingNodeId === node.id;
    const isLeaf = !hasChildren;
    const isSelected = selectedMenuNodeId === node.id;

    return (
      <div data-testid={`menu-node-${node.id}`}>
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer group",
            isSelected && !editMode ? "bg-accent" : "hover-elevate"
          )}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => {
            if (!editMode && isLeaf) {
              setSelectedMenuNodeId(isSelected ? null : node.id);
            } else if (hasChildren) {
              toggleNode(nodeKey);
            }
          }}
          data-testid={`menu-row-${node.id}`}
        >
          {hasChildren ? (
            <button
              className="shrink-0"
              onClick={(e) => { e.stopPropagation(); toggleNode(nodeKey); }}
              data-testid={`button-toggle-menu-${node.id}`}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <FolderTree className="h-4 w-4 text-muted-foreground shrink-0" />
          {isEditing && editMode ? (
            <Input
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newNodeName.trim()) {
                  updateMenuNodeMutation.mutate({ id: node.id, body: { name: newNodeName.trim() } });
                  setEditingNodeId(null);
                  setNewNodeName("");
                } else if (e.key === "Escape") {
                  setEditingNodeId(null);
                  setNewNodeName("");
                }
              }}
              onBlur={() => {
                if (newNodeName.trim() && newNodeName.trim() !== node.name) {
                  updateMenuNodeMutation.mutate({ id: node.id, body: { name: newNodeName.trim() } });
                }
                setEditingNodeId(null);
                setNewNodeName("");
              }}
              className="h-7 text-sm flex-1"
              autoFocus
              onClick={(e) => e.stopPropagation()}
              data-testid={`input-rename-${node.id}`}
            />
          ) : (
            <span className="text-sm flex-1 min-w-0 truncate">{node.name}</span>
          )}
          {editMode && !isEditing && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ visibility: "visible" }}>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingNodeId(node.id);
                  setNewNodeName(node.name);
                }}
                data-testid={`button-rename-${node.id}`}
              >
                <Edit3 className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  const name = prompt("New child node name:");
                  if (name?.trim()) {
                    createMenuNodeMutation.mutate({ parentId: node.id, name: name.trim(), sortOrder: childNodes.length });
                  }
                }}
                data-testid={`button-add-child-${node.id}`}
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${node.name}" and all its children?`)) {
                    deleteMenuNodeMutation.mutate(node.id);
                  }
                }}
                data-testid={`button-delete-${node.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              {isLeaf && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAssignDialogNodeId(node.id);
                  }}
                  data-testid={`button-assign-diagram-${node.id}`}
                >
                  <Link2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>

        {editMode && isLeaf && nodeAssignments.length > 0 && (
          <div className="ml-4 space-y-1" style={{ paddingLeft: `${depth * 20 + 28}px` }}>
            {nodeAssignments.map((assignment: any) => {
              const diagram = allDiagrams.find((d: any) => d.id === assignment.diagramId);
              return (
                <div key={assignment.id} className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground" data-testid={`assignment-${assignment.id}`}>
                  <Workflow className="h-3 w-3" />
                  <span className="flex-1 truncate">{diagram?.name || `Diagram #${assignment.diagramId}`}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteAssignmentMutation.mutate(assignment.id)}
                    data-testid={`button-remove-assignment-${assignment.id}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {(isExpanded || editMode) && hasChildren && (
          <div data-testid={`menu-children-${node.id}`}>
            {childNodes
              .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .map((child: any) => (
                <MenuTreeNode key={child.id} node={child} depth={depth + 1} />
              ))}
          </div>
        )}

        {!editMode && isSelected && isLeaf && (
          <div className="ml-4 space-y-1 py-1" style={{ paddingLeft: `${depth * 20 + 28}px` }}>
            {nodeAssignments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">No diagrams assigned</p>
            ) : (
              nodeAssignments.map((assignment: any) => {
                const diagram = allDiagrams.find((d: any) => d.id === assignment.diagramId);
                return diagram ? (
                  <div
                    key={assignment.id}
                    className="flex items-center gap-2 py-1 px-2 rounded-md hover-elevate cursor-pointer text-sm"
                    onClick={() => setViewingDiagram(diagram)}
                    data-testid={`view-assignment-${assignment.id}`}
                  >
                    <Workflow className="h-3 w-3 text-primary" />
                    <span className="flex-1 truncate">{diagram.name}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{diagram.status}</Badge>
                  </div>
                ) : null;
              })
            )}
          </div>
        )}
      </div>
    );
  }

  if (viewingDiagram) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" data-testid="portal-diagram-viewer">
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-card flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setViewingDiagram(null)} data-testid="button-portal-back">
            <ChevronRight className="h-4 w-4 mr-1 rotate-180" />
            Back to Portal
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm font-medium" data-testid="text-portal-diagram-name">{viewingDiagram.name}</span>
          {viewingDiagram.status && (
            <Badge variant="outline" className="text-xs capitalize" data-testid="badge-portal-diagram-status">{viewingDiagram.status}</Badge>
          )}
        </div>
        <div className="flex-1">
          <ReactFlowProvider>
            <ReactFlow
              nodes={(viewingDiagram.canvasData as any)?.nodes || []}
              edges={(viewingDiagram.canvasData as any)?.edges || []}
              nodeTypes={nodeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag
              zoomOnScroll
              fitView
              colorMode={resolvedTheme}
              proOptions={{ hideAttribution: true }}
              className="bg-background"
              data-testid="reactflow-portal-viewer"
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--muted-foreground) / 0.2)" />
              <Controls showInteractive={false} className="!bg-card !border !shadow-sm" />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
    );
  }

  const publishedDiagrams = allDiagrams.filter((d: any) => d.status === "published" || d.published);

  const rootTreeNodes = buildTreeLevel(entries, 1, "");
  const rootMenuNodes = menuNodes.filter((n: any) => !n.parentId);

  const collectAllPaths = useCallback((nodes: TreeNodeData[]): string[] => {
    const paths: string[] = [];
    for (const node of nodes) {
      const children = node.level < 5 ? buildTreeLevel(node.entries, node.level + 1, node.path) : [];
      if (children.length > 0) {
        paths.push(node.path);
        paths.push(...collectAllPaths(children));
      }
    }
    return paths;
  }, [entries]);

  const expandAll = useCallback(() => {
    const allPaths = collectAllPaths(rootTreeNodes);
    setExpandedNodes(new Set(allPaths));
  }, [rootTreeNodes, collectAllPaths]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
    setSelectedEntry(null);
  }, []);

  const detailEntry = selectedEntry?.entry;
  const detailNode = selectedEntry?.node;
  const detailDiagram = detailNode ? findMatchingDiagram(detailNode.value) : null;
  const detailBreadcrumb = detailEntry ? [
    { level: 1, value: detailEntry.level1 || "" },
    { level: 2, value: detailEntry.level2 || "" },
    { level: 3, value: detailEntry.level3 || "" },
    { level: 4, value: detailEntry.level4 || "" },
    { level: 5, value: detailEntry.level5 || "" },
  ].filter(b => b.value) : [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0" data-testid="portal-tabs">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-4 sm:px-6 pt-4 pb-0 border-b bg-card shrink-0">
          <h2 className="text-lg sm:text-xl font-semibold mb-3" data-testid="text-portal-title">Process Portal</h2>
          <div className="flex items-center gap-2 mb-3">
            {selectedLibrary && <PortalSettingsDialog  libraryId={selectedLibrary} />}
          </div>
          <TabsList className="h-12 bg-transparent border-0 gap-1" data-testid="portal-tabs-list">
            <TabsTrigger value="library" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-process-library">
              <div className="p-1 rounded-md bg-status-purple">
                <Library className="h-3 w-3 text-status-purple-foreground" />
              </div>
              Process Library
            </TabsTrigger>
            <TabsTrigger value="diagrams" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-process-diagrams">
              <div className="p-1 rounded-md bg-status-blue">
                <FolderTree className="h-3 w-3 text-status-blue-foreground" />
              </div>
              Process Diagrams
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {activeTab === "library" && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {!selectedLibrary ? (
            <div className="flex-1 overflow-auto p-6">
              {librariesLoading ? (
                <BpmCardGridSkeleton count={3} />
              ) : bpmlLibraries.filter(l => l.status === "active").length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Library className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground" data-testid="text-no-libraries">No process libraries found. Create a BPML library first to use the Process Portal.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-4">Select a process library to explore its process hierarchy.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bpmlLibraries.filter(l => l.status === "active").map(lib => (
                      <Card
                        key={lib.id}
                        className="hover-elevate cursor-pointer"
                        onClick={() => setSelectedLibrary(lib.id)}
                        data-testid={`card-portal-library-${lib.id}`}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="p-2 rounded-md bg-primary/10">
                              <Library className="h-5 w-5 text-primary" />
                            </div>
                            <CardTitle className="text-base">{lib.name}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground line-clamp-2">{lib.description || "Process library"}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="px-6 py-3 border-b flex items-center gap-3 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => { setSelectedLibrary(null); setExpandedNodes(new Set()); setSelectedEntry(null); }} data-testid="button-back-libraries">
                  <ChevronRight className="h-4 w-4 mr-1 rotate-180" />
                  Back to Libraries
                </Button>
                <Separator orientation="vertical" className="h-6" />
                <span className="text-sm font-medium" data-testid="text-selected-library">
                  {bpmlLibraries.find(l => l.id === selectedLibrary)?.name || "Library"}
                </span>
                <Badge variant="outline" className="text-xs" data-testid="badge-entry-count">
                  {entries.length} entries
                </Badge>
                <div className="ml-auto flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={expandAll} data-testid="button-expand-all">
                    <ChevronsDownUp className="h-4 w-4 mr-1 rotate-180" />
                    Expand All
                  </Button>
                  <Button size="sm" variant="ghost" onClick={collapseAll} data-testid="button-collapse-all">
                    <ChevronsDownUp className="h-4 w-4 mr-1" />
                    Collapse All
                  </Button>
                </div>
              </div>
              <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                <div className={cn(
                  "flex flex-col overflow-hidden min-h-0 transition-all duration-300",
                  leftPanelCollapsed ? "w-0 opacity-0 overflow-hidden" : selectedEntry ? "w-full lg:w-[60%]" : "flex-1",
                )}>
                  <div className="flex-1 overflow-auto p-3 sm:p-4">
                    {entriesLoading || portalSettingsLoading ? (
                      <BpmLoadingState label="Loading process hierarchy…" />
                    ) : rootTreeNodes.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Target className="h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground mb-1">No processes found.</p>
                        <p className="text-xs text-muted-foreground">Add process entries in the BPML library to populate the portal.</p>
                      </div>
                    ) : (
                      <>
                        {featuredProcesses.length > 0 && (
                          <Card className="mb-4 border-dashed" data-testid="featured-processes-section">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <div className="p-1 rounded-md bg-status-amber">
                                  <Lightbulb className="h-3 w-3 text-status-amber-foreground" />
                                </div>
                                Featured Processes
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pb-3">
                              <div className="flex flex-col gap-2">
                                {featuredProcesses.map((fp, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-3 p-2 rounded-md hover-elevate"
                                    data-testid={`featured-process-${idx}`}
                                  >
                                    <Sparkles className="h-4 w-4 text-status-amber-foreground shrink-0" />
                                    <span className="text-sm flex-1 min-w-0 truncate">{fp.diagram.name}</span>
                                    {fp.l1 && (
                                      <Badge variant="secondary" className="text-[10px] shrink-0">{fp.l1}</Badge>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setViewingDiagram(fp.diagram)}
                                      data-testid={`button-featured-view-${idx}`}
                                    >
                                      <Eye className="h-3 w-3 mr-1" />
                                      View
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        <div className="flex items-center gap-3 py-1.5 px-4 mb-1 sticky top-0 z-10 bg-background border-b" data-testid="resource-columns-header">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Resource Key:</span>
                          {resourceColumns.map((col) => (
                            <div key={col} className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
                              <span className="text-[10px] text-muted-foreground">{col}</span>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-0.5" data-testid="library-tree">
                          {rootTreeNodes.map(node => (
                            <LibraryTreeNode key={node.path} node={node} depth={0} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {selectedEntry && (
                  <div className={cn(
                    "border-t lg:border-t-0 lg:border-l p-3 sm:p-4 overflow-auto transition-all duration-300 min-h-0",
                    leftPanelCollapsed ? "flex-1" : "w-full lg:w-[40%]",
                  )} data-testid="detail-panel">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="ghost" onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)} title={leftPanelCollapsed ? "Show tree" : "Collapse tree"} data-testid="button-collapse-tree">
                          {leftPanelCollapsed ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                        </Button>
                        <h3 className="text-base font-semibold" data-testid="detail-panel-name">{detailNode?.name}</h3>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setSelectedEntry(null)}
                        data-testid="button-close-detail-panel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap mb-4" data-testid="detail-breadcrumb">
                      {detailBreadcrumb.map((b, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                          <div className={cn("w-2 h-2 rounded-full shrink-0", levelColorDots[b.level] || "bg-muted-foreground")} />
                          <span className="text-xs text-muted-foreground">{b.value}</span>
                        </span>
                      ))}
                    </div>

                    <div className="mb-4">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">{levelLabels[detailNode?.level || 1]}</span>
                    </div>

                    <Separator className="mb-4" />

                    <PortalAssetPanel
                      
                      entryIds={detailNode?.entries.map(e => e.id) || []}
                      entryLabel={detailNode?.name || ""}
                      resources={allResources}
                      resourcesLoading={resourcesLoading}
                      diagramId={detailDiagram?.id}
                      onViewDiagram={detailDiagram ? () => setViewingDiagram(detailDiagram) : undefined}
                      onPlayVideo={(url) => setVideoLightbox(url)}
                    />
                  </div>
                )}
              </div>

              {videoLightbox && (
                <Dialog open={!!videoLightbox} onOpenChange={() => setVideoLightbox(null)}>
                  <DialogContent className="max-w-3xl p-0 overflow-hidden" data-testid="video-lightbox">
                    <video src={videoLightbox} controls autoPlay className="w-full" />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "diagrams" && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="px-6 py-3 border-b flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground">Custom menu tree for process diagrams</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={editMode ? "default" : "outline"}
                onClick={() => { setEditMode(!editMode); setSelectedMenuNodeId(null); }}
                className="toggle-elevate"
                data-testid="button-toggle-edit-mode"
              >
                {editMode ? <Eye className="h-4 w-4 mr-1" /> : <Edit3 className="h-4 w-4 mr-1" />}
                {editMode ? "View Mode" : "Edit Mode"}
              </Button>
              {editMode && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const name = prompt("Root node name:");
                    if (name?.trim()) {
                      createMenuNodeMutation.mutate({ parentId: null, name: name.trim(), sortOrder: rootMenuNodes.length });
                    }
                  }}
                  data-testid="button-add-root-node"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Root Node
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {menuNodesLoading || diagramsLoading || assignmentsLoading ? (
              <BpmLoadingState label="Loading menu tree…" />
            ) : rootMenuNodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FolderTree className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-1">No menu nodes yet.</p>
                <p className="text-xs text-muted-foreground">
                  {editMode ? "Click 'Add Root Node' to start building your menu tree." : "Switch to Edit Mode to create your menu structure."}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5" data-testid="menu-tree">
                {rootMenuNodes
                  .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                  .map((node: any) => (
                    <MenuTreeNode key={node.id} node={node} depth={0} />
                  ))}
              </div>
            )}
          </div>

          {assignDialogNodeId !== null && (
            <FormDialogViewShell
              open={true}
              onOpenChange={() => setAssignDialogNodeId(null)}
              onClose={() => setAssignDialogNodeId(null)}
              title="Assign Diagram"
              subtitle="Select a published diagram to assign to this menu node."
              size="sm"
            >
                <div className="space-y-2 max-h-60 overflow-auto">
                  {publishedDiagrams.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No published diagrams available.</p>
                  ) : (
                    publishedDiagrams.map((diagram: any) => {
                      const alreadyAssigned = portalAssignments.some(
                        (a: any) => a.menuNodeId === assignDialogNodeId && a.diagramId === diagram.id
                      );
                      return (
                        <div
                          key={diagram.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-md",
                            alreadyAssigned ? "opacity-50" : "hover-elevate cursor-pointer"
                          )}
                          onClick={() => {
                            if (!alreadyAssigned) {
                              createAssignmentMutation.mutate({
                                menuNodeId: assignDialogNodeId,
                                diagramId: diagram.id,
                                sortOrder: 0,
                              });
                              setAssignDialogNodeId(null);
                            }
                          }}
                          data-testid={`assign-option-${diagram.id}`}
                        >
                          <Workflow className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm flex-1 truncate">{diagram.name}</span>
                          {alreadyAssigned && <Badge variant="outline" className="text-[10px]">Assigned</Badge>}
                        </div>
                      );
                    })
                  )}
                </div>
            </FormDialogViewShell>
          )}
        </div>
      )}
    </div>
  );
}

export default function BPMPage() {
  const { toast } = useToast();
  const [view, setView] = useState<"catalogue" | "editor" | "compare">("catalogue");
  const [compareAsIsId, setCompareAsIsId] = useState<number | null>(null);
  const [compareToBeId, setCompareToBeId] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>("bpml");
  const [activeDiagram, setActiveDiagram] = useState<BpmDiagram | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateLibraryDialog, setShowCreateLibraryDialog] = useState(false);
  const [showCreateTemplateDialog, setShowCreateTemplateDialog] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [showManageTemplatesDialog, setShowManageTemplatesDialog] = useState(false);
  const [newDiagramName, setNewDiagramName] = useState("");
  const [newDiagramType, setNewDiagramType] = useState("process_flow");
  const [newDiagramDescription, setNewDiagramDescription] = useState("");
  const [newDiagramLibraryId, setNewDiagramLibraryId] = useState("none");
  const [selectedTemplate, setSelectedTemplate] = useState("blank");
  const [templateTab, setTemplateTab] = useState("builtin");
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateDescription, setSaveTemplateDescription] = useState("");
  const [saveTemplateVendor, setSaveTemplateVendor] = useState("none");
  const [saveTemplateProcessType, setSaveTemplateProcessType] = useState("none");
  const [saveTemplateLibraryId, setSaveTemplateLibraryId] = useState("");
  const [manageFilterLibrary, setManageFilterLibrary] = useState("all");
  const [pendingTemplateData, setPendingTemplateData] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [expandedLibraries, setExpandedLibraries] = useState<Set<string>>(new Set(["system", "unassigned"]));

  const [newLibraryName, setNewLibraryName] = useState("");
  const [newLibraryDescription, setNewLibraryDescription] = useState("");
  const [newLibraryVendor, setNewLibraryVendor] = useState("none");
  const [newLibrarySystemTag, setNewLibrarySystemTag] = useState("");
  const [newLibraryIsTemplate, setNewLibraryIsTemplate] = useState(false);
  const [newLibraryStatus, setNewLibraryStatus] = useState("draft");

  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateLibraryId, setNewTemplateLibraryId] = useState("");
  const [newTemplateProcessType, setNewTemplateProcessType] = useState("none");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");

  const [showImportCsvDialog, setShowImportCsvDialog] = useState(false);
  const [importCsvPreview, setImportCsvPreview] = useState<Map<string, ParsedProcessRow[]> | null>(null);
  const [importCsvFileName, setImportCsvFileName] = useState("");
  const [importCsvOrientation, setImportCsvOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [importCsvDiagramName, setImportCsvDiagramName] = useState("");
  const importCsvFileRef = useRef<HTMLInputElement>(null);

  const [activeFramework, setActiveFramework] = useState<FrameworkItem | null>(null);
  const [showCreateFrameworkDialog, setShowCreateFrameworkDialog] = useState(false);
  const [newFrameworkName, setNewFrameworkName] = useState("");
  const [newFrameworkDescription, setNewFrameworkDescription] = useState("");
  const [newFrameworkCategory, setNewFrameworkCategory] = useState("project_delivery");
  const [newFrameworkVendor, setNewFrameworkVendor] = useState("none");
  const [useTemplate, setUseTemplate] = useState<"blank" | "sap_activate" | "workday">("blank");

  const { data: userTemplates = [] } = useQuery<BpmTemplate[]>({
    queryKey: ["/api/bpm/templates"],
    staleTime: BPM_QUERY_STALE_MS,
  });

  const { data: libraries = [] } = useQuery<BpmLibrary[]>({
    queryKey: [`/api/bpm/libraries`],
    staleTime: BPM_QUERY_STALE_MS,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/bpm/diagrams", data),
    onSuccess: async (res) => {
      const diagram = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/bpm/diagrams"] });
      setShowCreateDialog(false);
      setNewDiagramName("");
      setNewDiagramDescription("");
      setNewDiagramLibraryId("none");
      setSelectedTemplate("blank");
      setActiveDiagram(diagram);
      setView("editor");
      toast({ title: "Created", description: "Diagram created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createLibraryMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/bpm/libraries", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bpm/libraries`] });
      setShowCreateLibraryDialog(false);
      setNewLibraryName("");
      setNewLibraryDescription("");
      setNewLibraryVendor("none");
      setNewLibrarySystemTag("");
      setNewLibraryIsTemplate(false);
      setNewLibraryStatus("draft");
      toast({ title: "Library Created", description: "New library has been created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/bpm/templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bpm/templates"] });
      setShowCreateTemplateDialog(false);
      setNewTemplateName("");
      setNewTemplateLibraryId("");
      setNewTemplateProcessType("none");
      setNewTemplateDescription("");
      toast({ title: "Template Created", description: "New template has been created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/bpm/templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bpm/templates"] });
      setShowSaveTemplateDialog(false);
      setSaveTemplateName("");
      setSaveTemplateDescription("");
      setSaveTemplateVendor("none");
      setSaveTemplateProcessType("none");
      setSaveTemplateLibraryId("");
      setPendingTemplateData(null);
      toast({ title: "Template Saved", description: "Your diagram has been saved as a reusable template" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/bpm/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bpm/templates"] });
      toast({ title: "Deleted", description: "Template removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete template", variant: "destructive" });
    },
  });

  const handleCreateDiagram = () => {
    if (!newDiagramName.trim()) return;

    let canvasData = { nodes: [] as any[], edges: [] as any[] };

    if (templateTab === "builtin" && PROCESS_TEMPLATES[selectedTemplate]) {
      const tpl = PROCESS_TEMPLATES[selectedTemplate];
      canvasData = { nodes: tpl.nodes, edges: tpl.edges };
    } else if (templateTab === "saved") {
      const userTpl = userTemplates.find(t => `user_${t.id}` === selectedTemplate);
      if (userTpl?.templateData) {
        const data = userTpl.templateData as any;
        canvasData = { nodes: data.nodes || [], edges: data.edges || [] };
      }
    }

    createMutation.mutate({
      name: newDiagramName,
      description: newDiagramDescription || null,
      type: newDiagramType,
      status: "draft",
      libraryId: newDiagramLibraryId && newDiagramLibraryId !== "none" ? Number(newDiagramLibraryId) : null,
      canvasData,
    });
  };

  const handleImportCsvFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportCsvFileName(file.name);
    const nameFromFile = file.name.replace(/\.csv$/i, "").replace(/[_-]/g, " ");
    if (!importCsvDiagramName) setImportCsvDiagramName(nameFromFile);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsvContent(text);
      setImportCsvPreview(parsed);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [importCsvDiagramName]);

  const handleImportCsvConfirm = useCallback(() => {
    if (!importCsvPreview || importCsvPreview.size === 0 || !importCsvDiagramName.trim()) return;
    const allProcesses = Array.from(importCsvPreview.entries());
    const [, rows] = allProcesses[0];
    const { nodes, edges } = buildDiagramFromRows(rows, importCsvOrientation);
    createMutation.mutate({
      name: importCsvDiagramName,
      description: null,
      type: "process_flow",
      status: "draft",
      canvasData: { nodes, edges },
    });
    setShowImportCsvDialog(false);
    setImportCsvPreview(null);
    setImportCsvFileName("");
    setImportCsvDiagramName("");
  }, [importCsvPreview, importCsvDiagramName, importCsvOrientation, createMutation]);

  const handleCreateLibrary = () => {
    if (!newLibraryName.trim()) return;
    createLibraryMutation.mutate({
      name: newLibraryName,
      description: newLibraryDescription || null,
      vendor: newLibraryVendor && newLibraryVendor !== "none" ? newLibraryVendor : null,
      systemTag: newLibrarySystemTag.trim() || null,
      isTemplateLibrary: newLibraryIsTemplate,
      status: newLibraryStatus,
      ownerId: null,
    });
  };

  const handleCreateTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateLibraryId) return;
    createTemplateMutation.mutate({
      libraryId: Number(newTemplateLibraryId),
      name: newTemplateName,
      description: newTemplateDescription || null,
      type: "process_flow",
      category: "user",
      vendor: null,
      processType: newTemplateProcessType && newTemplateProcessType !== "none" ? newTemplateProcessType : null,
      templateData: { nodes: [], edges: [] },
      isSystem: false,
    });
  };

  const handleSaveAsTemplate = (nodes: any[], edges: any[], name: string) => {
    setPendingTemplateData({ nodes, edges });
    setSaveTemplateName(name + " Template");
    setShowSaveTemplateDialog(true);
  };

  const handleConfirmSaveTemplate = () => {
    if (!saveTemplateName.trim() || !pendingTemplateData || !saveTemplateLibraryId) return;
    saveTemplateMutation.mutate({
      libraryId: Number(saveTemplateLibraryId),
      name: saveTemplateName,
      description: saveTemplateDescription || null,
      type: "process_flow",
      category: "user",
      vendor: saveTemplateVendor && saveTemplateVendor !== "none" ? saveTemplateVendor : null,
      processType: saveTemplateProcessType && saveTemplateProcessType !== "none" ? saveTemplateProcessType : null,
      templateData: pendingTemplateData,
      isSystem: false,
    });
  };

  const handleOpenDiagram = (diagram: BpmDiagram) => {
    setActiveDiagram(diagram);
    setView("editor");
  };

  const handleBackToCatalogue = () => {
    setView("catalogue");
    setActiveDiagram(null);
    queryClient.invalidateQueries({ queryKey: ["/api/bpm/diagrams"] });
  };

  const createFrameworkMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/frameworks", data),
    onSuccess: async (res) => {
      const fw = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/frameworks"] });
      setShowCreateFrameworkDialog(false);
      setNewFrameworkName(""); setNewFrameworkDescription(""); setNewFrameworkCategory("project_delivery"); setNewFrameworkVendor("none"); setUseTemplate("blank");
      setActiveFramework(fw);
      toast({ title: "Created", description: "Framework created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenFramework = (fw: FrameworkItem) => setActiveFramework(fw);

  const handleBackFromFramework = () => {
    setActiveFramework(null);
    queryClient.invalidateQueries({ queryKey: ["/api/frameworks"] });
  };

  const handleCreateFramework = () => {
    if (!newFrameworkName.trim()) return;
    const templateMap: Record<string, FrameworkPhase[]> = { sap_activate: SAP_ACTIVATE_PHASES, workday: WORKDAY_PHASES };
    const templatePhases = templateMap[useTemplate]?.map(p => ({ ...p, id: `phase_${Date.now()}_${p.order}` })) || [];
    createFrameworkMutation.mutate({
      name: newFrameworkName, description: newFrameworkDescription || null,
      category: newFrameworkCategory, vendor: newFrameworkVendor && newFrameworkVendor !== "none" ? newFrameworkVendor : null,
      version: "1.0", status: "draft", phases: templatePhases,
    });
  };

  const loadSapActivateTemplate = () => {
    setUseTemplate("sap_activate");
    setNewFrameworkName("SAP Activate - Implementation");
    setNewFrameworkDescription("SAP's agile implementation methodology for deploying SAP S/4HANA and cloud solutions. Covers the complete project lifecycle from discovery through go-live and ongoing optimization.");
    setNewFrameworkCategory("project_delivery");
    setNewFrameworkVendor("sap");
  };

  const loadWorkdayTemplate = () => {
    setUseTemplate("workday");
    setNewFrameworkName("Workday - Implementation Methodology");
    setNewFrameworkDescription("End-to-end implementation methodology for Workday HCM, Finance, and Adaptive Planning deployments. Covers 8 phases from planning through hypercare with emphasis on fit-to-standard configuration and change management.");
    setNewFrameworkCategory("project_delivery");
    setNewFrameworkVendor("workday");
  };

  const toggleLibraryExpanded = (key: string) => {
    setExpandedLibraries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const templatesGroupedByLibrary = useMemo(() => {
    const groups: { libraryId: number | null; libraryName: string; templates: BpmTemplate[] }[] = [];

    const libMap = new Map<number, BpmLibrary>();
    libraries.forEach(lib => libMap.set(lib.id, lib));

    const byLib = new Map<number | null, BpmTemplate[]>();
    userTemplates.forEach(tpl => {
      const key = tpl.libraryId ?? null;
      if (!byLib.has(key)) byLib.set(key, []);
      byLib.get(key)!.push(tpl);
    });

    libraries.forEach(lib => {
      const tpls = byLib.get(lib.id) || [];
      groups.push({ libraryId: lib.id, libraryName: lib.name, templates: tpls });
    });

    const unassigned = byLib.get(null) || [];
    if (unassigned.length > 0) {
      groups.push({ libraryId: null, libraryName: "Unassigned", templates: unassigned });
    }

    return groups;
  }, [userTemplates, libraries]);

  return (
    <ModuleShell
      className={modulePageShellClass}
      showSidebar={view === "catalogue"}
      fullBleed={view !== "catalogue"}
      mainClassName={modulePageMainClass}
    >
        {view === "catalogue" && (
          <>
            <div className={modulePageBannerWrapClass}>
              <ModuleWelcomeBanner moduleKey="bpm" features={["Process diagrams", "Canvas editor", "Org charts", "Frameworks"]} />
            </div>
            <div className={modulePageStickyHeaderClass}>
              <ModuleHeader
                icon={Workflow}
                title="BPM"
                subtitle="Business Process Management"
                titleTestId="text-bpm-title"
                actions={
                  <Button size="sm" variant="outline" onClick={() => setShowManageTemplatesDialog(true)} data-testid="button-manage-templates">
                    <LayoutTemplate className="h-4 w-4 mr-1" />
                    Templates
                  </Button>
                }
              />
              <div className={modulePageTabsWrapClass}>
                <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as ActiveSection)}>
                  <TabsList className={modulePageTabsListClass}>
                    {SUB_NAV_ITEMS.map(item => (
                      <TabsTrigger
                        key={item.key}
                        value={item.key}
                        className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-primary/10 data-[state=active]:text-primary")}
                        data-testid={`tab-section-${item.key}`}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">{item.label}</span>
                        <span className="sm:hidden">{item.label.split(" ")[0]}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </>
        )}

        {view === "catalogue" ? (
          <div className={modulePageContentOuterClass}>
            <div className={modulePageContentScrollClass}>
          {activeSection === "portal" ? (
            <ProcessPortal />
          ) : activeSection === "frameworks" ? (
            activeFramework ? (
              <FrameworkDetailView framework={activeFramework} onBack={handleBackFromFramework} onUpdate={(updated) => setActiveFramework(updated)} />
            ) : (
              <FrameworksCatalogue onOpenFramework={handleOpenFramework} onCreateNew={() => setShowCreateFrameworkDialog(true)} />
            )
          ) : activeSection === "bpml" ? (
            <Suspense fallback={<ModuleTabLoading label="Loading BPML…" className="flex-1" />}>
              <BpmlView />
            </Suspense>
          ) : activeSection === "orgchart" ? (
            <Suspense fallback={<ModuleTabLoading label="Loading org chart…" className="flex-1" />}>
              <OrgChartView />
            </Suspense>
          ) : activeSection === "task-tracker" ? (
            <div className="p-3 sm:p-4 md:p-6">
              <ModuleTrackingBoard
                apiPath="/api/bpm/tracking-board"
                queryKey={["/api/bpm/tracking-board"]}
                title="BPM Task Tracker"
                description="Track process improvement actions, remediation tasks, and audit follow-ups."
              />
            </div>
          ) : (
            <DiagramCatalogue
              onOpenDiagram={handleOpenDiagram}
              onCreateNew={() => setShowCreateDialog(true)}
              onCreateLibrary={() => setShowCreateLibraryDialog(true)}
              onCreateTemplate={() => setShowCreateTemplateDialog(true)}
              onImportCsv={() => { setShowImportCsvDialog(true); setImportCsvPreview(null); setImportCsvFileName(""); setImportCsvDiagramName(""); }}
              onCompare={(asIsId, toBeId) => {
                setCompareAsIsId(asIsId);
                setCompareToBeId(toBeId);
                setView("compare");
              }}
              typeFilter={SECTION_TYPE_FILTERS[activeSection]}
              libraries={libraries}
            />
          )}
            </div>
          </div>
        ) : view === "compare" && compareAsIsId && compareToBeId ? (
          <DiagramCompareView
            asIsId={compareAsIsId}
            toBeId={compareToBeId}
            onBack={() => {
              setView("catalogue");
              setCompareAsIsId(null);
              setCompareToBeId(null);
            }}
          />
        ) : activeDiagram ? (
          <Suspense fallback={<ModuleTabLoading label="Loading canvas…" className="flex-1" />}>
            <BpmCanvasEditor
              diagram={activeDiagram}
              onBack={handleBackToCatalogue}
              onSaveAsTemplate={handleSaveAsTemplate}
              onNavigateToDiagram={async (diagramId: number) => {
                try {
                  const diagram = await bpmFetchJson<BpmDiagram>(`/api/bpm/diagrams/${diagramId}`);
                  handleOpenDiagram(diagram);
                } catch {
                  toast({ title: "Could not open diagram", variant: "destructive" });
                }
              }}
            />
          </Suspense>
        ) : null}

      <FormDialogShell
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        title="Create New Diagram"
        subtitle="Choose a template or start from a blank canvas"
        saveLabel="Create"
        saveTestId="button-confirm-create-diagram"
        onCancel={() => setShowCreateDialog(false)}
        onSubmit={handleCreateDiagram}
        disabled={!newDiagramName.trim() || createMutation.isPending}
        saving={createMutation.isPending}
      >
          <div className="space-y-4 py-2">
            <div>
              <FieldLabel>Name</FieldLabel>
              <Input
                value={newDiagramName}
                onChange={(e) => setNewDiagramName(e.target.value)}
                placeholder="e.g., Purchase to Pay Process"
                data-testid="input-new-diagram-name"
              />
            </div>
            <div>
              <FieldLabel>Type</FieldLabel>
              <Select value={newDiagramType} onValueChange={setNewDiagramType}>
                <SelectTrigger data-testid="select-new-diagram-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAGRAM_TYPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.icon className="h-4 w-4" />
                        <span>{opt.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Library (optional)</FieldLabel>
              <Select value={newDiagramLibraryId} onValueChange={setNewDiagramLibraryId}>
                <SelectTrigger data-testid="select-new-diagram-library">
                  <SelectValue placeholder="No library (unassigned)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No library (unassigned)</SelectItem>
                  {libraries.map(lib => (
                    <SelectItem key={lib.id} value={String(lib.id)}>{lib.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Template</FieldLabel>
              <Tabs value={templateTab} onValueChange={(v) => { setTemplateTab(v); setSelectedTemplate(v === "builtin" ? "blank" : ""); }}>
                <TabsList className="w-full">
                  <TabsTrigger value="builtin" className="flex-1" data-testid="tab-builtin-templates">Built-in</TabsTrigger>
                  <TabsTrigger value="saved" className="flex-1" data-testid="tab-saved-templates">
                    Saved ({userTemplates.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="builtin" className="mt-2">
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger data-testid="select-template">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROCESS_TEMPLATES).map(([key, tpl]) => (
                        <SelectItem key={key} value={key}>
                          <span>{tpl.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplate !== "blank" && PROCESS_TEMPLATES[selectedTemplate] && (
                    <p className="text-xs text-muted-foreground mt-1">{PROCESS_TEMPLATES[selectedTemplate].description}</p>
                  )}
                </TabsContent>
                <TabsContent value="saved" className="mt-2">
                  {userTemplates.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-3 text-center">No saved templates yet. Use "Save as Template" in the editor to create one.</p>
                  ) : (
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger data-testid="select-user-template">
                        <SelectValue placeholder="Select a saved template" />
                      </SelectTrigger>
                      <SelectContent>
                        {userTemplates.map(tpl => (
                          <SelectItem key={tpl.id} value={`user_${tpl.id}`}>
                            <div className="flex items-center gap-2">
                              <Bookmark className="h-3.5 w-3.5 text-brand-purple" />
                              <span>{tpl.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TabsContent>
              </Tabs>
            </div>
            <div>
              <FieldLabel>Description (optional)</FieldLabel>
              <Textarea
                value={newDiagramDescription}
                onChange={(e) => setNewDiagramDescription(e.target.value)}
                placeholder="Brief description of this diagram"
                data-testid="input-new-diagram-description"
              />
            </div>
          </div>
      </FormDialogShell>

      <FormDialogShell
        open={showCreateLibraryDialog}
        onOpenChange={setShowCreateLibraryDialog}
        title="Create New Library"
        subtitle="Organize your templates into libraries"
        saveLabel="Create Library"
        saveTestId="button-confirm-create-library"
        onCancel={() => setShowCreateLibraryDialog(false)}
        onSubmit={handleCreateLibrary}
        disabled={!newLibraryName.trim() || createLibraryMutation.isPending}
        saving={createLibraryMutation.isPending}
      >
          <div className="space-y-4 py-2">
            <div>
              <FieldLabel>Name</FieldLabel>
              <Input
                value={newLibraryName}
                onChange={(e) => setNewLibraryName(e.target.value)}
                placeholder="e.g., SAP Best Practices"
                data-testid="input-library-name"
              />
            </div>
            <div>
              <FieldLabel>Description (optional)</FieldLabel>
              <Textarea
                value={newLibraryDescription}
                onChange={(e) => setNewLibraryDescription(e.target.value)}
                placeholder="Brief description of this library"
                data-testid="input-library-description"
              />
            </div>
            <div>
              <FieldLabel>Vendor (optional)</FieldLabel>
              <Select value={newLibraryVendor || "none"} onValueChange={setNewLibraryVendor}>
                <SelectTrigger data-testid="select-library-vendor">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {VENDOR_OPTIONS.map(v => (
                    <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Status</FieldLabel>
              <Select value={newLibraryStatus} onValueChange={setNewLibraryStatus}>
                <SelectTrigger data-testid="select-library-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>System Tag (optional)</FieldLabel>
              <Input
                value={newLibrarySystemTag}
                onChange={(e) => setNewLibrarySystemTag(e.target.value)}
                placeholder="e.g., sap-activate"
                data-testid="input-library-system-tag"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="library-template-flag"
                checked={newLibraryIsTemplate}
                onCheckedChange={(v) => setNewLibraryIsTemplate(!!v)}
                data-testid="checkbox-library-template"
              />
              <Label htmlFor="library-template-flag" className="text-sm font-normal cursor-pointer">
                Template library (reusable diagram templates)
              </Label>
            </div>
          </div>
      </FormDialogShell>

      <FormDialogShell
        open={showCreateTemplateDialog}
        onOpenChange={setShowCreateTemplateDialog}
        title="Create New Template"
        subtitle="Create an empty template that can be populated later from the editor"
        saveLabel="Create Template"
        saveTestId="button-confirm-create-template"
        onCancel={() => setShowCreateTemplateDialog(false)}
        onSubmit={handleCreateTemplate}
        disabled={!newTemplateName.trim() || !newTemplateLibraryId || createTemplateMutation.isPending}
        saving={createTemplateMutation.isPending}
      >
          <div className="space-y-4 py-2">
            <div>
              <FieldLabel>Template Name</FieldLabel>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Approval Workflow"
                data-testid="input-new-template-name"
              />
            </div>
            <div>
              <FieldLabel>Library (required)</FieldLabel>
              <Select value={newTemplateLibraryId || undefined} onValueChange={setNewTemplateLibraryId}>
                <SelectTrigger data-testid="select-new-template-library">
                  <SelectValue placeholder="Select a library" />
                </SelectTrigger>
                <SelectContent>
                  {libraries.map(lib => (
                    <SelectItem key={lib.id} value={String(lib.id)}>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-3.5 w-3.5" />
                        <span>{lib.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {libraries.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No libraries yet. Create a library first.</p>
              )}
            </div>
            <div>
              <FieldLabel>Process Type (optional)</FieldLabel>
              <Select value={newTemplateProcessType || "none"} onValueChange={setNewTemplateProcessType}>
                <SelectTrigger data-testid="select-new-template-process-type">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {PROCESS_TYPE_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Description (optional)</FieldLabel>
              <Textarea
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Brief description of this template"
                data-testid="input-new-template-description"
              />
            </div>
          </div>
      </FormDialogShell>

      <FormDialogShell
        open={showSaveTemplateDialog}
        onOpenChange={setShowSaveTemplateDialog}
        title="Save as Template"
        subtitle="Save your current diagram as a reusable template"
        saveLabel="Save Template"
        saveTestId="button-confirm-save-template"
        onCancel={() => setShowSaveTemplateDialog(false)}
        onSubmit={handleConfirmSaveTemplate}
        disabled={!saveTemplateName.trim() || !saveTemplateLibraryId || saveTemplateMutation.isPending}
        saving={saveTemplateMutation.isPending}
      >
          <div className="space-y-4 py-2">
            <div>
              <FieldLabel>Template Name</FieldLabel>
              <Input
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder="e.g., My Approval Workflow"
                data-testid="input-template-name"
              />
            </div>
            <div>
              <FieldLabel>Library (required)</FieldLabel>
              <Select value={saveTemplateLibraryId || undefined} onValueChange={setSaveTemplateLibraryId}>
                <SelectTrigger data-testid="select-save-template-library">
                  <SelectValue placeholder="Select a library" />
                </SelectTrigger>
                <SelectContent>
                  {libraries.map(lib => (
                    <SelectItem key={lib.id} value={String(lib.id)}>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-3.5 w-3.5" />
                        <span>{lib.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {libraries.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No libraries yet. Create a library first.</p>
              )}
            </div>
            <FieldGrid cols={2}>
              <div>
                <FieldLabel>Vendor</FieldLabel>
                <Select value={saveTemplateVendor || "none"} onValueChange={setSaveTemplateVendor}>
                  <SelectTrigger className="text-sm" data-testid="select-template-vendor">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {VENDOR_OPTIONS.map(v => (
                      <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel>Process Type</FieldLabel>
                <Select value={saveTemplateProcessType || "none"} onValueChange={setSaveTemplateProcessType}>
                  <SelectTrigger className="text-sm" data-testid="select-template-process-type">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {PROCESS_TYPE_OPTIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FieldGrid>
            <div>
              <FieldLabel>Description (optional)</FieldLabel>
              <Textarea
                value={saveTemplateDescription}
                onChange={(e) => setSaveTemplateDescription(e.target.value)}
                placeholder="Brief description of this template"
                data-testid="input-template-description"
              />
            </div>
          </div>
      </FormDialogShell>

      <FormDialogViewShell
        open={showManageTemplatesDialog}
        onOpenChange={setShowManageTemplatesDialog}
        onClose={() => setShowManageTemplatesDialog(false)}
        title="Manage Templates"
        subtitle="View and manage your BPM templates organized by library."
        size="md"
      >
          <div className="py-2">
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <Select value={manageFilterLibrary} onValueChange={setManageFilterLibrary}>
                <SelectTrigger className="w-[180px]" data-testid="select-manage-filter-library">
                  <SelectValue placeholder="All Libraries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Libraries</SelectItem>
                  <SelectItem value="system">System Templates</SelectItem>
                  {libraries.map(lib => (
                    <SelectItem key={lib.id} value={String(lib.id)}>{lib.name}</SelectItem>
                  ))}
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCreateLibraryDialog(true)}
                data-testid="button-create-library-from-manage"
              >
                <Plus className="h-4 w-4 mr-1" />
                New Library
              </Button>
            </div>

            {(manageFilterLibrary === "all" || manageFilterLibrary === "system") && (
              <div className="mb-3">
                <button
                  className="flex items-center gap-1.5 w-full text-left py-1.5 px-1 rounded hover-elevate"
                  onClick={() => toggleLibraryExpanded("system")}
                  data-testid="toggle-system-templates"
                >
                  {expandedLibraries.has("system") ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Library className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Built-in Templates</span>
                  <Badge variant="outline" className="ml-auto text-xs">System</Badge>
                </button>
                {expandedLibraries.has("system") && (
                  <div className="ml-6 space-y-1 mt-1">
                    {Object.entries(PROCESS_TEMPLATES).filter(([k]) => k !== "blank").map(([key, tpl]) => (
                      <div key={key} className="flex items-center justify-between gap-2 p-2 rounded hover-elevate">
                        <div className="flex items-center gap-2 min-w-0">
                          <LayoutTemplate className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{tpl.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>
                          </div>
                        </div>
                        <Badge className="text-xs shrink-0">System</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {manageFilterLibrary === "all" && <Separator className="my-3" />}

            {(() => {
              const groupsToShow = manageFilterLibrary === "all"
                ? templatesGroupedByLibrary
                : manageFilterLibrary === "system"
                  ? []
                  : manageFilterLibrary === "unassigned"
                    ? templatesGroupedByLibrary.filter(g => g.libraryId === null)
                    : templatesGroupedByLibrary.filter(g => g.libraryId === Number(manageFilterLibrary));

              if (groupsToShow.length === 0 && manageFilterLibrary !== "system" && manageFilterLibrary !== "all") {
                return (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No templates found for the selected filter.
                  </p>
                );
              }

              return groupsToShow.map(group => {
                const groupKey = group.libraryId !== null ? String(group.libraryId) : "unassigned";
                const isExpanded = expandedLibraries.has(groupKey);
                return (
                  <div key={groupKey} className="mb-3">
                    <button
                      className="flex items-center gap-1.5 w-full text-left py-1.5 px-1 rounded hover-elevate"
                      onClick={() => toggleLibraryExpanded(groupKey)}
                      data-testid={`toggle-library-${groupKey}`}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{group.libraryName}</span>
                      <span className="text-xs text-muted-foreground ml-auto">({group.templates.length})</span>
                    </button>
                    {isExpanded && (
                      <div className="ml-6 space-y-1 mt-1">
                        {group.templates.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2 pl-2">No templates in this library.</p>
                        ) : (
                          group.templates.map(tpl => (
                            <div key={tpl.id} className="flex items-center justify-between gap-2 p-2 rounded hover-elevate" data-testid={`template-item-${tpl.id}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <Bookmark className="h-4 w-4 text-brand-purple shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{tpl.name}</p>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {tpl.vendor && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{VENDOR_OPTIONS.find(v => v.value === tpl.vendor)?.label || tpl.vendor}</Badge>}
                                    {tpl.processType && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{PROCESS_TYPE_OPTIONS.find(p => p.value === tpl.processType)?.label || tpl.processType}</Badge>}
                                  </div>
                                  {tpl.description && <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>}
                                  <p className="text-xs text-muted-foreground">Created {new Date(tpl.createdAt).toLocaleDateString()}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <BpmTemplatePipeline
                                  templateId={tpl.id}
                                  templateName={tpl.name}
                                  tier={tpl.tier}
                                  isSystem={tpl.isSystem}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm("Delete this template?")) deleteTemplateMutation.mutate(tpl.id);
                                  }}
                                  data-testid={`button-delete-template-${tpl.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            {manageFilterLibrary === "all" && templatesGroupedByLibrary.length === 0 && userTemplates.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No saved templates. Open a diagram and use "Save as Template" to create one.
              </p>
            )}
          </div>
      </FormDialogViewShell>

      <FormDialogShell
        open={showCreateFrameworkDialog}
        onOpenChange={setShowCreateFrameworkDialog}
        title="Create New Framework"
        subtitle="Define a new methodology or lifecycle framework"
        saveLabel="Create"
        saveTestId="button-confirm-create-fw"
        onCancel={() => setShowCreateFrameworkDialog(false)}
        onSubmit={handleCreateFramework}
        disabled={!newFrameworkName.trim() || createFrameworkMutation.isPending}
        saving={createFrameworkMutation.isPending}
      >
          <div className="space-y-4 py-2">
            <div>
              <FieldLabel>Start from template</FieldLabel>
              <div className="flex gap-2 flex-wrap">
                <Button type="button" size="sm" variant={useTemplate === "blank" ? "default" : "outline"} onClick={() => { setUseTemplate("blank"); setNewFrameworkName(""); setNewFrameworkDescription(""); }} data-testid="button-template-blank">
                  Blank Framework
                </Button>
                <Button type="button" size="sm" variant={useTemplate === "sap_activate" ? "default" : "outline"} onClick={loadSapActivateTemplate} data-testid="button-template-sap-activate">
                  <LayoutTemplate className="h-4 w-4 mr-1" />
                  SAP Activate
                </Button>
                <Button type="button" size="sm" variant={useTemplate === "workday" ? "default" : "outline"} onClick={loadWorkdayTemplate} data-testid="button-template-workday">
                  <LayoutTemplate className="h-4 w-4 mr-1" />
                  Workday
                </Button>
              </div>
            </div>
            <div>
              <FieldLabel>Name</FieldLabel>
              <Input value={newFrameworkName} onChange={(e) => setNewFrameworkName(e.target.value)} placeholder="e.g., SAP Activate - Public Cloud" data-testid="input-new-fw-name" />
            </div>
            <div>
              <FieldLabel>Description</FieldLabel>
              <Textarea value={newFrameworkDescription} onChange={(e) => setNewFrameworkDescription(e.target.value)} placeholder="Brief description of this framework..." className="resize-none" rows={3} data-testid="textarea-new-fw-description" />
            </div>
            <div>
              <FieldLabel>Category</FieldLabel>
              <Select value={newFrameworkCategory} onValueChange={setNewFrameworkCategory}>
                <SelectTrigger data-testid="select-new-fw-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FRAMEWORK_CATEGORIES.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Vendor / Standard</FieldLabel>
              <Select value={newFrameworkVendor || "none"} onValueChange={setNewFrameworkVendor}>
                <SelectTrigger data-testid="select-new-fw-vendor"><SelectValue placeholder="Select vendor..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {VENDOR_OPTIONS.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
      </FormDialogShell>

      <FormDialogShell
        open={showImportCsvDialog}
        onOpenChange={setShowImportCsvDialog}
        title="Import Process from CSV"
        subtitle="Upload a CSV file to create a new diagram with process shapes, connections, and attributes"
        saveLabel="Import & Create"
        saveTestId="button-confirm-import-csv"
        onCancel={() => setShowImportCsvDialog(false)}
        onSubmit={handleImportCsvConfirm}
        disabled={!importCsvPreview || importCsvPreview.size === 0 || !importCsvDiagramName.trim() || createMutation.isPending}
        saving={createMutation.isPending}
      >
          <div className="space-y-4 py-2">
            <div>
              <FieldLabel>Diagram Name</FieldLabel>
              <Input
                value={importCsvDiagramName}
                onChange={(e) => setImportCsvDiagramName(e.target.value)}
                placeholder="Name for the imported diagram"
                data-testid="input-import-diagram-name"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => importCsvFileRef.current?.click()}
                data-testid="button-import-select-file"
              >
                <Upload className="h-4 w-4 mr-2" />
                {importCsvFileName || "Select CSV File"}
              </Button>
              <input
                ref={importCsvFileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImportCsvFileSelect}
                data-testid="input-import-csv-file"
              />
            </div>
            {importCsvPreview && importCsvPreview.size > 0 && (
              <div className="rounded-md border p-3 bg-muted/30">
                <p className="text-sm font-medium mb-1">Preview</p>
                {Array.from(importCsvPreview.entries()).map(([name, rows]) => (
                  <p key={name} className="text-xs text-muted-foreground">{name}: {rows.length} shapes</p>
                ))}
              </div>
            )}
            <div>
              <FieldLabel>Lane Orientation</FieldLabel>
              <Select value={importCsvOrientation} onValueChange={(v) => setImportCsvOrientation(v as "horizontal" | "vertical")}>
                <SelectTrigger data-testid="select-import-orientation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal">Horizontal (left to right)</SelectItem>
                  <SelectItem value="vertical">Vertical (top to bottom)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
      </FormDialogShell>
    </ModuleShell>
  );
}
