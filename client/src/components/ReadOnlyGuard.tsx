import type { ReactNode } from "react";
import { useReadOnly } from "@/hooks/use-read-only";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Disables children when the user has a read-only platform role (Section 3). */
export function ReadOnlyGuard({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const readOnly = useReadOnly();
  if (!readOnly) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-block opacity-50 pointer-events-none">{children}</span>
      </TooltipTrigger>
      <TooltipContent>Read-only: your role cannot modify data</TooltipContent>
    </Tooltip>
  );
}
