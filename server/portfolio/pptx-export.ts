type ReportInput = {
  executiveSummary: {
    projectName: string;
    client: string | null;
    pm: string | null;
    overallRag: string | null;
    startDate: string | null;
    plannedEnd: string | null;
  };
  healthDashboard: Record<string, string> | null;
  level1Plan: { name: string; rag: string | null; progress: number; plannedStart: string | null; plannedEnd: string | null }[];
  milestones: { name: string; targetDate: string | null; rag: string | null; status: string | null }[];
  raidSummary: {
    topRisks: { ref: string | null; description: string; severity: string | null }[];
    topIssues: { ref: string | null; description: string; priority: string | null }[];
  };
  financialSummary: { budget: number; spent: number; remaining: number };
  resourceSummary: { name: string; role: string | null; allocation: number }[];
  nextPhasePreview: string;
  narrative: string;
};

const TEAL = "1A6B5A";
const INK = "0F0E0C";
const MID = "5C5952";
const LIGHT = "E4F2EE";

function ragColor(rag: string | null | undefined): string {
  const s = (rag || "green").toLowerCase();
  if (s === "red") return "EF4444";
  if (s === "amber") return "F59E0B";
  return "22C55E";
}

export async function build360ReportPptx(input: ReportInput): Promise<Buffer> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const prs = new PptxGenJS();
  prs.layout = "LAYOUT_WIDE";
  prs.title = `360 Report — ${input.executiveSummary.projectName}`;

  const cover = prs.addSlide();
  cover.background = { color: TEAL };
  cover.addText("360° Project Report", { x: 0.5, y: 1.8, w: 12, h: 0.6, fontSize: 16, color: "FFFFFF", align: "center" });
  cover.addText(input.executiveSummary.projectName, { x: 0.5, y: 2.4, w: 12, h: 1, fontSize: 32, bold: true, color: "FFFFFF", align: "center" });
  cover.addText(`${input.executiveSummary.client || "—"} · PM: ${input.executiveSummary.pm || "—"}`, { x: 0.5, y: 3.5, w: 12, h: 0.4, fontSize: 14, color: "DDEEEA", align: "center" });
  cover.addText(`RAG: ${input.executiveSummary.overallRag || "—"}`, { x: 0.5, y: 4, w: 12, h: 0.4, fontSize: 12, color: "BBDDCC", align: "center" });

  const exec = prs.addSlide();
  exec.addText("1. Executive Summary", { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 20, bold: true, color: INK });
  exec.addText(input.narrative, { x: 0.5, y: 1, w: 12, h: 2.5, fontSize: 12, color: INK, wrap: true });
  exec.addText(`Start: ${input.executiveSummary.startDate || "—"}  |  Planned end: ${input.executiveSummary.plannedEnd || "—"}`, {
    x: 0.5, y: 3.8, w: 12, h: 0.4, fontSize: 11, color: MID,
  });

  if (input.healthDashboard) {
    const health = prs.addSlide();
    health.addText("2. Health Dashboard", { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 20, bold: true, color: INK });
    const dims = ["overall", "schedule", "budget", "quality", "delivery", "risk", "resources", "stakeholders"] as const;
    dims.forEach((d, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 0.5 + col * 3.1;
      const y = 1.2 + row * 1.5;
      const level = (input.healthDashboard as Record<string, string>)[d];
      health.addShape(prs.ShapeType.rect, { x, y, w: 2.8, h: 1.2, fill: { color: LIGHT }, line: { color: "B0D9CE", width: 0.5 } });
      health.addText(d.charAt(0).toUpperCase() + d.slice(1), { x, y: y + 0.1, w: 2.8, h: 0.35, fontSize: 10, color: MID, align: "center" });
      health.addText(level || "—", { x, y: y + 0.5, w: 2.8, h: 0.5, fontSize: 18, bold: true, color: ragColor(level), align: "center" });
    });
  }

  if (input.level1Plan.length) {
    const plan = prs.addSlide();
    plan.addText("3. Level 1 Plan", { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 20, bold: true, color: INK });
    const header = [["Phase", "RAG", "Progress", "Start", "End"]];
    const body = input.level1Plan.map((p) => [p.name, p.rag || "—", `${p.progress}%`, p.plannedStart || "—", p.plannedEnd || "—"]);
    // pptxgenjs accepts string[][] at runtime; types expect TableCell objects
    plan.addTable([...header, ...body] as never, { x: 0.5, y: 1, w: 12, fontSize: 10, border: { pt: 0.5, color: "CCCCCC" } });
  }

  if (input.milestones.length) {
    const ms = prs.addSlide();
    ms.addText("4. Milestones", { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 20, bold: true, color: INK });
    const rows = input.milestones.slice(0, 12).map((m) => [m.name, m.targetDate || "—", m.rag || "—", m.status || "—"]);
    ms.addTable([["Milestone", "Target", "RAG", "Status"], ...rows] as never, { x: 0.5, y: 1, w: 12, fontSize: 10 });
  }

  const raid = prs.addSlide();
  raid.addText("5. RAID Summary", { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 20, bold: true, color: INK });
  let y = 1;
  raid.addText("Top Risks", { x: 0.5, y, w: 12, h: 0.35, fontSize: 12, bold: true, color: INK });
  y += 0.4;
  input.raidSummary.topRisks.forEach((r) => {
    raid.addText(`• ${r.ref || ""} ${r.description} (${r.severity})`, { x: 0.7, y, w: 12, h: 0.3, fontSize: 10, color: MID });
    y += 0.35;
  });
  y += 0.2;
  raid.addText("Top Issues", { x: 0.5, y, w: 12, h: 0.35, fontSize: 12, bold: true, color: INK });
  y += 0.4;
  input.raidSummary.topIssues.forEach((i) => {
    raid.addText(`• ${i.ref || ""} ${i.description} (${i.priority})`, { x: 0.7, y, w: 12, h: 0.3, fontSize: 10, color: MID });
    y += 0.35;
  });

  const fin = prs.addSlide();
  fin.addText("6–10. Finance, Resources & Next Phase", { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 20, bold: true, color: INK });
  fin.addText(
    `Budget: £${input.financialSummary.budget.toLocaleString()}  |  Spent: £${input.financialSummary.spent.toLocaleString()}  |  Remaining: £${input.financialSummary.remaining.toLocaleString()}`,
    { x: 0.5, y: 1, w: 12, h: 0.4, fontSize: 12, color: INK },
  );
  fin.addText(`Next phase: ${input.nextPhasePreview}`, { x: 0.5, y: 1.6, w: 12, h: 0.4, fontSize: 12, color: INK });
  fin.addText("Key resources:", { x: 0.5, y: 2.2, w: 12, h: 0.35, fontSize: 12, bold: true, color: INK });
  input.resourceSummary.slice(0, 6).forEach((r, i) => {
    fin.addText(`• ${r.name} — ${r.role} (${r.allocation}%)`, { x: 0.7, y: 2.6 + i * 0.35, w: 12, h: 0.3, fontSize: 10, color: MID });
  });

  const out = await prs.write({ outputType: "nodebuffer" });
  return out as Buffer;
}

