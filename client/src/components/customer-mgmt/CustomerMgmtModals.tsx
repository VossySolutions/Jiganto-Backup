import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type {
  BetaProgramme,
  CommercialPlanTier,
  CustomerDetail,
  DiscountRule,
  PricingPlan,
} from "@shared/models/customer-mgmt";
import { planBadgeClass } from "@shared/models/customer-mgmt";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OrgAvatar, AsyncButton, invalidateCommercialQueries } from "@/components/customer-mgmt/CustomerMgmtUi";
import { cn } from "@/lib/utils";

const PROGRAMME_TYPES = [
  "Beta testing — feature access in exchange for structured feedback",
  "Early access — paid customers get new features first",
  "Design partner — deep involvement, significant free credit",
  "Market research — free access in exchange for research participation",
];

const PLAN_OPTIONS: { value: CommercialPlanTier; label: string }[] = [
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "enterprise", label: "Enterprise" },
];

export function CreateProgrammeModal({
  open,
  onOpenChange,
  blocked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocked?: boolean;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [programmeType, setProgrammeType] = useState(PROGRAMME_TYPES[0]!);
  const [compensation, setCompensation] = useState("3 months free");
  const [planScope, setPlanScope] = useState("Growth & Enterprise only");
  const [maxParticipants, setMaxParticipants] = useState("10");
  const [enrolment, setEnrolment] = useState("Admin approval required");
  const [endsAt, setEndsAt] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setProgrammeType(PROGRAMME_TYPES[0]!);
      setCompensation("3 months free");
      setPlanScope("Growth & Enterprise only");
      setMaxParticipants("10");
      setEnrolment("Admin approval required");
      setEndsAt("");
    }
  }, [open]);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/customer-mgmt/programmes", {
        name: name.trim(),
        programmeType,
        compensation,
        planScope,
        maxParticipants: Number(maxParticipants) || 10,
        enrolment,
        endsAt: endsAt.trim() || "31 Dec 2026",
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateCommercialQueries();
      toast({ title: "Programme created", description: "Participants can now be enrolled." });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Could not create programme", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create beta / early access programme</DialogTitle>
          <DialogDescription>
            Give a group of organisations free access in exchange for testing, feedback, or market
            research
          </DialogDescription>
        </DialogHeader>
        {blocked && (
          <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg px-3 py-2">
            Free access cost is over your configured threshold. Enable programme creation in Settings
            or reduce active programmes first.
          </p>
        )}
        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Programme name</Label>
            <Input
              className="mt-1"
              placeholder="e.g. Q3 Beta Cohort · Whiteboard Early Access"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Programme type</Label>
            <Select value={programmeType} onValueChange={setProgrammeType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROGRAMME_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Compensation offered</Label>
              <Select value={compensation} onValueChange={setCompensation}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["1 month free", "2 months free", "3 months free", "Full programme duration free", "Custom credit"].map(
                    (o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Applies to plans</Label>
              <Select value={planScope} onValueChange={setPlanScope}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["All plans", "Starter only", "Growth & Enterprise only"].map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Max participants</Label>
              <Input
                className="mt-1"
                placeholder="e.g. 10"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Enrolment</Label>
              <Select value={enrolment} onValueChange={setEnrolment}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Invite only", "Admin approval required", "Self-signup with invite code"].map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Programme end date
            </Label>
            <Input
              className="mt-1"
              placeholder="e.g. 31 Aug 2026"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <AsyncButton
            pending={createMut.isPending}
            disabled={blocked || name.trim().length < 3}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? "Creating…" : "Create programme"}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ManageParticipantsModal({
  open,
  onOpenChange,
  programme,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programme: BetaProgramme | null;
}) {
  const { toast } = useToast();
  const [newInitials, setNewInitials] = useState("");

  const addMut = useMutation({
    mutationFn: async (initials: string) => {
      const res = await apiRequest(
        "POST",
        `/api/customer-mgmt/programmes/${programme!.id}/participants`,
        { initials },
      );
      return res.json();
    },
    onSuccess: () => {
      invalidateCommercialQueries();
      toast({ title: "Participant added" });
      setNewInitials("");
    },
    onError: (err: Error) => {
      toast({ title: "Could not add participant", description: err.message, variant: "destructive" });
    },
  });

  const removeMut = useMutation({
    mutationFn: async (initials: string) => {
      const res = await apiRequest(
        "DELETE",
        `/api/customer-mgmt/programmes/${programme!.id}/participants/${encodeURIComponent(initials)}`,
      );
      return res.json();
    },
    onSuccess: () => {
      invalidateCommercialQueries();
      toast({ title: "Participant removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not remove participant", description: err.message, variant: "destructive" });
    },
  });

  if (!programme) return null;

  const pending = addMut.isPending || removeMut.isPending;

  const slots = programme.participantInitials.map((ini, i) => ({
    initials: ini,
    color: programme.participantColors[i] ?? "#534AB7",
    name: `${ini} participant`,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage participants</DialogTitle>
          <DialogDescription>
            {programme.name} · {programme.slotsFilled}/{programme.slotsMax} slots filled
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {slots.map((p) => (
            <div
              key={p.initials}
              className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0"
            >
              <OrgAvatar initials={p.initials} color={p.color} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">Enrolled · free access active</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-red-600"
                disabled={pending}
                onClick={() => removeMut.mutate(p.initials)}
              >
                Remove
              </Button>
            </div>
          ))}
          {programme.extraParticipants ? (
            <p className="text-xs text-muted-foreground pt-1">
              +{programme.extraParticipants} additional participants enrolled
            </p>
          ) : null}
          <div className="pt-2 flex gap-2">
            <Input
              placeholder="Initials e.g. AB"
              value={newInitials}
              maxLength={4}
              disabled={pending}
              onChange={(e) => setNewInitials(e.target.value.toUpperCase())}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Close
          </Button>
          <AsyncButton
            pending={addMut.isPending}
            disabled={newInitials.trim().length < 1 || programme.slotsFilled >= programme.slotsMax}
            onClick={() => addMut.mutate(newInitials.trim())}
          >
            Add participant
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChangePlanModal({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerDetail | null;
}) {
  const { toast } = useToast();
  const [plan, setPlan] = useState<CommercialPlanTier>("growth");

  useEffect(() => {
    if (open && customer) setPlan(customer.subscription.plan);
  }, [open, customer]);

  const planMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/customer-mgmt/customers/${customer!.slug}/plan`, {
        plan,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateCommercialQueries(customer?.slug);
      toast({ title: "Plan change scheduled", description: `${customer?.name} → ${plan}` });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Plan change failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Change plan</DialogTitle>
          <DialogDescription>{customer?.name}</DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-xs">New plan</Label>
          <Select value={plan} onValueChange={(v) => setPlan(v as CommercialPlanTier)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <AsyncButton pending={planMut.isPending} disabled={!customer} onClick={() => planMut.mutate()}>
            {planMut.isPending ? "Saving…" : "Confirm change"}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddDiscountModal({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerDetail | null;
}) {
  const { toast } = useToast();
  const [rule, setRule] = useState("Loyalty (12+ months)");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setRule("Loyalty (12+ months)");
      setNote("");
    }
  }, [open]);

  const discountMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/customer-mgmt/customers/${customer!.slug}/discounts`, {
        ruleLabel: rule,
        note: note.trim(),
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateCommercialQueries(customer?.slug);
      toast({ title: "Discount applied", description: `${rule} applied to ${customer?.name}` });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Could not apply discount", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add discount</DialogTitle>
          <DialogDescription>{customer?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Discount rule</Label>
            <Select value={rule} onValueChange={setRule}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "Annual commitment (15% off)",
                  "Partner discount (20% off)",
                  "Loyalty (12+ months)",
                  "Non-profit / charity (50% off)",
                  "Custom one-off credit",
                ].map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Reason (audit log)</Label>
            <Textarea className="mt-1 min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <AsyncButton
            pending={discountMut.isPending}
            disabled={note.trim().length < 3 || !customer}
            onClick={() => discountMut.mutate()}
          >
            {discountMut.isPending ? "Applying…" : "Apply discount"}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditPlanModal({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PricingPlan | null;
}) {
  const { toast } = useToast();
  const [priceLabel, setPriceLabel] = useState("");
  const [features, setFeatures] = useState("");

  useEffect(() => {
    if (open && plan) {
      setPriceLabel(plan.priceLabel);
      setFeatures(plan.features);
    }
  }, [open, plan]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/customer-mgmt/pricing/plans/${plan!.tier}`, {
        priceLabel,
        features,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateCommercialQueries();
      toast({ title: "Plan updated", description: `${plan?.name} plan saved.` });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {plan?.name} plan</DialogTitle>
          <DialogDescription>Update pricing and entitlements shown to sales and customers</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Price label</Label>
            <Input className="mt-1" value={priceLabel} onChange={(e) => setPriceLabel(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Features summary</Label>
            <Textarea className="mt-1" value={features} onChange={(e) => setFeatures(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <AsyncButton pending={saveMut.isPending} disabled={!plan} onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? "Saving…" : "Save plan"}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddCustomerModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [plan, setPlan] = useState<CommercialPlanTier>("growth");

  useEffect(() => {
    if (open) {
      setName("");
      setDomain("");
      setPlan("growth");
    }
  }, [open]);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/customer-mgmt/customers", {
        name: name.trim(),
        domain: domain.trim(),
        plan,
      });
      return res.json();
    },
    onSuccess: (data: { slug?: string; name?: string }) => {
      invalidateCommercialQueries(data.slug);
      toast({ title: "Customer created", description: `${data.name ?? name} added with ${plan} trial.` });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Could not create customer", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add customer</DialogTitle>
          <DialogDescription>Create a new organisation record and start trial or paid subscription</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Organisation name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Domain</Label>
            <Input className="mt-1" placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Starting plan</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as CommercialPlanTier)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <AsyncButton
            pending={createMut.isPending}
            disabled={name.trim().length < 2 || domain.trim().length < 3}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? "Creating…" : "Add customer"}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddContactModal({
  open,
  onOpenChange,
  customerName,
  customerSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName?: string;
  customerSlug?: string;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Workspace Admin");

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setRole("Workspace Admin");
    }
  }, [open]);

  const contactMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/customer-mgmt/customers/${customerSlug}/contacts`, {
        name: name.trim(),
        email: email.trim(),
        roleLabel: role,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateCommercialQueries(customerSlug);
      toast({ title: "Contact added", description: `${name} added to ${customerName}` });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Could not add contact", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
          <DialogDescription>{customerName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Economic buyer", "Workspace Admin", "IT contact", "Billing contact"].map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <AsyncButton
            pending={contactMut.isPending}
            disabled={name.trim().length < 2 || !email.includes("@") || !customerSlug}
            onClick={() => contactMut.mutate()}
          >
            {contactMut.isPending ? "Adding…" : "Add contact"}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DiscountRuleModal({
  open,
  onOpenChange,
  rule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: DiscountRule | null;
}) {
  const { toast } = useToast();
  const isEdit = Boolean(rule);
  const [name, setName] = useState("");
  const [discount, setDiscount] = useState("10% off");

  useEffect(() => {
    if (open) {
      setName(rule?.name ?? "");
      setDiscount(rule?.discount ?? "10% off");
    }
  }, [open, rule]);

  const ruleMut = useMutation({
    mutationFn: async () => {
      if (isEdit && rule) {
        const res = await apiRequest("PATCH", `/api/customer-mgmt/discount-rules/${rule.id}`, {
          name: name.trim(),
          discount: discount.trim(),
        });
        return res.json();
      }
      const res = await apiRequest("POST", "/api/customer-mgmt/discount-rules", {
        name: name.trim(),
        discount: discount.trim(),
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateCommercialQueries();
      toast({ title: isEdit ? "Rule updated" : "Rule created", description: `${name} saved.` });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit discount rule" : "Add discount rule"}</DialogTitle>
          <DialogDescription>Define who receives the discount and who can apply it</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Rule name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Discount</Label>
            <Input className="mt-1" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <AsyncButton
            pending={ruleMut.isPending}
            disabled={name.trim().length < 2}
            onClick={() => ruleMut.mutate()}
          >
            {ruleMut.isPending ? "Saving…" : isEdit ? "Save rule" : "Create rule"}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditCustomerModal({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerDetail | null;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    if (open && customer) {
      setName(customer.name);
      setWebsite(customer.website ?? customer.domain);
    }
  }, [open, customer]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/customer-mgmt/customers/${customer!.slug}`, {
        name: name.trim(),
        website: website.trim(),
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateCommercialQueries(customer?.slug);
      toast({ title: "Customer updated", description: `${name} saved.` });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit customer</DialogTitle>
          <DialogDescription>Update organisation profile details</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Organisation name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Website / domain</Label>
            <Input className="mt-1" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <AsyncButton pending={saveMut.isPending} disabled={!customer} onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? "Saving…" : "Save changes"}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PlanBadgeInline({ plan }: { plan: CommercialPlanTier }) {
  return (
    <Badge variant="outline" className={cn("font-semibold text-[10px]", planBadgeClass(plan))}>
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </Badge>
  );
}
