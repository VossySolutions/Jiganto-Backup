import type { FormHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SubmitFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  onSubmit: () => void;
  children: ReactNode;
  disabled?: boolean;
};

/** Wraps fields so Enter in single-line inputs triggers the primary submit action. */
export function SubmitForm({
  onSubmit,
  children,
  className,
  disabled,
  ...props
}: SubmitFormProps) {
  return (
    <form
      className={cn(className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSubmit();
      }}
      {...props}
    >
      {children}
    </form>
  );
}
