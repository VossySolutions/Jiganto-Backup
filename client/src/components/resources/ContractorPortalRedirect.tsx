import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { DASHBOARD_PATH } from "@shared/app-routes";
import { useResourceScope } from "@/hooks/use-resource-scope";
import { Dashboard } from "@/pages/Dashboard";

export const CONTRACTOR_HOME_PATH = "/modules/resource-mgmt?tab=timesheets";

/** Redirect contractors to Resources → Timesheets; everyone else sees the dashboard. */
export function DashboardRoute() {
  const { data: scope, isLoading } = useResourceScope();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (scope?.isContractorPortal) {
    return <Redirect to={CONTRACTOR_HOME_PATH} />;
  }

  return <Dashboard />;
}

export function RootRedirect() {
  const { data: scope, isLoading } = useResourceScope();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (scope?.isContractorPortal) {
    return <Redirect to={CONTRACTOR_HOME_PATH} />;
  }

  return <Redirect to={DASHBOARD_PATH} />;
}
