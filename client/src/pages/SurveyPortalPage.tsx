import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { SubmitForm } from "@/components/ui/submit-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { SurveyWithDetails, SurveyQuestion } from "@shared/models/surveys";
import { LIKERT_OPTIONS, EMOJI_RATINGS } from "@/lib/survey-constants";
import { SurveyLoadingState, SurveyButtonSpinner } from "@/components/surveys/SurveyLoadingState";
import "@/styles/surveys.css";

const C = {
  teal: "#1A6B5A", tealL: "#E4F2EE", tealM: "#2E8C74",
  amber: "#B85C0A", amberL: "#FDF0E4",
  rose: "#9C2B2B", roseL: "#FAEAEA",
  ink: "#0F0E0C", ink2: "#2E2C28", ink3: "#5C5952", ink4: "#9C9890",
  paper: "#FAFAF7", paper2: "#F2F0EB", line: "#DDD9D0", line2: "#CBC7BC",
};

const TYPE_LABEL: Record<string, string> = {
  mc: "Multiple Choice", yn: "Yes / No", cb: "Checkboxes", dd: "Dropdown",
  sc: "Star Rating", scale: "Scale", nps: "NPS Score", likert: "Likert", text: "Short Text",
  para: "Paragraph", date: "Date", file: "File Upload", matrix: "Matrix", section: "Section",
};

