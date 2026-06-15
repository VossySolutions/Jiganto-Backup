import { jsPDF } from "jspdf";

export function generateHelpDeskReportPdf(
  data: {
    slaPerformance: { total: number; within: number };
    volume: { total: number };
    defectAnalysis: { total: number };
    agentPerformance: { agent: string; resolved: number; avgResolutionHours: number; csatScore: number | null }[];
    timeBilling: { totalHours: number; totalBillable: number };
    clientSummaries: { clientName: string; openTickets: number; slaCompliancePct: number; hoursUsed: number; hoursContracted: number }[];
  },
  periodDays: number,
  orgName = "Help Desk",
): Buffer {
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(16);
  doc.text(`${orgName} — Client Summary Report`, 20, y);
  y += 8;
  doc.setFontSize(10);
  doc.text(`Period: last ${periodDays} days · Generated ${new Date().toLocaleString()}`, 20, y);
  y += 12;

  const slaPct = data.slaPerformance.total > 0
    ? Math.round((data.slaPerformance.within / data.slaPerformance.total) * 100)
    : 100;

  doc.setFontSize(12);
  doc.text("Executive Summary", 20, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`SLA compliance: ${slaPct}% (${data.slaPerformance.within}/${data.slaPerformance.total} resolved within SLA)`, 20, y);
  y += 6;
  doc.text(`Ticket volume: ${data.volume.total}`, 20, y);
  y += 6;
  doc.text(`Defects: ${data.defectAnalysis.total}`, 20, y);
  y += 6;
  doc.text(`Billable time: ${Number(data.timeBilling.totalHours ?? 0).toFixed(1)}h · £${Number(data.timeBilling.totalBillable ?? 0).toFixed(2)}`, 20, y);
  y += 12;

  doc.setFontSize(12);
  doc.text("Client Summary", 20, y);
  y += 7;
  doc.setFontSize(9);
  doc.text("Client", 20, y);
  doc.text("Open", 90, y);
  doc.text("SLA %", 110, y);
  doc.text("Hours Used", 135, y);
  y += 5;
  doc.line(20, y, 190, y);
  y += 5;

  for (const c of data.clientSummaries.slice(0, 15)) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(String(c.clientName).slice(0, 35), 20, y);
    doc.text(String(c.openTickets), 90, y);
    doc.text(`${c.slaCompliancePct}%`, 110, y);
    doc.text(`${c.hoursUsed.toFixed(1)} / ${c.hoursContracted}`, 135, y);
    y += 6;
  }

  y += 8;
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(12);
  doc.text("Agent Performance", 20, y);
  y += 7;
  doc.setFontSize(9);
  for (const a of data.agentPerformance.slice(0, 10)) {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(`${a.agent}: ${a.resolved} resolved, avg ${a.avgResolutionHours}h, CSAT ${a.csatScore ?? "—"}`, 20, y);
    y += 6;
  }

  return Buffer.from(doc.output("arraybuffer"));
}
