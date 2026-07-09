/** Client-side Word (.docx) export with page header/footer and Tahoma font. */

const DOCUMENT_DOCX_FONT = "Tahoma";

type DocxModule = typeof import("docx");

function makeTextRun(
  DocxTextRun: DocxModule["TextRun"],
  opts: { text: string; bold?: boolean; italics?: boolean; underline?: boolean; font?: string; size?: number },
) {
  return new DocxTextRun({
    font: opts.font ?? DOCUMENT_DOCX_FONT,
    text: opts.text,
    bold: opts.bold,
    italics: opts.italics,
    underline: opts.underline ? {} : undefined,
    size: opts.size,
  });
}

function getAlignment(
  el: Element,
  AlignmentType: DocxModule["AlignmentType"],
): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const style = (el as HTMLElement).style?.textAlign || el.getAttribute("data-text-align") || "";
  if (style === "center") return AlignmentType.CENTER;
  if (style === "right") return AlignmentType.RIGHT;
  if (style === "justify") return AlignmentType.JUSTIFIED;
  return undefined;
}

function parseChildren(el: Element, DocxTextRun: DocxModule["TextRun"], size?: number): InstanceType<DocxModule["TextRun"]>[] {
  const runs: InstanceType<DocxModule["TextRun"]>[] = [];
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text) runs.push(makeTextRun(DocxTextRun, { text, size }));
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const n = node as Element;
      const tag = n.tagName.toLowerCase();
      const innerText = n.textContent || "";
      if (tag === "strong" || tag === "b") runs.push(makeTextRun(DocxTextRun, { text: innerText, bold: true, size }));
      else if (tag === "em" || tag === "i") runs.push(makeTextRun(DocxTextRun, { text: innerText, italics: true, size }));
      else if (tag === "u") runs.push(makeTextRun(DocxTextRun, { text: innerText, underline: true, size }));
      else if (tag === "code") runs.push(makeTextRun(DocxTextRun, { text: innerText, font: "Courier New", size }));
      else runs.push(...parseChildren(n, DocxTextRun, size));
    }
  });
  return runs;
}

function htmlToDocxParagraphs(
  html: string,
  DocxParagraph: DocxModule["Paragraph"],
  DocxTextRun: DocxModule["TextRun"],
  HeadingLevel: DocxModule["HeadingLevel"],
  _BorderStyle: DocxModule["BorderStyle"],
  AlignmentType: DocxModule["AlignmentType"],
  size?: number,
): InstanceType<DocxModule["Paragraph"]>[] {
  const trimmed = html.trim();
  if (!trimmed) return [];

  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = trimmed;
  const paragraphs: InstanceType<DocxModule["Paragraph"]>[] = [];

  const parseNode = (node: Element) => {
    const tag = node.tagName?.toLowerCase();
    if (!tag) return;
    const alignment = getAlignment(node, AlignmentType);
    if (tag === "h1") paragraphs.push(new DocxParagraph({ children: parseChildren(node, DocxTextRun, size), heading: HeadingLevel.HEADING_1, alignment }));
    else if (tag === "h2") paragraphs.push(new DocxParagraph({ children: parseChildren(node, DocxTextRun, size), heading: HeadingLevel.HEADING_2, alignment }));
    else if (tag === "h3") paragraphs.push(new DocxParagraph({ children: parseChildren(node, DocxTextRun, size), heading: HeadingLevel.HEADING_3, alignment }));
    else if (tag === "h4") paragraphs.push(new DocxParagraph({ children: parseChildren(node, DocxTextRun, size), heading: HeadingLevel.HEADING_4, alignment }));
    else if (tag === "p" || tag === "div") {
      const children = parseChildren(node, DocxTextRun, size);
      if (children.length) paragraphs.push(new DocxParagraph({ children, alignment }));
      else if (node.textContent?.trim()) {
        paragraphs.push(new DocxParagraph({ children: [makeTextRun(DocxTextRun, { text: node.textContent.trim(), size })], alignment }));
      }
    } else if (tag === "ul" || tag === "ol") {
      node.querySelectorAll("li").forEach((li) => {
        paragraphs.push(new DocxParagraph({
          children: [makeTextRun(DocxTextRun, { text: li.textContent || "", size })],
          bullet: { level: 0 },
        }));
      });
    } else if (tag === "blockquote") {
      paragraphs.push(new DocxParagraph({
        children: [makeTextRun(DocxTextRun, { text: node.textContent || "", italics: true, size })],
        indent: { left: 720 },
      }));
    } else {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) parseNode(child as Element);
      });
    }
  };

  tempDiv.childNodes.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) parseNode(child as Element);
  });

  if (!paragraphs.length && tempDiv.textContent?.trim()) {
    paragraphs.push(new DocxParagraph({
      children: [makeTextRun(DocxTextRun, { text: tempDiv.textContent.trim() })],
    }));
  }

  return paragraphs;
}

