import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { SubmitForm } from "@/components/ui/submit-form";

function scopeQuery(base: string, clientId?: number | null, projectId?: number | null) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", String(clientId));
  if (projectId) params.set("projectId", String(projectId));
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

export function ShareDashboardDialog({
  open,
  onOpenChange,
  dashboardId,
  clientId,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: number;
  clientId?: number | null;
  projectId?: number | null;
}) {
  const { toast } = useToast();
  const [userId, setUserId] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");

  const shareMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(scopeQuery(`/api/dashboards/${dashboardId}/share`, clientId, projectId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sharedWithUserId: userId.trim() || undefined,
          permission,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Share failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Dashboard shared" });
      setUserId("");
      onOpenChange(false);
    },
    onError: (err: Error) =>
      toast({ title: "Could not share", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share dashboard</DialogTitle>
          <DialogDescription>Grant view or edit access to another user by their user ID.</DialogDescription>
        </DialogHeader>
        <SubmitForm
          onSubmit={() => shareMutation.mutate()}
          disabled={!userId.trim() || shareMutation.isPending}
          className="space-y-4 py-2"
        >
          <div className="space-y-2">
            <Label htmlFor="share-user">User ID</Label>
            <Input id="share-user" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="uuid…" />
          </div>
          <div className="space-y-2">
            <Label>Permission</Label>
            <Select value={permission} onValueChange={(v) => setPermission(v as "view" | "edit")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">View only</SelectItem>
                <SelectItem value="edit">Can edit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={!userId.trim() || shareMutation.isPending}>
            Share
          </Button>
        </DialogFooter>
        </SubmitForm>
      </DialogContent>
    </Dialog>
  );
}

export function DigestDashboardDialog({
  open,
  onOpenChange,
  dashboardId,
  clientId,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: number;
  clientId?: number | null;
  projectId?: number | null;
}) {
  const { toast } = useToast();
  const [frequency, setFrequency] = useState<"daily" | "weekly">("weekly");
  const [email, setEmail] = useState("");

  const digestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(scopeQuery(`/api/dashboards/${dashboardId}/digest`, clientId, projectId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frequency,
          email: email.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Digest schedule failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Digest scheduled", description: `${frequency} email digest enabled.` });
      onOpenChange(false);
    },
    onError: (err: Error) =>
      toast({ title: "Could not schedule digest", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email digest</DialogTitle>
          <DialogDescription>Receive a summary of this dashboard on a schedule.</DialogDescription>
        </DialogHeader>
        <SubmitForm
          onSubmit={() => digestMutation.mutate()}
          disabled={digestMutation.isPending}
          className="space-y-4 py-2"
        >
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as "daily" | "weekly")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="digest-email">Email (optional)</Label>
            <Input
              id="digest-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Uses your account email if blank"
            />
          </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={digestMutation.isPending}>
            Schedule
          </Button>
        </DialogFooter>
        </SubmitForm>
      </DialogContent>
    </Dialog>
  );
}
