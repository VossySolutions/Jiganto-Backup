import { cn } from "@/lib/utils";

/** Minimal scroll region — header/footer chrome or main document body. */
export function DocumentScrollRegion({
  children,
  scrollTestId,
  variant = "main",
  edge,
  title,
  description,
  className,
}: {
  children: React.ReactNode;
  scrollTestId: string;
  /** `main` fills remaining height and scrolls; `chrome` is a compact capped strip. */
  variant?: "main" | "chrome";
  edge?: "top" | "bottom";
  /** Short label for header/footer strips (e.g. "Page header"). */
  title?: string;
  /** One-line hint shown beside the label. */
  description?: string;
  className?: string;
}) {
  const scrollBody = (
    <div
      data-testid={scrollTestId}
      className={cn(
        "overflow-y-auto overflow-x-hidden min-h-0",
        variant === "main" && "flex-1 min-h-0",
        variant === "chrome" && "max-h-[3.25rem]",
        className,
      )}
    >
      <div className={cn(variant === "main" ? "min-h-0" : "px-3 py-1")}>{children}</div>
    </div>
  );

  if (variant === "chrome") {
    return (
      <section
        className={cn(
          "shrink-0 flex flex-col min-h-0 rounded-md border border-border/50 bg-muted/10 overflow-hidden",
          edge === "top" && "mb-1",
          edge === "bottom" && "mt-1",
        )}
        aria-label={title}
      >
        {title && (
          <div
            className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-1 border-b border-border/40 bg-muted/25 shrink-0"
            data-testid={`${scrollTestId}-label`}
          >
            <span className="text-[11px] font-semibold text-foreground">{title}</span>
            {description && (
              <span className="text-[10px] text-muted-foreground">{description}</span>
            )}
          </div>
        )}
        {scrollBody}
      </section>
    );
  }

  return scrollBody;
}

/** @deprecated Use DocumentScrollRegion */
export const DocumentContentPane = DocumentScrollRegion;
