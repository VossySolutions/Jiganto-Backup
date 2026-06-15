export async function exportDocument(
  format: "pdf" | "html" | "markdown" | "docx",
  title: string,
  content: string,
): Promise<void> {
  const safeTitle = title || "workspace-document";
  const filename = safeTitle.replace(/[^a-z0-9]/gi, "_");

  const htmlStyles = `
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f5f5f5; font-weight: 600; }
    ul, ol { padding-left: 1.5em; }
    blockquote { border-left: 4px solid #ddd; margin: 1em 0; padding-left: 1em; font-style: italic; }
    code { background-color: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
    pre { background-color: #f5f5f5; padding: 1em; border-radius: 6px; overflow-x: auto; }
    pre code { background-color: transparent; padding: 0; }
    img { max-width: 100%; height: auto; }
    mark { background-color: #fff3a3; }
    [data-callout="info"] { border-left: 4px solid #3b82f6; background: #eff6ff; border-radius: 6px; padding: 12px 16px; margin: 8px 0; }
    [data-callout="warning"] { border-left: 4px solid #f59e0b; background: #fffbeb; border-radius: 6px; padding: 12px 16px; margin: 8px 0; }
    [data-callout="success"] { border-left: 4px solid #22c55e; background: #f0fdf4; border-radius: 6px; padding: 12px 16px; margin: 8px 0; }
    [data-callout="danger"] { border-left: 4px solid #ef4444; background: #fef2f2; border-radius: 6px; padding: 12px 16px; margin: 8px 0; }
  `;

  if (format === "pdf") {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(
      `<!DOCTYPE html><html><head><title>${safeTitle}</title><style>${htmlStyles}</style></head><body><h1>${safeTitle}</h1><div class="content">${content}</div></body></html>`,
    );
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
    return;
  }

  if (format === "docx") {
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
    } = await import("docx");

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content;

    const parseChildren = (el: Element): InstanceType<typeof DocxTextRun>[] => {
      const runs: InstanceType<typeof DocxTextRun>[] = [];
      el.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || "";
          if (text) runs.push(new DocxTextRun({ text }));
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const child = node as Element;
          const tag = child.tagName.toLowerCase();
          const text = child.textContent || "";
          if (tag === "strong" || tag === "b") runs.push(new DocxTextRun({ text, bold: true }));
          else if (tag === "em" || tag === "i") runs.push(new DocxTextRun({ text, italics: true }));
          else if (tag === "u") runs.push(new DocxTextRun({ text, underline: {} }));
          else if (tag === "code") runs.push(new DocxTextRun({ text, font: "Courier New" }));
          else runs.push(...parseChildren(child));
        }
      });
      return runs;
    };

    const children: any[] = [
      new DocxParagraph({ text: safeTitle, heading: HeadingLevel.TITLE }),
    ];

    const parseNode = (node: Element) => {
      const tag = node.tagName.toLowerCase();
      if (tag === "h1") children.push(new DocxParagraph({ children: parseChildren(node), heading: HeadingLevel.HEADING_1 }));
      else if (tag === "h2") children.push(new DocxParagraph({ children: parseChildren(node), heading: HeadingLevel.HEADING_2 }));
      else if (tag === "h3") children.push(new DocxParagraph({ children: parseChildren(node), heading: HeadingLevel.HEADING_3 }));
      else if (tag === "h4") children.push(new DocxParagraph({ children: parseChildren(node), heading: HeadingLevel.HEADING_4 }));
      else if (tag === "p" || tag === "div") {
        const callout = node.getAttribute("data-callout");
        const text = node.textContent || "";
        if (callout) {
          children.push(
            new DocxParagraph({
              children: [new DocxTextRun({ text: `[${callout.toUpperCase()}] ${text}`, bold: true })],
              border: {
                left: {
                  color:
                    callout === "info"
                      ? "3b82f6"
                      : callout === "warning"
                        ? "f59e0b"
                        : callout === "success"
                          ? "22c55e"
                          : "ef4444",
                  size: 12,
                  style: BorderStyle.SINGLE,
                },
              },
            }),
          );
        } else {
          children.push(new DocxParagraph({ children: parseChildren(node) }));
        }
      } else if (tag === "ul" || tag === "ol") {
        node.querySelectorAll("li").forEach((item) => {
          children.push(new DocxParagraph({ text: item.textContent || "", bullet: { level: 0 } }));
        });
      } else if (tag === "table") {
        const rows: InstanceType<typeof DocxTableRow>[] = [];
        node.querySelectorAll("tr").forEach((tr) => {
          const cells: InstanceType<typeof DocxTableCell>[] = [];
          tr.querySelectorAll("td, th").forEach((cell) => {
            const isHeader = cell.tagName.toLowerCase() === "th";
            cells.push(
              new DocxTableCell({
                children: [new DocxParagraph({ children: parseChildren(cell as Element) })],
                shading: isHeader ? { fill: "E5E7EB" } : undefined,
              }),
            );
          });
          if (cells.length) rows.push(new DocxTableRow({ children: cells }));
        });
        if (rows.length) {
          children.push(
            new DocxTable({
              rows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            }),
          );
        }
      } else if (tag === "blockquote") {
        children.push(new DocxParagraph({ text: node.textContent || "", indent: { left: 720 } }));
      } else {
        node.childNodes.forEach((child) => {
          if (child.nodeType === Node.ELEMENT_NODE) parseNode(child as Element);
        });
      }
    };

    tempDiv.childNodes.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) parseNode(child as Element);
    });

    const doc = new DocxDocument({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, `${filename}.docx`);
    return;
  }

  if (format === "html") {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>${safeTitle}</title>
  <style>${htmlStyles}</style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <div class="content">${content}</div>
</body>
</html>`;
    downloadBlob(new Blob([html], { type: "text/html" }), `${filename}.html`);
    return;
  }

  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = content;
  const markdown = `# ${safeTitle}\n\n${htmlToMarkdown(tempDiv).trim()}\n`;
  downloadBlob(new Blob([markdown], { type: "text/markdown" }), `${filename}.md`);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function htmlToMarkdown(el: Element | null): string {
  if (!el) return "";
  let markdown = "";
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      markdown += node.textContent || "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const child = node as Element;
    const tag = child.tagName.toLowerCase();
    const inner = htmlToMarkdown(child);
    if (tag === "h1") markdown += `\n# ${inner}\n`;
    else if (tag === "h2") markdown += `\n## ${inner}\n`;
    else if (tag === "h3") markdown += `\n### ${inner}\n`;
    else if (tag === "h4") markdown += `\n#### ${inner}\n`;
    else if (tag === "p") markdown += `\n${inner}\n`;
    else if (tag === "strong" || tag === "b") markdown += `**${inner}**`;
    else if (tag === "em" || tag === "i") markdown += `_${inner}_`;
    else if (tag === "code" && child.closest("pre")) markdown += inner;
    else if (tag === "code") markdown += `\`${inner}\``;
    else if (tag === "pre") markdown += `\n\`\`\`\n${inner}\n\`\`\`\n`;
    else if (tag === "blockquote") markdown += `\n> ${inner.trim()}\n`;
    else if (tag === "li") markdown += `- ${inner}\n`;
    else if (tag === "ul" || tag === "ol") markdown += `\n${inner}`;
    else if (tag === "br") markdown += "\n";
    else if (tag === "hr") markdown += "\n---\n";
    else if (tag === "a") markdown += `[${inner}](${child.getAttribute("href") || ""})`;
    else if (tag === "img") markdown += `![${child.getAttribute("alt") || ""}](${child.getAttribute("src") || ""})`;
    else if (child.getAttribute("data-callout")) markdown += `\n> **${child.getAttribute("data-callout")?.toUpperCase()}:** ${inner.trim()}\n`;
    else markdown += inner;
  });
  return markdown;
}
