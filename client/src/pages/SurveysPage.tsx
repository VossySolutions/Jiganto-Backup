import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid,
} from "recharts";
import type { SurveyWithDetails, SurveyQuestion, SurveyResponseWithAnswers } from "@shared/models/surveys";

// ─── Design colour tokens (from Claude design) ────────────────────────────────
const C = {
  teal:    "#1A6B5A", tealL: "#E4F2EE", tealM: "#2E8C74",
  amber:   "#B85C0A", amberL: "#FDF0E4",
  violet:  "#4A2D8C", violetL: "#EEE9FA",
  rose:    "#9C2B2B", roseL:  "#FAEAEA",
  blue:    "#1A4A8C", blueL:  "#E6EEF8",
  ink:     "#0F0E0C", ink2: "#2E2C28", ink3: "#5C5952", ink4: "#9C9890",
  paper:   "#FAFAF7", paper2: "#F2F0EB", paper3: "#E8E5DE",
  line:    "#DDD9D0", line2: "#CBC7BC",
};

// MC result bar palette: teal → teal-mid → amber → rose (ordered best→worst)
const MC_BARS = [C.tealM, "#4AAD90", C.amber, C.rose, "#6842B8", "#1A4A8C"];
// Checkbox bars: violet shades
const CB_BARS = [C.violet, "#6842B8", "#8C5ECC", "#AA7ADE", "#C89EEA"];

// ─── Types ────────────────────────────────────────────────────────────────────
type View = "dashboard" | "builder" | "results";

const QUESTION_TYPES: { type: string; icon: string; label: string; group: string }[] = [
  { type: "mc",    icon: "◉",  label: "Multiple Choice", group: "Choice" },
  { type: "yn",    icon: "✓✗", label: "Yes / No",        group: "Choice" },
  { type: "cb",    icon: "☑",  label: "Checkboxes",      group: "Choice" },
  { type: "dd",    icon: "▾",  label: "Dropdown",        group: "Choice" },
  { type: "sc",    icon: "⭐", label: "Star Rating",     group: "Rating" },
  { type: "scale", icon: "◈",  label: "Scale (1–10)",    group: "Rating" },
  { type: "nps",   icon: "📈", label: "NPS Score",       group: "Rating" },
  { type: "text",  icon: "✏",  label: "Short Text",      group: "Open-ended" },
  { type: "para",  icon: "☰",  label: "Paragraph",       group: "Open-ended" },
  { type: "date",  icon: "📅", label: "Date",            group: "Other" },
  { type: "matrix",icon: "⊞", label: "Matrix / Grid",   group: "Other" },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(QUESTION_TYPES.map(q => [q.type, q.label]));

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string; dot?: boolean }> = {
  draft:    { label: "Draft",   bg: C.paper3,  color: C.ink3 },
  active:   { label: "Active",  bg: C.tealL,   color: C.teal,   dot: true },
  closed:   { label: "Closed",  bg: C.roseL,   color: C.rose },
  archived: { label: "Archived",bg: C.paper3,  color: C.ink4 },
};

const CATEGORY_ICONS: Record<string, string> = {
  "Retrospective": "📊", "Client Satisfaction": "🎯", "Team Wellbeing": "💡",
  "Onboarding": "📝", "Product Feedback": "🔧", "Other": "📋", "": "📋",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(s: number | null | undefined) {
  if (!s) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}
function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Question preview card ─────────────────────────────────────────────────
function QuestionPreview({ q, idx, selected, onClick, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: {
  q: SurveyQuestion; idx: number; selected: boolean;
  onClick: () => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void;
  isFirst: boolean; isLast: boolean;
}) {
  const opts = (q.options as string[]) || [];
  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff", border: `1.5px solid ${selected ? C.teal : C.line}`,
        borderRadius: 12, padding: "18px 20px", marginBottom: 10, cursor: "pointer", position: "relative",
        boxShadow: selected ? `0 0 0 3px ${C.tealL}` : undefined,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: C.ink4, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Q{idx + 1} · {TYPE_LABEL[q.type] || q.type}</span>
        {q.required && <span style={{ background: C.tealL, color: C.teal, fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>Required</span>}
      </div>
      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12, color: C.ink, lineHeight: 1.4 }}>{q.text || "Untitled question"}</div>

      {/* Preview by type */}
      {(q.type === "mc" || q.type === "yn" || q.type === "dd") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(q.type === "yn" ? ["Yes", "No"] : opts.slice(0, 4)).map((o, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 13, color: C.ink3 }}>
              <div style={{ width: 15, height: 15, borderRadius: "50%", border: `1.5px solid ${C.line2}`, flexShrink: 0 }} />
              {o}
            </div>
          ))}
        </div>
      )}
      {q.type === "cb" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {opts.slice(0, 4).map((o, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 13, color: C.ink3 }}>
              <div style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${C.line2}`, flexShrink: 0 }} />
              {o}
            </div>
          ))}
        </div>
      )}
      {q.type === "scale" && (
        <div style={{ display: "flex", gap: 5 }}>
          {Array.from({ length: (q.scaleMax || 10) - (q.scaleMin || 1) + 1 }, (_, i) => i + (q.scaleMin || 1)).map(n => (
            <div key={n} style={{ flex: 1, textAlign: "center", padding: "8px 2px", border: `1px solid ${C.line2}`, borderRadius: 7, fontSize: 12, fontWeight: 500, color: C.ink3 }}>{n}</div>
          ))}
        </div>
      )}
      {q.type === "nps" && (
        <div style={{ display: "flex", gap: 3 }}>
          {Array.from({ length: 11 }, (_, i) => i).map(n => {
            const bg = n <= 6 ? C.roseL : n <= 8 ? C.amberL : C.tealL;
            const col = n <= 6 ? C.rose : n <= 8 ? C.amber : C.teal;
            return <div key={n} style={{ flex: 1, textAlign: "center", padding: "7px 2px", border: `1px solid ${bg}`, borderRadius: 6, fontSize: 11, fontWeight: 600, background: bg, color: col }}>{n}</div>;
          })}
        </div>
      )}
      {q.type === "sc" && (
        <div style={{ display: "flex", gap: 8 }}>
          {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: 22, opacity: 0.4 }}>⭐</span>)}
        </div>
      )}
      {(q.type === "text" || q.type === "para" || q.type === "date") && (
        <div style={{ padding: "8px 12px", border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 13, color: C.ink4, background: C.paper2 }}>
          {q.type === "date" ? "DD / MM / YYYY" : "Respondent answer here…"}
        </div>
      )}
      {q.type === "matrix" && (
        <div style={{ fontSize: 12, color: C.ink4, padding: "8px", background: C.paper2, borderRadius: 8 }}>
          {(q.matrixRows as string[] || ["Row 1", "Row 2"]).slice(0, 2).join(", ")} × {(q.matrixCols as string[] || ["Col 1", "Col 2"]).slice(0, 2).join(", ")}
        </div>
      )}

      {/* Actions */}
      <div style={{ position: "absolute", right: 12, top: 12, display: "flex", gap: 4 }}>
        <button onClick={e => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst}
          style={{ width: 26, height: 26, border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", cursor: isFirst ? "not-allowed" : "pointer", opacity: isFirst ? 0.3 : 1, fontSize: 12 }} title="Move up">↑</button>
        <button onClick={e => { e.stopPropagation(); onMoveDown(); }} disabled={isLast}
          style={{ width: 26, height: 26, border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", cursor: isLast ? "not-allowed" : "pointer", opacity: isLast ? 0.3 : 1, fontSize: 12 }} title="Move down">↓</button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ width: 26, height: 26, border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", cursor: "pointer", color: C.rose, fontSize: 12 }} title="Delete">✕</button>
      </div>
    </div>
  );
}

// ─── Settings panel for selected question ─────────────────────────────────
function QuestionSettings({ q, onUpdate }: { q: SurveyQuestion; onUpdate: (data: Partial<SurveyQuestion>) => void }) {
  const opts = (q.options as string[]) || [];
  const matrixRows = (q.matrixRows as string[]) || ["Row 1", "Row 2"];
  const matrixCols = (q.matrixCols as string[]) || ["Strongly Agree", "Agree", "Disagree", "Strongly Disagree"];

  const inputStyle = { width: "100%", padding: "8px 11px", border: `1px solid ${C.line2}`, borderRadius: 7, fontFamily: "inherit", fontSize: 13, color: C.ink, background: "#fff", outline: "none" };
  const labelStyle = { display: "block" as const, fontSize: 11, fontWeight: 600 as const, color: C.ink3, marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: ".05em" };

  return (
    <div style={{ padding: "0 2px" }}>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Question Text</label>
        <textarea rows={3} value={q.text} onChange={e => onUpdate({ text: e.target.value })}
          style={{ ...inputStyle, resize: "vertical" as const, minHeight: 72 }} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Help text (optional)</label>
        <input value={q.helpText || ""} onChange={e => onUpdate({ helpText: e.target.value })} style={inputStyle} placeholder="Sub-text shown below question" />
      </div>

      {/* Options editor for MC/CB/DD */}
      {["mc", "cb", "dd"].includes(q.type) && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Options</div>
          {opts.map((opt, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 7 }}>
              <input value={opt} onChange={e => { const n = [...opts]; n[i] = e.target.value; onUpdate({ options: n }); }}
                style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => { const n = opts.filter((_, j) => j !== i); onUpdate({ options: n }); }}
                style={{ width: 26, height: 26, border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", cursor: "pointer", color: C.rose, flexShrink: 0, fontSize: 13 }}>✕</button>
            </div>
          ))}
          <button onClick={() => onUpdate({ options: [...opts, `Option ${opts.length + 1}`] })}
            style={{ width: "100%", padding: "7px", border: `1px dashed ${C.line2}`, borderRadius: 7, background: C.paper2, cursor: "pointer", fontSize: 13, color: C.ink3 }}>+ Add option</button>
        </div>
      )}

      {/* Scale settings */}
      {["scale", "nps"].includes(q.type) && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Min</label>
              <input type="number" value={q.scaleMin ?? 1} onChange={e => onUpdate({ scaleMin: Number(e.target.value) })} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Max</label>
              <input type="number" value={q.scaleMax ?? 10} onChange={e => onUpdate({ scaleMax: Number(e.target.value) })} style={inputStyle} />
            </div>
          </div>
          <label style={labelStyle}>Min label</label>
          <input value={q.scaleMinLabel || ""} onChange={e => onUpdate({ scaleMinLabel: e.target.value })} style={{ ...inputStyle, marginBottom: 8 }} placeholder="e.g. Not likely" />
          <label style={labelStyle}>Max label</label>
          <input value={q.scaleMaxLabel || ""} onChange={e => onUpdate({ scaleMaxLabel: e.target.value })} style={inputStyle} placeholder="e.g. Extremely likely" />
        </div>
      )}

      {/* Matrix settings */}
      {q.type === "matrix" && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...labelStyle, marginBottom: 6 }}>Rows</div>
          {matrixRows.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input value={r} onChange={e => { const n = [...matrixRows]; n[i] = e.target.value; onUpdate({ matrixRows: n }); }} style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => onUpdate({ matrixRows: matrixRows.filter((_, j) => j !== i) })} style={{ width: 26, height: 26, border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", cursor: "pointer", color: C.rose, fontSize: 13 }}>✕</button>
            </div>
          ))}
          <button onClick={() => onUpdate({ matrixRows: [...matrixRows, `Row ${matrixRows.length + 1}`] })} style={{ width: "100%", padding: "6px", border: `1px dashed ${C.line2}`, borderRadius: 7, background: C.paper2, cursor: "pointer", fontSize: 12, color: C.ink3, marginBottom: 10 }}>+ Row</button>
          <div style={{ ...labelStyle, marginBottom: 6 }}>Columns</div>
          {matrixCols.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input value={c} onChange={e => { const n = [...matrixCols]; n[i] = e.target.value; onUpdate({ matrixCols: n }); }} style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => onUpdate({ matrixCols: matrixCols.filter((_, j) => j !== i) })} style={{ width: 26, height: 26, border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", cursor: "pointer", color: C.rose, fontSize: 13 }}>✕</button>
            </div>
          ))}
          <button onClick={() => onUpdate({ matrixCols: [...matrixCols, `Col ${matrixCols.length + 1}`] })} style={{ width: "100%", padding: "6px", border: `1px dashed ${C.line2}`, borderRadius: 7, background: C.paper2, cursor: "pointer", fontSize: 12, color: C.ink3 }}>+ Column</button>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Rules</div>
        <ToggleRow label="Required" value={q.required ?? false} onChange={v => onUpdate({ required: v })} />
        {["mc", "cb", "dd"].includes(q.type) && (
          <ToggleRow label='Allow "Other"' value={q.allowOther ?? false} onChange={v => onUpdate({ allowOther: v })} />
        )}
        {["mc", "cb"].includes(q.type) && (
          <ToggleRow label="Randomise order" value={q.randomizeOptions ?? false} onChange={v => onUpdate({ randomizeOptions: v })} last />
        )}
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange, last }: { label: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: last ? "none" : `1px solid ${C.line}` }}>
      <span style={{ fontSize: 13, color: C.ink2 }}>{label}</span>
      <div onClick={() => onChange(!value)} style={{ width: 34, height: 20, borderRadius: 10, background: value ? C.teal : C.line2, cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 2, left: value ? 14 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
      </div>
    </div>
  );
}

// ─── Results: horizontal bar ───────────────────────────────────────────────
function ResultBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 500, width: 160, flexShrink: 0, color: C.ink2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ flex: 1, height: 28, background: C.paper2, borderRadius: 6, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(pct, 3)}%`, height: "100%", background: color, borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 8, transition: "width .5s ease" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{count}</span>
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.ink3, width: 38, textAlign: "right" }}>{pct}%</div>
    </div>
  );
}

