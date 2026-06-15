import { cn } from "@/lib/utils";

const C = {
  primary: "hsl(var(--primary))",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
  muted: "hsl(var(--muted-foreground))",
  border: "hsl(var(--border))",
};

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-xl p-4 overflow-hidden", className)}>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</div>
      <div className="w-full overflow-x-auto">{children}</div>
    </div>
  );
}

export function TmBurndownChart({
  data,
  width = 480,
  height = 200,
}: {
  data: Array<{ date: string; target: number; actual: number }>;
  width?: number;
  height?: number;
}) {
  if (!data.length) return null;
  const pad = { top: 16, right: 16, bottom: 36, left: 40 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const maxY = Math.max(...data.flatMap(d => [d.target, d.actual]), 1);
  const xs = data.map((_, i) => pad.left + (i / Math.max(data.length - 1, 1)) * W);
  const y = (v: number) => pad.top + H - (v / maxY) * H;
  const idealPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xs[i]},${y(d.target)}`).join(" ");
  const actualPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xs[i]},${y(d.actual)}`).join(" ");

  return (
    <ChartCard title="Execution Burndown (14 days)">
      <svg width={width} height={height} className="min-w-[280px] block">
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const yv = pad.top + H * t;
          return (
            <g key={t}>
              <line x1={pad.left} y1={yv} x2={pad.left + W} y2={yv} stroke={C.border} strokeWidth={1} />
              <text x={pad.left - 6} y={yv + 4} textAnchor="end" fontSize={9} fill={C.muted}>{Math.round(maxY * (1 - t))}</text>
            </g>
          );
        })}
        <path d={idealPath} fill="none" stroke={C.muted} strokeWidth={1.5} strokeDasharray="4 3" />
        <path d={actualPath} fill="none" stroke={C.primary} strokeWidth={2.5} />
        {data.map((d, i) => (
          <text key={d.date} x={xs[i]} y={pad.top + H + 14} textAnchor="middle" fontSize={8} fill={C.muted}>
            {d.date.slice(5)}
          </text>
        ))}
        <g transform={`translate(${pad.left + W - 130},${pad.top})`}>
          <line x1={0} y1={6} x2={14} y2={6} stroke={C.muted} strokeDasharray="4 3" />
          <text x={18} y={9} fontSize={9} fill={C.muted}>Target</text>
          <line x1={60} y1={6} x2={74} y2={6} stroke={C.primary} strokeWidth={2} />
          <text x={78} y={9} fontSize={9} fill={C.muted}>Remaining</text>
        </g>
      </svg>
    </ChartCard>
  );
}

