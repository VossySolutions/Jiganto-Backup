import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CircleHelp, Info } from "lucide-react";
import type { AvatarColor, DsCell } from "./types";

/** Module accent — matches sidebar colour (#4338CA). */
export const RP_ACCENT = "#4338CA";

/** Tooltip copy for resource-planning KPI labels. */
export const RP_KPI_HELP: Record<string, string> = {
  "Total Capacity": "Active resources available for allocation this period.",
  "Billable Utilisation": "Billable hours divided by available hours vs target.",
  "Forecast Revenue": "Probability-weighted pipeline revenue from CRM deals.",
  "On Bench": "Resources with zero allocation this week.",
  "Open Skills Gaps": "Skill shortages vs confirmed and pipeline demand.",
  "Skills Tracked": "Distinct skills mapped across practice areas.",
  "Critical Shortages": "Skills with urgent demand in the forecast window.",
  "Confirmed Demand": "Headcount required from signed or confirmed work.",
  "Pipeline Demand": "Probability-weighted headcount from CRM pipeline.",
  "Active Opportunities": "Open CRM opportunities driving resource demand.",
  "Soft Demand (weighted)": "Expected headcount after stage probability weighting.",
  "At-risk opportunities": "Deals where capacity may not meet delivery dates.",
  "Avg probability": "Mean win probability across active pipeline deals.",
  "On Bench Today": "Resources unallocated today as a share of capacity.",
  "Rolling off (30 days)": "Assignments ending within 30 days unless rebooked.",
  "Bench Cost / Month": "Estimated monthly salary cost for unbillable bench time.",
  "Redeployable": "Bench resources matched to open demand profiles.",
  "Expected Revenue": "Scenario revenue from weighted pipeline.",
  "Resource Demand": "Headcount needed if scenario assumptions hold.",
  "Utilisation Forecast": "Projected utilisation after planned actions.",
  "Shortfall": "Gap between demand and supply requiring action.",
};

const AVATAR_COLORS: Record<AvatarColor, string> = {
  brand: "bg-indigo-600",
  teal: "bg-teal-600",
  green: "bg-emerald-600",
  amber: "bg-amber-500",
  violet: "bg-violet-600",
  red: "bg-red-600",
};

export function RpAvatar({ initials, color, size = "md" }: { initials: string; color: AvatarColor; size?: "sm" | "md" }) {
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-bold shrink-0",
        AVATAR_COLORS[color],
        size === "sm" ? "w-5 h-5 text-[8px]" : "w-7 h-7 text-[10px]",
      )}
    >
      {initials}
    </div>
  );
}

/** Inline toolbar for tab-level filters/actions (no duplicate tab title). */
export function RpTabToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2", className)}>
      {children}
    </div>
  );
}

export function RpKpiCard({
  label,
  value,
  sub,
  accent = RP_ACCENT,
  valueColor,
  helpText,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  valueColor?: string;
  helpText?: string;
}) {
  const tip = helpText ?? RP_KPI_HELP[label];
  return (
    <Card className="rounded-xl border-border/50 overflow-hidden hover:shadow-sm transition-shadow">
      <div className="h-1" style={{ backgroundColor: accent }} />
      <CardContent className="p-4">
        <div className="flex items-center gap-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {tip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground shrink-0" aria-label={`About ${label}`}>
                  <CircleHelp className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
                {tip}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <p className="text-xl sm:text-2xl font-bold mt-1 tabular-nums" style={valueColor ? { color: valueColor } : undefined}>
          {value}
        </p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function RpAlertBanner({
  variant = "destructive",
  children,
  action,
}: {
  variant?: "destructive" | "info";
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Alert
      variant={variant === "destructive" ? "destructive" : "default"}
      className={cn(
        "mb-0",
        variant === "info" && "border-blue-500/30 bg-blue-500/5 text-blue-900 dark:text-blue-200",
        variant === "destructive" && "border-destructive/30 bg-destructive/5",
      )}
    >
      {variant === "destructive" ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4 text-blue-600" />}
      <AlertDescription className="text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="flex-1">{children}</span>
        {action}
      </AlertDescription>
    </Alert>
  );
}

export function RpDsCell({ value, type }: { value: string; type: DsCell }) {
  const styles: Record<DsCell, string> = {
    surplus: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    shortage: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
    watch: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    ok: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("inline-flex min-w-[40px] justify-center px-1.5 py-0.5 rounded-md text-xs font-semibold", styles[type])}>
      {value}
    </span>
  );
}

export function RpHmCell({ value, type }: { value: string | number; type: string }) {
  const styles: Record<string, string> = {
    green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    red: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
    grey: "bg-muted text-muted-foreground",
    blue: "bg-blue-100 text-blue-800 border-2 border-dashed border-blue-400 dark:bg-blue-950/50 dark:text-blue-300",
  };
  return (
    <div className={cn("h-6 rounded flex items-center justify-center text-[9px] font-bold", styles[type] ?? styles.grey)}>
      {value}
    </div>
  );
}

export function RpStatusPill({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "destructive" | "info" | "muted";
}) {
  const map = {
    default: "bg-primary/10 text-primary border-primary/20",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    info: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    muted: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px] font-semibold px-2 py-0", map[variant])}>
      {children}
    </Badge>
  );
}

export function RpSectionCard({
  title,
  subtitle,
  children,
  headerRight,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerRight?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-xl border-border/50 shadow-sm overflow-hidden", className)}>
      <CardHeader className="py-3 px-4 sm:px-6 border-b border-border/40 flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-sm font-bold">{title}</CardTitle>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {headerRight}
      </CardHeader>
      <CardContent className="p-4 sm:p-6">{children}</CardContent>
    </Card>
  );
}

/** @deprecated Use RpSectionCard */
export const RpCard = RpSectionCard;

export function RpSkillBar({ level, name }: { level: number; name: string }) {
  const color = level >= 100 ? "bg-indigo-600" : level >= 75 ? "bg-teal-500" : level >= 50 ? "bg-amber-500" : "bg-muted-foreground/40";
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden shrink-0">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${level}%` }} />
      </div>
      <span className="truncate">{name}</span>
    </div>
  );
}

export function RpScenarioTabs({
  options,
  value,
  onChange,
  className,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex p-0.5 bg-muted rounded-lg gap-0.5", className)}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
            value === opt ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function RpDemandBar({ role, count, pct, color }: { role: string; count: number; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold min-w-[120px] truncate">{role}</span>
      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold min-w-6 text-right tabular-nums">{count}</span>
    </div>
  );
}

export function RpUtilRing({ pct, colorClass }: { pct: number; colorClass: string }) {
  const circumference = 2 * Math.PI * 32;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted" />
        <circle
          cx="40"
          cy="40"
          r="32"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={colorClass}
        />
      </svg>
      <div className={cn("absolute inset-0 flex items-center justify-center text-sm font-extrabold", colorClass)}>
        {pct}%
      </div>
    </div>
  );
}

export function RpMiniChart({ values, accent = RP_ACCENT }: { values: number[]; accent?: string }) {
  const max = Math.max(...values);
  return (
    <div className="flex items-end gap-1.5 h-32 sm:h-36">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t min-w-3 bg-primary/80"
          style={{ height: `${(v / max) * 100}%`, backgroundColor: i % 2 === 0 ? accent : `${accent}66` }}
          title={`${v}`}
        />
      ))}
    </div>
  );
}

export function RpTableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1 scrollbar-thin">
      <div className="min-w-[640px]">{children}</div>
    </div>
  );
}

export function RpProgressRow({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground">{count} resources</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
