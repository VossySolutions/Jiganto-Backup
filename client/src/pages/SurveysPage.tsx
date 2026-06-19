import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ModuleShell } from "@/components/ModuleShell";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import type { SurveyWithDetails, SurveyQuestion, SurveyResponseWithAnswers, SurveyTemplate, SurveyLogicRule } from "@shared/models/surveys";
import {
  C, MC_BARS, CB_BARS, QUESTION_TYPES, TYPE_LABEL, STATUS_STYLES, CATEGORY_ICONS, CATEGORIES,
  LIKERT_OPTIONS, EMOJI_RATINGS, fmtDate, fmtTime, initials, wordFrequency,
  type MainTab, type View,
} from "@/lib/survey-constants";
import { exportSurveyToPPT, exportSurveyToCSV, exportSurveyToExcel } from "@/lib/survey-exports";
import { ShareModal } from "@/components/surveys/ShareModal";
import { PollsTab } from "@/components/surveys/PollsTab";
import { TemplatesTab } from "@/components/surveys/TemplatesTab";
import { SurveyLoadingState, SurveyKpiSkeleton, SurveyRowSkeleton, SurveyCardSkeleton, SurveyButtonSpinner } from "@/components/surveys/SurveyLoadingState";
import { asArray, fetchSurveys, fetchSurvey, fetchSurveyResponses, fetchSurveyResultsSummary } from "@/lib/survey-api";
import { SurveyAiTokenBanner } from "@/components/surveys/SurveyAiTokenBanner";
import { RichTextField } from "@/components/surveys/RichTextField";
import { useSurveyAiStatus } from "@/hooks/use-survey-ai-status";
import "@/styles/surveys.css";

