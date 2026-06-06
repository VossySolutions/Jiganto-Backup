import type { DashboardScope } from "./metrics";
import {
  loadBusinessModuleDashboard,
  loadFinanceModuleDashboard,
  loadHelpDeskModuleDashboard,
} from "./module-metrics";
import {
  loadCrmModuleDashboard,
  loadKpiStrip,
  loadProjectsModuleDashboard,
  loadTasksModuleDashboard,
} from "./metrics";

export async function resolveWidgetData(widgetType: string, scope: DashboardScope) {
  switch (widgetType) {
    case "kpi_strip":
      return loadKpiStrip(scope);
    case "projects_kpi":
    case "projects_health":
    case "projects_table":
      return loadProjectsModuleDashboard(scope);
    case "tasks_kpi":
    case "tasks_due":
      return loadTasksModuleDashboard(scope);
    case "crm_pipeline":
    case "crm_hot":
      return loadCrmModuleDashboard(scope);
    case "helpdesk_kpi":
    case "helpdesk_volume":
      return loadHelpDeskModuleDashboard(scope);
    case "finance_kpi":
    case "finance_revenue":
      return loadFinanceModuleDashboard(scope);
    case "business_kpi":
    case "business_initiatives":
      return loadBusinessModuleDashboard(scope);
    case "text_note":
      return { text: "" };
    default:
      return null;
  }
}