function parseBodyToDocxChildren(
  contentHtml: string,
  DocxParagraph: DocxModule["Paragraph"],
  DocxTextRun: DocxModule["TextRun"],
  DocxTable: DocxModule["Table"],
  DocxTableRow: DocxModule["TableRow"],
  DocxTableCell: DocxModule["TableCell"],
  HeadingLevel: DocxModule["HeadingLevel"],
  WidthType: DocxModule["WidthType"],
  BorderStyle: DocxModule["BorderStyle"],
  AlignmentType: DocxModule["AlignmentType"],
  bodySize?: number,
): InstanceType<DocxModule["Paragraph"] | DocxModule["Table"]>[] {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = contentHtml;
  const docChildren: InstanceType<DocxModule["Paragraph"] | DocxModule["Table"]>[] = [];

  const parseNode = (node: Element) => {
    const tag = node.tagName?.toLowerCase();
    if (!tag) return;
    const alignment = getAlignment(node, AlignmentType);
    if (tag === "h1") docChildren.push(new DocxParagraph({ children: parseChildren(node, DocxTextRun), heading: HeadingLevel.HEADING_1, alignment }));
    else if (tag === "h2") docChildren.push(new DocxParagraph({ children: parseChildren(node, DocxTextRun), heading: HeadingLevel.HEADING_2, alignment }));
    else if (tag === "h3") docChildren.push(new DocxParagraph({ children: parseChildren(node, DocxTextRun), heading: HeadingLevel.HEADING_3, alignment }));
    else if (tag === "h4") docChildren.push(new DocxParagraph({ children: parseChildren(node, DocxTextRun), heading: HeadingLevel.HEADING_4, alignment }));
    else if (tag === "p" || tag === "div") {
      const callout = node.getAttribute("data-callout");
      const text = node.textContent || "";
      if (callout) {
        docChildren.push(new DocxParagraph({
          children: [makeTextRun(DocxTextRun, { text: `[${callout.toUpperCase()}] ${text}`, bold: true, size: bodySize })],
          border: { left: { color: callout === "info" ? "3b82f6" : callout === "warning" ? "f59e0b" : callout === "success" ? "22c55e" : "ef4444", size: 12, style: BorderStyle.SINGLE } },
        }));
      } else {
        const children = parseChildren(node, DocxTextRun, bodySize);
        if (children.length) docChildren.push(new DocxParagraph({ children, alignment }));
      }
    } else if (tag === "ul" || tag === "ol") {
      node.querySelectorAll("li").forEach((li) => {
        docChildren.push(new DocxParagraph({
          children: [makeTextRun(DocxTextRun, { text: li.textContent || "", size: bodySize })],
          bullet: { level: 0 },
        }));
      });
    } else if (tag === "table") {
      const rows: InstanceType<DocxModule["TableRow"]>[] = [];
      node.querySelectorAll("tr").forEach((tr) => {
        const cells: InstanceType<DocxModule["TableCell"]>[] = [];
        tr.querySelectorAll("td, th").forEach((td) => {
          const isHeader = td.tagName.toLowerCase() === "th";
          cells.push(new DocxTableCell({
            children: [new DocxParagraph({ children: parseChildren(td as Element, DocxTextRun, bodySize) })],
            shading: isHeader ? { fill: "E5E7EB" } : undefined,
          }));
        });
        if (cells.length) rows.push(new DocxTableRow({ children: cells }));
      });
      if (rows.length) {
        docChildren.push(new DocxTable({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      }
    } else if (tag === "blockquote") {
      docChildren.push(new DocxParagraph({
        children: [makeTextRun(DocxTextRun, { text: node.textContent || "", size: bodySize })],
        indent: { left: 720 },
      }));
    } else {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) parseNode(child as Element);
      });
    }
  };

  tempDiv.childNodes.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) parseNode(child as Element);
  });

  return docChildren;
}

