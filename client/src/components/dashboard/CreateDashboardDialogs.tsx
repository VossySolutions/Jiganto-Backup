import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DashboardLayout } from "@shared/models/dashboard";
import { customDashboardId, type DashboardType } from "@/hooks/use-dashboard-selector";
import { SubmitForm } from "@/components/ui/submit-form";

function scopeQuery(base: string, clientId?: number | null, projectId?: number | null) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", String(clientId));
  if (projectId) params.set("projectId", String(projectId));
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

export function CreateBespokeDashboardDialog({
  open,
  onOpenChange,
  onCreated,
  clientId,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: DashboardType) => void;
  clientId?: number | null;
  projectId?: number | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [layout, setLayout] = useState<DashboardLayout>("2-col");

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(scopeQuery("/api/dashboards", clientId, projectId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), layout }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Failed to create dashboard");
      }
      return res.json() as Promise<{ id: number }>;
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith(`/api/dashboards/${created.id}`),
      });
      toast({ title: "Dashboard created" });
      onCreated(customDashboardId(created.id));
      setName("");
      onOpenChange(false);
    },
    onError: (err: Error) =>
      toast({ title: "Could not create dashboard", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create custom dashboard</DialogTitle>
          <DialogDescription>Build a bespoke view with widgets from any module.</DialogDescription>
        </DialogHeader>
        <SubmitForm
          onSubmit={() => createMutation.mutate()}
          disabled={name.trim().length < 2 || createMutation.isPending}
          className="space-y-4 py-2"
        >
          <div className="space-y-2">
            <Label htmlFor="dash-name">Name</Label>
            <Input
              id="dash-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My delivery dashboard"
            />
          </div>
          <div className="space-y-2">
            <Label>Layout</Label>
            <Select value={layout} onValueChange={(v) => setLayout(v as DashboardLayout)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-col">Single column</SelectItem>
                <SelectItem value="2-col">Two columns</SelectItem>
                <SelectItem value="3-col">Three columns</SelectItem>
              </SelectContent>
            </Select>
          </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={name.trim().length < 2 || createMutation.isPending}
          >
            Create
          </Button>
        </DialogFooter>
        </SubmitForm>
      </DialogContent>
    </Dialog>
  );
}

export function AiDashboardDialog({
  open,
  onOpenChange,
  onCreated,
  clientId,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: DashboardType) => void;
  clientId?: number | null;
  projectId?: number | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState(
    "Executive overview with project health, open tasks, CRM pipeline, and finance KPIs.",
  );

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(scopeQuery("/api/dashboard/ai/generate", clientId, projectId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "AI generation failed");
      }
      return res.json() as Promise<{ dashboardId: number }>;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith(`/api/dashboards/${result.dashboardId}`),
      });
      toast({ title: "AI dashboard ready" });
      onCreated(customDashboardId(result.dashboardId));
      onOpenChange(false);
    },
    onError: (err: Error) =>
      toast({ title: "AI builder unavailable", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>AI dashboard builder</DialogTitle>
          <DialogDescription>
            Describe the dashboard you want. We will pick widgets and layout automatically.
          </DialogDescription>
        </DialogHeader>
        <SubmitForm
          onSubmit={() => generateMutation.mutate()}
          disabled={prompt.trim().length < 8 || generateMutation.isPending}
        >
          <div className="py-2">
            <Label htmlFor="ai-prompt">Prompt</Label>
            <textarea
              id="ai-prompt"
              className="mt-2 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={prompt.trim().length < 8 || generateMutation.isPending}
            >
              {generateMutation.isPending ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </SubmitForm>
      </DialogContent>
    </Dialog>
  );
}