function orderQuestions(questions: SurveyQuestion[], randomize: boolean) {
  const filtered = questions.filter(q => q.type !== "section" && !q.isSection);
  if (!randomize) return filtered;
  const copy = [...filtered];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type AnswerValue = string | string[] | number | null;

export default function SurveyPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [respondentName, setRespondentName] = useState("");
  const [respondentEmail, setRespondentEmail] = useState("");
  const [nameStep, setNameStep] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [startedAt] = useState(Date.now());

  const { data: survey, isLoading, error } = useQuery<SurveyWithDetails>({
    queryKey: ["/api/surveys/by-token", token],
    queryFn: () => fetch(`/api/surveys/by-token/${token}`).then(r => {
      if (!r.ok) throw new Error(r.status === 410 ? "This survey is no longer accepting responses." : "Survey not found.");
      return r.json();
    }),
  });

  const submitMut = useMutation({
    mutationFn: (body: any) =>
      fetch(`/api/surveys/by-token/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => { if (!r.ok) throw new Error("Submission failed"); return r.json(); }),
    onSuccess: () => setSubmitted(true),
  });

  if (isLoading) return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${C.teal} 0%, #0F3D31 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <SurveyLoadingState label="Loading survey…" />
    </div>
  );

  if (error || !survey) return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${C.teal} 0%, #0F3D31 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "40px 36px", maxWidth: 480, textAlign: "center", width: "100%" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontFamily: "serif", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Survey Not Available</h2>
        <p style={{ color: C.ink3, fontSize: 14 }}>{(error as Error)?.message || "This survey is not available."}</p>
      </div>
    </div>
  );

  const questions = orderQuestions(survey.questions ?? [], !!survey.randomizeQuestions);
  const onePerPage = survey.onePerPage !== false;
  const total = questions.length;
  const progress = total > 0 ? ((onePerPage ? currentQ : total) / total) * 100 : 0;

  function setAnswer(qId: number, val: AnswerValue) {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  }

  function handleNext() {
    if (currentQ < total - 1) setCurrentQ(q => q + 1);
    else if (!survey?.anonymous) setNameStep(true);
    else handleSubmit();
  }

  function handleBack() {
    if (nameStep) { setNameStep(false); return; }
    if (currentQ > 0) setCurrentQ(q => q - 1);
  }

  function handleSubmit() {
    const timeSeconds = Math.round((Date.now() - startedAt) / 1000);
    submitMut.mutate({
      respondentName: respondentName || null,
      respondentEmail: respondentEmail || null,
      answers: Object.entries(answers).map(([qId, value]) => ({ questionId: Number(qId), value })),
      timeSeconds,
    });
  }

  // ── Submitted ─────────────────────────────────────────────────────────────
  if (submitted) return (
    <SubmittedView survey={survey} token={token!} />
  );

  // ── Name capture step ──────────────────────────────────────────────────────
  if (nameStep && !survey.anonymous) {
    const inputStyle = { width: "100%", padding: "11px 14px", border: `1.5px solid ${C.line}`, borderRadius: 10, fontFamily: "inherit", fontSize: 14, color: C.ink, outline: "none" };
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${C.teal} 0%, #0F3D31 100%)`, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ background: "#fff", borderRadius: 20, maxWidth: 560, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,.2)", overflow: "hidden" }}>
          <div style={{ padding: "28px 36px", borderBottom: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: C.teal, marginBottom: 8 }}>Almost done</div>
            <h1 style={{ fontFamily: "serif", fontSize: 20, fontWeight: 700, marginBottom: 4, margin: 0 }}>Your details</h1>
          </div>
          <SubmitForm onSubmit={handleSubmit} disabled={submitMut.isPending} style={{ padding: "28px 36px" }}>
            <p style={{ fontSize: 14, color: C.ink3, marginBottom: 20 }}>Optional — your name and email help the survey organiser attribute responses.</p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.ink3, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Your name</label>
              <input value={respondentName} onChange={e => setRespondentName(e.target.value)} style={inputStyle} placeholder="Full name (optional)" data-testid="input-respondent-name" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.ink3, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Email</label>
              <input type="email" value={respondentEmail} onChange={e => setRespondentEmail(e.target.value)} style={inputStyle} placeholder="Email address (optional)" data-testid="input-respondent-email" />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 20, borderTop: `1px solid ${C.line}` }}>
              <button type="button" onClick={handleBack} style={{ padding: "11px 22px", border: `1.5px solid ${C.line}`, borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>← Back</button>
              <button type="submit" disabled={submitMut.isPending}
                style={{ padding: "11px 28px", background: C.teal, color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 15, fontWeight: 600, opacity: submitMut.isPending ? 0.6 : 1 }}
                data-testid="button-submit-survey">
                {submitMut.isPending ? "Submitting…" : "Submit Survey ✓"}
              </button>
            </div>
          </SubmitForm>
        </div>
      </div>
    );
  }

  // ── All questions on one page ─────────────────────────────────────────────
  if (!onePerPage && survey) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${C.teal} 0%, #0F3D31 100%)`, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ background: "#fff", borderRadius: 20, maxWidth: 640, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,.2)", overflow: "hidden" }}>
          <div style={{ padding: "28px 36px", borderBottom: `1px solid ${C.line}` }}>
            <h1 style={{ fontFamily: "serif", fontSize: 22, fontWeight: 700, margin: 0 }}>{survey.title}</h1>
            {survey.description && <p style={{ fontSize: 13, color: C.ink3, marginTop: 8 }}>{survey.description}</p>}
          </div>
          <SubmitForm onSubmit={() => { if (!survey.anonymous) setNameStep(true); else handleSubmit(); }} style={{ padding: "28px 36px" }}>
            {questions.map((q, i) => (
              <div key={q.id} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: i < questions.length - 1 ? `1px solid ${C.line}` : "none" }}>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>{q.text}{q.required && " *"}</div>
                {q.helpText && <div style={{ fontSize: 12, color: C.ink3, marginBottom: 8 }}>{q.helpText}</div>}
                <QuestionInput q={q} token={token!} value={answers[q.id] ?? null} onChange={val => setAnswer(q.id, val)} />
              </div>
            ))}
            {!survey.anonymous && (
              <>
                <input value={respondentName} onChange={e => setRespondentName(e.target.value)} placeholder="Your name (optional)" style={{ width: "100%", padding: "10px", marginBottom: 8, borderRadius: 8, border: `1px solid ${C.line}` }} />
                <input value={respondentEmail} onChange={e => setRespondentEmail(e.target.value)} placeholder="Email (optional)" style={{ width: "100%", padding: "10px", marginBottom: 16, borderRadius: 8, border: `1px solid ${C.line}` }} />
              </>
            )}
            <button type="submit" disabled={submitMut.isPending} style={{ width: "100%", padding: "14px", background: C.teal, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>
              {submitMut.isPending ? "Submitting…" : "Submit Survey ✓"}
            </button>
          </SubmitForm>
        </div>
      </div>
    );
  }

  // ── Question page (one per page) ──────────────────────────────────────────
  const q = questions[currentQ];
  if (!q) return null;
  const currentAnswer = answers[q.id];

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${C.teal} 0%, #0F3D31 100%)`, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ background: "#fff", borderRadius: 20, maxWidth: 580, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,.2)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "28px 36px 24px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: C.teal, marginBottom: 8 }}>
            {survey.title}
          </div>
          <h1 style={{ fontFamily: "serif", fontSize: 20, fontWeight: 700, margin: 0, marginBottom: survey.description ? 6 : 4 }}>{survey.title}</h1>
          {survey.description && <p style={{ fontSize: 13, color: C.ink3, margin: 0 }}>{survey.description}</p>}
        </div>

        {/* Progress bar */}
        {survey.showProgress && (
          <div style={{ height: 4, background: C.paper2 }}>
            <div style={{ height: "100%", background: C.teal, width: `${progress}%`, transition: "width .4s ease" }} />
          </div>
        )}

        {/* Question body */}
        <div style={{ padding: "28px 36px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.teal, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
            Question {currentQ + 1} of {total}
          </div>
          <div style={{ fontFamily: "serif", fontSize: 19, fontWeight: 500, marginBottom: q.helpText ? 6 : 20, lineHeight: 1.5, color: C.ink }}>
            {q.text}
          </div>
          {q.helpText && <div style={{ fontSize: 13, color: C.ink3, marginBottom: 20 }}>{q.helpText}</div>}

          <QuestionInput q={q} token={token!} value={currentAnswer} onChange={val => setAnswer(q.id, val)} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 28, paddingTop: 24, borderTop: `1px solid ${C.line}` }}>
            <button onClick={handleBack} disabled={currentQ === 0}
              style={{ padding: "10px 20px", border: `1.5px solid ${C.line}`, borderRadius: 10, background: "#fff", cursor: currentQ === 0 ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 500, opacity: currentQ === 0 ? 0.4 : 1 }}>
              ← Back
            </button>
            <button onClick={handleNext}
              disabled={!!q.required && (currentAnswer === null || currentAnswer === undefined || currentAnswer === "" || (Array.isArray(currentAnswer) && currentAnswer.length === 0))}
              style={{ padding: "11px 28px", background: C.teal, color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 15, fontWeight: 600 }}
              data-testid="button-next-question">
              {currentQ === total - 1 ? (survey.anonymous ? "Submit Survey ✓" : "Next →") : "Next →"}
            </button>
          </div>
        </div>

        <div style={{ padding: "14px 36px", borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.ink4 }}>{survey.anonymous ? "Anonymous survey" : "Responses are attributed"}</span>
          <span style={{ fontFamily: "serif", fontWeight: 700, color: C.ink3, fontSize: 13 }}>Jiganto Surveys</span>
        </div>
      </div>
    </div>
  );
}

