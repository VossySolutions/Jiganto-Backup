import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CreditCard,
  Download,
  HeartPulse,
  Plus,
  Settings2,
  Tag,
  Users,
  Clock,
  Loader2,
  TrendingUp,
  AlertTriangle,
  Shield,
  Pencil,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { usePermissions } from "@/hooks/use-permissions";
import { fetchWithAuth, queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { CustomerMgmtDashboard, CustomerDetail, BetaProgramme, DiscountRule, PricingPlan } from "@shared/models/customer-mgmt";
import { formatGbp } from "@shared/models/customer-mgmt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ModuleHeader } from "@/components/ModuleHeader";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import { FinanceIcon } from "@/components/icons/ModuleIcons";
import {
  CostAlertBanner,
  CustomerOrgCell,
  CUSTOMER_MGMT_COLOR,
  FieldRow,
  HealthBadge,
  InfoAlert,
  KpiCard,
  MrrCell,
  OrgAvatar,
  PermissionAlert,
  canGrantCommercialAccess,
  PlanBadge,
  SectionCard,
  UsageBar,
  ResponsiveTableWrap,
  rowHighlightClass,
  invalidateCommercialQueries,
} from "@/components/customer-mgmt/CustomerMgmtUi";
import {
  GrantAccessModal,
  type GrantAccessTarget,
} from "@/components/customer-mgmt/GrantAccessModal";
import {
  AddContactModal,
  AddCustomerModal,
  AddDiscountModal,
  ChangePlanModal,
  CreateProgrammeModal,
  DiscountRuleModal,
  EditCustomerModal,
  EditPlanModal,
  ManageParticipantsModal,
  PlanBadgeInline,
} from "@/components/customer-mgmt/CustomerMgmtModals";
import { getSettingsAccess } from "@/lib/settings-access";

type ViewId =
  | "customers"
  | "detail"
  | "health"
  | "trials"
  | "programmes"
  | "renewal"
  | "pricing"
  | "billing"
  | "settings";

const BASE_NAV: {
  id: ViewId;
  label: string;
  icon: typeof Building2;
  badge?: string;
  badgeVariant?: "default" | "warn" | "danger";
}[] = [
  { id: "customers", label: "All customers", icon: Building2 },
  { id: "detail", label: "Customer detail", icon: Building2 },
  { id: "health", label: "Health scores", icon: HeartPulse },
  { id: "trials", label: "Trials & extensions", icon: Clock },
  { id: "programmes", label: "Beta programmes", icon: Users },
  { id: "renewal", label: "Renewal pipeline", icon: CalendarClock },
  { id: "pricing", label: "Pricing & plans", icon: Tag },
  { id: "billing", label: "Billing overview", icon: CreditCard },
  { id: "settings", label: "Plan settings", icon: Settings2 },
];

const NAV_SHORT_LABELS: Record<ViewId, string> = {
  customers: "Customers",
  detail: "Detail",
  health: "Health",
  trials: "Trials",
  programmes: "Programmes",
  renewal: "Renewals",
  pricing: "Pricing",
  billing: "Billing",
  settings: "Settings",
};

function clearCustomerFilters(
  setSearch: (v: string) => void,
  setStatusFilter: (v: string) => void,
  setPlanFilter: (v: string) => void,
  setCsmFilter: (v: string) => void,
) {
  setSearch("");
  setStatusFilter("all");
  setPlanFilter("all");
  setCsmFilter("all");
}

function buildNavItems(dashboard: CustomerMgmtDashboard | null | undefined) {
  if (!dashboard) return BASE_NAV;

  const customerCount = dashboard.overview.customers.length;
  const atRisk = dashboard.health.atRisk;
  const trialsUrgent = dashboard.trials.kpis.expiringThisWeek;

  return BASE_NAV.map((item) => {
    if (item.id === "customers") {
      return {
        ...item,
        badge: customerCount > 0 ? String(customerCount) : undefined,
      };
    }
    if (item.id === "health") {
      return {
        ...item,
        badge: atRisk > 0 ? String(atRisk) : undefined,
        badgeVariant: atRisk > 0 ? ("danger" as const) : undefined,
      };
    }
    if (item.id === "trials") {
      return {
        ...item,
        badge: trialsUrgent > 0 ? `${trialsUrgent}!` : undefined,
        badgeVariant: trialsUrgent > 0 ? ("warn" as const) : undefined,
      };
    }
    return item;
  });
}

function formatNewMrrSub(percent: number): string {
  if (percent === 0) return "No new MRR in last 30 days";
  return `${percent > 0 ? "+" : ""}${percent}% new MRR (30d)`;
}

function mrrTrendGrowthLabel(trend: { amountPence: number }[]): string {
  if (trend.length < 2) return "Insufficient history";
  const first = trend[0]!.amountPence;
  const last = trend.at(-1)!.amountPence;
  if (first === 0 && last === 0) return "No paid customers yet";
  if (first === 0) return `From ${formatGbp(0, true)} to ${formatGbp(last, true)}`;
  const pct = Math.round(((last - first) / first) * 100);
  return `${formatGbp(first, true)} → ${formatGbp(last, true)} · ${pct > 0 ? "+" : ""}${pct}% over 6 months`;
}

export default function CustomerManagementPage() {
  const { platformRole, isJigantoStaff, isLoading: permissionsLoading } = usePermissions();
  const settingsAccess = getSettingsAccess(platformRole, isJigantoStaff);
  const allowed = settingsAccess.tier === "system";
  const canGrantCommercial = canGrantCommercialAccess(platformRole, isJigantoStaff);
  const { mainOffset, mobileTopOffset } = useShellLayout();
  const { toast } = useToast();
  const [view, setView] = useState<ViewId>("customers");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [csmFilter, setCsmFilter] = useState("all");
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantTarget, setGrantTarget] = useState<GrantAccessTarget | null>(null);
  const [createProgrammeOpen, setCreateProgrammeOpen] = useState(false);
  const [manageProgramme, setManageProgramme] = useState<BetaProgramme | null>(null);
  const [editPlan, setEditPlan] = useState<PricingPlan | null>(null);
  const [discountRule, setDiscountRule] = useState<DiscountRule | null | "new">(null);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [addDiscountOpen, setAddDiscountOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["/api/customer-mgmt/dashboard"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/customer-mgmt/dashboard");
      if (res.status === 404) {
        const body = (await res.json()) as { empty?: boolean };
        if (body.empty) return null;
      }
      if (!res.ok) throw new Error("Failed to load customer management data");
      return (await res.json()) as CustomerMgmtDashboard;
    },
    enabled: allowed,
    retry: false,
  });

  const { data: dataStatus } = useQuery({
    queryKey: ["/api/customer-mgmt/status"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/customer-mgmt/status");
      if (!res.ok) throw new Error("Failed to load data status");
      return (await res.json()) as {
        persisted: boolean;
        source: "postgres";
        customerCount: number;
        stripeConfigured: boolean;
        emailConfigured: boolean;
        webhookConfigured: boolean;
      };
    },
    enabled: allowed,
  });

  const stripeSyncMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/customer-mgmt/stripe/sync");
      return res.json() as Promise<{ synced: number; skipped: number }>;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/customer-mgmt/dashboard"] });
      toast({
        title: "Stripe sync complete",
        description: `${result.synced} invoice(s) synced${result.skipped ? ` · ${result.skipped} customer(s) skipped` : ""}.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Stripe sync failed", description: err.message, variant: "destructive" });
    },
  });

  const provisionSyncMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/customer-mgmt/provision/sync-tenants");
      return res.json() as Promise<{ created: number }>;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/customer-mgmt/dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/customer-mgmt/status"] });
      toast({
        title: "Tenant profiles synced",
        description:
          result.created > 0
            ? `${result.created} new commercial profile(s) created.`
            : "All tenants already have commercial profiles.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Tenant sync failed", description: err.message, variant: "destructive" });
    },
  });

  const { data: detail, isLoading: detailLoading, isFetching: detailFetching } = useQuery({
    queryKey: ["/api/customer-mgmt/customers", selectedSlug],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/customer-mgmt/customers/${selectedSlug}`);
      if (!res.ok) throw new Error("Customer not found");
      return (await res.json()) as CustomerDetail;
    },
    enabled: allowed && view === "detail",
  });

  const saveSettingsMut = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const res = await apiRequest("PUT", "/api/customer-mgmt/settings", patch);
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/customer-mgmt/dashboard"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Settings save failed", description: err.message, variant: "destructive" });
    },
  });

  const flagMut = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/customer-mgmt/customers/${selectedSlug}/feature-flags/${key}`,
        { enabled },
      );
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["/api/customer-mgmt/customers", selectedSlug],
      });
    },
    onError: (err: Error) => {
      toast({ title: "Feature flag update failed", description: err.message, variant: "destructive" });
    },
  });

  const customerActionMut = useMutation({
    mutationFn: async (input: {
      action: "health_follow_up" | "renewal_follow_up" | "convert_trial";
      customerExternalId: string;
      note?: string;
    }) => {
      const res = await apiRequest("POST", "/api/customer-mgmt/customers/_by_id/actions", input);
      return res.json();
    },
    onSuccess: () => {
      invalidateCommercialQueries(selectedSlug || undefined);
      toast({ title: "Action recorded" });
    },
    onError: (err: Error) => {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    },
  });

  const settingsSaving = saveSettingsMut.isPending;
  const flagSaving = flagMut.isPending;

  const filteredCustomers = useMemo(() => {
    if (!dashboard) return [];
    let rows = dashboard.overview.customers;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.domain.toLowerCase().includes(q),
      );
    }
    if (statusFilter === "trial") rows = rows.filter((c) => c.status === "trial");
    if (statusFilter === "active") rows = rows.filter((c) => c.status === "active");
    if (statusFilter === "at-risk") rows = rows.filter((c) => c.healthBand === "at_risk");
    if (statusFilter === "suspended") rows = rows.filter((c) => c.status === "suspended");
    if (planFilter !== "all") rows = rows.filter((c) => c.plan === planFilter);
    if (csmFilter !== "all") rows = rows.filter((c) => c.csmName === csmFilter);
    return rows;
  }, [dashboard, search, statusFilter, planFilter, csmFilter]);

  const customersPagination = useTablePagination(filteredCustomers, {
    resetKey: `${search}-${statusFilter}-${planFilter}-${csmFilter}`,
  });
  const attentionPagination = useTablePagination(dashboard?.health.attentionRows ?? [], {
    resetKey: dashboard?.health.attentionRows.length ?? 0,
    enabled: !!dashboard,
  });
  const trialsPagination = useTablePagination(dashboard?.trials.rows ?? [], {
    resetKey: dashboard?.trials.rows.length ?? 0,
    enabled: !!dashboard,
  });
  const renewalsPagination = useTablePagination(dashboard?.renewals.rows ?? [], {
    resetKey: dashboard?.renewals.rows.length ?? 0,
    enabled: !!dashboard,
  });

  const navItems = useMemo(() => buildNavItems(dashboard), [dashboard]);

  const csmOptions = useMemo(() => {
    if (!dashboard) return [];
    return Array.from(
      new Set(
        dashboard.overview.customers
          .map((c) => c.csmName)
          .filter((name) => name && name !== "Unassigned"),
      ),
    ).sort();
  }, [dashboard]);

  const exportCustomers = () => {
    if (!dashboard) return;
    const header = "Organisation,Domain,Plan,Status,MRR,Health,CSM\n";
    const body = filteredCustomers
      .map(
        (c) =>
          `"${c.name}","${c.domain}",${c.plan},"${c.statusLabel}",${c.mrrPence ?? ""},${c.healthScore},"${c.csmName}"`,
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jiganto-customers.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export complete", description: "Customer list downloaded as CSV." });
  };

  const openGrant = (target: GrantAccessTarget) => {
    setGrantTarget(target);
    setGrantOpen(true);
  };

  const goDetail = (slug: string) => {
    setSelectedSlug(slug);
    setView("detail");
  };

  if (permissionsLoading) {
    return (
      <div className="h-screen overflow-hidden bg-background" data-testid="customer-mgmt-loading">
        <Sidebar />
        <main
          className={cn(
            "transition-all duration-300 h-full flex items-center justify-center overflow-hidden",
            mainOffset,
            mobileTopOffset,
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: CUSTOMER_MGMT_COLOR }} />
            <p className="text-sm text-muted-foreground">Loading Customer Management...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="h-screen overflow-hidden bg-background" data-testid="customer-mgmt-denied">
        <Sidebar />
        <main
          className={cn(
            "transition-all duration-300 h-full flex flex-col overflow-hidden",
            mainOffset,
            mobileTopOffset,
          )}
        >
          <div className="flex-1 flex items-center justify-center p-6">
            <Card className="max-w-md rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  Access restricted
                </CardTitle>
                <CardDescription>
                  Customer Management is available to Jiganto Staff and SI Super Admin users only.
                  Contact your platform administrator if you need commercial admin access.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  if (dashboardLoading && dataStatus === undefined) {
    return (
      <div className="h-screen overflow-hidden bg-background" data-testid="customer-mgmt-loading">
        <Sidebar />
        <main
          className={cn(
            "transition-all duration-300 h-full flex items-center justify-center overflow-hidden",
            mainOffset,
            mobileTopOffset,
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: CUSTOMER_MGMT_COLOR }} />
            <p className="text-sm text-muted-foreground">Loading commercial data...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <>
        <div className="h-screen overflow-hidden bg-background" data-testid="customer-mgmt-empty">
          <Sidebar />
          <main
            className={cn(
              "transition-all duration-300 h-full flex flex-col overflow-hidden",
              mainOffset,
              mobileTopOffset,
            )}
          >
            <div className="flex-1 flex items-center justify-center p-6">
              <Card className="max-w-lg rounded-xl">
                <CardHeader>
                  <CardTitle>No commercial customers yet</CardTitle>
                  <CardDescription>
                    Add a customer manually or sync commercial profiles from provisioned tenant
                    organisations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button onClick={() => setAddCustomerOpen(true)}>Add customer</Button>
                  <Button
                    variant="outline"
                    disabled={provisionSyncMut.isPending}
                    onClick={() => provisionSyncMut.mutate()}
                  >
                    {provisionSyncMut.isPending ? "Syncing…" : "Sync tenant profiles"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
        <AddCustomerModal open={addCustomerOpen} onOpenChange={setAddCustomerOpen} />
      </>
    );
  }

  const showBillingCostAlert =
    dashboard.settings.showBillingCostAlert &&
    dashboard.billing.thresholdBreached &&
    view === "billing";

  const showProgrammesCostAlert =
    dashboard.settings.showProgrammesCostAlert &&
    dashboard.programmes.thresholdBreached &&
    view === "programmes";

  const programmesBlocked =
    dashboard.settings.blockNewProgrammesOverThreshold && dashboard.programmes.thresholdBreached;

  const anyApiPending =
    stripeSyncMut.isPending ||
    provisionSyncMut.isPending ||
    saveSettingsMut.isPending ||
    flagMut.isPending ||
    customerActionMut.isPending;

  const headerSubtitle =
    view === "customers"
      ? `${dashboard.overview.kpis.activeCustomers} active organisations · ${dashboard.overview.kpis.onTrial} on trial`
      : view === "detail" && detail
        ? `${detail.name} · ${detail.statusLabel}`
        : "Internal commercial administration · subscriptions, trials & billing";

  return (
    <div className="h-screen overflow-hidden bg-background" data-testid="customer-mgmt-page">
      <Sidebar />
      <main
        className={cn(
          "transition-all duration-300 h-full flex flex-col overflow-hidden",
          mainOffset,
          mobileTopOffset,
        )}
      >
        <div className="px-4 pt-4 shrink-0">
          <ModuleWelcomeBanner
            moduleKey="customer-mgmt"
            features={[
              "Subscription & MRR tracking",
              "Trial extensions & beta programmes",
              "Health scores & renewal pipeline",
              "Billing overview & plan settings",
            ]}
          />
        </div>

        <div className="border-b border-border/30 bg-card backdrop-blur-sm sticky top-0 z-50 shrink-0">
          <ModuleHeader
            icon={FinanceIcon}
            title="Customer Management"
            subtitle={headerSubtitle}
            searchPlaceholder={view === "customers" ? "Search organisations..." : undefined}
            searchValue={view === "customers" ? search : undefined}
            onSearchChange={view === "customers" ? setSearch : undefined}
            searchTestId="input-customer-mgmt-search"
            titleTestId="customer-mgmt-title"
            actions={
              view === "customers" ? (
                <>
                  <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={exportCustomers}>
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                  <Button size="sm" className="gap-1.5 h-9" onClick={() => setAddCustomerOpen(true)}>
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add customer</span>
                  </Button>
                </>
              ) : view === "detail" && detail ? (
                <Button
                  size="sm"
                  className="gap-1.5 h-9"
                  onClick={() =>
                    openGrant({
                      customerId: detail.id,
                      customerSlug: detail.slug,
                      customerName: detail.name,
                      subtitle: detail.statusLabel,
                    })
                  }
                >
                  <span className="hidden sm:inline">Grant access</span>
                  <span className="sm:hidden">Grant</span>
                </Button>
              ) : undefined
            }
          />

          <div className="px-4 pb-3 md:hidden">
            <Select value={view} onValueChange={(v) => setView(v as ViewId)}>
              <SelectTrigger className="w-full h-10" data-testid="select-customer-mgmt-view-mobile">
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                {navItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                    {item.badge ? ` (${item.badge})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={view} onValueChange={(v) => setView(v as ViewId)} className="px-4 pb-0 hidden md:block">
            <TabsList className="h-12 w-full justify-start bg-transparent border-0 gap-1 overflow-x-auto flex-nowrap scrollbar-thin">
              {navItems.map((item) => {
                const TabIcon = item.icon;
                return (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className="gap-1.5 lg:gap-2 rounded-lg shrink-0 data-[state=active]:bg-[#534AB7]/10 data-[state=active]:text-[#534AB7]"
                    data-testid={`tab-customer-mgmt-${item.id}`}
                  >
                    <TabIcon className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap hidden xl:inline">{item.label}</span>
                    <span className="whitespace-nowrap xl:hidden">{NAV_SHORT_LABELS[item.id]}</span>
                    {item.badge && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ml-0.5 h-5 px-1.5 text-[10px] font-medium",
                          item.badgeVariant === "danger" && "bg-red-100 text-red-700",
                          item.badgeVariant === "warn" && "bg-amber-100 text-amber-700",
                        )}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-auto relative">
          {anyApiPending && (
            <div className="absolute top-2 right-4 z-20 flex items-center gap-2 rounded-md border bg-background/95 px-3 py-1.5 text-xs shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Saving…
            </div>
          )}
          <div className="p-4 md:p-6 space-y-6">
            {showBillingCostAlert && (
              <CostAlertBanner
                title="Free access cost alert — threshold reached"
                description={`Beta programmes and free access periods are costing ${formatGbp(dashboard.billing.freeAccessCostPence)} this month — ${dashboard.billing.freeAccessCostPercent}% of MRR. Your alert threshold is ${dashboard.settings.freeAccessThresholdPercent}%.`}
                percent={dashboard.billing.freeAccessCostPercent}
                actionLabel="Review programmes"
                onAction={() => setView("programmes")}
              />
            )}

            {showProgrammesCostAlert && (
              <CostAlertBanner
                title="Free access cost approaching threshold"
                description={`${formatGbp(dashboard.programmes.kpis.freeAccessCostPence)} MRR foregone this month = ${dashboard.programmes.kpis.freeAccessCostPercent}% of total MRR. Your configured alert threshold is ${dashboard.programmes.thresholdPercent}%. Consider whether active programmes should continue or be wound down early.`}
                percent={dashboard.programmes.kpis.freeAccessCostPercent}
                actionLabel="Plan settings"
                onAction={() => setView("settings")}
              />
            )}

            {dataStatus?.persisted && (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    Postgres · {dataStatus.customerCount} customer{dataStatus.customerCount === 1 ? "" : "s"}
                  </span>
                  {dataStatus.stripeConfigured && (
                    <Badge variant="outline">Stripe configured</Badge>
                  )}
                  {dataStatus.emailConfigured && (
                    <Badge variant="outline">Email configured</Badge>
                  )}
                  {dataStatus.stripeConfigured && dataStatus.webhookConfigured && (
                    <Badge variant="outline">Stripe webhook configured</Badge>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={provisionSyncMut.isPending}
                    onClick={() => provisionSyncMut.mutate()}
                  >
                    {provisionSyncMut.isPending ? "Syncing…" : "Sync tenant profiles"}
                  </Button>
                </div>
              </div>
            )}

              {view === "customers" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                      label="Active customers"
                      value={dashboard.overview.kpis.activeCustomers}
                      sub={dashboard.overview.kpis.activeCustomersDelta}
                      subTone="up"
                      icon={Building2}
                      color={CUSTOMER_MGMT_COLOR}
                    />
                    <KpiCard
                      label="On trial / extension"
                      value={dashboard.overview.kpis.onTrial}
                      sub={`${dashboard.overview.kpis.trialExpiringThisWeek} expiring this week`}
                      subTone="warn"
                      icon={Clock}
                      color="#EF9F27"
                    />
                    <KpiCard
                      label="Monthly recurring revenue"
                      value={formatGbp(dashboard.overview.kpis.mrrPence)}
                      sub={formatNewMrrSub(dashboard.overview.kpis.mrrMomPercent)}
                      subTone="up"
                      icon={TrendingUp}
                      color="#0F6E56"
                    />
                    <KpiCard
                      label="At-risk customers"
                      value={dashboard.overview.kpis.atRiskCount}
                      sub="Health score red"
                      subTone="dn"
                      icon={AlertTriangle}
                      color="#E24B4A"
                    />
                  </div>
                  <SectionCard title="Organisations">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-b mb-4 pb-3 -mx-1">
                      <div className="flex items-center gap-1 overflow-x-auto flex-nowrap">
                        {(["all", "active", "trial", "at-risk", "suspended"] as const).map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setStatusFilter(f)}
                            className={cn(
                              "px-3 py-1.5 text-sm font-medium rounded-full border transition-colors capitalize shrink-0",
                              statusFilter === f
                                ? "border-[#534AB7] bg-[#534AB7]/10 text-[#534AB7]"
                                : "border-border text-muted-foreground hover:bg-muted/50",
                            )}
                          >
                            {f === "at-risk" ? "At risk" : f}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:ml-auto shrink-0 w-full sm:w-auto">
                        <Select value={planFilter} onValueChange={setPlanFilter}>
                          <SelectTrigger className="h-8 w-full sm:w-[130px]">
                            <SelectValue placeholder="All plans" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All plans</SelectItem>
                            <SelectItem value="starter">Starter</SelectItem>
                            <SelectItem value="growth">Growth</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={csmFilter} onValueChange={setCsmFilter}>
                          <SelectTrigger className="h-8 w-full sm:w-[140px]">
                            <SelectValue placeholder="All CSMs" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All CSMs</SelectItem>
                            {csmOptions.map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {filteredCustomers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <p className="text-sm text-muted-foreground mb-3">
                          No organisations match your filters.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            clearCustomerFilters(setSearch, setStatusFilter, setPlanFilter, setCsmFilter)
                          }
                        >
                          Clear filters
                        </Button>
                      </div>
                    ) : (
                    <ResponsiveTableWrap minWidthClass="min-w-[960px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Organisation</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Health</TableHead>
                          <TableHead>CSM</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>MRR</TableHead>
                          <TableHead>Next action</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customersPagination.paginatedItems.map((c) => (
                          <TableRow key={c.id} className={rowHighlightClass(c.rowHighlight)}>
                            <TableCell>
                              <CustomerOrgCell customer={c} />
                            </TableCell>
                            <TableCell>
                              <PlanBadge plan={c.plan} />
                            </TableCell>
                            <TableCell>
                              <HealthBadge band={c.healthBand} score={c.healthScore} />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-xs">
                                <OrgAvatar initials={c.csmInitials} color="#378ADD" size="sm" />
                                {c.csmName}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  c.status === "trial" && "border-red-300 text-red-700",
                                  c.status === "free_access" && "border-teal-300 text-teal-700",
                                  c.status === "active" && "border-emerald-300 text-emerald-700",
                                )}
                              >
                                {c.statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <MrrCell pence={c.mrrPence} />
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-xs",
                                c.nextActionUrgent && "text-red-600 font-semibold",
                              )}
                            >
                              {c.trialDaysLeft != null && c.trialDaysLeft <= 7 ? (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    openGrant({
                                      customerId: c.id,
                                      customerSlug: c.slug,
                                      customerName: c.name,
                                      subtitle: `${c.statusLabel}`,
                                    })
                                  }
                                >
                                  Extend
                                </Button>
                              ) : (
                                c.nextAction
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => goDetail(c.slug)}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <TablePagination
                      page={customersPagination.page}
                      totalPages={customersPagination.totalPages}
                      total={customersPagination.total}
                      startIndex={customersPagination.startIndex}
                      endIndex={customersPagination.endIndex}
                      pageSize={customersPagination.pageSize}
                      onPageChange={customersPagination.setPage}
                      onPageSizeChange={customersPagination.setPageSize}
                    />
                    </ResponsiveTableWrap>
                    )}
                  </SectionCard>
                </>
              )}

              {view === "detail" && (
                <>
                  {detailLoading && !detail ? (
                    <div className="flex items-center justify-center py-24">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : detail ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 -ml-2"
                    onClick={() => setView("customers")}
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" /> All customers
                  </Button>
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <OrgAvatar initials={detail.initials} color={detail.avatarColor} size="lg" />
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold">{detail.name}</h2>
                      <p className="text-xs text-muted-foreground truncate">
                        {detail.plan.charAt(0).toUpperCase() + detail.plan.slice(1)} · Active since{" "}
                        {detail.activeSince} · CSM: {detail.csmName}
                        <span className="hidden sm:inline"> · {detail.website}</span>
                      </p>
                    </div>
                    <HealthBadge band={detail.healthBand} score={detail.healthScore} />
                    <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      size="sm"
                      className="flex-1 sm:flex-initial"
                      onClick={() =>
                        openGrant({
                          customerId: detail.id,
                          customerSlug: detail.slug,
                          customerName: detail.name,
                          subtitle: detail.statusLabel,
                        })
                      }
                    >
                      Grant access
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 flex-1 sm:flex-initial"
                      onClick={() => setEditCustomerOpen(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <SectionCard title="Subscription">
                      <FieldRow label="Plan" value={<PlanBadge plan={detail.subscription.plan} />} />
                      <FieldRow
                        label="MRR"
                        value={`${formatGbp(detail.subscription.mrrPence)} / month`}
                      />
                      <FieldRow label="Billing cycle" value={detail.subscription.billingCycle} />
                      <FieldRow label="Renewal date" value={detail.subscription.renewalDate} />
                      <FieldRow
                        label="Discount applied"
                        value={
                          detail.subscription.discountLabel ? (
                            <Badge variant="outline" className="text-teal-700">
                              {detail.subscription.discountLabel}
                            </Badge>
                          ) : (
                            "—"
                          )
                        }
                      />
                      <FieldRow label="Payment method" value={detail.subscription.paymentMethod} />
                      <div className="flex flex-col sm:flex-row gap-2 mt-3">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setChangePlanOpen(true)}>
                          Change plan
                        </Button>
                        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setAddDiscountOpen(true)}>
                          Add discount
                        </Button>
                        <Button
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() =>
                            openGrant({
                              customerId: detail.id,
                              customerSlug: detail.slug,
                              customerName: detail.name,
                              subtitle: "Free access period",
                            })
                          }
                        >
                          Grant free access
                        </Button>
                      </div>
                    </SectionCard>
                    <SectionCard
                      title="Health score"
                      action={
                        <Badge className="bg-emerald-100 text-emerald-800">
                          {detail.healthScore} / 100
                        </Badge>
                      }
                    >
                      {detail.healthSignals.map((s) => (
                        <UsageBar
                          key={s.key}
                          label={s.label}
                          used={s.score}
                          limit={100}
                          tone={s.score >= 70 ? "green" : s.score >= 50 ? "amber" : "red"}
                        />
                      ))}
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Recalculated from live usage, activity, and subscription data on each load.
                      </p>
                    </SectionCard>
                    <SectionCard title="Key contacts" action={<Button variant="outline" size="sm" onClick={() => setAddContactOpen(true)}>Add</Button>}>
                      {detail.contacts.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0"
                        >
                          <OrgAvatar initials={c.initials} color={c.avatarColor} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
                          </div>
                          <Badge variant="outline" className="text-[9px]">
                            {c.roleLabel}
                          </Badge>
                        </div>
                      ))}
                    </SectionCard>
                    <SectionCard title="Feature flags" description="Overrides for this org only">
                      {detail.featureFlags.map((f) => (
                        <div
                          key={f.key}
                          className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
                        >
                          <div>
                            <p className="text-sm font-semibold">{f.name}</p>
                            <p className="text-[10px] text-muted-foreground">{f.description}</p>
                          </div>
                          <Switch
                            checked={f.enabled}
                            disabled={flagSaving}
                            onCheckedChange={(enabled) =>
                              flagMut.mutate({ key: f.key, enabled })
                            }
                          />
                        </div>
                      ))}
                    </SectionCard>
                  </div>
                  <SectionCard title="Usage & entitlements">
                    <UsageBar
                      label="Users"
                      used={detail.usage.users.used}
                      limit={detail.usage.users.limit}
                      tone="primary"
                    />
                    <UsageBar
                      label="AI tokens"
                      used={Math.round(detail.usage.aiTokens.used / 1000)}
                      limit={Math.round(detail.usage.aiTokens.limit / 1000)}
                      tone="blue"
                    />
                    <UsageBar
                      label="Storage (GB)"
                      used={detail.usage.storageGb.used}
                      limit={detail.usage.storageGb.limit}
                      tone="green"
                    />
                    <UsageBar
                      label="eSign docs"
                      used={detail.usage.esignDocs.used}
                      limit={detail.usage.esignDocs.limit}
                      tone="amber"
                    />
                  </SectionCard>
                  <SectionCard title="Access & extension history">
                    <div className="space-y-3">
                      {detail.activityLog.map((a) => (
                        <div key={a.id} className="flex gap-3">
                          <span
                            className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: a.dotColor }}
                          />
                          <p className="text-xs text-muted-foreground">
                            <strong className="text-foreground">{a.title}</strong> — {a.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                </>
                  ) : (
                    <Card className="rounded-xl p-8 sm:p-12 text-center max-w-md mx-auto">
                      <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-semibold mb-2">No customer selected</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Choose an organisation from All customers to view subscription, usage, and
                        activity.
                      </p>
                      <Button onClick={() => setView("customers")}>Browse customers</Button>
                    </Card>
                  )}
                </>
              )}

              {view === "health" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <KpiCard label="Healthy (70–100)" value={dashboard.health.healthy} valueClassName="text-emerald-600" />
                    <KpiCard label="Watch (40–69)" value={dashboard.health.watch} valueClassName="text-amber-600" sub="CSM outreach needed" subTone="warn" />
                    <KpiCard label="At risk (0–39)" value={dashboard.health.atRisk} valueClassName="text-red-600" sub="Urgent intervention" subTone="dn" />
                    <KpiCard label="Average health score" value={dashboard.health.averageScore} sub={dashboard.health.averageDelta} subTone="up" />
                  </div>
                  <InfoAlert>
                    Health scores are recalculated from live usage (users, AI tokens), subscription
                    status, renewal timing, and recent CSM follow-up activity in the activity log.
                  </InfoAlert>
                  <SectionCard title="Customers needing attention" description="Watch and at-risk only — sorted by urgency">
                    <ResponsiveTableWrap minWidthClass="min-w-[1000px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Organisation</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Primary signal</TableHead>
                          <TableHead>CSM</TableHead>
                          <TableHead>Last contact</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attentionPagination.paginatedItems.map((r) => (
                          <TableRow key={r.customerId} className={rowHighlightClass(r.rowHighlight)}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <OrgAvatar initials={r.initials} color={r.avatarColor} />
                                <span className="font-semibold">{r.customerName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <HealthBadge band={r.band} score={r.score} />
                            </TableCell>
                            <TableCell className="font-bold text-red-600">{r.score}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                              {r.primarySignal}
                            </TableCell>
                            <TableCell className="text-xs">{r.csmName}</TableCell>
                            <TableCell className={cn("text-xs", r.lastContactUrgent && "text-red-600 font-semibold")}>
                              {r.lastContactDays >= 999 ? "No contact logged" : `${r.lastContactDays} days ago`}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant={r.actionVariant === "danger" ? "destructive" : "outline"}
                                className="h-7 text-xs"
                                onClick={() =>
                                  customerActionMut.mutate({
                                    action: "health_follow_up",
                                    customerExternalId: r.customerId,
                                    note: r.actionLabel,
                                  })
                                }
                                disabled={customerActionMut.isPending}
                              >
                                {r.actionLabel}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <TablePagination
                      page={attentionPagination.page}
                      totalPages={attentionPagination.totalPages}
                      total={attentionPagination.total}
                      startIndex={attentionPagination.startIndex}
                      endIndex={attentionPagination.endIndex}
                      pageSize={attentionPagination.pageSize}
                      onPageChange={attentionPagination.setPage}
                      onPageSizeChange={attentionPagination.setPageSize}
                    />
                    </ResponsiveTableWrap>
                  </SectionCard>
                </>
              )}

              {view === "trials" && (
                <>
                  {!canGrantCommercial && <PermissionAlert />}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    <KpiCard label="Standard trials" value={dashboard.trials.kpis.standardTrials} sub="Auto 30-day" />
                    <KpiCard label="Admin extensions" value={dashboard.trials.kpis.adminExtensions} sub="Manually granted" subTone="warn" />
                    <KpiCard label="Free access periods" value={dashboard.trials.kpis.freeAccessPeriods} sub="Paid → free credit" />
                    <KpiCard label="Expiring this week" value={dashboard.trials.kpis.expiringThisWeek} subTone="dn" sub="Action needed" />
                    <KpiCard label="Trial → paid (90d)" value={`${dashboard.trials.kpis.conversionRate90d}%`} sub={dashboard.trials.kpis.conversionDelta} subTone="up" />
                  </div>
                  <SectionCard
                    title="All active trials & extensions"
                    description="Standard trials, admin-granted extensions, free access periods, and beta participants"
                    action={
                      dashboard.overview.customers[0] ? (
                        <Button
                          size="sm"
                          onClick={() =>
                            openGrant({
                              customerId: dashboard.overview.customers[0]!.id,
                              customerSlug: dashboard.overview.customers[0]!.slug,
                              customerName: dashboard.overview.customers[0]!.name,
                            })
                          }
                        >
                          Grant access
                        </Button>
                      ) : undefined
                    }
                  >
                    <ResponsiveTableWrap minWidthClass="min-w-[1100px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Organisation</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Started</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead>Days left</TableHead>
                          <TableHead>Granted by</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trialsPagination.paginatedItems.map((r) => (
                          <TableRow key={r.id} className={rowHighlightClass(r.rowHighlight)}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <OrgAvatar initials={r.initials} color={r.avatarColor} size="sm" />
                                <span className="font-semibold">{r.customerName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{r.typeLabel}</Badge>
                            </TableCell>
                            <TableCell>
                              <PlanBadgeInline plan={r.plan} />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.startedAt}</TableCell>
                            <TableCell className={cn("text-xs font-semibold", r.rowHighlight === "danger" && "text-red-600", r.rowHighlight === "warn" && "text-amber-600")}>
                              {r.expiresAt}
                            </TableCell>
                            <TableCell className="font-bold">{r.daysLeft}</TableCell>
                            <TableCell className="text-xs">{r.grantedBy}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[160px]">{r.reason}</TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    openGrant({
                                      customerId: r.customerId,
                                      customerName: r.customerName,
                                    })
                                  }
                                >
                                  Extend
                                </Button>
                                {r.type !== "free_access" && (
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() =>
                                      customerActionMut.mutate({
                                        action: "convert_trial",
                                        customerExternalId: r.customerId,
                                      })
                                    }
                                    disabled={customerActionMut.isPending}
                                  >
                                    Convert
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <TablePagination
                      page={trialsPagination.page}
                      totalPages={trialsPagination.totalPages}
                      total={trialsPagination.total}
                      startIndex={trialsPagination.startIndex}
                      endIndex={trialsPagination.endIndex}
                      pageSize={trialsPagination.pageSize}
                      onPageChange={trialsPagination.setPage}
                      onPageSizeChange={trialsPagination.setPageSize}
                    />
                    </ResponsiveTableWrap>
                  </SectionCard>
                  <SectionCard title="Trial defaults & permission controls">
                    <TrialDefaultsPanel dashboard={dashboard} onSave={(patch) => saveSettingsMut.mutate(patch)} />
                  </SectionCard>
                </>
              )}

              {view === "programmes" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <KpiCard label="Active programmes" value={dashboard.programmes.kpis.activeProgrammes} sub="Across all plan tiers" />
                    <KpiCard label="Total participants" value={dashboard.programmes.kpis.totalParticipants} sub="Organisations enrolled" />
                    <KpiCard
                      label="Free access cost"
                      value={formatGbp(dashboard.programmes.kpis.freeAccessCostPence)}
                      sub={`${dashboard.programmes.kpis.freeAccessCostPercent}% of MRR`}
                      subTone="warn"
                      valueClassName="text-amber-600"
                    />
                    <KpiCard label="Converted to paid" value={dashboard.programmes.kpis.convertedToPaid} subTone="up" sub="From completed programmes" />
                  </div>
                  <div className="flex justify-stretch sm:justify-end">
                    <Button size="sm" className="w-full sm:w-auto" onClick={() => setCreateProgrammeOpen(true)} disabled={programmesBlocked}>
                      <Plus className="h-4 w-4 mr-1" />
                      Create programme
                    </Button>
                  </div>
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {dashboard.programmes.programmes.map((p) => (
                      <div key={p.id} className="rounded-xl border p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <p className="font-bold">{p.name}</p>
                          <Badge>{p.statusLabel}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                        <p className="text-xs">
                          <strong>{p.slotsFilled}</strong> / {p.slotsMax} slots · Ends{" "}
                          <strong>{p.endsAt}</strong> · Cost{" "}
                          <strong className="text-amber-600">
                            {formatGbp(p.monthlyCostPence)}/mo
                          </strong>
                        </p>
                        <div className="flex gap-1 flex-wrap">
                          {p.participantInitials.map((ini, i) => (
                            <OrgAvatar
                              key={ini}
                              initials={ini}
                              color={p.participantColors[i] ?? "#534AB7"}
                              size="sm"
                            />
                          ))}
                          {p.extraParticipants ? (
                            <span className="text-xs text-muted-foreground self-center">
                              +{p.extraParticipants}
                            </span>
                          ) : null}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setManageProgramme(p)}
                        >
                          Manage participants
                        </Button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center min-h-[180px] text-muted-foreground hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                      disabled={programmesBlocked}
                      onClick={() => setCreateProgrammeOpen(true)}
                    >
                      <Plus className="h-8 w-8 mb-2" />
                      <span className="font-semibold text-sm text-foreground">Create programme</span>
                      <span className="text-[11px] text-muted-foreground mt-1 text-center">
                        Beta cohort · Design partner · Early access · Market research
                      </span>
                    </button>
                  </div>
                </>
              )}

              {view === "renewal" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <KpiCard label="Renewing in 30 days" value={formatGbp(dashboard.renewals.kpis.renewing30DaysPence)} sub="MRR at stake" subTone="warn" />
                    <KpiCard label="Renewing in 31–90 days" value={formatGbp(dashboard.renewals.kpis.renewing31To90DaysPence)} sub="MRR at stake" />
                    <KpiCard label="At-risk renewals" value={dashboard.renewals.kpis.atRiskRenewals} subTone="dn" sub="Health below 40" />
                    <KpiCard label="Expected renewal rate" value={`${dashboard.renewals.kpis.expectedRenewalRate}%`} subTone="up" sub="Based on health scores" />
                  </div>
                  <SectionCard title="Upcoming renewals — next 90 days" description="Sorted by renewal date · Red = at-risk · Prioritise CSM outreach by MRR value">
                    <ResponsiveTableWrap minWidthClass="min-w-[1100px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Organisation</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>MRR</TableHead>
                          <TableHead>Health</TableHead>
                          <TableHead>CSM</TableHead>
                          <TableHead>Renewal</TableHead>
                          <TableHead>Days away</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {renewalsPagination.paginatedItems.map((r) => (
                          <TableRow key={r.id} className={rowHighlightClass(r.rowHighlight)}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <OrgAvatar initials={r.initials} color={r.avatarColor} size="sm" />
                                <span className="font-semibold">{r.customerName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <PlanBadgeInline plan={r.plan} />
                            </TableCell>
                            <TableCell>
                              <MrrCell pence={r.mrrPence} />
                            </TableCell>
                            <TableCell>
                              <HealthBadge band={r.healthBand} score={r.healthBand === "healthy" ? 82 : r.healthBand === "watch" ? 52 : 28} />
                            </TableCell>
                            <TableCell className="text-xs">{r.csmName}</TableCell>
                            <TableCell>{r.renewalDate}</TableCell>
                            <TableCell className="font-bold">{r.daysAway}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  r.statusVariant === "red" && "border-red-300 text-red-700",
                                  r.statusVariant === "amber" && "border-amber-300 text-amber-700",
                                  r.statusVariant === "green" && "border-emerald-300 text-emerald-700",
                                )}
                              >
                                {r.statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant={
                                  r.actionVariant === "danger"
                                    ? "destructive"
                                    : r.actionVariant === "primary"
                                      ? "default"
                                      : "outline"
                                }
                                className="h-7 text-xs"
                                onClick={() =>
                                  customerActionMut.mutate({
                                    action: "renewal_follow_up",
                                    customerExternalId: r.customerId,
                                    note: r.actionLabel,
                                  })
                                }
                                disabled={customerActionMut.isPending}
                              >
                                {r.actionLabel}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <TablePagination
                      page={renewalsPagination.page}
                      totalPages={renewalsPagination.totalPages}
                      total={renewalsPagination.total}
                      startIndex={renewalsPagination.startIndex}
                      endIndex={renewalsPagination.endIndex}
                      pageSize={renewalsPagination.pageSize}
                      onPageChange={renewalsPagination.setPage}
                      onPageSizeChange={renewalsPagination.setPageSize}
                    />
                    </ResponsiveTableWrap>
                  </SectionCard>
                </>
              )}

              {view === "pricing" && (
                <>
                  <div className="grid md:grid-cols-3 gap-4">
                    {dashboard.pricing.plans.map((p) => (
                      <div
                        key={p.tier}
                        className={cn(
                          "rounded-xl border p-4",
                          p.popular && "border-2 border-primary",
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold">{p.name}</p>
                          {p.popular && (
                            <Badge className="text-[9px] bg-purple-100 text-purple-800">
                              Most popular
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{p.priceLabel}</p>
                        <p className="text-xs text-muted-foreground">{p.features}</p>
                        <Button
                          variant={p.popular ? "default" : "outline"}
                          size="sm"
                          className="mt-3"
                          onClick={() => setEditPlan(p)}
                        >
                          Edit plan
                        </Button>
                      </div>
                    ))}
                  </div>
                  <SectionCard
                    title="Discount rules"
                    action={
                      <Button variant="outline" size="sm" onClick={() => setDiscountRule("new")}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add rule
                      </Button>
                    }
                  >
                    <ResponsiveTableWrap minWidthClass="min-w-[900px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rule name</TableHead>
                          <TableHead>Applies to</TableHead>
                          <TableHead>Discount</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Who can apply</TableHead>
                          <TableHead>Auto?</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboard.pricing.discountRules.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell>{d.name}</TableCell>
                            <TableCell>{d.appliesTo}</TableCell>
                            <TableCell>{d.discount}</TableCell>
                            <TableCell>{d.duration}</TableCell>
                            <TableCell className="text-xs">{d.whoCanApply}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{d.automatic ? "Auto" : "Manual"}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="h-7" onClick={() => setDiscountRule(d)}>
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </ResponsiveTableWrap>
                  </SectionCard>
                </>
              )}

              {view === "billing" && (
                <>
                  {dataStatus && (!dataStatus.stripeConfigured || !dataStatus.emailConfigured) && (
                    <InfoAlert>
                      {!dataStatus.stripeConfigured && (
                        <>
                          <strong>Stripe</strong> — add <code className="text-[10px]">STRIPE_SECRET_KEY</code> to{" "}
                          <code className="text-[10px]">.env</code> to sync invoices. Optional{" "}
                          <code className="text-[10px]">STRIPE_WEBHOOK_SECRET</code> for live payment updates.
                          {!dataStatus.emailConfigured && " "}
                        </>
                      )}
                      {!dataStatus.emailConfigured && (
                        <>
                          <strong>Email</strong> — add{" "}
                          <code className="text-[10px]">RESEND_API_KEY</code> +{" "}
                          <code className="text-[10px]">INVITE_EMAIL_FROM</code>, or{" "}
                          <code className="text-[10px]">SMTP_PASSWORD</code>, to send grant and trial notifications.
                        </>
                      )}
                    </InfoAlert>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <KpiCard label="MRR" value={formatGbp(dashboard.billing.mrrPence)} sub={formatNewMrrSub(dashboard.billing.mrrMomPercent)} subTone="up" />
                    <KpiCard label="ARR (run rate)" value={formatGbp(dashboard.billing.arrPence)} sub="Annualised" />
                    <KpiCard label="Overdue invoices" value={dashboard.billing.overdueInvoices} sub={`${formatGbp(dashboard.billing.overdueAmountPence)} outstanding`} subTone="dn" />
                    <KpiCard
                      label="Free access cost"
                      value={formatGbp(dashboard.billing.freeAccessCostPence)}
                      sub={`${dashboard.billing.freeAccessCostPercent}% of MRR — near limit`}
                      subTone="warn"
                      valueClassName="text-amber-600"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <SectionCard title="Revenue by plan">
                      {dashboard.billing.revenueByPlan.map((r) => (
                        <UsageBar
                          key={r.tier}
                          label={r.label}
                          used={r.percent}
                          limit={100}
                          tone={r.tier === "enterprise" ? "primary" : r.tier === "growth" ? "blue" : "green"}
                        />
                      ))}
                      <UsageBar
                        label="Free access cost"
                        used={Math.round(dashboard.billing.freeAccessCostPercent)}
                        limit={100}
                        tone="amber"
                      />
                    </SectionCard>
                    <SectionCard title="MRR trend — 6 months">
                      <div className="flex items-end gap-2 h-24">
                        {dashboard.billing.mrrTrend.map((m, i) => {
                          const max = dashboard.billing.mrrTrend.at(-1)!.amountPence;
                          const h = Math.round((m.amountPence / max) * 100);
                          return (
                            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                              <div
                                className={cn(
                                  "w-full rounded-t min-h-[4px]",
                                  i === dashboard.billing.mrrTrend.length - 1
                                    ? "bg-primary"
                                    : "bg-primary/40",
                                )}
                                style={{ height: `${Math.max(h, 8)}%` }}
                              />
                              <span className="text-[9px] text-muted-foreground">{m.month}</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {mrrTrendGrowthLabel(dashboard.billing.mrrTrend)}
                      </p>
                    </SectionCard>
                  </div>
                  <SectionCard title="MRR waterfall — this month">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">New MRR</p>
                        <p className="font-bold text-emerald-600">
                          +{formatGbp(dashboard.billing.waterfall.newMrrPence)} ({dashboard.billing.waterfall.newCount})
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Expansion</p>
                        <p className="font-bold text-emerald-600">
                          +{formatGbp(dashboard.billing.waterfall.expansionMrrPence)} ({dashboard.billing.waterfall.expansionCount})
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Churn</p>
                        <p className="font-bold text-red-600">
                          −{formatGbp(dashboard.billing.waterfall.churnMrrPence)} ({dashboard.billing.waterfall.churnCount})
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Net new MRR</p>
                        <p className="font-bold">
                          {formatGbp(dashboard.billing.waterfall.netNewMrrPence)}
                        </p>
                      </div>
                    </div>
                  </SectionCard>
                  <SectionCard
                    title="Recent invoices"
                    action={
                      dataStatus?.stripeConfigured ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={stripeSyncMut.isPending}
                          onClick={() => stripeSyncMut.mutate()}
                        >
                          {stripeSyncMut.isPending ? "Syncing…" : "Sync from Stripe"}
                        </Button>
                      ) : undefined
                    }
                  >
                    <ResponsiveTableWrap minWidthClass="min-w-[960px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboard.billing.recentInvoices.map((inv) => (
                          <TableRow
                            key={inv.id}
                            className={inv.status === "overdue" ? "bg-red-50/50 dark:bg-red-950/20" : undefined}
                          >
                            <TableCell>{inv.customerName}</TableCell>
                            <TableCell>{formatGbp(inv.amountPence)}</TableCell>
                            <TableCell>{inv.dueDate}</TableCell>
                            <TableCell>
                              <Badge variant={inv.status === "overdue" ? "destructive" : "outline"}>
                                {inv.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </ResponsiveTableWrap>
                  </SectionCard>
                </>
              )}

              {view === "settings" && (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <SectionCard title="Trial & onboarding defaults">
                      <SettingsToggleRow
                        label="Default trial length"
                        control={
                          <Select
                            value={String(dashboard.settings.defaultTrialDays)}
                            onValueChange={(v) =>
                              saveSettingsMut.mutate({ defaultTrialDays: Number(v) })
                            }
                          >
                            <SelectTrigger className="w-32 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[14, 30, 60].map((d) => (
                                <SelectItem key={d} value={String(d)}>
                                  {d} days
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        }
                      />
                      <SettingsSwitchRow
                        label="Require credit card to start trial"
                        checked={dashboard.settings.requireCreditCardForTrial}
                        onChange={(v) => saveSettingsMut.mutate({ requireCreditCardForTrial: v })}
                      />
                      <SettingsSwitchRow
                        label="Allow self-serve signup (no sales call)"
                        checked={dashboard.settings.allowSelfServeSignup}
                        onChange={(v) => saveSettingsMut.mutate({ allowSelfServeSignup: v })}
                      />
                      <SettingsSwitchRow
                        label="Allow customer-initiated 14-day extension"
                        checked={dashboard.settings.allowCustomerExtension}
                        onChange={(v) => saveSettingsMut.mutate({ allowCustomerExtension: v })}
                      />
                      <SettingsSwitchRow
                        label="Auto-notify 7 days before trial expiry"
                        checked={dashboard.settings.notify7DaysBefore}
                        onChange={(v) => saveSettingsMut.mutate({ notify7DaysBefore: v })}
                      />
                      <SettingsSwitchRow
                        label="Auto-notify 1 day before trial expiry"
                        checked={dashboard.settings.notify1DayBefore}
                        onChange={(v) => saveSettingsMut.mutate({ notify1DayBefore: v })}
                      />
                      <SettingsSwitchRow
                        label="Auto-suspend on expiry if no payment"
                        checked={dashboard.settings.autoSuspendOnExpiry}
                        onChange={(v) => saveSettingsMut.mutate({ autoSuspendOnExpiry: v })}
                      />
                    </SectionCard>
                    <SectionCard title="Permission roles — sensitive actions">
                      <PermissionSettingsPanel dashboard={dashboard} onSave={(patch) => saveSettingsMut.mutate(patch)} />
                      <SettingsSwitchRow
                        label="Require written reason for all grants"
                        checked={dashboard.settings.requireGrantReason}
                        onChange={(v) => saveSettingsMut.mutate({ requireGrantReason: v })}
                      />
                    </SectionCard>
                  </div>
                  <SectionCard
                    title="Free access cost thresholds"
                    description="Alert when beta programmes and free access periods cost too much relative to MRR"
                  >
                    <InfoAlert>
                      Free access periods and beta programmes represent MRR you are not collecting.
                      These thresholds ensure you always know when that cost becomes significant.
                    </InfoAlert>
                    <div className="mt-4 space-y-3">
                      <SettingsToggleRow
                        label="Alert threshold (% of MRR)"
                        control={
                          <Select
                            value={String(dashboard.settings.freeAccessThresholdPercent ?? "none")}
                            onValueChange={(v) =>
                              saveSettingsMut.mutate({
                                freeAccessThresholdPercent: v === "none" ? null : Number(v),
                              })
                            }
                          >
                            <SelectTrigger className="w-full sm:w-36 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[10, 15, 20, 25].map((p) => (
                                <SelectItem key={p} value={String(p)}>
                                  {p}% of MRR
                                </SelectItem>
                              ))}
                              <SelectItem value="none">No threshold</SelectItem>
                            </SelectContent>
                          </Select>
                        }
                      />
                      <SettingsToggleRow
                        label="Who receives the alert"
                        control={
                          <Select
                            value={dashboard.settings.freeAccessAlertRecipients}
                            onValueChange={(v) =>
                              saveSettingsMut.mutate({
                                freeAccessAlertRecipients: v as "super_admin_commercial" | "super_admin_only",
                              })
                            }
                          >
                            <SelectTrigger className="w-full sm:w-52 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="super_admin_commercial">
                                SI Super Admin + Commercial Lead
                              </SelectItem>
                              <SelectItem value="super_admin_only">SI Super Admin only</SelectItem>
                            </SelectContent>
                          </Select>
                        }
                      />
                      <SettingsToggleRow
                        label="Alert frequency"
                        control={
                          <Select
                            value={dashboard.settings.freeAccessAlertFrequency}
                            onValueChange={(v) =>
                              saveSettingsMut.mutate({
                                freeAccessAlertFrequency: v as "daily" | "once" | "weekly",
                              })
                            }
                          >
                            <SelectTrigger className="w-full sm:w-52 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Every day while over threshold</SelectItem>
                              <SelectItem value="once">Once when threshold first breached</SelectItem>
                              <SelectItem value="weekly">Weekly summary</SelectItem>
                            </SelectContent>
                          </Select>
                        }
                      />
                      <SettingsSwitchRow
                        label="Show cost alert banner in Billing overview"
                        checked={dashboard.settings.showBillingCostAlert}
                        onChange={(v) => saveSettingsMut.mutate({ showBillingCostAlert: v })}
                      />
                      <SettingsSwitchRow
                        label="Show cost alert banner in Beta programmes"
                        checked={dashboard.settings.showProgrammesCostAlert}
                        onChange={(v) => saveSettingsMut.mutate({ showProgrammesCostAlert: v })}
                      />
                      <SettingsSwitchRow
                        label="Block new programme creation when over threshold"
                        checked={dashboard.settings.blockNewProgrammesOverThreshold}
                        onChange={(v) =>
                          saveSettingsMut.mutate({ blockNewProgrammesOverThreshold: v })
                        }
                      />
                      <div className="rounded-lg bg-muted/50 p-3 text-xs">
                        <strong>Current status:</strong> Free access cost this month:{" "}
                        <strong className="text-amber-600">
                          {formatGbp(dashboard.billing.freeAccessCostPence)} (
                          {dashboard.billing.freeAccessCostPercent}% of MRR)
                        </strong>
                        {dashboard.billing.thresholdBreached && (
                          <span className="text-red-600 font-semibold"> · Alert active</span>
                        )}
                      </div>
                    </div>
                  </SectionCard>
                  <SectionCard title="Billing configuration">
                    <SettingsToggleRow label="Payment processor" control={<Badge>Stripe</Badge>} />
                    <SettingsToggleRow
                      label="Invoice due date"
                      control={
                        <Select
                          value={String(dashboard.settings.invoiceDueDays)}
                          onValueChange={(v) => saveSettingsMut.mutate({ invoiceDueDays: Number(v) })}
                        >
                          <SelectTrigger className="w-28 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[7, 14, 30].map((d) => (
                              <SelectItem key={d} value={String(d)}>
                                {d} days
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      }
                    />
                    <SettingsSwitchRow
                      label="Auto-retry failed payments"
                      checked={dashboard.settings.autoRetryPayments}
                      onChange={(v) => saveSettingsMut.mutate({ autoRetryPayments: v })}
                    />
                    <SettingsToggleRow
                      label="Retry schedule"
                      control={
                        <Select
                          value={dashboard.settings.retrySchedule}
                          onValueChange={(v) => saveSettingsMut.mutate({ retrySchedule: v })}
                        >
                          <SelectTrigger className="w-full sm:w-36 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1, 3, 7 days">1, 3, 7 days</SelectItem>
                            <SelectItem value="3, 7, 14 days">3, 7, 14 days</SelectItem>
                          </SelectContent>
                        </Select>
                      }
                    />
                    <SettingsSwitchRow
                      label="Suspend on 3rd failed payment attempt"
                      checked={dashboard.settings.suspendOnThirdFailedPayment}
                      onChange={(v) =>
                        saveSettingsMut.mutate({ suspendOnThirdFailedPayment: v })
                      }
                    />
                  </SectionCard>
                </>
              )}
          </div>
        </div>
      </main>

      <GrantAccessModal open={grantOpen} onOpenChange={setGrantOpen} target={grantTarget} />
      <CreateProgrammeModal
        open={createProgrammeOpen}
        onOpenChange={setCreateProgrammeOpen}
        blocked={programmesBlocked}
      />
      <ManageParticipantsModal
        open={manageProgramme !== null}
        onOpenChange={(open) => !open && setManageProgramme(null)}
        programme={manageProgramme}
      />
      <ChangePlanModal
        open={changePlanOpen}
        onOpenChange={setChangePlanOpen}
        customer={detail ?? null}
      />
      <AddDiscountModal
        open={addDiscountOpen}
        onOpenChange={setAddDiscountOpen}
        customer={detail ?? null}
      />
      <EditPlanModal open={editPlan !== null} onOpenChange={(open) => !open && setEditPlan(null)} plan={editPlan} />
      <AddCustomerModal open={addCustomerOpen} onOpenChange={setAddCustomerOpen} />
      <AddContactModal
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
        customerName={detail?.name}
        customerSlug={selectedSlug}
      />
      <EditCustomerModal
        open={editCustomerOpen}
        onOpenChange={setEditCustomerOpen}
        customer={detail ?? null}
      />
      <DiscountRuleModal
        open={discountRule !== null}
        onOpenChange={(open) => !open && setDiscountRule(null)}
        rule={discountRule === "new" ? null : discountRule}
      />
    </div>
  );
}

function TrialDefaultsPanel({
  dashboard,
  onSave,
}: {
  dashboard: CustomerMgmtDashboard;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  return (
    <>
      <SettingsToggleRow
        label="Default trial length"
        control={
          <Select
            value={String(dashboard.settings.defaultTrialDays)}
            onValueChange={(v) => onSave({ defaultTrialDays: Number(v) })}
          >
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[14, 30, 60].map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SettingsSwitchRow
        label="Allow self-serve 14-day extension (one-time, customer-initiated)"
        checked={dashboard.settings.allowCustomerExtension}
        onChange={(v) => onSave({ allowCustomerExtension: v })}
      />
      <SettingsSwitchRow
        label="Auto-notify customer 7 days before expiry"
        checked={dashboard.settings.notify7DaysBefore}
        onChange={(v) => onSave({ notify7DaysBefore: v })}
      />
      <SettingsSwitchRow
        label="Auto-notify customer 1 day before expiry"
        checked={dashboard.settings.notify1DayBefore}
        onChange={(v) => onSave({ notify1DayBefore: v })}
      />
      <SettingsToggleRow
        label="Who can grant trial extensions"
        control={
          <Select
            value={dashboard.settings.grantTrialExtensions}
            onValueChange={(v) => onSave({ grantTrialExtensions: v })}
          >
            <SelectTrigger className="w-full sm:w-52 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="super_admin_commercial">SI Super Admin + Commercial Lead</SelectItem>
              <SelectItem value="super_admin_only">SI Super Admin only</SelectItem>
              <SelectItem value="any_si_admin">Any SI admin</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <SettingsToggleRow
        label="Who can grant free access periods (paid → free credit)"
        control={
          <Select
            value={dashboard.settings.grantFreeAccess}
            onValueChange={(v) => onSave({ grantFreeAccess: v })}
          >
            <SelectTrigger className="w-full sm:w-52 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="super_admin_only">SI Super Admin only</SelectItem>
              <SelectItem value="super_admin_commercial">SI Super Admin + Commercial Lead</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <SettingsSwitchRow
        label="Require written reason for every grant"
        checked={dashboard.settings.requireGrantReason}
        onChange={(v) => onSave({ requireGrantReason: v })}
      />
      <SettingsToggleRow
        label="Maximum extension without CEO approval"
        control={
          <Select
            value={dashboard.settings.maxExtensionWithoutCeo}
            onValueChange={(v) => onSave({ maxExtensionWithoutCeo: v })}
          >
            <SelectTrigger className="w-full sm:w-36 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1_month">1 month</SelectItem>
              <SelectItem value="3_months">3 months</SelectItem>
              <SelectItem value="6_months">6 months</SelectItem>
              <SelectItem value="no_limit">No limit</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </>
  );
}

function PermissionSettingsPanel({
  dashboard,
  onSave,
}: {
  dashboard: CustomerMgmtDashboard;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  return (
    <>
      <SettingsToggleRow
        label="Grant trial extensions"
        control={
          <Select
            value={dashboard.settings.grantTrialExtensions}
            onValueChange={(v) => onSave({ grantTrialExtensions: v })}
          >
            <SelectTrigger className="w-full sm:w-52 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="super_admin_commercial">SI Super Admin + Commercial Lead</SelectItem>
              <SelectItem value="super_admin_only">SI Super Admin only</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <SettingsToggleRow
        label="Grant free access periods (paid → free)"
        control={
          <Select
            value={dashboard.settings.grantFreeAccess}
            onValueChange={(v) => onSave({ grantFreeAccess: v })}
          >
            <SelectTrigger className="w-full sm:w-52 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="super_admin_only">SI Super Admin only</SelectItem>
              <SelectItem value="super_admin_commercial">SI Super Admin + Commercial Lead</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <SettingsToggleRow
        label="Create beta programmes"
        control={
          <Select
            value={dashboard.settings.createBetaProgrammes}
            onValueChange={(v) => onSave({ createBetaProgrammes: v })}
          >
            <SelectTrigger className="w-full sm:w-52 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="super_admin_only">SI Super Admin only</SelectItem>
              <SelectItem value="super_admin_commercial">SI Super Admin + Commercial Lead</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <SettingsToggleRow
        label="Apply manual discounts"
        control={
          <Select
            value={dashboard.settings.applyManualDiscounts}
            onValueChange={(v) => onSave({ applyManualDiscounts: v })}
          >
            <SelectTrigger className="w-full sm:w-52 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="super_admin_commercial">SI Super Admin + Commercial Lead</SelectItem>
              <SelectItem value="super_admin_only">SI Super Admin only</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <SettingsToggleRow
        label="Suspend or delete a customer"
        control={
          <Select
            value={dashboard.settings.suspendCustomer}
            onValueChange={(v) => onSave({ suspendCustomer: v })}
          >
            <SelectTrigger className="w-full sm:w-52 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="super_admin_only">SI Super Admin only</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <SettingsToggleRow
        label="Max extension without CEO approval"
        control={
          <Select
            value={dashboard.settings.maxExtensionWithoutCeo}
            onValueChange={(v) => onSave({ maxExtensionWithoutCeo: v })}
          >
            <SelectTrigger className="w-full sm:w-36 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1_month">1 month</SelectItem>
              <SelectItem value="3_months">3 months</SelectItem>
              <SelectItem value="6_months">6 months</SelectItem>
              <SelectItem value="no_limit">No limit</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </>
  );
}

function SettingsToggleRow({
  label,
  control,
}: {
  label: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-border/40 last:border-0 gap-2 sm:gap-4">
      <span className="text-sm">{label}</span>
      <div className="w-full sm:w-auto shrink-0">{control}</div>
    </div>
  );
}

function SettingsSwitchRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-border/40 last:border-0 gap-2 sm:gap-4">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} className="shrink-0" />
    </div>
  );
}
