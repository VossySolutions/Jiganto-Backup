import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/Sidebar";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { cn } from "@/lib/utils";
import {
  FileText, FileSpreadsheet, Presentation, Upload, Link2,
  CheckCircle2, Clock, AlertCircle, ChevronRight, ChevronLeft,
  Plus, Trash2, Send, Download, Bell, Eye, ArrowLeft,
  Copy, X, Shield, User, CalendarDays, AlertTriangle,
  BookOpen, FileSignature,
} from "lucide-react";

type SignoffRequest = {
  id: number; title: string; status: string; sourceType: string;
  sourceDocumentId?: number; fileName?: string; fileType?: string;
  message?: string; deadline?: string; createdByName?: string;
  sentAt?: string; completedAt?: string; createdAt: string;
  signers: SignoffSigner[]; auditLog: AuditEvent[];
  sourceDocument?: { id: number; title: string; content: string | null } | null;
};
type SignoffSigner = {
  id: number; requestId: number; signerOrder: number; name: string;
  email: string; isInternal: boolean; userId?: string; token?: string;
  status: string; signedAt?: string; viewedAt?: string; declinedAt?: string;
  declineReason?: string; signatureName?: string;
};
type AuditEvent = {
  id: number; requestId: number; event: string; actorName: string;
  actorEmail?: string; ipAddress?: string; createdAt: string;
  metadata?: Record<string, any>;
};
type JigantoDoc = { id: number; title: string; type: string; status: string };

const STATUS_LABEL: Record<string, { label: string; color: string; icon: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground border border-border", icon: "📝" },
  pending: { label: "Awaiting signatures", color: "bg-amber-50 text-amber-700 border border-amber-200", icon: "⏳" },
  completed: { label: "Fully signed", color: "bg-green-50 text-green-700 border border-green-200", icon: "✅" },
  declined: { label: "Declined", color: "bg-red-50 text-red-700 border border-red-200", icon: "✗" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500 border border-gray-200", icon: "⊘" },
};
const SIGNER_STATUS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  viewed: "bg-blue-50 text-blue-700 border border-blue-200",
  signed: "bg-green-50 text-green-700 border border-green-200",
  declined: "bg-red-50 text-red-700 border border-red-200",
};
const SIGNER_LABEL: Record<string, string> = {
  pending: "Awaiting", viewed: "Viewed", signed: "✓ Signed", declined: "✗ Declined",
};
const FILE_ICON: Record<string, JSX.Element> = {
  pdf: <FileText className="h-5 w-5 text-red-500" />,
  docx: <FileText className="h-5 w-5 text-blue-500" />,
  xlsx: <FileSpreadsheet className="h-5 w-5 text-green-600" />,
  pptx: <Presentation className="h-5 w-5 text-orange-500" />,
};

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

const AUDIT_EVENT_LABEL: Record<string, string> = {
  created: "Request created",
  sent: "Sign-off request sent to signers",
  viewed: "Document viewed",
  signed: "Document signed",
  declined: "Declined to sign",
  reminder_sent: "Reminder sent to pending signers",
  completed: "Document fully signed — certificates sent to all parties",
};

