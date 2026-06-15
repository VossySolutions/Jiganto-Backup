import type { ReactNode } from "react";
import {
  ServiceDeskTabLoading,
  ServiceDeskKpiSkeleton,
  ServiceDeskChartSkeleton,
  ServiceDeskTableSkeleton,
  ServiceDeskCardGridSkeleton,
  ServiceDeskErrorState,
  ServiceDeskEmptyState,
  ServiceDeskTableWrap,
} from "../service-desk/ServiceDeskUi";

export const HD_ACCENT = "#0EA5E9";

export {
  ServiceDeskTabLoading as HelpDeskTabLoading,
  ServiceDeskKpiSkeleton as HelpDeskKpiSkeleton,
  ServiceDeskChartSkeleton as HelpDeskChartSkeleton,
  ServiceDeskTableSkeleton as HelpDeskTableSkeleton,
  ServiceDeskCardGridSkeleton as HelpDeskCardGridSkeleton,
  ServiceDeskErrorState as HelpDeskErrorState,
  ServiceDeskEmptyState as HelpDeskEmptyState,
  ServiceDeskTableWrap as HelpDeskTableWrap,
};

export function HelpDeskRefreshing({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <p className="text-xs text-muted-foreground text-right animate-pulse" data-testid="hd-refreshing">
      Refreshing…
    </p>
  );
}

export function HelpDeskSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-3 sm:mb-4">
        <h3 className="text-sm sm:text-base font-semibold">{title}</h3>
        {description && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  );
}
