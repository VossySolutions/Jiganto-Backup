import { jsPDF } from "jspdf";
import type { FinanceInvoice, FinanceInvoiceLine } from "@shared/schema";

export function generateInvoicePdf(
  invoice: FinanceInvoice,
  lines: FinanceInvoiceLine[],
  orgName: string,
  orgAddress?: string | null,
  bankDetails?: string | null,
  clientName?: string,
): Buffer {
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(18);
  doc.text(orgName, 20, y);
  y += 8;
  doc.setFontSize(10);
  if (orgAddress) {
    orgAddress.split("\n").forEach((line) => { y += 5; doc.text(line, 20, y); });
  }
  y += 15;

  doc.setFontSize(16);
  doc.text("INVOICE", 140, 25);
  doc.setFontSize(10);
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, 140, 35);
  doc.text(`Issue Date: ${invoice.issueDate}`, 140, 42);
  doc.text(`Due Date: ${invoice.dueDate}`, 140, 49);
  doc.text(`Status: ${invoice.status}`, 140, 56);

  y += 10;
  doc.text(`Bill To: ${clientName ?? "Client"}`, 20, y);
  y += 15;

  doc.setFontSize(9);
  doc.text("Description", 20, y);
  doc.text("Qty", 110, y);
  doc.text("Rate", 130, y);
  doc.text("Amount", 165, y);
  y += 5;
  doc.line(20, y, 190, y);
  y += 7;

  for (const line of lines) {
    const desc = line.description.length > 50 ? line.description.slice(0, 47) + "..." : line.description;
    doc.text(desc, 20, y);
    doc.text(String(line.quantity ?? 1), 110, y);
    doc.text(`${invoice.currency} ${line.unitRate ?? 0}`, 130, y);
    doc.text(`${invoice.currency} ${line.amount}`, 165, y);
    y += 7;
    if (y > 260) { doc.addPage(); y = 20; }
  }

  y += 10;
  doc.text(`Subtotal: ${invoice.currency} ${invoice.subtotal}`, 130, y); y += 6;
  if (parseFloat(String(invoice.discountAmount)) > 0) {
    doc.text(`Discount: -${invoice.currency} ${invoice.discountAmount}`, 130, y); y += 6;
  }
  if (parseFloat(String(invoice.taxAmount)) > 0) {
    doc.text(`Tax: ${invoice.currency} ${invoice.taxAmount}`, 130, y); y += 6;
  }
  doc.setFontSize(11);
  doc.text(`TOTAL: ${invoice.currency} ${invoice.total}`, 130, y);
  y += 15;

  if (bankDetails) {
    doc.setFontSize(9);
    doc.text("Payment Details:", 20, y); y += 6;
    bankDetails.split("\n").forEach((line) => { doc.text(line, 20, y); y += 5; });
  }

  if (invoice.poNumber) {
    y += 5;
    doc.text(`PO Number: ${invoice.poNumber}`, 20, y);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