function printAuditReport(r: SignoffRequest) {
  const statusText = STATUS_LABEL[r.status]?.label || r.status;
  const signedCount = r.signers.filter(s => s.status === "signed").length;

  const signerRows = r.signers.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${s.name}</strong><br/><span style="color:#6b7280;font-size:12px">${s.email}</span></td>
      <td>${SIGNER_LABEL[s.status] || s.status}</td>
      <td>${s.signedAt ? fmtDateTime(s.signedAt) : s.declinedAt ? fmtDateTime(s.declinedAt) : "—"}</td>
      <td>${(s as any).signatureName || "—"}</td>
    </tr>`).join("");

  const auditRows = r.auditLog.length > 0
    ? r.auditLog.map(ev => `
    <tr>
      <td style="white-space:nowrap">${fmtDateTime(ev.createdAt)}</td>
      <td>${AUDIT_EVENT_LABEL[ev.event] || ev.event}</td>
      <td>${ev.actorName && ev.actorName !== "System" ? ev.actorName : "<em>System</em>"}</td>
      <td>${ev.ipAddress || "—"}</td>
      <td>${(ev.metadata as any)?.signatureName || "—"}</td>
    </tr>`).join("")
    : `<tr><td colspan="5" style="color:#6b7280;text-align:center;padding:20px">No activity recorded yet</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Audit Report – ${r.title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px; color: #111; padding: 40px; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 28px; }
  .brand { font-size: 18px; font-weight: 700; }
  .brand span { font-size: 11px; font-weight: 500; background: #f3f4f6; color: #6b7280; padding: 2px 8px; border-radius: 20px; letter-spacing: .06em; text-transform: uppercase; margin-left: 8px; vertical-align: middle; }
  .meta { font-size: 11px; color: #6b7280; text-align: right; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; margin: 24px 0 10px; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 8px; }
  .summary-item label { display: block; font-size: 11px; color: #6b7280; margin-bottom: 3px; text-transform: uppercase; letter-spacing: .05em; }
  .summary-item value { display: block; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
  th { text-align: left; padding: 8px 10px; background: #f3f4f6; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
  td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">Jiganto <span>e-Sign</span></div>
    <h1 style="margin-top:8px">${r.title}</h1>
  </div>
  <div class="meta">
    Audit Report<br/>
    Generated ${fmtDateTime(new Date().toISOString())}
  </div>
</div>

<h2>Document Summary</h2>
<div class="summary-grid">
  <div class="summary-item"><label>Document</label><value>${r.title}</value></div>
  <div class="summary-item"><label>Status</label><value>${statusText}</value></div>
  <div class="summary-item"><label>Sent</label><value>${fmtDate(r.sentAt)}</value></div>
  <div class="summary-item"><label>Signers</label><value>${signedCount} of ${r.signers.length} signed</value></div>
</div>

<h2>Signers</h2>
<table>
  <thead><tr><th>#</th><th>Name / Email</th><th>Status</th><th>Date</th><th>Signature</th></tr></thead>
  <tbody>${signerRows}</tbody>
</table>

<h2>Audit Trail</h2>
<table>
  <thead><tr><th>Date &amp; Time</th><th>Event</th><th>Actor</th><th>IP Address</th><th>Signature Name</th></tr></thead>
  <tbody>${auditRows}</tbody>
</table>

<div class="footer">
  <span>Jiganto e-Sign — Electronic Signature Audit Report</span>
  <span>Request ID: #${r.id} · Created ${fmtDate(r.createdAt)}</span>
</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=960,height=720");
  if (!win) { alert("Please allow pop-ups to download the PDF report."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export default function SignOffPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { mainOffset, mobileTopOffset } = useShellLayout();
  const [view, setView] = useState<"dashboard" | "compose" | "detail" | "audit">("dashboard");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [composeStep, setComposeStep] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Compose wizard state
  const [srcType, setSrcType] = useState<"upload" | "jiganto_doc">("upload");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);

  // CRM contract link state
  const [crmContractId, setCrmContractId] = useState<number | null>(null);

  // Auto-open compose wizard when arriving via "Send for Sign-off" from a document or CRM contract
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const compose = params.get("compose");
    const jigantoDocId = params.get("jigantoDocId");
    const jigantoDocTitle = params.get("jigantoDocTitle");
    const crmContractIdParam = params.get("crmContractId");
    const crmContractTitle = params.get("crmContractTitle");
    if (compose === "1" && jigantoDocId) {
      setSrcType("jiganto_doc");
      setSelectedDocId(Number(jigantoDocId));
      setDocTitle(jigantoDocTitle || "");
      setView("compose");
      window.history.replaceState({}, "", "/modules/e-sign");
    } else if (compose === "1" && crmContractIdParam) {
      setSrcType("upload");
      setCrmContractId(Number(crmContractIdParam));
      setDocTitle(crmContractTitle ? `Sign-off: ${crmContractTitle}` : "Contract Sign-off");
      setView("compose");
      window.history.replaceState({}, "", "/modules/e-sign");
    }
  }, []);
  const [docTitle, setDocTitle] = useState("");
  const [message, setMessage] = useState("");
  const [deadline, setDeadline] = useState("");
  const [signerList, setSignerList] = useState<{ name: string; email: string; isInternal: boolean }[]>([]);
  const [newSignerName, setNewSignerName] = useState("");
  const [newSignerEmail, setNewSignerEmail] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: requests = [], isLoading } = useQuery<SignoffRequest[]>({
    queryKey: ["/api/signoff"],
  });
  const { data: jigantoDocsRaw = [] } = useQuery<JigantoDoc[]>({
    queryKey: ["/api/signoff/jiganto-docs"],
    enabled: srcType === "jiganto_doc",
  });
  const jigantoDocList = Array.isArray(jigantoDocsRaw) ? jigantoDocsRaw : [];
  const { data: selectedRequest, isLoading: detailLoading } = useQuery<SignoffRequest>({
    queryKey: ["/api/signoff", selectedId],
    enabled: selectedId !== null && (view === "detail" || view === "audit"),
  });

  const createMut = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/signoff", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/signoff"] }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => apiRequest("PATCH", `/api/signoff/${id}`, body),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/signoff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/signoff", id] });
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/signoff/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/signoff"] }),
  });
  const sendMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/signoff/${id}/send`, {}),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/signoff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/signoff", id] });
    },
  });
  const remindMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/signoff/${id}/remind`, {}),
  });
  const deleteSignerMut = useMutation({
    mutationFn: (signerId: number) => apiRequest("DELETE", `/api/signoff/signers/${signerId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signoff"] });
      if (selectedId) queryClient.invalidateQueries({ queryKey: ["/api/signoff", selectedId] });
    },
  });
  const addSignerEditMut = useMutation({
    mutationFn: ({ requestId, name, email }: { requestId: number; name: string; email: string }) =>
      apiRequest("POST", `/api/signoff/${requestId}/signers`, { name, email, isInternal: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signoff"] });
      if (selectedId) queryClient.invalidateQueries({ queryKey: ["/api/signoff", selectedId] });
    },
  });
  const updateSignerMut = useMutation({
    mutationFn: ({ signerId, name, email }: { signerId: number; name: string; email: string }) =>
      apiRequest("PATCH", `/api/signoff/signers/${signerId}`, { name, email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signoff"] });
      if (selectedId) queryClient.invalidateQueries({ queryKey: ["/api/signoff", selectedId] });
    },
  });

  // Edit-mode state (for draft requests)
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editNewName, setEditNewName] = useState("");
  const [editNewEmail, setEditNewEmail] = useState("");
  const [editSigners, setEditSigners] = useState<Record<number, { name: string; email: string }>>({});

  function startEdit(r: SignoffRequest) {
    setEditTitle(r.title);
    setEditMessage(r.message || "");
    setEditDeadline(r.deadline ? r.deadline.slice(0, 10) : "");
    setEditNewName("");
    setEditNewEmail("");
    const signerMap: Record<number, { name: string; email: string }> = {};
    r.signers.forEach(s => { signerMap[s.id] = { name: s.name, email: s.email }; });
    setEditSigners(signerMap);
    setEditMode(true);
  }
  function cancelEdit() { setEditMode(false); setEditSigners({}); }
  async function saveEdit(r: SignoffRequest) {
    try {
      await updateMut.mutateAsync({ id: r.id, body: { title: editTitle.trim() || r.title, message: editMessage || null, deadline: editDeadline || null } });
      // Patch any modified signers
      for (const s of r.signers) {
        const edited = editSigners[s.id];
        if (edited && (edited.name.trim() !== s.name || edited.email.trim() !== s.email)) {
          await updateSignerMut.mutateAsync({ signerId: s.id, name: edited.name.trim(), email: edited.email.trim() });
        }
      }
      toast({ title: "Changes saved ✓" });
      setEditMode(false);
      setEditSigners({});
    } catch (e: any) { toast({ title: "Error saving", description: e.message, variant: "destructive" }); }
  }
  async function addSignerInEdit(requestId: number) {
    if (!editNewName.trim() || !editNewEmail.trim()) { toast({ title: "Name and email required", variant: "destructive" }); return; }
    await addSignerEditMut.mutateAsync({ requestId, name: editNewName.trim(), email: editNewEmail.trim() });
    setEditNewName("");
    setEditNewEmail("");
  }

  // KPI counts
  const total = requests.length;
  const awaiting = requests.filter(r => r.status === "pending").length;
  const completed = requests.filter(r => r.status === "completed").length;
  const drafts = requests.filter(r => r.status === "draft").length;

  const filtered = statusFilter === "all" ? requests
    : requests.filter(r => r.status === statusFilter);

  function resetCompose() {
    setComposeStep(1); setSrcType("upload"); setUploadedFile(null);
    setSelectedDocId(null); setCrmContractId(null); setDocTitle(""); setMessage(""); setDeadline("");
    setSignerList([]); setNewSignerName(""); setNewSignerEmail(""); setEditingId(null);
  }

  function openCompose() {
    resetCompose();
    setView("compose");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["pdf", "docx", "xlsx", "pptx"].includes(ext)) {
      toast({ title: "Unsupported file type", description: "Please upload a PDF, Word, Excel, or PowerPoint file.", variant: "destructive" });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 15 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const base64 = (ev.target?.result as string).split(",")[1];
      setUploadedFile({ name: file.name, type: ext, data: base64 });
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
      handleFileChange({ target: fileInputRef.current } as any);
    }
  }

  function addSigner() {
    if (!newSignerName.trim() || !newSignerEmail.trim()) {
      toast({ title: "Please enter name and email", variant: "destructive" }); return;
    }
    setSignerList(prev => [...prev, { name: newSignerName.trim(), email: newSignerEmail.trim(), isInternal: false }]);
    setNewSignerName(""); setNewSignerEmail("");
  }

  function removeSigner(i: number) {
    setSignerList(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSendOrSave(asDraft: boolean) {
    try {
      const body: any = {
        title: docTitle || "Untitled Sign-Off",
        sourceType: crmContractId ? "crm_contract" : srcType,
        sourceDocumentId: srcType === "jiganto_doc" ? selectedDocId : null,
        crmContractId: crmContractId || null,
        fileName: uploadedFile?.name || null,
        fileType: uploadedFile?.type || null,
        fileData: uploadedFile?.data || null,
        message: message || null,
        deadline: deadline || null,
        signers: signerList,
      };
      const result = await createMut.mutateAsync(body);
      const id = (result as any).id;
      if (!asDraft && id) {
        await sendMut.mutateAsync(id);
        toast({ title: "Sign-off request sent ✓", description: `Sent to ${signerList.length} signer${signerList.length !== 1 ? "s" : ""}` });
      } else {
        toast({ title: "Saved as draft" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/signoff"] });
      setView("dashboard");
      resetCompose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleSendExisting(id: number) {
    try {
      await sendMut.mutateAsync(id);
      toast({ title: "Sign-off request sent ✓" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this sign-off request? This cannot be undone.")) return;
    await deleteMut.mutateAsync(id);
    if (view !== "dashboard") setView("dashboard");
    toast({ title: "Deleted" });
  }

  function openDetail(id: number) {
    setSelectedId(id);
    setView("detail");
  }
  function openAudit(id: number) {
    setSelectedId(id);
    setView("audit");
  }

  function copyLink(signer: SignoffSigner) {
    if (!signer.token) { toast({ title: "No signing link yet — send the request first", variant: "destructive" }); return; }
    const url = `${window.location.origin}/sign/${signer.token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Signing link copied ✓" });
  }

  const signerCount = (r: SignoffRequest) => {
    const signed = r.signers.filter(s => s.status === "signed").length;
    return `${signed} of ${r.signers.length} signed`;
  };

  const pendingSigners = (r: SignoffRequest) => r.signers.filter(s => s.status === "pending");

  // ── RENDER VIEWS ──────────────────────────────────────────────────────────

  if (view === "detail" || view === "audit") {
    const r = selectedRequest;
    return (
      <div className="h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className={cn("transition-all duration-300 h-full overflow-y-auto", mainOffset, mobileTopOffset)}>
        <div className="bg-card border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("dashboard")} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold text-sm">{r?.title || "Loading…"}</span>
          </div>
          <div className="flex gap-2">
            {view === "detail" && r && (
              <>
                {!editMode && (
                  <button onClick={() => openAudit(r.id)} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" /> Audit Trail
                  </button>
                )}
                {r.status === "draft" && !editMode && (
                  <button onClick={() => startEdit(r)}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted flex items-center gap-1.5">
                    ✏️ Edit Request
                  </button>
                )}
                {editMode && (
                  <>
                    <button onClick={cancelEdit} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted">
                      Cancel
                    </button>
                    <button onClick={() => saveEdit(r)} disabled={updateMut.isPending}
                      className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-40 flex items-center gap-1.5">
                      {updateMut.isPending ? "Saving…" : "Save Changes"}
                    </button>
                  </>
                )}
                {r.status === "pending" && !editMode && (
                  <button onClick={() => { remindMut.mutate(r.id); toast({ title: "Reminder sent to pending signers ✓" }); }}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5" /> Send Reminder
                  </button>
                )}
                {r.status === "draft" && !editMode && (
                  <button onClick={() => handleSendExisting(r.id)}
                    className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5" /> Send Now
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

        {detailLoading && <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>}
        {r && view === "detail" && (
          <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-[1fr_300px] gap-6">
            {/* Left: document preview */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold">{r.title}</h1>
                  <p className="text-muted-foreground text-sm mt-1">
                    Sent by {r.createdByName} · {fmtDate(r.sentAt || r.createdAt)} · {r.signers.length} signer{r.signers.length !== 1 ? "s" : ""} required
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${STATUS_LABEL[r.status]?.color || "bg-muted text-muted-foreground"}`}>
                  {STATUS_LABEL[r.status]?.label || r.status}
                </span>
              </div>

              {r.sourceType === "upload" && r.fileType === "pdf" ? (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow">
                  <div className="bg-muted px-4 py-2.5 flex items-center justify-between text-sm border-b border-border">
                    <span className="flex items-center gap-2">{FILE_ICON[r.fileType || ""] || <FileText className="h-4 w-4" />} {r.fileName}</span>
                    <a href={`/api/signoff/${r.id}/file`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                      <Download className="h-3.5 w-3.5" /> Download
                    </a>
                  </div>
                  <iframe src={`/api/signoff/${r.id}/file`} className="w-full h-[600px]" title="Document preview" />
                </div>
              ) : r.sourceType === "upload" ? (
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <div className="flex justify-center mb-4">{FILE_ICON[r.fileType || ""] || <FileText className="h-12 w-12 text-muted-foreground" />}</div>
                  <h3 className="font-semibold text-lg mb-2">{r.fileName}</h3>
                  <p className="text-muted-foreground text-sm mb-4">This file type cannot be previewed in the browser. Download it to review the document.</p>
                  <a href={`/api/signoff/${r.id}/file`} download
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                    <Download className="h-4 w-4" /> Download {r.fileType?.toUpperCase()}
                  </a>
                </div>
              ) : r.sourceDocument ? (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow">
                  <div className="bg-muted px-4 py-2.5 border-b border-border text-sm font-medium flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-primary" /> Jiganto Document: {r.sourceDocument.title}
                  </div>
                  <div className="p-8 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: r.sourceDocument.content || "<p>No content</p>" }} />
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                  Document not available
                </div>
              )}

              {r.message && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                  <span className="font-medium">Message from sender:</span> {r.message}
                </div>
              )}
            </div>

            {/* Right: signers + info */}
            <div className="space-y-4">
              <div className={cn("bg-card border rounded-xl p-5", editMode ? "border-primary/40 ring-1 ring-primary/20" : "border-border")}>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  {editMode ? "Edit Signers — update or × to remove" : "Signing Progress"}
                </div>
                <div className="relative pl-6">
                  <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                  {r.signers.map((s, i) => (
                    <div key={s.id} className="relative mb-5 last:mb-0">
                      <div className={`absolute -left-[18px] top-1 w-3.5 h-3.5 rounded-full border-2 border-background ${s.status === "signed" ? "bg-green-500" : s.status === "declined" ? "bg-red-500" : s.status === "viewed" ? "bg-blue-500" : "bg-amber-400"}`} />
                      {editMode ? (
                        <div className="flex items-start gap-2">
                          <div className="flex-1 space-y-1">
                            <input
                              value={editSigners[s.id]?.name ?? s.name}
                              onChange={e => setEditSigners(prev => ({ ...prev, [s.id]: { ...prev[s.id], name: e.target.value } }))}
                              placeholder="Full name"
                              className="w-full px-2 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                            <input
                              value={editSigners[s.id]?.email ?? s.email}
                              onChange={e => setEditSigners(prev => ({ ...prev, [s.id]: { ...prev[s.id], email: e.target.value } }))}
                              placeholder="Email address" type="email"
                              className="w-full px-2 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                          <button onClick={() => deleteSignerMut.mutate(s.id)}
                            disabled={deleteSignerMut.isPending}
                            className="mt-1 w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100 text-xs font-bold border border-red-200"
                            title="Remove signer">×</button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium">{s.name}</div>
                            <div className="text-xs text-muted-foreground">{s.email}</div>
                            {s.signedAt && <div className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(s.signedAt)}</div>}
                            {s.declineReason && <div className="text-xs text-red-600 mt-0.5 italic">"{s.declineReason}"</div>}
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SIGNER_STATUS[s.status]}`}>
                              {SIGNER_LABEL[s.status] || s.status}
                            </span>
                            {r.status === "pending" && s.token && s.status === "pending" && (
                              <button onClick={() => copyLink(s)} className="text-xs text-primary hover:underline flex items-center gap-1">
                                <Copy className="h-3 w-3" /> Copy link
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {editMode && (
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Add signer</div>
                    <input value={editNewName} onChange={e => setEditNewName(e.target.value)}
                      placeholder="Full name"
                      className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                    <input value={editNewEmail} onChange={e => setEditNewEmail(e.target.value)}
                      placeholder="Email address" type="email"
                      onKeyDown={e => { if (e.key === "Enter") addSignerInEdit(r.id); }}
                      className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                    <button onClick={() => addSignerInEdit(r.id)} disabled={addSignerEditMut.isPending}
                      className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline disabled:opacity-40">
                      <Plus className="h-3.5 w-3.5" /> Add Signer
                    </button>
                  </div>
                )}

                {!editMode && r.status === "pending" && pendingSigners(r).length > 0 && (
                  <button onClick={() => { remindMut.mutate(r.id); toast({ title: `Reminder sent to ${pendingSigners(r).length} signer(s) ✓` }); }}
                    className="w-full mt-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2">
                    <Bell className="h-4 w-4" /> Remind Pending Signers
                  </button>
                )}
              </div>

              <div className={cn("bg-card border rounded-xl p-5 text-sm space-y-2", editMode ? "border-primary/40 ring-1 ring-primary/20" : "border-border")}>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {editMode ? "Edit Details" : "Document Info"}
                </div>
                {editMode ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
                      <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Deadline</label>
                      <input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Message to signers</label>
                      <textarea value={editMessage} onChange={e => setEditMessage(e.target.value)} rows={3}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                        placeholder="Optional message…" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground">Sent</span><span className="font-medium">{fmtDate(r.sentAt)}</span></div>
                    <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground">Deadline</span><span className="font-medium">{r.deadline ? fmtDate(r.deadline) : "None set"}</span></div>
                    <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground">Signers</span><span className="font-medium">{r.signers.length} required</span></div>
                    {r.completedAt && <div className="flex justify-between py-2"><span className="text-muted-foreground">Completed</span><span className="font-medium text-green-700">{fmtDate(r.completedAt)}</span></div>}
                  </>
                )}
              </div>

              <button onClick={() => openAudit(r.id)}
                className="w-full py-2.5 text-sm border border-border rounded-xl hover:bg-muted flex items-center justify-center gap-2">
                <BookOpen className="h-4 w-4" /> View Full Audit Trail
              </button>
              {(r.status === "draft" || r.status === "pending") && (
                <button onClick={() => handleDelete(r.id)}
                  className="w-full py-2.5 text-sm border border-red-200 text-red-600 rounded-xl hover:bg-red-50 flex items-center justify-center gap-2">
                  <Trash2 className="h-4 w-4" /> Delete Request
                </button>
              )}
            </div>
          </div>
        )}

        {r && view === "audit" && (
          <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-[1fr_300px] gap-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">Audit Trail</h1>
              <p className="text-muted-foreground text-sm mb-6">{r.title} · Created {fmtDate(r.createdAt)}</p>
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="font-semibold mb-5">Signing Activity</h2>
                <div className="relative pl-8">
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                  {r.auditLog.map(ev => (
                    <div key={ev.id} className="relative mb-6 last:mb-0">
                      <div className={`absolute -left-[22px] top-1.5 w-3 h-3 rounded-full border-2 border-background ${ev.event === "completed" ? "bg-green-500" : ev.event === "declined" ? "bg-red-500" : "bg-primary"}`} />
                      <div className="text-sm font-medium leading-snug">{AUDIT_EVENT_LABEL[ev.event] || ev.event}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {fmtDateTime(ev.createdAt)}
                        {ev.actorName && ev.actorName !== "System" && ` · ${ev.actorName}`}
                        {ev.ipAddress && ` · IP ${ev.ipAddress}`}
                        {ev.metadata?.signatureName && ` · "${ev.metadata.signatureName}"`}
                      </div>
                    </div>
                  ))}
                  {r.auditLog.length === 0 && <p className="text-muted-foreground text-sm">No activity yet</p>}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-5 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Document Summary</div>
                <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground">Document</span><span className="font-medium text-right max-w-[150px] truncate">{r.title}</span></div>
                <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground">Sent</span><span className="font-medium">{fmtDate(r.sentAt)}</span></div>
                <div className="flex justify-between py-2 border-b border-border"><span className="text-muted-foreground">Status</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_LABEL[r.status]?.color}`}>{STATUS_LABEL[r.status]?.label}</span>
                </div>
                <div className="flex justify-between py-2"><span className="text-muted-foreground">Signers</span><span className="font-medium">{r.signers.filter(s => s.status === "signed").length} / {r.signers.length}</span></div>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Signers</div>
                <div className="space-y-3">
                  {r.signers.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full ${avatarColor(i)} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                        {getInitials(s.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{s.name}</div>
                        {s.signedAt && <div className="text-xs text-muted-foreground">{fmtDate(s.signedAt)}</div>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SIGNER_STATUS[s.status]}`}>{SIGNER_LABEL[s.status]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => r && printAuditReport(r)} className="w-full py-2.5 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 flex items-center justify-center gap-2">
                <Download className="h-4 w-4" /> Download PDF Report
              </button>
            </div>
          </div>
        )}
        </main>
      </div>
    );
  }

  if (view === "compose") {
    const stepLabels = ["Document", "Signers", "Message & Deadline", "Review & Send"];
    const canProceed1 = srcType === "upload" ? !!uploadedFile : !!selectedDocId;
    const canProceed2 = signerList.length > 0;

    return (
      <div className="h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className={cn("transition-all duration-300 h-full overflow-y-auto", mainOffset, mobileTopOffset)}>
        <div className="bg-card border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="nav-logo font-bold text-lg flex items-center gap-2">
            Jiganto <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full uppercase tracking-wide">e-Sign</span>
          </div>
          <button onClick={() => { setView("dashboard"); resetCompose(); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" /> Cancel
          </button>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold mb-2">New e-Sign Request</h1>
          <p className="text-muted-foreground text-sm mb-8">Upload a document or pick one from Jiganto, then define who needs to sign it</p>

          {/* Steps */}
          <div className="flex mb-10 rounded-xl overflow-hidden border border-border">
            {stepLabels.map((label, i) => {
              const step = i + 1;
              const done = step < composeStep;
              const active = step === composeStep;
              return (
                <div key={step} className={`flex-1 flex items-center gap-2.5 px-4 py-3 text-sm font-medium border-r last:border-r-0 border-border transition-colors
                  ${done ? "bg-primary/10 text-primary" : active ? "bg-primary/5 text-primary border-primary/20" : "bg-card text-muted-foreground"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${done ? "bg-primary text-white" : active ? "bg-primary text-white" : "bg-border text-muted-foreground"}`}>
                    {done ? "✓" : step}
                  </div>
                  <span className="hidden sm:block">{label}</span>
                </div>
              );
            })}
          </div>

          {/* Step 1: Document */}
          {composeStep === 1 && (
            <div className="space-y-5">
              {crmContractId && (
                <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-sm">
                  <FileSignature className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <span className="font-medium text-primary">Linked to CRM Contract</span>
                    <span className="text-muted-foreground ml-2">— upload the signed document file below, or skip to add signers directly</span>
                  </div>
                </div>
              )}
              {!crmContractId && (
                <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
                  {(["upload", "jiganto_doc"] as const).map(t => (
                    <button key={t} onClick={() => setSrcType(t)}
                      className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${srcType === t ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      {t === "upload" ? "📎 Upload File" : "🔗 Jiganto Document"}
                    </button>
                  ))}
                </div>
              )}

              {srcType === "upload" ? (
                <div>
                  {!uploadedFile ? (
                    <div
                      className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/5"); }}
                      onDragLeave={e => e.currentTarget.classList.remove("border-primary", "bg-primary/5")}
                      onDrop={handleDrop}
                    >
                      <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold text-base mb-1">Drop your document here</h3>
                      <p className="text-muted-foreground text-sm mb-4">PDF, Word (.docx), Excel (.xlsx), or PowerPoint (.pptx) · Max 15 MB</p>
                      <button className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Browse files</button>
                      <input ref={fileInputRef} type="file" accept=".pdf,.docx,.xlsx,.pptx" className="hidden" onChange={handleFileChange} />
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-4">
                      <div className="bg-green-100 rounded-lg p-3">{FILE_ICON[uploadedFile.type] || <FileText className="h-6 w-6 text-green-600" />}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-green-800">{uploadedFile.name}</div>
                        <div className="text-sm text-green-600">{uploadedFile.type.toUpperCase()} · Ready to send</div>
                      </div>
                      <button onClick={() => setUploadedFile(null)} className="text-green-600 hover:text-green-800"><X className="h-5 w-5" /></button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Select a document from your Jiganto Document Management system</p>
                  <div className="bg-card border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    {jigantoDocList.length === 0
                      ? <div className="p-8 text-center text-muted-foreground text-sm">No documents found</div>
                      : jigantoDocList.map(doc => (
                        <div key={doc.id}
                          onClick={() => { setSelectedDocId(doc.id); setDocTitle(doc.title); }}
                          className={`flex items-center gap-3 px-4 py-3 border-b last:border-b-0 border-border cursor-pointer hover:bg-muted transition-colors
                            ${selectedDocId === doc.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}>
                          <Link2 className={`h-4 w-4 flex-shrink-0 ${selectedDocId === doc.id ? "text-primary" : "text-muted-foreground"}`} />
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium text-sm truncate ${selectedDocId === doc.id ? "text-primary" : ""}`}>{doc.title}</div>
                            <div className="text-xs text-muted-foreground capitalize">{doc.type} · {doc.status}</div>
                          </div>
                          {selectedDocId === doc.id && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5">Document title *</label>
                <input value={docTitle} onChange={e => setDocTitle(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="e.g. Project Alpha — Scope of Work v2.1" />
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => { setView("dashboard"); resetCompose(); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Cancel</button>
                <button onClick={() => setComposeStep(2)} disabled={!canProceed1 || !docTitle.trim()}
                  className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 flex items-center gap-2">
                  Next: Add Signers <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Signers */}
          {composeStep === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">Signers will be notified in order. All must sign before the document is complete.</p>
              <div className="space-y-2">
                {signerList.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                    <div className="w-6 h-6 rounded-full bg-border flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">{i + 1}</div>
                    <div className={`w-8 h-8 rounded-full ${avatarColor(i)} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>{getInitials(s.name)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                    </div>
                    <button onClick={() => removeSigner(i)} className="text-muted-foreground hover:text-red-500"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>

              <div className="bg-muted/50 border border-dashed border-border rounded-xl p-4">
                <div className="text-sm font-medium mb-3">Add Signer</div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input value={newSignerName} onChange={e => setNewSignerName(e.target.value)}
                    className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-card"
                    placeholder="Full name" />
                  <input value={newSignerEmail} onChange={e => setNewSignerEmail(e.target.value)} type="email"
                    className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-card"
                    placeholder="email@company.com"
                    onKeyDown={e => { if (e.key === "Enter") addSigner(); }} />
                </div>
                <button onClick={addSigner} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                  <Plus className="h-4 w-4" /> Add Signer
                </button>
              </div>

              <div className="flex justify-between gap-3">
                <button onClick={() => setComposeStep(1)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-1.5">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <div className="flex gap-2">
                  <button onClick={() => handleSendOrSave(true)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Save as Draft</button>
                  <button onClick={() => setComposeStep(3)} disabled={!canProceed2}
                    className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 flex items-center gap-2">
                    Next: Message <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Message & Deadline */}
          {composeStep === 3 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5">Message to signers (optional)</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  placeholder="e.g. Please review and sign off the attached Scope of Work before the deadline." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Sign-off deadline (optional)</label>
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                  className="px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                <p className="text-xs text-muted-foreground mt-1.5">Signers' links will expire on this date. If not set, links expire after 30 days.</p>
              </div>
              <div className="flex justify-between gap-3">
                <button onClick={() => setComposeStep(2)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-1.5">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <div className="flex gap-2">
                  <button onClick={() => handleSendOrSave(true)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Save as Draft</button>
                  <button onClick={() => setComposeStep(4)}
                    className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-2">
                    Review & Send <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review & Send */}
          {composeStep === 4 && (
            <div className="space-y-5">
              <div className="bg-card border border-border rounded-xl p-5 space-y-3 text-sm">
                <div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Document</span><span className="font-medium">{docTitle}</span></div>
                <div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Source</span><span className="font-medium">{srcType === "upload" ? uploadedFile?.name : "Jiganto Document"}</span></div>
                <div className="flex justify-between border-b border-border pb-3"><span className="text-muted-foreground">Signers</span><span className="font-medium">{signerList.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Deadline</span><span className="font-medium">{deadline ? fmtDate(deadline) : "30 days"}</span></div>
              </div>

              <div className="space-y-2">
                {signerList.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                    <div className={`w-8 h-8 rounded-full ${avatarColor(i)} text-white flex items-center justify-center text-xs font-bold`}>{getInitials(s.name)}</div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">Order {i + 1}</span>
                  </div>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>You're about to send sign-off emails to <strong>{signerList.length} signer{signerList.length !== 1 ? "s" : ""}</strong>. Each will receive a secure, one-time signing link.</span>
              </div>

              <div className="flex justify-between gap-3">
                <button onClick={() => setComposeStep(3)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-1.5">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <div className="flex gap-2">
                  <button onClick={() => handleSendOrSave(true)} disabled={createMut.isPending}
                    className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Save as Draft</button>
                  <button onClick={() => handleSendOrSave(false)} disabled={createMut.isPending || sendMut.isPending}
                    className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 flex items-center gap-2">
                    <Send className="h-4 w-4" /> {(createMut.isPending || sendMut.isPending) ? "Sending…" : "Send e-Sign Request"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        </main>
      </div>
    );
  }

  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  return (
    <div className="h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className={cn("transition-all duration-300 h-full overflow-y-auto", mainOffset, mobileTopOffset)}>
      <div className="bg-card border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="font-bold text-lg flex items-center gap-2">
          Jiganto <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full uppercase tracking-wide">e-Sign</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openCompose}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New e-Sign
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">e-Sign Requests</h1>
          <p className="text-muted-foreground">Manage document approvals and track signer progress</p>
        </div>

        {/* KPI cards — clickable to filter */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total documents", val: total, filter: "all", color: "text-foreground" },
            { label: "Awaiting signatures", val: awaiting, filter: "pending", color: "text-amber-600" },
            { label: "Fully signed", val: completed, filter: "completed", color: "text-green-600" },
            { label: "Drafts", val: drafts, filter: "draft", color: "text-muted-foreground" },
          ].map(({ label, val, filter, color }) => (
            <button key={filter} onClick={() => setStatusFilter(statusFilter === filter ? "all" : filter)}
              data-testid={`kpi-${filter}`}
              className={`bg-card border rounded-xl px-5 py-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 
                ${statusFilter === filter ? "border-primary ring-2 ring-primary/20 shadow" : "border-border"}`}>
              <div className={`text-3xl font-bold font-mono ${color}`}>{val}</div>
              <div className="text-sm text-muted-foreground mt-1">{label}</div>
            </button>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-muted p-1 rounded-lg mb-6 w-fit">
          {[
            { key: "all", label: "All" },
            { key: "pending", label: "Awaiting" },
            { key: "completed", label: "Signed" },
            { key: "draft", label: "Drafts" },
          ].map(t => (
            <button key={t.key} onClick={() => setStatusFilter(t.key)}
              data-testid={`tab-${t.key}`}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${statusFilter === t.key ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Document list */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="font-semibold text-lg mb-2">No e-sign requests{statusFilter !== "all" ? " here" : " yet"}</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {statusFilter !== "all" ? "Try a different filter" : "Create your first e-sign request to get started"}
              </p>
              {statusFilter === "all" && (
                <button onClick={openCompose} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                  + New e-Sign
                </button>
              )}
            </div>
          ) : (
            filtered.map((r, i) => {
              const st = STATUS_LABEL[r.status] || { label: r.status, color: "bg-muted text-muted-foreground", icon: "📄" };
              return (
                <div key={r.id} data-testid={`doc-row-${r.id}`}
                  className={`flex items-center gap-4 px-6 py-4 hover:bg-muted/40 transition-colors group ${i < filtered.length - 1 ? "border-b border-border" : ""}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg
                    ${r.status === "completed" ? "bg-green-50" : r.status === "pending" ? "bg-amber-50" : r.status === "draft" ? "bg-muted" : "bg-red-50"}`}>
                    {st.icon}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openDetail(r.id)}>
                    <div className="font-semibold text-sm truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.status === "draft"
                        ? `Last edited ${fmtDate(r.createdAt)} · Not yet sent`
                        : r.status === "completed"
                          ? `Completed ${fmtDate(r.completedAt || "")} · ${signerCount(r)}`
                          : `Sent ${fmtDate(r.sentAt || "")} · ${signerCount(r)}`
                      }
                      {r.deadline && r.status === "pending" && ` · Deadline ${fmtDate(r.deadline)}`}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${st.color}`}>
                    {st.label}
                  </span>
                  <div className="flex gap-2 flex-shrink-0">
                    {r.status === "completed" && (
                      <button onClick={() => openAudit(r.id)} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted">Receipt</button>
                    )}
                    {r.status === "draft" && (
                      <>
                        <button onClick={() => openDetail(r.id)} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted">Edit</button>
                        <button onClick={() => handleSendExisting(r.id)} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Send</button>
                      </>
                    )}
                    {r.status === "pending" && (
                      <>
                        <button onClick={() => openDetail(r.id)} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted">View</button>
                        <button onClick={() => { remindMut.mutate(r.id); toast({ title: "Reminder sent ✓" }); }}
                          className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted">Remind</button>
                      </>
                    )}
                    {r.status !== "completed" && (
                      <button onClick={() => handleDelete(r.id)} className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Delete</button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      </main>
    </div>
  );
}
