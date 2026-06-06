import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DASHBOARD_PATH } from "@shared/app-routes";
import { Sidebar } from "@/components/Sidebar";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { useClientContext, type Client } from "@/hooks/use-client-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Plus,
  MoreHorizontal,
  ArrowRightCircle,
  Pencil,
  Archive,
  Briefcase,
  TrendingUp,
  AlertTriangle,
  Users,
  RefreshCw,
} from "lucide-react";

const PRESET_COLORS = [
  "#185FA5", "#0F6E56", "#993C1D", "#7C3AED",
  "#0EA5E9", "#EC4899", "#F97316", "#10B981",
  "#6366F1", "#EF4444", "#14B8A6", "#F59E0B",
];

function generateShortCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 3) return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  if (words.length === 2) return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

interface ClientFormData {
  name: string;
  shortCode: string;
  color: string;
  industry: string;
  website: string;
  notes: string;
}

const emptyForm: ClientFormData = {
  name: "",
  shortCode: "",
  color: PRESET_COLORS[0],
  industry: "",
  website: "",
  notes: "",
};

function ClientFormDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Client | null;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<ClientFormData>(
    editing
      ? {
          name: editing.name,
          shortCode: editing.shortCode,
          color: editing.color,
          industry: editing.industry || "",
          website: editing.website || "",
          notes: editing.notes || "",
        }
      : emptyForm
  );

  const handleNameChange = (val: string) => {
    setForm(f => ({
      ...f,
      name: val,
      shortCode: editing ? f.shortCode : generateShortCode(val),
    }));
  };

  const createMutation = useMutation({
    mutationFn: (data: Partial<ClientFormData>) =>
      apiRequest("POST", "/api/clients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client created", description: `${form.name} has been added.` });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to create client.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ClientFormData>) =>
      apiRequest("PUT", `/api/clients/${editing!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client updated" });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to update client.", variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      shortCode: form.shortCode.trim() || generateShortCode(form.name),
      color: form.color,
      industry: form.industry.trim() || undefined,
      website: form.website.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    editing ? updateMutation.mutate(payload) : createMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Client" : "Add Client Workspace"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update client details." : "Create a new customer workspace to scope data by client."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Client Name <span className="text-destructive">*</span></Label>
            <Input
              data-testid="input-client-name"
              placeholder="e.g. Apex Global Bank"
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Short Code</Label>
              <Input
                data-testid="input-client-shortcode"
                placeholder="e.g. AGB"
                maxLength={5}
                value={form.shortCode}
                onChange={e => setForm(f => ({ ...f, shortCode: e.target.value.toUpperCase() }))}
              />
              <p className="text-[11px] text-muted-foreground">Up to 5 characters, shown in badge</p>
            </div>
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Input
                data-testid="input-client-industry"
                placeholder="e.g. Financial Services"
                value={form.industry}
                onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Brand Colour</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  data-testid={`color-${c}`}
                  className={cn(
                    "h-7 w-7 rounded-md transition-all",
                    form.color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="h-7 w-7 rounded-md cursor-pointer border border-border"
                title="Custom colour"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input
              data-testid="input-client-website"
              placeholder="https://example.com"
              value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              data-testid="input-client-notes"
              placeholder="Engagement overview, key contacts, context…"
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button
            data-testid="button-save-client"
            onClick={handleSubmit}
            disabled={!form.name.trim() || isPending}
          >
            {isPending ? "Saving…" : editing ? "Save Changes" : "Create Client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-4">
      <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + "20" }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function ClientCard({
  client,
  onEdit,
  onArchive,
}: {
  client: Client;
  onEdit: (c: Client) => void;
  onArchive: (c: Client) => void;
}) {
  const { setActiveClient, activeClient } = useClientContext();
  const [, navigate] = useLocation();
  const isActive = activeClient?.id === client.id;

  const handleEnter = () => {
    setActiveClient(client);
    navigate(DASHBOARD_PATH);
  };

  return (
    <div
      data-testid={`client-card-${client.id}`}
      className={cn(
        "rounded-xl border bg-card p-5 flex flex-col gap-4 transition-all hover:shadow-md",
        isActive && "ring-2"
      )}
      style={isActive ? { ringColor: client.color } : undefined}
    >
      <div className="flex items-start gap-3">
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-sm"
          style={{ backgroundColor: client.color }}
          data-testid={`client-badge-${client.id}`}
        >
          {client.shortCode}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate" data-testid={`client-name-${client.id}`}>{client.name}</h3>
            {isActive && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: client.color, color: client.color }}>
                Active
              </Badge>
            )}
          </div>
          {client.industry && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{client.industry}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" data-testid={`client-menu-${client.id}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={handleEnter} className="gap-2 cursor-pointer">
              <ArrowRightCircle className="h-4 w-4" />
              Enter workspace
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(client)} className="gap-2 cursor-pointer">
              <Pencil className="h-4 w-4" />
              Edit details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onArchive(client)}
              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
            >
              <Archive className="h-4 w-4" />
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-muted-foreground">Projects</p>
          <p className="font-semibold mt-0.5">{client.projectCount ?? 0}</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-muted-foreground">At Risk</p>
          <p className={cn("font-semibold mt-0.5", (client.atRiskCount ?? 0) > 0 ? "text-destructive" : "")}>
            {client.atRiskCount ?? 0}
          </p>
        </div>
      </div>

      <Button
        size="sm"
        className="w-full gap-2 text-white"
        style={{ backgroundColor: client.color }}
        onClick={handleEnter}
        data-testid={`button-enter-${client.id}`}
      >
        <ArrowRightCircle className="h-4 w-4" />
        {isActive ? "Currently viewing" : "Enter workspace"}
      </Button>
    </div>
  );
}

