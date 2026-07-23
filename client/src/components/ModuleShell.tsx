import { useEffect, type ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { ContextBanner } from "@/components/ContextBanner";
import SettingsStaffOrgSwitcher from "@/components/settings/SettingsStaffOrgSwitcher";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { useSidebarState } from "@/hooks/use-sidebar-state";
import { useClientContext } from "@/hooks/use-client-context";
import { cn } from "@/lib/utils";

/** Shared top-of-main chrome: impersonation, client workspace banner, staff org switcher. */
export function ShellMainChrome() {
  const { activeClient } = useClientContext();

  return (
    <>
      <ImpersonationBanner />
      {activeClient ? <ContextBanner /> : null}
      {!activeClient ? (
        <div className="border-b border-border/40 bg-muted/20">
          <SettingsStaffOrgSwitcher />
        </div>
      ) : null}
    </>
  );
}

type ModuleShellProps = {
  children: ReactNode;
  className?: string;
  mainClassName?: string;
  showSidebar?: boolean;
  /** Skip sidebar offset (e.g. document fullscreen focus mode). */
  fullBleed?: boolean;
  testId?: string;
};

/** Standard authenticated module layout: sidebar + main column with workspace banner. */
export function ModuleShell({
  children,
  className,
  mainClassName,
  showSidebar = true,
  fullBleed = false,
  testId,
}: ModuleShellProps) {
  const { mainOffset, mobileTopOffset } = useShellLayout();
  const { setCollapsed, lockCollapsed } = useSidebarState();
  const { activeClient } = useClientContext();

  useEffect(() => {
    // Don't auto-expand while project workspace prefers the 52px icon rail
    if (activeClient?.id && !lockCollapsed) setCollapsed(false);
  }, [activeClient?.id, setCollapsed, lockCollapsed]);

  return (
    <div className={cn("min-h-screen bg-background", className)} data-testid={testId}>
      {showSidebar ? <Sidebar /> : null}
      <main
        className={cn(
          "transition-[padding] duration-300 ease-out flex flex-col",
          !fullBleed && mainOffset,
          !fullBleed && mobileTopOffset,
          mainClassName ?? "min-h-screen",
        )}
      >
        <ShellMainChrome />
        {children}
      </main>
    </div>
  );
}
