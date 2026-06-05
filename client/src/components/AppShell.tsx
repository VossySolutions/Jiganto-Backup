import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import SettingsStaffOrgSwitcher from "@/components/settings/SettingsStaffOrgSwitcher";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { cn } from "@/lib/utils";

/** Authenticated layout: sidebar (includes workspace banners) + main content. */
export function AppShell({ children }: { children: ReactNode }) {
  const { mainOffset, mobileTopOffset } = useShellLayout();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main
        className={cn(
          "transition-[padding] duration-300 ease-out flex flex-col min-h-screen",
          mainOffset,
          mobileTopOffset,
        )}
      >
        <ImpersonationBanner />
        <div className="border-b border-border/40 bg-muted/20">
          <SettingsStaffOrgSwitcher />
        </div>
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