// ─── Question preview card ─────────────────────────────────────────────────
function QuestionPreview({ q, idx, selected, onClick, onDelete, onDuplicate, onMoveUp, onMoveDown, isFirst, isLast }: {
  q: SurveyQuestion; idx: number; selected: boolean;
  onClick: () => void; onDelete: () => void; onDuplicate: () => void; onMoveUp: () => void; onMoveDown: () => void;
  isFirst: boolean; isLast: boolean;
}) {
  const opts = (q.options as string[]) || [];
  if (q.type === "section" || q.isSection) {
    return (
      <div onClick={onClick} style={{ background: C.paper2, border: `1.5px solid ${selected ? C.teal : C.line}`, borderRadius: 12, padding: "14px 20px", marginBottom: 10, cursor: "pointer", position: "relative" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.ink4, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Section</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{q.text || "Section header"}</div>
        <div style={{ position: "absolute", right: 12, top: 12, display: "flex", gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); onDuplicate(); }} style={{ width: 26, height: 26, border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12 }} title="Duplicate">⧉</button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ width: 26, height: 26, border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", cursor: "pointer", color: C.rose, fontSize: 12 }} title="Delete">✕</button>
        </div>
      </div>
    );
  }
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
      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12, color: C.ink, lineHeight: 1.4 }}
        dangerouslySetInnerHTML={{ __html: q.text || "Untitled question" }} />

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
      {q.type === "likert" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {((q.matrixCols as string[])?.length ? (q.matrixCols as string[]) : LIKERT_OPTIONS).map(c => (
            <div key={c} style={{ flex: "1 1 80px", textAlign: "center", padding: "6px 4px", border: `1px solid ${C.line2}`, borderRadius: 6, fontSize: 11, color: C.ink3 }}>{c}</div>
          ))}
        </div>
      )}
      {q.type === "file" && (
        <div style={{ padding: "8px 12px", border: `1px dashed ${C.line2}`, borderRadius: 8, fontSize: 13, color: C.ink4 }}>File upload (max 10MB)</div>
      )}

      {/* Actions */}
      <div style={{ position: "absolute", right: 12, top: 12, display: "flex", gap: 4 }}>
        <button onClick={e => { e.stopPropagation(); onDuplicate(); }}
          style={{ width: 26, height: 26, border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12 }} title="Duplicate">⧉</button>
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
function QuestionSettings({ q, allQuestions, onUpdate }: { q: SurveyQuestion; allQuestions: SurveyQuestion[]; onUpdate: (data: Partial<SurveyQuestion>) => void }) {
  const opts = (q.options as string[]) || [];
  const matrixRows = (q.matrixRows as string[]) || ["Row 1", "Row 2"];
  const matrixCols = (q.matrixCols as string[]) || (q.type === "likert" ? LIKERT_OPTIONS : ["Strongly Agree", "Agree", "Disagree", "Strongly Disagree"]);
  const logicRules = (q.logicJson as SurveyLogicRule[]) || [];

  const inputStyle = { width: "100%", padding: "8px 11px", border: `1px solid ${C.line2}`, borderRadius: 7, fontFamily: "inherit", fontSize: 13, color: C.ink, background: "#fff", outline: "none" };
  const labelStyle = { display: "block" as const, fontSize: 11, fontWeight: 600 as const, color: C.ink3, marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: ".05em" };

  return (
    <div style={{ padding: "0 2px" }}>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Question Text</label>
        <RichTextField value={q.text} onChange={text => onUpdate({ text })} rows={3} />
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

      {/* Likert settings */}
      {q.type === "likert" && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...labelStyle, marginBottom: 6 }}>Likert options</div>
          {matrixCols.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input value={c} onChange={e => { const n = [...matrixCols]; n[i] = e.target.value; onUpdate({ matrixCols: n }); }} style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => onUpdate({ matrixCols: matrixCols.filter((_, j) => j !== i) })} style={{ width: 26, height: 26, border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", cursor: "pointer", color: C.rose, fontSize: 13 }}>✕</button>
            </div>
          ))}
          <button onClick={() => onUpdate({ matrixCols: [...matrixCols, `Option ${matrixCols.length + 1}`] })} style={{ width: "100%", padding: "6px", border: `1px dashed ${C.line2}`, borderRadius: 7, background: C.paper2, cursor: "pointer", fontSize: 12, color: C.ink3 }}>+ Option</button>
        </div>
      )}

      {/* Star rating display */}
      {q.type === "sc" && (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Display style</label>
          <select value={q.ratingDisplay ?? "stars"} onChange={e => onUpdate({ ratingDisplay: e.target.value })}
            style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="stars">Stars</option>
            <option value="emoji">Emoji faces</option>
            <option value="numbers">Numbers</option>
          </select>
        </div>
      )}

      {/* Text limits */}
      {(q.type === "text" || q.type === "para") && (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Max characters</label>
          <input type="number" value={q.maxLength ?? (q.type === "text" ? 200 : 2000)}
            onChange={e => onUpdate({ maxLength: Number(e.target.value) })} style={inputStyle} />
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

      {/* Branching logic */}
      {["mc", "dd", "yn"].includes(q.type) && (
        <div style={{ marginBottom: 14, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Skip logic</div>
          {logicRules.map((rule, i) => (
            <div key={i} style={{ marginBottom: 8, padding: 10, background: C.paper2, borderRadius: 8 }}>
              <select value={rule.operator} onChange={e => { const n = [...logicRules]; n[i] = { ...rule, operator: e.target.value as SurveyLogicRule["operator"] }; onUpdate({ logicJson: n }); }}
                style={{ ...inputStyle, marginBottom: 6 }}>
                <option value="equals">If answer equals</option>
                <option value="not_equals">If answer not equals</option>
              </select>
              <input value={String(rule.value ?? "")} placeholder="Answer value"
                onChange={e => { const n = [...logicRules]; n[i] = { ...rule, value: e.target.value }; onUpdate({ logicJson: n }); }}
                style={{ ...inputStyle, marginBottom: 6 }} />
              <select value={rule.skipToQuestionId ?? ""} onChange={e => { const n = [...logicRules]; n[i] = { ...rule, skipToQuestionId: Number(e.target.value) }; onUpdate({ logicJson: n }); }}
                style={inputStyle}>
                <option value="">Skip to…</option>
                {allQuestions.filter(x => x.id !== q.id && x.type !== "section").map((x, xi) => (
                  <option key={x.id} value={x.id}>Q{xi + 1}: {x.text.slice(0, 40)}</option>
                ))}
              </select>
              <button onClick={() => onUpdate({ logicJson: logicRules.filter((_, j) => j !== i) })}
                style={{ marginTop: 6, fontSize: 12, color: C.rose, background: "none", border: "none", cursor: "pointer" }}>Remove rule</button>
            </div>
          ))}
          <button onClick={() => onUpdate({ logicJson: [...logicRules, { questionId: q.id, operator: "equals" as const, value: "", skipToQuestionId: 0 }] })}
            style={{ width: "100%", padding: "6px", border: `1px dashed ${C.line2}`, borderRadius: 7, background: C.paper2, cursor: "pointer", fontSize: 12, color: C.ink3 }}>+ Add skip rule</button>
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
    if (q.type === "yn") {
      const data = opts.map((o, i) => ({ name: o, value: counts[o] || 0, fill: [C.tealM, C.rose][i] }));
      content = (
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <ResponsiveContainer width={160} height={160}>
            <PieChart><Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>{data.map((d, i) => <Cell key={i} fill={d.fill} />)}</Pie><Tooltip /></PieChart>
          </ResponsiveContainer>
          <div>{data.map(s => <ResultBar key={s.name} label={s.name} count={s.value} total={n} color={s.fill} />)}</div>
        </div>
      );
    } else {
      const sorted = opts.map((o, i) => ({ label: o, count: counts[o] || 0, color: MC_BARS[i % MC_BARS.length] }))
        .sort((a, b) => b.count - a.count);
      content = <div>{sorted.map(s => <ResultBar key={s.label} label={s.label} count={s.count} total={n} color={s.color} />)}</div>;
    }
  }

  if (q.type === "likert") {
    const opts = (q.matrixCols as string[])?.length ? (q.matrixCols as string[]) : LIKERT_OPTIONS;
    const counts: Record<string, number> = {};
    for (const a of answers) { const v = String(a.value ?? ""); counts[v] = (counts[v] || 0) + 1; }
    content = <div>{opts.map((o, i) => <ResultBar key={o} label={o} count={counts[o] || 0} total={n} color={MC_BARS[i % MC_BARS.length]} />)}</div>;
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
    const texts = answers.map(a => String(a.value ?? "")).filter(t => t.trim());
    const words = wordFrequency(texts);
    content = (
      <div>
        {words.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, padding: 12, background: C.paper2, borderRadius: 8 }}>
            {words.slice(0, 20).map(w => (
              <span key={w.word} style={{ fontSize: 12 + Math.min(w.count * 2, 12), color: C.teal, fontWeight: 500 }}>{w.word}</span>
            ))}
          </div>
        )}
        {texts.slice(0, 5).map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: MC_BARS[i % MC_BARS.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
            <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.5 }}>{t}</div>
          </div>
        ))}
        {texts.length > 5 && <div style={{ fontSize: 12, color: C.ink4, textAlign: "center", padding: 8 }}>+ {texts.length - 5} more responses</div>}
        {texts.length === 0 && <div style={{ fontSize: 13, color: C.ink4, padding: "12px 0" }}>No text responses yet.</div>}
      </div>
    );
  }

  if (q.type === "file") {
    const files = answers.map(a => String(a.value ?? "")).filter(Boolean);
    content = (
      <div>{files.map((f, i) => (
        <div key={i} style={{ padding: "8px 12px", border: `1px solid ${C.line}`, borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
          📎 <a href={f} target="_blank" rel="noreferrer" style={{ color: C.teal }}>{f.split("/").pop()}</a>
        </div>
      ))}{files.length === 0 && <div style={{ fontSize: 13, color: C.ink4 }}>No files uploaded.</div>}</div>
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

// ─── New Survey Wizard ─────────────────────────────────────────────────────
const WIZARD_CATEGORIES = CATEGORIES;

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
  const [showProgress, setShowProgress] = useState(true);
  const [onePerPage, setOnePerPage] = useState(true);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [showResults, setShowResults] = useState(false);
  // Template path
  const [selectedTpl, setSelectedTpl] = useState<string | null>(null);
  const [previewTpl, setPreviewTpl] = useState<string | null>(null);
  // AI path
  const [aiDesc, setAiDesc] = useState("");
  const [aiCount, setAiCount] = useState(8);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<any[]>([]);
  const [aiError, setAiError] = useState("");
  const { data: aiStatus } = useSurveyAiStatus();
  const aiDisabled = aiStatus?.empty === true;
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
    if (aiDisabled) { setAiError("Your organisation's AI token balance is empty. Contact your administrator to replenish the balance."); return; }
    if (!aiDesc.trim()) { setAiError("Please describe what this survey is about."); return; }
    setAiError(""); setAiGenerating(true); setAiQuestions([]);
    try {
      const res = await apiRequest("POST", "/api/surveys/ai-generate", { description: aiDesc, count: aiCount });
      const data = await res.json();
      if (data.questions?.length) { setAiQuestions(data.questions); }
      else { setAiError("AI did not return any questions. Try a more specific description."); }
    } catch (e: any) { setAiError(e.message || "AI generation failed."); }
    finally { setAiGenerating(false); }
  }, [aiDesc, aiCount, aiDisabled]);

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
    createMut.mutate({
      title, description: desc, category, anonymous, status: "draft",
      closeDate: closeDate ? new Date(closeDate).toISOString() : null,
      showProgress, onePerPage, randomizeQuestions,
      allowMultipleResponses: allowMultiple,
      showResultsToRespondents: showResults,
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
              {aiDisabled && <SurveyAiTokenBanner />}
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
                <button onClick={handleGenerate} disabled={aiGenerating || !aiDesc.trim() || aiDisabled}
                  style={{ padding: "9px 20px", background: C.teal, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, opacity: aiGenerating || !aiDesc.trim() || aiDisabled ? 0.6 : 1, whiteSpace: "nowrap" as const }}
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
                  {WIZARD_CATEGORIES.map(c => <option key={c}>{c}</option>)}
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
                <ToggleRow label="Show progress bar" value={showProgress} onChange={setShowProgress} />
                <ToggleRow label="One question per page" value={onePerPage} onChange={setOnePerPage} last />
              </div>
              <div style={{ background: C.paper2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.ink4, textTransform: "uppercase", marginBottom: 10 }}>Privacy & access</div>
                <ToggleRow label="Anonymous responses" value={anonymous} onChange={setAnonymous} />
                <ToggleRow label="Randomise question order" value={randomizeQuestions} onChange={setRandomizeQuestions} />
                <ToggleRow label="Allow multiple responses" value={allowMultiple} onChange={setAllowMultiple} />
                <ToggleRow label="Show results to respondents" value={showResults} onChange={setShowResults} last />
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
  const { toast } = useToast();
  const qc = useQueryClient();

  const [view, setView] = useState<View>("dashboard");
  const [mainTab, setMainTab] = useState<MainTab>("surveys");
  const [listView, setListView] = useState<"card" | "list">("card");
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [resultsFilter, setResultsFilter] = useState<"all" | "completed" | "partial">("all");
  const [resultsDateFrom, setResultsDateFrom] = useState("");
  const [resultsDateTo, setResultsDateTo] = useState("");
  const [resultsRespondent, setResultsRespondent] = useState("");
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
  const [builderMobilePanel, setBuilderMobilePanel] = useState<"palette" | "canvas" | "settings">("canvas");

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: surveys = [], isLoading, isError, refetch } = useQuery<SurveyWithDetails[]>({
    queryKey: ["/api/surveys"],
    queryFn: fetchSurveys,
  });

  const { data: activeSurvey, isLoading: surveyDetailLoading } = useQuery<SurveyWithDetails>({
    queryKey: ["/api/surveys", activeSurveyId],
    queryFn: () => fetchSurvey(activeSurveyId!),
    enabled: !!activeSurveyId,
  });

  const { data: aiStatus } = useSurveyAiStatus();
  const aiDisabled = aiStatus?.empty === true;

  const { data: resultsSummary } = useQuery({
    queryKey: ["/api/surveys", activeSurveyId, "results-summary"],
    queryFn: () => fetchSurveyResultsSummary(activeSurveyId!),
    enabled: !!activeSurveyId && view === "results",
  });

  const { data: responses = [], isLoading: responsesLoading, isError: responsesError, refetch: refetchResponses } = useQuery<SurveyResponseWithAnswers[]>({
    queryKey: ["/api/surveys", activeSurveyId, "responses"],
    queryFn: () => fetchSurveyResponses(activeSurveyId!),
    enabled: !!activeSurveyId && view === "results",
    initialData: [],
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

  const archiveMut = useMutation({
    mutationFn: ({ id, archive }: { id: number; archive: boolean }) => apiRequest("POST", `/api/surveys/${id}/archive`, { archive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/surveys"] }); toast({ title: "Survey archived" }); },
  });

  const saveTemplateMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/surveys/${id}/save-template`, {}),
    onSuccess: () => { toast({ title: "Saved as template ✓" }); qc.invalidateQueries({ queryKey: ["/api/surveys/templates"] }); },
  });

  const aiAnalyzeMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/surveys/${id}/ai-analyze`),
    onSuccess: async (res) => { const d = await res.json(); setAiAnalysis(d.analysis); },
    onError: async (e: Error) => toast({ title: e.message || "AI analysis failed", variant: "destructive" }),
  });

  const duplicateQMut = useMutation({
    mutationFn: (qid: number) => apiRequest("POST", `/api/surveys/questions/${qid}/duplicate`),
    onSuccess: async (res) => {
      const q = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/surveys", activeSurveyId] });
      setSelectedQId(q.id);
    },
  });

  const fromTemplateMut = useMutation({
    mutationFn: (templateId: number) => apiRequest("POST", `/api/surveys/from-template/${templateId}`, {}),
    onSuccess: async (res) => {
      const survey: SurveyWithDetails = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/surveys"] });
      toast({ title: `"${survey.title}" created from template ✓` });
      openBuilder(survey);
      setMainTab("surveys");
    },
    onError: () => toast({ title: "Failed to create from template", variant: "destructive" }),
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
      const defaults: any = {
        type,
        text: type === "section" ? "New section" : `New ${TYPE_LABEL[type] || type} question`,
        isSection: type === "section",
        options: type === "mc" ? ["Option 1", "Option 2", "Option 3"] : type === "cb" ? ["Option A", "Option B", "Option C"] : type === "dd" ? ["Choice 1", "Choice 2"] : type === "likert" ? LIKERT_OPTIONS : [],
        matrixCols: type === "likert" ? LIKERT_OPTIONS : [],
      };
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

  function onQuestionDragEnd(result: DropResult) {
    if (!result.destination || !activeSurveyId) return;
    const ids = questions.map(q => q.id);
    const [removed] = ids.splice(result.source.index, 1);
    ids.splice(result.destination.index, 0, removed);
    reorderMut.mutate({ surveyId: activeSurveyId, orderedIds: ids });
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
    <ModuleShell className="h-screen overflow-hidden bg-background flex" mainClassName="h-full overflow-y-auto flex-1 w-full min-w-0">
        <div className="survey-page-wrap">
          <SurveyAiTokenBanner />
          {/* Header */}
          <div className="survey-page-header">
            <div>
              <h1 style={{ fontSize: "clamp(22px, 4vw, 26px)", fontWeight: 700, margin: 0, marginBottom: 4 }}>Surveys & Polls</h1>
              <p style={{ color: C.ink3, fontSize: 14, margin: 0 }}>Build, distribute, and analyse surveys across your projects and teams</p>
            </div>
            {mainTab === "surveys" && (
              <button onClick={() => setWizardOpen(true)} style={btnPrimary} data-testid="button-new-survey">+ New Survey</button>
            )}
          </div>

          {isError && (
            <div style={{ background: C.roseL, border: `1px solid ${C.rose}`, borderRadius: 10, padding: 16, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, color: C.rose }}>Failed to load surveys.</span>
              <button onClick={() => refetch()} style={btnSecondary}>Retry</button>
            </div>
          )}

          {/* Sub-navigation (Module 17 spec) */}
          <div className="survey-subnav">
            {([["surveys", "Surveys"], ["polls", "Polls"], ["templates", "Templates"], ["results", "Results"]] as [MainTab, string][]).map(([id, label]) => (
              <button key={id} onClick={() => { setMainTab(id); if (id === "results" && surveys[0]) openResults(surveys[0].id); }}
                className="survey-subnav-btn"
                style={{ borderBottom: `2px solid ${mainTab === id ? C.teal : "transparent"}`, color: mainTab === id ? C.teal : C.ink3 }}>
                {label}
              </button>
            ))}
          </div>

          {fromTemplateMut.isPending && (
            <div style={{ background: C.tealL, borderRadius: 10, padding: 12, marginBottom: 16, display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.teal }}>
              <SurveyButtonSpinner /> Creating survey from template…
            </div>
          )}

          {mainTab === "polls" && <PollsTab />}
          {mainTab === "templates" && (
            <TemplatesTab onUseTemplate={(tpl) => fromTemplateMut.mutate(tpl.id)} usingTemplateId={fromTemplateMut.isPending ? fromTemplateMut.variables : undefined} />
          )}

          {mainTab === "surveys" && (
          <>
          {/* KPI cards */}
          {isLoading ? <SurveyKpiSkeleton /> : (
          <div className="survey-kpi-grid">
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
          )}

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
            <div className="survey-search-bar">
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                style={{ flex: 1, padding: "8px 12px", border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 13, outline: "none" }}
                placeholder="Search surveys…" data-testid="input-search-surveys" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{ width: 150, padding: "8px 12px", border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 13, outline: "none" }}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
              <button onClick={() => setListView(listView === "card" ? "list" : "card")}
                style={{ padding: "8px 12px", border: `1px solid ${C.line2}`, borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 12 }}>
                {listView === "card" ? "☰ List" : "▦ Cards"}
              </button>
              <button onClick={() => setMainTab("templates")} style={{ padding: "8px 12px", border: `1px solid ${C.line2}`, borderRadius: 8, background: C.tealL, color: C.teal, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>📋 Templates</button>
            </div>
          )}

          {/* Survey list */}
          <div className={listView === "card" && dashTab === "history" ? "survey-card-grid" : undefined}>
            {isLoading ? (
              listView === "card" && dashTab === "history" ? <SurveyCardSkeleton count={6} /> : <SurveyRowSkeleton rows={5} />
            ) : (
              (dashTab === "active" ? surveys.filter(s => ["active", "draft"].includes(s.status)).slice(0, 8) : filteredSurveys).map(s => {
                const st = STATUS_STYLES[s.status] || STATUS_STYLES.draft;
                const icon = CATEGORY_ICONS[s.category || ""] || "📋";
                const iconBg = s.status === "active" ? C.tealL : s.status === "closed" ? C.roseL : s.status === "draft" ? C.amberL : C.blueL;
                if (listView === "card" && dashTab === "history") {
                  return (
                    <div key={s.id} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)", cursor: "pointer" }} onClick={() => openResults(s.id)}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: C.ink4, marginBottom: 10 }}>{s.responseCount} responses · {s.questions.length} questions</div>
                      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                  );
                }
                return (
                  <div key={s.id} data-testid={`survey-row-${s.id}`}
                    className="survey-list-row"
                    style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "18px 22px", marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,.06)", transition: "box-shadow .15s" }}>
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
                    <div className="survey-list-row-actions">
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
                      {s.status === "closed" && (
                        <button onClick={() => archiveMut.mutate({ id: s.id, archive: true })} style={btnGhost}>Archive</button>
                      )}
                      <button onClick={() => saveTemplateMut.mutate(s.id)} style={btnGhost} title="Save as template">Save tpl</button>
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
          </>
          )}

          {mainTab === "results" && (
            <div>
              <p style={{ fontSize: 13, color: C.ink3, marginBottom: 16 }}>Select a survey to view results.</p>
              {surveys.filter(s => s.responseCount > 0).map(s => (
                <div key={s.id} onClick={() => openResults(s.id)}
                  style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between" }}>
                  <div><div style={{ fontWeight: 600 }}>{s.title}</div><div style={{ fontSize: 12, color: C.ink4 }}>{s.responseCount} responses</div></div>
                  <span style={{ color: C.teal, fontWeight: 600 }}>View →</span>
                </div>
              ))}
              {surveys.filter(s => s.responseCount > 0).length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: C.ink4 }}>No surveys with responses yet</div>
              )}
            </div>
          )}
        </div>

        {wizardOpen && <NewSurveyWizard onClose={() => setWizardOpen(false)} onCreated={id => { setWizardOpen(false); setActiveSurveyId(id); openBuilder(surveys.find(s => s.id === id) || { id, title: "", questions: [], responseCount: 0 } as any); }} />}
        {shareModal && <ShareModal survey={shareModal} onClose={() => setShareModal(null)} />}
    </ModuleShell>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: BUILDER
  // ════════════════════════════════════════════════════════════════════════════
  if (view === "builder") {
    const groups = ["Choice", "Rating", "Open-ended", "Other"];
    const panelClass = (panel: typeof builderMobilePanel) =>
      cn("survey-builder-panel", panel === builderMobilePanel ? "survey-builder-panel--active-mobile" : "survey-builder-panel--hidden-mobile");
    return (
      <>
      <ModuleShell className="h-screen overflow-hidden bg-background flex" mainClassName="h-full overflow-hidden flex flex-col">
          {/* Top bar */}
          <div className="survey-builder-topbar" style={{ background: "#fff", borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <button onClick={() => setView("dashboard")} style={btnGhost}>← Back</button>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.ink2, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{builderTitle || "Untitled Survey"}</span>
            </div>
            <div className="survey-builder-actions">
              {autoSaveStatus === "saving" && <span style={{ fontSize: 12, color: C.ink4, display: "flex", alignItems: "center", gap: 4 }}><SurveyButtonSpinner /> Saving…</span>}
              {autoSaveStatus === "saved" && <span style={{ fontSize: 12, color: C.teal, fontWeight: 500 }}>✓ Saved</span>}
              <button onClick={saveBuilderMeta} disabled={updateMut.isPending} style={btnSecondary} data-testid="button-builder-save">
                {updateMut.isPending ? <SurveyButtonSpinner /> : null} Save
              </button>
              {activeSurvey && <button onClick={() => setShareModal(activeSurvey)} style={btnSecondary}>🔗 Share</button>}
              {activeSurvey?.status === "draft" && (
                <button onClick={() => activateMut.mutate(activeSurveyId!)} disabled={activateMut.isPending} style={btnPrimary}>
                  {activateMut.isPending ? <SurveyButtonSpinner /> : null} Activate →
                </button>
              )}
              {activeSurvey?.status === "active" && (
                <button onClick={() => openResults(activeSurveyId!)} style={btnPrimary}>Results →</button>
              )}
            </div>
          </div>

          <div className="survey-builder-mobile-tabs">
            {([["palette", "Add"], ["canvas", "Build"], ["settings", "Settings"]] as const).map(([id, label]) => (
              <button key={id} type="button" className="survey-builder-mobile-tab"
                style={{ color: builderMobilePanel === id ? C.teal : C.ink3, borderBottomColor: builderMobilePanel === id ? C.teal : "transparent" }}
                onClick={() => setBuilderMobilePanel(id)}>{label}</button>
            ))}
          </div>

          {surveyDetailLoading ? (
            <SurveyLoadingState label="Loading survey builder…" />
          ) : (
          <div className="survey-builder-layout">
            {/* Left: question types */}
            <div className={cn(panelClass("palette"), "survey-builder-panel--left")}>
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
            <div className={cn(panelClass("canvas"), "survey-builder-panel--center")}>
              {/* Survey title card */}
              <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "22px 26px", marginBottom: 18, borderTop: `4px solid ${C.teal}` }}>
                <input value={builderTitle} onChange={e => setBuilderTitle(e.target.value)}
                  style={{ fontSize: 20, fontWeight: 700, border: "none", outline: "none", width: "100%", background: "transparent", color: C.ink }} placeholder="Survey title…" />
                <textarea value={builderDesc} onChange={e => setBuilderDesc(e.target.value)} rows={2}
                  style={{ fontFamily: "inherit", fontSize: 13, border: "none", outline: "none", width: "100%", background: "transparent", color: C.ink3, resize: "none", marginTop: 8, lineHeight: 1.5 }} placeholder="Survey description (optional)…" />
              </div>

              {addQMut.isPending && (
                <div style={{ textAlign: "center", padding: 8, fontSize: 12, color: C.teal, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <SurveyButtonSpinner /> Adding question…
                </div>
              )}
              {questions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "52px 32px", color: C.ink4, border: `2px dashed ${C.line2}`, borderRadius: 12, fontSize: 14 }}>
                  ← Click a question type to add it to your survey
                </div>
              ) : (
                <DragDropContext onDragEnd={onQuestionDragEnd}>
                  <Droppable droppableId="survey-questions">
                    {provided => (
                      <div ref={provided.innerRef} {...provided.droppableProps}>
                        {questions.map((q, idx) => (
                          <Draggable key={q.id} draggableId={String(q.id)} index={idx}>
                            {dragProvided => (
                              <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                                <div {...dragProvided.dragHandleProps} style={{ cursor: "grab", fontSize: 11, color: C.ink4, marginBottom: 4, paddingLeft: 4 }}>⋮⋮ Drag to reorder</div>
                                <QuestionPreview q={q} idx={idx}
                                  selected={selectedQId === q.id}
                                  onClick={() => setSelectedQId(q.id)}
                                  onDelete={() => deleteQMut.mutate(q.id)}
                                  onDuplicate={() => duplicateQMut.mutate(q.id)}
                                  onMoveUp={() => moveQ(questions, idx, -1)}
                                  onMoveDown={() => moveQ(questions, idx, 1)}
                                  isFirst={idx === 0} isLast={idx === questions.length - 1} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>

            {/* Right: settings */}
            <div className={cn(panelClass("settings"), "survey-builder-panel--right")}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                {selectedQ ? "Question Settings" : "Survey Settings"}
              </div>
              {selectedQ ? (
                <QuestionSettings key={selectedQ.id} q={selectedQ} allQuestions={questions} onUpdate={data => updateQMut.mutate({ id: selectedQ.id, data })} />
              ) : (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: C.ink4, marginBottom: 10 }}>Display</div>
                  <ToggleRow label="Show progress bar" value={activeSurvey?.showProgress ?? true} onChange={v => activeSurveyId && updateMut.mutate({ id: activeSurveyId, data: { showProgress: v } })} />
                  <ToggleRow label="One question per page" value={activeSurvey?.onePerPage ?? true} onChange={v => activeSurveyId && updateMut.mutate({ id: activeSurveyId, data: { onePerPage: v } })} />
                  <ToggleRow label="Randomise order" value={activeSurvey?.randomizeQuestions ?? false} onChange={v => activeSurveyId && updateMut.mutate({ id: activeSurveyId, data: { randomizeQuestions: v } })} />
                  <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14, marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: C.ink4, marginBottom: 10 }}>Privacy & responses</div>
                    <ToggleRow label="Anonymous responses" value={activeSurvey?.anonymous ?? false} onChange={v => activeSurveyId && updateMut.mutate({ id: activeSurveyId, data: { anonymous: v } })} />
                    <ToggleRow label="Allow multiple responses" value={activeSurvey?.allowMultipleResponses ?? false} onChange={v => activeSurveyId && updateMut.mutate({ id: activeSurveyId, data: { allowMultipleResponses: v } })} />
                    <ToggleRow label="Show results to respondents" value={activeSurvey?.showResultsToRespondents ?? false} onChange={v => activeSurveyId && updateMut.mutate({ id: activeSurveyId, data: { showResultsToRespondents: v } })} last />
                  </div>
                  <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14, marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: C.ink4, marginBottom: 10 }}>Schedule</div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.ink3, marginBottom: 5, textTransform: "uppercase" }}>Close date</label>
                    <input type="datetime-local"
                      value={activeSurvey?.closeDate ? new Date(activeSurvey.closeDate).toISOString().slice(0, 16) : ""}
                      onChange={e => activeSurveyId && updateMut.mutate({ id: activeSurveyId, data: { closeDate: e.target.value ? new Date(e.target.value).toISOString() : null } })}
                      style={{ width: "100%", padding: "8px 11px", border: `1px solid ${C.line2}`, borderRadius: 7, fontFamily: "inherit", fontSize: 13, marginBottom: 8 }} />
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
          )}
    </ModuleShell>
        {shareModal && <ShareModal survey={shareModal} onClose={() => setShareModal(null)} />}
      </>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: RESULTS (loading)
  // ════════════════════════════════════════════════════════════════════════════
  if (view === "results" && (!activeSurvey || surveyDetailLoading || responsesLoading)) {
    const loadingLabel = !activeSurvey || surveyDetailLoading ? "Loading survey…" : "Loading responses…";
    return (
      <ModuleShell className="h-screen overflow-hidden bg-background flex" mainClassName="survey-page-loading-main h-full overflow-hidden">
          <SurveyLoadingState label={loadingLabel} size="lg" />
      </ModuleShell>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: RESULTS
  // ════════════════════════════════════════════════════════════════════════════
  if (view === "results" && activeSurvey) {
    const safeResponses = asArray<SurveyResponseWithAnswers>(responses);
    const filteredResponses = safeResponses.filter(r => {
      if (resultsFilter === "completed" && !r.completedAt) return false;
      if (resultsFilter === "partial" && (r.completedAt || !r.startedAt)) return false;
      if (resultsDateFrom && r.completedAt && new Date(r.completedAt) < new Date(resultsDateFrom)) return false;
      if (resultsDateTo && r.completedAt) {
        const to = new Date(resultsDateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(r.completedAt) > to) return false;
      }
      if (resultsRespondent.trim()) {
        const q = resultsRespondent.toLowerCase();
        const name = (r.respondentName || r.respondentEmail || "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
    const completedResponses = filteredResponses.filter(r => r.completedAt);
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
      <ModuleShell className="h-screen overflow-hidden bg-background flex" mainClassName="h-full overflow-y-auto flex-1 w-full min-w-0">
          <div className="survey-page-wrap survey-results-page">
            <SurveyAiTokenBanner />
            {/* Header */}
            <div className="survey-results-header">
              <div className="survey-results-header-main">
                <button onClick={() => setView("dashboard")} style={btnGhost} className="survey-results-back">← Back</button>
                <div>
                  <div className="survey-results-title-row">
                    <h1 className="survey-results-title">{activeSurvey.title}</h1>
                    <span className="survey-results-status-badge" style={{ background: STATUS_STYLES[activeSurvey.status]?.bg, color: STATUS_STYLES[activeSurvey.status]?.color }}>
                      {STATUS_STYLES[activeSurvey.status]?.dot && "● "}{STATUS_STYLES[activeSurvey.status]?.label}
                    </span>
                  </div>
                  <p className="survey-results-subtitle">
                    {activeSurvey.questions.length} question{activeSurvey.questions.length !== 1 ? "s" : ""}
                    {activeSurvey.sentAt ? ` · Sent ${fmtDate(activeSurvey.sentAt.toString())}` : activeSurvey.status === "draft" ? " · Not yet published" : ""}
                  </p>
                </div>
              </div>
              <div className="survey-results-actions">
                {activeSurvey.status === "draft" && (
                  <button onClick={() => activateMut.mutate(activeSurvey.id)} disabled={activateMut.isPending} style={btnPrimary}>
                    {activateMut.isPending ? <SurveyButtonSpinner /> : null} Activate survey
                  </button>
                )}
                {activeSurvey.status === "active" && (
                  <>
                    <button onClick={() => setShareModal(activeSurvey)} style={btnSecondary}>🔗 Share</button>
                    <button onClick={() => openBuilder(activeSurvey)} style={btnSecondary}>✏ Edit</button>
                    <button onClick={() => closeMut.mutate(activeSurvey.id)} style={{ ...btnGhost, color: C.rose, borderColor: "#f0b8b8" }}>Close</button>
                  </>
                )}
                {safeResponses.length > 0 && (
                  <>
                    <button onClick={() => exportSurveyToCSV({ ...activeSurvey }, safeResponses)}
                      style={btnSecondary} title="Export CSV" data-testid="button-export-csv">↓ CSV</button>
                    <button onClick={() => exportSurveyToExcel({ ...activeSurvey }, safeResponses)}
                      style={btnSecondary} title="Export Excel">↓ Excel</button>
                    <button onClick={() => exportSurveyToPPT({ title: activeSurvey.title, category: activeSurvey.category, questions: activeSurvey.questions as { id: number; type: string; text: string; options?: string[] }[] }, safeResponses)}
                      style={btnSecondary} title="Export PowerPoint" data-testid="button-export-ppt">↓ PPT</button>
                    {completedResponses.length >= 10 && (
                      <button onClick={() => aiAnalyzeMut.mutate(activeSurvey.id)} disabled={aiAnalyzeMut.isPending || aiDisabled}
                        style={{ ...btnSecondary, opacity: aiDisabled ? 0.5 : 1 }} title={aiDisabled ? "AI tokens depleted" : undefined}>✨ Analyse</button>
                    )}
                  </>
                )}
                <button onClick={() => duplicateMut.mutate(activeSurvey.id)} style={btnGhost} title="Duplicate this survey" data-testid="button-results-duplicate">
                  ⧉ Duplicate
                </button>
              </div>
            </div>

            {responsesError && (
              <div style={{ background: C.roseL, borderRadius: 10, padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: C.rose }}>Failed to load responses.</span>
                <button onClick={() => refetchResponses()} style={{ padding: "6px 12px", border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", cursor: "pointer" }}>Retry</button>
              </div>
            )}

            {/* Results filters (Module 17 §4) */}
            {safeResponses.length > 0 && (
              <div className="survey-results-filters" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "flex-end" }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: C.ink4, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Status</label>
                  <select value={resultsFilter} onChange={e => setResultsFilter(e.target.value as typeof resultsFilter)}
                    style={{ padding: "8px 10px", border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 13 }}>
                    <option value="all">All responses</option>
                    <option value="completed">Completed</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: C.ink4, textTransform: "uppercase", display: "block", marginBottom: 4 }}>From</label>
                  <input type="date" value={resultsDateFrom} onChange={e => setResultsDateFrom(e.target.value)}
                    style={{ padding: "8px 10px", border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: C.ink4, textTransform: "uppercase", display: "block", marginBottom: 4 }}>To</label>
                  <input type="date" value={resultsDateTo} onChange={e => setResultsDateTo(e.target.value)}
                    style={{ padding: "8px 10px", border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 13 }} />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: C.ink4, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Respondent</label>
                  <input value={resultsRespondent} onChange={e => setResultsRespondent(e.target.value)} placeholder="Search by name or email…"
                    style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
                </div>
              </div>
            )}

            {resultsSummary && (resultsSummary.invited > 0 || (resultsSummary.invitees?.length ?? 0) > 0) && (
              <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 20px", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: C.ink4, marginBottom: 12 }}>Completion breakdown</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                  {[
                    { n: resultsSummary.completed, label: "Completed", color: C.teal },
                    { n: resultsSummary.partial, label: "Partial", color: C.amber },
                    { n: resultsSummary.notStarted, label: "Not started", color: C.ink4 },
                  ].map(x => (
                    <div key={x.label}><span style={{ fontWeight: 700, color: x.color, fontSize: 20 }}>{x.n}</span> <span style={{ fontSize: 12, color: C.ink3 }}>{x.label}</span></div>
                  ))}
                </div>
                {(resultsSummary.invitees?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 120, overflowY: "auto" }}>
                    {resultsSummary.invitees!.slice(0, 20).map(inv => (
                      <div key={inv.userId} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: `1px solid ${C.line}` }}>
                        <span style={{ color: C.ink2 }}>{inv.userId.slice(0, 8)}…</span>
                        <span style={{ color: inv.status === "completed" ? C.teal : inv.status === "partial" ? C.amber : C.ink4, fontWeight: 600, textTransform: "capitalize" }}>{inv.status.replace("_", " ")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* KPI strip */}
            <div className="survey-kpi-grid">
              {[
                { n: completedResponses.length, label: "Responses", color: C.teal },
                { n: activeSurvey.invitedCount ? `${completedResponses.length} / ${activeSurvey.invitedCount}` : completedResponses.length, label: "Invited vs replied", color: C.amber },
                { n: activeSurvey.invitedCount ? `${Math.round((completedResponses.length / activeSurvey.invitedCount) * 100)}%` : "—", label: "Completion rate", color: C.violet },
                { n: fmtTime(avgTime), label: "Avg time", color: C.ink },
              ].map(k => (
                <div key={k.label} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.n}</div>
                  <div style={{ fontSize: 12, color: C.ink3, marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>

            <>
            {aiAnalysis && (
              <div style={{ background: C.tealL, border: `1px solid ${C.teal}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: C.teal }}>✨ AI Analysis {aiAnalyzeMut.isPending && <SurveyButtonSpinner />}</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: C.ink2, whiteSpace: "pre-wrap" }}>{aiAnalysis}</div>
              </div>
            )}

            {activeSurvey.questions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px", background: "#fff", borderRadius: 12, border: `1px solid ${C.line}`, color: C.ink4 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No questions yet</div>
                <button onClick={() => openBuilder(activeSurvey)} style={btnPrimary}>Open Builder →</button>
              </div>
            ) : (
              <div className={cn("survey-results-grid", completedResponses.length === 0 && "survey-results-grid--empty")}>
                {/* Main content */}
                <div className="survey-results-main">
                  {completedResponses.length === 0 ? (
                    <div className="survey-results-empty-card">
                      <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                      <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: C.ink }}>No responses yet</div>
                      <div style={{ fontSize: 14, marginBottom: 20, color: C.ink3, lineHeight: 1.5 }}>
                        {activeSurvey.status === "draft"
                          ? "Activate the survey to start collecting responses from your team or stakeholders."
                          : "Share the survey link to start collecting responses."}
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                        {activeSurvey.status === "draft" ? (
                          <button onClick={() => activateMut.mutate(activeSurvey.id)} disabled={activateMut.isPending} style={btnPrimary}>
                            {activateMut.isPending ? <SurveyButtonSpinner /> : null} Activate survey
                          </button>
                        ) : (
                          <button onClick={() => setShareModal(activeSurvey)} style={btnPrimary}>🔗 Share survey</button>
                        )}
                        <button onClick={() => openBuilder(activeSurvey)} style={btnSecondary}>✏ Edit questions</button>
                      </div>
                    </div>
                  ) : (
                    activeSurvey.questions.map((q, idx) => (
                      <QuestionResults key={q.id} q={q} responses={filteredResponses} idx={idx} />
                    ))
                  )}
                </div>

                {/* Sidebar — only when there's content or actions beyond empty state */}
                {(completedResponses.length > 0 || timelineData.length > 0) && (
                <div className="survey-results-sidebar">
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
                )}
              </div>
            )}
            </>
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
    </ModuleShell>
    );
  }

  return (
    <ModuleShell className="h-screen overflow-hidden bg-background flex" mainClassName="survey-page-loading-main h-full overflow-hidden">
        <SurveyLoadingState label="Loading survey…" size="lg" />
    </ModuleShell>
  );
}
