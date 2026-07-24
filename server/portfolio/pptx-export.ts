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

/** LAYOUT_WIDE usable content band (inches). Leave margin at bottom. */
const CONTENT_TOP = 0.95;
const CONTENT_BOTTOM = 6.9;
const CONTENT_HEIGHT = CONTENT_BOTTOM - CONTENT_TOP;

function ragColor(rag: string | null | undefined): string {
  const s = (rag || "green").toLowerCase();
  if (s === "red") return "EF4444";
  if (s === "amber") return "F59E0B";
  return "22C55E";
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out.length ? out : [[]];
}

function wrapNarrative(text: string, maxChars = 900): string[] {
  const clean = (text || "").trim() || "No executive narrative captured.";
  if (clean.length <= maxChars) return [clean];
  const parts: string[] = [];
  let rest = clean;
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf(" ", maxChars);
    if (cut < maxChars * 0.6) cut = maxChars;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export async function build360ReportPptx(input: ReportInput): Promise<Buffer> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const prs = new PptxGenJS();
  prs.layout = "LAYOUT_WIDE";
  prs.title = `360 Report — ${input.executiveSummary.projectName}`;

  const cover = prs.addSlide();
  cover.background = { color: TEAL };
  cover.addText("360° Project Report", { x: 0.5, y: 1.8, w: 12, h: 0.5, fontSize: 16, color: "FFFFFF", align: "center" });
  cover.addText(input.executiveSummary.projectName, {
    x: 0.5, y: 2.4, w: 12, h: 1, fontSize: 28, bold: true, color: "FFFFFF", align: "center",
    wrap: true, valign: "middle",
  });
  cover.addText(`${input.executiveSummary.client || "—"} · PM: ${input.executiveSummary.pm || "—"}`, {
    x: 0.5, y: 3.6, w: 12, h: 0.35, fontSize: 13, color: "DDEEEA", align: "center",
  });
  cover.addText(`RAG: ${input.executiveSummary.overallRag || "—"}`, {
    x: 0.5, y: 4.1, w: 12, h: 0.35, fontSize: 12, color: "BBDDCC", align: "center",
  });

  const narrativeParts = wrapNarrative(input.narrative, 850);
  narrativeParts.forEach((part, idx) => {
    const exec = prs.addSlide();
    const title = narrativeParts.length > 1
      ? `1. Executive Summary (${idx + 1}/${narrativeParts.length})`
      : "1. Executive Summary";
    exec.addText(title, { x: 0.5, y: 0.3, w: 12, h: 0.45, fontSize: 18, bold: true, color: INK });
    exec.addText(part, {
      x: 0.5, y: CONTENT_TOP, w: 12, h: CONTENT_HEIGHT - 0.7,
      fontSize: 12, color: INK, wrap: true, valign: "top",
    });
    if (idx === narrativeParts.length - 1) {
      exec.addText(
        `Start: ${input.executiveSummary.startDate || "—"}  |  Planned end: ${input.executiveSummary.plannedEnd || "—"}`,
        { x: 0.5, y: CONTENT_BOTTOM - 0.15, w: 12, h: 0.3, fontSize: 11, color: MID },
      );
    }
  });

  if (input.healthDashboard) {
    const health = prs.addSlide();
    health.addText("2. Health Dashboard", { x: 0.5, y: 0.3, w: 12, h: 0.45, fontSize: 18, bold: true, color: INK });
    const dims = ["overall", "schedule", "budget", "quality", "delivery", "risk", "resources", "stakeholders"] as const;
    dims.forEach((d, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 0.5 + col * 3.1;
      const y = 1.1 + row * 1.35;
      const level = (input.healthDashboard as Record<string, string>)[d];
      health.addShape(prs.ShapeType.roundRect, {
        x, y, w: 2.9, h: 1.15, fill: { color: LIGHT }, line: { color: "B0D9CE", width: 0.5 }, rectRadius: 0.08,
      });
      health.addText(d.charAt(0).toUpperCase() + d.slice(1), {
        x, y: y + 0.12, w: 2.9, h: 0.3, fontSize: 10, color: MID, align: "center",
      });
      health.addText(String(level || "—"), {
        x, y: y + 0.45, w: 2.9, h: 0.45, fontSize: 16, bold: true, color: ragColor(level), align: "center",
      });
    });
  }

  if (input.level1Plan.length) {
    const header = [["Phase", "RAG", "Progress", "Start", "End"]];
    const rowsPerSlide = 10;
    chunk(input.level1Plan, rowsPerSlide).forEach((slice, idx, all) => {
      const plan = prs.addSlide();
      const title = all.length > 1 ? `3. Level 1 Plan (${idx + 1}/${all.length})` : "3. Level 1 Plan";
      plan.addText(title, { x: 0.5, y: 0.3, w: 12, h: 0.45, fontSize: 18, bold: true, color: INK });
      const body = slice.map((p) => [
        truncate(p.name, 48),
        p.rag || "—",
        `${p.progress}%`,
        p.plannedStart || "—",
        p.plannedEnd || "—",
      ]);
      plan.addTable([...header, ...body] as never, {
        x: 0.5, y: CONTENT_TOP, w: 12, colW: [4.5, 1.5, 1.5, 2.25, 2.25],
        fontSize: 10, border: { pt: 0.5, color: "CCCCCC" },
        color: INK, align: "left", valign: "middle",
      });
    });
  }

  if (input.milestones.length) {
    const header = [["Milestone", "Target", "RAG", "Status"]];
    chunk(input.milestones, 12).forEach((slice, idx, all) => {
      const ms = prs.addSlide();
      const title = all.length > 1 ? `4. Milestones (${idx + 1}/${all.length})` : "4. Milestones";
      ms.addText(title, { x: 0.5, y: 0.3, w: 12, h: 0.45, fontSize: 18, bold: true, color: INK });
      const rows = slice.map((m) => [
        truncate(m.name, 55),
        m.targetDate || "—",
        m.rag || "—",
        m.status || "—",
      ]);
      ms.addTable([...header, ...rows] as never, {
        x: 0.5, y: CONTENT_TOP, w: 12, colW: [5.5, 2.5, 1.5, 2.5],
        fontSize: 10, border: { pt: 0.5, color: "CCCCCC" }, color: INK,
      });
    });
  }

  // RAID — paginate risks and issues separately so lines never overflow the slide
  const riskChunks = chunk(input.raidSummary.topRisks, 10);
  riskChunks.forEach((slice, idx, all) => {
    const raid = prs.addSlide();
    const title = all.length > 1 ? `5a. Top Risks (${idx + 1}/${all.length})` : "5a. Top Risks";
    raid.addText(title, { x: 0.5, y: 0.3, w: 12, h: 0.45, fontSize: 18, bold: true, color: INK });
    if (!slice.length) {
      raid.addText("No open risks.", { x: 0.5, y: CONTENT_TOP, w: 12, h: 0.35, fontSize: 12, color: MID });
      return;
    }
    const rows = slice.map((r) => [
      r.ref || "—",
      truncate(r.description, 90),
      r.severity || "—",
    ]);
    raid.addTable([["Ref", "Description", "Severity"], ...rows] as never, {
      x: 0.5, y: CONTENT_TOP, w: 12, colW: [1.5, 8.5, 2],
      fontSize: 10, border: { pt: 0.5, color: "CCCCCC" }, color: INK,
    });
  });

  const issueChunks = chunk(input.raidSummary.topIssues, 10);
  issueChunks.forEach((slice, idx, all) => {
    const raid = prs.addSlide();
    const title = all.length > 1 ? `5b. Top Issues (${idx + 1}/${all.length})` : "5b. Top Issues";
    raid.addText(title, { x: 0.5, y: 0.3, w: 12, h: 0.45, fontSize: 18, bold: true, color: INK });
    if (!slice.length) {
      raid.addText("No open issues.", { x: 0.5, y: CONTENT_TOP, w: 12, h: 0.35, fontSize: 12, color: MID });
      return;
    }
    const rows = slice.map((i) => [
      i.ref || "—",
      truncate(i.description, 90),
      i.priority || "—",
    ]);
    raid.addTable([["Ref", "Description", "Priority"], ...rows] as never, {
      x: 0.5, y: CONTENT_TOP, w: 12, colW: [1.5, 8.5, 2],
      fontSize: 10, border: { pt: 0.5, color: "CCCCCC" }, color: INK,
    });
  });

  const fin = prs.addSlide();
  fin.addText("6. Finance, Resources & Next Phase", { x: 0.5, y: 0.3, w: 12, h: 0.45, fontSize: 18, bold: true, color: INK });
  fin.addShape(prs.ShapeType.roundRect, {
    x: 0.5, y: 1.0, w: 12, h: 1.0, fill: { color: LIGHT }, line: { color: "B0D9CE", width: 0.5 }, rectRadius: 0.08,
  });
  fin.addText(
    `Budget: ${fmtMoney(input.financialSummary.budget)}   ·   Spent: ${fmtMoney(input.financialSummary.spent)}   ·   Remaining: ${fmtMoney(input.financialSummary.remaining)}`,
    { x: 0.7, y: 1.25, w: 11.6, h: 0.5, fontSize: 13, color: INK, valign: "middle" },
  );
  fin.addText(`Next phase: ${truncate(input.nextPhasePreview || "—", 120)}`, {
    x: 0.5, y: 2.25, w: 12, h: 0.4, fontSize: 12, color: INK,
  });
  fin.addText("Key resources", { x: 0.5, y: 2.85, w: 12, h: 0.35, fontSize: 13, bold: true, color: INK });

  const resourceRows = input.resourceSummary.slice(0, 8).map((r) => [
    truncate(r.name, 40),
    truncate(r.role || "—", 40),
    `${r.allocation}%`,
  ]);
  if (resourceRows.length) {
    fin.addTable([["Name", "Role", "Allocation"], ...resourceRows] as never, {
      x: 0.5, y: 3.3, w: 12, colW: [4.5, 5, 2.5],
      fontSize: 10, border: { pt: 0.5, color: "CCCCCC" }, color: INK,
    });
  } else {
    fin.addText("No resources listed.", { x: 0.5, y: 3.3, w: 12, h: 0.35, fontSize: 11, color: MID });
  }

  const out = await prs.write({ outputType: "nodebuffer" });
  return out as Buffer;
}

function truncate(s: string, n: number): string {
  const t = String(s || "");
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function fmtMoney(n: number): string {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return String(n || 0);
  }
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
    level1Plan: r.level1Plan || [],
    milestones: r.milestones || [],
    raidSummary: {
      topRisks: r.raidSummary?.topRisks || [],
      topIssues: r.raidSummary?.topIssues || [],
    },
    financialSummary: r.financialSummary || { budget: 0, spent: 0, remaining: 0 },
    resourceSummary: r.resourceSummary || [],
    nextPhasePreview: r.nextPhasePreview || "",
    narrative: narrative ?? r.executiveSummary.narrative ?? "",
  };
}
