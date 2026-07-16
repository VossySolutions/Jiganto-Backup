import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useModuleTabUrl } from "@/hooks/use-module-tab-url";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ModuleShell } from "@/components/ModuleShell";
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
} from "@/components/ModulePageChrome";
import { DigitalSigningIcon } from "@/components/icons/ModuleIcons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { FormDialogShell, FormSection, FieldLabel } from "@/components/ui/form-dialog-shell";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  FileText, FileSpreadsheet, Presentation, Upload, Link2,
  CheckCircle2, ChevronRight, ChevronLeft, Plus, Trash2, Send, Download,
  Bell, Eye, ArrowLeft, Copy, X, User, AlertTriangle,
  BookOpen, MoreHorizontal, Search, GripVertical, LayoutTemplate,
  Ban, Image as ImageIcon,
} from "lucide-react";
import {
  SIGNOFF_STATUS,
  SIGNER_STATUS,
  SIGNER_LABEL,
  AUDIT_EVENT_LABEL,
  FILTER_TABS,
  type SignoffRequest,
  type SignoffTemplate,
  type ComposeSigner
} from "@/lib/signoff-constants";
import {
  EsignLoadingState, EsignKpiSkeleton, EsignTableSkeleton, EsignTemplateSkeleton,
  EsignDetailSkeleton, EsignErrorState, EsignButtonSpinner,
} from "@/components/esign/EsignLoadingState";
import { FieldPlacementEditor, type PlacedField } from "@/components/esign/FieldPlacementEditor";
import { MetricCard } from "@/components/ui/metric-card";
import "@/styles/esign.css";

type View = "dashboard" | "templates" | "compose" | "detail" | "audit";
type SrcType = "upload" | "jiganto_doc" | "inline_doc" | "template";
type JigantoDoc = { id: number; title: string; type: string; status: string };
type Project = { id: number; name: string };
type PmDeliverable = { id: number; name: string; type: string; status: string; projectId: number };
type TenantUser = { id: string; firstName: string | null; lastName: string | null; email: string | null };

const FILE_ICON: Record<string, JSX.Element> = {
  pdf: <FileText className="h-5 w-5 text-red-500" />,
  docx: <FileText className="h-5 w-5 text-blue-500" />,
  xlsx: <FileSpreadsheet className="h-5 w-5 text-green-600" />,
  pptx: <Presentation className="h-5 w-5 text-orange-500" />,
  png: <ImageIcon className="h-5 w-5 text-purple-500" />,
  jpg: <ImageIcon className="h-5 w-5 text-purple-500" />,
  jpeg: <ImageIcon className="h-5 w-5 text-purple-500" />,
};

const ACCEPT_UPLOAD = ".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg";
const MAX_FILE_MB = 25;

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}
function avatarColor(i: number) {
  const cols = ["bg-primary", "bg-blue-600", "bg-amber-600", "bg-purple-600", "bg-rose-600", "bg-teal-600"];
  return cols[i % cols.length];
}
function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    ", " + new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function defaultDeadlineDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}
function userDisplayName(u: TenantUser) {
  const n = [u.firstName, u.lastName].filter(Boolean).join(" ");
  return n || u.email || "Unknown";
}

