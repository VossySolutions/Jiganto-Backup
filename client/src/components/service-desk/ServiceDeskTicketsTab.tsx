import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus,
  Calendar,
  List,
  Clock,
  Ticket,
  Paperclip,
  Upload,
  ExternalLink
} from "lucide-react";
import {
  ServiceDeskTabLoading,
  ServiceDeskTableSkeleton,
  ServiceDeskErrorState,
  ServiceDeskEmptyState,
  ServiceDeskTableWrap,
} from "./ServiceDeskUi";
import { useToast } from "@/hooks/use-toast";
import type { TicketRow, TicketDetail, TicketType, TicketPriority } from "./types";
import { TYPE_LABELS, PRIORITY_LABELS, slaBadgeClass } from "./types";
import {
  FormDialogShell, FormSection, FieldGrid, FieldLabel, FormDivider,
} from "@/components/ui/form-dialog-shell";

interface Props {
  initialFilters?: { slaFilter?: string; status?: string; priority?: string; type?: string };
  searchQuery?: string;
  apiBase?: string;
  includeDefect?: boolean;
  initialProjectId?: number | null;
  initialTicketId?: number | null;
}

export function ServiceDeskTicketsTab({
  initialFilters,
  searchQuery = "",
  apiBase = "/api/service-desk",
  includeDefect = false,
  initialProjectId = null,
  initialTicketId = null,
}: Props) {
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [typeFilter, setTypeFilter] = useState(initialFilters?.type ?? "all");
  const [priorityFilter, setPriorityFilter] = useState(initialFilters?.priority ?? "all");
  const [statusFilter, setStatusFilter] = useState(initialFilters?.status ?? "all");
  const [slaFilter, setSlaFilter] = useState(initialFilters?.slaFilter ?? "all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [search, setSearch] = useState(searchQuery);

  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (initialFilters?.type) setTypeFilter(initialFilters.type);
    if (initialFilters?.slaFilter) setSlaFilter(initialFilters.slaFilter);
    if (initialFilters?.priority) setPriorityFilter(initialFilters.priority);
    if (initialFilters?.status) setStatusFilter(initialFilters.status);
  }, [initialFilters]);
  const [selectedId, setSelectedId] = useState<number | null>(initialTicketId);
  const [showCreate, setShowCreate] = useState(false);
  const [newTicket, setNewTicket] = useState({
    title: "", type: "incident" as TicketType, priority: "p3" as TicketPriority, description: "",
    projectId: initialProjectId ? String(initialProjectId) : "", defectSeverity: "medium", defectEnvironment: "uat", defectStepsToReproduce: "",
    defectExpectedResult: "", defectActualResult: "", sprintPhase: "",
    defectBuildVersion: "", defectWorkaround: "", defectFixVersion: "",
  });

  useEffect(() => {
    if (initialProjectId) {
      setNewTicket((t) => ({ ...t, projectId: String(initialProjectId) }));
    }
  }, [initialProjectId]);

  useEffect(() => {
    if (initialTicketId) setSelectedId(initialTicketId);
  }, [initialTicketId]);

  const queryParams = new URLSearchParams();
  if (typeFilter !== "all") queryParams.set("type", typeFilter);
  if (priorityFilter !== "all") queryParams.set("priority", priorityFilter);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (slaFilter !== "all") queryParams.set("slaFilter", slaFilter);
  if (agentFilter !== "all") queryParams.set("agentFilter", agentFilter);
  if (search) queryParams.set("search", search);
  if (view === "calendar") queryParams.set("view", "calendar");
  const qs = queryParams.toString();

  const { data: tickets = [], isLoading, isError, refetch, isFetching } = useQuery<TicketRow[]>({
    queryKey: [`${apiBase}/tickets${qs ? `?${qs}` : ""}`],
    staleTime: 30_000,
  });

  const { data: detail, isLoading: detailLoading } = useQuery<TicketDetail>({
    queryKey: [`${apiBase}/tickets/${selectedId}`],
    enabled: selectedId != null,
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title: newTicket.title,
        type: newTicket.type,
        priority: newTicket.priority,
        description: newTicket.description ? { text: newTicket.description } : undefined,
      };
      if (includeDefect && newTicket.type === "defect") {
        body.projectId = newTicket.projectId ? Number(newTicket.projectId) : undefined;
        body.defectSeverity = newTicket.defectSeverity;
        body.defectEnvironment = newTicket.defectEnvironment;
        body.defectStepsToReproduce = newTicket.defectStepsToReproduce;
        body.defectExpectedResult = newTicket.defectExpectedResult;
        body.defectActualResult = newTicket.defectActualResult;
        body.sprintPhase = newTicket.sprintPhase;
        body.defectBuildVersion = newTicket.defectBuildVersion || undefined;
        body.defectWorkaround = newTicket.defectWorkaround || undefined;
        body.defectFixVersion = newTicket.defectFixVersion || undefined;
      }
      const res = await apiRequest("POST", `${apiBase}/tickets`, body);
      return res.json();
    },
    onSuccess: (t) => {
      toast({ title: `Ticket ${t.ref} created` });
      setShowCreate(false);
      setSelectedId(t.id);
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/tickets`] });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/dashboard`] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusMut = useMutation({
    mutationFn: async ({ id, status, reason }: { id: number; status: string; reason?: string }) => {
      const res = await apiRequest("POST", `${apiBase}/tickets/${id}/status`, { status, reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/tickets`] });
      if (selectedId) queryClient.invalidateQueries({ queryKey: [`${apiBase}/tickets/${selectedId}`] });
    },
  });

  const convertMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `${apiBase}/tickets/${id}/convert-to-incident`, { reason: "Post-go-live conversion" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Converted to incident" });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/tickets`] });
      if (selectedId) queryClient.invalidateQueries({ queryKey: [`${apiBase}/tickets/${selectedId}`] });
    },
    onError: (e: Error) => toast({ title: "Conversion failed", description: e.message, variant: "destructive" }),
  });

  const commentMut = useMutation({
    mutationFn: async ({ id, body, isInternal }: { id: number; body: string; isInternal: boolean }) => {
      const res = await apiRequest("POST", `${apiBase}/tickets/${id}/comments`, { body: { text: body }, isInternal });
      return res.json();
    },
    onSuccess: () => {
      if (selectedId) queryClient.invalidateQueries({ queryKey: [`${apiBase}/tickets/${selectedId}`] });
    },
  });

  const timeLogMut = useMutation({
    mutationFn: async ({ id, logDate, hours, description, isBillable }: { id: number; logDate: string; hours: number; description: string; isBillable: boolean }) => {
      const res = await apiRequest("POST", `${apiBase}/tickets/${id}/time-logs`, { logDate, hours, description, isBillable });
      return res.json();
    },
    onSuccess: () => {
      if (selectedId) queryClient.invalidateQueries({ queryKey: [`${apiBase}/tickets/${selectedId}`] });
    },
  });

  const cabMut = useMutation({
    mutationFn: async ({ id, decision, comments }: { id: number; decision: string; comments?: string }) => {
      const res = await apiRequest("POST", `${apiBase}/tickets/${id}/cab-review`, { decision, comments });
      return res.json();
    },
    onSuccess: () => {
      if (selectedId) queryClient.invalidateQueries({ queryKey: [`${apiBase}/tickets/${selectedId}`] });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/tickets`] });
    },
  });

  const uploadMut = useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetchWithAuth("/api/document-files/upload", { method: "POST", body: form });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploaded = await uploadRes.json() as { originalName: string; storedName: string; size: number; mimeType: string };
      const fileUrl = `/uploads/${uploaded.storedName}`;
      const res = await apiRequest("POST", `${apiBase}/tickets/${id}/attachments`, {
        fileName: uploaded.originalName ?? file.name,
        fileUrl,
        fileSize: uploaded.size ?? file.size,
        mimeType: uploaded.mimeType ?? file.type,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Attachment uploaded" });
      if (selectedId) queryClient.invalidateQueries({ queryKey: [`${apiBase}/tickets/${selectedId}`] });
    },
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const [commentText, setCommentText] = useState("");
  const [commentInternal, setCommentInternal] = useState(false);
  const [timeHours, setTimeHours] = useState("1");
  const [timeDesc, setTimeDesc] = useState("");
  const [timeBillable, setTimeBillable] = useState(true);

  return (
    <div className="space-y-4" data-testid="sd-tickets">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2 flex-1">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full xs:w-[130px] sm:w-[140px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full xs:w-[120px] sm:w-[130px] h-9"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={slaFilter} onValueChange={setSlaFilter}>
            <SelectTrigger className="w-full xs:w-[120px] sm:w-[130px] h-9"><SelectValue placeholder="SLA" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SLA</SelectItem>
              <SelectItem value="breached">Breached</SelectItem>
              <SelectItem value="at_risk">At Risk</SelectItem>
              <SelectItem value="within">Within SLA</SelectItem>
            </SelectContent>
          </Select>
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-full xs:w-[130px] sm:w-[140px] h-9"><SelectValue placeholder="Agent" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              <SelectItem value="me">Assigned to me</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Search…" className="w-full sm:w-40 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant={view === "list" ? "default" : "outline"} size="sm" className="flex-1 sm:flex-none" onClick={() => setView("list")}>
            <List className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">List</span>
          </Button>
          <Button variant={view === "calendar" ? "default" : "outline"} size="sm" className="flex-1 sm:flex-none" onClick={() => setView("calendar")}>
            <Calendar className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Calendar</span>
          </Button>
          {tickets.length > 0 && (
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">New</span>
          </Button>
          )}
        </div>
      </div>

      {isFetching && !isLoading && (
        <p className="text-xs text-muted-foreground">Updating…</p>
      )}

      {isLoading ? (
        <ServiceDeskTableSkeleton rows={6} cols={7} />
      ) : isError ? (
        <ServiceDeskErrorState message="Could not load tickets." onRetry={() => refetch()} />
      ) : view === "calendar" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {tickets.length === 0 ? (
            <ServiceDeskEmptyState icon={Ticket} title="No scheduled changes" description="Approved changes with implementation dates appear here." />
          ) : tickets.map((t) => (
            <div
              key={t.id}
              className="p-4 rounded-xl border border-border/50 cursor-pointer hover:border-primary/30"
              onClick={() => setSelectedId(t.id)}
            >
              <div className="flex justify-between mb-2">
                <span className="font-mono text-xs">{t.ref}</span>
                <Badge className={slaBadgeClass(t.slaState.resolution)}>{t.status}</Badge>
              </div>
              <p className="font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {t.changeImplementationDate
                  ? new Date(t.changeImplementationDate).toLocaleDateString()
                  : "No date set"}
              </p>
            </div>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <ServiceDeskEmptyState
          icon={Ticket}
          title="No tickets found"
          description="Create a ticket or adjust your filters."
          action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" />New ticket</Button>}
        />
      ) : (
        <>
          {/* Mobile card list */}
          <div className="grid gap-3 sm:hidden">
            {tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                className="text-left p-4 rounded-xl border border-border/50 hover:border-primary/30 active:bg-muted/50"
                onClick={() => setSelectedId(t.id)}
              >
                <div className="flex justify-between gap-2 mb-1">
                  <span className="font-mono text-xs text-muted-foreground">{t.ref}</span>
                  <Badge className={slaBadgeClass(t.slaState.resolution)}>{t.slaState.resolution}</Badge>
                </div>
                <p className="font-medium text-sm line-clamp-2">{t.title}</p>
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                  <span>{TYPE_LABELS[t.type]}</span>
                  <span>·</span>
                  <span>{t.priority.toUpperCase()}</span>
                  <span>·</span>
                  <span className="capitalize">{t.status.replace(/_/g, " ")}</span>
                </div>
              </button>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block">
          <ServiceDeskTableWrap>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>Agent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No tickets found.</TableCell></TableRow>
            ) : tickets.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => setSelectedId(t.id)}>
                <TableCell className="font-mono text-xs">{t.ref}</TableCell>
                <TableCell className="font-medium max-w-[220px] truncate">{t.title}</TableCell>
                <TableCell>{TYPE_LABELS[t.type]}</TableCell>
                <TableCell>{t.priority.toUpperCase()}</TableCell>
                <TableCell className="capitalize">{t.status.replace(/_/g, " ")}</TableCell>
                <TableCell><Badge className={slaBadgeClass(t.slaState.resolution)}>{t.slaState.resolution}</Badge></TableCell>
                <TableCell>{t.agentName ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
          </ServiceDeskTableWrap>
          </div>
        </>
      )}

      <Sheet open={selectedId != null} onOpenChange={() => setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-4 sm:p-6">
          {detailLoading ? (
            <ServiceDeskTabLoading label="Loading ticket…" />
          ) : detail ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">{detail.ref}</span>
                  {detail.title}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge>{TYPE_LABELS[detail.type]}</Badge>
                  <Badge variant="outline">{PRIORITY_LABELS[detail.priority]}</Badge>
                  <Badge className={slaBadgeClass(detail.slaState.resolution)}>SLA: {detail.slaState.resolution}</Badge>
                </div>

                <Tabs defaultValue="details">
                  <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="comments">Comments</TabsTrigger>
                    <TabsTrigger value="attachments">Attachments</TabsTrigger>
                    <TabsTrigger value="time">Time Logs</TabsTrigger>
                    {detail.type === "change_request" && <TabsTrigger value="cab">CAB</TabsTrigger>}
                    <TabsTrigger value="history">History</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-3">
                    <p className="text-sm text-muted-foreground capitalize">Status: {detail.status.replace(/_/g, " ")}</p>
                    {detail.effectiveResolutionDeadline && (
                      <p className="text-sm flex items-center gap-1"><Clock className="h-3 w-3" />Resolution deadline: {new Date(detail.effectiveResolutionDeadline).toLocaleString()}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {(includeDefect && detail.type === "defect"
                        ? ["assigned", "in_progress", "fix_ready", "retesting", "fixed", "wont_fix", "closed"]
                        : ["in_progress", "pending", "resolved", "closed", "assigned", "completed", "answered", "submitted", "under_review", "cab_approved", "scheduled", "implementing", "implemented"]
                      ).map((s) => (
                        <Button key={s} size="sm" variant="outline" className="capitalize text-xs" onClick={() => statusMut.mutate({ id: detail.id, status: s })}>
                          → {s.replace(/_/g, " ")}
                        </Button>
                      ))}
                    </div>
                    {detail.type === "defect" && (
                      <div className="text-sm space-y-1 bg-muted/50 p-3 rounded-lg">
                        {(detail as TicketDetail & { defectSeverity?: string }).defectSeverity && <p><strong>Severity:</strong> {(detail as TicketDetail & { defectSeverity?: string }).defectSeverity}</p>}
                        {(detail as TicketDetail & { defectEnvironment?: string }).defectEnvironment && <p><strong>Environment:</strong> {(detail as TicketDetail & { defectEnvironment?: string }).defectEnvironment}</p>}
                        {(detail as TicketDetail & { sprintPhase?: string }).sprintPhase && <p><strong>Sprint/Phase:</strong> {(detail as TicketDetail & { sprintPhase?: string }).sprintPhase}</p>}
                        {(detail as TicketDetail & { defectBuildVersion?: string }).defectBuildVersion && <p><strong>Build/Version:</strong> {(detail as TicketDetail & { defectBuildVersion?: string }).defectBuildVersion}</p>}
                        {(detail as TicketDetail & { defectFixVersion?: string }).defectFixVersion && <p><strong>Fix Version:</strong> {(detail as TicketDetail & { defectFixVersion?: string }).defectFixVersion}</p>}
                        {(detail as TicketDetail & { defectWorkaround?: string }).defectWorkaround && <p><strong>Workaround:</strong> {(detail as TicketDetail & { defectWorkaround?: string }).defectWorkaround}</p>}
                        {(detail as TicketDetail & { linkedTestCaseId?: number }).linkedTestCaseId && <p><strong>Test Case:</strong> #{(detail as TicketDetail & { linkedTestCaseId?: number }).linkedTestCaseId}</p>}
                        {includeDefect && apiBase.includes("help-desk") && (
                          <Button size="sm" variant="outline" className="mt-2" onClick={() => convertMut.mutate(detail.id)} disabled={convertMut.isPending}>
                            Convert to Incident (post-go-live)
                          </Button>
                        )}
                      </div>
                    )}
                    {detail.internalNotes && <p className="text-sm bg-muted p-2 rounded-lg">{detail.internalNotes}</p>}
                    {detail.type === "change_request" && (
                      <div className="text-sm space-y-1">
                        {detail.changeJustification && <p><strong>Justification:</strong> {detail.changeJustification}</p>}
                        {detail.changeRiskAssessment && <p><strong>Risk:</strong> {detail.changeRiskAssessment}</p>}
                        {detail.changeRollbackPlan && <p><strong>Rollback:</strong> {detail.changeRollbackPlan}</p>}
                      </div>
                    )}
                    <p className="text-sm">Time logged: {detail.totalTimeLogged ?? 0}h</p>
                  </TabsContent>

                  <TabsContent value="comments" className="space-y-3">
                    {detail.comments.map((c) => (
                      <div key={c.id} className={`p-2 rounded-lg text-sm ${c.isInternal ? "bg-amber-500/10 border border-amber-500/20" : "bg-muted"}`}>
                        {c.isInternal && <Badge variant="outline" className="mb-1 text-xs">Internal</Badge>}
                        <p>{typeof c.body === "object" && c.body && "text" in (c.body as object) ? (c.body as { text: string }).text : JSON.stringify(c.body)}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(c.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                    <Textarea placeholder="Add comment…" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                    <div className="flex items-center gap-2">
                      <Checkbox checked={commentInternal} onCheckedChange={(v) => setCommentInternal(!!v)} id="internal" />
                      <Label htmlFor="internal" className="text-sm">Internal note (hidden from reporter)</Label>
                    </div>
                    <Button size="sm" onClick={() => { commentMut.mutate({ id: detail.id, body: commentText, isInternal: commentInternal }); setCommentText(""); }}>Add comment</Button>
                  </TabsContent>

                  <TabsContent value="attachments" className="space-y-3">
                    {detail.attachments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No attachments yet.</p>
                    ) : detail.attachments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 p-2 bg-muted rounded-lg text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{a.fileName}</span>
                        </div>
                        <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <Button size="sm" variant="ghost" className="h-8 px-2">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      </div>
                    ))}
                    <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border/60 rounded-xl cursor-pointer hover:bg-muted/40 transition-colors">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {uploadMut.isPending ? "Uploading…" : "Click or drop a file to upload"}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploadMut.isPending}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadMut.mutate({ id: detail.id, file });
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </TabsContent>

                  <TabsContent value="time" className="space-y-3">
                    {detail.timeLogs.map((l) => (
                      <div key={l.id} className="flex justify-between gap-2 text-sm p-2 bg-muted rounded-lg">
                        <span className="min-w-0">{l.logDate}: {l.hours}h — {l.description ?? "—"}</span>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant={l.isBillable ? "default" : "secondary"}>{l.isBillable ? "Billable" : "Non-billable"}</Badge>
                          {l.financeTimesheetEntryId && (
                            <Badge variant="outline" className="text-[10px]">Synced to Finance</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label>Hours</Label><Input type="number" step="0.25" value={timeHours} onChange={(e) => setTimeHours(e.target.value)} /></div>
                      <div><Label>Date</Label><Input type="date" defaultValue={new Date().toISOString().slice(0, 10)} id="log-date" /></div>
                    </div>
                    <Textarea placeholder="Description" value={timeDesc} onChange={(e) => setTimeDesc(e.target.value)} />
                    <div className="flex items-center gap-2">
                      <Checkbox checked={timeBillable} onCheckedChange={(v) => setTimeBillable(!!v)} id="billable" />
                      <Label htmlFor="billable">Billable to client</Label>
                    </div>
                    <Button size="sm" onClick={() => {
                      const el = document.getElementById("log-date") as HTMLInputElement;
                      timeLogMut.mutate({ id: detail.id, logDate: el?.value ?? new Date().toISOString().slice(0, 10), hours: Number(timeHours), description: timeDesc, isBillable: timeBillable });
                    }}>Log time</Button>
                  </TabsContent>

                  {detail.type === "change_request" && (
                    <TabsContent value="cab" className="space-y-3">
                      {detail.cabReviews.map((r) => (
                        <div key={r.id} className="text-sm p-2 bg-muted rounded-lg">
                          Reviewer {r.reviewerId.slice(0, 8)}… — {r.decision ?? "pending"}
                          {r.comments && <p className="text-muted-foreground">{r.comments}</p>}
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => cabMut.mutate({ id: detail.id, decision: "approved" })}>Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => cabMut.mutate({ id: detail.id, decision: "rejected", comments: "Rejected by reviewer" })}>Reject</Button>
                        <Button size="sm" variant="outline" onClick={() => cabMut.mutate({ id: detail.id, decision: "more_info" })}>More info</Button>
                      </div>
                    </TabsContent>
                  )}

                  <TabsContent value="history">
                    {detail.statusHistory.map((h) => (
                      <div key={h.id} className="text-sm py-1 border-b border-border/50">
                        <span className="capitalize">{h.fromStatus?.replace(/_/g, " ") ?? "—"} → {h.toStatus.replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground ml-2">{new Date(h.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </div>
            </>
          ) : selectedId ? (
            <ServiceDeskErrorState message="Ticket not found." />
          ) : null}
        </SheetContent>
      </Sheet>

      <FormDialogShell
        open={showCreate}
        onOpenChange={setShowCreate}
        title="New Ticket"
        saveLabel="Create ticket"
        onCancel={() => setShowCreate(false)}
        onSubmit={() => createMut.mutate()}
        saving={createMut.isPending}
        disabled={!newTicket.title}
      >
        <FormSection title="Ticket details">
          <div className="space-y-1.5 mb-3.5"><FieldLabel required>Title</FieldLabel><Input value={newTicket.title} onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })} /></div>
          <FieldGrid className="mb-3.5">
            <div>
              <FieldLabel>Type</FieldLabel>
              <Select value={newTicket.type} onValueChange={(v) => setNewTicket({ ...newTicket, type: v as TicketType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS)
                    .filter(([k]) => includeDefect || k !== "defect")
                    .map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Priority</FieldLabel>
              <Select value={newTicket.priority} onValueChange={(v) => setNewTicket({ ...newTicket, priority: v as TicketPriority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </FieldGrid>
          <div className="space-y-1.5"><FieldLabel>Description</FieldLabel><Textarea value={newTicket.description} onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })} /></div>
        </FormSection>
        {includeDefect && newTicket.type === "defect" && (
          <>
            <FormDivider />
            <FormSection title="Defect details">
              <FieldGrid className="mb-3.5">
                <div>
                  <FieldLabel>Severity</FieldLabel>
                  <Select value={newTicket.defectSeverity} onValueChange={(v) => setNewTicket({ ...newTicket, defectSeverity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["critical", "high", "medium", "low"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Environment</FieldLabel>
                  <Select value={newTicket.defectEnvironment} onValueChange={(v) => setNewTicket({ ...newTicket, defectEnvironment: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["dev", "sit", "uat", "staging", "production"].map((s) => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </FieldGrid>
              <div className="space-y-1.5 mb-3.5"><FieldLabel>Sprint / Phase</FieldLabel><Input value={newTicket.sprintPhase} onChange={(e) => setNewTicket({ ...newTicket, sprintPhase: e.target.value })} /></div>
              <div className="space-y-1.5 mb-3.5"><FieldLabel>Steps to Reproduce</FieldLabel><Textarea value={newTicket.defectStepsToReproduce} onChange={(e) => setNewTicket({ ...newTicket, defectStepsToReproduce: e.target.value })} /></div>
              <div className="space-y-1.5 mb-3.5"><FieldLabel>Expected Result</FieldLabel><Textarea value={newTicket.defectExpectedResult} onChange={(e) => setNewTicket({ ...newTicket, defectExpectedResult: e.target.value })} /></div>
              <div className="space-y-1.5 mb-3.5"><FieldLabel>Actual Result</FieldLabel><Textarea value={newTicket.defectActualResult} onChange={(e) => setNewTicket({ ...newTicket, defectActualResult: e.target.value })} /></div>
              <FieldGrid className="mb-3.5">
                <div><FieldLabel>Build / Version</FieldLabel><Input value={newTicket.defectBuildVersion} onChange={(e) => setNewTicket({ ...newTicket, defectBuildVersion: e.target.value })} /></div>
                <div><FieldLabel>Fix Version</FieldLabel><Input value={newTicket.defectFixVersion} onChange={(e) => setNewTicket({ ...newTicket, defectFixVersion: e.target.value })} /></div>
              </FieldGrid>
              <div className="space-y-1.5"><FieldLabel>Workaround</FieldLabel><Textarea value={newTicket.defectWorkaround} onChange={(e) => setNewTicket({ ...newTicket, defectWorkaround: e.target.value })} rows={2} /></div>
            </FormSection>
          </>
        )}
      </FormDialogShell>
    </div>
  );
}
