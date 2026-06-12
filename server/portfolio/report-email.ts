import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { tenants, users } from "@shared/schema";
import { sendOrgEmail } from "../lib/org-email";

function appBaseUrl(): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.VITE_APP_URL?.trim() ||
    "http://localhost:5000"
  ).replace(/\/$/, "");
}

export async function resolveRecipientEmails(
  recipientIds: string[],
): Promise<{ userId: string; email: string; name: string }[]> {
  const ids = recipientIds.filter(Boolean);
  if (!ids.length) return [];

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(inArray(users.id, ids));

  return rows
    .filter((r) => r.email)
    .map((r) => ({
      userId: r.id,
      email: r.email!,
      name: `${r.firstName || ""} ${r.lastName || ""}`.trim() || r.email!,
    }));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function reportTypeLabel(reportType: string): string {
  if (reportType === "360_report") return "360° Project Report";
  if (reportType === "portfolio_summary") return "Portfolio Summary";
  if (reportType === "milestone_register") return "Milestone Register";
  return reportType;
}

function buildReportHtml(params: {
  reportType: string;
  format: string;
  content: Record<string, unknown>;
  projectId?: number | null;
  snapshotId?: number;
}): string {
  const { reportType, format, content, projectId, snapshotId } = params;
  const portfolioUrl = `${appBaseUrl()}/modules/portfolio`;
  const generatedAt = new Date().toLocaleString("en-GB");

  let body = "";

  if (reportType === "360_report") {
    const ex = content.executiveSummary as {
      projectName?: string;
      client?: string | null;
      pm?: string | null;
      overallRag?: string | null;
      narrative?: string;
    } | undefined;
    body = `
      <h2 style="color:#1A6B5A;margin:0 0 12px">${escapeHtml(ex?.projectName || "Project")}</h2>
      <p><strong>Client:</strong> ${escapeHtml(ex?.client || "—")}<br/>
      <strong>PM:</strong> ${escapeHtml(ex?.pm || "—")}<br/>
      <strong>RAG:</strong> ${escapeHtml(ex?.overallRag || "—")}</p>
      <p style="line-height:1.5">${escapeHtml(ex?.narrative || "").slice(0, 1200)}</p>
      ${format === "pptx" ? "<p><em>PowerPoint snapshot saved in Portfolio Reports.</em></p>" : ""}
    `;
  } else if (reportType === "portfolio_summary") {
    const rows = (content.rows as { name: string; client: string; pm: string; rag: string; budget: number; progress: number }[]) || [];
    const tableRows = rows
      .slice(0, 25)
      .map(
        (r) =>
          `<tr><td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(r.name)}</td>
           <td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(r.client || "—")}</td>
           <td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(r.rag || "—")}</td>
           <td style="padding:6px;border-bottom:1px solid #eee">${r.progress ?? 0}%</td></tr>`,
      )
      .join("");
    body = `
      <p>${rows.length} project(s) in portfolio summary.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#E4F2EE">
          <th style="padding:6px;text-align:left">Project</th><th>Client</th><th>RAG</th><th>Progress</th>
        </tr></thead>
        <tbody>${tableRows || "<tr><td colspan='4'>No projects</td></tr>"}</tbody>
      </table>
    `;
  } else if (reportType === "milestone_register") {
    const rows = (content.rows as { ref: string; name: string; projectName: string; targetDate: string; ragStatus: string }[]) || [];
    const tableRows = rows
      .slice(0, 30)
      .map(
        (m) =>
          `<tr><td style="padding:6px;border-bottom:1px solid #eee;font-family:monospace">${escapeHtml(m.ref || "—")}</td>
           <td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(m.name)}</td>
           <td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(m.projectName || "—")}</td>
           <td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(m.targetDate || "—")}</td></tr>`,
      )
      .join("");
    body = `
      <p>${rows.length} milestone(s) due across the portfolio.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#E4F2EE">
          <th style="padding:6px;text-align:left">Ref</th><th>Milestone</th><th>Project</th><th>Target</th>
        </tr></thead>
        <tbody>${tableRows || "<tr><td colspan='4'>No milestones</td></tr>"}</tbody>
      </table>
    `;
  }

  return `
    <div style="font-family:system-ui,sans-serif;max-width:640px;color:#0F0E0C">
      <div style="background:#1A6B5A;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:18px">${escapeHtml(reportTypeLabel(reportType))}</h1>
        <p style="margin:4px 0 0;opacity:0.85;font-size:12px">Generated ${generatedAt}</p>
      </div>
      <div style="padding:20px;border:1px solid #E4F2EE;border-top:0;border-radius:0 0 8px 8px">
        ${body}
        <p style="margin-top:20px">
          <a href="${portfolioUrl}" style="color:#1A6B5A;font-weight:600">Open Portfolio Command Centre →</a>
        </p>
        ${snapshotId ? `<p style="font-size:11px;color:#5C5952">Snapshot #${snapshotId}${projectId ? ` · Project ${projectId}` : ""}</p>` : ""}
      </div>
    </div>
  `;
}

export async function sendPortfolioReportEmails(params: {
  tenantId: number;
  reportType: string;
  format: string;
  content: Record<string, unknown>;
  recipientIds: string[];
  projectId?: number | null;
  snapshotId?: number;
}): Promise<{ sent: number; failed: number; skipped: number }> {
  const recipients = await resolveRecipientEmails(params.recipientIds);
  if (!recipients.length) return { sent: 0, failed: 0, skipped: 1 };

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, params.tenantId)).limit(1);
  const subject = `Jiganto — ${reportTypeLabel(params.reportType)} (${new Date().toLocaleDateString("en-GB")})`;
  const html = buildReportHtml(params);

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const result = await sendOrgEmail({ tenant, to: r.email, subject, html });
    if (result.sent) sent++;
    else failed++;
  }
  return { sent, failed, skipped: 0 };
}
