import { useRef, type CSSProperties, type ReactNode } from "react";
import { AGILE_PALETTE_LIGHT, useAgilePalette, type AgilePalette } from "./palette";
import type { BurndownPoint, BurnUpPoint, Sprint } from "./types";

const getInitials = (n: string | null) =>
  n ? n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "?";

function avatarColors(C: AgilePalette) {
  return [C.blue, C.purple, C.teal, C.green, C.amber, C.red, "#0D9488"];
}

export function AgileAvatar({ name, size = 24 }: { name: string | null; size?: number }) {
  const C = useAgilePalette();
  const colors = avatarColors(C);
  const bg = name ? colors[name.charCodeAt(0) % colors.length] : C.grey400;
  return (
    <div
      title={name || "Unassigned"}
      style={{
        width: size, height: size, borderRadius: "50%", background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.38, fontWeight: 700, color: "#fff",
        border: `1.5px solid ${C.white}`, flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

export function AgileBadge({
  label, color, textColor, dot, small,
}: {
  label: string; color?: string; textColor?: string; dot?: boolean; small?: boolean;
}) {
  const C = useAgilePalette();
  const bg = color ?? C.grey200;
  const fg = textColor ?? C.grey700;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: small ? "1px 6px" : "2px 8px", borderRadius: 20,
      background: bg, color: fg, fontSize: small ? 10 : 11, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: fg, flexShrink: 0 }} />}
      {label}
    </span>
  );
}

export function AgileProgressBar({ pct, color, height = 6 }: { pct: number; color?: string; height?: number }) {
  const C = useAgilePalette();
  const bar = color ?? C.blue;
  return (
    <div style={{ height, borderRadius: height, background: C.grey200, overflow: "hidden", flex: 1 }}>
      <div style={{
        height: "100%", width: `${Math.min(100, pct || 0)}%`,
        background: pct >= 100 ? C.green : bar, borderRadius: height, transition: "width 0.5s ease",
      }} />
    </div>
  );
}

export function AgileBtn({
  label, icon, onClick, variant = "secondary", small, danger, testId,
}: {
  label: string; icon?: string; onClick?: () => void; variant?: string;
  small?: boolean; danger?: boolean; testId?: string;
}) {
  const C = useAgilePalette();
  const base: CSSProperties = {
    display: "flex", alignItems: "center", gap: 5,
    padding: small ? "4px 11px" : "6px 14px", borderRadius: 6, cursor: "pointer",
    fontSize: small ? 11 : 12, fontWeight: 600, border: "none", transition: "all 0.15s", whiteSpace: "nowrap",
  };
  const styles: Record<string, CSSProperties> = {
    primary: { ...base, background: C.blue, color: "#fff" },
    secondary: { ...base, background: C.white, color: C.grey700, border: `1px solid ${C.grey200}` },
    danger: { ...base, background: C.redLight, color: C.red, border: `1px solid ${C.red}44` },
    ghost: { ...base, background: "transparent", color: C.grey500, border: "1px solid transparent" },
  };
  return (
    <button style={styles[danger ? "danger" : variant]} onClick={onClick} data-testid={testId}>
      {icon && <span>{icon}</span>}{label}
    </button>
  );
}

