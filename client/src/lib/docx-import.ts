/**
 * Enhanced Word (.docx) → HTML conversion.
 *
 * Mammoth drops font colour, font size, cell backgrounds, and column widths.
 * We recover them by reading word/document.xml (JSZip) and applying styles after
 * mammoth conversion — using valid mammoth class mappings (NOT span:style syntax).
 *
 * Flow:
 *  1. Scan XML → ordered runs with colour/size + table cell data
 *  2. Build valid styleMap entries: r[style-name='wd-0'] => span.wd-0
 *  3. transformDocument assigns styleName to coloured/sized runs
 *  4. After mammoth: convert .wd-N classes → inline CSS
 *  5. Apply table backgrounds / column widths
 *  6. Sequential run fallback for text inside <strong> etc.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunStyle {
  color?: string;
  bgColor?: string;
  fontSize?: number;
}

interface RunCombo {
  color?: string;     // uppercase hex without #
  fontSize?: number;  // half-points (w:sz)
  highlight?: string;
}

interface XmlTextRun {
  text: string;
  combo: RunCombo;
}

interface CellStyle {
  bgColor?: string;
  colSpan?: number;
}

interface ParsedTable {
  colWidths: number[];
  rows: CellStyle[][];
}

export interface DocxImportPrep {
  styleMapEntries: string[];
  classStyles: Map<string, string>;
  transformDocument: (doc: unknown) => unknown;
  xmlRuns: XmlTextRun[];
  tables: ParsedTable[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const WORD_HIGHLIGHT_CSS: Record<string, string> = {
  yellow: "#ffff00",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  blue: "#0000ff",
  red: "#ff0000",
  darkBlue: "#00008b",
  darkCyan: "#008b8b",
  darkMagenta: "#8b008b",
  darkRed: "#8b0000",
  darkYellow: "#808000",
  darkGray: "#a9a9a9",
  lightGray: "#d3d3d3",
  green: "#008000",
  white: "#ffffff",
};

function wAttr(el: Element, local: string): string | null {
  return el.getAttributeNS(W_NS, local) ?? el.getAttribute("w:" + local);
}

function wDirectChild(el: Element, local: string): Element | null {
  for (let i = 0; i < el.childNodes.length; i++) {
    const n = el.childNodes[i] as Element;
    if (n.nodeType !== 1) continue;
    if (n.localName === local && (n.namespaceURI === W_NS || n.prefix === "w")) return n;
  }
  return null;
}

function wAll(root: Element | Document, local: string): Element[] {
  return Array.from(root.getElementsByTagNameNS(W_NS, local));
}

function cssHex(hex: string | null | undefined): string | undefined {
  if (!hex) return undefined;
  const v = hex.toLowerCase().trim();
  if (v === "auto" || v === "none") return undefined;
  return "#" + v;
}

function comboKey(c: RunCombo): string {
  return [
    c.color ? `c:${c.color}` : "",
    c.fontSize ? `fs:${c.fontSize}` : "",
    c.highlight ? `hl:${c.highlight}` : "",
  ].filter(Boolean).join("|");
}

function hasVisualStyle(c: RunCombo): boolean {
  return !!(c.color || c.fontSize || c.highlight);
}

function comboToCss(c: RunCombo): string {
  const parts: string[] = [];
  if (c.color) parts.push(`color:#${c.color.toLowerCase()}`);
  if (c.fontSize) parts.push(`font-size:${c.fontSize / 2}pt`);
  if (c.highlight) parts.push(`background-color:${WORD_HIGHLIGHT_CSS[c.highlight]}`);
  return parts.join(";");
}

function comboToRunStyle(c: RunCombo): RunStyle {
  const style: RunStyle = {};
  if (c.color) style.color = `#${c.color.toLowerCase()}`;
  if (c.fontSize) style.fontSize = c.fontSize / 2;
  if (c.highlight) style.bgColor = WORD_HIGHLIGHT_CSS[c.highlight];
  return style;
}

function readRunContent(run: Element): string {
  let text = "";
  for (let i = 0; i < run.childNodes.length; i++) {
    const n = run.childNodes[i] as Element;
    if (n.nodeType !== 1) continue;
    if (n.localName === "t" && (n.namespaceURI === W_NS || n.prefix === "w")) {
      text += n.textContent ?? "";
    } else if (n.localName === "tab" && (n.namespaceURI === W_NS || n.prefix === "w")) {
      text += "\t";
    } else if (n.localName === "br" && (n.namespaceURI === W_NS || n.prefix === "w")) {
      text += "\n";
    }
  }
  return text;
}

function readRunCombo(run: Element): RunCombo {
  const combo: RunCombo = {};
  const rPr = wDirectChild(run, "rPr");
  if (!rPr) return combo;

  const colorEl = wDirectChild(rPr, "color");
  if (colorEl) {
    const v = wAttr(colorEl, "val");
    if (v && v.toLowerCase() !== "auto" && v.toUpperCase() !== "000000") {
      combo.color = v.toUpperCase();
    }
  }

  const szEl = wDirectChild(rPr, "sz");
  if (szEl) {
    const v = parseInt(wAttr(szEl, "val") ?? "0", 10);
    if (v > 0 && v !== 24) combo.fontSize = v;
  }

  const hlEl = wDirectChild(rPr, "highlight");
  if (hlEl) {
    const v = wAttr(hlEl, "val");
    if (v && v !== "none" && WORD_HIGHLIGHT_CSS[v]) combo.highlight = v;
  }

  return combo;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function runHasMark(run: Element, mark: string): boolean {
  const rPr = wDirectChild(run, "rPr");
  if (!rPr) return false;
  const el = wDirectChild(rPr, mark);
  if (!el) return false;
  const val = wAttr(el, "val");
  return val === null || val === "1" || val === "true" || val === "on";
}

function paragraphAlign(p: Element): string | null {
  const pPr = wDirectChild(p, "pPr");
  if (!pPr) return null;
  const jc = wDirectChild(pPr, "jc");
  const val = jc ? wAttr(jc, "val") : null;
  if (val === "center") return "center";
  if (val === "right") return "right";
  if (val === "both") return "justify";
  return null;
}

/** Convert a Word header/footer XML part to simple HTML. */
function xmlPartToHtml(xmlText: string): string {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const parts: string[] = [];

  for (const p of wAll(xmlDoc, "p")) {
    let inner = "";
    for (const run of wAll(p, "r")) {
      const text = readRunContent(run);
      if (!text) continue;
      let wrapped = escapeHtml(text);
      if (runHasMark(run, "b")) wrapped = `<strong>${wrapped}</strong>`;
      if (runHasMark(run, "i")) wrapped = `<em>${wrapped}</em>`;
      if (runHasMark(run, "u")) wrapped = `<u>${wrapped}</u>`;
      inner += wrapped;
    }
    if (!inner.trim()) continue;
    const align = paragraphAlign(p);
    const style = align ? ` style="text-align:${align}"` : "";
    parts.push(`<p${style}>${inner}</p>`);
  }

  return parts.join("");
}

