import { escapeHtml, openReportPrintWindow, ragBadge } from "@/lib/report-print";

/** Minimal shape needed for print — avoids circular imports with the React component. */
type WeeklyPrintDraft = {
  weekCommencing: string;
  status: string;
  progressPct: number;
  overallRag: string;
  lastWeekOverallRag: string;
  ragByType: { budget: string; resource: string; schedule: string; quality: string };
  lastWeekRagByType: { budget: string; resource: string; schedule: string; quality: string };
  commentary: string;
  achievements: string[];
  plannedNext: string[];
  notAchieved: string[];
  gates: { name: string; forecast: string; actual: string }[];
  lastGatesPassed: { name: string; date: string }[];
  nextGates: { name: string; date: string }[];
  riskIssues: { id: string; text: string; owner: string; rag: string }[];
  financials: {
    baseline: number;
    costToDate: number;
    costToComplete: number;
    forecast: number;
    variance: number;
  };
  periodStrip: { date: string; rag: string }[];
};

export function printWeeklyStatusReport(opts: {
  projectName: string;
  projectCode?: string;
  manager?: string;
  portfolio?: string;
  variantLabel: string;
  draft: WeeklyPrintDraft;
}): void {
  const { draft } = opts;
  const rag = (r: string) => ragBadge(r);

  const body = `
    <div class="section">
      <h2>Project header</h2>
      <div class="meta">
        <div><span>Project name</span><strong>${escapeHtml(opts.projectName)}</strong></div>
        <div><span>Project ID</span><strong>${escapeHtml(opts.projectCode || "—")}</strong></div>
        <div><span>Programme manager</span><strong>${escapeHtml(opts.manager || "—")}</strong></div>
        <div><span>Portfolio</span><strong>${escapeHtml(opts.portfolio || "—")}</strong></div>
        <div><span>Week commencing</span><strong>${escapeHtml(draft.weekCommencing)}</strong></div>
        <div><span>Variant</span><strong>${escapeHtml(opts.variantLabel)}</strong></div>
        <div><span>Status</span><strong>${escapeHtml(draft.status)}</strong></div>
        <div><span>Completion</span><strong>${draft.progressPct}%</strong></div>
      </div>
    </div>

    <div class="section">
      <h2>Milestones / gates</h2>
      <table>
        <thead>
          <tr>
            <th></th>
            ${draft.gates.map((g) => `<th>${escapeHtml(g.name)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Forecast</strong></td>
            ${draft.gates.map((g) => `<td>${escapeHtml(g.forecast || "—")}</td>`).join("")}
          </tr>
          <tr>
            <td><strong>Actual</strong></td>
            ${draft.gates.map((g) => `<td>${escapeHtml(g.actual || "—")}</td>`).join("")}
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>RAG status</h2>
      <div class="pill-row">
        <div class="pill"><div class="lbl">This week overall</div><div class="val">${rag(draft.overallRag)}</div></div>
        <div class="pill"><div class="lbl">Last week overall</div><div class="val">${rag(draft.lastWeekOverallRag)}</div></div>
      </div>
      <table>
        <thead><tr><th>Type</th><th>This week</th><th>Last week</th></tr></thead>
        <tbody>
          ${(["budget", "resource", "schedule", "quality"] as const).map((k) => `
            <tr>
              <td style="text-transform:capitalize">${k}</td>
              <td>${rag(draft.ragByType[k])}</td>
              <td>${rag(draft.lastWeekRagByType[k])}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Project summary / RAG commentary</h2>
      <div class="box">${escapeHtml(draft.commentary || "—")}</div>
    </div>

    <div class="section">
      <h2>Achievements this period</h2>
      <ul>${(draft.achievements.filter(Boolean).length
        ? draft.achievements.filter(Boolean)
        : ["—"]).map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>
    </div>

    <div class="section">
      <h2>Achievements planned for next period</h2>
      <ul>${(draft.plannedNext.filter(Boolean).length
        ? draft.plannedNext.filter(Boolean)
        : ["—"]).map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>
    </div>

    <div class="section">
      <h2>Planned but not achieved</h2>
      <ul>${(draft.notAchieved.filter(Boolean).length
        ? draft.notAchieved.filter(Boolean)
        : ["—"]).map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>
    </div>

    <div class="section">
      <h2>Gate tracking</h2>
      <table>
        <thead><tr><th>Last gate passed</th><th>Date</th><th>Next gate</th><th>Date</th></tr></thead>
        <tbody>
          ${Array.from({ length: Math.max(draft.lastGatesPassed.length, draft.nextGates.length, 1) }).map((_, i) => {
            const last = draft.lastGatesPassed[i];
            const next = draft.nextGates[i];
            return `<tr>
              <td>${escapeHtml(last?.name || "—")}</td>
              <td>${escapeHtml(last?.date || "—")}</td>
              <td>${escapeHtml(next?.name || "—")}</td>
              <td>${escapeHtml(next?.date || "—")}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Risks / Issues</h2>
      <table>
        <thead><tr><th>ID</th><th>Risk / Issue</th><th>Owner</th><th>RAG</th></tr></thead>
        <tbody>
          ${draft.riskIssues.map((r) => `
            <tr>
              <td>${escapeHtml(r.id)}</td>
              <td>${escapeHtml(r.text || "—")}</td>
              <td>${escapeHtml(r.owner || "—")}</td>
              <td>${rag(r.rag)}</td>
            </tr>
          `).join("") || `<tr><td colspan="4">None</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Financial summary</h2>
      <table>
        <thead>
          <tr>
            <th>Baseline</th><th>Cost to date</th><th>Cost to complete</th><th>Forecast</th><th>Variance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${draft.financials.baseline}</td>
            <td>${draft.financials.costToDate}</td>
            <td>${draft.financials.costToComplete}</td>
            <td>${draft.financials.forecast}</td>
            <td>${draft.financials.variance}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Reporting period RAG</h2>
      <table>
        <thead><tr>${draft.periodStrip.map((p) => `<th>${escapeHtml(p.date)}</th>`).join("")}</tr></thead>
        <tbody><tr>${draft.periodStrip.map((p) => `<td style="text-align:center">${rag(p.rag)}</td>`).join("")}</tr></tbody>
      </table>
    </div>
  `;

  openReportPrintWindow({
    title: "Weekly Project Status Report",
    subtitle: `${opts.projectName} · ${opts.variantLabel} · W/C ${draft.weekCommencing}`,
    bodyHtml: body,
  });
}
