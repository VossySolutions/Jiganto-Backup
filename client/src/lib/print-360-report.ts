import type { Report360Data } from "@/components/portfolio/types";
import { escapeHtml, openReportPrintWindow, ragBadge } from "@/lib/report-print";

type Indicator = { label: string; pct: number; rag: string };
type Decision = { id: string; text: string; owner: string };
type Action = { id: string; text: string; owner: string; due: string };

export function print360Report(opts: {
  data: Report360Data;
  narrative: string;
  ragCommentary: string;
  indicators: Indicator[];
  decisions: Decision[];
  actions: Action[];
}): void {
  const { data, narrative, ragCommentary, indicators, decisions, actions } = opts;
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
    </div>

    <div class="section">
      <h2>Project plan (Level 1)</h2>
      <table>
        <thead><tr><th>Phase</th><th>RAG</th><th>Progress</th><th>Start</th><th>End</th></tr></thead>
        <tbody>
          ${data.level1Plan.map((p) => `
            <tr>
              <td>${escapeHtml(p.name)}</td>
              <td>${ragBadge(p.rag)}</td>
              <td>${p.progress}%</td>
              <td>${escapeHtml(p.plannedStart || "—")}</td>
              <td>${escapeHtml(p.plannedEnd || "—")}</td>
            </tr>
          `).join("") || `<tr><td colspan="5">No plan phases</td></tr>`}
        </tbody>
      </table>
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
      <h2>Team &amp; budget</h2>
      <div class="meta">
        <div><span>Budget</span><strong>${escapeHtml(String(fin.budget))}</strong></div>
        <div><span>Spent</span><strong>${escapeHtml(String(fin.spent))}</strong></div>
        <div><span>Remaining</span><strong>${escapeHtml(String(fin.remaining))}</strong></div>
        <div><span>Forecast</span><strong>${escapeHtml(String(fin.forecast))}</strong></div>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Role</th><th>Allocation</th></tr></thead>
        <tbody>
          ${data.resourceSummary.map((r) => `
            <tr>
              <td>${escapeHtml(r.name)}</td>
              <td>${escapeHtml(r.role || "—")}</td>
              <td>${r.allocation}%</td>
            </tr>
          `).join("") || `<tr><td colspan="3">No team members</td></tr>`}
        </tbody>
      </table>
    </div>

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