type HealthDims = {
  overall?: string | null;
  schedule?: string | null;
  budget?: string | null;
  quality?: string | null;
  delivery?: string | null;
  risk?: string | null;
  resources?: string | null;
  stakeholders?: string | null;
};

export function map360ReportToPptxInput(report: unknown, narrative?: string): ReportInput {
  const r = report as {
    executiveSummary: {
      projectName: string;
      client: string | null;
      pm: string | null;
      overallRag: string | null;
      narrative: string;
      startDate: string | null;
      plannedEnd: string | null;
    };
    healthDashboard: HealthDims | null;
    level1Plan: ReportInput["level1Plan"];
    milestones: ReportInput["milestones"];
    raidSummary: ReportInput["raidSummary"];
    financialSummary: ReportInput["financialSummary"];
    resourceSummary: ReportInput["resourceSummary"];
    nextPhasePreview: string;
  };

  const health: Record<string, string> | null = r.healthDashboard
    ? (Object.fromEntries(
        Object.entries({
          overall: r.healthDashboard.overall,
          schedule: r.healthDashboard.schedule,
          budget: r.healthDashboard.budget,
          quality: r.healthDashboard.quality,
          delivery: r.healthDashboard.delivery,
          risk: r.healthDashboard.risk,
          resources: r.healthDashboard.resources,
          stakeholders: r.healthDashboard.stakeholders,
        }).filter((entry): entry is [string, string] => entry[1] != null),
      ) as Record<string, string>)
    : null;

  return {
    executiveSummary: {
      projectName: r.executiveSummary.projectName,
      client: r.executiveSummary.client,
      pm: r.executiveSummary.pm,
      overallRag: r.executiveSummary.overallRag,
      startDate: r.executiveSummary.startDate,
      plannedEnd: r.executiveSummary.plannedEnd,
    },
    healthDashboard: health,
    level1Plan: r.level1Plan,
    milestones: r.milestones,
    raidSummary: r.raidSummary,
    financialSummary: r.financialSummary,
    resourceSummary: r.resourceSummary,
    nextPhasePreview: r.nextPhasePreview,
    narrative: narrative ?? r.executiveSummary.narrative,
  };
}
