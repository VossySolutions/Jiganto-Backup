import { eq } from "drizzle-orm";
import { db } from "../db";
import { commercialContacts, commercialCustomers, tenants } from "@shared/schema";
import { sendOrgEmail } from "../lib/org-email";
import type { AccessGrantType } from "@shared/models/customer-mgmt";

export async function sendGrantAccessEmail(params: {
  customerExternalId: string;
  customerName: string;
  grantType: AccessGrantType;
  durationLabel: string;
  startLabel: string;
  expiresAtLabel?: string;
  grantedByName: string;
}): Promise<{ sent: boolean; to?: string; method?: string; error?: string }> {
  const [customer] = await db
    .select()
    .from(commercialCustomers)
    .where(eq(commercialCustomers.externalId, params.customerExternalId))
    .limit(1);

  let to: string | undefined;
  let tenant = null;

  if (customer?.tenantId) {
    [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, customer.tenantId))
      .limit(1);
    to = tenant?.licenseContactEmail ?? tenant?.supportContactEmail ?? undefined;
  }

  if (!to && customer) {
    const [contact] = await db
      .select()
      .from(commercialContacts)
      .where(eq(commercialContacts.customerId, customer.id))
      .limit(1);
    to = contact?.email ?? undefined;
  }

  if (!to) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[grant-email] No recipient — would notify:", params.customerName);
      return { sent: false, error: "No billing contact email on file" };
    }
    return { sent: false, error: "No billing contact email on file" };
  }

  const grantLabel =
    params.grantType === "trial_extension"
      ? "Trial extension"
      : params.grantType === "free_access"
        ? "Free access period"
        : "Beta programme enrolment";

  const expiry = params.expiresAtLabel ?? params.startLabel;
  const subject = `${grantLabel} applied — ${params.customerName}`;
  const html = `
    <p>Hello,</p>
    <p>A <strong>${grantLabel.toLowerCase()}</strong> has been applied to your Jiganto organisation
    <strong>${params.customerName}</strong>.</p>
    <ul>
      <li><strong>Duration:</strong> ${params.durationLabel}</li>
      <li><strong>Effective from:</strong> ${params.startLabel}</li>
      <li><strong>Access until:</strong> ${expiry}</li>
      <li><strong>Approved by:</strong> ${params.grantedByName}</li>
    </ul>
    <p>If you have questions, reply to your Customer Success Manager.</p>
    <p style="color:#666;font-size:12px">This is an automated message from Jiganto Commercial Admin.</p>
  `.trim();

  const result = await sendOrgEmail({ tenant, to, subject, html });
  return { sent: result.sent, to, method: result.method, error: result.error };
}
