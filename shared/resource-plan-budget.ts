export type ResourcePlanRowInput = {
  phase?: string | null;
  roleName: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  daysPerWeek?: string | number | null;
  dailyRate?: string | number | null;
  discountPercent?: string | number | null;
};

export function calcResourcePlanRowDays(row: ResourcePlanRowInput): number {
  const start = row.startDate ? String(row.startDate).slice(0, 10) : "";
  const end = row.endDate ? String(row.endDate).slice(0, 10) : "";
  if (!start || !end) return 0;
  const daysPerWeek = Number(row.daysPerWeek) || 5;
  const weeks = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / (7 * 86400000)));
  return Math.max(0, Math.round(weeks * daysPerWeek));
}

export function calcResourcePlanRowCost(row: ResourcePlanRowInput): number {
  const days = calcResourcePlanRowDays(row);
  const dailyRate = Number(row.dailyRate) || 0;
  const discountPercent = Number(row.discountPercent) || 0;
  return Math.round(days * dailyRate * (1 - discountPercent / 100));
}

export function mapResourcePlanRowsToBudgetLabour(rows: ResourcePlanRowInput[]) {
  return rows.map((row) => {
    const days = calcResourcePlanRowDays(row);
    const cost = calcResourcePlanRowCost(row);
    return {
      phase: row.phase ?? null,
      roleName: row.roleName,
      budgetedDays: String(days),
      budgetedCost: String(cost),
    };
  });
}
