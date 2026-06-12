import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Shared responsive wrapper for wide data tables */
export function PortfolioTableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative -mx-1 sm:mx-0", className)}>
      <div className="overflow-x-auto rounded-lg border border-border/30 scrollbar-thin">
        {children}
      </div>
      <p className="md:hidden text-[10px] text-muted-foreground mt-1.5 px-1">Swipe horizontally to see more columns</p>
    </div>
  );
}

/** Toolbar row — stacks on mobile, inline on desktop */
export function PortfolioToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2", className)}>
      {children}
    </div>
  );
}

/** Compact field row for mobile card layouts */
export function PortfolioFieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

/** Generic mobile list card used when tables are too wide */
export function PortfolioMobileCard({
  title,
  subtitle,
  badge,
  onClick,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <Card
      className={cn("border-border/30", onClick && "cursor-pointer active:scale-[0.99] transition-transform")}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{title}</p>
            {subtitle && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{subtitle}</p>}
          </div>
          {badge}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
