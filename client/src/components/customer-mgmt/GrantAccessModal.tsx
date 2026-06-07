import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  GRANT_TYPE_DESCRIPTIONS,
  type AccessGrantType,
} from "@shared/models/customer-mgmt";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PermissionAlert, GrantAuditNotice, canGrantCommercialAccess } from "@/components/customer-mgmt/CustomerMgmtUi";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface GrantAccessTarget {
  customerId: string;
  customerSlug?: string;
  customerName: string;
  subtitle?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: GrantAccessTarget | null;
}

const GRANT_TYPES: { key: AccessGrantType; label: string }[] = [
  { key: "trial_extension", label: "Trial extension" },
  { key: "free_access", label: "Free access period" },
  { key: "beta_programme", label: "Beta programme" },
];

export function GrantAccessModal({ open, onOpenChange, target }: Props) {
  const { toast } = useToast();
  const { platformRole, isJigantoStaff } = usePermissions();
  const canGrantCommercial = canGrantCommercialAccess(platformRole, isJigantoStaff);
  const [grantType, setGrantType] = useState<AccessGrantType>("trial_extension");
  const [duration, setDuration] = useState("2 weeks");
  const [startWhen, setStartWhen] = useState("From current expiry");
  const [reason, setReason] = useState("");
  const [notifyCustomer, setNotifyCustomer] = useState(true);

  useEffect(() => {
    if (open) {
      setGrantType("trial_extension");
      setDuration("2 weeks");
      setStartWhen("From current expiry");
      setReason("");
      setNotifyCustomer(true);
    }
  }, [open, target?.customerId]);

  const grantMut = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("No customer selected");
      const res = await apiRequest("POST", "/api/customer-mgmt/grants", {
        customerId: target.customerId,
        customerName: target.customerName,
        grantType,
        durationLabel: duration,
        startLabel: startWhen,
        reason: reason.trim(),
        notifyCustomer,
      });
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/customer-mgmt/dashboard"] });
      if (target?.customerSlug) {
        void queryClient.invalidateQueries({
          queryKey: ["/api/customer-mgmt/customers", target.customerSlug],
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: ["/api/customer-mgmt/customers"] });
      }
      toast({ title: "Access grant applied", description: "Logged to audit trail." });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Grant failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Grant trial extension / free access</DialogTitle>
          <DialogDescription>
            {target
              ? `${target.customerName}${target.subtitle ? ` · ${target.subtitle}` : ""}`
              : "Select a customer"}
          </DialogDescription>
        </DialogHeader>

        {canGrantCommercial ? <GrantAuditNotice /> : <PermissionAlert />}

        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Extension type
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
              {GRANT_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={cn(
                    "rounded-md border px-2 py-2 text-[11px] font-semibold transition-colors",
                    grantType === t.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/50",
                  )}
                  onClick={() => setGrantType(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">{GRANT_TYPE_DESCRIPTIONS[grantType]}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["1 week", "2 weeks", "1 month", "2 months", "3 months", "Custom"].map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Starts</Label>
              <Select value={startWhen} onValueChange={setStartWhen}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Starting immediately", "From current expiry", "Custom date"].map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Reason (required — stored in audit log)</Label>
            <Textarea
              className="mt-1 min-h-[72px]"
              placeholder='e.g. Prospect requested additional 2 weeks to complete internal evaluation process.'
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={notifyCustomer} onCheckedChange={setNotifyCustomer} />
            <span className="text-sm text-muted-foreground">
              Notify customer by email with new expiry date
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!target || reason.trim().length < 3 || grantMut.isPending}
            onClick={() => grantMut.mutate()}
          >
            {grantMut.isPending ? "Applying…" : "Apply extension"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
