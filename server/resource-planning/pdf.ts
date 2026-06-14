import { jsPDF } from "jspdf";

export function demandSupplyMatrixPdf(title: string, months: string[], rows: Array<{ skill: string; supply: number; cells: string[] }>): Buffer {
  const doc = new jsPDF({ orientation: "landscape" });
  let y = 18;
  doc.setFontSize(14);
  doc.text(title, 14, y);
  y += 10;
  doc.setFontSize(8);

  const colW = Math.min(18, (280 - 60) / Math.max(months.length, 1));
  doc.text("Skill", 14, y);
  doc.text("Supply", 14 + colW * months.length + 4, y);
  let x = 14;
  for (const m of months) {
    doc.text(m.slice(0, 6), x, y);
    x += colW;
  }
  y += 5;
  doc.line(14, y, 280, y);
  y += 6;

  for (const row of rows) {
    if (y > 190) { doc.addPage(); y = 18; }
    doc.text(row.skill.slice(0, 22), 14, y);
    doc.text(String(row.supply), 14 + colW * months.length + 4, y);
    x = 14;
    for (const cell of row.cells) {
      doc.text(String(cell), x, y);
      x += colW;
    }
    y += 6;
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export function recruitmentForecastPdf(
  cards: Array<{ month: string; skill: string; action: string }>,
  timeline: Array<{ role: string; grade: string; headcount: number; start: string; goLive: string; status: string }>,
): Buffer {
  const doc = new jsPDF();
  let y = 18;
  doc.setFontSize(14);
  doc.text("Recruitment Forecast", 14, y);
  y += 12;
  doc.setFontSize(10);
  doc.text("Priority Actions", 14, y);
  y += 8;
  doc.setFontSize(9);

  for (const c of cards) {
    if (y > 260) { doc.addPage(); y = 18; }
    doc.text(`${c.month} — ${c.skill}`, 14, y);
    y += 5;
    doc.text(c.action.slice(0, 90), 18, y);
    y += 8;
  }

  y += 6;
  doc.setFontSize(10);
  doc.text("12-Month Timeline", 14, y);
  y += 8;
  doc.setFontSize(8);
  doc.text("Role", 14, y);
  doc.text("Grade", 70, y);
  doc.text("HC", 100, y);
  doc.text("Start", 115, y);
  doc.text("Go-live", 145, y);
  doc.text("Status", 175, y);
  y += 5;
  doc.line(14, y, 200, y);
  y += 6;

  for (const t of timeline) {
    if (y > 270) { doc.addPage(); y = 18; }
    doc.text(t.role.slice(0, 28), 14, y);
    doc.text(t.grade, 70, y);
    doc.text(String(t.headcount), 100, y);
    doc.text(t.start, 115, y);
    doc.text(t.goLive, 145, y);
    doc.text(t.status, 175, y);
    y += 6;
  }

  return Buffer.from(doc.output("arraybuffer"));
}
