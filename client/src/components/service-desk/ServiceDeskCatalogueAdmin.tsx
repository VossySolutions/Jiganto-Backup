import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  FormDialogShell, FormSection, FieldGrid, FieldLabel,
} from "@/components/ui/form-dialog-shell";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Settings2, Plus, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ServiceCategory, ServiceItem, AgentTeam } from "./types";
import { PRIORITY_LABELS } from "./types";
import { SD_ACCENT } from "./ServiceDeskUi";

interface Props {
  categories: ServiceCategory[];
  services: ServiceItem[];
}

const AVAILABILITY = [
  { value: "business_hours", label: "Business hours" },
  { value: "24x7", label: "24×7" },
  { value: "best_effort", label: "Best effort" },
];

const VISIBILITY = [
  { value: "all_clients", label: "All clients" },
  { value: "internal_only", label: "Internal only" },
  { value: "specific_clients", label: "Specific clients" },
];

const COST_MODELS = [
  { value: "included", label: "Included in contract" },
  { value: "billable", label: "Billable" },
  { value: "fixed_fee", label: "Fixed fee" },
];

function defaultSlas(svc?: ServiceItem) {
  const priorities = ["p1", "p2", "p3", "p4"] as const;
  return priorities.map((p) => {
    const existing = svc?.slas.find((s) => s.priority === p);
    return {
      priority: p,
      responseHours: existing ? Number(existing.responseHours) : p === "p1" ? 1 : p === "p2" ? 4 : p === "p3" ? 8 : 24,
      resolutionHours: existing ? Number(existing.resolutionHours) : p === "p1" ? 4 : p === "p2" ? 8 : p === "p3" ? 24 : 72,
    };
  });
}

