import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { StatusOption } from "@/components/MondayTable";
import type { CrmLead } from "./types";
import { Clock, LayoutDashboard, Plus, Trash2 } from "lucide-react";

type OwnerInfo = { name: string; initials: string; color: string };

type SharedProps = {
  leads: CrmLead[];
  statusOptions: StatusOption[];
  ratingOptions?: StatusOption[];
  sourceOptions?: StatusOption[];
  resolveOwner: (userId: string | null | undefined) => OwnerInfo;
  onOpenLead: (lead: CrmLead) => void;
  onAddLead?: () => void;
};

function leadTitle(lead: CrmLead): string {
  return lead.company || `${lead.firstName} ${lead.lastName}`.trim() || `Lead ${lead.id}`;
}

function getTemperature(score: number | null): "hot" | "warm" | "cold" {
  if (score == null) return "cold";
  if (score >= 80) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

const CHART_COLORS = ["#0073ea", "#00c875", "#fdab3d", "#e2445c", "#a25ddc", "#579bfc", "#c4c4c4", "#0086c0"];

/** Recharts renders the tooltip with inline light-only styles, so re-map it onto theme tokens. */
const CHART_TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: "hsl(var(--popover))",
  borderColor: "hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
};

export function CrmLeadChartView({ leads, statusOptions, ratingOptions = [], sourceOptions = [] }: SharedProps) {
  const [metric, setMetric] = useState<"status" | "source" | "rating" | "temperature">("status");

  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of leads) {
      let key = "—";
      if (metric === "status") {
        const opt = statusOptions.find((o) => o.value === lead.status);
        key = opt?.label || lead.status || "—";
      } else if (metric === "source") {
        const opt = sourceOptions.find((o) => o.value === lead.source);
        key = opt?.label || lead.source || "Unknown";
      } else if (metric === "rating") {
        const opt = ratingOptions.find((o) => o.value === lead.rating);
        key = opt?.label || lead.rating || "None";
      } else {
        key = getTemperature(lead.score);
      }
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [leads, metric, statusOptions, ratingOptions, sourceOptions]);

  return (
    <div className="rounded-xl border border-[#d0d4e4] dark:border-border bg-white dark:bg-card p-4 space-y-4" data-testid="leads-chart-view">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-[14px] font-semibold text-[#323338] dark:text-foreground">Lead distribution</h3>
        <Select value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
          <SelectTrigger className="h-8 w-40 text-xs" data-testid="select-chart-metric">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">By status</SelectItem>
            <SelectItem value="source">By source</SelectItem>
            <SelectItem value="rating">By rating</SelectItem>
            <SelectItem value="temperature">By temperature</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {leads.length === 0 ? (
        <p className="text-sm text-[#676879] dark:text-muted-foreground py-12 text-center">No leads to chart.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  className="text-muted-foreground"
                  stroke="currentColor"
                  tick={{ fontSize: 11, fill: "currentColor" }}
                />
                <YAxis
                  allowDecimals={false}
                  className="text-muted-foreground"
                  stroke="currentColor"
                  tick={{ fontSize: 11, fill: "currentColor" }}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" outerRadius={100} label>
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

export function CrmLeadDashboardView({
  leads,
  statusOptions,
  resolveOwner,
  onOpenLead,
  onAddLead,
}: SharedProps) {
  const hot = leads.filter((l) => getTemperature(l.score) === "hot").length;
  const warm = leads.filter((l) => getTemperature(l.score) === "warm").length;
  const cold = leads.filter((l) => getTemperature(l.score) === "cold").length;
  const converted = leads.filter((l) => l.status === "converted").length;
  const avgScore =
    leads.length === 0
      ? 0
      : Math.round(
          leads.reduce((s, l) => s + (l.score ?? 0), 0) / leads.length,
        );

  const byStatus = useMemo(() => {
    return statusOptions.map((o) => ({
      label: o.label,
      count: leads.filter((l) => l.status === o.value).length,
      color: o.color,
    }));
  }, [leads, statusOptions]);

  const recent = useMemo(
    () =>
      [...leads]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8),
    [leads],
  );

  const cards = [
    { label: "Total leads", value: leads.length, color: "#0073ea" },
    { label: "Hot", value: hot, color: "#e2445c" },
    { label: "Warm", value: warm, color: "#fdab3d" },
    { label: "Cold", value: cold, color: "#579bfc" },
    { label: "Converted", value: converted, color: "#a25ddc" },
    { label: "Avg score", value: avgScore, color: "#00c875" },
  ];

  return (
    <div className="space-y-4" data-testid="leads-dashboard-view">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-[#323338] dark:text-foreground flex items-center gap-1.5">
          <LayoutDashboard className="h-4 w-4 text-[#0073ea]" />
          Leads dashboard
        </h3>
        {onAddLead && (
          <Button size="sm" className="h-8 bg-[#0073ea] hover:bg-[#0060b9] text-white gap-1" onClick={onAddLead}>
            <Plus className="h-3.5 w-3.5" />
            New Lead
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-[#d0d4e4] dark:border-border bg-white dark:bg-card p-3">
            <p className="text-[11px] text-[#676879] dark:text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-semibold mt-1" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#d0d4e4] dark:border-border bg-white dark:bg-card p-4">
          <p className="text-[13px] font-semibold text-[#323338] dark:text-foreground mb-3">Pipeline by status</p>
          <div className="space-y-2">
            {byStatus.map((s) => {
              const pct = leads.length ? Math.round((s.count / leads.length) * 100) : 0;
              return (
                <div key={s.label}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span>{s.label}</span>
                    <span className="text-[#676879] dark:text-muted-foreground">{s.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#f0f1f5] dark:bg-muted overflow-hidden">
                    <div className={cn("h-full rounded-full", s.color?.split(" ")[0])} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-xl border border-[#d0d4e4] dark:border-border bg-white dark:bg-card p-4">
          <p className="text-[13px] font-semibold text-[#323338] dark:text-foreground mb-3">Recently added</p>
          <div className="divide-y divide-[#d0d4e4]/80 dark:divide-border">
            {recent.map((lead) => {
              const owner = resolveOwner(lead.ownerUserId);
              return (
                <button
                  key={lead.id}
                  type="button"
                  className="w-full flex items-center gap-2 py-2 text-left hover:bg-[#f5f6f8] dark:hover:bg-muted px-1 rounded"
                  onClick={() => onOpenLead(lead)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate">{leadTitle(lead)}</p>
                    <p className="text-[11px] text-[#676879] dark:text-muted-foreground">{new Date(lead.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div
                    className="h-6 w-6 rounded-full text-white text-[9px] flex items-center justify-center"
                    style={{ backgroundColor: owner.color }}
                  >
                    {owner.initials}
                  </div>
                </button>
              );
            })}
            {recent.length === 0 && <p className="text-sm text-[#676879] dark:text-muted-foreground py-6 text-center">No leads yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

type TimesheetEntry = { id: string; date: string; hours: number; note: string };

function loadTimesheet(lead: CrmLead): TimesheetEntry[] {
  const raw = lead.customData && typeof lead.customData === "object"
    ? (lead.customData as Record<string, unknown>)["_timesheet"]
    : undefined;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is TimesheetEntry => !!e && typeof e === "object" && typeof (e as TimesheetEntry).id === "string")
    .map((e) => ({
      id: e.id,
      date: String(e.date || ""),
      hours: Number(e.hours) || 0,
      note: String(e.note || ""),
    }));
}

export function CrmLeadTimesheetView({
  leads,
  onOpenLead,
  onSaveTimesheet,
}: SharedProps & {
  onSaveTimesheet?: (leadId: number, entries: TimesheetEntry[]) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(leads[0]?.id ?? null);
  const selected = leads.find((l) => l.id === selectedId) || null;
  const [entries, setEntries] = useState<TimesheetEntry[]>(() => (selected ? loadTimesheet(selected) : []));
  const [saving, setSaving] = useState(false);

  const selectLead = (lead: CrmLead) => {
    setSelectedId(lead.id);
    setEntries(loadTimesheet(lead));
  };

  const totalHours = entries.reduce((s, e) => s + e.hours, 0);

  return (
    <div
      className="rounded-xl border border-[#d0d4e4] dark:border-border bg-white dark:bg-card overflow-hidden grid grid-cols-1 md:grid-cols-[240px_1fr] min-h-[420px]"
      data-testid="leads-timesheet-view"
    >
      <div className="border-r border-[#d0d4e4] dark:border-border bg-[#f5f6f8] dark:bg-muted/40">
        <div className="px-3 py-2 border-b border-[#d0d4e4] dark:border-border text-[12px] font-semibold text-[#676879] dark:text-muted-foreground flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          Timesheet
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          {leads.map((lead) => {
            const hrs = loadTimesheet(lead).reduce((s, e) => s + e.hours, 0);
            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => selectLead(lead)}
                className={cn(
                  "w-full text-left px-3 py-2.5 text-[13px] border-b border-[#d0d4e4]/60 dark:border-border/60",
                  selectedId === lead.id
                    ? "bg-[#cce5ff] dark:bg-primary/25 text-[#0073ea] dark:text-primary"
                    : "hover:bg-white dark:hover:bg-card",
                )}
              >
                <div className="truncate font-medium">{leadTitle(lead)}</div>
                <div className="text-[11px] text-[#676879] dark:text-muted-foreground">{hrs}h logged</div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-4 space-y-3">
        {selected ? (
          <>
            <div className="flex items-center justify-between">
              <button type="button" className="text-[15px] font-semibold hover:text-[#0073ea]" onClick={() => onOpenLead(selected)}>
                {leadTitle(selected)}
              </button>
              <span className="text-[13px] text-[#676879] dark:text-muted-foreground">Total: <strong className="text-[#323338] dark:text-foreground">{totalHours}h</strong></span>
            </div>
            <div className="space-y-2">
              {entries.map((entry, idx) => (
                <div key={entry.id} className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    className="h-8 w-36 text-xs"
                    value={entry.date}
                    onChange={(e) =>
                      setEntries((prev) => prev.map((x, i) => (i === idx ? { ...x, date: e.target.value } : x)))
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.25}
                    className="h-8 w-20 text-xs"
                    value={entry.hours}
                    onChange={(e) =>
                      setEntries((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, hours: Number(e.target.value) || 0 } : x)),
                      )
                    }
                  />
                  <Input
                    className="h-8 flex-1 min-w-[120px] text-xs"
                    placeholder="Note"
                    value={entry.note}
                    onChange={(e) =>
                      setEntries((prev) => prev.map((x, i) => (i === idx ? { ...x, note: e.target.value } : x)))
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEntries((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() =>
                  setEntries((prev) => [
                    ...prev,
                    {
                      id: `t_${Date.now()}`,
                      date: new Date().toISOString().slice(0, 10),
                      hours: 1,
                      note: "",
                    },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Add row
              </Button>
              {onSaveTimesheet && (
                <Button
                  size="sm"
                  className="bg-[#0073ea] hover:bg-[#0060b9] text-white"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await onSaveTimesheet(selected.id, entries);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  data-testid="button-save-timesheet"
                >
                  {saving ? "Saving…" : "Save timesheet"}
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-[#676879] dark:text-muted-foreground py-12 text-center">Select a lead to log time.</p>
        )}
      </div>
    </div>
  );
}

/** Infinity Form view — full-page create/edit for a lead. */
export function CrmLeadFormView({
  leads,
  statusOptions,
  ratingOptions = [],
  sourceOptions = [],
  onOpenLead,
  onAddLead,
  onSubmit,
  editingLead,
}: SharedProps & {
  editingLead?: CrmLead | null;
  onSubmit?: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
    title: string;
    source: string;
    status: string;
    rating: string;
    score: string;
    industry: string;
    website: string;
    description: string;
  }) => Promise<void>;
}) {
  const seed = editingLead || null;
  const [form, setForm] = useState({
    firstName: seed?.firstName || "",
    lastName: seed?.lastName || "",
    email: seed?.email || "",
    phone: seed?.phone || "",
    company: seed?.company || "",
    title: seed?.title || "",
    source: seed?.source || "",
    status: seed?.status || "new",
    rating: seed?.rating || "",
    score: seed?.score != null ? String(seed.score) : "",
    industry: seed?.industry || "",
    website: seed?.website || "",
    description: seed?.description || "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      firstName: seed?.firstName || "",
      lastName: seed?.lastName || "",
      email: seed?.email || "",
      phone: seed?.phone || "",
      company: seed?.company || "",
      title: seed?.title || "",
      source: seed?.source || "",
      status: seed?.status || "new",
      rating: seed?.rating || "",
      score: seed?.score != null ? String(seed.score) : "",
      industry: seed?.industry || "",
      website: seed?.website || "",
      description: seed?.description || "",
    });
  }, [seed?.id]);

  const set = (key: keyof typeof form, value: string) => setForm((p) => ({ ...p, [key]: value }));

  return (
    <div className="rounded-xl border border-[#d0d4e4] dark:border-border bg-white dark:bg-card overflow-hidden" data-testid="leads-form-view">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#d0d4e4] dark:border-border bg-[#f5f6f8] dark:bg-muted/40">
        <h3 className="text-[14px] font-semibold text-[#323338] dark:text-foreground">
          {seed ? `Edit: ${leadTitle(seed)}` : "New lead form"}
        </h3>
        <div className="flex gap-2">
          {onAddLead && !seed && (
            <Button variant="outline" size="sm" onClick={onAddLead}>Open dialog form</Button>
          )}
          {seed && (
            <Button variant="outline" size="sm" onClick={() => onOpenLead(seed)}>Open details</Button>
          )}
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
        {([
          ["firstName", "First name"],
          ["lastName", "Last name"],
          ["email", "Email"],
          ["phone", "Phone"],
          ["company", "Company"],
          ["title", "Title"],
          ["industry", "Industry"],
          ["website", "Website"],
          ["score", "Score"],
        ] as const).map(([key, label]) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Input className="h-8" value={form[key]} onChange={(e) => set(key, e.target.value)} />
          </div>
        ))}
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Source</Label>
          <Select value={form.source || "__none__"} onValueChange={(v) => set("source", v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {sourceOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rating</Label>
          <Select value={form.rating || "__none__"} onValueChange={(v) => set("rating", v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {ratingOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 space-y-1">
          <Label className="text-xs">Description</Label>
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} />
        </div>
        {onSubmit && (
          <div className="md:col-span-2">
            <Button
              className="bg-[#0073ea] hover:bg-[#0060b9] text-white"
              disabled={saving || (!form.firstName && !form.lastName && !form.company)}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSubmit(form);
                } finally {
                  setSaving(false);
                }
              }}
              data-testid="button-submit-form-view"
            >
              {saving ? "Saving…" : seed ? "Update lead" : "Create lead"}
            </Button>
          </div>
        )}
        {leads.length > 0 && (
          <div className="md:col-span-2 border-t border-[#d0d4e4] dark:border-border pt-3">
            <p className="text-[12px] text-[#676879] dark:text-muted-foreground mb-2">Or pick an existing lead to edit in this form:</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className="text-[12px] px-2 py-1 rounded border border-[#0073ea] text-[#0073ea] hover:bg-[#cce5ff]/40 dark:hover:bg-primary/20"
                onClick={() => onOpenLead({} as CrmLead)}
              >
                + New blank form
              </button>
              {leads.slice(0, 12).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="text-[12px] px-2 py-1 rounded border border-[#d0d4e4] dark:border-border hover:bg-[#cce5ff]/40 dark:hover:bg-primary/20"
                  onClick={() => onOpenLead(l)}
                >
                  {leadTitle(l)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
