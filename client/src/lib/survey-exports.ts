import * as XLSX from "xlsx";
import { C } from "./survey-constants";

export async function exportSurveyToPPT(survey: { title: string; category?: string | null; questions?: { id: number; type: string; text: string; options?: string[] }[] }, responses: { completedAt?: string | Date | null; answers?: { questionId: number; value: unknown }[] }[]) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const prs = new PptxGenJS();
  prs.layout = "LAYOUT_WIDE";
  const TEAL = "1A6B5A"; const LIGHT = "E4F2EE"; const DARK = "0F3D31";
  const INK = "0F0E0C"; const MID = "5C5952";
  const completed = responses.filter(r => r.completedAt);
  const cover = prs.addSlide();
  cover.background = { color: DARK };
  cover.addText(survey.title, { x: 0.5, y: 2.2, w: 12, h: 1.2, fontSize: 36, bold: true, color: "FFFFFF", align: "center" });
  cover.addText(`${completed.length} responses · ${new Date().toLocaleDateString("en-GB")}`, { x: 0.5, y: 3.6, w: 12, h: 0.5, fontSize: 16, color: "AACCBB", align: "center" });
  for (let qi = 0; qi < (survey.questions || []).length; qi++) {
    const q = survey.questions![qi];
    if (q.type === "section") continue;
    const qSlide = prs.addSlide();
    qSlide.addText(`Q${qi + 1} · ${q.type}`, { x: 0.5, y: 0.25, w: 12, h: 0.35, fontSize: 11, color: MID });
    qSlide.addText(q.text, { x: 0.5, y: 0.65, w: 12, h: 0.9, fontSize: 18, bold: true, color: INK, wrap: true });
    const answers = completed.map(r => r.answers?.find(a => a.questionId === q.id)?.value).filter(v => v != null);
    if (["mc", "cb", "yn", "dd", "likert"].includes(q.type)) {
      const opts = q.type === "yn" ? ["Yes", "No"] : (q.options || []);
      const counts = opts.map(o => ({ label: o, count: answers.filter(a => Array.isArray(a) ? a.includes(o) : a === o).length }));
      const max = Math.max(1, ...counts.map(c => c.count));
      counts.forEach((c, i) => {
        const y = 1.7 + i * 0.55;
        const barW = Math.max(0.1, (c.count / max) * 7);
        qSlide.addShape(prs.ShapeType.rect, { x: 3.5, y: y + 0.05, w: barW, h: 0.38, fill: { color: LIGHT } });
        qSlide.addText(c.label, { x: 0.5, y, w: 2.8, h: 0.45, fontSize: 12, color: INK });
        qSlide.addText(`${c.count}`, { x: 3.5 + barW + 0.1, y, w: 0.8, h: 0.45, fontSize: 12, bold: true, color: TEAL });
      });
    }
  }
  prs.writeFile({ fileName: `${survey.title.replace(/[^a-z0-9]/gi, "_")}_results.pptx` });
}

export function exportSurveyToCSV(survey: { title: string; questions: { id: number; text: string }[] }, responses: { respondentName?: string | null; completedAt?: string | Date | null; timeSeconds?: number | null; answers?: { questionId: number; value: unknown }[] }[]) {
  const headers = ["Respondent", "Completed At", "Time (s)", ...survey.questions.filter(q => (q as { type?: string }).type !== "section").map((q, i) => `Q${i + 1}: ${q.text.replace(/,/g, ";").substring(0, 60)}`)];
  const rows = responses.filter(r => r.completedAt).map(r => {
    const base = [r.respondentName || "Anonymous", r.completedAt ? new Date(r.completedAt).toLocaleDateString("en-GB") : "", r.timeSeconds || ""];
    const vals = survey.questions.filter(q => (q as { type?: string }).type !== "section").map(q => {
      const a = r.answers?.find(ans => ans.questionId === q.id);
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

export function exportSurveyToExcel(survey: { title: string; questions: { id: number; text: string; type?: string }[] }, responses: { respondentName?: string | null; completedAt?: string | Date | null; timeSeconds?: number | null; answers?: { questionId: number; value: unknown }[] }[]) {
  const qs = survey.questions.filter(q => q.type !== "section");
  const headers = ["Respondent", "Completed At", "Time (s)", ...qs.map((q, i) => `Q${i + 1}: ${q.text.substring(0, 80)}`)];
  const rows = responses.filter(r => r.completedAt).map(r => [
    r.respondentName || "Anonymous",
    r.completedAt ? new Date(r.completedAt).toLocaleDateString("en-GB") : "",
    r.timeSeconds || "",
    ...qs.map(q => {
      const a = r.answers?.find(ans => ans.questionId === q.id);
      if (!a) return "";
      const v = a.value;
      return Array.isArray(v) ? v.join("; ") : String(v ?? "");
    }),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Responses");
  XLSX.writeFile(wb, `${survey.title.replace(/[^a-z0-9]/gi, "_")}_results.xlsx`);
}

export function exportPollPng(question: string, options: string[], voteCounts: number[]) {
  const canvas = document.createElement("canvas");
  canvas.width = 600; canvas.height = 80 + options.length * 50;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = C.ink; ctx.font = "bold 16px sans-serif"; ctx.fillText(question, 20, 30);
  const total = voteCounts.reduce((a, b) => a + b, 0) || 1;
  options.forEach((opt, i) => {
    const y = 50 + i * 50;
    const pct = Math.round((voteCounts[i] / total) * 100);
    ctx.fillStyle = C.ink2; ctx.font = "13px sans-serif"; ctx.fillText(opt, 20, y + 15);
    ctx.fillStyle = C.paper2; ctx.fillRect(180, y, 380, 22);
    ctx.fillStyle = C.tealM; ctx.fillRect(180, y, (380 * pct) / 100, 22);
    ctx.fillStyle = C.ink3; ctx.font="12px sans-serif"; ctx.fillText(`${voteCounts[i]} (${pct}%)`, 570, y + 15);
  });
  canvas.toBlob(blob => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "poll_results.png"; a.click();
  });
}
