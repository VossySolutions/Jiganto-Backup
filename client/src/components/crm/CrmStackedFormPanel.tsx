import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CRM_ACCOUNT_DETAIL_PANEL_WIDTH } from "@/lib/crm-layout";

export { CRM_ACCOUNT_DETAIL_PANEL_WIDTH };

type CrmStackedFormPanelProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerActions?: React.ReactNode;
  width?: string;
  testId?: string;
  className?: string;
  /** When true, children provide their own header chrome (e.g. tabbed lead form). */
  hideHeader?: boolean;
};

export function CrmStackedFormPanel({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  headerActions,
  width = "min(520px, calc(100vw - 1rem))",
  testId = "crm-stacked-form-panel",
  className,
  hideHeader = false,
}: CrmStackedFormPanelProps) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[75] bg-black/25 sm:bg-black/15"
        onClick={onClose}
        aria-hidden
        data-testid={`${testId}-backdrop`}
      />
      <div
        className={cn(
          "fixed inset-y-0 z-[80] flex flex-col bg-background border-l border-border/40 shadow-2xl",
          "animate-in slide-in-from-right duration-200",
          className,
        )}
        style={{ right: CRM_ACCOUNT_DETAIL_PANEL_WIDTH, width, maxWidth: width }}
        data-testid={testId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
      >
        {!hideHeader && (
        <div className="shrink-0 bg-gradient-to-br from-[#0ea5e9]/12 via-violet-500/6 to-background border-b border-border/50 px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 id={`${testId}-title`} className="text-lg font-bold tracking-tight truncate">
                {title}
              </h2>
              {description && (
                <p className="text-sm text-muted-foreground mt-0.5 truncate">{description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {headerActions}
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
        </div>
        )}

        <div className={cn("min-h-0 flex-1 overflow-y-auto", !hideHeader && "px-5 py-4", hideHeader && "flex flex-col")}>
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-border/40 bg-muted/20 px-5 py-3">{footer}</div>
        )}
      </div>
    </>,
    document.body,
  );
}
