import Stripe from "stripe";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "../db";
import {
  commercialCustomers,
  commercialInvoices,
  commercialStripeEvents,
} from "@shared/schema";
import type { Request, Response } from "express";

let stripeClient: Stripe | null | undefined;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripeClient(): Stripe | null {
  if (stripeClient !== undefined) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    stripeClient = null;
    return null;
  }
  stripeClient = new Stripe(key);
  return stripeClient;
}

function mapInvoiceStatus(status: Stripe.Invoice.Status | null): "paid" | "overdue" | "pending" {
  if (status === "paid") return "paid";
  if (status === "open" || status === "uncollectible") return "overdue";
  return "pending";
}

function formatDueDate(unix?: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function upsertStripeInvoice(
  invoice: Stripe.Invoice,
  customerRow: { id: number; name: string },
): Promise<void> {
  const externalId = `stripe-${invoice.id}`;
  const amountPence = invoice.amount_due ?? invoice.total ?? 0;
  const status = mapInvoiceStatus(invoice.status);
  const dueDate = formatDueDate(invoice.due_date ?? invoice.created);

  const [existing] = await db
    .select({ id: commercialInvoices.id })
    .from(commercialInvoices)
    .where(eq(commercialInvoices.stripeInvoiceId, invoice.id))
    .limit(1);

  if (existing) {
    await db
      .update(commercialInvoices)
      .set({
        amountPence,
        dueDate,
        status,
        customerName: customerRow.name,
        syncedAt: new Date(),
      })
      .where(eq(commercialInvoices.id, existing.id));
    return;
  }

  await db.insert(commercialInvoices).values({
    externalId,
    customerId: customerRow.id,
    customerName: customerRow.name,
    amountPence,
    dueDate,
    status,
    stripeInvoiceId: invoice.id,
    syncedAt: new Date(),
  });
}

/** Pull recent invoices from Stripe for all linked commercial customers. */
export async function syncStripeInvoices(): Promise<{ synced: number; skipped: number }> {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  const customers = await db
    .select()
    .from(commercialCustomers)
    .where(isNotNull(commercialCustomers.stripeCustomerId));

  let synced = 0;
  let skipped = 0;

  for (const row of customers) {
    const stripeCustomerId = row.stripeCustomerId!;
    try {
      const invoices = await stripe.invoices.list({
        customer: stripeCustomerId,
        limit: 24,
      });
      for (const inv of invoices.data) {
        await upsertStripeInvoice(inv, { id: row.id, name: row.name });
        synced++;
      }
    } catch (err) {
      console.warn(`[stripe] Invoice sync failed for ${row.slug}:`, err);
      skipped++;
    }
  }

  return { synced, skipped };
}

async function handleInvoiceEvent(invoice: Stripe.Invoice): Promise<void> {
  const stripeCustomerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!stripeCustomerId) return;

  const [customerRow] = await db
    .select()
    .from(commercialCustomers)
    .where(eq(commercialCustomers.stripeCustomerId, stripeCustomerId))
    .limit(1);
  if (!customerRow) return;

  await upsertStripeInvoice(invoice, { id: customerRow.id, name: customerRow.name });

  if (invoice.subscription) {
    const subId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription.id;
    await db
      .update(commercialCustomers)
      .set({ stripeSubscriptionId: subId, updatedAt: new Date() })
      .where(eq(commercialCustomers.id, customerRow.id));
  }
}

async function recordStripeEvent(eventId: string, eventType: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: commercialStripeEvents.id })
    .from(commercialStripeEvents)
    .where(eq(commercialStripeEvents.stripeEventId, eventId))
    .limit(1);
  if (existing) return false;

  await db.insert(commercialStripeEvents).values({
    stripeEventId: eventId,
    eventType,
  });
  return true;
}

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripe || !webhookSecret) {
    res.status(503).json({ message: "Stripe webhook not configured" });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") {
    res.status(400).json({ message: "Missing stripe-signature header" });
    return;
  }

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : null;
  if (!rawBody) {
    res.status(400).json({ message: "Raw body required for webhook verification" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    res.status(400).json({ message });
    return;
  }

  const isNew = await recordStripeEvent(event.id, event.type);
  if (!isNew) {
    res.json({ received: true, duplicate: true });
    return;
  }

  try {
    switch (event.type) {
      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.finalized":
      case "invoice.updated":
        await handleInvoiceEvent(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (stripeCustomerId) {
          await db
            .update(commercialCustomers)
            .set({
              stripeSubscriptionId: event.type === "customer.subscription.deleted" ? null : sub.id,
              status: sub.status === "active" ? "active" : sub.status === "trialing" ? "trial" : "active",
              statusLabel:
                sub.status === "trialing"
                  ? "Trial"
                  : sub.status === "active"
                    ? "Active"
                    : sub.status,
              updatedAt: new Date(),
            })
            .where(eq(commercialCustomers.stripeCustomerId, stripeCustomerId));
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe] Webhook handler error:", err);
    res.status(500).json({ message: "Webhook handler failed" });
    return;
  }

  res.json({ received: true });
}

/** Link an existing Stripe customer ID to a commercial profile (admin). */
export async function linkStripeCustomer(
  slug: string,
  stripeCustomerId: string,
): Promise<void> {
  await db
    .update(commercialCustomers)
    .set({ stripeCustomerId, updatedAt: new Date() })
    .where(eq(commercialCustomers.slug, slug));
}