export function TmDefectTrendChart({
  data,
  width = 480,
  height = 200,
}: {
  data: Array<{ date: string; open: number; closed: number }>;
  width?: number;
  height?: number;
}) {
  if (!data.length) return null;
  const pad = { top: 16, right: 16, bottom: 36, left: 40 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const maxY = Math.max(...data.flatMap(d => [d.open, d.closed]), 1);
  const barW = W / (data.length * 2.5);

  return (
    <ChartCard title="Defect Trend">
      <svg width={width} height={height} className="min-w-[280px] block">
        {[0, 0.5, 1].map(t => {
          const yv = pad.top + H * t;
          return <line key={t} x1={pad.left} y1={yv} x2={pad.left + W} y2={yv} stroke={C.border} strokeWidth={1} />;
        })}
        {data.map((d, i) => {
          const x = pad.left + i * (barW * 2.5) + barW * 0.5;
          const oh = (d.open / maxY) * H;
          const ch = (d.closed / maxY) * H;
          return (
            <g key={d.date}>
              <rect x={x} y={pad.top + H - oh} width={barW} height={oh} rx={2} fill={`${C.red}99`} />
              <rect x={x + barW + 2} y={pad.top + H - ch} width={barW} height={ch} rx={2} fill={`${C.green}99`} />
              <text x={x + barW} y={pad.top + H + 14} textAnchor="middle" fontSize={8} fill={C.muted}>{d.date.slice(5)}</text>
            </g>
          );
        })}
        <g transform={`translate(${pad.left + W - 120},${pad.top})`}>
          <rect x={0} y={0} width={10} height={10} rx={2} fill={`${C.red}99`} />
          <text x={14} y={9} fontSize={9} fill={C.muted}>Open</text>
          <rect x={50} y={0} width={10} height={10} rx={2} fill={`${C.green}99`} />
          <text x={64} y={9} fontSize={9} fill={C.muted}>Closed</text>
        </g>
      </svg>
    </ChartCard>
  );
}

export function TmPassRateTrendChart({
  data,
  width = 480,
  height = 200,
}: {
  data: Array<{ label: string; rate: number }>;
  width?: number;
  height?: number;
}) {
  if (!data.length) return null;
  const pad = { top: 16, right: 16, bottom: 40, left: 40 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const barW = W / (data.length * 1.8);

  return (
    <ChartCard title="Pass Rate by Test Cycle">
      <svg width={width} height={height} className="min-w-[280px] block">
        <line x1={pad.left} y1={pad.top + H} x2={pad.left + W} y2={pad.top + H} stroke={C.border} />
        {[0, 25, 50, 75, 100].map(v => {
          const yv = pad.top + H - (v / 100) * H;
          return (
            <g key={v}>
              <line x1={pad.left} y1={yv} x2={pad.left + W} y2={yv} stroke={C.border} strokeWidth={0.5} />
              <text x={pad.left - 6} y={yv + 3} textAnchor="end" fontSize={8} fill={C.muted}>{v}%</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = pad.left + i * (barW * 1.8) + barW * 0.4;
          const bh = (d.rate / 100) * H;
          const color = d.rate >= 90 ? C.green : d.rate >= 70 ? C.amber : C.red;
          return (
            <g key={d.label}>
              <rect x={x} y={pad.top + H - bh} width={barW} height={bh} rx={3} fill={color} opacity={0.85} />
              <text x={x + barW / 2} y={pad.top + H - bh - 4} textAnchor="middle" fontSize={8} fill={C.muted}>{d.rate}%</text>
              <text x={x + barW / 2} y={pad.top + H + 14} textAnchor="middle" fontSize={8} fill={C.muted}>
                {d.label.length > 12 ? `${d.label.slice(0, 10)}…` : d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
}

export function TmAreaHealthChart({
  data,
  width = 480,
  height = 200,
}: {
  data: Array<{ name: string; passRatePct: number; completionPct: number }>;
  width?: number;
  height?: number;
}) {
  if (!data.length) return null;
  const pad = { top: 16, right: 16, bottom: 48, left: 40 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const barW = W / (data.length * 2.2);

  return (
    <ChartCard title="Coverage by Business Area">
      <svg width={width} height={height} className="min-w-[280px] block">
        <line x1={pad.left} y1={pad.top + H} x2={pad.left + W} y2={pad.top + H} stroke={C.border} />
        {data.map((d, i) => {
          const x = pad.left + i * (barW * 2.2) + barW * 0.3;
          const ph = (d.passRatePct / 100) * H;
          const ch = (d.completionPct / 100) * H;
          return (
            <g key={d.name}>
              <rect x={x} y={pad.top + H - ph} width={barW * 0.45} height={ph} rx={2} fill={C.green} opacity={0.7} />
              <rect x={x + barW * 0.55} y={pad.top + H - ch} width={barW * 0.45} height={ch} rx={2} fill={C.primary} opacity={0.7} />
              <text x={x + barW / 2} y={pad.top + H + 12} textAnchor="middle" fontSize={7} fill={C.muted}>
                {d.name.length > 10 ? `${d.name.slice(0, 8)}…` : d.name}
              </text>
            </g>
          );
        })}
        <g transform={`translate(${pad.left},${pad.top})`}>
          <rect x={0} y={0} width={8} height={8} rx={1} fill={C.green} opacity={0.7} />
          <text x={12} y={8} fontSize={8} fill={C.muted}>Pass %</text>
          <rect x={50} y={0} width={8} height={8} rx={1} fill={C.primary} opacity={0.7} />
          <text x={62} y={8} fontSize={8} fill={C.muted}>Complete %</text>
        </g>
      </svg>
    </ChartCard>
  );
}
