import type { ComponentType } from "react";
import { CircleHelp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  /** Short context line shown under the value (e.g. "12 open opportunities"). */
  subtitle?: string;
  /** Longer explanation shown in the ? tooltip. */
  helpText?: string;
  icon?: ComponentType<{ className?: string }>;
  iconClassName?: string;
  iconBgClassName?: string;
  borderColor?: string;
  valueClassName?: string;
  testId?: string;
  onClick?: () => void;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  helpText,
  icon: Icon,
  iconClassName,
  iconBgClassName,
  borderColor,
  valueClassName,
  testId,
  onClick,
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "rounded-xl",
        onClick && "cursor-pointer hover:border-primary/40 active:scale-[0.98] transition-all",
        className,
      )}
      style={borderColor ? { borderTop: `3px solid ${borderColor}` } : undefined}
      data-testid={testId}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">
            {title}
          </CardTitle>
          {helpText ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground/60 hover:text-muted-foreground shrink-0"
                  aria-label={`About ${title}`}
                >
                  <CircleHelp className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
                {helpText}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        {Icon ? (
          <div className={cn("p-2 rounded-lg shrink-0", iconBgClassName)}>
            <Icon className={cn("h-4 w-4", iconClassName)} />
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", valueClassName)} data-testid={testId ? `${testId}-value` : undefined}>
          {value}
        </div>
        {subtitle ? (
          <p className="text-xs text-muted-foreground mt-1 leading-snug">{subtitle}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
