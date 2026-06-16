import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { SignoffAuditLog, SignoffRequestWithDetails, SignoffSigner, SignoffSignatureField } from "@shared/models/signoff";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function fmtDateTime(d?: Date | string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    + " " + dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const EVENT_LABELS: Record<string, string> = {
  created: "Document created",
  sent: "Document sent",
  viewed: "Signer viewed document",
  signed: "Signer signed",
  declined: "Signer declined",
  reminder_sent: "Reminder sent",
  signer_added: "Signer added",
  signer_removed: "Signer removed",
  voided: "Document voided",
  completed: "Document completed",
  expired: "Document expired",
  pdf_sent: "Completed PDF sent",
  qtsp_timestamp: "QTSP timestamp applied",
};

async function embedSignatureImage(pdfDoc: PDFDocument, dataUrl: string): Promise<Awaited<ReturnType<typeof pdfDoc.embedPng>> | null> {
  try {
    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const bytes = Buffer.from(base64, "base64");
    if (dataUrl.includes("image/png") || dataUrl.startsWith("data:image/png")) {
      return pdfDoc.embedPng(bytes);
    }
    return pdfDoc.embedJpg(bytes);
  } catch {
    return null;
  }
}

async function embedPlacedFields(
  pdfDoc: PDFDocument,
  fields: SignoffSignatureField[],
  signers: SignoffSigner[],
) {
  if (!fields.length) return;
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const field of fields) {
    if (!field.value && !field.completedAt) continue;
    const pageIdx = Math.max(0, Math.min((field.pageNumber || 1) - 1, pages.length - 1));
    const page = pages[pageIdx];
    const { width, height } = page.getSize();
    const x = (parseFloat(field.xPercent) / 100) * width;
    const y = height - (parseFloat(field.yPercent) / 100) * height - (parseFloat(field.heightPercent) / 100) * height;
    const w = (parseFloat(field.widthPercent) / 100) * width;
    const h = (parseFloat(field.heightPercent) / 100) * height;

    const signer = signers.find(s => s.email.toLowerCase() === field.signerEmail.toLowerCase());
    let display = field.value || "";

    if (field.fieldType === "signature" && signer?.signatureData && signer.signatureMethod !== "type") {
      const img = await embedSignatureImage(pdfDoc, signer.signatureData);
      if (img) {
        const scale = Math.min(w / img.width, h / img.height);
        page.drawImage(img, { x, y, width: img.width * scale, height: img.height * scale });
        continue;
      }
      display = signer.signatureName || display;
    } else if (field.fieldType === "signature" && signer?.signatureName) {
      page.drawText(signer.signatureName, { x, y: y + h / 3, size: Math.min(14, h * 0.5), font: bold, color: rgb(0.1, 0.2, 0.5) });
      continue;
    }

    if (display) {
      page.drawText(display.slice(0, 80), { x, y: y + h / 3, size: Math.min(11, h * 0.45), font, color: rgb(0.15, 0.15, 0.15) });
    }
  }
}

export async function generateSignedPdf(request: SignoffRequestWithDetails): Promise<Buffer> {
  let pdfDoc: PDFDocument;

  if (request.fileType === "pdf" && request.fileData) {
    const original = Buffer.from(request.fileData, "base64");
    pdfDoc = await PDFDocument.load(original);
  } else {
    pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    let y = 800;
    page.drawText(request.title, { x: 50, y, size: 18, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 30;
    const content = request.contentHtml
      ? stripHtml(request.contentHtml)
      : request.sourceDocument?.content
        ? stripHtml(request.sourceDocument.content)
        : request.fileName || "Document content";
    const lines = content.match(/.{1,90}(\s|$)/g) || [content];
    for (const line of lines.slice(0, 40)) {
      if (y < 80) break;
      page.drawText(line.trim(), { x: 50, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 14;
    }
  }

  if (request.signatureFields?.length) {
    await embedPlacedFields(pdfDoc, request.signatureFields, request.signers);
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Signature blocks page
  let sigPage = pdfDoc.addPage([595, 842]);
  let y = 780;
  sigPage.drawText("Electronic Signatures", { x: 50, y, size: 16, font: bold });
  y -= 30;

  for (const signer of request.signers.filter(s => s.status === "signed")) {
    if (y < 120) {
      sigPage = pdfDoc.addPage([595, 842]);
      y = 780;
    }
    sigPage.drawText(signer.name, { x: 50, y, size: 12, font: bold });
    y -= 16;
    if (signer.roleTitle) {
      sigPage.drawText(signer.roleTitle, { x: 50, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
      y -= 14;
    }
    if (signer.signatureData && signer.signatureMethod !== "type") {
      const img = await embedSignatureImage(pdfDoc, signer.signatureData);
      if (img) {
        const scale = Math.min(180 / img.width, 50 / img.height);
        sigPage.drawImage(img, { x: 50, y: y - 50, width: img.width * scale, height: img.height * scale });
        y -= 60;
      }
    } else if (signer.signatureName) {
      sigPage.drawText(signer.signatureName, { x: 50, y, size: 14, font: bold, color: rgb(0.1, 0.2, 0.5) });
      y -= 20;
    }
    sigPage.drawText(`Signed: ${fmtDateTime(signer.signedAt)} · Method: ${signer.signatureMethod || "type"} · IP: ${signer.ipAddress || "—"}`, {
      x: 50, y, size: 8, font, color: rgb(0.5, 0.5, 0.5),
    });
    y -= 24;
  }

  // Audit trail page
  let auditPage = pdfDoc.addPage([595, 842]);
  y = 780;
  auditPage.drawText("Audit Trail — Tamper-Evident Record", { x: 50, y, size: 14, font: bold });
  y -= 10;
  auditPage.drawText(`Document: ${request.title} · Request #${request.id}`, { x: 50, y: y - 10, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 30;

  const auditRows = request.auditLog.length ? request.auditLog : [];
  for (const ev of auditRows) {
    if (y < 60) {
      auditPage = pdfDoc.addPage([595, 842]);
      y = 780;
    }
    const label = EVENT_LABELS[ev.event] || ev.event;
    auditPage.drawText(fmtDateTime(ev.createdAt), { x: 50, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    auditPage.drawText(label, { x: 140, y, size: 9, font: bold });
    y -= 12;
    const detail = [ev.actorName !== "System" ? ev.actorName : null, ev.ipAddress ? `IP ${ev.ipAddress}` : null]
      .filter(Boolean).join(" · ");
    if (detail) {
      auditPage.drawText(detail, { x: 140, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
      y -= 12;
    }
    y -= 4;
  }

  auditPage.drawText(`Generated ${fmtDateTime(new Date())} · Jiganto e-Sign`, {
    x: 50, y: 40, size: 8, font, color: rgb(0.6, 0.6, 0.6),
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function generateAuditPdf(request: SignoffRequestWithDetails): Promise<Buffer> {
  const emptySigners = { ...request, signers: [] as SignoffSigner[], auditLog: request.auditLog };
  return generateSignedPdf(emptySigners);
}