export default function ClientsPage() {
  const { mainOffset, mobileTopOffset } = useShellLayout();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"active" | "archived" | "all">("active");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [archiving, setArchiving] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/clients/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client archived" });
      setArchiving(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to archive client.", variant: "destructive" }),
  });

  const displayed = clients.filter(c => {
    if (filter === "active") return c.status === "active";
    if (filter === "archived") return c.status === "archived";
    return true;
  });

  const activeCount = clients.filter(c => c.status === "active").length;
  const atRiskTotal = clients.reduce((sum, c) => sum + (c.atRiskCount ?? 0), 0);
  const totalProjects = clients.reduce((sum, c) => sum + (c.projectCount ?? 0), 0);

  const openForm = (client?: Client) => {
    setEditing(client ?? null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300", mainOffset, mobileTopOffset)}>
        <div className="flex-1 overflow-y-auto">
          {/* Page header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Client Workspaces</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Manage customer engagements and switch between isolated client views
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => openForm()}
                  data-testid="button-add-client"
                >
                  <Plus className="h-4 w-4" />
                  Add Client
                </Button>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Total Clients" value={clients.length} icon={Briefcase} color="#185FA5" />
              <KpiCard label="Active Engagements" value={activeCount} icon={TrendingUp} color="#0F6E56" />
              <KpiCard label="Projects Tracked" value={totalProjects} icon={Users} color="#7C3AED" />
              <KpiCard label="At-Risk Projects" value={atRiskTotal} icon={AlertTriangle} color={atRiskTotal > 0 ? "#EF4444" : "#6B7280"} />
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-1 border-b">
              {(["active", "archived", "all"] as const).map(f => (
                <button
                  key={f}
                  data-testid={`filter-${f}`}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px capitalize",
                    filter === f
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f}
                  {f !== "all" && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({clients.filter(c => c.status === f).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Client grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-xl border bg-card p-5 h-48 animate-pulse" />
                ))}
              </div>
            ) : displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Briefcase className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-1">
                  {filter === "archived" ? "No archived clients" : "No client workspaces yet"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                  {filter === "archived"
                    ? "Archived clients will appear here."
                    : "Add a client workspace to isolate projects, tasks, and CRM data for each customer engagement."}
                </p>
                {filter !== "archived" && (
                  <Button size="sm" className="gap-2" onClick={() => openForm()}>
                    <Plus className="h-4 w-4" />
                    Add client
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayed.map(client => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    onEdit={openForm}
                    onArchive={setArchiving}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create / Edit modal */}
      {showForm && (
        <ClientFormDialog
          open={showForm}
          onClose={closeForm}
          editing={editing}
        />
      )}

      {/* Archive confirmation */}
      <AlertDialog open={!!archiving} onOpenChange={v => !v && setArchiving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {archiving?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This client workspace will be hidden from the switcher. All associated data is preserved and can be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => archiving && archiveMutation.mutate(archiving.id)}
              data-testid="button-confirm-archive"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
