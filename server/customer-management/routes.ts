import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { commercialCustomers } from "@shared/schema";
import { db } from "../db";
import { isOrgEmailConfigured } from "../lib/org-email";
import { isRequestAuthenticated } from "../auth/supabaseAuth";
import {
  applyAccessGrant,
  canGrantAccess,
  createBetaProgramme,
  CustomerMgmtNotReadyError,
  getCustomerDetail,
  getCustomerMgmtDashboard,
  hasCommercialCustomers,
  toggleCustomerFeatureFlag,
  updateCustomerMgmtSettings,
} from "./store";
import { syncAllTenantsToCommercialProfiles } from "./provision";
import {
  addContactInDb,
  applyCustomerDiscountInDb,
  changeCustomerPlanInDb,
  createCustomerInDb,
  findCustomerSlugByExternalId,
  runCustomerActionInDb,
  updateCustomerInDb,
  updatePricingPlanInDb,
  updateProgrammeParticipantsInDb,
  upsertDiscountRuleInDb,
} from "./mutations";
import {
  isStripeConfigured,
  linkStripeCustomer,
  syncStripeInvoices,
} from "./stripe";

function requireCommercialAdmin(req: Request, res: Response): boolean {
  if (!isRequestAuthenticated(req)) {
    res.status(401).json({ message: "Unauthorized" });
    return false;
  }
  const role = req.permissions?.platformRole;
  if (role !== "jiganto_staff" && role !== "si_super_admin") {
    res.status(403).json({
      message: "Customer Management requires Jiganto Staff or SI Super Admin access.",
    });
    return false;
  }
  return true;
}

const settingsPatchSchema = z.object({
  defaultTrialDays: z.number().int().min(7).max(90).optional(),
  requireCreditCardForTrial: z.boolean().optional(),
  allowSelfServeSignup: z.boolean().optional(),
  allowCustomerExtension: z.boolean().optional(),
  notify7DaysBefore: z.boolean().optional(),
  notify1DayBefore: z.boolean().optional(),
  autoSuspendOnExpiry: z.boolean().optional(),
  grantTrialExtensions: z
    .enum(["super_admin_commercial", "super_admin_only", "any_si_admin"])
    .optional(),
  grantFreeAccess: z.enum(["super_admin_only", "super_admin_commercial"]).optional(),
  createBetaProgrammes: z.enum(["super_admin_only", "super_admin_commercial"]).optional(),
  applyManualDiscounts: z.enum(["super_admin_commercial", "super_admin_only"]).optional(),
  maxExtensionWithoutCeo: z
    .enum(["1_month", "3_months", "6_months", "no_limit"])
    .optional(),
  requireGrantReason: z.boolean().optional(),
  freeAccessThresholdPercent: z.number().nullable().optional(),
  freeAccessAlertRecipients: z
    .enum(["super_admin_commercial", "super_admin_only"])
    .optional(),
  freeAccessAlertFrequency: z.enum(["daily", "once", "weekly"]).optional(),
  showBillingCostAlert: z.boolean().optional(),
  showProgrammesCostAlert: z.boolean().optional(),
  blockNewProgrammesOverThreshold: z.boolean().optional(),
  invoiceDueDays: z.number().int().optional(),
  autoRetryPayments: z.boolean().optional(),
  retrySchedule: z.string().optional(),
  suspendOnThirdFailedPayment: z.boolean().optional(),
});

const grantSchema = z.object({
  customerId: z.string().min(1),
  customerName: z.string().min(1),
  grantType: z.enum(["trial_extension", "free_access", "beta_programme"]),
  durationLabel: z.string().min(1),
  startLabel: z.string().min(1),
  reason: z.string().min(3),
  notifyCustomer: z.boolean().optional(),
});

