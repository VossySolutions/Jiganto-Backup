import type { ProjectBudget } from "@shared/schema";

export function parseMoney(v: string | number | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export function formatCurrency(pence: number, currency = "GBP"): string {
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
  return `${sym}${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function budgetRagStatus(actualCost: number, budget: number): "green" | "amber" | "red" {
  if (budget <= 0) return "green";
  const pct = actualCost / budget;
  if (pct > 0.95) return "red";
  if (pct > 0.8) return "amber";
  return "green";
}

export function projectMarginPct(revenue: number, cost: number): number {
  if (revenue <= 0) return 0;
  return Math.round(((revenue - cost) / revenue) * 100);
}

export function computeEvm(budget: ProjectBudget, timelineElapsedPct: number) {
  const totalBudget = parseMoney(budget.totalBudget);
  const actualCost = parseMoney(budget.actualCost);
  const progressPct = parseMoney(budget.deliverableProgressPct) / 100;
  const pv = totalBudget * (timelineElapsedPct / 100);
  const ev = totalBudget * progressPct;
  const ac = actualCost;
  const spi = pv > 0 ? ev / pv : 1;
  const cpi = ac > 0 ? ev / ac : 1;
  const eac = cpi > 0 ? totalBudget / cpi : totalBudget;
  return { pv, ev, ac, spi: Math.round(spi * 100) / 100, cpi: Math.round(cpi * 100) / 100, eac };
}

export function utilisationPct(billableHours: number, availableHours: number): number {
  if (availableHours <= 0) return 0;
  return Math.round((billableHours / availableHours) * 100);
}

export function invoiceAgeBucket(dueDate: string, today: string): "current" | "1-30" | "31-60" | "60+" {
  if (dueDate >= today) return "current";
  const days = Math.ceil((Date.parse(today) - Date.parse(dueDate)) / 86400000);
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  return "60+";
}

export function nextInvoiceNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(3, "0")}`;
}

export function dueDateFromTerms(issueDate: string, terms: string): string {
  const d = new Date(issueDate);
  const days: Record<string, number> = { net_7: 7, net_14: 14, net_30: 30, net_60: 60, due_on_receipt: 0 };
  d.setDate(d.getDate() + (days[terms] ?? 30));
  return d.toISOString().slice(0, 10);
}
