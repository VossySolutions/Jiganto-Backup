import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubmitForm } from "@/components/ui/submit-form";
import {
  CrmFormFooter,
  CrmFormHeader,
} from "@/lib/crm-form-layout";

export {
  CrmFormDivider as FormDivider,
  CrmFormSection as FormSection,
  CrmFieldGrid as FieldGrid,
  CrmFieldLabel as FieldLabel,
  formatCrmRecordMeta as formatRecordMeta,
} from "@/lib/crm-form-layout";

export type FormDialogSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<FormDialogSize, string> = {
  sm: "sm:max-w-[480px]",
  md: "sm:max-w-[680px]",
  lg: "sm:max-w-[740px]",
  xl: "sm:max-w-[840px]",
};

export const FORM_DIALOG_SHELL_CLASS =
  "w-[calc(100vw-1.5rem)] max-h-[92vh] flex flex-col gap-0 overflow-hidden p-0 border shadow-lg rounded-2xl [&>button.absolute]:hidden";

type FormDialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  meta?: string;
  saveLabel: string;
  onCancel: () => void;
  onSubmit: () => void;
  saving?: boolean;
  disabled?: boolean;
  saveTestId?: string;
  size?: FormDialogSize;
  children: ReactNode;
  testId?: string;
  bodyClassName?: string;
};

export function FormDialogShell({
  open,
  onOpenChange,
  title,
  subtitle,
  meta,
  saveLabel,
  onCancel,
  onSubmit,
  saving,
  disabled,
  saveTestId,
  size = "md",
  children,
  testId,
  bodyClassName,
}: FormDialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(FORM_DIALOG_SHELL_CLASS, SIZE_CLASS[size])}
        data-testid={testId}
      >
        <SubmitForm
          onSubmit={onSubmit}
          disabled={disabled || saving}
          className="flex min-h-0 flex-1 flex-col"
        >
          <CrmFormHeader title={title} subtitle={subtitle} onClose={onCancel} />
          <div className="sr-only">
            <DialogTitle>{title}</DialogTitle>
            {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
          </div>
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto px-6 py-5 max-h-[74vh]",
              bodyClassName,
            )}
          >
            {children}
          </div>
          <CrmFormFooter
            meta={meta}
            onCancel={onCancel}
            saveLabel={saveLabel}
            saving={saving}
            disabled={disabled}
            saveTestId={saveTestId}
          />
        </SubmitForm>
      </DialogContent>
    </Dialog>
  );
}

/** Read-only or custom-action dialog shell (preview, confirm flows). */
export function FormDialogViewShell({
  open,
  onOpenChange,
  title,
  subtitle,
  onClose,
  size = "md",
  children,
  testId,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  onClose: () => void;
  size?: FormDialogSize;
  children: ReactNode;
  testId?: string;
  footer?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(FORM_DIALOG_SHELL_CLASS, SIZE_CLASS[size])}
        data-testid={testId}
      >
        <CrmFormHeader title={title} subtitle={subtitle} onClose={onClose} />
        <div className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 max-h-[74vh]">{children}</div>
        {footer ? (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-border/50 bg-slate-50 dark:bg-muted/20 rounded-b-2xl shrink-0">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
