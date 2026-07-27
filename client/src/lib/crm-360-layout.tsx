import type { ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export function normalizeExternalUrl(url: string): string {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function format360ShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const TABLE_HEAD = "text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-2.5 bg-muted/20";

export function SubTabPanel({
  title,
  testId,
  action,
  children,
}: {
  title: string;
  testId: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden" data-testid={testId}>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border/30 bg-muted/15">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      <div className="p-0">{children}</div>
    </div>
  );
}

export function ModuleNavLink({
  href,
  children,
  testId,
}: {
  href: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Link href={href} className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline" data-testid={testId}>
      {children}
    </Link>
  );
}

export function RecordLinkButton({
  onClick,
  children,
  testId,
  className,
}: {
  onClick: () => void;
  children: ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("text-sm font-medium text-primary hover:underline text-left", className)}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

export function EmptySubTabState({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground py-10 text-center px-5">{message}</p>;
}

export function LoadingSubTabState() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export function StageBadge({ name, color }: { name: string; color?: string | null }) {
  return (
    <span
      className={cn(
        "text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap",
        !color && "bg-muted text-muted-foreground",
      )}
      style={color ? { backgroundColor: `${color}33`, color } : undefined}
    >
      {name}
    </span>
  );
}