/** Default body font size (points) used when no override is supplied. */
const DOCUMENT_DOCX_DEFAULT_BODY_SIZE_PT = 11;

export async function buildDocumentDocxBlob(opts: {
  title: string;
  contentHtml: string;
  headerHtml?: string;
  footerHtml?: string;
  /** Body text size in points (default 11pt). Headings scale proportionally; header/footer text stays smaller. */
  bodyFontSizePt?: number;
}): Promise<Blob> {
  const {
    Document: DocxDocument,
    Packer,
    Paragraph: DocxParagraph,
    TextRun: DocxTextRun,
    HeadingLevel,
    Table: DocxTable,
    TableRow: DocxTableRow,
    TableCell: DocxTableCell,
    WidthType,
    BorderStyle,
    AlignmentType,
    Header,
    Footer,
  } = await import("docx");

  const bodyFontSizePt = opts.bodyFontSizePt && opts.bodyFontSizePt > 0 ? opts.bodyFontSizePt : DOCUMENT_DOCX_DEFAULT_BODY_SIZE_PT;
  const scale = bodyFontSizePt / DOCUMENT_DOCX_DEFAULT_BODY_SIZE_PT;
  const bodySizeHalfPt = Math.round(bodyFontSizePt * 2);
  const heading1SizeHalfPt = Math.round(32 * scale);
  const heading2SizeHalfPt = Math.round(28 * scale);
  const heading3SizeHalfPt = Math.round(24 * scale);
  const titleSizeHalfPt = Math.round(36 * scale);
  const headerFooterSizeHalfPt = 18; // fixed 9pt — header/footer stay smaller than body regardless of body size

  const bodyChildren = parseBodyToDocxChildren(
    opts.contentHtml,
    DocxParagraph,
    DocxTextRun,
    DocxTable,
    DocxTableRow,
    DocxTableCell,
    HeadingLevel,
    WidthType,
    BorderStyle,
    AlignmentType,
    bodySizeHalfPt,
  );

  const headerParagraphs = htmlToDocxParagraphs(
    opts.headerHtml ?? "",
    DocxParagraph,
    DocxTextRun,
    HeadingLevel,
    BorderStyle,
    AlignmentType,
    headerFooterSizeHalfPt,
  );
  const footerParagraphs = htmlToDocxParagraphs(
    opts.footerHtml ?? "",
    DocxParagraph,
    DocxTextRun,
    HeadingLevel,
    BorderStyle,
    AlignmentType,
    headerFooterSizeHalfPt,
  );

  const doc = new DocxDocument({
    styles: {
      default: {
        document: {
          run: {
            font: DOCUMENT_DOCX_FONT,
            size: bodySizeHalfPt,
          },
        },
        heading1: { run: { font: DOCUMENT_DOCX_FONT, size: heading1SizeHalfPt, bold: true } },
        heading2: { run: { font: DOCUMENT_DOCX_FONT, size: heading2SizeHalfPt, bold: true } },
        heading3: { run: { font: DOCUMENT_DOCX_FONT, size: heading3SizeHalfPt, bold: true } },
        title: { run: { font: DOCUMENT_DOCX_FONT, size: titleSizeHalfPt, bold: true } },
      },
    },
    sections: [{
      properties: {},
      headers: headerParagraphs.length
        ? { default: new Header({ children: headerParagraphs }) }
        : undefined,
      footers: footerParagraphs.length
        ? { default: new Footer({ children: footerParagraphs }) }
        : undefined,
      children: [
        new DocxParagraph({
          children: [makeTextRun(DocxTextRun, { text: opts.title, bold: true })],
          heading: HeadingLevel.TITLE,
        }),
        ...bodyChildren,
      ],
    }],
  });

  return Packer.toBlob(doc);
}
