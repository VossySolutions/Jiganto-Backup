import { useEffect } from "react";
import { useLocation } from "wouter";
import { DASHBOARD_PATH, isDashboardPath } from "@shared/app-routes";
import { useDashboardSelector } from "@/hooks/use-dashboard-selector";

/** Global shortcut: D returns to default dashboard from anywhere in the app. */
export function DashboardGlobalShortcuts() {
  const [, setLocation] = useLocation();
  const { defaultDashboard, setCurrentDashboard } = useDashboardSelector();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() !== "d" || e.metaKey || e.ctrlKey || e.altKey) return;
      setCurrentDashboard(defaultDashboard);
      const path = window.location.pathname;
      if (!isDashboardPath(path)) {
        setLocation(DASHBOARD_PATH);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [defaultDashboard, setCurrentDashboard, setLocation]);

  return null;
}
