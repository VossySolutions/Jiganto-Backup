/** Shared HTML / PDF export helpers for document page chrome. */

export const DOCUMENT_EXPORT_BODY_STYLES = `
  body{font-family:system-ui,sans-serif;line-height:1.6;color:#1a1a1a;margin:0;padding:0;}
  .document-export-body{max-width:800px;margin:0 auto;padding:0 1.5rem 2rem;}
  h1,h2,h3,h4{margin-top:1.5em;margin-bottom:0.5em;}
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
  ${opts.content || "<p><em>No content</em></p>"}
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

  const headerTemplate = `
    <div style="font-size:9px;width:100%;padding:0 1.2cm 0 1.2cm;color:#444;display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box;">
      <div style="flex:1;min-width:0;overflow:hidden;">${header || `<span style="color:#888;">${escapeHtml(opts.title)}</span>`}</div>
      <div style="flex-shrink:0;color:#888;">Page <span class="pageNumber"></span></div>
    </div>`;

  const footerTemplate = `
    <div style="font-size:9px;width:100%;padding:0 1.2cm;color:#666;display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box;">
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

export function wrapDocumentBodyWithPageRegions(body: string, headerHtml: string, footerHtml: string): string {
  const parts: string[] = [];
  if (headerHtml.trim()) {
    parts.push(
      `<header class="document-header" style="border-bottom:1px solid #e5e7eb;padding-bottom:0.75rem;margin-bottom:1.5rem;">${headerHtml}</header>`,
    );
  }
  parts.push(`<div class="document-body">${body}</div>`);
  if (footerHtml.trim()) {
    parts.push(
      `<footer class="document-footer" style="border-top:1px solid #e5e7eb;padding-top:0.75rem;margin-top:1.5rem;">${footerHtml}</footer>`,
    );
  }
  return parts.join("\n");
}
