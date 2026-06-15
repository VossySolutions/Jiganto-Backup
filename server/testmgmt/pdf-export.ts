import { jsPDF } from "jspdf";

export type SignOffPdfInput = {
  orgName?: string;
  projectName: string;
  entityType: string;
  entityName: string;
  cycleName?: string;
  testPhase?: string;
  signedOffBy: string;
  signedOffAt: string;
  passRateAtSignOff?: number | null;
  notes?: string | null;
  isConditional?: boolean;
  metrics?: {
    total: number;
    executed: number;
    passed: number;
    failed: number;
    blocked: number;
    completionPct: number;
    passRatePct: number;
  };
  signOffs?: Array<{ entityType: string; entityName: string; signedOffBy: string; signedOffAt: string }>;
};

function entityLabel(type: string): string {
  const map: Record<string, string> = {
    test_cycle: "Test Cycle",
    business_area: "Business Area",
    business_process: "Business Process",
    scenario: "Scenario",
  };
  return map[type] ?? type;
}

export function generateSignOffPdf(data: SignOffPdfInput): Buffer {
  const doc = new jsPDF();
  let y = 20;
  const org = data.orgName ?? "Jiganto Test Management";

  doc.setFontSize(18);
  doc.text("Test Sign-Off Certificate", 20, y);
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${org} · Generated ${new Date().toLocaleString()}`, 20, y);
  doc.setTextColor(0);
  y += 14;

  doc.setFontSize(12);
  doc.text("Project", 20, y);
  doc.setFontSize(11);
  doc.text(data.projectName, 70, y);
  y += 8;

  doc.setFontSize(12);
  doc.text("Entity", 20, y);
  doc.setFontSize(11);
  doc.text(`${entityLabel(data.entityType)}: ${data.entityName}`, 70, y);
  y += 8;

  if (data.cycleName) {
    doc.setFontSize(12);
    doc.text("Test Cycle", 20, y);
    doc.setFontSize(11);
    doc.text(`${data.cycleName}${data.testPhase ? ` (${data.testPhase.toUpperCase()})` : ""}`, 70, y);
    y += 8;
  }

  doc.setFontSize(12);
  doc.text("Signed Off By", 20, y);
  doc.setFontSize(11);
  doc.text(String(data.signedOffBy), 70, y);
  y += 8;

  doc.setFontSize(12);
  doc.text("Date", 20, y);
  doc.setFontSize(11);
  doc.text(data.signedOffAt, 70, y);
  y += 12;

  if (data.metrics) {
    doc.setFontSize(13);
    doc.text("Execution Summary", 20, y);
    y += 8;
    doc.setFontSize(10);
    const m = data.metrics;
    const rows = [
      `Total test cases: ${m.total}`,
      `Executed: ${m.executed} (${m.completionPct}%)`,
      `Passed: ${m.passed} · Failed: ${m.failed} · Blocked: ${m.blocked}`,
      `Pass rate: ${m.passRatePct}%`,
    ];
    for (const row of rows) {
      doc.text(row, 24, y);
      y += 6;
    }
    y += 6;
  }

  if (data.passRateAtSignOff != null) {
    doc.setFontSize(10);
    doc.text(`Pass rate at sign-off: ${data.passRateAtSignOff}%`, 20, y);
    y += 10;
  }

  if (data.isConditional) {
    doc.setTextColor(180, 100, 0);
    doc.text("CONDITIONAL SIGN-OFF — outstanding items documented below.", 20, y);
    doc.setTextColor(0);
    y += 10;
  }

  if (data.notes?.trim()) {
    doc.setFontSize(12);
    doc.text("Notes", 20, y);
    y += 7;
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(data.notes.trim(), 170);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 8;
  }

  if (data.signOffs?.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text("Cascade Sign-Off Record", 20, y);
    y += 8;
    doc.setFontSize(9);
    doc.text("Type", 20, y);
    doc.text("Name", 55, y);
    doc.text("By", 120, y);
    doc.text("Date", 150, y);
    y += 5;
    doc.line(20, y, 190, y);
    y += 5;
    for (const s of data.signOffs.slice(0, 25)) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(entityLabel(s.entityType).slice(0, 18), 20, y);
      doc.text(String(s.entityName).slice(0, 35), 55, y);
      doc.text(String(s.signedOffBy).slice(0, 20), 120, y);
      doc.text(String(s.signedOffAt).slice(0, 16), 150, y);
      y += 6;
    }
  }

  y += 10;
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("This document certifies formal test sign-off within the Test Management module.", 20, y);
  doc.text("Retain for audit and compliance purposes.", 20, y + 5);

  return Buffer.from(doc.output("arraybuffer"));
}