// ---------------------------------------------------------------------------
// XML scan
// ---------------------------------------------------------------------------

function scanDocxXml(xmlText: string): { xmlRuns: XmlTextRun[]; tables: ParsedTable[] } {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const xmlRuns: XmlTextRun[] = [];
  const tables: ParsedTable[] = [];

  for (const run of wAll(xmlDoc, "r")) {
    const text = readRunContent(run);
    if (!text) continue;
    xmlRuns.push({ text, combo: readRunCombo(run) });
  }

  for (const tbl of wAll(xmlDoc, "tbl")) {
    const colWidths: number[] = [];
    const rows: CellStyle[][] = [];

    const grid = wDirectChild(tbl, "tblGrid");
    if (grid) {
      const gridCols = Array.from(grid.childNodes).filter(
        (n): n is Element => (n as Element).nodeType === 1 && (n as Element).localName === "gridCol",
      );
      let totalW = 0;
      const rawW = gridCols.map((gc) => {
        const w = parseInt(wAttr(gc, "w") ?? "0", 10);
        totalW += w;
        return w;
      });
      if (totalW > 0) rawW.forEach((w) => colWidths.push(Math.round((w / totalW) * 100)));
    }

    for (const tr of wAll(tbl, "tr")) {
      const rowCells: CellStyle[] = [];
      for (const tc of wAll(tr, "tc")) {
        const cellStyle: CellStyle = {};
        const tcPr = wDirectChild(tc, "tcPr");
        if (tcPr) {
          const shd = wDirectChild(tcPr, "shd");
          if (shd) cellStyle.bgColor = cssHex(wAttr(shd, "fill"));
          const span = wDirectChild(tcPr, "gridSpan");
          if (span) cellStyle.colSpan = parseInt(wAttr(span, "val") ?? "1", 10);
        }
        rowCells.push(cellStyle);
      }
      rows.push(rowCells);
    }

    tables.push({ colWidths, rows });
  }

  return { xmlRuns, tables };
}