// ─── Aggregate results per question ───────────────────────────────────────
function QuestionResults({ q, responses, idx }: { q: SurveyQuestion; responses: SurveyResponseWithAnswers[]; idx: number }) {
  const answers = responses.flatMap(r => r.answers.filter(a => a.questionId === q.id));
  const n = answers.length;

  let content: JSX.Element | null = null;

  if (q.type === "mc" || q.type === "dd" || q.type === "yn") {
    const opts = q.type === "yn" ? ["Yes", "No"] : ((q.options as string[]) || []);
    const counts: Record<string, number> = {};
    for (const a of answers) {
      const v = String(a.value ?? "");
      counts[v] = (counts[v] || 0) + 1;
    }
    const sorted = opts.map((o, i) => ({ label: o, count: counts[o] || 0, color: MC_BARS[i % MC_BARS.length] }))
      .sort((a, b) => b.count - a.count);
    content = <div>{sorted.map(s => <ResultBar key={s.label} label={s.label} count={s.count} total={n} color={s.color} />)}</div>;
  }

  if (q.type === "cb") {
    const opts = (q.options as string[]) || [];
    const counts: Record<string, number> = {};
    for (const a of answers) {
      const arr = Array.isArray(a.value) ? (a.value as string[]) : [];
      for (const v of arr) counts[v] = (counts[v] || 0) + 1;
    }
    const sorted = opts.map((o, i) => ({ label: o, count: counts[o] || 0, color: CB_BARS[i % CB_BARS.length] }))
      .sort((a, b) => b.count - a.count);
    content = <div>{sorted.map(s => <ResultBar key={s.label} label={s.label} count={s.count} total={n} color={s.color} />)}</div>;
  }

  if (q.type === "scale" || q.type === "sc") {
    const min = q.scaleMin ?? 1, max = q.scaleMax ?? (q.type === "sc" ? 5 : 10);
    const counts: Record<number, number> = {};
    for (const a of answers) counts[Number(a.value)] = (counts[Number(a.value)] || 0) + 1;
    const avg = n > 0 ? (answers.reduce((s, a) => s + Number(a.value || 0), 0) / n).toFixed(1) : "—";
    const data = Array.from({ length: max - min + 1 }, (_, i) => ({ name: String(i + min), count: counts[i + min] || 0 }));
    content = (
      <div>
        <div style={{ fontSize: 12, color: C.ink4, marginBottom: 12 }}>Average: <strong style={{ color: C.teal }}>{avg}</strong></div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.ink3 }} />
            <YAxis tick={{ fontSize: 11, fill: C.ink4 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Bar dataKey="count" fill={C.tealM} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (q.type === "nps") {
    const counts: Record<number, number> = {};
    for (const a of answers) counts[Number(a.value)] = (counts[Number(a.value)] || 0) + 1;
    const promoters = [9, 10].reduce((s, n) => s + (counts[n] || 0), 0);
    const passives = [7, 8].reduce((s, n) => s + (counts[n] || 0), 0);
    const detractors = [0,1,2,3,4,5,6].reduce((s, n) => s + (counts[n] || 0), 0);
    const npsScore = n > 0 ? Math.round(((promoters - detractors) / n) * 100) : 0;
    const data = Array.from({ length: 11 }, (_, i) => ({ name: String(i), count: counts[i] || 0, fill: i <= 6 ? C.rose : i <= 8 ? C.amber : C.teal }));
    content = (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40, padding: "16px 0" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 52, fontWeight: 700, color: npsScore >= 0 ? C.teal : C.rose, lineHeight: 1 }}>{npsScore}</div>
            <div style={{ fontSize: 12, color: C.ink4, marginTop: 4 }}>NPS Score</div>
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            {[{ label: "Promoters", n: promoters, c: C.teal }, { label: "Passives", n: passives, c: C.amber }, { label: "Detractors", n: detractors, c: C.rose }].map(g => (
              <div key={g.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: g.c }}>{g.n}</div>
                <div style={{ fontSize: 11, color: C.ink4 }}>{g.label}</div>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {data.map((d, i) => <rect key={i} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (q.type === "text" || q.type === "para") {
    const texts = answers.map(a => ({ text: String(a.value ?? ""), respId: a.responseId })).filter(a => a.text.trim());
    content = (
      <div style={{ marginTop: 12 }}>
        {texts.slice(0, 5).map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: MC_BARS[i % MC_BARS.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
            <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.5 }}>{t.text}</div>
          </div>
        ))}
        {texts.length > 5 && <div style={{ fontSize: 12, color: C.ink4, textAlign: "center", padding: 8 }}>+ {texts.length - 5} more responses</div>}
        {texts.length === 0 && <div style={{ fontSize: 13, color: C.ink4, padding: "12px 0" }}>No text responses yet.</div>}
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 24, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4, color: C.ink }}>Q{idx + 1} — {q.text}</div>
      <div style={{ fontSize: 12, color: C.ink4, marginBottom: 16 }}>{n} {n === 1 ? "response" : "responses"} · {TYPE_LABEL[q.type] || q.type}</div>
      {content || <div style={{ fontSize: 13, color: C.ink4 }}>No responses yet.</div>}
    </div>
  );
}

// ─── Question Library ──────────────────────────────────────────────────────
export const QUESTION_LIBRARY: { category: string; emoji: string; questions: { text: string; type: string; options?: string[]; helpText?: string }[] }[] = [
  { category: "Project Health", emoji: "🏗️", questions: [
    { text: "How would you rate the overall progress of this project?", type: "scale", helpText: "1 = very poor, 10 = excellent" },
    { text: "Are project deliverables being met on time?", type: "yn" },
    { text: "How clearly are risks and issues being communicated?", type: "scale" },
    { text: "How effective is communication within the project team?", type: "scale" },
    { text: "How confident are you that the project will meet its objectives?", type: "scale" },
    { text: "What is your biggest concern about this project right now?", type: "para" },
    { text: "How would you rate the quality of deliverables produced so far?", type: "sc" },
    { text: "Is the project budget being managed appropriately?", type: "yn" },
    { text: "How likely are you to recommend this project team to a colleague?", type: "nps" },
  ]},
  { category: "Customer Satisfaction", emoji: "⭐", questions: [
    { text: "Overall, how satisfied are you with the service you received?", type: "sc" },
    { text: "How likely are you to recommend us to a colleague or friend?", type: "nps" },
    { text: "Did we meet your expectations on this engagement?", type: "yn" },
    { text: "How would you rate the professionalism of the team?", type: "scale" },
    { text: "How responsive were we to your queries and requests?", type: "scale" },
    { text: "What could we have done better?", type: "para" },
    { text: "How clear was the communication throughout the engagement?", type: "scale" },
    { text: "Would you work with us again?", type: "yn" },
  ]},
  { category: "Employee Wellbeing", emoji: "💚", questions: [
    { text: "How would you rate your overall wellbeing at work right now?", type: "scale" },
    { text: "Do you feel valued in your role?", type: "yn" },
    { text: "How supported do you feel by your manager?", type: "scale" },
    { text: "Do you have the tools and resources you need to do your job effectively?", type: "yn" },
    { text: "How would you describe your current workload?", type: "mc", options: ["Too light", "About right", "Slightly heavy", "Too heavy"] },
    { text: "What one thing would most improve your experience at work?", type: "para" },
    { text: "How likely are you to still be working here in 12 months?", type: "scale" },
    { text: "How connected do you feel to the team's goals and purpose?", type: "scale" },
  ]},
  { category: "Post-Project Retrospective", emoji: "🔍", questions: [
    { text: "How would you rate the overall success of this project?", type: "sc" },
    { text: "What went well on this project?", type: "para" },
    { text: "What would you do differently if you ran this project again?", type: "para" },
    { text: "How well were issues and blockers escalated and resolved?", type: "scale" },
    { text: "How effective was the project governance and decision-making process?", type: "scale" },
    { text: "How would you rate the quality of the final deliverables?", type: "scale" },
    { text: "Were stakeholders kept appropriately informed throughout the project?", type: "yn" },
    { text: "How likely are you to recommend this project methodology to another team?", type: "nps" },
    { text: "What lessons learned should be captured for future projects?", type: "para" },
  ]},
  { category: "Training & Onboarding", emoji: "📚", questions: [
    { text: "How would you rate the quality of the training content?", type: "scale" },
    { text: "Was the training content relevant to your role and responsibilities?", type: "yn" },
    { text: "How well did the training prepare you for your day-to-day work?", type: "scale" },
    { text: "How would you rate the pace and delivery of the training?", type: "sc" },
    { text: "What topics would you like to see covered in more depth?", type: "para" },
    { text: "How confident do you feel applying what you learned?", type: "scale" },
    { text: "Would you recommend this training to a colleague?", type: "nps" },
  ]},
  { category: "System / Product Feedback", emoji: "💻", questions: [
    { text: "How easy is the system to use on a day-to-day basis?", type: "scale" },
    { text: "How would you rate the overall speed and performance of the system?", type: "sc" },
    { text: "Which features do you use most frequently?", type: "para" },
    { text: "What features are missing that you would like to see added?", type: "para" },
    { text: "How likely are you to recommend this system to a colleague?", type: "nps" },
    { text: "Has the system improved your productivity?", type: "yn" },
    { text: "How would you rate the quality of support you receive?", type: "scale" },
  ]},
];

// ─── Survey Templates ──────────────────────────────────────────────────────
export const SURVEY_TEMPLATES: { id: string; name: string; description: string; category: string; emoji: string; questions: { text: string; type: string; options?: string[]; helpText?: string; required?: boolean }[] }[] = [
  { id: "project-health", name: "Project Health Check", description: "A balanced 8-question survey to pulse-check a live project with your stakeholders.", category: "Retrospective", emoji: "🏗️",
    questions: [
      { text: "How would you rate the overall progress of this project?", type: "scale", helpText: "1 = very poor, 10 = excellent", required: true },
      { text: "Are project deliverables being met on time?", type: "yn", required: true },
      { text: "How clearly are risks and issues being communicated?", type: "scale", required: true },
      { text: "How effective is communication within the project team?", type: "scale", required: true },
      { text: "Is the project budget being managed appropriately?", type: "yn", required: false },
      { text: "How would you rate the quality of deliverables produced so far?", type: "sc", required: true },
      { text: "What is your biggest concern about this project right now?", type: "para", required: false },
      { text: "How likely are you to recommend this project team to a colleague?", type: "nps", required: true },
    ]},
  { id: "csat-nps", name: "Customer Satisfaction (CSAT + NPS)", description: "Capture overall satisfaction and net promoter score. Ideal after project delivery or service completion.", category: "Client Satisfaction", emoji: "⭐",
    questions: [
      { text: "Overall, how satisfied are you with the service you received?", type: "sc", required: true },
      { text: "How likely are you to recommend us to a colleague or friend?", type: "nps", required: true },
      { text: "Did we meet your expectations on this engagement?", type: "yn", required: true },
      { text: "How would you rate the professionalism of the team?", type: "scale", required: true },
      { text: "How responsive were we to your queries and requests?", type: "scale", required: true },
      { text: "What could we have done better?", type: "para", required: false },
    ]},
  { id: "retrospective", name: "Post-Project Retrospective", description: "Deep-dive retrospective for project teams. Covers what went well, what didn't, and lessons learned.", category: "Retrospective", emoji: "🔍",
    questions: [
      { text: "How would you rate the overall success of this project?", type: "sc", required: true },
      { text: "What went well on this project?", type: "para", required: true },
      { text: "What would you do differently if you ran this project again?", type: "para", required: true },
      { text: "How well were issues and blockers escalated and resolved?", type: "scale", required: true },
      { text: "How effective was the project governance and decision-making process?", type: "scale", required: true },
      { text: "Were stakeholders kept appropriately informed throughout the project?", type: "yn", required: false },
      { text: "How would you rate the quality of the final deliverables?", type: "scale", required: true },
      { text: "What lessons learned should be captured for future projects?", type: "para", required: false },
      { text: "How likely are you to recommend this project methodology to another team?", type: "nps", required: true },
    ]},
  { id: "employee-pulse", name: "Employee Pulse Check", description: "A quick 5-question pulse survey to gauge team morale. Best sent monthly or quarterly.", category: "Team Wellbeing", emoji: "💚",
    questions: [
      { text: "How would you rate your overall wellbeing at work right now?", type: "scale", helpText: "1 = very low, 10 = excellent", required: true },
      { text: "Do you feel valued in your role?", type: "yn", required: true },
      { text: "How supported do you feel by your manager?", type: "scale", required: true },
      { text: "How would you describe your current workload?", type: "mc", options: ["Too light", "About right", "Slightly heavy", "Too heavy"], required: true },
      { text: "What one thing would most improve your experience at work?", type: "para", required: false },
    ]},
  { id: "training", name: "Training Effectiveness", description: "Measure the quality and relevance of training sessions. Use immediately after any training event.", category: "Onboarding", emoji: "📚",
    questions: [
      { text: "How would you rate the quality of the training content?", type: "scale", required: true },
      { text: "Was the training content relevant to your role and responsibilities?", type: "yn", required: true },
      { text: "How well did the training prepare you for your day-to-day work?", type: "scale", required: true },
      { text: "How would you rate the pace and delivery of the training?", type: "sc", required: true },
      { text: "What topics would you like to see covered in more depth?", type: "para", required: false },
      { text: "How confident do you feel applying what you learned?", type: "scale", required: true },
      { text: "Would you recommend this training to a colleague?", type: "nps", required: true },
    ]},
  { id: "onboarding", name: "New Client Onboarding Feedback", description: "Gather feedback from new clients after their first 30–90 days. Identify early friction before it becomes churn.", category: "Client Satisfaction", emoji: "🤝",
    questions: [
      { text: "How smooth was your onboarding experience with us?", type: "scale", helpText: "1 = very difficult, 10 = seamless", required: true },
      { text: "Did you receive the information and support you needed to get started?", type: "yn", required: true },
      { text: "How clear were the next steps and milestones explained to you?", type: "scale", required: true },
      { text: "How responsive has our team been to your questions so far?", type: "scale", required: true },
      { text: "Is there anything that caused friction or confusion during onboarding?", type: "para", required: false },
      { text: "How likely are you to recommend us based on your experience so far?", type: "nps", required: true },
    ]},
];

// ─── PPT Export ────────────────────────────────────────────────────────────
async function exportSurveyToPPT(survey: any, responses: any[]) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const prs = new PptxGenJS();
  prs.layout = "LAYOUT_WIDE";
  const TEAL = "1A6B5A"; const LIGHT = "E4F2EE"; const DARK = "0F3D31";
  const GREY = "F2F0EB"; const INK = "0F0E0C"; const MID = "5C5952";

  // Slide 1: Cover
  const cover = prs.addSlide();
  cover.background = { color: DARK };
  cover.addText(survey.title, { x: 0.5, y: 2.2, w: 12, h: 1.2, fontSize: 36, bold: true, color: "FFFFFF", align: "center" });
  cover.addText(`${responses.length} responses · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`, { x: 0.5, y: 3.6, w: 12, h: 0.5, fontSize: 16, color: "AACCBB", align: "center" });
  if (survey.category) cover.addText(survey.category.toUpperCase(), { x: 0.5, y: 4.2, w: 12, h: 0.4, fontSize: 11, color: "88BBAA", align: "center", charSpacing: 3 });

  // Slide 2: Summary
  const completed = responses.filter((r: any) => r.completedAt);
  const summ = prs.addSlide();
  summ.addText("Survey Summary", { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 22, bold: true, color: INK });
  const summItems = [
    { label: "Total Responses", val: responses.length },
    { label: "Completed", val: completed.length },
    { label: "Questions", val: survey.questions?.length || 0 },
    { label: "Completion Rate", val: responses.length ? `${Math.round(completed.length / responses.length * 100)}%` : "—" },
  ];
  summItems.forEach((item, i) => {
    const x = 0.5 + i * 3.3;
    summ.addShape(prs.ShapeType.rect, { x, y: 1.1, w: 3, h: 1.8, fill: { color: LIGHT }, line: { color: "B0D9CE", width: 0.5 } });
    summ.addText(String(item.val), { x, y: 1.3, w: 3, h: 0.9, fontSize: 32, bold: true, color: TEAL, align: "center" });
    summ.addText(item.label, { x, y: 2.2, w: 3, h: 0.5, fontSize: 11, color: MID, align: "center" });
  });

  // One slide per question
  const TYPE_LABEL_MAP: Record<string, string> = { mc: "Multiple Choice", yn: "Yes / No", cb: "Checkboxes", dd: "Dropdown", sc: "Star Rating", scale: "Scale 1–10", nps: "NPS Score", text: "Short Text", para: "Paragraph", date: "Date", matrix: "Matrix" };
  for (let qi = 0; qi < (survey.questions || []).length; qi++) {
    const q = survey.questions[qi];
    const qSlide = prs.addSlide();
    qSlide.addText(`Q${qi + 1} · ${TYPE_LABEL_MAP[q.type] || q.type}`, { x: 0.5, y: 0.25, w: 12, h: 0.35, fontSize: 11, color: MID, charSpacing: 1 });
    qSlide.addText(q.text, { x: 0.5, y: 0.65, w: 12, h: 0.9, fontSize: 18, bold: true, color: INK, wrap: true });
    const answers = completed.map((r: any) => r.answers?.find((a: any) => a.questionId === q.id)?.value).filter((v: any) => v != null);
    if (q.type === "mc" || q.type === "cb" || q.type === "yn" || q.type === "dd") {
      const opts = q.type === "yn" ? ["Yes", "No"] : (q.options || []);
      const counts = opts.map((o: string) => ({ label: o, count: answers.filter((a: any) => Array.isArray(a) ? a.includes(o) : a === o).length }));
      const max = Math.max(1, ...counts.map((c: any) => c.count));
      counts.forEach((c: any, i: number) => {
        const y = 1.7 + i * 0.55;
        const barW = Math.max(0.1, (c.count / max) * 7);
        qSlide.addShape(prs.ShapeType.rect, { x: 3.5, y: y + 0.05, w: barW, h: 0.38, fill: { color: LIGHT } });
        qSlide.addText(c.label, { x: 0.5, y, w: 2.8, h: 0.45, fontSize: 12, color: INK, valign: "middle" });
        qSlide.addText(`${c.count}`, { x: 3.5 + barW + 0.1, y, w: 0.8, h: 0.45, fontSize: 12, bold: true, color: TEAL, valign: "middle" });
      });
    } else if (q.type === "scale" || q.type === "nps") {
      const nums = answers.map(Number).filter((n: number) => !isNaN(n));
      const avg = nums.length ? (nums.reduce((a: number, b: number) => a + b, 0) / nums.length).toFixed(1) : "—";
      qSlide.addShape(prs.ShapeType.rect, { x: 4.5, y: 1.7, w: 4, h: 1.8, fill: { color: LIGHT }, line: { color: "B0D9CE", width: 0.5 } });
      qSlide.addText(avg, { x: 4.5, y: 1.9, w: 4, h: 0.9, fontSize: 52, bold: true, color: TEAL, align: "center" });
      qSlide.addText(q.type === "nps" ? "Average NPS Score (0–10)" : "Average Score (1–10)", { x: 4.5, y: 2.9, w: 4, h: 0.4, fontSize: 11, color: MID, align: "center" });
      if (nums.length) qSlide.addText(`${nums.length} responses`, { x: 4.5, y: 3.4, w: 4, h: 0.3, fontSize: 10, color: MID, align: "center" });
    } else if (q.type === "sc") {
      const nums = answers.map(Number).filter((n: number) => !isNaN(n));
      const avg = nums.length ? (nums.reduce((a: number, b: number) => a + b, 0) / nums.length).toFixed(1) : "—";
      qSlide.addText(`Average: ${avg} / 5 ⭐`, { x: 2, y: 2, w: 9, h: 0.8, fontSize: 28, bold: true, color: TEAL, align: "center" });
    } else if (q.type === "para" || q.type === "text") {
      const texts = answers.filter((a: any) => typeof a === "string" && a.trim()).slice(0, 5);
      texts.forEach((t: string, i: number) => {
        qSlide.addText(`"${t}"`, { x: 0.5, y: 1.7 + i * 0.9, w: 12, h: 0.8, fontSize: 12, color: INK, italic: true, wrap: true });
      });
      if (!texts.length) qSlide.addText("No text responses yet", { x: 0.5, y: 2.5, w: 12, h: 0.5, fontSize: 13, color: MID, align: "center" });
    }
    qSlide.addShape(prs.ShapeType.rect, { x: 0, y: 7.3, w: 13.33, h: 0.2, fill: { color: LIGHT } });
    qSlide.addText(survey.title, { x: 0.5, y: 7.1, w: 9, h: 0.25, fontSize: 9, color: MID });
    qSlide.addText(`${qi + 1} / ${survey.questions.length}`, { x: 12, y: 7.1, w: 1, h: 0.25, fontSize: 9, color: MID, align: "right" });
  }
  prs.writeFile({ fileName: `${survey.title.replace(/[^a-z0-9]/gi, "_")}_results.pptx` });
}

// ─── CSV Export ────────────────────────────────────────────────────────────
function exportSurveyToCSV(survey: any, responses: any[]) {
  const headers = ["Respondent", "Completed At", "Time (s)", ...survey.questions.map((q: any, i: number) => `Q${i + 1}: ${q.text.replace(/,/g, ";").substring(0, 60)}`)];
  const rows = responses.filter((r: any) => r.completedAt).map((r: any) => {
    const base = [r.respondentName || "Anonymous", r.completedAt ? new Date(r.completedAt).toLocaleDateString("en-GB") : "", r.timeSeconds || ""];
    const vals = survey.questions.map((q: any) => {
      const a = r.answers?.find((ans: any) => ans.questionId === q.id);
      if (!a) return "";
      const v = a.value;
      if (Array.isArray(v)) return v.join("; ");
      return String(v ?? "").replace(/,/g, ";");
    });
    return [...base, ...vals];
  });
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `${survey.title.replace(/[^a-z0-9]/gi, "_")}_responses.csv`; a.click();
}

// ─── New Survey Wizard ─────────────────────────────────────────────────────
const CATEGORIES = ["Retrospective", "Client Satisfaction", "Team Wellbeing", "Onboarding", "Product Feedback", "Other"];

type CreationMode = "scratch" | "template" | "ai";

function NewSurveyWizard({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  // step 0 = mode picker | 1 = mode-specific | 2 = details | 3 = settings | 4 = review
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<CreationMode | null>(null);
  // Details
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("Retrospective");
  const [anonymous, setAnonymous] = useState(false);
  const [closeDate, setCloseDate] = useState("");
  // Template path
  const [selectedTpl, setSelectedTpl] = useState<string | null>(null);
  const [previewTpl, setPreviewTpl] = useState<string | null>(null);
  // AI path
  const [aiDesc, setAiDesc] = useState("");
  const [aiCount, setAiCount] = useState(8);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<any[]>([]);
  const [aiError, setAiError] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const inputStyle = { width: "100%", padding: "9px 12px", border: `1px solid ${C.line2}`, borderRadius: 8, fontFamily: "inherit", fontSize: 14, outline: "none", boxSizing: "border-box" as const };
  const labelStyle = { display: "block" as const, fontSize: 11, fontWeight: 600 as const, color: C.ink3, marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: ".05em" };

  const createMut = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/surveys", body),
    onSuccess: async (res) => {
      const survey = await res.json();
      // Bulk-add questions if template or AI path
      let questionsToAdd: any[] = [];
      if (mode === "template" && selectedTpl) {
        const tpl = SURVEY_TEMPLATES.find(t => t.id === selectedTpl);
        if (tpl) questionsToAdd = tpl.questions;
      } else if (mode === "ai" && aiQuestions.length) {
        questionsToAdd = aiQuestions;
      }
      if (questionsToAdd.length) {
        await apiRequest("POST", `/api/surveys/${survey.id}/questions/bulk`, { questions: questionsToAdd });
      }
      qc.invalidateQueries({ queryKey: ["/api/surveys"] });
      toast({ title: `Survey created ✓${questionsToAdd.length ? ` · ${questionsToAdd.length} questions added` : ""}` });
      onCreated(survey.id);
    },
  });

  const handleGenerate = useCallback(async () => {
    if (!aiDesc.trim()) { setAiError("Please describe what this survey is about."); return; }
    setAiError(""); setAiGenerating(true); setAiQuestions([]);
    try {
      const res = await apiRequest("POST", "/api/surveys/ai-generate", { description: aiDesc, count: aiCount });
      const data = await res.json();
      if (data.questions?.length) { setAiQuestions(data.questions); }
      else { setAiError("AI did not return any questions. Try a more specific description."); }
    } catch (e: any) { setAiError(e.message || "AI generation failed."); }
    finally { setAiGenerating(false); }
  }, [aiDesc, aiCount]);

  const removeAiQ = (i: number) => setAiQuestions(qs => qs.filter((_, idx) => idx !== i));
  const editAiQText = (i: number, text: string) => setAiQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, text } : q));

  const stepLabels = mode === "scratch"
    ? ["Details", "Settings", "Review"]
    : mode === "template"
    ? ["Template", "Details", "Settings", "Review"]
    : ["AI Generate", "Details", "Settings", "Review"];
  const totalSteps = stepLabels.length;
  // For scratch: steps 2,3,4 map to indices 0,1,2. For template/ai: steps 1,2,3,4 map to 0,1,2,3
  const currentStepIdx = mode === "scratch" ? step - 2 : step - 1;

  const goNext = () => {
    if (step === 0) { if (!mode) return; if (mode === "scratch") setStep(2); else setStep(1); return; }
    if (step === 1 && mode === "template" && !selectedTpl) { toast({ title: "Please choose a template", variant: "destructive" }); return; }
    if (step === 1 && mode === "ai" && !aiQuestions.length) { toast({ title: "Please generate questions first", variant: "destructive" }); return; }
    if (step === 2 && !title.trim()) { toast({ title: "Please enter a survey title", variant: "destructive" }); return; }
    setStep(s => s + 1);
  };
  const goBack = () => { if (step === 2 && mode === "scratch") setStep(0); else if (step === 2 && mode !== "scratch") setStep(1); else setStep(s => s - 1); };

  const tpl = selectedTpl ? SURVEY_TEMPLATES.find(t => t.id === selectedTpl) : null;
  const previewTplObj = previewTpl ? SURVEY_TEMPLATES.find(t => t.id === previewTpl) : null;

  const handleCreate = () => {
    createMut.mutate({ title, description: desc, category, anonymous, status: "draft",
      ...(tpl && !title.trim() ? {} : {}), // title already set
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,14,12,.65)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 12px 48px rgba(0,0,0,.2)", width: "100%", maxWidth: step === 1 && mode === "template" ? 780 : 640, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", animation: "su .2s ease" }}>
        <style>{`@keyframes su{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>Create New Survey</div>
            {step > 0 && mode && <div style={{ fontSize: 12, color: C.ink4, marginTop: 2 }}>{mode === "scratch" ? "Starting from scratch" : mode === "template" ? "From template" : "AI-generated"}</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.ink3, lineHeight: 1 }} data-testid="button-close-wizard">✕</button>
        </div>

        {/* Step bar (only when past mode picker) */}
        {step > 0 && mode && (
          <div style={{ display: "flex", borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
            {stepLabels.map((label, i) => {
              const done = currentStepIdx > i, active = currentStepIdx === i;
              return (
                <div key={label} style={{ flex: 1, padding: "9px 6px", textAlign: "center", fontSize: 11, fontWeight: 600, background: done ? C.tealL : active ? C.teal : "#fff", color: done ? C.teal : active ? "#fff" : C.ink4, borderRight: i < totalSteps - 1 ? `1px solid ${C.line}` : "none", transition: "all .15s" }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 1 }}>{done ? "✓" : i + 1}</span>
                  {label}
                </div>
              );
            })}
          </div>
        )}

        {/* Body */}
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>

          {/* ── Step 0: Mode Picker ── */}
          {step === 0 && (
            <div>
              <div style={{ fontSize: 14, color: C.ink3, marginBottom: 20 }}>How would you like to create this survey?</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                {([
                  { id: "scratch", emoji: "✏️", title: "Start from Scratch", desc: "Blank canvas. Add questions manually in the builder." },
                  { id: "template", emoji: "📋", title: "Use a Template", desc: "Pick from 6 professionally crafted question sets." },
                  { id: "ai", emoji: "✨", title: "Generate with AI", desc: "Describe your survey in plain English and let AI build it." },
                ] as { id: CreationMode; emoji: string; title: string; desc: string }[]).map(opt => (
                  <button key={opt.id} onClick={() => setMode(opt.id)} data-testid={`card-mode-${opt.id}`}
                    style={{ padding: "20px 16px", border: `2px solid ${mode === opt.id ? C.teal : C.line2}`, borderRadius: 12, background: mode === opt.id ? C.tealL : "#fff", cursor: "pointer", textAlign: "left", transition: "all .12s", boxShadow: mode === opt.id ? `0 0 0 1px ${C.teal}` : "none" }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>{opt.emoji}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, marginBottom: 6 }}>{opt.title}</div>
                    <div style={{ fontSize: 12, color: C.ink3, lineHeight: 1.5 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 1 Template: Template Picker ── */}
          {step === 1 && mode === "template" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {SURVEY_TEMPLATES.map(t => (
                <div key={t.id}
                  style={{ border: `2px solid ${selectedTpl === t.id ? C.teal : C.line2}`, borderRadius: 12, padding: 16, cursor: "pointer", background: selectedTpl === t.id ? C.tealL : "#fff", transition: "all .12s", boxShadow: selectedTpl === t.id ? `0 0 0 1px ${C.teal}` : "none" }}
                  onClick={() => { setSelectedTpl(t.id); if (!title) setTitle(t.name); setCategory(t.category); }}
                  data-testid={`card-template-${t.id}`}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 22 }}>{t.emoji}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.teal, background: C.tealL, padding: "2px 8px", borderRadius: 20 }}>{t.questions.length} questions</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, marginBottom: 4 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: C.ink3, lineHeight: 1.5, marginBottom: 8 }}>{t.description}</div>
                  <button onClick={e => { e.stopPropagation(); setPreviewTpl(previewTpl === t.id ? null : t.id); }}
                    style={{ background: "none", border: `1px solid ${C.line2}`, borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer", color: C.ink3 }}>
                    {previewTpl === t.id ? "Hide preview ▲" : "Preview questions ▼"}
                  </button>
                  {previewTpl === t.id && (
                    <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
                      {t.questions.map((q, qi) => (
                        <div key={qi} style={{ fontSize: 12, color: C.ink2, marginBottom: 6, display: "flex", gap: 8 }}>
                          <span style={{ color: C.teal, fontWeight: 700, flexShrink: 0 }}>{qi + 1}.</span>
                          <span>{q.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Step 1 AI: AI Generation ── */}
          {step === 1 && mode === "ai" && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Describe your survey *</label>
                <textarea value={aiDesc} onChange={e => { setAiDesc(e.target.value); setAiError(""); }}
                  rows={4} style={{ ...inputStyle, resize: "vertical" }}
                  placeholder="e.g. A post-project retrospective survey for an ERP implementation project team. Focus on lessons learned, team dynamics, and delivery quality."
                  data-testid="input-ai-description" />
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Number of questions</label>
                  <select value={aiCount} onChange={e => setAiCount(Number(e.target.value))} style={inputStyle}>
                    {[5, 6, 7, 8, 10, 12].map(n => <option key={n} value={n}>{n} questions</option>)}
                  </select>
                </div>
                <button onClick={handleGenerate} disabled={aiGenerating || !aiDesc.trim()}
                  style={{ padding: "9px 20px", background: C.teal, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, opacity: aiGenerating || !aiDesc.trim() ? 0.6 : 1, whiteSpace: "nowrap" as const }}
                  data-testid="button-ai-generate">
                  {aiGenerating ? "✨ Generating…" : "✨ Generate Questions"}
                </button>
              </div>
              {aiError && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12, padding: "8px 12px", background: "#fef2f2", borderRadius: 8 }}>{aiError}</div>}
              {aiGenerating && (
                <div style={{ padding: "24px 0", textAlign: "center" as const, color: C.ink3 }}>
                  <div style={{ fontSize: 28, marginBottom: 8, animation: "spin 1.5s linear infinite" }}>✨</div>
                  <div style={{ fontSize: 14 }}>AI is crafting your survey questions…</div>
                  <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                </div>
              )}
              {aiQuestions.length > 0 && !aiGenerating && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
                    Review & edit — {aiQuestions.length} questions generated
                  </div>
                  {aiQuestions.map((q, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: C.tealL, color: C.teal, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 8 }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <input value={q.text} onChange={e => editAiQText(i, e.target.value)}
                          style={{ ...inputStyle, marginBottom: 0 }} data-testid={`input-ai-q-${i}`} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: C.teal, background: C.tealL, padding: "3px 8px", borderRadius: 20, marginTop: 8, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{TYPE_LABEL[q.type] || q.type}</span>
                      <button onClick={() => removeAiQ(i)} style={{ background: "none", border: "none", color: C.ink4, cursor: "pointer", fontSize: 16, marginTop: 7, flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                  <button onClick={handleGenerate} style={{ marginTop: 4, background: "none", border: `1px dashed ${C.line2}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, color: C.ink3, cursor: "pointer", width: "100%" }}>
                    ↺ Regenerate all questions
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Details ── */}
          {step === 2 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Survey Title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="e.g. Sprint Retrospective — April 2026" data-testid="input-survey-title" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Description</label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} placeholder="Tell respondents what this is about…" />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle} data-testid="select-survey-category">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Close Date (optional)</label>
                <input type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} style={inputStyle} />
              </div>
              {mode === "template" && tpl && (
                <div style={{ gridColumn: "1 / -1", padding: "10px 14px", background: C.tealL, borderRadius: 8, fontSize: 13, color: C.teal }}>
                  {tpl.emoji} Template: <strong>{tpl.name}</strong> · {tpl.questions.length} questions will be added automatically
                </div>
              )}
              {mode === "ai" && aiQuestions.length > 0 && (
                <div style={{ gridColumn: "1 / -1", padding: "10px 14px", background: C.tealL, borderRadius: 8, fontSize: 13, color: C.teal }}>
                  ✨ {aiQuestions.length} AI-generated questions will be added automatically
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Settings ── */}
          {step === 3 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ background: C.paper2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.ink4, textTransform: "uppercase", marginBottom: 10 }}>Display</div>
                <ToggleRow label="Show progress bar" value={true} onChange={() => {}} />
                <ToggleRow label="One question per page" value={true} onChange={() => {}} last />
              </div>
              <div style={{ background: C.paper2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.ink4, textTransform: "uppercase", marginBottom: 10 }}>Privacy</div>
                <ToggleRow label="Anonymous responses" value={anonymous} onChange={setAnonymous} last />
              </div>
            </div>
          )}

          {/* ── Step 4 (or 3 for scratch): Review ── */}
          {step === 4 && (
            <div style={{ background: C.paper2, borderRadius: 10, padding: 20 }}>
              <div style={{ marginBottom: 12 }}><span style={{ fontSize: 12, color: C.ink4 }}>Title:</span> <strong style={{ fontSize: 14 }}>{title || "Untitled"}</strong></div>
              <div style={{ marginBottom: 12 }}><span style={{ fontSize: 12, color: C.ink4 }}>Category:</span> <strong style={{ fontSize: 14 }}>{category}</strong></div>
              <div style={{ marginBottom: 12 }}><span style={{ fontSize: 12, color: C.ink4 }}>Mode:</span> <strong style={{ fontSize: 14 }}>{mode === "scratch" ? "Scratch" : mode === "template" ? `Template — ${tpl?.name}` : `AI-generated (${aiQuestions.length} questions)`}</strong></div>
              <div style={{ marginBottom: 12 }}><span style={{ fontSize: 12, color: C.ink4 }}>Anonymous:</span> <strong style={{ fontSize: 14 }}>{anonymous ? "Yes" : "No"}</strong></div>
              {closeDate && <div style={{ marginBottom: 12 }}><span style={{ fontSize: 12, color: C.ink4 }}>Closes:</span> <strong style={{ fontSize: 14 }}>{fmtDate(closeDate)}</strong></div>}
              <div style={{ marginTop: 16, padding: "12px 14px", background: C.tealL, borderRadius: 8, fontSize: 13, color: C.teal }}>
                ✓ Survey will be created as a draft — edit and add questions in the builder before activating.
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            {step > 0 && <button onClick={goBack} style={{ padding: "8px 16px", border: `1px solid ${C.line}`, borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 14 }} data-testid="button-wizard-back">← Back</button>}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "8px 16px", border: `1px solid ${C.line}`, borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 14 }}>Cancel</button>
            {step < (mode === "scratch" ? 4 : 4) ? (
              <button onClick={goNext} disabled={step === 0 && !mode}
                style={{ padding: "8px 20px", background: C.teal, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500, opacity: step === 0 && !mode ? 0.5 : 1 }}
                data-testid="button-wizard-next">
                Next →
              </button>
            ) : (
              <button onClick={handleCreate} disabled={createMut.isPending}
                style={{ padding: "8px 24px", background: C.teal, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, opacity: createMut.isPending ? 0.6 : 1 }}
                data-testid="button-create-survey">
                {createMut.isPending ? "Creating…" : "✓ Create Survey"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Share link modal ──────────────────────────────────────────────────────
function ShareModal({ survey, onClose }: { survey: SurveyWithDetails; onClose: () => void }) {
  const { toast } = useToast();
  const link = `${window.location.origin}/survey/${survey.token}`;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,14,12,.6)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,.15)", width: "100%", maxWidth: 480 }}>
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Share Survey</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: C.ink3 }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.ink4, textTransform: "uppercase", marginBottom: 8 }}>Survey Link</div>
          <div style={{ display: "flex", alignItems: "center", background: C.paper2, border: `1px solid ${C.line2}`, borderRadius: 8, overflow: "hidden" }}>
            <input readOnly value={link} style={{ flex: 1, padding: "9px 12px", border: "none", background: "transparent", fontSize: 13, outline: "none", color: C.ink }} />
            <button onClick={() => { navigator.clipboard.writeText(link); toast({ title: "Link copied ✓" }); }}
              style={{ padding: "9px 14px", background: C.teal, color: "#fff", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Copy</button>
          </div>
          {survey.status !== "active" && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: C.amberL, borderRadius: 8, fontSize: 13, color: C.amber }}>
              ⚠ This survey is currently <strong>{survey.status}</strong>. Activate it before sharing so respondents can submit.
            </div>
          )}
        </div>
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 20px", background: C.teal, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ─── Individual response modal ─────────────────────────────────────────────
function ResponseModal({ response, survey, idx, total, onNav, onClose }: {
  response: SurveyResponseWithAnswers; survey: SurveyWithDetails;
  idx: number; total: number; onNav: (d: -1 | 1) => void; onClose: () => void;
}) {
  const answersMap = new Map(response.answers.map(a => [a.questionId, a]));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,14,12,.6)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,.15)", width: "100%", maxWidth: 620, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Response from {response.respondentName || "Anonymous"}</div>
            <div style={{ fontSize: 12, color: C.ink4, marginTop: 2 }}>{fmtDate(response.completedAt?.toString())} · {fmtTime(response.timeSeconds)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => onNav(-1)} disabled={idx === 0} style={{ width: 30, height: 30, border: `1px solid ${C.line}`, borderRadius: 7, background: "#fff", cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.4 : 1 }}>←</button>
            <span style={{ fontSize: 12, color: C.ink4 }}>{idx + 1} / {total}</span>
            <button onClick={() => onNav(1)} disabled={idx === total - 1} style={{ width: 30, height: 30, border: `1px solid ${C.line}`, borderRadius: 7, background: "#fff", cursor: idx === total - 1 ? "not-allowed" : "pointer", opacity: idx === total - 1 ? 0.4 : 1 }}>→</button>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: C.ink3, marginLeft: 4 }}>✕</button>
          </div>
        </div>
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          {survey.questions.map((q, i) => {
            const a = answersMap.get(q.id);
            const val = a?.value;
            const display = Array.isArray(val) ? (val as string[]).join(", ") : val != null ? String(val) : "—";
            return (
              <div key={q.id} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: i < survey.questions.length - 1 ? `1px solid ${C.line}` : "none" }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: C.ink4, marginBottom: 3 }}>Q{i + 1} · {TYPE_LABEL[q.type]}</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: C.ink }}>{q.text}</div>
                {q.type === "scale" || q.type === "nps" ? (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {Array.from({ length: (q.scaleMax || 10) - (q.scaleMin || 0) + 1 }, (_, i) => i + (q.scaleMin || 0)).map(n => {
                      const chosen = Number(val) === n;
                      const bg = q.type === "nps" ? (n <= 6 ? C.roseL : n <= 8 ? C.amberL : C.tealL) : C.paper2;
                      const col = q.type === "nps" ? (n <= 6 ? C.rose : n <= 8 ? C.amber : C.teal) : C.ink4;
                      return <div key={n} style={{ width: 32, height: 32, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, background: chosen ? C.teal : bg, color: chosen ? "#fff" : col, border: `1px solid ${chosen ? C.teal : C.line}` }}>{n}</div>;
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, background: C.tealL, border: `1px solid #b0d9ce`, borderRadius: 8, padding: "9px 13px", color: C.teal, fontWeight: 500 }}>{display}</div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 20px", background: C.teal, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function SurveysPage() {
  const { mainOffset, mobileTopOffset } = useShellLayout();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [view, setView] = useState<View>("dashboard");
  const [activeSurveyId, setActiveSurveyId] = useState<number | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [shareModal, setShareModal] = useState<SurveyWithDetails | null>(null);
  const [dashTab, setDashTab] = useState<"active" | "history">("active");
  const [searchQ, setSearchQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedQId, setSelectedQId] = useState<number | null>(null);
  const [builderTitle, setBuilderTitle] = useState("");
  const [builderDesc, setBuilderDesc] = useState("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [responseModal, setResponseModal] = useState<{ idx: number } | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: surveys = [], isLoading } = useQuery<SurveyWithDetails[]>({ queryKey: ["/api/surveys"] });

  const { data: activeSurvey } = useQuery<SurveyWithDetails>({
    queryKey: ["/api/surveys", activeSurveyId],
    enabled: !!activeSurveyId,
  });

  const { data: responses = [] } = useQuery<SurveyResponseWithAnswers[]>({
    queryKey: ["/api/surveys", activeSurveyId, "responses"],
    queryFn: () => fetch(`/api/surveys/${activeSurveyId}/responses`, { credentials: "include" }).then(r => r.json()),
    enabled: !!activeSurveyId && view === "results",
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/surveys/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/surveys"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/surveys/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/surveys"] }); toast({ title: "Survey deleted" }); },
  });

  const activateMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/surveys/${id}/activate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/surveys"] }); toast({ title: "Survey activated ✓" }); },
  });

  const closeMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/surveys/${id}/close`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/surveys"] }); toast({ title: "Survey closed" }); },
  });

  const duplicateMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/surveys/${id}/duplicate`),
    onSuccess: async (res) => {
      const copy = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/surveys"] });
      toast({ title: `"${copy.title}" created ✓`, description: "The survey is a draft — open it to edit." });
    },
    onError: () => toast({ title: "Duplicate failed", variant: "destructive" }),
  });

  const addQMut = useMutation({
    mutationFn: ({ surveyId, type }: { surveyId: number; type: string }) => {
      const defaults: any = { type, text: `New ${TYPE_LABEL[type] || type} question`, options: type === "mc" ? ["Option 1", "Option 2", "Option 3"] : type === "cb" ? ["Option A", "Option B", "Option C"] : type === "dd" ? ["Choice 1", "Choice 2"] : [] };
      return apiRequest("POST", `/api/surveys/${surveyId}/questions`, defaults);
    },
    onSuccess: async (res) => {
      const q: SurveyQuestion = await res.json();
      await qc.invalidateQueries({ queryKey: ["/api/surveys", activeSurveyId] });
      setSelectedQId(q.id);
    },
  });

  const updateQMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/surveys/questions/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/surveys", activeSurveyId] }),
  });

  const deleteQMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/surveys/questions/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/surveys", activeSurveyId] }); setSelectedQId(null); },
  });

  const reorderMut = useMutation({
    mutationFn: ({ surveyId, orderedIds }: { surveyId: number; orderedIds: number[] }) =>
      apiRequest("POST", `/api/surveys/${surveyId}/questions/reorder`, { orderedIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/surveys", activeSurveyId] }),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function openBuilder(survey: SurveyWithDetails) {
    setActiveSurveyId(survey.id);
    setBuilderTitle(survey.title);
    setBuilderDesc(survey.description || "");
    setSelectedQId(null);
    setView("builder");
  }

  function openResults(id: number) {
    setActiveSurveyId(id);
    setView("results");
  }

  function saveBuilderMeta() {
    if (!activeSurveyId) return;
    updateMut.mutate({ id: activeSurveyId, data: { title: builderTitle, description: builderDesc } });
    toast({ title: "Saved ✓" });
  }

  // ── Auto-save: debounce title/desc changes in the builder ────────────────
  useEffect(() => {
    if (view !== "builder" || !activeSurveyId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setAutoSaveStatus("idle");
    autoSaveTimer.current = setTimeout(async () => {
      if (!builderTitle.trim()) return;
      setAutoSaveStatus("saving");
      try {
        await apiRequest("PATCH", `/api/surveys/${activeSurveyId}`, { title: builderTitle, description: builderDesc });
        qc.invalidateQueries({ queryKey: ["/api/surveys"] });
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2500);
      } catch { setAutoSaveStatus("idle"); }
    }, 1400);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [builderTitle, builderDesc]); // eslint-disable-line

  function moveQ(questions: SurveyQuestion[], idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= questions.length) return;
    const ids = questions.map(q => q.id);
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    reorderMut.mutate({ surveyId: activeSurveyId!, orderedIds: ids });
  }

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredSurveys = surveys.filter(s => {
    const matchSearch = s.title.toLowerCase().includes(searchQ.toLowerCase());
    const matchStatus = !statusFilter || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const kpiTotal = surveys.length;
  const kpiActive = surveys.filter(s => s.status === "active").length;
  const kpiResponses = surveys.reduce((a, s) => a + s.responseCount, 0);
  const kpiDrafts = surveys.filter(s => s.status === "draft").length;

  const questions = activeSurvey?.questions || [];
  const selectedQ = questions.find(q => q.id === selectedQId) || null;

  const btnPrimary: React.CSSProperties = { padding: "8px 18px", background: C.teal, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 };
  const btnSecondary: React.CSSProperties = { padding: "8px 16px", background: "#fff", color: C.ink, border: `1px solid ${C.line2}`, borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 };
  const btnGhost: React.CSSProperties = { padding: "7px 14px", background: "transparent", color: C.ink3, border: `1px solid ${C.line}`, borderRadius: 8, cursor: "pointer", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 };

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: DASHBOARD
  // ════════════════════════════════════════════════════════════════════════════
  if (view === "dashboard") return (
    <div className="h-screen overflow-hidden bg-background flex">
      <Sidebar />
      <main className={cn("transition-all duration-300 h-full overflow-y-auto flex-1", mainOffset, mobileTopOffset)}>
        <div style={{ maxWidth: 1020, margin: "0 auto", padding: "0 24px 40px" }}>
          {/* Header */}
          <div style={{ padding: "32px 0 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 4 }}>Surveys</h1>
              <p style={{ color: C.ink3, fontSize: 14, margin: 0 }}>Build, distribute, and analyse surveys across your projects and teams</p>
            </div>
            <button onClick={() => setWizardOpen(true)} style={btnPrimary} data-testid="button-new-survey">+ New Survey</button>
          </div>

          {/* KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
            {[
              { n: kpiTotal,     label: "Total surveys",    color: C.ink },
              { n: kpiActive,    label: "Active now",       color: C.teal },
              { n: kpiResponses, label: "Total responses",  color: C.amber },
              { n: kpiDrafts,    label: "Drafts",           color: C.violet },
            ].map(k => (
              <div key={k.label} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: k.color }}>{k.n}</div>
                <div style={{ fontSize: 12, color: C.ink3, marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, background: C.paper3, padding: 3, borderRadius: 10, marginBottom: 24, maxWidth: 360 }}>
            {(["active", "history"] as const).map(t => (
              <div key={t} onClick={() => setDashTab(t)}
                style={{ flex: 1, padding: "8px", textAlign: "center", fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: "pointer", background: dashTab === t ? "#fff" : "transparent", color: dashTab === t ? C.ink : C.ink3, boxShadow: dashTab === t ? "0 1px 3px rgba(0,0,0,.06)" : "none" }}>
                {t === "active" ? "Active & Recent" : "All Surveys"}
              </div>
            ))}
          </div>

          {/* Search + filter (history only) */}
          {dashTab === "history" && (
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                style={{ flex: 1, padding: "8px 12px", border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 13, outline: "none" }}
                placeholder="Search surveys…" data-testid="input-search-surveys" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{ width: 150, padding: "8px 12px", border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 13, outline: "none" }}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          )}

          {/* Survey list */}
          <div>
            {isLoading ? (
              <div style={{ textAlign: "center", padding: "48px", color: C.ink4 }}>Loading surveys…</div>
            ) : (
              (dashTab === "active" ? surveys.filter(s => ["active", "draft"].includes(s.status)).slice(0, 8) : filteredSurveys).map(s => {
                const st = STATUS_STYLES[s.status] || STATUS_STYLES.draft;
                const icon = CATEGORY_ICONS[s.category || ""] || "📋";
                const iconBg = s.status === "active" ? C.tealL : s.status === "closed" ? C.roseL : s.status === "draft" ? C.amberL : C.blueL;
                return (
                  <div key={s.id} data-testid={`survey-row-${s.id}`}
                    style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "18px 22px", marginBottom: 10, display: "flex", alignItems: "center", gap: 16, boxShadow: "0 1px 3px rgba(0,0,0,.06)", transition: "box-shadow .15s" }}>
                    <div style={{ width: 46, height: 46, borderRadius: 11, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{icon}</div>
                    <div style={{ flex: 1, cursor: "pointer", minWidth: 0 }} onClick={() => openResults(s.id)}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: C.ink4 }}>
                        {s.questions.length} questions · {s.responseCount} responses
                        {s.status === "draft" ? " · Not yet sent" : s.sentAt ? ` · Sent ${fmtDate(s.sentAt.toString())}` : ""}
                      </div>
                    </div>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: st.bg, color: st.color, flexShrink: 0 }}>
                      {st.dot && "● "}{st.label}
                    </span>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      {s.status === "completed" || s.status === "closed" ? (
                        <button onClick={() => openResults(s.id)} style={btnPrimary} data-testid={`button-results-${s.id}`}>Results</button>
                      ) : s.status === "draft" ? (
                        <>
                          <button onClick={() => openBuilder(s)} style={btnGhost} data-testid={`button-edit-${s.id}`}>Edit</button>
                          <button onClick={() => activateMut.mutate(s.id)} style={btnPrimary} data-testid={`button-activate-${s.id}`}>Activate</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openBuilder(s)} style={btnGhost} data-testid={`button-edit-${s.id}`}>Edit</button>
                          <button onClick={() => openResults(s.id)} style={btnPrimary} data-testid={`button-results-${s.id}`}>Results</button>
                        </>
                      )}
                      <button onClick={() => duplicateMut.mutate(s.id)} disabled={duplicateMut.isPending}
                        title="Duplicate survey"
                        style={{ ...btnGhost }} data-testid={`button-duplicate-${s.id}`}>⧉ Duplicate</button>
                      <button onClick={() => { if (confirm(`Delete "${s.title}"?`)) deleteMut.mutate(s.id); }}
                        style={{ ...btnGhost, color: C.rose, borderColor: "#f0b8b8" }} data-testid={`button-delete-${s.id}`}>Delete</button>
                    </div>
                  </div>
                );
              })
            )}
            {!isLoading && surveys.length === 0 && (
              <div style={{ textAlign: "center", padding: "56px 24px", color: C.ink4 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: C.ink }}>No surveys yet</div>
                <div style={{ fontSize: 14, marginBottom: 20 }}>Create your first survey to get started.</div>
                <button onClick={() => setWizardOpen(true)} style={btnPrimary}>+ New Survey</button>
              </div>
            )}
          </div>
        </div>

        {wizardOpen && <NewSurveyWizard onClose={() => setWizardOpen(false)} onCreated={id => { setWizardOpen(false); setActiveSurveyId(id); openBuilder(surveys.find(s => s.id === id) || { id, title: "", questions: [], responseCount: 0 } as any); }} />}
        {shareModal && <ShareModal survey={shareModal} onClose={() => setShareModal(null)} />}
      </main>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: BUILDER
  // ════════════════════════════════════════════════════════════════════════════
  if (view === "builder") {
    const groups = ["Choice", "Rating", "Open-ended", "Other"];
    return (
      <div className="h-screen overflow-hidden bg-background flex">
        <Sidebar />
        <main className={cn("transition-all duration-300 h-full overflow-hidden flex flex-col", mainOffset, mobileTopOffset)}>
          {/* Top bar */}
          <div style={{ background: "#fff", borderBottom: `1px solid ${C.line}`, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setView("dashboard")} style={btnGhost}>← Back</button>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.ink2, maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{builderTitle || "Untitled Survey"}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {autoSaveStatus === "saving" && <span style={{ fontSize: 12, color: C.ink4 }}>Saving…</span>}
              {autoSaveStatus === "saved" && <span style={{ fontSize: 12, color: C.teal, fontWeight: 500 }}>✓ Saved</span>}
              <button onClick={saveBuilderMeta} style={btnSecondary} data-testid="button-builder-save">Save</button>
              {activeSurvey && <button onClick={() => setShareModal(activeSurvey)} style={btnSecondary}>🔗 Share</button>}
              {activeSurvey?.status === "draft" && (
                <button onClick={() => activateMut.mutate(activeSurveyId!)} style={btnPrimary}>Activate Survey →</button>
              )}
              {activeSurvey?.status === "active" && (
                <button onClick={() => openResults(activeSurveyId!)} style={btnPrimary}>View Results →</button>
              )}
            </div>
          </div>

          {/* 3-panel layout */}
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 260px", flex: 1, overflow: "hidden" }}>
            {/* Left: question types */}
            <div style={{ background: "#fff", borderRight: `1px solid ${C.line}`, padding: "18px 14px", overflowY: "auto" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Add Question</div>
              {groups.map(g => (
                <div key={g}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: C.ink4, marginTop: 14, marginBottom: 6 }}>{g}</div>
                  {QUESTION_TYPES.filter(qt => qt.group === g).map(qt => (
                    <div key={qt.type} onClick={() => activeSurveyId && addQMut.mutate({ surveyId: activeSurveyId, type: qt.type })}
                      data-testid={`add-q-${qt.type}`}
                      style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginBottom: 2, color: C.ink2, border: "1px solid transparent", transition: "all .15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.paper2; (e.currentTarget as HTMLElement).style.borderColor = C.line; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}>
                      <div style={{ width: 26, height: 26, borderRadius: 6, background: C.paper2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{qt.icon}</div>
                      {qt.label}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Centre: canvas */}
            <div style={{ background: C.paper2, padding: "24px 28px", overflowY: "auto" }}>
              {/* Survey title card */}
              <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "22px 26px", marginBottom: 18, borderTop: `4px solid ${C.teal}` }}>
                <input value={builderTitle} onChange={e => setBuilderTitle(e.target.value)}
                  style={{ fontSize: 20, fontWeight: 700, border: "none", outline: "none", width: "100%", background: "transparent", color: C.ink }} placeholder="Survey title…" />
                <textarea value={builderDesc} onChange={e => setBuilderDesc(e.target.value)} rows={2}
                  style={{ fontFamily: "inherit", fontSize: 13, border: "none", outline: "none", width: "100%", background: "transparent", color: C.ink3, resize: "none", marginTop: 8, lineHeight: 1.5 }} placeholder="Survey description (optional)…" />
              </div>

              {questions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "52px 32px", color: C.ink4, border: `2px dashed ${C.line2}`, borderRadius: 12, fontSize: 14 }}>
                  ← Click a question type to add it to your survey
                </div>
              ) : (
                questions.map((q, idx) => (
                  <QuestionPreview key={q.id} q={q} idx={idx}
                    selected={selectedQId === q.id}
                    onClick={() => setSelectedQId(q.id)}
                    onDelete={() => deleteQMut.mutate(q.id)}
                    onMoveUp={() => moveQ(questions, idx, -1)}
                    onMoveDown={() => moveQ(questions, idx, 1)}
                    isFirst={idx === 0} isLast={idx === questions.length - 1} />
                ))
              )}
            </div>

            {/* Right: settings */}
            <div style={{ background: "#fff", borderLeft: `1px solid ${C.line}`, padding: "18px 16px", overflowY: "auto" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                {selectedQ ? "Question Settings" : "Survey Settings"}
              </div>
              {selectedQ ? (
                <QuestionSettings key={selectedQ.id} q={selectedQ} onUpdate={data => updateQMut.mutate({ id: selectedQ.id, data })} />
              ) : (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: C.ink4, marginBottom: 10 }}>Display</div>
                  <ToggleRow label="Show progress bar" value={activeSurvey?.showProgress ?? true} onChange={v => activeSurveyId && updateMut.mutate({ id: activeSurveyId, data: { showProgress: v } })} />
                  <ToggleRow label="One question per page" value={activeSurvey?.onePerPage ?? true} onChange={v => activeSurveyId && updateMut.mutate({ id: activeSurveyId, data: { onePerPage: v } })} />
                  <ToggleRow label="Randomise order" value={activeSurvey?.randomizeQuestions ?? false} onChange={v => activeSurveyId && updateMut.mutate({ id: activeSurveyId, data: { randomizeQuestions: v } })} />
                  <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14, marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: C.ink4, marginBottom: 10 }}>Privacy</div>
                    <ToggleRow label="Anonymous responses" value={activeSurvey?.anonymous ?? false} onChange={v => activeSurveyId && updateMut.mutate({ id: activeSurveyId, data: { anonymous: v } })} last />
                  </div>
                  {activeSurvey && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: C.ink4, marginBottom: 8 }}>Share Link</div>
                      <div style={{ fontSize: 12, color: C.ink3, background: C.paper2, padding: "8px 10px", borderRadius: 8, wordBreak: "break-all" }}>
                        {window.location.origin}/survey/{activeSurvey.token}
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/survey/${activeSurvey.token}`); toast({ title: "Link copied ✓" }); }}
                        style={{ ...btnGhost, width: "100%", justifyContent: "center", marginTop: 8 }}>Copy link</button>
                    </div>
                  )}
                  {activeSurvey?.status === "active" && (
                    <button onClick={() => closeMut.mutate(activeSurveyId!)}
                      style={{ ...btnGhost, width: "100%", justifyContent: "center", marginTop: 14, color: C.rose, borderColor: "#f0b8b8" }}>Close survey</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
        {shareModal && <ShareModal survey={shareModal} onClose={() => setShareModal(null)} />}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: RESULTS
  // ════════════════════════════════════════════════════════════════════════════
  if (view === "results" && activeSurvey) {
    const completedResponses = responses.filter(r => r.completedAt);
    const avgTime = completedResponses.length > 0
      ? Math.round(completedResponses.reduce((s, r) => s + (r.timeSeconds || 0), 0) / completedResponses.length) : 0;

    // Timeline data (last 7 days)
    const timelineMap: Record<string, number> = {};
    for (const r of completedResponses) {
      const d = r.completedAt ? new Date(r.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
      if (d) timelineMap[d] = (timelineMap[d] || 0) + 1;
    }
    const timelineData = Object.entries(timelineMap).map(([name, count]) => ({ name, count })).slice(-7);

    const viewingResp = responseModal != null ? completedResponses[responseModal.idx] : null;

    return (
      <div className="h-screen overflow-hidden bg-background flex">
        <Sidebar />
        <main className={cn("transition-all duration-300 h-full overflow-y-auto", mainOffset, mobileTopOffset)}>
          <div style={{ maxWidth: 1020, margin: "0 auto", padding: "0 24px 40px" }}>
            {/* Header */}
            <div style={{ padding: "28px 0 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <button onClick={() => setView("dashboard")} style={{ ...btnGhost, marginBottom: 10 }}>← Back</button>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 4 }}>{activeSurvey.title}</h1>
                <p style={{ color: C.ink3, fontSize: 13, margin: 0 }}>
                  {STATUS_STYLES[activeSurvey.status]?.label} · {activeSurvey.sentAt ? `Sent ${fmtDate(activeSurvey.sentAt.toString())}` : "Draft"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {activeSurvey.status === "draft" && (
                  <button onClick={() => activateMut.mutate(activeSurvey.id)} style={btnPrimary}>Activate →</button>
                )}
                {activeSurvey.status === "active" && (
                  <>
                    <button onClick={() => setShareModal(activeSurvey)} style={btnSecondary}>🔗 Share</button>
                    <button onClick={() => openBuilder(activeSurvey)} style={btnSecondary}>✏ Edit</button>
                    <button onClick={() => closeMut.mutate(activeSurvey.id)} style={{ ...btnGhost, color: C.rose, borderColor: "#f0b8b8" }}>Close</button>
                  </>
                )}
                {responses.length > 0 && (
                  <>
                    <button onClick={() => exportSurveyToCSV({ ...activeSurvey }, responses)}
                      style={btnSecondary} title="Export response data as CSV" data-testid="button-export-csv">
                      ↓ CSV
                    </button>
                    <button onClick={() => exportSurveyToPPT({ ...activeSurvey }, responses)}
                      style={btnSecondary} title="Export results as PowerPoint" data-testid="button-export-ppt">
                      ↓ PPT
                    </button>
                  </>
                )}
                <button onClick={() => duplicateMut.mutate(activeSurvey.id)} style={btnGhost} title="Duplicate this survey" data-testid="button-results-duplicate">
                  ⧉ Duplicate
                </button>
                <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 500, background: STATUS_STYLES[activeSurvey.status]?.bg, color: STATUS_STYLES[activeSurvey.status]?.color }}>
                  {STATUS_STYLES[activeSurvey.status]?.dot && "● "}{STATUS_STYLES[activeSurvey.status]?.label}
                </span>
              </div>
            </div>

            {/* KPI strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
              {[
                { n: completedResponses.length, label: "Responses",       color: C.teal },
                { n: activeSurvey.questions.length, label: "Questions",   color: C.ink },
                { n: completedResponses.length > 0 ? "—" : "—", label: "Invited",       color: C.amber },
                { n: fmtTime(avgTime), label: "Avg time",               color: C.violet },
              ].map(k => (
                <div key={k.label} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.n}</div>
                  <div style={{ fontSize: 12, color: C.ink3, marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {activeSurvey.questions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px", background: "#fff", borderRadius: 12, border: `1px solid ${C.line}`, color: C.ink4 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No questions yet</div>
                <button onClick={() => openBuilder(activeSurvey)} style={btnPrimary}>Open Builder →</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
                {/* Left: question results */}
                <div>
                  {completedResponses.length === 0 ? (
                    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "40px 24px", textAlign: "center", color: C.ink4 }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: C.ink }}>No responses yet</div>
                      <div style={{ fontSize: 13, marginBottom: 16 }}>
                        {activeSurvey.status === "draft" ? "Activate the survey to start collecting responses." : "Share the survey link to start collecting responses."}
                      </div>
                      {activeSurvey.status === "active" && (
                        <button onClick={() => setShareModal(activeSurvey)} style={btnPrimary}>🔗 Share Survey</button>
                      )}
                    </div>
                  ) : (
                    activeSurvey.questions.map((q, idx) => (
                      <QuestionResults key={q.id} q={q} responses={responses} idx={idx} />
                    ))
                  )}
                </div>

                {/* Right sidebar */}
                <div>
                  {timelineData.length > 0 && (
                    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "18px 20px", marginBottom: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: C.ink4, marginBottom: 14 }}>Response Timeline</div>
                      <ResponsiveContainer width="100%" height={140}>
                        <LineChart data={timelineData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                          <Tooltip contentStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="count" stroke={C.teal} strokeWidth={2} dot={{ fill: C.teal, r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: C.ink4, marginBottom: 14 }}>Quick Actions</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <button onClick={() => openBuilder(activeSurvey)} style={{ ...btnSecondary, justifyContent: "flex-start" }}>✏ Edit questions</button>
                      {activeSurvey.status === "active" && (
                        <button onClick={() => setShareModal(activeSurvey)} style={{ ...btnSecondary, justifyContent: "flex-start" }}>🔗 Share survey link</button>
                      )}
                      {activeSurvey.status === "draft" && (
                        <button onClick={() => activateMut.mutate(activeSurvey.id)} style={{ ...btnPrimary, justifyContent: "flex-start" }}>▶ Activate survey</button>
                      )}
                      {activeSurvey.status === "active" && (
                        <button onClick={() => closeMut.mutate(activeSurvey.id)} style={{ ...btnGhost, justifyContent: "flex-start", color: C.rose, borderColor: "#f0b8b8" }}>⬛ Close survey</button>
                      )}
                    </div>
                  </div>

                  {completedResponses.length > 0 && (
                    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "18px 20px", marginTop: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: C.ink4, marginBottom: 14 }}>Individual Responses</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {completedResponses.slice(0, 5).map((r, i) => (
                          <div key={r.id} onClick={() => setResponseModal({ idx: i })}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, cursor: "pointer", border: `1px solid ${C.line}`, background: C.paper }}
                            data-testid={`response-row-${r.id}`}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: MC_BARS[i % MC_BARS.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                              {initials(r.respondentName)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.respondentName || "Anonymous"}</div>
                              <div style={{ fontSize: 11, color: C.ink4 }}>{fmtDate(r.completedAt?.toString())}</div>
                            </div>
                            <span style={{ fontSize: 11, color: C.ink4 }}>→</span>
                          </div>
                        ))}
                      </div>
                      {completedResponses.length > 5 && (
                        <div style={{ fontSize: 12, color: C.ink4, textAlign: "center", marginTop: 10 }}>+ {completedResponses.length - 5} more</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {shareModal && <ShareModal survey={shareModal} onClose={() => setShareModal(null)} />}
          {viewingResp && responseModal && (
            <ResponseModal
              response={viewingResp}
              survey={activeSurvey}
              idx={responseModal.idx}
              total={completedResponses.length}
              onNav={d => setResponseModal({ idx: responseModal.idx + d })}
              onClose={() => setResponseModal(null)}
            />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-background flex">
      <Sidebar />
      <main className={cn("transition-all duration-300 h-full overflow-y-auto flex items-center justify-center", mainOffset, mobileTopOffset)}>
        <div style={{ textAlign: "center", color: C.ink4 }}>Loading…</div>
      </main>
    </div>
  );
}
