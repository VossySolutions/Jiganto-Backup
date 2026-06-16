import { eq } from "drizzle-orm";
import { db } from "../db";
import { signoffSignatureFields, type SignoffSignatureField } from "@shared/models/signoff";

export type FieldInput = {
  signerEmail: string;
  fieldType: string;
  pageNumber?: number;
  xPercent?: string | number;
  yPercent?: string | number;
  widthPercent?: string | number;
  heightPercent?: string | number;
  isRequired?: boolean;
  label?: string;
};

export async function listFields(requestId: number): Promise<SignoffSignatureField[]> {
  return db.select().from(signoffSignatureFields)
    .where(eq(signoffSignatureFields.requestId, requestId));
}

export async function replaceFields(requestId: number, fields: FieldInput[]) {
  await db.delete(signoffSignatureFields).where(eq(signoffSignatureFields.requestId, requestId));
  if (!fields.length) return [];
  const rows = await db.insert(signoffSignatureFields).values(
    fields.map(f => ({
      requestId,
      signerEmail: f.signerEmail.toLowerCase(),
      fieldType: f.fieldType,
      pageNumber: f.pageNumber ?? 1,
      xPercent: String(f.xPercent ?? 10),
      yPercent: String(f.yPercent ?? 80),
      widthPercent: String(f.widthPercent ?? 25),
      heightPercent: String(f.heightPercent ?? 8),
      isRequired: f.isRequired !== false,
      label: f.label ?? null,
    })),
  ).returning();
  return rows;
}

export async function completeFieldsForSigner(
  requestId: number,
  signerEmail: string,
  values: Record<number, string>,
) {
  const fields = await listFields(requestId);
  const mine = fields.filter(f => f.signerEmail.toLowerCase() === signerEmail.toLowerCase());
  for (const f of mine) {
    const val = values[f.id];
    if (f.isRequired && !val?.trim()) {
      throw new Error(`Required field "${f.label || f.fieldType}" is incomplete`);
    }
    if (val) {
      await db.update(signoffSignatureFields).set({
        value: val,
        completedAt: new Date(),
      }).where(eq(signoffSignatureFields.id, f.id));
    }
  }
}