// ---------------------------------------------------------------------------
// Valid mammoth styleMap (CSS classes only)
// ---------------------------------------------------------------------------

function buildStyleMaps(xmlRuns: XmlTextRun[]): {
  styleMapEntries: string[];
  classStyles: Map<string, string>;
  styleNameMap: Map<string, string>;
} {
  const styleMapEntries: string[] = [];
  const classStyles = new Map<string, string>();
  const styleNameMap = new Map<string, string>();
  const seen = new Map<string, string>();
  let idx = 0;

  for (const { combo } of xmlRuns) {
    if (!hasVisualStyle(combo)) continue;
    const key = comboKey(combo);
    if (seen.has(key)) continue;

    const className = `wd-${idx++}`;
    seen.set(key, className);
    styleNameMap.set(key, className);
    classStyles.set(className, comboToCss(combo));
    styleMapEntries.push(`r[style-name='${className}'] => span.${className}`);
  }

  return { styleMapEntries, classStyles, styleNameMap };
}

function mammothRunText(run: { children?: Array<{ type?: string; value?: string }> }): string {
  if (!run.children) return "";
  return run.children.filter((c) => c.type === "text").map((c) => c.value ?? "").join("");
}

function pickDominantCombo(parts: RunCombo[]): RunCombo {
  for (const c of parts) if (c.color) return c;
  for (const c of parts) if (c.fontSize) return c;
  for (const c of parts) if (c.highlight) return c;
  return parts[0] ?? {};
}

function buildTransformDocument(xmlRuns: XmlTextRun[], styleNameMap: Map<string, string>) {
  let xmlIdx = 0;
  let xmlOffset = 0;

  function consumeForMammothText(mammothText: string): RunCombo | null {
    const matched: RunCombo[] = [];
    let consumed = 0;

    while (consumed < mammothText.length && xmlIdx < xmlRuns.length) {
      const xr = xmlRuns[xmlIdx];
      const available = xr.text.slice(xmlOffset);
      const needed = mammothText.slice(consumed);

      if (!available) {
        xmlIdx++;
        xmlOffset = 0;
        continue;
      }

      if (available.startsWith(needed)) {
        if (hasVisualStyle(xr.combo)) matched.push(xr.combo);
        consumed += needed.length;
        xmlOffset += needed.length;
        if (xmlOffset >= xr.text.length) { xmlIdx++; xmlOffset = 0; }
        break;
      }

      if (needed.startsWith(available)) {
        if (hasVisualStyle(xr.combo)) matched.push(xr.combo);
        consumed += available.length;
        xmlIdx++;
        xmlOffset = 0;
        continue;
      }

      xmlIdx++;
      xmlOffset = 0;
    }

    return matched.length > 0 ? pickDominantCombo(matched) : null;
  }

  function transformNode(node: unknown): unknown {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map(transformNode);

    const el = node as Record<string, unknown>;
    const withChildren =
      el.children != null ? { ...el, children: transformNode(el.children) } : el;

    if (withChildren.type !== "run") return withChildren;

    const text = mammothRunText(withChildren as Parameters<typeof mammothRunText>[0]);
    if (!text) return withChildren;

    const combo = consumeForMammothText(text);
    if (!combo || !hasVisualStyle(combo)) return withChildren;

    const styleName = styleNameMap.get(comboKey(combo));
    if (styleName && !withChildren.styleName) {
      return { ...withChildren, styleName };
    }

    return withChildren;
  }

  return transformNode;
}

// ---------------------------------------------------------------------------
// HTML post-processing
// ---------------------------------------------------------------------------

function applyClassStyles(html: string, classStyles: Map<string, string>): string {
  if (classStyles.size === 0) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="__root">${html}</div>`, "text/html");
  const root = doc.getElementById("__root")!;

  classStyles.forEach((css, className) => {
    root.querySelectorAll(`.${className}`).forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.cssText = htmlEl.style.cssText ? `${htmlEl.style.cssText};${css}` : css;
      htmlEl.classList.remove(className);
      if (!htmlEl.classList.length) htmlEl.removeAttribute("class");
    });
  });

  return root.innerHTML;
}

function applyTableStyles(html: string, tables: ParsedTable[]): string {
  if (tables.length === 0) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="__root">${html}</div>`, "text/html");
  const root = doc.getElementById("__root")!;

  root.querySelectorAll("table").forEach((table, tIdx) => {
    const ts = tables[tIdx];
    if (!ts) return;

    if (ts.colWidths.length > 0) {
      const cg = doc.createElement("colgroup");
      ts.colWidths.forEach((pct) => {
        const col = doc.createElement("col");
        col.style.width = `${pct}%`;
        cg.appendChild(col);
      });
      table.insertBefore(cg, table.firstChild);
    }

    (table as HTMLElement).style.tableLayout = "fixed";
    (table as HTMLElement).style.width = "100%";

    table.querySelectorAll("tr").forEach((tr, rIdx) => {
      const rowData = ts.rows[rIdx];
      if (!rowData) return;
      let colOffset = 0;
      tr.querySelectorAll("td, th").forEach((cell) => {
        const cs = rowData[colOffset];
        const htmlCell = cell as HTMLElement;
        if (cs?.bgColor) htmlCell.style.backgroundColor = cs.bgColor;
        colOffset += cs?.colSpan ?? 1;
      });
    });
  });

  return root.innerHTML;
}