export function registerCustomerMgmtRoutes(app: Express): void {
  app.get("/api/customer-mgmt/status", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    const persisted = await hasCommercialCustomers();
    const stripeConfigured = isStripeConfigured();
    const emailConfigured = isOrgEmailConfigured();
    const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
    const [countRow] = persisted
      ? await db.select({ count: sql<number>`count(*)::int` }).from(commercialCustomers)
      : [{ count: 0 }];
    res.json({
      persisted,
      source: "postgres",
      customerCount: countRow?.count ?? 0,
      stripeConfigured,
      emailConfigured,
      webhookConfigured,
    });
  });

  app.get("/api/customer-mgmt/dashboard", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      res.json(await getCustomerMgmtDashboard());
    } catch (err) {
      if (err instanceof CustomerMgmtNotReadyError) {
        return res.status(404).json({ message: err.message, empty: true });
      }
      throw err;
    }
  });

  app.post("/api/customer-mgmt/ai-insights", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const { generateCustomerMgmtAiInsights } = await import("./ai-insights");
      res.json(await generateCustomerMgmtAiInsights());
    } catch (err) {
      if (err instanceof CustomerMgmtNotReadyError) {
        return res.status(404).json({ message: err.message, empty: true });
      }
      console.error("Customer mgmt AI insights error:", err);
      res.status(500).json({ message: "Failed to generate customer insights" });
    }
  });

  app.get("/api/customer-mgmt/customers/:slug", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    const slug = String(req.params.slug);
    const detail = await getCustomerDetail(slug);
    if (!detail) {
      return res.status(404).json({ message: "Customer not found" });
    }
    res.json(detail);
  });

  app.put("/api/customer-mgmt/settings", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const patch = settingsPatchSchema.parse(req.body);
      const settings = await updateCustomerMgmtSettings(patch);
      res.json(settings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      throw err;
    }
  });

  app.post("/api/customer-mgmt/grants", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const input = grantSchema.parse(req.body);
      if (!(await canGrantAccess(req.permissions?.platformRole, input.grantType))) {
        return res.status(403).json({
          message: "Your role is not permitted to grant this type of access.",
        });
      }
      const grantedByName = req.permissions?.platformRole === "jiganto_staff" ? "Jiganto Staff" : "SI Super Admin";
      await applyAccessGrant({ ...input, grantedByName, notifyCustomer: input.notifyCustomer ?? true });
      res.status(201).json({
        message: "Access grant applied",
        dashboard: await getCustomerMgmtDashboard(),
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      throw err;
    }
  });

  const programmeSchema = z.object({
    name: z.string().min(3),
    programmeType: z.string().min(1),
    compensation: z.string().min(1),
    planScope: z.string().min(1),
    maxParticipants: z.number().int().min(1).max(500),
    enrolment: z.string().min(1),
    endsAt: z.string().min(1),
  });

  app.post("/api/customer-mgmt/programmes", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const input = programmeSchema.parse(req.body);
      const programme = await createBetaProgramme(input);
      res.status(201).json({ programme, dashboard: await getCustomerMgmtDashboard() });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      if (err instanceof Error) {
        return res.status(403).json({ message: err.message });
      }
      throw err;
    }
  });

  app.patch("/api/customer-mgmt/customers/:slug/feature-flags/:key", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    const enabled = Boolean(req.body?.enabled);
    const detail = await toggleCustomerFeatureFlag(
      String(req.params.slug),
      String(req.params.key),
      enabled,
    );
    if (!detail) {
      return res.status(404).json({ message: "Customer or flag not found" });
    }
    res.json(detail);
  });

  app.post("/api/customer-mgmt/stripe/sync", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const result = await syncStripeInvoices();
      res.json({
        ...result,
        dashboard: await getCustomerMgmtDashboard(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stripe sync failed";
      res.status(503).json({ message });
    }
  });

  app.post("/api/customer-mgmt/provision/sync-tenants", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const created = await syncAllTenantsToCommercialProfiles();
      res.json({
        created,
        dashboard: await getCustomerMgmtDashboard(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tenant sync failed";
      res.status(500).json({ message });
    }
  });

  const linkStripeSchema = z.object({
    stripeCustomerId: z.string().min(3),
  });

  app.post("/api/customer-mgmt/customers/:slug/stripe", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const { stripeCustomerId } = linkStripeSchema.parse(req.body);
      await linkStripeCustomer(String(req.params.slug), stripeCustomerId);
      const detail = await getCustomerDetail(String(req.params.slug));
      res.json({ detail });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      throw err;
    }
  });

  app.post("/api/customer-mgmt/customers", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const input = z
        .object({
          name: z.string().min(2),
          domain: z.string().min(3),
          plan: z.enum(["starter", "growth", "enterprise"]),
        })
        .parse(req.body);
      const created = await createCustomerInDb(input);
      res.status(201).json({
        ...created,
        dashboard: await getCustomerMgmtDashboard(),
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      if (err instanceof CustomerMgmtNotReadyError) {
        return res.status(404).json({ message: err.message });
      }
      throw err;
    }
  });

  app.patch("/api/customer-mgmt/customers/:slug", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const patch = z
        .object({
          name: z.string().min(2).optional(),
          website: z.string().optional(),
          domain: z.string().optional(),
        })
        .parse(req.body);
      const slug = String(req.params.slug);
      const detail = await updateCustomerInDb(slug, patch);
      if (!detail) return res.status(404).json({ message: "Customer not found" });
      res.json({ detail, dashboard: await getCustomerMgmtDashboard() });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      throw err;
    }
  });

  app.post("/api/customer-mgmt/customers/:slug/contacts", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const input = z
        .object({
          name: z.string().min(2),
          email: z.string().email(),
          roleLabel: z.string().min(2),
        })
        .parse(req.body);
      const slug = String(req.params.slug);
      const detail = await addContactInDb(slug, input);
      if (!detail) return res.status(404).json({ message: "Customer not found" });
      res.status(201).json({ detail });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      throw err;
    }
  });

  app.patch("/api/customer-mgmt/customers/:slug/plan", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const { plan } = z.object({ plan: z.enum(["starter", "growth", "enterprise"]) }).parse(req.body);
      const slug = String(req.params.slug);
      const detail = await changeCustomerPlanInDb(slug, plan);
      if (!detail) return res.status(404).json({ message: "Customer not found" });
      res.json({ detail, dashboard: await getCustomerMgmtDashboard() });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      throw err;
    }
  });

  app.post("/api/customer-mgmt/customers/:slug/discounts", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const input = z
        .object({ ruleLabel: z.string().min(2), note: z.string().min(3) })
        .parse(req.body);
      const slug = String(req.params.slug);
      const detail = await applyCustomerDiscountInDb(slug, input);
      if (!detail) return res.status(404).json({ message: "Customer not found" });
      res.json({ detail });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      throw err;
    }
  });

  app.post("/api/customer-mgmt/customers/:slug/actions", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const input = z
        .object({
          action: z.enum(["health_follow_up", "renewal_follow_up", "convert_trial"]),
          note: z.string().optional(),
          customerExternalId: z.string().optional(),
        })
        .parse(req.body);
      let slug = String(req.params.slug);
      if (slug === "_by_id" && input.customerExternalId) {
        const resolved = await findCustomerSlugByExternalId(input.customerExternalId);
        if (!resolved) return res.status(404).json({ message: "Customer not found" });
        slug = resolved;
      }
      const detail = await runCustomerActionInDb(slug, input.action, input.note);
      if (!detail) return res.status(404).json({ message: "Customer not found" });
      res.json({ detail, dashboard: await getCustomerMgmtDashboard() });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      throw err;
    }
  });

  app.post("/api/customer-mgmt/discount-rules", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const input = z
        .object({
          name: z.string().min(2),
          discount: z.string().min(2),
          appliesTo: z.string().optional(),
          duration: z.string().optional(),
          whoCanApply: z.string().optional(),
        })
        .parse(req.body);
      const rule = await upsertDiscountRuleInDb(input);
      res.status(201).json({ rule, dashboard: await getCustomerMgmtDashboard() });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      throw err;
    }
  });

  app.patch("/api/customer-mgmt/discount-rules/:externalId", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const input = z
        .object({
          name: z.string().min(2),
          discount: z.string().min(2),
        })
        .parse(req.body);
      const rule = await upsertDiscountRuleInDb({
        externalId: String(req.params.externalId),
        ...input,
      });
      res.json({ rule, dashboard: await getCustomerMgmtDashboard() });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      throw err;
    }
  });

  app.patch("/api/customer-mgmt/pricing/plans/:tier", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const tier = z.enum(["starter", "growth", "enterprise"]).parse(req.params.tier);
      const patch = z
        .object({
          priceLabel: z.string().min(1).optional(),
          features: z.string().min(1).optional(),
        })
        .parse(req.body);
      const plan = await updatePricingPlanInDb(tier, patch);
      res.json({ plan, dashboard: await getCustomerMgmtDashboard() });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      throw err;
    }
  });

  app.post("/api/customer-mgmt/programmes/:programmeId/participants", async (req, res) => {
    if (!requireCommercialAdmin(req, res)) return;
    try {
      const { initials, color } = z
        .object({ initials: z.string().min(1).max(4), color: z.string().optional() })
        .parse(req.body);
      const result = await updateProgrammeParticipantsInDb(String(req.params.programmeId), "add", {
        initials: initials.toUpperCase(),
        color,
      });
      if (!result) return res.status(404).json({ message: "Programme not found" });
      res.json({ ...result, dashboard: await getCustomerMgmtDashboard() });
    } catch (err) {
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      throw err;
    }
  });

  app.delete(
    "/api/customer-mgmt/programmes/:programmeId/participants/:initials",
    async (req, res) => {
      if (!requireCommercialAdmin(req, res)) return;
      const result = await updateProgrammeParticipantsInDb(
        String(req.params.programmeId),
        "remove",
        { initials: String(req.params.initials).toUpperCase() },
      );
      if (!result) return res.status(404).json({ message: "Programme not found" });
      res.json({ ...result, dashboard: await getCustomerMgmtDashboard() });
    },
  );
}
