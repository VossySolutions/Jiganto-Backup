import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import { SubmitForm } from "@/components/ui/submit-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CLIENT_INDUSTRY_OPTIONS, CLIENT_PRESET_COLORS } from "@shared/client-workspace-modules";
import { isValidUrl } from "@/lib/client-workspace-utils";
import type { ClientFormData, ClientWorkspace } from "./types";

function generateShortCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 3) return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  if (words.length === 2) return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

const emptyForm: ClientFormData = {
  name: "",
  shortCode: "",
  color: CLIENT_PRESET_COLORS[0],
  industry: "",
  website: "",
  notes: "",
  engagementStatus: "active",
  contractStart: "",
  contractEnd: "",
  accountManagerId: "",
  tags: "",
};

function toForm(client: ClientWorkspace): ClientFormData {
  return {
    name: client.name,
    shortCode: client.shortCode,
    color: client.color,
    industry: client.industry || "",
    website: client.website || "",
    notes: client.notes || "",
    engagementStatus: client.engagementStatus || "active",
    contractStart: client.contractStart || "",
    contractEnd: client.contractEnd || "",
    accountManagerId: client.accountManagerId || "",
    tags: client.tags || "",
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  editing: ClientWorkspace | null;
  siMembers?: { userId: string; label: string }[];
}

export function ClientFormDialog({ open, onClose, editing, siMembers = [] }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<ClientFormData>(editing ? toForm(editing) : emptyForm);
  const [websiteError, setWebsiteError] = useState("");

  useEffect(() => {
    if (open) setForm(editing ? toForm(editing) : emptyForm);
  }, [open, editing]);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/clients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients/kpis"] });
      toast({
        title: "Client workspace created",
        description: "Click Enter workspace to begin.",
      });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to create client.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("PUT", `/api/clients/${editing!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients/kpis"] });
      toast({ title: "Client updated" });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to update client.", variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleNameChange = (val: string) => {
    setForm((f) => ({
      ...f,
      name: val,
      shortCode: editing ? f.shortCode : generateShortCode(val),
    }));
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (form.website.trim() && !isValidUrl(form.website)) {
      setWebsiteError("Enter a valid URL");
      return;
    }
    const payload: Record<string, unknown> = {
      name: form.name.trim().slice(0, 100),
      shortCode: form.shortCode.trim() || generateShortCode(form.name),
      color: form.color,
      industry: form.industry.trim() || undefined,
      website: form.website.trim() || undefined,
      notes: form.notes.trim() || undefined,
      engagementStatus: form.engagementStatus,
      contractStart: form.contractStart || undefined,
      contractEnd: form.contractEnd || undefined,
      accountManagerId: form.accountManagerId || undefined,
      tags: form.tags.trim() || undefined,
    };
    editing ? updateMutation.mutate(payload) : createMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <SubmitForm onSubmit={handleSubmit} disabled={!form.name.trim() || isPending}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Client Workspace" : "Add Client Workspace"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update workspace details and engagement settings."
                : "Create a new customer workspace to scope data by client."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Client Name <span className="text-destructive">*</span></Label>
              <Input
                data-testid="input-client-name"
                placeholder="e.g. Apex Global Bank"
                maxLength={100}
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Short Code</Label>
                <Input
                  placeholder="e.g. AGB"
                  maxLength={5}
                  value={form.shortCode}
                  onChange={(e) => setForm((f) => ({ ...f, shortCode: e.target.value.toUpperCase() }))}
                />
                <p className="text-[11px] text-muted-foreground">Up to 5 characters, shown in badge</p>
              </div>
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Select
                  value={form.industry || "__none__"}
                  onValueChange={(v) => setForm((f) => ({ ...f, industry: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {CLIENT_INDUSTRY_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Brand Colour</Label>
              <div className="flex flex-wrap gap-2">
                {CLIENT_PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "h-7 w-7 rounded-md transition-all",
                      form.color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-7 w-7 rounded-md cursor-pointer border border-border"
                  title="Custom colour"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input
                placeholder="https://example.com"
                value={form.website}
                onChange={(e) => {
                  setForm((f) => ({ ...f, website: e.target.value }));
                  setWebsiteError("");
                }}
                onBlur={() => {
                  if (form.website.trim() && !isValidUrl(form.website)) {
                    setWebsiteError("Enter a valid URL");
                  }
                }}
              />
              {websiteError && <p className="text-xs text-destructive">{websiteError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Engagement overview, key contacts, context…"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {editing && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Engagement status</Label>
                    <Select
                      value={form.engagementStatus}
                      onValueChange={(v) => setForm((f) => ({ ...f, engagementStatus: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Account manager</Label>
                    <Select
                      value={form.accountManagerId || "__none__"}
                      onValueChange={(v) => setForm((f) => ({ ...f, accountManagerId: v === "__none__" ? "" : v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {siMembers.map((m) => (
                          <SelectItem key={m.userId} value={m.userId}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Engagement start</Label>
                    <Input type="date" value={form.contractStart} onChange={(e) => setForm((f) => ({ ...f, contractStart: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Engagement end</Label>
                    <Input type="date" value={form.contractEnd} onChange={(e) => setForm((f) => ({ ...f, contractEnd: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Tags</Label>
                  <Input
                    placeholder="ERP, SAP, NHS, Public Sector"
                    value={form.tags}
                    onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="w-full sm:w-auto">Cancel</Button>
            <Button type="submit" data-testid="button-save-client" className="w-full sm:w-auto" disabled={isPending}>
              {isPending ? "Saving…" : editing ? "Save Changes" : "Create Client"}
            </Button>
          </DialogFooter>
        </SubmitForm>
      </DialogContent>
    </Dialog>
  );
}
