import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = Record<string, string | number>;

export function CategoryBarChart({
  data,
  categoryKey = "name",
  valueKey = "progress",
  domain = [0, 100] as [number, number],
  valueLabel = "Progress",
  formatValue = (v: number) => `${v}%`,
}: {
  data: Row[];
  categoryKey?: string;
  valueKey?: string;
  domain?: [number, number];
  valueLabel?: string;
  formatValue?: (v: number) => string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No data yet.</p>;
  }

  const barHeight = 28;
  const chartHeight = Math.max(160, data.length * barHeight + 36);
  const maxLabelLen = data.reduce(
    (max, row) => Math.max(max, String(row[categoryKey] ?? "").length),
    0,
  );
  const yAxisWidth = Math.min(220, Math.max(112, maxLabelLen * 6.5));

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" domain={domain} tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey={categoryKey}
          width={yAxisWidth}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <Tooltip
          formatter={(value: number) => [formatValue(value), valueLabel]}
          labelFormatter={(label) => String(label)}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey={valueKey} fill="#6366f1" radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
