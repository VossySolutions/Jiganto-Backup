import type { Report360Data } from "@/components/portfolio/types";
import { escapeHtml, openReportPrintWindow, ragBadge } from "@/lib/report-print";

type Indicator = { label: string; pct: number; rag: string };
type Decision = { id: string; text: string; owner: string };
type Action = { id: string; text: string; owner: string; due: string };
type Level1Row = {
  id: string;
  kind: string;
  name: string;
  status?: string;
  startWeek?: number;
  endWeek?: number;
  week?: number;
};
type ActivityRelease = {
  name: string;
  lanes: { name: string; cells: string[] }[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function level1PrintTable(rows: Level1Row[]): string {
  if (!rows.length) return `<tr><td colspan="4">No Level 1 plan rows</td></tr>`;
  return rows.map((r) => {
    if (r.kind === "release") {
      return `<tr style="background:#0F0F1A;color:#fff;"><td colspan="4"><strong>${escapeHtml(r.name)}</strong></td></tr>`;
    }
    if (r.kind === "milestone") {
      return `<tr><td>◆ ${escapeHtml(r.name)}</td><td>Milestone</td><td>W${(r.week ?? 0) + 1}</td><td>—</td></tr>`;
    }
    return `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.status || "—")}</td><td>W${(r.startWeek ?? 0) + 1}</td><td>W${(r.endWeek ?? 0) + 1}</td></tr>`;
  }).join("");
}

function activityPrintTable(releases: ActivityRelease[]): string {
  if (!releases.length) return `<p>No activity plan data</p>`;
  const parts: string[] = [];
  for (const rel of releases) {
    parts.push(`<h3 style="margin:12px 0 6px;font-size:12px;">${escapeHtml(rel.name)}</h3>`);
    parts.push(`<table><thead><tr><th>Lane</th>${MONTHS.map((m) => `<th colspan="4">${m}</th>`).join("")}</tr></thead><tbody>`);
    for (const lane of rel.lanes) {
      parts.push(`<tr><td>${escapeHtml(lane.name)}</td>`);
      for (let w = 0; w < 48; w++) {
        const code = lane.cells[w] || "";
        parts.push(`<td style="font-size:8px;text-align:center;${code ? "background:#4338CA;color:#fff;" : ""}">${escapeHtml(code)}</td>`);
      }
      parts.push(`</tr>`);
    }
    parts.push(`</tbody></table>`);
  }
  return parts.join("");
}

export function print360Report(opts: {
  data: Report360Data;
  narrative: string;
  ragCommentary: string;
  indicators: Indicator[];
  decisions: Decision[];
  actions: Action[];
  highlights?: string[];
  lowlights?: string[];
  readinessItems?: { phase: string; activity: string; criteria: string; rag: string; owner: string; commentary: string }[];
  level1Rows?: Level1Row[];
  activityReleases?: ActivityRelease[];
}): void {
  const {
    data, narrative, ragCommentary, indicators, decisions, actions,
    highlights = [], lowlights = [], readinessItems = [],
    level1Rows = [], activityReleases = [],
  } = opts;
  const ex = data.executiveSummary;
  const raid = data.raidSummary;
  const health = data.healthDashboard;
  const fin = data.financialSummary;

  const body = `
    <div class="section">
      <h2>Project summary</h2>
      <div class="meta">
        <div><span>Client</span><strong>${escapeHtml(ex.client || "—")}</strong></div>
        <div><span>PM</span><strong>${escapeHtml(ex.pm || "—")}</strong></div>
        <div><span>Overall RAG</span><strong>${ragBadge(ex.overallRag)}</strong></div>
        <div><span>Dates</span><strong>${escapeHtml(ex.startDate || "—")} → ${escapeHtml(ex.plannedEnd || "—")}</strong></div>
      </div>
    </div>

    <div class="section">
      <h2>RAG status</h2>
      <div class="pill-row">
        ${[
          ["Schedule", health?.schedule],
          ["Budget", health?.budget],
          ["Quality", health?.quality],
          ["Resource", health?.resources],
          ["Risk", health?.risk],
          ["Overall", health?.overall || ex.overallRag],
        ].map(([lbl, val]) => `
          <div class="pill"><div class="lbl">${escapeHtml(String(lbl))}</div><div class="val">${ragBadge(val as string)}</div></div>
        `).join("")}
      </div>
      <div class="box">${escapeHtml(ragCommentary || narrative || "—")}</div>
    </div>

    <div class="section">
      <h2>Health indicators</h2>
      <table>
        <thead><tr><th>Indicator</th><th>%</th><th>RAG</th></tr></thead>
        <tbody>
          ${indicators.map((i) => `
            <tr><td>${escapeHtml(i.label)}</td><td>${i.pct}%</td><td>${ragBadge(i.rag)}</td></tr>
          `).join("") || `<tr><td colspan="3">No indicators</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Executive summary</h2>
      <div class="box">${escapeHtml(narrative || "—")}</div>
      ${highlights.filter(Boolean).length ? `
        <h3 style="margin-top:12px;font-size:12px;">Highlights</h3>
        <ul>${highlights.filter(Boolean).map((h) => `<li>${escapeHtml(h)}</li>`).join("")}</ul>
      ` : ""}
      ${lowlights.filter(Boolean).length ? `
        <h3 style="margin-top:12px;font-size:12px;">Lowlights &amp; concerns</h3>
        <ul>${lowlights.filter(Boolean).map((h) => `<li>${escapeHtml(h)}</li>`).join("")}</ul>
      ` : ""}
    </div>

    <div class="section">
      <h2>Level 1 Plan</h2>
      <table>
        <thead><tr><th>Item</th><th>Status</th><th>Start</th><th>End</th></tr></thead>
        <tbody>${level1PrintTable(level1Rows)}</tbody>
      </table>
    </div>

    <div class="section">
      <h2>Activity Plan</h2>
      ${activityPrintTable(activityReleases)}
    </div>

    <div class="section">
      <h2>Risks</h2>
      <table>
        <thead><tr><th>Ref</th><th>Description</th><th>Owner</th><th>Severity</th></tr></thead>
        <tbody>
          ${raid.topRisks.map((r) => `
            <tr>
              <td>${escapeHtml(r.ref || "—")}</td>
              <td>${escapeHtml(r.description)}</td>
              <td>${escapeHtml(r.owner || "—")}</td>
              <td>${ragBadge(r.severity)}</td>
            </tr>
          `).join("") || `<tr><td colspan="4">No open risks</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Issues</h2>
      <table>
        <thead><tr><th>Ref</th><th>Description</th><th>Owner</th><th>Priority</th><th>Target</th></tr></thead>
        <tbody>
          ${raid.topIssues.map((r) => `
            <tr>
              <td>${escapeHtml(r.ref || "—")}</td>
              <td>${escapeHtml(r.description)}</td>
              <td>${escapeHtml(r.owner || "—")}</td>
              <td>${ragBadge(r.priority)}</td>
              <td>${escapeHtml(r.targetResolution || "—")}</td>
            </tr>
          `).join("") || `<tr><td colspan="5">No open issues</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Workstreams</h2>
      <table>
        <thead><tr><th>Name</th><th>Owner</th><th>Progress</th><th>RAG</th><th>Update</th></tr></thead>
        <tbody>
          ${data.workstreamUpdates.map((w) => `
            <tr>
              <td>${escapeHtml(w.name)}</td>
              <td>${escapeHtml(w.owner || "—")}</td>
              <td>${w.progress}%</td>
              <td>${ragBadge(w.rag)}</td>
              <td>${escapeHtml(w.note || "—")}</td>
            </tr>
          `).join("") || `<tr><td colspan="5">No workstreams</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Decisions</h2>
      <table>
        <thead><tr><th>Ref</th><th>Decision</th><th>Owner</th></tr></thead>
        <tbody>
          ${decisions.map((d) => `
            <tr><td>${escapeHtml(d.id)}</td><td>${escapeHtml(d.text)}</td><td>${escapeHtml(d.owner || "—")}</td></tr>
          `).join("") || `<tr><td colspan="3">No decisions</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Deliverables</h2>
      <table>
        <thead><tr><th>Deliverable</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead>
        <tbody>
          ${data.deliverablesTracker.map((d) => `
            <tr>
              <td>${escapeHtml(d.name)}</td>
              <td>${escapeHtml(d.owner || "—")}</td>
              <td>${escapeHtml(d.dueDate || "—")}</td>
              <td>${escapeHtml(d.status)}</td>
            </tr>
          `).join("") || `<tr><td colspan="4">No deliverables</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Dependencies</h2>
      <table>
        <thead><tr><th>Ref</th><th>Description</th><th>Direction</th><th>Required by</th><th>Status</th></tr></thead>
        <tbody>
          ${raid.openDependencies.map((r) => `
            <tr>
              <td>${escapeHtml(r.ref || "—")}</td>
              <td>${escapeHtml(r.description)}</td>
              <td>${escapeHtml(r.direction)}</td>
              <td>${escapeHtml(r.requiredBy || "—")}</td>
              <td>${escapeHtml(r.status || "—")}</td>
            </tr>
          `).join("") || `<tr><td colspan="5">No open dependencies</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Actions</h2>
      <table>
        <thead><tr><th>ID</th><th>Action</th><th>Owner</th><th>Due</th></tr></thead>
        <tbody>
          ${actions.map((a) => `
            <tr>
              <td>${escapeHtml(a.id)}</td>
              <td>${escapeHtml(a.text)}</td>
              <td>${escapeHtml(a.owner || "—")}</td>
              <td>${escapeHtml(a.due || "—")}</td>
            </tr>
          `).join("") || `<tr><td colspan="4">No actions</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Team</h2>
      <table>
        <thead><tr><th>Name</th><th>Role</th><th>Allocation</th><th>Start</th><th>End</th></tr></thead>
        <tbody>
          ${data.resourceSummary.map((r) => `
            <tr>
              <td>${escapeHtml(r.name)}</td>
              <td>${escapeHtml(r.role || "—")}</td>
              <td>${r.allocation}%</td>
              <td>${escapeHtml(r.startDate || "—")}</td>
              <td>${escapeHtml(r.endDate || "—")}</td>
            </tr>
          `).join("") || `<tr><td colspan="5">No team members</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Budget</h2>
      <div class="meta">
        <div><span>Budget</span><strong>${escapeHtml(String(fin.budget))}</strong></div>
        <div><span>Spent</span><strong>${escapeHtml(String(fin.spent))}</strong></div>
        <div><span>Remaining</span><strong>${escapeHtml(String(fin.remaining))}</strong></div>
        <div><span>Forecast</span><strong>${escapeHtml(String(fin.forecast))}</strong></div>
      </div>
      ${(data.budgetBreakdown?.length ? `
        <table>
          <thead><tr><th>Category</th><th>Budgeted</th><th>Actual</th></tr></thead>
          <tbody>
            ${data.budgetBreakdown.map((b) => `
              <tr><td>${escapeHtml(b.category)}</td><td>${b.budgeted}</td><td>${b.actual}</td></tr>
            `).join("")}
          </tbody>
        </table>
      ` : "")}
    </div>

    ${readinessItems.length ? `
    <div class="section">
      <h2>Readiness board</h2>
      <table>
        <thead><tr><th>Phase</th><th>Activity</th><th>Criteria</th><th>RAG</th><th>Owner</th><th>Commentary</th></tr></thead>
        <tbody>
          ${readinessItems.map((r) => `
            <tr>
              <td>${escapeHtml(r.phase)}</td>
              <td>${escapeHtml(r.activity)}</td>
              <td>${escapeHtml(r.criteria)}</td>
              <td>${ragBadge(r.rag)}</td>
              <td>${escapeHtml(r.owner || "—")}</td>
              <td>${escapeHtml(r.commentary || "—")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>` : ""}

    <div class="section">
      <h2>Milestones / deadlines</h2>
      <table>
        <thead><tr><th>Item</th><th>Target</th><th>RAG</th><th>Status</th></tr></thead>
        <tbody>
          ${data.milestones.map((m) => `
            <tr>
              <td>${escapeHtml(m.name)}</td>
              <td>${escapeHtml(m.targetDate || "—")}</td>
              <td>${ragBadge(m.rag)}</td>
              <td>${escapeHtml(m.status || "—")}${m.overdue ? " (overdue)" : ""}</td>
            </tr>
          `).join("") || `<tr><td colspan="4">No milestones</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  openReportPrintWindow({
    title: `${ex.projectName} — 360° Project Report`,
    subtitle: `Generated ${new Date(data.generatedAt || Date.now()).toLocaleDateString("en-GB")}`,
    bodyHtml: body,
  });
}
