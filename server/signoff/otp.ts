import crypto from "crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db";
import { signoffOtpCodes, signoffSigners } from "@shared/models/signoff";
import { tenants } from "@shared/schema";
import { sendOrgEmail } from "../lib/org-email";

function generateCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

export async function sendSignerOtp(signerId: number, tenantId: number, documentTitle: string) {
  const [signer] = await db.select().from(signoffSigners).where(eq(signoffSigners.id, signerId)).limit(1);
  if (!signer) throw new Error("Signer not found");

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await db.insert(signoffOtpCodes).values({ signerId, code, expiresAt });

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  await sendOrgEmail({
    tenant: tenant ?? null,
    to: signer.email,
    subject: `Your verification code: ${documentTitle}`,
    html: `<p>Your one-time verification code for signing <strong>${documentTitle}</strong> is:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>
<p>This code expires in 15 minutes.</p>`,
  });

  return { sent: true, expiresAt };
}

export async function verifySignerOtp(signerId: number, code: string): Promise<boolean> {
  const now = new Date();
  const [row] = await db.select().from(signoffOtpCodes)
    .where(and(
      eq(signoffOtpCodes.signerId, signerId),
      eq(signoffOtpCodes.code, code.trim()),
      isNull(signoffOtpCodes.usedAt),
      gt(signoffOtpCodes.expiresAt, now),
    ))
    .orderBy(desc(signoffOtpCodes.createdAt))
    .limit(1);

  if (!row) return false;

  await db.update(signoffOtpCodes).set({ usedAt: now }).where(eq(signoffOtpCodes.id, row.id));
  await db.update(signoffSigners).set({ otpVerifiedAt: now }).where(eq(signoffSigners.id, signerId));
  return true;
}
