import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSurveyColors } from "@/lib/survey-constants";

type Props = {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  inline?: boolean;
};

export function SurveyLoadingState({ label = "Loading…", className, size = "md", inline }: Props) {
  const C = useSurveyColors();
  const iconSize = size === "sm" ? 18 : size === "lg" ? 40 : 28;
  const padding = inline ? "" : size === "sm" ? "py-6" : size === "lg" ? "py-16" : "py-12";
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-2.5", padding, className)}
      data-testid="survey-loading"
      role="status"
      aria-live="polite"
    >
      <Loader2 style={{ width: iconSize, height: iconSize, color: C.teal }} className="animate-spin" />
      {label && <p style={{ fontSize: 13, color: C.ink4, margin: 0 }}>{label}</p>}
    </div>
  );
}

export function SurveyCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="survey-card-grid" data-testid="survey-skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="survey-skeleton-card">
          <div className="survey-skeleton-line w-2/3 h-5" />
          <div className="survey-skeleton-line w-full h-4 mt-3" />
          <div className="survey-skeleton-line w-1/2 h-4 mt-2" />
        </div>
      ))}
    </div>
  );
}

export function SurveyRowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div data-testid="survey-skeleton-rows">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="survey-skeleton-row">
          <div className="survey-skeleton-avatar" />
          <div style={{ flex: 1 }}>
            <div className="survey-skeleton-line w-2/5 h-4" />
            <div className="survey-skeleton-line w-3/5 h-3 mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SurveyKpiSkeleton() {
  return (
    <div className="survey-kpi-grid">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="survey-skeleton-kpi">
          <div className="survey-skeleton-line w-1/3 h-7" />
          <div className="survey-skeleton-line w-2/3 h-3 mt-2" />
        </div>
      ))}
    </div>
  );
}

export function SurveyButtonSpinner() {
  return <Loader2 className="h-4 w-4 animate-spin" style={{ color: "currentColor" }} />;
}