export function ServiceDeskCatalogueAdmin({ categories, services }: Props) {
  const { toast } = useToast();
  const [manageOpen, setManageOpen] = useState(false);
  const [catDialog, setCatDialog] = useState<ServiceCategory | "new" | null>(null);
  const [svcDialog, setSvcDialog] = useState<ServiceItem | "new" | null>(null);

  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");

  const [svcName, setSvcName] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [svcCategoryId, setSvcCategoryId] = useState<string>("__none");
  const [svcTeamId, setSvcTeamId] = useState<string>("__none");
  const [svcAvailability, setSvcAvailability] = useState("business_hours");
  const [svcVisibility, setSvcVisibility] = useState("all_clients");
  const [svcCostModel, setSvcCostModel] = useState("included");
  const [svcActive, setSvcActive] = useState(true);
  const [svcSlas, setSvcSlas] = useState(defaultSlas());

  const { data: teams = [] } = useQuery<AgentTeam[]>({
    queryKey: ["/api/service-desk/teams"],
    enabled: manageOpen || svcDialog != null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/service-desk/catalogue"] });
    queryClient.invalidateQueries({ queryKey: ["/api/service-desk/catalogue?admin=1"] });
  };

  const catMut = useMutation({
    mutationFn: async () => {
      const body = { name: catName, description: catDesc || undefined };
      if (catDialog && catDialog !== "new") {
        const res = await apiRequest("PATCH", `/api/service-desk/categories/${catDialog.id}`, body);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/service-desk/categories", body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Category saved" });
      setCatDialog(null);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const svcMut = useMutation({
    mutationFn: async () => {
      const body = {
        name: svcName,
        description: svcDesc || undefined,
        categoryId: svcCategoryId === "__none" ? null : Number(svcCategoryId),
        ownerTeamId: svcTeamId === "__none" ? null : Number(svcTeamId),
        availability: svcAvailability,
        visibility: svcVisibility,
        costModel: svcCostModel,
        isActive: svcActive,
        slas: svcSlas,
      };
      if (svcDialog && svcDialog !== "new") {
        const res = await apiRequest("PATCH", `/api/service-desk/services/${svcDialog.id}`, body);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/service-desk/services", body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Service saved" });
      setSvcDialog(null);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const openCat = (cat: ServiceCategory | "new") => {
    if (cat === "new") {
      setCatName("");
      setCatDesc("");
    } else {
      setCatName(cat.name);
      setCatDesc(cat.description ?? "");
    }
    setCatDialog(cat);
  };

  const openSvc = (svc: ServiceItem | "new") => {
    if (svc === "new") {
      setSvcName("");
      setSvcDesc("");
      setSvcCategoryId("__none");
      setSvcTeamId("__none");
      setSvcAvailability("business_hours");
      setSvcVisibility("all_clients");
      setSvcCostModel("included");
      setSvcActive(true);
      setSvcSlas(defaultSlas());
    } else {
      setSvcName(svc.name);
      setSvcDesc(svc.description ?? "");
      setSvcCategoryId(svc.categoryId ? String(svc.categoryId) : "__none");
      setSvcTeamId(svc.ownerTeamId ? String(svc.ownerTeamId) : "__none");
      setSvcAvailability(svc.availability);
      setSvcVisibility(svc.visibility);
      setSvcCostModel(svc.costModel ?? "included");
      setSvcActive((svc as ServiceItem & { isActive?: boolean }).isActive !== false);
      setSvcSlas(defaultSlas(svc));
    }
    setSvcDialog(svc);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Settings2 className="h-4 w-4" />
          Catalogue administration
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setManageOpen((v) => !v)}>
            {manageOpen ? "Hide admin" : "Manage catalogue"}
          </Button>
          {manageOpen && (
            <>
              <Button size="sm" variant="outline" onClick={() => openCat("new")}>
                <Plus className="h-3 w-3 mr-1" />Category
              </Button>
              <Button size="sm" style={{ backgroundColor: SD_ACCENT }} onClick={() => openSvc("new")}>
                <Plus className="h-3 w-3 mr-1" />Service
              </Button>
            </>
          )}
        </div>
      </div>

      {manageOpen && (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Service</th>
                <th className="text-left p-2 font-medium hidden sm:table-cell">Category</th>
                <th className="text-left p-2 font-medium hidden md:table-cell">Team</th>
                <th className="text-left p-2 font-medium">Status</th>
                <th className="p-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-t border-border/40">
                  <td className="p-2">{s.name}</td>
                  <td className="p-2 hidden sm:table-cell text-muted-foreground">{s.categoryName ?? "—"}</td>
                  <td className="p-2 hidden md:table-cell text-muted-foreground">{s.teamName ?? "—"}</td>
                  <td className="p-2">
                    {(s as ServiceItem & { isActive?: boolean }).isActive === false ? "Inactive" : "Active"}
                  </td>
                  <td className="p-2">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openSvc(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {categories.map((c) => (
                <tr key={`cat-${c.id}`} className="border-t border-border/40 bg-muted/20">
                  <td className="p-2 font-medium" colSpan={3}>{c.name}</td>
                  <td className="p-2 text-muted-foreground text-xs">Category</td>
                  <td className="p-2">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openCat(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormDialogShell
        open={catDialog != null}
        onOpenChange={() => setCatDialog(null)}
        title={catDialog === "new" ? "New category" : "Edit category"}
        saveLabel="Save category"
        onCancel={() => setCatDialog(null)}
        onSubmit={() => catMut.mutate()}
        saving={catMut.isPending}
        disabled={!catName}
      >
        <FormSection title="Category">
          <div className="space-y-1.5 mb-3.5"><FieldLabel required>Name</FieldLabel><Input value={catName} onChange={(e) => setCatName(e.target.value)} /></div>
          <div className="space-y-1.5"><FieldLabel>Description</FieldLabel><Textarea value={catDesc} onChange={(e) => setCatDesc(e.target.value)} rows={2} /></div>
        </FormSection>
      </FormDialogShell>

      <FormDialogShell
        open={svcDialog != null}
        onOpenChange={() => setSvcDialog(null)}
        title={svcDialog === "new" ? "New service" : "Edit service"}
        subtitle="Configure SLA targets per priority and routing team."
        saveLabel="Save service"
        onCancel={() => setSvcDialog(null)}
        onSubmit={() => svcMut.mutate()}
        saving={svcMut.isPending}
        disabled={!svcName}
        size="lg"
      >
        <FormSection title="Service details">
          <div className="space-y-1.5 mb-3.5"><FieldLabel required>Name</FieldLabel><Input value={svcName} onChange={(e) => setSvcName(e.target.value)} /></div>
          <div className="space-y-1.5 mb-3.5"><FieldLabel>Description</FieldLabel><Textarea value={svcDesc} onChange={(e) => setSvcDesc(e.target.value)} rows={2} /></div>
          <FieldGrid className="mb-3.5">
            <div>
              <FieldLabel>Category</FieldLabel>
              <Select value={svcCategoryId} onValueChange={setSvcCategoryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Owner team</FieldLabel>
              <Select value={svcTeamId} onValueChange={setSvcTeamId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Unassigned</SelectItem>
                  {teams.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </FieldGrid>
          <FieldGrid className="mb-3.5">
            <div>
              <FieldLabel>Availability</FieldLabel>
              <Select value={svcAvailability} onValueChange={setSvcAvailability}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AVAILABILITY.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>Visibility</FieldLabel>
              <Select value={svcVisibility} onValueChange={setSvcVisibility}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VISIBILITY.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </FieldGrid>
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel>Cost model</FieldLabel>
            <Select value={svcCostModel} onValueChange={setSvcCostModel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COST_MODELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 mb-3.5">
            <Switch checked={svcActive} onCheckedChange={setSvcActive} id="svc-active" />
            <Label htmlFor="svc-active">Active in catalogue</Label>
          </div>
          <div className="space-y-2">
            <FieldLabel>SLA targets (hours)</FieldLabel>
            {svcSlas.map((s, i) => (
              <div key={s.priority} className="grid grid-cols-3 gap-2 items-center text-sm">
                <span>{PRIORITY_LABELS[s.priority as keyof typeof PRIORITY_LABELS]}</span>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="Response"
                  value={s.responseHours}
                  onChange={(e) => {
                    const next = [...svcSlas];
                    next[i] = { ...next[i], responseHours: Number(e.target.value) };
                    setSvcSlas(next);
                  }}
                />
                <Input
                  type="number"
                  step="0.5"
                  placeholder="Resolution"
                  value={s.resolutionHours}
                  onChange={(e) => {
                    const next = [...svcSlas];
                    next[i] = { ...next[i], resolutionHours: Number(e.target.value) };
                    setSvcSlas(next);
                  }}
                />
              </div>
            ))}
          </div>
        </FormSection>
      </FormDialogShell>
    </>
  );
}