function printAuditReport(r: SignoffRequest) {
  const statusText = SIGNOFF_STATUS[r.status]?.label || r.status;
  const signedCount = r.signers.filter(s => s.status === "signed").length;
  const signerRows = r.signers.map((s, i) => `
    <tr><td>${i + 1}</td><td><strong>${s.name}</strong><br/><span style="color:#6b7280;font-size:12px">${s.email}</span></td>
    <td>${SIGNER_LABEL[s.status] || s.status}</td><td>${s.signedAt ? fmtDateTime(s.signedAt) : s.declinedAt ? fmtDateTime(s.declinedAt) : "—"}</td>
    <td>${s.signatureName || "—"}</td></tr>`).join("");
  const auditRows = r.auditLog.length > 0
    ? r.auditLog.map(ev => `<tr><td style="white-space:nowrap">${fmtDateTime(ev.createdAt)}</td><td>${AUDIT_EVENT_LABEL[ev.event] || ev.event}</td>
      <td>${ev.actorName && ev.actorName !== "System" ? ev.actorName : "<em>System</em>"}</td><td>${ev.ipAddress || "—"}</td>
      <td>${(ev.metadata as Record<string, string>)?.signatureName || "—"}</td></tr>`).join("")
    : `<tr><td colspan="5" style="color:#6b7280;text-align:center;padding:20px">No activity recorded yet</td></tr>`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Audit Report – ${r.title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;color:#111;padding:40px}
.header{display:flex;justify-content:space-between;border-bottom:2px solid #e5e7eb;padding-bottom:20px;margin-bottom:28px}
.brand{font-size:18px;font-weight:700}h1{font-size:20px;font-weight:700;margin-bottom:4px}h2{font-size:13px;font-weight:600;text-transform:uppercase;color:#6b7280;margin:24px 0 10px}
table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;padding:8px 10px;background:#f3f4f6;font-size:11px;border-bottom:1px solid #e5e7eb}
td{padding:8px 10px;border-bottom:1px solid #f3f4f6}</style></head><body>
<div class="header"><div><div class="brand">Jiganto e-Sign</div><h1 style="margin-top:8px">${r.title}</h1></div>
<div style="font-size:11px;color:#6b7280;text-align:right">Audit Report<br/>Generated ${fmtDateTime(new Date().toISOString())}</div></div>
<h2>Document Summary</h2><p>Status: ${statusText} · Signers: ${signedCount} of ${r.signers.length} signed · Sent: ${fmtDate(r.sentAt)}</p>
<h2>Signers</h2><table><thead><tr><th>#</th><th>Name</th><th>Status</th><th>Date</th><th>Signature</th></tr></thead><tbody>${signerRows}</tbody></table>
<h2>Audit Trail</h2><table><thead><tr><th>Date</th><th>Event</th><th>Actor</th><th>IP</th><th>Signature</th></tr></thead><tbody>${auditRows}</tbody></table>
</body></html>`;
  const win = window.open("", "_blank", "width=960,height=720");
  if (!win) { alert("Please allow pop-ups to download the PDF report."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

const SIGNOFF_VIEWS = ["dashboard", "templates", "compose", "detail", "audit"] as const;

export default function SignOffPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const basePath = location.split("?")[0] || "/modules/e-sign";

  const [view, setView] = useModuleTabUrl(SIGNOFF_VIEWS, "dashboard");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("awaiting");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const [composeStep, setComposeStep] = useState(1);

  // Compose state
  const [srcType, setSrcType] = useState<SrcType>("upload");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [contentHtml, setContentHtml] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [deadline, setDeadline] = useState(defaultDeadlineDate());
  const [signingOrder, setSigningOrder] = useState<"sequential" | "parallel">("sequential");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [deliverableId, setDeliverableId] = useState<number | null>(null);
  const [crmContractId, setCrmContractId] = useState<number | null>(null);
  const [allowDecline, setAllowDecline] = useState(true);
  const [sendCopyOnCompletion, setSendCopyOnCompletion] = useState(true);
  const [requireAcknowledgement, setRequireAcknowledgement] = useState(false);
  const [acknowledgementText, setAcknowledgementText] = useState("I acknowledge that I have read and understood this document.");
  const [requireReadToBottom, setRequireReadToBottom] = useState(false);
  const [requireOtpVerification, setRequireOtpVerification] = useState(false);
  const [requireEidasConsent, setRequireEidasConsent] = useState(false);
  const [eidasConsentText, setEidasConsentText] = useState(
    "I consent to sign this document using a Simple Electronic Signature (SES) under eIDAS regulation.",
  );
  const [testCycleId, setTestCycleId] = useState<number | null>(null);
  const [signatureLevel, setSignatureLevel] = useState<"ses" | "ades">("ses");
  const [pendingUatTemplate, setPendingUatTemplate] = useState(false);
  const [signatureFields, setSignatureFields] = useState<PlacedField[]>([]);
  const [draftFields, setDraftFields] = useState<PlacedField[]>([]);
  const [signerList, setSignerList] = useState<ComposeSigner[]>([]);
  const [newSignerName, setNewSignerName] = useState("");
  const [newSignerEmail, setNewSignerEmail] = useState("");
  const [newSignerRole, setNewSignerRole] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialogs
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidTargetId, setVoidTargetId] = useState<number | null>(null);
  const [addSignerOpen, setAddSignerOpen] = useState(false);
  const [addSignerName, setAddSignerName] = useState("");
  const [addSignerEmail, setAddSignerEmail] = useState("");
  const [addSignerRole, setAddSignerRole] = useState("");
  const [addSignerMessage, setAddSignerMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deepRequestId = params.get("request");
    if (deepRequestId) {
      setSelectedId(Number(deepRequestId));
      params.delete("request");
      params.set("tab", "detail");
      setLocation(`${basePath}?${params.toString()}`);
      return;
    }

    const compose = params.get("compose");
    const jigantoDocId = params.get("jigantoDocId");
    const jigantoDocTitle = params.get("jigantoDocTitle");
    const deepProjectId = params.get("projectId");
    const deepDeliverableId = params.get("deliverableId");
    const deepDeliverableTitle = params.get("deliverableTitle");
    const deepCrmContractId = params.get("crmContractId");
    const deepCrmContractTitle = params.get("crmContractTitle");
    const deepTestCycleId = params.get("testCycleId");
    const deepTestCycleName = params.get("testCycleName");
    const deepTestPhase = params.get("testPhase");
    const uatPassRate = params.get("uatPassRate");
    const uatCompletion = params.get("uatCompletion");
    const uatPassed = params.get("uatPassed");
    const uatFailed = params.get("uatFailed");
    const uatTotal = params.get("uatTotal");

    if (compose !== "1") return;

    if (deepTestCycleId) {
      const cycleId = Number(deepTestCycleId);
      const cycleName = deepTestCycleName || `UAT Cycle ${cycleId}`;
      const phase = (deepTestPhase || "uat").toUpperCase();
      setTestCycleId(cycleId);
      setDocTitle(`${phase} Sign-Off — ${cycleName}`);
      setDescription(`Linked to Test Management cycle #${cycleId}`);
      setSrcType("template");
      setPendingUatTemplate(true);
      const metrics = [
        uatTotal ? `Total tests: ${uatTotal}` : null,
        uatPassed ? `Passed: ${uatPassed}` : null,
        uatFailed ? `Failed: ${uatFailed}` : null,
        uatCompletion ? `Completion: ${uatCompletion}%` : null,
        uatPassRate ? `Pass rate: ${uatPassRate}%` : null,
      ].filter(Boolean).join(" · ");
      setContentHtml(
        `<h1>${phase} Sign-Off Certificate</h1>
<h2>Test Cycle: ${cycleName}</h2>
${metrics ? `<p><strong>Results:</strong> ${metrics}</p>` : ""}
<p>All agreed ${phase} test scenarios have been executed. By signing below, the undersigned confirms acceptance for go-live.</p>`,
      );
    } else if (jigantoDocId) {
      setSrcType("jiganto_doc");
      setSelectedDocId(Number(jigantoDocId));
      setDocTitle(jigantoDocTitle || "");
    } else if (deepCrmContractId) {
      const contractId = Number(deepCrmContractId);
      setCrmContractId(contractId);
      setDocTitle(deepCrmContractTitle || "Contract Sign-off");
      fetchWithAuth(`/api/crm/contracts/${contractId}`)
        .then(r => (r.ok ? r.json() : null))
        .then((c: { name?: string; terms?: string; value?: string; type?: string; documentId?: number | null } | null) => {
          if (!c) {
            setContentHtml(`<h1>${deepCrmContractTitle || "Contract"}</h1><p>Please review and sign this contract.</p>`);
            setSrcType("inline_doc");
            return;
          }
          const title = c.name || deepCrmContractTitle || "Contract";
          setDocTitle(title);
          if (c.documentId) {
            setSrcType("jiganto_doc");
            setSelectedDocId(c.documentId);
            return;
          }
          const meta = [c.type, c.value ? `Value: ${c.value}` : null].filter(Boolean).join(" · ");
          setContentHtml(
            c.terms
              ? `<h1>${title}</h1>${meta ? `<p><em>${meta}</em></p>` : ""}<div>${c.terms}</div>`
              : `<h1>${title}</h1>${meta ? `<p>${meta}</p>` : ""}<p>Please review and sign this contract.</p>`,
          );
          setSrcType("inline_doc");
        })
        .catch(() => {
          setContentHtml(`<h1>${deepCrmContractTitle || "Contract"}</h1><p>Please review and sign this contract.</p>`);
          setSrcType("inline_doc");
        });
    } else if (deepDeliverableTitle) {
      setDocTitle(deepDeliverableTitle);
      if (!jigantoDocId) {
        setSrcType("inline_doc");
        setContentHtml(`<h1>${deepDeliverableTitle}</h1><p>Please review and sign this deliverable.</p>`);
      }
    }

    if (deepProjectId) setProjectId(Number(deepProjectId));
    if (deepDeliverableId) setDeliverableId(Number(deepDeliverableId));
    for (const key of [
      "compose", "jigantoDocId", "jigantoDocTitle", "projectId", "deliverableId", "deliverableTitle",
      "crmContractId", "crmContractTitle", "testCycleId", "testCycleName", "testPhase",
      "uatPassRate", "uatCompletion", "uatPassed", "uatFailed", "uatTotal",
    ]) {
      params.delete(key);
    }
    params.set("tab", "compose");
    setLocation(`${basePath}?${params.toString()}`);
  }, [basePath, setLocation]);

  const listUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter && statusFilter !== "all") p.set("status", statusFilter);
    if (search.trim()) p.set("search", search.trim());
    if (sort) p.set("sort", sort);
    const qs = p.toString();
    return qs ? `/api/signoff?${qs}` : "/api/signoff";
  }, [statusFilter, search, sort]);

  const { data: requests = [], isLoading: listLoading, isFetching: listFetching, isError: listError, refetch: refetchList } = useQuery<SignoffRequest[]>({ queryKey: [listUrl], staleTime: 30_000 });
  const { data: allRequests = [], isLoading: kpiLoading } = useQuery<SignoffRequest[]>({ queryKey: ["/api/signoff"], staleTime: 30_000 });
  const { data: templates = [], isLoading: templatesLoading, isError: templatesError, refetch: refetchTemplates } = useQuery<SignoffTemplate[]>({
    queryKey: ["/api/signoff/templates"],
    enabled: view === "templates" || view === "compose",
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!pendingUatTemplate || !templates.length) return;
    const uat = templates.find(t => t.title.includes("UAT Sign-Off"));
    if (uat) {
      setSelectedTemplateId(uat.id);
      setPendingUatTemplate(false);
    }
  }, [pendingUatTemplate, templates]);

  const { data: qtspStatus } = useQuery<{ adesAvailable: boolean }>({
    queryKey: ["/api/esign/qtsp-status"],
    enabled: view === "compose",
  });
  const { data: jigantoDocsRaw = [], isLoading: docsLoading } = useQuery<JigantoDoc[]>({
    queryKey: ["/api/signoff/jiganto-docs"],
    enabled: view === "compose" && srcType === "jiganto_doc",
  });
  const jigantoDocList = Array.isArray(jigantoDocsRaw) ? jigantoDocsRaw : [];
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/signoff/projects"],
    enabled: view === "compose",
  });
  const { data: projectDeliverables = [], isLoading: deliverablesLoading } = useQuery<PmDeliverable[]>({
    queryKey: [`/api/pm/projects/${projectId}/deliverables`],
    queryFn: () => fetchWithAuth(`/api/pm/projects/${projectId}/deliverables`).then(r => r.json()),
    staleTime: 30_000,
    enabled: view === "compose" && projectId !== null,
  });
  const { data: tenantUsers = [], isLoading: usersLoading } = useQuery<TenantUser[]>({
    queryKey: ["/api/signoff/users"],
    enabled: view === "compose" || addSignerOpen,
  });
  const { data: selectedRequest, isLoading: detailLoading, isError: detailError, refetch: refetchDetail } = useQuery<SignoffRequest>({
    queryKey: [`/api/signoff/${selectedId}`],
    enabled: selectedId !== null && (view === "detail" || view === "audit"),
  });

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/signoff"] });
    queryClient.invalidateQueries({ predicate: q => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/signoff?") });
  };

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", "/api/signoff", body).then(r => r.json()),
    onSuccess: () => invalidateList(),
  });
  const sendMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/signoff/${id}/send`, {}),
    onSuccess: (_, id) => { invalidateList(); queryClient.invalidateQueries({ queryKey: [`/api/signoff/${id}`] }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/signoff/${id}`),
    onSuccess: () => invalidateList(),
  });
  const remindMut = useMutation({
    mutationFn: ({ id, signerId }: { id: number; signerId?: number }) =>
      apiRequest("POST", `/api/signoff/${id}/remind`, signerId ? { signerId } : {}),
  });
  const duplicateMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/signoff/${id}/duplicate`, {}).then(r => r.json()),
    onSuccess: () => invalidateList(),
  });
  const voidMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiRequest("POST", `/api/signoff/${id}/void`, { reason }),
    onSuccess: (_, { id }) => { invalidateList(); queryClient.invalidateQueries({ queryKey: [`/api/signoff/${id}`] }); },
  });
  const addSignerMut = useMutation({
    mutationFn: (body: { requestId: number; name: string; email: string; roleTitle?: string; privateMessage?: string }) =>
      apiRequest("POST", `/api/signoff/${body.requestId}/signers`, {
        name: body.name, email: body.email, roleTitle: body.roleTitle || undefined,
        privateMessage: body.privateMessage || undefined, isInternal: false,
      }),
    onSuccess: (_, { requestId }) => {
      invalidateList();
      queryClient.invalidateQueries({ queryKey: [`/api/signoff/${requestId}`] });
    },
  });
  const removeSignerMut = useMutation({
    mutationFn: (signerId: number) => apiRequest("DELETE", `/api/signoff/signers/${signerId}`),
    onSuccess: () => {
      invalidateList();
      if (selectedId) queryClient.invalidateQueries({ queryKey: [`/api/signoff/${selectedId}`] });
    },
  });

  const saveTemplateMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/signoff/${id}/save-template`, {}).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signoff/templates"] });
      toast({ title: "Saved as template ✓" });
    },
  });

  const saveFieldsMut = useMutation({
    mutationFn: ({ id, fields }: { id: number; fields: PlacedField[] }) =>
      apiRequest("PUT", `/api/signoff/${id}/fields`, {
        fields: fields.map(f => ({
          signerEmail: f.signerEmail,
          fieldType: f.fieldType,
          pageNumber: f.pageNumber,
          xPercent: f.xPercent,
          yPercent: f.yPercent,
          widthPercent: f.widthPercent,
          heightPercent: f.heightPercent,
          isRequired: f.isRequired,
          label: f.label,
        })),
      }).then(r => r.json()),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/signoff/${id}`] });
      toast({ title: "Signature fields saved ✓" });
    },
    onError: (e: Error) => toast({ title: "Could not save fields", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (!selectedRequest?.signatureFields) {
      setDraftFields([]);
      return;
    }
    setDraftFields(selectedRequest.signatureFields.map(f => ({
      id: f.id,
      signerEmail: f.signerEmail,
      fieldType: f.fieldType as PlacedField["fieldType"],
      pageNumber: f.pageNumber,
      xPercent: Number(f.xPercent),
      yPercent: Number(f.yPercent),
      widthPercent: Number(f.widthPercent),
      heightPercent: Number(f.heightPercent),
      isRequired: f.isRequired,
      label: f.label ?? undefined,
    })));
  }, [selectedRequest?.id, selectedRequest?.signatureFields]);

  const total = allRequests.length;
  const awaiting = allRequests.filter(r => r.status === "pending" || r.status === "partially_signed").length;
  const completed = allRequests.filter(r => r.status === "completed").length;
  const drafts = allRequests.filter(r => r.status === "draft").length;
  const declined = allRequests.filter(r => r.status === "declined").length;
  const expired = allRequests.filter(r => r.status === "expired").length;

  function resetCompose() {
    setComposeStep(1); setSrcType("upload"); setUploadedFile(null);
    setSelectedDocId(null); setSelectedTemplateId(null); setContentHtml("");
    setDocTitle(""); setDescription(""); setMessage(""); setDeadline(defaultDeadlineDate());
    setSigningOrder("sequential"); setProjectId(null); setDeliverableId(null); setCrmContractId(null);
    setAllowDecline(true); setSendCopyOnCompletion(true);
    setRequireAcknowledgement(false); setAcknowledgementText("I acknowledge that I have read and understood this document.");
    setRequireReadToBottom(false);
    setRequireOtpVerification(false);
    setRequireEidasConsent(false);
    setEidasConsentText("I consent to sign this document using a Simple Electronic Signature (SES) under eIDAS regulation.");
    setSignatureFields([]);
    setTestCycleId(null);
    setSignatureLevel("ses");
    setPendingUatTemplate(false);
    setSignerList([]);
    setNewSignerName(""); setNewSignerEmail(""); setNewSignerRole(""); setUserSearch("");
  }

  function openCompose(fromTemplate?: SignoffTemplate) {
    resetCompose();
    if (fromTemplate) {
      setSrcType("template");
      setSelectedTemplateId(fromTemplate.id);
      setDocTitle(fromTemplate.title);
      setDescription(fromTemplate.description || "");
      setContentHtml(fromTemplate.contentHtml || "");
    }
    setView("compose");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["pdf", "docx", "xlsx", "pptx", "png", "jpg", "jpeg"].includes(ext)) {
      toast({ title: "Unsupported file type", description: "Please upload PDF, Office, or image files.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast({ title: "File too large", description: `Maximum file size is ${MAX_FILE_MB} MB.`, variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const base64 = (ev.target?.result as string).split(",")[1];
      setUploadedFile({ name: file.name, type: ext === "jpeg" ? "jpg" : ext, data: base64 });
      if (!docTitle) setDocTitle(file.name.replace(/\.[^.]+$/, ""));
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputRef.current.files = dt.files;
      handleFileChange({ target: fileInputRef.current } as React.ChangeEvent<HTMLInputElement>);
    }
  }

  function addSignerManual() {
    if (!newSignerName.trim() || !newSignerEmail.trim()) {
      toast({ title: "Name and email required", variant: "destructive" }); return;
    }
    setSignerList(prev => [...prev, {
      name: newSignerName.trim(), email: newSignerEmail.trim(),
      roleTitle: newSignerRole.trim() || undefined, isInternal: false,
    }]);
    setNewSignerName(""); setNewSignerEmail(""); setNewSignerRole("");
  }

  function addSignerFromUser(u: TenantUser) {
    const name = userDisplayName(u);
    const email = u.email || "";
    if (!email) return;
    if (signerList.some(s => s.email.toLowerCase() === email.toLowerCase())) {
      toast({ title: "Signer already added", variant: "destructive" }); return;
    }
    setSignerList(prev => [...prev, { name, email, isInternal: true, userId: u.id }]);
    setUserSearch("");
  }

  function addMyself() {
    if (!user?.email) { toast({ title: "Your profile has no email", variant: "destructive" }); return; }
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    if (signerList.some(s => s.email.toLowerCase() === user.email!.toLowerCase())) {
      toast({ title: "You are already in the signer list", variant: "destructive" }); return;
    }
    setSignerList(prev => [...prev, { name, email: user.email!, isInternal: true, userId: user.id }]);
  }

  function onSignerDragEnd(result: DropResult) {
    if (!result.destination) return;
    const items = Array.from(signerList);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setSignerList(items);
  }

  function buildCreateBody(): Record<string, unknown> {
    const resolvedSourceType = testCycleId ? "test_cycle" : crmContractId ? "crm_contract" : srcType;
    return {
      title: docTitle || "Untitled Sign-Off",
      description: description || null,
      sourceType: resolvedSourceType,
      sourceDocumentId: srcType === "jiganto_doc" ? selectedDocId : null,
      templateId: srcType === "template" ? selectedTemplateId : null,
      projectId: projectId || null,
      deliverableId: deliverableId || null,
      crmContractId: crmContractId || null,
      testCycleId: testCycleId || null,
      fileName: uploadedFile?.name || null,
      fileType: uploadedFile?.type || null,
      fileData: uploadedFile?.data || null,
      contentHtml: resolvedSourceType === "inline_doc" || resolvedSourceType === "template" || resolvedSourceType === "crm_contract" ? contentHtml : null,
      message: message || null,
      signingOrder,
      deadline: deadline || defaultDeadlineDate(),
      allowDecline,
      sendCopyOnCompletion,
      requireAcknowledgement,
      acknowledgementText: requireAcknowledgement ? acknowledgementText : null,
      requireReadToBottom,
      requireOtpVerification,
      requireEidasConsent,
      eidasConsentText: requireEidasConsent ? eidasConsentText : null,
      signatureLevel,
      signatureFields: signatureFields.map(f => ({
        signerEmail: f.signerEmail,
        fieldType: f.fieldType,
        pageNumber: f.pageNumber,
        xPercent: f.xPercent,
        yPercent: f.yPercent,
        widthPercent: f.widthPercent,
        heightPercent: f.heightPercent,
        isRequired: f.isRequired,
        label: f.label,
      })),
      signers: signerList.map((s, i) => ({ ...s, signerOrder: i + 1 })),
    };
  }

  async function handleSendOrSave(asDraft: boolean) {
    try {
      const result = await createMut.mutateAsync(buildCreateBody()) as SignoffRequest;
      if (!asDraft && result?.id) {
        await sendMut.mutateAsync(result.id);
        toast({ title: "Sign-off request sent ✓", description: `Sent to ${signerList.length} signer${signerList.length !== 1 ? "s" : ""}` });
      } else {
        toast({ title: "Saved as draft" });
      }
      setView("dashboard");
      resetCompose();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function handleDuplicate(id: number) {
    try {
      const copy = await duplicateMut.mutateAsync(id) as SignoffRequest;
      toast({ title: "Duplicated ✓" });
      if (copy?.id) openDetail(copy.id);
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function handleVoid() {
    if (!voidTargetId) return;
    try {
      await voidMut.mutateAsync({ id: voidTargetId, reason: voidReason.trim() || "Voided by sender" });
      toast({ title: "Document voided" });
      setVoidDialogOpen(false);
      setVoidReason("");
      setVoidTargetId(null);
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this sign-off request? This cannot be undone.")) return;
    await deleteMut.mutateAsync(id);
    if (view !== "dashboard") setView("dashboard");
    toast({ title: "Deleted" });
  }

  async function handleRemind(id: number, signerId?: number) {
    try {
      await remindMut.mutateAsync({ id, signerId });
      toast({ title: "Reminder sent ✓" });
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function handleAddSignerSubmit() {
    if (!selectedId || !addSignerName.trim() || !addSignerEmail.trim()) {
      toast({ title: "Name and email required", variant: "destructive" }); return;
    }
    try {
      await addSignerMut.mutateAsync({
        requestId: selectedId, name: addSignerName.trim(), email: addSignerEmail.trim(),
        roleTitle: addSignerRole.trim() || undefined, privateMessage: addSignerMessage.trim() || undefined,
      });
      toast({ title: "Signer added ✓" });
      setAddSignerOpen(false);
      setAddSignerName(""); setAddSignerEmail(""); setAddSignerRole(""); setAddSignerMessage("");
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  }

  function openDetail(id: number) { setSelectedId(id); setView("detail"); }
  function openAudit(id: number) { setSelectedId(id); setView("audit"); }

  const canProceed1 = srcType === "upload" ? !!uploadedFile
    : srcType === "jiganto_doc" ? !!selectedDocId
    : srcType === "inline_doc" ? contentHtml.trim().length > 0
    : !!selectedTemplateId;
  const canProceed2 = signerList.length > 0;
  const canProceed3 = !!deadline;

  const filteredUsers = tenantUsers.filter(u => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    const name = userDisplayName(u).toLowerCase();
    return name.includes(q) || (u.email?.toLowerCase().includes(q) ?? false);
  });

  const shell = (children: React.ReactNode) => (
    <ModuleShell className={cn("esign-page", modulePageShellClass)} mainClassName={modulePageMainClass}>
      {children}
    </ModuleShell>
  );

  // ── DETAIL / AUDIT ────────────────────────────────────────────────────────
  if (view === "detail" || view === "audit") {
    const r = selectedRequest;
    const signedCount = r?.signers.filter(s => s.status === "signed").length ?? 0;
    const canAddSigner = r && ["pending", "partially_signed"].includes(r.status);
    const canRemind = r && ["pending", "partially_signed"].includes(r.status);
    const canVoid = r && ["pending", "partially_signed", "draft"].includes(r.status);
    const canDownload = r && (r.status === "completed" || r.status === "partially_signed");

    return shell(
      <>
        <div className="bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button onClick={() => setView("dashboard")} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm shrink-0">
              <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back</span>
            </button>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold text-sm truncate max-w-[300px]">{r?.title || "Loading…"}</span>
          </div>
          <div className="esign-detail-actions flex gap-2 flex-wrap justify-end max-w-[55%] sm:max-w-none overflow-x-auto">
            {view === "detail" && r && (
              <>
                <button onClick={() => openAudit(r.id)} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> Audit Trail
                </button>
                <button onClick={() => saveTemplateMut.mutate(r.id)} disabled={saveTemplateMut.isPending}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted flex items-center gap-1.5 disabled:opacity-50">
                  {saveTemplateMut.isPending ? <EsignButtonSpinner /> : <LayoutTemplate className="h-3.5 w-3.5" />}
                  Save as Template
                </button>
                {canRemind && (
                  <button onClick={() => handleRemind(r.id)} disabled={remindMut.isPending}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted flex items-center gap-1.5 disabled:opacity-50">
                    {remindMut.isPending && remindMut.variables?.id === r.id && !remindMut.variables?.signerId
                      ? <EsignButtonSpinner /> : <Bell className="h-3.5 w-3.5" />}
                    Remind
                  </button>
                )}
                {canDownload && (
                  <a href={`/api/signoff/${r.id}/signed-pdf`} target="_blank" rel="noreferrer"
                    className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted flex items-center gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Signed PDF
                  </a>
                )}
                <button onClick={() => handleDuplicate(r.id)} disabled={duplicateMut.isPending}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted flex items-center gap-1.5 disabled:opacity-50">
                  {duplicateMut.isPending && duplicateMut.variables === r.id ? <EsignButtonSpinner /> : <Copy className="h-3.5 w-3.5" />}
                  Duplicate
                </button>
                {canVoid && (
                  <button onClick={() => { setVoidTargetId(r.id); setVoidDialogOpen(true); }}
                    className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-1.5">
                    <Ban className="h-3.5 w-3.5" /> Void
                  </button>
                )}
                {r.status === "draft" && (
                  <button onClick={() => sendMut.mutateAsync(r.id).then(() => toast({ title: "Sent ✓" }))}
                    disabled={sendMut.isPending}
                    className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-50">
                    {sendMut.isPending && sendMut.variables === r.id ? <EsignButtonSpinner /> : <Send className="h-3.5 w-3.5" />}
                    Send Now
                  </button>
                )}
              </>
            )}
            {view === "audit" && r && (
              <button onClick={() => setView("detail")} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted">
                ← Document Detail
              </button>
            )}
          </div>
        </div>

        {detailLoading && <EsignDetailSkeleton />}
        {detailError && !detailLoading && (
          <EsignErrorState message="Could not load this sign-off request." onRetry={() => refetchDetail()} />
        )}

        {!detailLoading && !detailError && r && view === "detail" && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {/* Status banner */}
            <div className={cn("rounded-xl border px-5 py-4 mb-6 flex items-center justify-between gap-4",
              SIGNOFF_STATUS[r.status]?.color || "bg-muted border-border")}>
              <div>
                <div className="font-semibold">{SIGNOFF_STATUS[r.status]?.label || r.status}</div>
                <div className="text-sm opacity-80 mt-0.5">
                  {signedCount} of {r.signers.length} signed
                  {r.signingOrder === "sequential" ? " · Sequential signing" : " · Parallel signing"}
                </div>
              </div>
              <div className="flex -space-x-2">
                {r.signers.map((s, i) => (
                  <div key={s.id} title={`${s.name} — ${SIGNER_LABEL[s.status] || s.status}`}
                    className={cn("w-9 h-9 rounded-full border-2 border-background flex items-center justify-center text-xs font-bold text-white",
                      s.status === "signed" ? "bg-green-600" : s.status === "declined" ? "bg-red-500" : avatarColor(i))}>
                    {getInitials(s.name)}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
              <div>
                <h1 className="text-2xl font-bold mb-1">{r.title}</h1>
                <p className="text-muted-foreground text-sm mb-4">
                  Sent by {r.createdByName} · {fmtDate(r.sentAt || r.createdAt)}
                  {r.project && <> · Project: {r.project.name}</>}
                  {r.deliverable && <> · Deliverable: {r.deliverable.name}</>}
                </p>

                {r.sourceType === "upload" && r.fileType === "pdf" ? (
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow">
                    <div className="bg-muted px-4 py-2.5 flex items-center justify-between text-sm border-b border-border">
                      <span className="flex items-center gap-2">{FILE_ICON[r.fileType || ""] || <FileText className="h-4 w-4" />} {r.fileName}</span>
                      <a href={`/api/signoff/${r.id}/file`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                    </div>
                    <iframe src={`/api/signoff/${r.id}/file`} className="w-full esign-doc-preview" title="Document preview" />
                  </div>
                ) : r.sourceType === "upload" ? (
                  <div className="bg-card border border-border rounded-xl p-8 text-center">
                    <div className="flex justify-center mb-4">{FILE_ICON[r.fileType || ""] || <FileText className="h-12 w-12 text-muted-foreground" />}</div>
                    <h3 className="font-semibold text-lg mb-2">{r.fileName}</h3>
                    <a href={`/api/signoff/${r.id}/file`} download className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                      <Download className="h-4 w-4" /> Download
                    </a>
                  </div>
                ) : r.sourceDocument ? (
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow">
                    <div className="bg-muted px-4 py-2.5 border-b border-border text-sm font-medium flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" /> Jiganto Document: {r.sourceDocument.title}
                    </div>
                    <div className="p-8 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: r.sourceDocument.content || "<p>No content</p>" }} />
                  </div>
                ) : r.contentHtml ? (
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow">
                    <div className="p-8 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: r.contentHtml }} />
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">Document not available</div>
                )}

                {r.message && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                    <span className="font-medium">Message from sender:</span> {r.message}
                  </div>
                )}

                {r.status === "draft" && r.fileType === "pdf" && (
                  <div className="mt-6 bg-muted/30 border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="text-sm font-medium">Signature field placement</div>
                      <button
                        onClick={() => saveFieldsMut.mutate({ id: r.id, fields: draftFields })}
                        disabled={saveFieldsMut.isPending}
                        className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {saveFieldsMut.isPending && <EsignButtonSpinner />}
                        Save fields
                      </button>
                    </div>
                    <FieldPlacementEditor
                      signers={r.signers.map(s => ({
                        name: s.name,
                        email: s.email,
                        roleTitle: s.roleTitle ?? undefined,
                        isInternal: s.isInternal ?? false,
                      }))}
                      fields={draftFields}
                      onChange={setDraftFields}
                      pdfPreviewUrl={`/api/signoff/${r.id}/file`}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Signers</div>
                    {canAddSigner && (
                      <button onClick={() => setAddSignerOpen(true)} data-testid="btn-add-signer"
                        className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                        <Plus className="h-3.5 w-3.5" /> Add Signer
                      </button>
                    )}
                  </div>
                  <div className="relative pl-6">
                    <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                    {[...r.signers].sort((a, b) => a.signerOrder - b.signerOrder).map(s => (
                      <div key={s.id} className="relative mb-5 last:mb-0">
                        <div className={cn("absolute -left-[18px] top-1 w-3.5 h-3.5 rounded-full border-2 border-background",
                          s.status === "signed" ? "bg-green-500" : s.status === "declined" ? "bg-red-500" : s.status === "viewed" ? "bg-blue-500" : "bg-amber-400")} />
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium">{s.name}</div>
                            <div className="text-xs text-muted-foreground">{s.email}</div>
                            {s.roleTitle && <div className="text-xs text-muted-foreground">{s.roleTitle}</div>}
                            {s.signedAt && <div className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(s.signedAt)}</div>}
                            {s.declineReason && <div className="text-xs text-red-600 mt-0.5 italic">&quot;{s.declineReason}&quot;</div>}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", SIGNER_STATUS[s.status])}>
                              {SIGNER_LABEL[s.status] || s.status}
                            </span>
                            {canRemind && s.status !== "signed" && s.status !== "declined" && (
                              <button onClick={() => handleRemind(r.id, s.id)} disabled={remindMut.isPending}
                                className="text-xs text-primary hover:underline disabled:opacity-50 inline-flex items-center gap-1">
                                {remindMut.isPending && remindMut.variables?.signerId === s.id ? <EsignButtonSpinner /> : null}
                                Remind
                              </button>
                            )}
                            {["draft", "pending", "partially_signed"].includes(r.status) && s.status !== "signed" && s.status !== "declined" && (
                              <button
                                onClick={() => removeSignerMut.mutateAsync(s.id).then(() => toast({ title: "Signer removed" })).catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }))}
                                disabled={removeSignerMut.isPending}
                                className="text-xs text-red-600 hover:underline disabled:opacity-50">
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-5 text-sm space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Document Info</div>
                  <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground">Sent</span><span className="font-medium">{fmtDate(r.sentAt)}</span></div>
                  <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground">Expiry</span><span className="font-medium">{fmtDate(r.deadline)}</span></div>
                  <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground">Signers</span><span className="font-medium">{r.signers.length}</span></div>
                  {r.timesheetPeriodId && (
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Timesheet</span>
                      <span className="font-medium">Period #{r.timesheetPeriodId}</span>
                    </div>
                  )}
                  {r.testCycleId && (
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Test cycle</span>
                      <span className="font-medium">#{r.testCycleId}</span>
                    </div>
                  )}
                  {r.signatureLevel && r.signatureLevel !== "ses" && (
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Signature level</span>
                      <span className="font-medium uppercase">{r.signatureLevel}</span>
                    </div>
                  )}
                  {r.crmContractId && (
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">CRM Contract</span>
                      <a href={`/modules/crm?contract=${r.crmContractId}`} className="font-medium text-primary hover:underline">#{r.crmContractId}</a>
                    </div>
                  )}
                  {r.deliverable && (
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Deliverable</span>
                      <span className="font-medium truncate max-w-[160px]">{r.deliverable.name}</span>
                    </div>
                  )}
                  {r.completedAt && <div className="flex justify-between py-2"><span className="text-muted-foreground">Completed</span><span className="font-medium text-green-700">{fmtDate(r.completedAt)}</span></div>}
                  {r.voidReason && <div className="pt-2 text-red-600 text-xs">Void reason: {r.voidReason}</div>}
                </div>

                <button onClick={() => openAudit(r.id)} className="w-full py-2.5 text-sm border border-border rounded-xl hover:bg-muted flex items-center justify-center gap-2">
                  <BookOpen className="h-4 w-4" /> View Full Audit Trail
                </button>
                {(r.status === "draft" || r.status === "pending") && (
                  <button onClick={() => handleDelete(r.id)} disabled={deleteMut.isPending}
                    className="w-full py-2.5 text-sm border border-red-200 text-red-600 rounded-xl hover:bg-red-50 flex items-center justify-center gap-2 disabled:opacity-50">
                    {deleteMut.isPending && deleteMut.variables === r.id ? <EsignButtonSpinner /> : <Trash2 className="h-4 w-4" />}
                    Delete Request
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {!detailLoading && !detailError && r && view === "audit" && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">Audit Trail</h1>
              <p className="text-muted-foreground text-sm mb-6">{r.title} · Created {fmtDate(r.createdAt)}</p>
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="relative pl-8">
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                  {r.auditLog.map(ev => (
                    <div key={ev.id} className="relative mb-6 last:mb-0">
                      <div className={cn("absolute -left-[22px] top-1.5 w-3 h-3 rounded-full border-2 border-background",
                        ev.event === "completed" ? "bg-green-500" : ev.event === "declined" ? "bg-red-500" : "bg-primary")} />
                      <div className="text-sm font-medium">{AUDIT_EVENT_LABEL[ev.event] || ev.event}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {fmtDateTime(ev.createdAt)}
                        {ev.actorName && ev.actorName !== "System" && ` · ${ev.actorName}`}
                        {ev.ipAddress && ` · IP ${ev.ipAddress}`}
                      </div>
                    </div>
                  ))}
                  {r.auditLog.length === 0 && <p className="text-muted-foreground text-sm">No activity yet</p>}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-5 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Summary</div>
                <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground">Status</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", SIGNOFF_STATUS[r.status]?.color)}>{SIGNOFF_STATUS[r.status]?.label}</span>
                </div>
                <div className="flex justify-between py-2"><span className="text-muted-foreground">Signed</span><span className="font-medium">{signedCount} / {r.signers.length}</span></div>
              </div>
              <a href={`/api/signoff/${r.id}/audit-pdf`} target="_blank" rel="noreferrer"
                className="w-full py-2.5 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 flex items-center justify-center gap-2">
                <Download className="h-4 w-4" /> Download Audit PDF
              </a>
              <button onClick={() => printAuditReport(r)} className="w-full py-2.5 text-sm border border-border rounded-xl hover:bg-muted flex items-center justify-center gap-2">
                <Download className="h-4 w-4" /> Print Report
              </button>
            </div>
          </div>
        )}

        <FormDialogShell
          open={addSignerOpen}
          onOpenChange={setAddSignerOpen}
          title="Add Signer"
          saveLabel={addSignerMut.isPending ? "Adding..." : "Add Signer"}
          onCancel={() => setAddSignerOpen(false)}
          onSubmit={handleAddSignerSubmit}
          saving={addSignerMut.isPending}
          disabled={!addSignerName.trim() || !addSignerEmail.trim()}
        >
          <FormSection icon={<User className="h-4 w-4" />} title="Signer details">
            <div className="space-y-1.5 mb-3.5">
              <FieldLabel required>Full name</FieldLabel>
              <input value={addSignerName} onChange={e => setAddSignerName(e.target.value)} placeholder="Full name"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div className="space-y-1.5 mb-3.5">
              <FieldLabel required>Email</FieldLabel>
              <input value={addSignerEmail} onChange={e => setAddSignerEmail(e.target.value)} placeholder="Email" type="email"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div className="space-y-1.5 mb-3.5">
              <FieldLabel>Role / title (optional)</FieldLabel>
              <input value={addSignerRole} onChange={e => setAddSignerRole(e.target.value)} placeholder="Role / title (optional)"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Private message (optional)</FieldLabel>
              <textarea value={addSignerMessage} onChange={e => setAddSignerMessage(e.target.value)} placeholder="Private message (optional)" rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none" />
            </div>
          </FormSection>
        </FormDialogShell>

        <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Void Document</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This will cancel the sign-off request. Signers will no longer be able to sign.</p>
            <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Reason for voiding (optional)" rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none" />
            <DialogFooter>
              <button onClick={() => setVoidDialogOpen(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
              <button onClick={handleVoid} disabled={voidMut.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                {voidMut.isPending ? <><EsignButtonSpinner /> Voiding…</> : "Void Document"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ── COMPOSE ─────────────────────────────────────────────────────────────────
  if (view === "compose") {
    const stepLabels = ["Document", "Signers", "Settings", "Review & Send"];
    return shell(
      <>
        <div className="bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="font-bold text-base sm:text-lg flex items-center gap-2">
            Jiganto <span className="text-[10px] sm:text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full uppercase tracking-wide">e-Sign</span>
          </div>
          <button onClick={() => { setView("dashboard"); resetCompose(); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" /> <span className="hidden sm:inline">Cancel</span>
          </button>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <h1 className="text-xl sm:text-2xl font-bold mb-2">New e-Sign Request</h1>
          <p className="text-muted-foreground text-sm mb-6 sm:mb-8">Choose a document source, add signers, configure settings, and send</p>

          <div className="esign-compose-steps flex mb-8 sm:mb-10 rounded-xl overflow-hidden border border-border">
            {stepLabels.map((label, i) => {
              const step = i + 1;
              const done = step < composeStep;
              const active = step === composeStep;
              return (
                <div key={step} className={cn("flex-1 flex items-center gap-2.5 px-4 py-3 text-sm font-medium border-r last:border-r-0 border-border transition-colors",
                  done ? "bg-primary/10 text-primary" : active ? "bg-primary/5 text-primary" : "bg-card text-muted-foreground")}>
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    done || active ? "bg-primary text-primary-foreground" : "bg-border text-muted-foreground")}>
                    {done ? "✓" : step}
                  </div>
                  <span className="hidden sm:block">{label}</span>
                </div>
              );
            })}
          </div>

          {/* Step 1 */}
          {composeStep === 1 && (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2 p-1 bg-muted rounded-lg w-fit">
                {([
                  { key: "upload" as SrcType, label: "Upload", icon: Upload },
                  { key: "jiganto_doc" as SrcType, label: "Jiganto Doc", icon: Link2 },
                  { key: "inline_doc" as SrcType, label: "Create Inline", icon: FileText },
                  { key: "template" as SrcType, label: "Template", icon: LayoutTemplate },
                ]).map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setSrcType(key)}
                    className={cn("px-3 py-2 text-sm rounded-md font-medium transition-colors flex items-center gap-1.5",
                      srcType === key ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>

              {srcType === "upload" && (
                !uploadedFile ? (
                  <div className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/5"); }}
                    onDragLeave={e => e.currentTarget.classList.remove("border-primary", "bg-primary/5")}
                    onDrop={handleDrop}>
                    <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="font-semibold mb-1">Drop your document here</h3>
                    <p className="text-muted-foreground text-sm mb-4">PDF, Word, Excel, PowerPoint, PNG, JPG · Max {MAX_FILE_MB} MB</p>
                    <button type="button" className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Browse files</button>
                    <input ref={fileInputRef} type="file" accept={ACCEPT_UPLOAD} className="hidden" onChange={handleFileChange} />
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-4">
                    <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">{FILE_ICON[uploadedFile.type] || <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-green-800">{uploadedFile.name}</div>
                      <div className="text-sm text-green-600">{uploadedFile.type.toUpperCase()} · Ready</div>
                    </div>
                    <button onClick={() => setUploadedFile(null)} className="text-green-600 hover:text-green-800"><X className="h-5 w-5" /></button>
                  </div>
                )
              )}

              {srcType === "jiganto_doc" && (
                docsLoading ? (
                  <EsignLoadingState label="Loading documents…" size="sm" />
                ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  {jigantoDocList.length === 0
                    ? <div className="p-8 text-center text-muted-foreground text-sm">No documents found</div>
                    : jigantoDocList.map(doc => (
                      <div key={doc.id} onClick={() => { setSelectedDocId(doc.id); setDocTitle(doc.title); }}
                        className={cn("flex items-center gap-3 px-4 py-3 border-b last:border-b-0 border-border cursor-pointer hover:bg-muted",
                          selectedDocId === doc.id && "bg-primary/5 border-l-2 border-l-primary")}>
                        <Link2 className={cn("h-4 w-4 shrink-0", selectedDocId === doc.id ? "text-primary" : "text-muted-foreground")} />
                        <div className="flex-1 min-w-0">
                          <div className={cn("font-medium text-sm truncate", selectedDocId === doc.id && "text-primary")}>{doc.title}</div>
                          <div className="text-xs text-muted-foreground capitalize">{doc.type} · {doc.status}</div>
                        </div>
                        {selectedDocId === doc.id && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                      </div>
                    ))}
                </div>
                )
              )}

              {srcType === "inline_doc" && (
                <textarea value={contentHtml} onChange={e => setContentHtml(e.target.value)} rows={12}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Enter document content (HTML supported)…" />
              )}

              {srcType === "template" && (
                templatesLoading ? (
                  <EsignLoadingState label="Loading templates…" size="sm" />
                ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  {templates.length === 0
                    ? <div className="p-8 text-center text-muted-foreground text-sm">No templates available</div>
                    : templates.map(tpl => (
                      <div key={tpl.id} onClick={() => {
                        setSelectedTemplateId(tpl.id); setDocTitle(tpl.title);
                        setDescription(tpl.description || ""); setContentHtml(tpl.contentHtml || "");
                      }}
                        className={cn("flex items-center gap-3 px-4 py-3 border-b last:border-b-0 border-border cursor-pointer hover:bg-muted",
                          selectedTemplateId === tpl.id && "bg-primary/5 border-l-2 border-l-primary")}>
                        <LayoutTemplate className={cn("h-4 w-4 shrink-0", selectedTemplateId === tpl.id ? "text-primary" : "text-muted-foreground")} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{tpl.title}</div>
                          {tpl.description && <div className="text-xs text-muted-foreground truncate">{tpl.description}</div>}
                          {tpl.category && <div className="text-xs text-muted-foreground">{tpl.category}</div>}
                        </div>
                        {selectedTemplateId === tpl.id && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                      </div>
                    ))}
                </div>
                )
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5">Document title *</label>
                <input value={docTitle} onChange={e => setDocTitle(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. Project Alpha — Scope of Work v2.1" />
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => { setView("dashboard"); resetCompose(); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Cancel</button>
                <button onClick={() => setComposeStep(2)} disabled={!canProceed1 || !docTitle.trim()}
                  className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 flex items-center gap-2">
                  Next: Signers <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {composeStep === 2 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Add signers and set signing order</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className={signingOrder === "sequential" ? "font-medium" : "text-muted-foreground"}>Sequential</span>
                  <Switch checked={signingOrder === "parallel"} onCheckedChange={v => setSigningOrder(v ? "parallel" : "sequential")} />
                  <span className={signingOrder === "parallel" ? "font-medium" : "text-muted-foreground"}>Parallel</span>
                </div>
              </div>

              <DragDropContext onDragEnd={onSignerDragEnd}>
                <Droppable droppableId="signers">
                  {provided => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                      {signerList.map((s, i) => (
                        <Draggable key={`${s.email}-${i}`} draggableId={`signer-${i}`} index={i}>
                          {(drag, snapshot) => (
                            <div ref={drag.innerRef} {...drag.draggableProps}
                              className={cn("flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3",
                                snapshot.isDragging && "shadow-lg ring-2 ring-primary/20")}>
                              <div {...drag.dragHandleProps} className="cursor-grab text-muted-foreground"><GripVertical className="h-4 w-4" /></div>
                              <div className="w-6 h-6 rounded-full bg-border flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">{i + 1}</div>
                              <div className={cn("w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0", avatarColor(i))}>{getInitials(s.name)}</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{s.name}</div>
                                <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                                {s.roleTitle && <div className="text-xs text-muted-foreground">{s.roleTitle}</div>}
                                {s.signingDeadline && <div className="text-xs text-muted-foreground">Deadline: {fmtDate(s.signingDeadline)}</div>}
                              </div>
                              <input type="date" value={s.signingDeadline || ""} min={new Date().toISOString().slice(0, 10)}
                                onChange={e => setSignerList(prev => prev.map((x, idx) => idx === i ? { ...x, signingDeadline: e.target.value || undefined } : x))}
                                className="text-xs px-2 py-1 border border-border rounded w-[130px] shrink-0" title="Signer deadline" />
                              <button onClick={() => setSignerList(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-500"><X className="h-4 w-4" /></button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              <div className="bg-muted/50 border border-dashed border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Add Signer</div>
                  <button onClick={addMyself} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                    <User className="h-3.5 w-3.5" /> Add myself
                  </button>
                </div>
                <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder={usersLoading ? "Loading team…" : "Search team members…"}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card" disabled={usersLoading} />
                {usersLoading && <EsignLoadingState label="Loading team members…" size="sm" inline />}
                {userSearch.trim() && filteredUsers.length > 0 && (
                  <div className="bg-card border border-border rounded-lg max-h-32 overflow-y-auto">
                    {filteredUsers.slice(0, 8).map(u => (
                      <button key={u.id} onClick={() => addSignerFromUser(u)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-b-0 border-border">
                        {userDisplayName(u)} · {u.email}
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <input value={newSignerName} onChange={e => setNewSignerName(e.target.value)} placeholder="Full name"
                    className="px-3 py-2 border border-border rounded-lg text-sm bg-card" />
                  <input value={newSignerEmail} onChange={e => setNewSignerEmail(e.target.value)} placeholder="email@company.com" type="email"
                    onKeyDown={e => { if (e.key === "Enter") addSignerManual(); }}
                    className="px-3 py-2 border border-border rounded-lg text-sm bg-card" />
                </div>
                <input value={newSignerRole} onChange={e => setNewSignerRole(e.target.value)} placeholder="Role / title (optional)"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card" />
                <button onClick={addSignerManual} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                  <Plus className="h-4 w-4" /> Add Signer
                </button>
              </div>

              <div className="flex justify-between gap-3">
                <button onClick={() => setComposeStep(1)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-1.5">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <div className="flex gap-2">
                  <button onClick={() => handleSendOrSave(true)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Save Draft</button>
                  <button onClick={() => setComposeStep(3)} disabled={!canProceed2}
                    className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 flex items-center gap-2">
                    Next: Settings <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {composeStep === 3 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5">Message to signers</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Optional message included in the signing invitation…" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Link to project</label>
                <select value={projectId ?? ""} onChange={e => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  setProjectId(id);
                  setDeliverableId(null);
                }}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-background" disabled={projectsLoading}>
                  <option value="">{projectsLoading ? "Loading projects…" : "No project"}</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {projectId && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Link to deliverable</label>
                  <select value={deliverableId ?? ""} onChange={e => setDeliverableId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-background" disabled={deliverablesLoading}>
                    <option value="">{deliverablesLoading ? "Loading deliverables…" : "No deliverable"}</option>
                    {projectDeliverables.map(d => <option key={d.id} value={d.id}>{d.name} ({d.type})</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">When all signers complete, the linked deliverable is marked Completed automatically.</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5">Expiry date *</label>
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} min={new Date().toISOString().slice(0, 10)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm" />
                <p className="text-xs text-muted-foreground mt-1">Default is 14 days from today. Signing links expire on this date.</p>
              </div>

              <div className="space-y-4 bg-muted/30 border border-border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div><div className="text-sm font-medium">Allow decline</div><div className="text-xs text-muted-foreground">Signers can refuse to sign</div></div>
                  <Switch checked={allowDecline} onCheckedChange={setAllowDecline} />
                </div>
                <div className="flex items-center justify-between">
                  <div><div className="text-sm font-medium">Send copy on completion</div><div className="text-xs text-muted-foreground">Email signed PDF to all parties</div></div>
                  <Switch checked={sendCopyOnCompletion} onCheckedChange={setSendCopyOnCompletion} />
                </div>
                <div className="flex items-center justify-between">
                  <div><div className="text-sm font-medium">Require acknowledgement</div><div className="text-xs text-muted-foreground">Checkbox before signing</div></div>
                  <Switch checked={requireAcknowledgement} onCheckedChange={setRequireAcknowledgement} />
                </div>
                {requireAcknowledgement && (
                  <input value={acknowledgementText} onChange={e => setAcknowledgementText(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="Acknowledgement text" />
                )}
                <div className="flex items-center justify-between">
                  <div><div className="text-sm font-medium">Require read to bottom</div><div className="text-xs text-muted-foreground">Must scroll entire document</div></div>
                  <Switch checked={requireReadToBottom} onCheckedChange={setRequireReadToBottom} />
                </div>
                <div className="flex items-center justify-between">
                  <div><div className="text-sm font-medium">OTP email verification</div><div className="text-xs text-muted-foreground">eIDAS SES — code sent before signing</div></div>
                  <Switch checked={requireOtpVerification} onCheckedChange={setRequireOtpVerification} />
                </div>
                <div className="flex items-center justify-between">
                  <div><div className="text-sm font-medium">eIDAS consent</div><div className="text-xs text-muted-foreground">Explicit SES consent checkbox</div></div>
                  <Switch checked={requireEidasConsent} onCheckedChange={setRequireEidasConsent} />
                </div>
                {requireEidasConsent && (
                  <input value={eidasConsentText} onChange={e => setEidasConsentText(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="eIDAS consent text" />
                )}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div>
                    <div className="text-sm font-medium">Signature level</div>
                    <div className="text-xs text-muted-foreground">
                      SES (default) or AdES via QTSP{!qtspStatus?.adesAvailable ? " — configure QTSP_PROVIDER for AdES" : ""}
                    </div>
                  </div>
                  <select value={signatureLevel} onChange={e => setSignatureLevel(e.target.value as "ses" | "ades")}
                    disabled={signatureLevel === "ades" && !qtspStatus?.adesAvailable}
                    className="px-2 py-1.5 border border-border rounded-lg text-sm bg-background">
                    <option value="ses">SES (Simple)</option>
                    <option value="ades" disabled={!qtspStatus?.adesAvailable}>AdES (Advanced)</option>
                  </select>
                </div>
              </div>

              {(srcType === "upload" && uploadedFile?.type === "pdf") && (
                <div className="bg-muted/30 border border-border rounded-xl p-4">
                  <div className="text-sm font-medium mb-3">Place signature fields (optional)</div>
                  <FieldPlacementEditor
                    signers={signerList}
                    fields={signatureFields}
                    onChange={setSignatureFields}
                    pdfPreviewUrl={uploadedFile ? `data:application/pdf;base64,${uploadedFile.data}` : null}
                  />
                </div>
              )}

              <div className="flex justify-between gap-3">
                <button onClick={() => setComposeStep(2)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-1.5">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <div className="flex gap-2">
                  <button onClick={() => handleSendOrSave(true)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Save Draft</button>
                  <button onClick={() => setComposeStep(4)} disabled={!canProceed3}
                    className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 flex items-center gap-2">
                    Review & Send <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4 */}
          {composeStep === 4 && (
            <div className="space-y-5">
              <div className="bg-card border border-border rounded-xl p-5 space-y-3 text-sm">
                <div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Document</span><span className="font-medium text-right max-w-[60%] truncate">{docTitle}</span></div>
                <div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Source</span><span className="font-medium capitalize">{srcType.replace("_", " ")}</span></div>
                <div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Signing order</span><span className="font-medium capitalize">{signingOrder}</span></div>
                <div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Signers</span><span className="font-medium">{signerList.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Expiry</span><span className="font-medium">{fmtDate(deadline)}</span></div>
              </div>

              <div className="space-y-2">
                {signerList.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                    <div className={cn("w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold", avatarColor(i))}>{getInitials(s.name)}</div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">Order {i + 1}</span>
                  </div>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>You're about to send sign-off emails to <strong>{signerList.length} signer{signerList.length !== 1 ? "s" : ""}</strong>. Each will receive a secure signing link.</span>
              </div>

              <div className="flex justify-between gap-3">
                <button onClick={() => setComposeStep(3)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-1.5">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <div className="flex gap-2">
                  <button onClick={() => handleSendOrSave(true)} disabled={createMut.isPending || sendMut.isPending}
                    className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted disabled:opacity-50 flex items-center gap-2">
                    {createMut.isPending && !sendMut.isPending ? <><EsignButtonSpinner /> Saving…</> : "Save Draft"}
                  </button>
                  <button onClick={() => handleSendOrSave(false)} disabled={createMut.isPending || sendMut.isPending}
                    className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 flex items-center gap-2">
                    {(createMut.isPending || sendMut.isPending) ? <><EsignButtonSpinner /> Sending…</> : <><Send className="h-4 w-4" /> Send e-Sign Request</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // ── TEMPLATES ───────────────────────────────────────────────────────────────
  if (view === "templates") {
    return shell(
      <>
        <PageHeader view={view} setView={setView} onNew={() => openCompose()} />
        <div className={modulePageContentOuterClass}>
          <div className={modulePageContentScrollClass}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          {templatesLoading ? (
            <EsignTemplateSkeleton />
          ) : templatesError ? (
            <EsignErrorState message="Could not load templates." onRetry={() => refetchTemplates()} />
          ) : templates.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">No templates available</div>
          ) : (
          <div className="grid gap-3 sm:grid-cols-1">
            {templates.map(tpl => (
              <div key={tpl.id} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3 min-w-0">
                  <LayoutTemplate className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{tpl.title}</div>
                    {tpl.description && <div className="text-sm text-muted-foreground truncate">{tpl.description}</div>}
                    <div className="text-xs text-muted-foreground mt-1 capitalize">{tpl.category || tpl.tier} · {tpl.sourceType.replace("_", " ")}</div>
                  </div>
                </div>
                <button onClick={() => openCompose(tpl)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 shrink-0">
                  Use Template
                </button>
              </div>
            ))}
          </div>
          )}
        </div>
          </div>
        </div>
      </>
    );
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  return shell(
    <>
      <PageHeader view={view} setView={setView} onNew={() => openCompose()} />

      <div className={modulePageContentOuterClass}>
        <div className={modulePageContentScrollClass}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {kpiLoading ? (
          <div className="mb-8"><EsignKpiSkeleton /></div>
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {[
            { label: "Total", val: total, filter: "all", color: "text-foreground", helpText: "All e-sign requests in your tenant." },
            { label: "Awaiting", val: awaiting, filter: "awaiting", color: "text-amber-600", helpText: "Requests sent and waiting for one or more signatures." },
            { label: "Completed", val: completed, filter: "completed", color: "text-green-600", helpText: "Fully signed and closed requests." },
            { label: "Declined", val: declined, filter: "declined", color: "text-red-600", helpText: "Requests where a signer declined to sign." },
            { label: "Expired", val: expired, filter: "expired", color: "text-muted-foreground", helpText: "Requests past their signing deadline." },
            { label: "Drafts", val: drafts, filter: "draft", color: "text-muted-foreground", helpText: "Requests saved but not yet sent." },
          ].map(({ label, val, filter, color, helpText }) => (
            <MetricCard
              key={filter}
              title={label}
              value={val}
              helpText={helpText}
              valueClassName={cn("font-mono", color)}
              className={cn(statusFilter === filter && "border-primary ring-2 ring-primary/20 shadow")}
              onClick={() => setStatusFilter(statusFilter === filter ? "all" : filter)}
              testId={`kpi-${filter}`}
            />
          ))}
        </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex gap-1 bg-muted p-1 rounded-lg overflow-x-auto">
            {FILTER_TABS.map(t => (
              <button key={t.key} onClick={() => setStatusFilter(t.key)} data-testid={`tab-${t.key}`}
                className={cn("px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors",
                  statusFilter === t.key ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents…"
                className="pl-9 pr-3 py-2 border border-border rounded-lg text-sm w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
              <option value="">Sort: Newest</option>
              <option value="title">Title</option>
              <option value="expiry">Expiry</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>

        <div className={cn("bg-card border border-border rounded-xl overflow-hidden esign-table-wrap", listFetching && !listLoading && "is-fetching")}>
          {listLoading ? (
            <EsignTableSkeleton />
          ) : listError ? (
            <EsignErrorState message="Could not load sign-off requests." onRetry={() => refetchList()} />
          ) : requests.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="font-semibold text-lg mb-2">No e-sign requests{statusFilter !== "all" ? " here" : " yet"}</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {statusFilter !== "all" ? "Try a different filter" : "Create your first e-sign request to get started"}
              </p>
              {statusFilter === "all" && (
                <button onClick={() => openCompose()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                  + New e-Sign
                </button>
              )}
            </div>
          ) : (
            <>
            <div className="overflow-x-auto esign-desktop-table">
              <table className="w-full text-sm text-gray-700 dark:text-foreground">
                <thead>
                  <tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
                    <th className="px-3 py-2.5 text-left align-middle font-semibold">Document</th>
                    <th className="px-3 py-2.5 text-left align-middle font-semibold">Status</th>
                    <th className="px-3 py-2.5 text-left align-middle font-semibold hidden md:table-cell">Signers</th>
                    <th className="px-3 py-2.5 text-left align-middle font-semibold hidden lg:table-cell">Sent</th>
                    <th className="px-3 py-2.5 text-left align-middle font-semibold hidden lg:table-cell">Expiry</th>
                    <th className="px-3 py-2.5 text-left align-middle font-semibold hidden xl:table-cell">Sent by</th>
                    <th className="px-3 py-2.5 text-left align-middle font-semibold hidden xl:table-cell">Project</th>
                    <th className="px-3 py-2.5 text-right align-middle font-semibold w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => {
                    const st = SIGNOFF_STATUS[r.status] || { label: r.status, color: "bg-muted text-muted-foreground", icon: "📄" };
                    const signed = r.signers.filter(s => s.status === "signed").length;
                    const canRemind = r.status === "pending" || r.status === "partially_signed";
                    const canVoid = ["pending", "partially_signed", "draft"].includes(r.status);
                    return (
                      <tr key={r.id} data-testid={`doc-row-${r.id}`} className="border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5 align-middle cursor-pointer" onClick={() => openDetail(r.id)}>
                          <div className="font-medium truncate max-w-[200px]">{r.title}</div>
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", st.color)}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 align-middle hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="flex -space-x-1.5">
                              {r.signers.slice(0, 4).map((s, i) => (
                                <div key={s.id} title={s.name}
                                  className={cn("w-7 h-7 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold text-white",
                                    s.status === "signed" ? "bg-green-600" : avatarColor(i))}>
                                  {getInitials(s.name)}
                                </div>
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground">{signed}/{r.signers.length}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-middle text-muted-foreground hidden lg:table-cell">{fmtDate(r.sentAt)}</td>
                        <td className="px-3 py-2.5 align-middle text-muted-foreground hidden lg:table-cell">{fmtDate(r.deadline)}</td>
                        <td className="px-3 py-2.5 align-middle text-muted-foreground hidden xl:table-cell truncate max-w-[120px]">{r.createdByName || "—"}</td>
                        <td className="px-3 py-2.5 align-middle text-muted-foreground hidden xl:table-cell truncate max-w-[120px]">{r.project?.name || "—"}</td>
                        <td className="px-3 py-2.5 align-middle text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 rounded-lg hover:bg-muted" aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetail(r.id)}><Eye className="h-4 w-4 mr-2" /> View</DropdownMenuItem>
                              {canRemind && <DropdownMenuItem onClick={() => handleRemind(r.id)}><Bell className="h-4 w-4 mr-2" /> Remind</DropdownMenuItem>}
                              {r.status === "completed" && (
                                <DropdownMenuItem asChild>
                                  <a href={`/api/signoff/${r.id}/signed-pdf`} target="_blank" rel="noreferrer"><Download className="h-4 w-4 mr-2" /> Download</a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleDuplicate(r.id)}><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
                              {canVoid && (
                                <DropdownMenuItem onClick={() => { setVoidTargetId(r.id); setVoidDialogOpen(true); }}><Ban className="h-4 w-4 mr-2" /> Void</DropdownMenuItem>
                              )}
                              {r.status !== "completed" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDelete(r.id)} className="text-red-600 focus:text-red-700"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile card list */}
            <div className="esign-mobile-cards">
              {requests.map(r => {
                const st = SIGNOFF_STATUS[r.status] || { label: r.status, color: "bg-muted text-muted-foreground" };
                const signed = r.signers.filter(s => s.status === "signed").length;
                return (
                  <button key={r.id} type="button" onClick={() => openDetail(r.id)} className="esign-doc-card w-full text-left">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="font-medium text-sm line-clamp-2">{r.title}</div>
                      <span className={cn("inline-flex shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium", st.color)}>{st.label}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{signed}/{r.signers.length} signed</span>
                      <span>{fmtDate(r.sentAt || r.createdAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            </>
          )}
        </div>
        </div>
          </div>
        </div>

      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void Document</DialogTitle></DialogHeader>
          <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Reason (optional)" rows={3}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none" />
          <DialogFooter>
            <button onClick={() => setVoidDialogOpen(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button onClick={handleVoid} disabled={voidMut.isPending}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
              {voidMut.isPending ? <><EsignButtonSpinner /> Voiding…</> : "Void"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PageHeader({ view, setView, onNew }: { view: View; setView: (v: View) => void; onNew: () => void }) {
  const tabs = [
    { key: "dashboard" as View, label: "Requests" },
    { key: "templates" as View, label: "Templates" },
  ];
  return (
    <>
      <div className={modulePageBannerWrapClass}>
        <ModuleWelcomeBanner moduleKey="esign" />
      </div>
      <div className={modulePageStickyHeaderClass}>
        <ModuleHeader
          icon={DigitalSigningIcon}
          title="e-Sign"
          subtitle="Electronic sign-off & approvals"
          titleTestId="esign-title"
          actions={
            <Button size="sm" onClick={onNew} className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New e-Sign</span>
              <span className="sm:hidden">New</span>
            </Button>
          }
        />
        <div className={modulePageTabsWrapClass}>
          <div className={cn(modulePageTabsListClass, "pb-2")}>
            {tabs.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setView(t.key)}
                className={cn(
                  modulePageTabTriggerClass,
                  "inline-flex items-center py-1.5 font-medium transition-colors",
                  view === t.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
