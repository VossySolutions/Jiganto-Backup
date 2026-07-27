/** Open a dedicated print preview with clean A4-ready HTML. */

function buildPrintHtml(opts: {
  title: string;
  bodyHtml: string;
  subtitle?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      font-size: 11px;
      line-height: 1.45;
      color: #111827;
      background: #fff;
    }
    .sheet { max-width: 190mm; margin: 0 auto; padding: 8px 4px 24px; }
    .hdr {
      border-bottom: 2px solid #1e1b4b;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .hdr h1 { margin: 0 0 4px; font-size: 18px; color: #1e1b4b; }
    .hdr .sub { color: #6b7280; font-size: 11px; }
    .section { margin: 0 0 14px; page-break-inside: avoid; }
    .section h2 {
      margin: 0 0 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #1e1b4b;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
    }
    table { width: 100%; border-collapse: collapse; margin: 0 0 6px; }
    th, td {
      border: 1px solid #d1d5db;
      padding: 5px 7px;
      text-align: left;
      vertical-align: top;
      font-size: 10px;
    }
    th { background: #f3f4f6; font-weight: 700; color: #374151; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-bottom: 10px; }
    .meta div { border-bottom: 1px dotted #e5e7eb; padding: 3px 0; }
    .meta span { color: #6b7280; display: block; font-size: 9px; text-transform: uppercase; }
    .meta strong { font-size: 11px; }
    .rag {
      display: inline-block;
      min-width: 18px;
      padding: 1px 6px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 800;
      color: #fff;
      text-align: center;
    }
    .rag-green { background: #059669; }
    .rag-amber { background: #d97706; }
    .rag-red { background: #dc2626; }
    .rag-blue { background: #475569; }
    .pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0; }
    .pill {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 6px 10px;
      min-width: 90px;
      text-align: center;
    }
    .pill .lbl { font-size: 9px; color: #6b7280; text-transform: uppercase; }
    .pill .val { font-size: 13px; font-weight: 800; margin-top: 2px; }
    .box {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 8px 10px;
      white-space: pre-wrap;
      background: #fafafa;
      min-height: 40px;
    }
    ul { margin: 4px 0 0; padding-left: 16px; }
    li { margin: 2px 0; }
    .footer {
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
      color: #9ca3af;
      font-size: 9px;
      text-align: right;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .section { break-inside: avoid; }
    }
    .toolbar {
      position: sticky; top: 0; z-index: 2;
      display: flex; gap: 8px; justify-content: flex-end;
      padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
    }
    .toolbar button {
      border: 1px solid #cbd5e1; background: #fff; border-radius: 8px;
      padding: 7px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
    }
    .toolbar button.primary { background: #1e1b4b; color: #fff; border-color: #1e1b4b; }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" onclick="window.close()">Close</button>
    <button type="button" class="primary" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="sheet">
    <div class="hdr">
      <h1>${escapeHtml(opts.title)}</h1>
      ${opts.subtitle ? `<div class="sub">${escapeHtml(opts.subtitle)}</div>` : ""}
    </div>
    ${opts.bodyHtml}
    <div class="footer">Generated ${escapeHtml(new Date().toLocaleString())} · Jiganto</div>
  </div>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () {
        try { window.focus(); window.print(); } catch (e) {}
      }, 400);
    });
  </script>
</body>
</html>`;
}

export function openReportPrintWindow(opts: {
  title: string;
  bodyHtml: string;
  subtitle?: string;
}): void {
  const html = buildPrintHtml(opts);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  // Blob URL avoids blank about:blank from noopener + document.write
  const w = window.open(url, "_blank");
  if (w) {
    // Revoke later so the tab can finish loading
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  // Popup blocked — fall back to hidden iframe print
  URL.revokeObjectURL(url);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Print preview");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const idoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!idoc) {
    document.body.removeChild(iframe);
    window.alert("Unable to open print preview. Please allow pop-ups for this site.");
    return;
  }

  idoc.open();
  idoc.write(html);
  idoc.close();

  const cleanup = () => {
    try {
      document.body.removeChild(iframe);
    } catch {
      /* ignore */
    }
  };

  const trigger = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(cleanup, 1000);
    }
  };

  // Wait for iframe content to be ready
  if (iframe.contentWindow?.document.readyState === "complete") {
    setTimeout(trigger, 300);
  } else {
    iframe.onload = () => setTimeout(trigger, 300);
  }
}

export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ragClass(rag?: string | null): string {
  const s = (rag || "").toLowerCase();
  if (s.includes("red") || s === "r") return "rag-red";
  if (s.includes("amber") || s.includes("yellow") || s === "a") return "rag-amber";
  if (s.includes("blue") || s === "b") return "rag-blue";
  return "rag-green";
}

export function ragBadge(rag?: string | null, label?: string): string {
  const letter =
    (rag || "").toLowerCase().includes("red") || rag === "r" ? "R"
      : (rag || "").toLowerCase().includes("amber") || rag === "a" ? "A"
        : (rag || "").toLowerCase().includes("blue") || rag === "b" ? "B"
          : "G";
  return `<span class="rag ${ragClass(rag)}">${escapeHtml(label || letter)}</span>`;
}
