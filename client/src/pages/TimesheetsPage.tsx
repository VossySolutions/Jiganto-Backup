import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { DASHBOARD_PATH } from "@shared/app-routes";
import { CLIENT_WORKSPACE_ALWAYS_HIDDEN_KEYS } from "@shared/client-workspace-modules";
import { useClientContext } from "@/hooks/use-client-context";
import { ModuleShell } from "@/components/ModuleShell";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import {
  modulePageBannerWrapClass,
  modulePageContentOuterClass,
  modulePageContentScrollClass,
  modulePageMainClass,
  modulePageShellClass,
  modulePageStickyHeaderClass,
  ModulePageLoadingShell,
} from "@/components/ModulePageChrome";
import { FinanceTimesheetsTab } from "@/components/finance/FinanceTimesheetsTab";
import type { FinanceTimesheetPeriod } from "@/components/finance/types";
import { ResTimesheetsIcon } from "@/components/icons/ModuleIcons";

/**
 * Standalone Timesheets module — same shared timesheet_periods/timesheet_entries
 * data and the same FinanceTimesheetsTab component Finance and Resources already
 * use, just given its own top-level route instead of being buried behind a tab
 * deep-link. No data model or component duplication: this page is a new front
 * door onto an already-shared implementation.
 */
export default function TimesheetsPage() {
  const { activeClient } = useClientContext();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: periods = [], isLoading: periodsLoading } = useQuery<FinanceTimesheetPeriod[]>({
    queryKey: ["/api/finance/timesheets/periods"],
    staleTime: 30_000,
  });

  const { data: approvalQueue = [] } = useQuery<FinanceTimesheetPeriod[]>({
    queryKey: ["/api/finance/timesheets/periods?status=submitted"],
    staleTime: 30_000,
  });

  if (activeClient && CLIENT_WORKSPACE_ALWAYS_HIDDEN_KEYS.has("timesheets")) {
    return <Redirect to={DASHBOARD_PATH} />;
  }

  if (periodsLoading) {
    return <ModulePageLoadingShell label="Loading Timesheets..." testId="timesheets-loading" />;
  }

  return (
    <ModuleShell className={modulePageShellClass} testId="timesheets-page" mainClassName={modulePageMainClass}>
      <div className={modulePageBannerWrapClass}>
        <ModuleWelcomeBanner
          moduleKey="timesheets"
          features={["Weekly time entry", "PM + resource manager approval", "Utilisation & missing-timesheet reports"]}
        />
      </div>

      <div className={modulePageStickyHeaderClass}>
        <ModuleHeader
          icon={ResTimesheetsIcon}
          title="Timesheets"
          subtitle="Submit and approve timesheets"
          searchPlaceholder="Search timesheets..."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchTestId="input-timesheets-search"
          titleTestId="timesheets-title"
        />
      </div>

      <div className={modulePageContentOuterClass}>
        <div className={modulePageContentScrollClass}>
          <FinanceTimesheetsTab
            periods={periods}
            pendingPeriods={approvalQueue}
            isLoading={periodsLoading}
            searchTerm={searchTerm}
          />
        </div>
      </div>
    </ModuleShell>
  );
}
