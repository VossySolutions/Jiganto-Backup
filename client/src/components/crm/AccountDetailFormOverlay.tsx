import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type AccountDetailFormOverlayProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  /** When true, children provide their own header (e.g. tabbed lead form). */
  hideHeader?: boolean;
  testId?: string;
  className?: string;
};

/**
 * Full-height form layer inside the CRM account detail drawer.
 * Replaces a second panel to the left so Edit / Add flows stay usable on all screen sizes.
 */
export function AccountDetailFormOverlay({
  open,
  onClose,
  title,
  description,
  children,
  headerActions,
  hideHeader = false,
  testId = "account-detail-form-overlay",
  className,
}: AccountDetailFormOverlayProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 z-30 flex flex-col bg-background animate-in slide-in-from-right duration-200",
        className,
      )}
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-labelledby={hideHeader ? undefined : `${testId}-title`}
    >
      {!hideHeader && (
        <div className="shrink-0 border-b border-slate-100 dark:border-border/50">
          <div className="flex items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onClose}
              data-testid={`${testId}-back`}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
              <div className="min-w-0">
              <h2 id={`${testId}-title`} className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-foreground truncate">
                {title}
              </h2>
              {description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
              )}
            </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {headerActions}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-lg text-muted-foreground hover:bg-slate-100 dark:hover:bg-muted"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={cn("min-h-0 flex-1 overflow-y-auto", !hideHeader && "px-4 py-4", hideHeader && "flex flex-col")}>
        {children}
      </div>
    </div>
  );
}
