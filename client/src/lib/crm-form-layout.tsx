import { useState, type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

export function CrmFormDivider() {
  return <div className="h-px bg-slate-100 dark:bg-border/40 my-5" />;
}

export function CrmFormSection({
  icon,
  iconClassName,
  title,
  tag,
  className,
  children,
}: {
  icon?: ReactNode;
  iconClassName?: string;
  title: string;
  tag?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("mb-5", className)}>
      <div className="flex items-center gap-2 mb-3">
        {icon != null && (
          <div
            className={cn(
              "w-[22px] h-[22px] rounded-md flex items-center justify-center text-xs shrink-0",
              iconClassName ?? "bg-slate-100 dark:bg-muted",
            )}
          >
            {icon}
          </div>
        )}
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{title}</h3>
        {tag && <span className="text-[10px] text-muted-foreground font-semibold ml-auto">{tag}</span>}
      </div>
      {children}
    </section>
  );
}

export function CrmFieldGrid({
  cols = 2,
  children,
  className,
}: {
  cols?: 1 | 2 | 3;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-3.5",
        cols === 1 && "grid-cols-1",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 3 && "grid-cols-1 sm:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CrmFieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
      {children}
      {required && <span className="text-red-600">*</span>}
    </Label>
  );
}

export function CrmRatingPills({
  value,
  onChange,
}: {
  value: string;
  onChange: (rating: string) => void;
}) {
  const options = [
    { id: "hot", label: "Hot", on: "bg-red-50 border-red-500 text-red-700 dark:bg-red-950/30 dark:text-red-400", off: "border-red-200" },
    { id: "warm", label: "Warm", on: "bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400", off: "border-amber-200" },
    { id: "cold", label: "Cold", on: "bg-blue-50 border-blue-600 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400", off: "border-blue-200" },
  ] as const;

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(value === opt.id ? "" : opt.id)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-bold border-[1.5px] transition-colors capitalize",
            value === opt.id ? opt.on : cn("bg-background text-muted-foreground", opt.off, "hover:bg-muted/40"),
          )}
          data-testid={`select-rating-${opt.id}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function CrmScoreBar({
  value,
  onChange,
}: {
  value: number;
  onChange: (score: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2.5">
        <div className="flex-1 h-2 bg-slate-100 dark:bg-muted rounded overflow-hidden">
          <div
            className="h-full rounded bg-gradient-to-r from-amber-500 to-emerald-600 transition-all"
            style={{ width: `${value}%` }}
          />
        </div>
        <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums min-w-[30px]">
          {value || "—"}
        </span>
      </div>
      <Input
        type="number"
        min={0}
        max={100}
        value={value || ""}
        onChange={(e) => onChange(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
        className="h-9"
        data-testid="input-lead-score-slider"
      />
    </div>
  );
}

export function CrmProbBar({ value }: { value: number }) {
  return (
    <div className="h-2 bg-indigo-100 dark:bg-indigo-950/40 rounded overflow-hidden mt-1.5">
      <div
        className="h-full rounded bg-gradient-to-r from-amber-500 to-emerald-600 transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function CrmFollowUpCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/50 rounded-[10px] p-3.5 flex flex-col sm:flex-row gap-3.5 sm:items-end">
      {children}
    </div>
  );
}

export function CrmFormHeader({
  title,
  subtitle,
  onClose,
  showClose = true,
}: {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  showClose?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-slate-100 dark:border-border/50 shrink-0">
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      </div>
      {showClose && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-slate-100 dark:hover:bg-muted shrink-0"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function CrmFormFooter({
  meta,
  onCancel,
  saveLabel,
  saving,
  disabled,
  saveTestId,
}: {
  meta?: string;
  onCancel: () => void;
  saveLabel: string;
  saving?: boolean;
  disabled?: boolean;
  saveTestId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-border/50 bg-slate-50 dark:bg-muted/20 rounded-b-2xl shrink-0">
      <span className="text-[11px] text-muted-foreground">{meta}</span>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving} className="font-bold">
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={disabled || saving}
          className="font-bold bg-blue-600 hover:bg-blue-700 text-white"
          data-testid={saveTestId}
        >
          {saving ? "Saving…" : saveLabel}
        </Button>
      </div>
    </div>
  );
}

export function CrmDealTypeToggle({
  mode,
  onChange,
}: {
  mode: "onetime" | "subscription";
  onChange: (mode: "onetime" | "subscription") => void;
}) {
  return (
    <div className="inline-flex bg-slate-100 dark:bg-muted rounded-[9px] p-0.5 mb-4">
      {(["onetime", "subscription"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "px-4 py-1.5 rounded-[7px] text-xs font-bold transition-all",
            mode === opt
              ? "bg-background text-blue-700 dark:text-blue-400 shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt === "onetime" ? "One-time deal" : "Subscription"}
        </button>
      ))}
    </div>
  );
}

export function CrmForecastZone({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[14px] border-[1.5px] border-indigo-200 dark:border-indigo-800/50 bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 p-4 sm:p-5">
      {children}
    </div>
  );
}

export function CrmStageChips({
  stages,
  value,
  onChange,
  onAddStage,
  addingStage,
}: {
  stages: { id: number; name: string; probability?: number | null }[];
  value: string;
  onChange: (stageId: string) => void;
  onAddStage?: (name: string, probability: number) => void;
  addingStage?: boolean;
}) {
  const [showConfig, setShowConfig] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProb, setNewProb] = useState("");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {stages.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(String(s.id))}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold border-[1.5px] transition-colors",
              value === String(s.id)
                ? "bg-blue-700 border-blue-700 text-white"
                : "bg-background border-border text-muted-foreground hover:border-blue-300",
            )}
            data-testid={`stage-chip-${s.id}`}
          >
            {s.name}
          </button>
        ))}
        {onAddStage && (
          <button
            type="button"
            onClick={() => setShowConfig((v) => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border-[1.5px] border-dashed border-blue-600 text-blue-600 bg-blue-50 dark:bg-blue-950/30"
          >
            + Add stage
          </button>
        )}
      </div>
      {showConfig && onAddStage && (
        <div className="flex flex-wrap gap-2 items-end bg-slate-50 dark:bg-muted/30 border rounded-lg p-2.5">
          <div className="flex-1 min-w-[120px] space-y-1">
            <CrmFieldLabel>Stage name</CrmFieldLabel>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Legal review" />
          </div>
          <div className="w-28 space-y-1">
            <CrmFieldLabel>Default %</CrmFieldLabel>
            <Input type="number" min={0} max={100} value={newProb} onChange={(e) => setNewProb(e.target.value)} placeholder="65" />
          </div>
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowConfig(false)}>Cancel</Button>
            <Button
              type="button"
              size="sm"
              disabled={!newName.trim() || addingStage}
              onClick={() => {
                onAddStage(newName.trim(), parseInt(newProb, 10) || 0);
                setNewName("");
                setNewProb("");
                setShowConfig(false);
              }}
            >
              Add stage
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export const FORECAST_CATEGORIES = [
  { value: "pipeline", label: "Pipeline" },
  { value: "best_case", label: "Best case" },
  { value: "commit", label: "Commit" },
  { value: "closed", label: "Closed" },
] as const;

export function CrmForecastCategoryPills({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {FORECAST_CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          type="button"
          onClick={() => onChange(cat.value)}
          className={cn(
            "px-3 py-1.5 rounded-full text-[11.5px] font-bold border-[1.5px] transition-colors",
            value === cat.value
              ? "bg-blue-600 border-blue-600 text-white"
              : "bg-background border-indigo-200 text-muted-foreground hover:border-blue-400",
          )}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}

export function formatCrmRecordMeta(createdAt?: string | null, updatedAt?: string | null): string {
  if (!createdAt && !updatedAt) return "";
  const created = createdAt
    ? new Date(createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const updated = updatedAt
    ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true })
    : null;
  if (created && updated) return `Created ${created} · Last updated ${updated}`;
  if (created) return `Created ${created}`;
  if (updated) return `Last updated ${updated}`;
  return "";
}

export function formatWeightedForecast(amount: string, probability: number, currency = "$"): string {
  const n = parseFloat(amount);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const weighted = Math.round(n * probability / 100);
  return `${currency}${weighted.toLocaleString()}`;
}