/** Fallback: walk text nodes in order and apply styles from XML run queue. */
function applySequentialRunStyles(html: string, xmlRuns: XmlTextRun[]): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="__root">${html}</div>`, "text/html");
  const root = doc.getElementById("__root")!;

  let runIdx = 0;
  let runOffset = 0;

  function wrapStyled(text: string, style: RunStyle): HTMLElement {
    const span = doc.createElement("span");
    const css: string[] = [];
    if (style.color) css.push(`color:${style.color}`);
    if (style.bgColor) css.push(`background-color:${style.bgColor}`);
    if (style.fontSize) css.push(`font-size:${style.fontSize}pt`);
    span.style.cssText = css.join(";");
    span.textContent = text;
    return span;
  }

  function hasInlineColor(el: Node | null): boolean {
    let cur: Node | null = el;
    while (cur && cur !== root) {
      if (cur instanceof HTMLElement && cur.style.color) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  const textNodes: Text[] = [];
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) textNodes.push(n as Text);

  for (const textNode of textNodes) {
    if (hasInlineColor(textNode.parentElement)) continue;

    const fullText = textNode.textContent ?? "";
    if (!fullText) continue;

    let pos = 0;
    const fragments: Node[] = [];

    while (pos < fullText.length && runIdx < xmlRuns.length) {
      const run = xmlRuns[runIdx];
      const available = run.text.slice(runOffset);
      const needed = fullText.slice(pos);
      const style = comboToRunStyle(run.combo);
      const styled = !!(style.color || style.fontSize || style.bgColor);

      if (!available) {
        runIdx++;
        runOffset = 0;
        continue;
      }

      if (needed.startsWith(available)) {
        fragments.push(styled ? wrapStyled(available, style) : doc.createTextNode(available));
        pos += available.length;
        runIdx++;
        runOffset = 0;
      } else if (available.startsWith(needed)) {
        fragments.push(styled ? wrapStyled(needed, style) : doc.createTextNode(needed));
        runOffset += needed.length;
        pos = fullText.length;
      } else {
        runIdx++;
        runOffset = 0;
      }
    }

    if (pos < fullText.length) {
      fragments.push(doc.createTextNode(fullText.slice(pos)));
    }

    if (fragments.length > 0) {
      const parent = textNode.parentNode!;
      fragments.forEach((f) => parent.insertBefore(f, textNode));
      parent.removeChild(textNode);
    }
  }

  return root.innerHTML;
}

export function enhanceImportedDocxHtml(html: string): string {
  let out = html;

  out = out.replace(/<mark(?![^>]*style=)([^>]*)>/gi, '<mark style="background-color:#ffff00"$1>');

  out = out.replace(
    /<table(?![^>]*style=)([^>]*)>/gi,
    '<table style="border-collapse:collapse;width:100%;margin:8px 0"$1>',
  );
  out = out.replace(
    /<td(?![^>]*style=)(\s|>)/gi,
    '<td style="border:1px solid #d1d5db;padding:6px 8px;vertical-align:top"$1',
  );
  out = out.replace(
    /<th(?![^>]*style=)(\s|>)/gi,
    '<th style="border:1px solid #d1d5db;padding:6px 8px;font-weight:600;vertical-align:top"$1',
  );

  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DocxPageRegions {
  headerHtml: string;
  footerHtml: string;
}

const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function relAttr(el: Element, local: string): string | null {
  return el.getAttributeNS(REL_NS, local) ?? el.getAttribute(`r:${local}`);
}

function normalizeZipPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

async function resolveDocxPartPath(
  zip: Awaited<ReturnType<(typeof import("jszip"))["default"]["loadAsync"]>>,
  kind: "header" | "footer",
): Promise<string | null> {
  const tag = kind === "header" ? "headerReference" : "footerReference";
  const pattern = kind === "header" ? /^word\/header\d*\.xml$/i : /^word\/footer\d*\.xml$/i;

  const docXmlFile = zip.file("word/document.xml");
  const relsFile = zip.file("word/_rels/document.xml.rels");
  if (docXmlFile && relsFile) {
    const parser = new DOMParser();
    const docXml = await docXmlFile.async("string");
    const doc = parser.parseFromString(docXml, "text/xml");
    const refs = wAll(doc, tag);

    let chosenRId: string | null = null;
    for (const ref of refs) {
      const rId = relAttr(ref, "id");
      if (!rId) continue;
      const refType = wAttr(ref, "type") ?? "default";
      if (refType === "default") {
        chosenRId = rId;
        break;
      }
      if (!chosenRId) chosenRId = rId;
    }

    if (chosenRId) {
      const relsXml = await relsFile.async("string");
      const relsDoc = parser.parseFromString(relsXml, "text/xml");
      for (const rel of Array.from(relsDoc.getElementsByTagName("Relationship"))) {
        if (rel.getAttribute("Id") !== chosenRId) continue;
        const target = rel.getAttribute("Target");
        if (!target) break;
        const path = normalizeZipPath(
          target.startsWith("word/") ? target : `word/${target.replace(/^\.\//, "")}`,
        );
        if (zip.file(path)) return path;
      }
    }
  }

  const paths = Object.keys(zip.files).sort();
  for (const path of paths) {
    if (pattern.test(path)) return path;
  }
  return null;
}

