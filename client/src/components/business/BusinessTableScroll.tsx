import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BusinessTableScrollProps = {
  children: ReactNode;
  className?: string;
  /** Minimum table width before horizontal scroll kicks in */
  minWidth?: number;
};

/** Constrains width to the viewport and enables horizontal scroll for wide tables. */
export function BusinessTableScroll({
  children,
  className,
  minWidth = 720,
}: BusinessTableScrollProps) {
  return (
    <div
      className={cn(
        "w-full max-w-full min-w-0 overflow-x-auto overflow-y-visible",
        "overscroll-x-contain touch-pan-x",
        "[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
        className,
      )}
    >
      <div className="inline-block min-w-full align-top" style={{ minWidth: `${minWidth}px` }}>
        {children}
      </div>
    </div>
  );
}
