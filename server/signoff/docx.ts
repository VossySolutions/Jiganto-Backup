import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Convert DOCX buffer to PDF base64 for inline signing preview (spec §3.1). */
export async function convertDocxBufferToPdfBase64(buffer: Buffer, title: string): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({ buffer });
  const text = stripHtml(result.value || "");
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let y = 800;
  page.drawText(title, { x: 50, y, size: 16, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= 28;
  const lines = text.match(/.{1,90}(\s|$)/g) || [text];
  for (const line of lines) {
    if (y < 60) {
      const p = pdfDoc.addPage([595, 842]);
      y = 800;
      p.drawText(line.trim(), { x: 50, y, size: 10, font, color: rgb(0.15, 0.15, 0.15) });
      y -= 14;
      continue;
    }
    page.drawText(line.trim(), { x: 50, y, size: 10, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 14;
  }
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes).toString("base64");
}