// ─── Question input components ─────────────────────────────────────────────
function QuestionInput({ q, token, value, onChange }: { q: SurveyQuestion; token: string; value: AnswerValue; onChange: (v: AnswerValue) => void }) {
  const opts = (q.options as string[]) || [];

  const optStyle = (selected: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
    border: `1.5px solid ${selected ? C.teal : C.line}`,
    borderRadius: 10, cursor: "pointer", marginBottom: 10, fontSize: 14, fontWeight: 500,
    background: selected ? C.tealL : "#fff", color: selected ? C.teal : C.ink2,
    transition: "all .15s",
  });

  // Multiple choice
  if (q.type === "mc" || q.type === "yn" || q.type === "dd") {
    const choices = q.type === "yn" ? ["Yes", "No"] : opts;
    if (q.type === "dd") {
      return (
        <select value={value as string || ""} onChange={e => onChange(e.target.value)}
          style={{ width: "100%", padding: "11px 14px", border: `1.5px solid ${C.line}`, borderRadius: 10, fontSize: 14, color: C.ink, outline: "none", background: "#fff" }}>
          <option value="">— Select an option —</option>
          {choices.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      );
    }
    return (
      <div>
        {choices.map(c => {
          const sel = value === c;
          return (
            <div key={c} style={optStyle(sel)} onClick={() => onChange(c)} data-testid={`option-${c}`}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${sel ? C.teal : C.line2}`, flexShrink: 0, background: sel ? C.teal : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {sel && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
              </div>
              {c}
            </div>
          );
        })}
      </div>
    );
  }

  // Checkboxes
  if (q.type === "cb") {
    const selected = (Array.isArray(value) ? value : []) as string[];
    return (
      <div>
        {opts.map(c => {
          const sel = selected.includes(c);
          return (
            <div key={c} style={optStyle(sel)}
              onClick={() => onChange(sel ? selected.filter(x => x !== c) : [...selected, c])}
              data-testid={`option-${c}`}>
              <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${sel ? C.teal : C.line2}`, flexShrink: 0, background: sel ? C.teal : "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11 }}>
                {sel && "✓"}
              </div>
              {c}
            </div>
          );
        })}
      </div>
    );
  }

  // Scale
  if (q.type === "scale") {
    const min = q.scaleMin ?? 1, max = q.scaleMax ?? 10;
    return (
      <div>
        <div style={{ display: "flex", gap: 6 }}>
          {Array.from({ length: max - min + 1 }, (_, i) => i + min).map(n => {
            const sel = value === n;
            return (
              <div key={n} onClick={() => onChange(n)}
                style={{ flex: 1, textAlign: "center", padding: "12px 4px", border: `1.5px solid ${sel ? C.teal : C.line}`, borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, background: sel ? C.teal : "#fff", color: sel ? "#fff" : C.ink3, transition: "all .15s" }}
                data-testid={`scale-${n}`}>
                {n}
              </div>
            );
          })}
        </div>
        {(q.scaleMinLabel || q.scaleMaxLabel) && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.ink4, marginTop: 6, padding: "0 4px" }}>
            <span>{q.scaleMinLabel || ""}</span>
            <span>{q.scaleMaxLabel || ""}</span>
          </div>
        )}
      </div>
    );
  }

  // Star rating
  if (q.type === "sc") {
    const max = q.scaleMax ?? 5;
    return (
      <div style={{ display: "flex", gap: 8 }}>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <div key={n} onClick={() => onChange(n)}
            style={{ fontSize: 36, cursor: "pointer", opacity: (value as number) >= n ? 1 : 0.25, transition: "opacity .15s" }}
            data-testid={`star-${n}`}>
            ⭐
          </div>
        ))}
      </div>
    );
  }

  // NPS
  if (q.type === "nps") {
    return (
      <div>
        <div style={{ display: "flex", gap: 5 }}>
          {Array.from({ length: 11 }, (_, i) => i).map(n => {
            const sel = value === n;
            const bg = n <= 6 ? C.roseL : n <= 8 ? C.amberL : C.tealL;
            const col = n <= 6 ? C.rose : n <= 8 ? C.amber : C.teal;
            return (
              <div key={n} onClick={() => onChange(n)}
                style={{ flex: 1, textAlign: "center", padding: "12px 2px", border: `1.5px solid ${sel ? col : bg}`, borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, background: sel ? col : bg, color: sel ? "#fff" : col, transition: "all .15s" }}
                data-testid={`nps-${n}`}>
                {n}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.ink4, marginTop: 6, padding: "0 2px" }}>
          <span>Not likely</span><span>Extremely likely</span>
        </div>
      </div>
    );
  }

  // Likert
  if (q.type === "likert") {
    const cols = (q.matrixCols as string[])?.length ? (q.matrixCols as string[]) : LIKERT_OPTIONS;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {cols.map(c => {
          const sel = value === c;
          return (
            <div key={c} onClick={() => onChange(c)} style={{ flex: "1 1 100px", textAlign: "center", padding: "10px 6px", border: `1.5px solid ${sel ? C.teal : C.line}`, borderRadius: 10, cursor: "pointer", fontSize: 12, background: sel ? C.tealL : "#fff", color: sel ? C.teal : C.ink2 }}>{c}</div>
          );
        })}
      </div>
    );
  }

  // File upload
  if (q.type === "file") {
    return (
      <input type="file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx"
        onChange={async e => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 10 * 1024 * 1024) { alert("Max file size is 10MB"); return; }
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch(`/api/surveys/by-token/${token}/upload`, { method: "POST", body: fd });
          const data = await res.json();
          if (data.url) onChange(data.url);
        }}
        style={{ width: "100%", fontSize: 14 }} />
    );
  }

  // Short text with max length
  if (q.type === "text") {
    const max = q.maxLength ?? 200;
    return (
      <input value={value as string || ""} onChange={e => onChange(e.target.value.slice(0, max))}
        maxLength={max}
        style={{ width: "100%", padding: "11px 14px", border: `1.5px solid ${C.line}`, borderRadius: 10, fontSize: 14, color: C.ink, outline: "none", fontFamily: "inherit" }}
        placeholder="Type your answer here…" data-testid="input-text-answer" />
    );
  }

  // Paragraph with max length
  if (q.type === "para") {
    const max = q.maxLength ?? 2000;
    return (
      <textarea value={value as string || ""} onChange={e => onChange(e.target.value.slice(0, max))} rows={5} maxLength={max}
        style={{ width: "100%", padding: "11px 14px", border: `1.5px solid ${C.line}`, borderRadius: 10, fontSize: 14, color: C.ink, outline: "none", fontFamily: "inherit", resize: "vertical" }}
        placeholder="Type your answer here…" data-testid="input-para-answer" />
    );
  }

  // Star rating with emoji mode
  if (q.type === "sc" && q.ratingDisplay === "emoji") {
    return (
      <div style={{ display: "flex", gap: 12 }}>
        {EMOJI_RATINGS.map((emoji, i) => (
          <div key={i} onClick={() => onChange(i + 1)} style={{ fontSize: 36, cursor: "pointer", opacity: (value as number) >= i + 1 ? 1 : 0.3 }}>{emoji}</div>
        ))}
      </div>
    );
  }

  // Date
  if (q.type === "date") {
    return (
      <input type="date" value={value as string || ""} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", padding: "11px 14px", border: `1.5px solid ${C.line}`, borderRadius: 10, fontSize: 14, color: C.ink, outline: "none" }}
        data-testid="input-date-answer" />
    );
  }

  // Matrix
  if (q.type === "matrix") {
    const rows = (q.matrixRows as string[]) || [];
    const cols = (q.matrixCols as string[]) || [];
    const matrixVal = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, string>;
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ padding: "8px 10px", textAlign: "left", color: C.ink4 }}></th>
              {cols.map(c => <th key={c} style={{ padding: "8px 8px", textAlign: "center", fontSize: 12, fontWeight: 600, color: C.ink3 }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: "10px", fontSize: 13, fontWeight: 500, color: C.ink2 }}>{r}</td>
                {cols.map(c => {
                  const sel = (matrixVal as any)[r] === c;
                  return (
                    <td key={c} style={{ textAlign: "center", padding: 8 }}>
                      <div onClick={() => onChange({ ...matrixVal, [r]: c } as any)}
                        style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${sel ? C.teal : C.line2}`, margin: "0 auto", background: sel ? C.teal : "#fff", cursor: "pointer" }} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <div style={{ color: C.ink4, fontSize: 13 }}>Unsupported question type.</div>;
}

function SubmittedView({ survey, token }: { survey: SurveyWithDetails; token: string }) {
  const showResults = !!survey.showResultsToRespondents;
  const { data: results, isLoading } = useQuery({
    queryKey: ["/api/surveys/by-token", token, "results"],
    queryFn: () => fetch(`/api/surveys/by-token/${token}/results`).then(r => {
      if (!r.ok) throw new Error("Results unavailable");
      return r.json();
    }),
    enabled: showResults,
  });

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${C.teal} 0%, #0F3D31 100%)`, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ background: "#fff", borderRadius: 20, maxWidth: showResults ? 720 : 560, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,.2)", overflow: "hidden" }}>
        <div style={{ padding: "48px 36px", textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>
          <h2 style={{ fontFamily: "serif", fontSize: 26, fontWeight: 700, marginBottom: 10 }}>Thank you!</h2>
          <p style={{ color: C.ink3, fontSize: 14, lineHeight: 1.6 }}>
            {survey.thankYouMessage || "Your response has been recorded. We appreciate your feedback."}
          </p>
        </div>
        {showResults && (
          <div style={{ padding: "0 36px 32px", borderTop: `1px solid ${C.line}` }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "24px 0 16px" }}>Survey results so far</h3>
            {isLoading && <p style={{ color: C.ink3, fontSize: 14 }}>Loading results…</p>}
            {results?.survey?.questions?.filter((q: SurveyQuestion) => q.type !== "section").map((q: SurveyQuestion) => {
              const answers = (results.responses ?? []).flatMap((r: { answers: { questionId: number; value: unknown }[] }) =>
                r.answers.filter((a: { questionId: number }) => a.questionId === q.id).map((a: { value: unknown }) => a.value));
              if (["mc", "dd", "yn", "likert"].includes(q.type)) {
                const opts = q.type === "yn" ? ["Yes", "No"] : (q.type === "likert" ? ((q.matrixCols as string[]) || LIKERT_OPTIONS) : ((q.options as string[]) || []));
                const counts: Record<string, number> = {};
                for (const a of answers) counts[String(a)] = (counts[String(a)] || 0) + 1;
                const total = answers.length || 1;
                return (
                  <div key={q.id} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{q.text}</div>
                    {opts.map(o => {
                      const n = counts[o] || 0;
                      const pct = Math.round((n / total) * 100);
                      return (
                        <div key={o} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <div style={{ width: 120, fontSize: 12, color: C.ink3, flexShrink: 0 }}>{o}</div>
                          <div style={{ flex: 1, height: 22, background: C.paper2, borderRadius: 5, overflow: "hidden" }}>
                            <div style={{ width: `${Math.max(pct, 2)}%`, height: "100%", background: C.teal, borderRadius: 5 }} />
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.ink3, width: 36 }}>{pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                );
              }
              if (q.type === "nps" || q.type === "scale" || q.type === "sc") {
                const nums = answers.map((a: unknown) => Number(a)).filter((n: number) => !isNaN(n));
                const avg = nums.length ? (nums.reduce((s: number, n: number) => s + n, 0) / nums.length).toFixed(1) : "—";
                return (
                  <div key={q.id} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{q.text}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: C.teal, marginTop: 4 }}>{avg} <span style={{ fontSize: 13, fontWeight: 400, color: C.ink3 }}>avg ({nums.length} responses)</span></div>
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}
        <div style={{ padding: "16px 36px 24px", borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.ink4 }}>{survey.anonymous ? "Anonymous survey" : "Survey complete"}</span>
          <span style={{ fontFamily: "serif", fontWeight: 700, color: C.ink3, fontSize: 13 }}>Jiganto Surveys</span>
        </div>
      </div>
    </div>
  );
}
