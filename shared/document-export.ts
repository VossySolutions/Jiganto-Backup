/** Shared HTML / PDF export helpers for document page chrome. */

export const DOCUMENT_EXPORT_FONT_FAMILY = "Tahoma, Verdana, sans-serif";

export const DOCUMENT_EXPORT_BODY_STYLES = `
  body{font-family:${DOCUMENT_EXPORT_FONT_FAMILY};line-height:1.6;color:#1a1a1a;margin:0;padding:0;}
  .document-export-body{max-width:800px;margin:0 auto;padding:0 1.5rem 2rem;font-family:${DOCUMENT_EXPORT_FONT_FAMILY};}
  h1,h2,h3,h4{margin-top:1.5em;margin-bottom:0.5em;font-family:${DOCUMENT_EXPORT_FONT_FAMILY};}
  p,li,td,th,div{font-family:${DOCUMENT_EXPORT_FONT_FAMILY};}
  table{border-collapse:collapse;width:100%;margin:1em 0;}
  th,td{border:1px solid #ddd;padding:8px;text-align:left;}
  th{background:#f5f5f5;font-weight:600;}
  ul,ol{padding-left:1.5em;}
  blockquote{border-left:4px solid #ddd;margin:1em 0;padding-left:1em;font-style:italic;}
  code{background:#f5f5f5;padding:0.2em 0.4em;border-radius:3px;font-family:monospace;}
  pre{background:#f5f5f5;padding:1em;border-radius:6px;overflow-x:auto;}
  [data-callout="info"]{border-left:4px solid #3b82f6;background:#eff6ff;border-radius:6px;padding:12px 16px;margin:8px 0;}
  [data-callout="warning"]{border-left:4px solid #f59e0b;background:#fffbeb;border-radius:6px;padding:12px 16px;margin:8px 0;}
  [data-callout="success"]{border-left:4px solid #22c55e;background:#f0fdf4;border-radius:6px;padding:12px 16px;margin:8px 0;}
  [data-callout="danger"]{border-left:4px solid #ef4444;background:#fef2f2;border-radius:6px;padding:12px 16px;margin:8px 0;}
`;

/** CSS that makes a `<thead>`/`<tfoot>` inside a `<table>` repeat on every printed page. Works in all major browsers. */
export const DOCUMENT_EXPORT_REPEATING_REGION_STYLES = `
  .page-regions-table{width:100%;border-collapse:collapse;table-layout:fixed;}
  .page-regions-table > thead{display:table-header-group;}
  .page-regions-table > tfoot{display:table-footer-group;}
  .page-regions-table > tbody{display:table-row-group;}
  .page-regions-table td{padding:0;border:none;}
  .document-header{border-bottom:1px solid #e5e7eb;padding:0 0 0.75rem;margin-bottom:1rem;}
  .document-footer{border-top:1px solid #e5e7eb;padding:0.75rem 0 0;margin-top:1rem;}
  @media print{
    .page-regions-table > thead{display:table-header-group;}
    .page-regions-table > tfoot{display:table-footer-group;}
  }
`;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strip scripts for Puppeteer header/footer templates. */
export function sanitizeExportHtmlFragment(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "");
}

