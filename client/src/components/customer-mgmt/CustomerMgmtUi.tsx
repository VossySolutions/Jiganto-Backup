import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import {
  formatGbp,
  healthBandLabel,
  planBadgeClass,
  type CommercialCustomer,
  type CommercialPlanTier,
  type HealthBand,
} from "@shared/models/customer-mgmt";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { AlertTriangle, Info, Lock, Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlatformRole } from "@shared/models/permissions";

export const CUSTOMER_MGMT_COLOR = "#534AB7";

export const CUSTOMER_KPI_HELP: Record<string, string> = {
  "Active customers": "Paying or active commercial tenants on a live plan.",
  "On trial / extension": "Customers on trial, admin extension, or free-access period.",
  "Monthly recurring revenue": "Normalised monthly subscription revenue (MRR).",
  "At-risk customers": "Accounts with health score in the red band (0–39).",
  "Healthy (70–100)": "Customers with strong product usage and engagement signals.",
  "Watch (40–69)": "Customers needing CSM outreach before health declines.",
  "At risk (0–39)": "Customers requiring urgent retention intervention.",
  "Average health score": "Mean composite health score across all active customers.",
  "Standard trials": "Self-serve 30-day trials started automatically.",
  "Admin extensions": "Trial extensions granted manually by staff.",
  "Free access periods": "Paid customers moved to complimentary credit periods.",
  "Expiring this week": "Trials or extensions ending within 7 days.",
  "Trial → paid (90d)": "Share of trials that converted to paid in the last 90 days.",
  "Active programmes": "Beta or pilot programmes currently running.",
  "Total participants": "Organisations enrolled across all programmes.",
  "Free access cost": "Estimated monthly cost of complimentary access.",
  "Converted to paid": "Programme participants who moved to a paid plan.",
  "Renewing in 30 days": "MRR from contracts renewing within 30 days.",
  "Renewing in 31–90 days": "MRR from contracts renewing in 31–90 days.",
  "At-risk renewals": "Renewals where customer health is below 40.",
  "Expected renewal rate": "Forecast renewal rate based on current health scores.",
  MRR: "Monthly recurring revenue from active subscriptions.",
  "ARR (run rate)": "Annualised recurring revenue at current MRR.",
  "Overdue invoices": "Unpaid invoices past their due date.",
};

