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
  FormDialogShell,
  FormSection,
  FieldGrid,
  FieldLabel,
  FormDivider,
} from "@/components/ui/form-dialog-shell";
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
    <FormDialogShell
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={editing ? "Edit Client Workspace" : "Add Client Workspace"}
      subtitle={editing ? "Update workspace details and engagement settings." : "Create a new customer workspace to scope data by client."}
      saveLabel={isPending ? "Saving..." : editing ? "Save Changes" : "Create Client"}
      onCancel={onClose}
      onSubmit={handleSubmit}
      saving={isPending}
      disabled={!form.name.trim()}
      saveTestId="button-save-client"
      size="md"
    >
      <FormSection title="Workspace profile">
        <div className="space-y-1.5 mb-3.5">
          <FieldLabel required>Client Name</FieldLabel>
              <Input
                data-testid="input-client-name"
                placeholder="e.g. Apex Global Bank"
                maxLength={100}
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
        </div>

            <FieldGrid className="mb-3.5">
              <div className="space-y-1.5">
                <FieldLabel>Short Code</FieldLabel>
                <Input
                  placeholder="e.g. AGB"
                  maxLength={5}
                  value={form.shortCode}
                  onChange={(e) => setForm((f) => ({ ...f, shortCode: e.target.value.toUpperCase() }))}
                />
                <p className="text-[11px] text-muted-foreground">Up to 5 characters, shown in badge</p>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Industry</FieldLabel>
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
            </FieldGrid>

            <div className="space-y-1.5 mb-3.5">
              <FieldLabel>Brand Colour</FieldLabel>
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

            <div className="space-y-1.5 mb-3.5">
              <FieldLabel>Website</FieldLabel>
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
              <FieldLabel>Notes</FieldLabel>
              <Textarea
                placeholder="Engagement overview, key contacts, context…"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
      </FormSection>
            {editing && (
              <>
                <FormDivider />
                <FormSection title="Engagement settings">
                <FieldGrid className="mb-3.5">
                  <div className="space-y-1.5">
                    <FieldLabel>Engagement status</FieldLabel>
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
                    <FieldLabel>Account manager</FieldLabel>
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
                </FieldGrid>
                <FieldGrid className="mb-3.5">
                  <div className="space-y-1.5">
                    <FieldLabel>Engagement start</FieldLabel>
                    <Input type="date" value={form.contractStart} onChange={(e) => setForm((f) => ({ ...f, contractStart: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Engagement end</FieldLabel>
                    <Input type="date" value={form.contractEnd} onChange={(e) => setForm((f) => ({ ...f, contractEnd: e.target.value }))} />
                  </div>
                </FieldGrid>
                <div className="space-y-1.5">
                  <FieldLabel>Tags</FieldLabel>
                  <Input
                    placeholder="ERP, SAP, NHS, Public Sector"
                    value={form.tags}
                    onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  />
                </div>
                </FormSection>
              </>
            )}
    </FormDialogShell>
  );
}