/** Extract default header/footer HTML from a .docx file. */
export async function extractDocxHeaderFooter(arrayBuffer: ArrayBuffer): Promise<DocxPageRegions> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(arrayBuffer);
    let headerHtml = "";
    let footerHtml = "";

    const headerPath = await resolveDocxPartPath(zip, "header");
    const footerPath = await resolveDocxPartPath(zip, "footer");

    if (headerPath) {
      const file = zip.file(headerPath);
      if (file) headerHtml = xmlPartToHtml(await file.async("string"));
    }
    if (footerPath) {
      const file = zip.file(footerPath);
      if (file) footerHtml = xmlPartToHtml(await file.async("string"));
    }

    return { headerHtml, footerHtml };
  } catch (err) {
    console.warn("[docx-import] Header/footer extraction failed:", err);
    return { headerHtml: "", footerHtml: "" };
  }
}

export async function prepareDocxImport(
  arrayBuffer: ArrayBuffer,
): Promise<DocxImportPrep | null> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file("word/document.xml");
    if (!docXmlFile) return null;

    const xmlText = await docXmlFile.async("string");
    const { xmlRuns, tables } = scanDocxXml(xmlText);
    const { styleMapEntries, classStyles, styleNameMap } = buildStyleMaps(xmlRuns);
    const transformDocument = buildTransformDocument(xmlRuns, styleNameMap);

    return { styleMapEntries, classStyles, transformDocument, xmlRuns, tables };
  } catch (err) {
    console.warn("[docx-import] Prep failed:", err);
    return null;
  }
}

export function applyDocxStyles(html: string, prep: DocxImportPrep | null): string {
  if (!prep) return enhanceImportedDocxHtml(html);

  let out = applyClassStyles(html, prep.classStyles);
  out = applyTableStyles(out, prep.tables);
  out = applySequentialRunStyles(out, prep.xmlRuns);
  return enhanceImportedDocxHtml(out);
}

/** @deprecated use prepareDocxImport */
export async function extractDocxStyles(arrayBuffer: ArrayBuffer) {
  const prep = await prepareDocxImport(arrayBuffer);
  if (!prep) return null;
  return {
    runs: prep.xmlRuns.map((r) => ({ text: r.text, style: comboToRunStyle(r.combo) })),
    tables: prep.tables,
  };
}

export const DOCX_MAMMOTH_STYLE_MAP = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Title'] => h1.document-title:fresh",
  "p[style-name='Subtitle'] => h2.document-subtitle:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote.intense:fresh",
  "p[style-name='List Paragraph'] => p.list-paragraph",
  "r[style-name='Strong'] => strong",
  "r[style-name='Emphasis'] => em",
  "b => strong",
  "i => em",
  "u => u",
  "strike => s",
  "highlight => mark",
  "p.Highlight => p.highlight",
];

/** Mammoth warnings that are harmless — hide from Conversion Notes UI. */
export function isIgnorableMammothWarning(message: string): boolean {
  return message.includes("w:tblPrEx") || message.includes("unrecognised element was ignored");
}