export function AsyncButton({
  pending,
  children,
  className,
  ...props
}: ComponentProps<typeof Button> & { pending?: boolean }) {
  return (
    <Button className={className} {...props} disabled={pending || props.disabled}>
      {pending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
      {children}
    </Button>
  );
}

export function invalidateCommercialQueries(customerSlug?: string) {
  void queryClient.invalidateQueries({ queryKey: ["/api/customer-mgmt/dashboard"] });
  void queryClient.invalidateQueries({ queryKey: ["/api/customer-mgmt/status"] });
  if (customerSlug) {
    void queryClient.invalidateQueries({
      queryKey: ["/api/customer-mgmt/customers", customerSlug],
    });
  } else {
    void queryClient.invalidateQueries({ queryKey: ["/api/customer-mgmt/customers"] });
  }
}

export function OrgAvatar({
  initials,
  color,
  size = "md",
  className,
}: {
  initials: string;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass =
    size === "sm" ? "h-5 w-5 text-[9px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-7 w-7 text-[10px]";
  return (
    <div
      className={cn(
        "rounded-full inline-flex items-center justify-center font-bold text-white shrink-0",
        sizeClass,
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

export function HealthDot({ band }: { band: HealthBand }) {
  const color =
    band === "healthy" ? "bg-emerald-500" : band === "watch" ? "bg-amber-500" : "bg-red-500";
  return <span className={cn("inline-block h-2 w-2 rounded-full mr-1.5 shrink-0", color)} />;
}

export function PlanBadge({ plan }: { plan: CommercialPlanTier }) {
  return (
    <Badge variant="outline" className={cn("font-semibold text-[10px]", planBadgeClass(plan))}>
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </Badge>
  );
}

export function HealthBadge({ band, score }: { band: HealthBand; score: number }) {
  const text =
    band === "healthy"
      ? "text-emerald-700 dark:text-emerald-300"
      : band === "watch"
        ? "text-amber-700 dark:text-amber-300"
        : "text-red-700 dark:text-red-300";
  return (
    <span className={cn("inline-flex items-center text-[11px] font-semibold", text)}>
      <HealthDot band={band} />
      {healthBandLabel(band, score)}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  subTone,
  valueClassName,
  icon: Icon,
  color = CUSTOMER_MGMT_COLOR,
  helpText,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  subTone?: "up" | "warn" | "dn" | "neutral";
  valueClassName?: string;
  icon?: LucideIcon;
  color?: string;
  helpText?: string;
}) {
  return (
    <MetricCard
      title={label}
      value={value}
      subtitle={sub}
      helpText={helpText ?? CUSTOMER_KPI_HELP[label]}
      icon={Icon}
      iconBgClassName={Icon ? "bg-muted" : undefined}
      borderColor={color}
      valueClassName={valueClassName}
    />
  );
}

export function UsageBar({
  label,
  used,
  limit,
  tone = "primary",
}: {
  label: string;
  used: number;
  limit: number;
  tone?: "primary" | "green" | "amber" | "red" | "blue";
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const fill =
    tone === "green"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : tone === "red"
          ? "bg-red-500"
          : tone === "blue"
            ? "bg-blue-500"
            : "bg-primary";
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 text-[11px]">
      <span className="text-muted-foreground sm:min-w-[88px] shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-[80px]">
          <div className={cn("h-full rounded-full", fill)} style={{ width: `${pct}%` }} />
        </div>
        <span className="font-semibold tabular-nums min-w-[36px] text-right shrink-0">{used}</span>
      </div>
    </div>
  );
}

export function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between py-2 border-b border-border/50 last:border-0 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-semibold sm:text-right break-words">{value}</span>
    </div>
  );
}

export function CostAlertBanner({
  title,
  description,
  percent,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  percent?: number;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">{title}</p>
        <p className="text-xs text-amber-900/80 dark:text-amber-100/70 mt-0.5">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto shrink-0">
        {percent != null && (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300">
            {percent}% of MRR
          </Badge>
        )}
        {actionLabel && onAction && (
          <Button size="sm" variant="outline" className="border-amber-400 text-amber-800" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export function canGrantCommercialAccess(
  platformRole: PlatformRole | undefined,
  isJigantoStaff: boolean,
): boolean {
  return isJigantoStaff || platformRole === "si_super_admin";
}

export function PermissionAlert() {
  return (
    <div className="rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-start gap-3">
      <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-900/90 dark:text-amber-100/80">
        <strong>Permission required.</strong> Only SI Super Admin and Commercial Lead roles can grant
        access extensions. This action is permanently logged to the audit trail with your name, role,
        and reason.
      </p>
    </div>
  );
}

export function GrantAuditNotice() {
  return (
    <InfoAlert>
      <strong>Audit trail.</strong> This action is permanently logged with your name, role, and reason.
    </InfoAlert>
  );
}

export function InfoAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 flex items-start gap-3 min-w-0">
      <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
      <p className="text-xs text-blue-900/90 dark:text-blue-100/80 min-w-0 break-words [&_code]:break-all">
        {children}
      </p>
    </div>
  );
}

export function ResponsiveTableWrap({
  children,
  minWidthClass = "min-w-[720px]",
  hint = true,
}: {
  children: React.ReactNode;
  minWidthClass?: string;
  hint?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="overflow-x-auto -mx-1 px-1 overscroll-x-contain touch-pan-x scrollbar-thin">
        <div className={cn("w-full", minWidthClass)}>{children}</div>
      </div>
      {hint && (
        <p className="text-[10px] text-muted-foreground mt-1.5 md:hidden">
          Swipe horizontally to see all columns
        </p>
      )}
    </div>
  );
}

export function CustomerOrgCell({
  customer,
}: {
  customer: Pick<CommercialCustomer, "name" | "initials" | "avatarColor" | "domain" | "userCount">;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <OrgAvatar initials={customer.initials} color={customer.avatarColor} />
      <div className="min-w-0">
        <div className="font-semibold truncate">{customer.name}</div>
        <div className="text-[10px] text-muted-foreground truncate">
          {customer.userCount} users · {customer.domain}
        </div>
      </div>
    </div>
  );
}

export function MrrCell({ pence }: { pence: number | null }) {
  if (pence == null) return <span className="text-muted-foreground">—</span>;
  return <span className="font-bold tabular-nums">{formatGbp(pence)}</span>;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-xl border bg-card shadow-sm", className)}>
      <CardHeader className="py-3 px-4 sm:px-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 space-y-0 border-b border-border/40">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {description && <CardDescription className="text-xs mt-0.5">{description}</CardDescription>}
        </div>
        {action && <div className="shrink-0 w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">{action}</div>}
      </CardHeader>
      <CardContent className="px-4 sm:px-5 py-4">{children}</CardContent>
    </Card>
  );
}

export function rowHighlightClass(highlight?: "warn" | "danger") {
  if (highlight === "danger") return "bg-red-50/60 dark:bg-red-950/20";
  if (highlight === "warn") return "bg-amber-50/50 dark:bg-amber-950/15";
  return undefined;
}