export function AgileSelect({
  value, onChange, options, small, testId,
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; small?: boolean; testId?: string;
}) {
  const C = useAgilePalette();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId}
      style={{
        padding: small ? "3px 8px" : "5px 10px", borderRadius: 6,
        border: `1px solid ${C.grey200}`, background: C.white,
        fontSize: small ? 11 : 12, color: C.grey700, cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function AgileModal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  const C = useAgilePalette();
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
      data-testid={`modal-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div
        style={{
          background: C.white, borderRadius: 12, padding: 24, width: wide ? 680 : 480,
          maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)", border: `1px solid ${C.grey200}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: C.grey800 }}>{title}</span>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 22, color: C.grey400, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FormField({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  const C = useAgilePalette();
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.grey500, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>
        {label}{required && <span style={{ color: C.red }}> *</span>}
      </label>
      {children}
    </div>
  );
}

/** Theme-aware input style — call inside components (or use getInputStyle). */
export function getInputStyle(C: AgilePalette = AGILE_PALETTE_LIGHT): CSSProperties {
  return {
    width: "100%", padding: "7px 10px", borderRadius: 6,
    border: `1px solid ${C.grey200}`, fontSize: 13, color: C.grey800,
    background: C.white, fontFamily: "inherit", boxSizing: "border-box",
  };
}

export function getTextareaStyle(C: AgilePalette = AGILE_PALETTE_LIGHT): CSSProperties {
  return { ...getInputStyle(C), resize: "vertical", minHeight: 80 };
}

/** Light fallback for legacy callers; prefer getInputStyle(useAgilePalette()). */
export const inputStyle: CSSProperties = getInputStyle(AGILE_PALETTE_LIGHT);
export const textareaStyle: CSSProperties = getTextareaStyle(AGILE_PALETTE_LIGHT);

export function ConfirmDelete({ label, onConfirm, onCancel }: {
  label: string; onConfirm: () => void; onCancel: () => void;
}) {
  const C = useAgilePalette();
  return (
    <AgileModal title="Confirm Delete" onClose={onCancel}>
      <p style={{ color: C.grey600, marginBottom: 20 }}>
        Are you sure you want to delete <strong>{label}</strong>? This action cannot be undone.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <AgileBtn label="Cancel" onClick={onCancel} testId="button-cancel-delete" />
        <AgileBtn label="Delete" danger onClick={onConfirm} testId="button-confirm-delete" />
      </div>
    </AgileModal>
  );
}

export function BurndownChart({ data, title, width: fixedWidth, height = 200, sprint }: {
  data: BurndownPoint[]; title: string; width?: number; height?: number; sprint?: Sprint;
}) {
  const C = useAgilePalette();
  const containerRef = useRef<HTMLDivElement>(null);
  const width = fixedWidth || 800;
  const pad = { top: 16, right: 20, bottom: 32, left: 36 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  if (!data || data.length === 0) {
    return (
      <div ref={containerRef} style={{ background: C.white, border: `1px solid ${C.grey200}`, borderRadius: 10, padding: "12px 16px" }} data-testid="burndown-chart">
        <div style={{ fontWeight: 700, fontSize: 13, color: C.grey700, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 12, color: C.grey400, padding: "24px 0", textAlign: "center" }}>No burndown data yet</div>
      </div>
    );
  }
  const maxY = Math.max(1, ...data.map((d) => Math.max(d.ideal, d.actual || 0)));
  const denom = Math.max(1, data.length - 1);
  const xs = data.map((_, i) => pad.left + (i / denom) * W);
  const y = (v: number) => pad.top + H - (Math.max(0, v) / maxY) * H;
  const idealPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xs[i]},${y(d.ideal)}`).join(" ");
  const actualPts = data.filter((d) => d.actual !== null);
  const actualPath = actualPts.map((d, i) => {
    const xi = data.indexOf(d);
    return `${i === 0 ? "M" : "L"}${xs[xi]},${y(d.actual!)}`;
  }).join(" ");
  const lastActualIdx = data.reduce((a, d, i) => (d.actual !== null ? i : a), -1);

  const committed = sprint?.points || 34;
  const completedPts = sprint?.done || 18;
  const remainingPts = committed - completedPts;
  const trend = remainingPts > committed * 0.5 ? "Behind" : remainingPts > committed * 0.2 ? "On Track" : "Ahead";
  const trendColor = trend === "Behind" ? C.red : trend === "Ahead" ? C.green : C.amber;

  return (
    <div ref={containerRef} style={{ background: C.white, border: `1px solid ${C.grey200}`, borderRadius: 10, padding: "12px 16px" }} data-testid="burndown-chart">
      <div style={{ fontWeight: 700, fontSize: 13, color: C.grey700, marginBottom: 8 }}>{title}</div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMin meet" style={{ display: "block", overflow: "visible" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yv = pad.top + H * t;
          const val = Math.round(maxY * (1 - t));
          return (
            <g key={t}>
              <line x1={pad.left} y1={yv} x2={pad.left + W} y2={yv} stroke={C.grey100} strokeWidth={1} />
              <text x={pad.left - 6} y={yv + 4} textAnchor="end" fontSize={9} fill={C.grey400}>{val}</text>
            </g>
          );
        })}
        {data.filter((_, i) => i % 2 === 0).map((d) => {
          const idx = data.indexOf(d);
          return <text key={d.day} x={xs[idx]} y={pad.top + H + 18} textAnchor="middle" fontSize={9} fill={C.grey400}>{d.day}</text>;
        })}
        {lastActualIdx >= 0 && (
          <line x1={xs[lastActualIdx]} y1={pad.top} x2={xs[lastActualIdx]} y2={pad.top + H} stroke={C.amber} strokeWidth={1.5} strokeDasharray="4 3" />
        )}
        <path d={idealPath} fill="none" stroke={C.grey300} strokeWidth={2} strokeDasharray="6 3" />
        {actualPts.length > 0 && (
          <path d={`${actualPath} L${xs[lastActualIdx]},${pad.top + H} L${xs[0]},${pad.top + H} Z`} fill={`${C.blue}18`} stroke="none" />
        )}
        {actualPts.length > 0 && <path d={actualPath} fill="none" stroke={C.blue} strokeWidth={2.5} />}
        {actualPts.map((d, i) => {
          const xi = data.indexOf(d);
          return <circle key={i} cx={xs[xi]} cy={y(d.actual!)} r={3.5} fill={C.white} stroke={C.blue} strokeWidth={2} />;
        })}
        <g transform={`translate(${pad.left + W - 160},${pad.top})`}>
          <line x1={0} y1={8} x2={16} y2={8} stroke={C.grey300} strokeWidth={2} strokeDasharray="6 3" />
          <text x={20} y={12} fontSize={9} fill={C.grey500}>Ideal</text>
          <line x1={60} y1={8} x2={76} y2={8} stroke={C.blue} strokeWidth={2.5} />
          <text x={80} y={12} fontSize={9} fill={C.grey500}>Actual</text>
          <line x1={120} y1={0} x2={120} y2={16} stroke={C.amber} strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={124} y={12} fontSize={9} fill={C.grey500}>Today</text>
        </g>
      </svg>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        {([["Committed", `${committed} pts`, C.grey700], ["Completed", `${completedPts} pts`, C.blue], ["Remaining", `${remainingPts} pts`, C.amber], ["Trend", trend, trendColor]] as [string, string, string][]).map(([l, v, col]) => (
          <div key={l} style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: col }}>{v}</div>
            <div style={{ fontSize: 10, color: C.grey400 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BurnUpChart({ data, title, color, width = 320, height = 180 }: {
  data: BurnUpPoint[]; title: string; color?: string; width?: number; height?: number;
}) {
  const C = useAgilePalette();
  const stroke = color ?? C.blue;
  if (!data || data.length === 0) return null;
  const pad = { top: 14, right: 16, bottom: 28, left: 32 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const maxY = Math.max(1, ...data.map((d) => Math.max(d.total || 0, d.completed || 0)));
  const denom = Math.max(1, data.length - 1);
  const xs = data.map((_, i) => pad.left + (i / denom) * W);
  const y = (v: number) => pad.top + H - (Math.max(0, v) / maxY) * H;
  const scopePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xs[i]},${y(d.total)}`).join(" ");
  const donePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xs[i]},${y(d.completed)}`).join(" ");

  return (
    <div style={{ background: C.white, border: `1px solid ${C.grey200}`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: C.grey700, marginBottom: 6 }}>{title}</div>
      <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
        {[0, 0.5, 1].map((t) => {
          const yv = pad.top + H * t;
          return (
            <g key={t}>
              <line x1={pad.left} y1={yv} x2={pad.left + W} y2={yv} stroke={C.grey100} strokeWidth={1} />
              <text x={pad.left - 5} y={yv + 4} textAnchor="end" fontSize={8} fill={C.grey400}>{Math.round(maxY * (1 - t))}</text>
            </g>
          );
        })}
        {data.map((d, i) => <text key={d.week} x={xs[i]} y={pad.top + H + 16} textAnchor="middle" fontSize={8} fill={C.grey400}>{d.week}</text>)}
        <path d={scopePath} fill="none" stroke={C.grey300} strokeWidth={1.5} strokeDasharray="5 3" />
        <path d={`${donePath} L${xs[xs.length - 1]},${pad.top + H} L${xs[0]},${pad.top + H} Z`} fill={`${stroke}20`} stroke="none" />
        <path d={donePath} fill="none" stroke={stroke} strokeWidth={2} />
        {data.map((d, i) => <circle key={i} cx={xs[i]} cy={y(d.completed)} r={3} fill={C.white} stroke={stroke} strokeWidth={1.5} />)}
        <g transform={`translate(${pad.left + W - 90},${pad.top})`}>
          <line x1={0} y1={7} x2={12} y2={7} stroke={C.grey300} strokeWidth={1.5} strokeDasharray="4 2" />
          <text x={15} y={10} fontSize={8} fill={C.grey500}>Scope</text>
          <line x1={50} y1={7} x2={62} y2={7} stroke={stroke} strokeWidth={2} />
          <text x={65} y={10} fontSize={8} fill={C.grey500}>Done</text>
        </g>
      </svg>
    </div>
  );
}