/** Body-only HTML for server-side (Puppeteer) PDF rendering — header/footer are rendered separately as real repeating page chrome via `buildPuppeteerPageTemplates`, so they must NOT be embedded here (avoids double header/footer). */
export function buildDocumentExportBodyHtml(opts: {
  title: string;
  content: string;
  updatedAt?: Date | string | null;
}): string {
  const updatedLabel = opts.updatedAt
    ? new Date(opts.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";
  const metaLine = updatedLabel
    ? `<p style="color:#666;font-size:0.875rem;margin-bottom:2rem;">Last updated: ${escapeHtml(updatedLabel)}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escapeHtml(opts.title)}</title>
<style>${DOCUMENT_EXPORT_BODY_STYLES}</style>
</head>
<body>
<div class="document-export-body">
  <h1 style="border-bottom:2px solid #e5e7eb;padding-bottom:0.5rem;margin-bottom:1rem;">${escapeHtml(opts.title)}</h1>
  ${metaLine}
  <div class="document-body">${opts.content || "<p><em>No content</em></p>"}</div>
</div>
</body>
</html>`;
}

/**
 * Full standalone HTML page with header/footer that repeat on every *printed* page
 * (via the `table-header-group` / `table-footer-group` CSS technique). Used for the
 * downloadable .html export and the browser-print PDF fallback — the two paths that
 * don't go through Puppeteer's native per-page header/footer templates.
 */
export function buildPrintableDocumentHtml(opts: {
  title: string;
  content: string;
  headerHtml?: string;
  footerHtml?: string;
  updatedAt?: Date | string | null;
}): string {
  const updatedLabel = opts.updatedAt
    ? new Date(opts.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";
  const metaLine = updatedLabel
    ? `<p style="color:#666;font-size:0.875rem;margin-bottom:2rem;">Last updated: ${escapeHtml(updatedLabel)}</p>`
    : "";
  const headerHtml = (opts.headerHtml || "").trim();
  const footerHtml = (opts.footerHtml || "").trim();

  const headerRow = headerHtml
    ? `<thead><tr><td><header class="document-header">${headerHtml}</header></td></tr></thead>`
    : "";
  const footerRow = footerHtml
    ? `<tfoot><tr><td><footer class="document-footer">${footerHtml}</footer></td></tr></tfoot>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escapeHtml(opts.title)}</title>
<style>${DOCUMENT_EXPORT_BODY_STYLES}${DOCUMENT_EXPORT_REPEATING_REGION_STYLES}</style>
</head>
<body>
<div class="document-export-body">
  <table class="page-regions-table">
    ${headerRow}
    ${footerRow}
    <tbody>
      <tr>
        <td>
          <h1 style="border-bottom:2px solid #e5e7eb;padding-bottom:0.5rem;margin-bottom:1rem;">${escapeHtml(opts.title)}</h1>
          ${metaLine}
          <div class="document-body">${opts.content || "<p><em>No content</em></p>"}</div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
</body>
</html>`;
}

export function buildPuppeteerPageTemplates(opts: {
  headerHtml: string;
  footerHtml: string;
  title: string;
}): {
  displayHeaderFooter: boolean;
  headerTemplate: string;
  footerTemplate: string;
  margin: { top: string; right: string; bottom: string; left: string };
} {
  const header = sanitizeExportHtmlFragment(opts.headerHtml.trim());
  const footer = sanitizeExportHtmlFragment(opts.footerHtml.trim());
  const hasChrome = !!(header || footer);
  const font = DOCUMENT_EXPORT_FONT_FAMILY;

  const headerTemplate = `
    <div style="font-family:${font};font-size:10px;width:100%;padding:0 1.2cm 0 1.2cm;color:#444;display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box;">
      <div style="flex:1;min-width:0;overflow:hidden;">${header || `<span style="color:#888;">${escapeHtml(opts.title)}</span>`}</div>
      <div style="flex-shrink:0;color:#888;">Page <span class="pageNumber"></span></div>
    </div>`;

  const footerTemplate = `
    <div style="font-family:${font};font-size:10px;width:100%;padding:0 1.2cm;color:#666;display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box;">
      <div style="flex:1;min-width:0;overflow:hidden;">${footer || ""}</div>
      <div style="flex-shrink:0;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
    </div>`;

  return {
    displayHeaderFooter: true,
    headerTemplate,
    footerTemplate,
    margin: {
      top: hasChrome && header ? "2.8cm" : "2.2cm",
      right: "1.2cm",
      bottom: hasChrome && footer ? "2.4cm" : "2cm",
      left: "1.2cm",
    },
  };
}

/** @deprecated kept for backward compatibility with any cached callers; prefer `buildPrintableDocumentHtml`. */
export function wrapDocumentBodyWithPageRegions(body: string, headerHtml: string, footerHtml: string): string {
  const parts: string[] = [];
  if (headerHtml.trim()) {
    parts.push(`<header class="document-header">${headerHtml}</header>`);
  }
  parts.push(`<div class="document-body">${body}</div>`);
  if (footerHtml.trim()) {
    parts.push(`<footer class="document-footer">${footerHtml}</footer>`);
  }
  return parts.join("\n");
}
