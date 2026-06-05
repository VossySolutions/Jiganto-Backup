# Customer Management — Page Guide

Customer Management is the internal tool for Jiganto/SI staff to manage paying organisations — subscriptions, trials, health, renewals, and billing.

**Access:** Jiganto Staff and SI Super Admin only.

---

## Before any customers exist

When the database has no commercial customers, you see an empty state with:

- **Add customer** — create a new organisation manually
- **Sync tenant profiles** — pull in organisations already set up in Jiganto

---

## 1. All customers

**What it is:** Your main list of all organisations.

**What you see:**

- Summary numbers: active customers, trials, MRR, at-risk count
- A table with plan, health, CSM, status, MRR, and next action

**What you can do:**

- Search and filter (status, plan, CSM)
- **Add customer**
- **Export** list to CSV
- **View** a customer’s full profile
- **Extend** trial if one is expiring soon

---

## 2. Customer detail

**What it is:** Everything about one organisation in one place.

**What you see:**

- Subscription (plan, MRR, renewal, payment method)
- Health score breakdown
- Key contacts
- Feature flags (turn features on/off for that org)
- Usage (users, AI tokens, storage, eSign)
- History of grants and changes

**What you can do:**

- **Grant access** (extend trial / free access)
- **Edit** customer details
- **Change plan** or **add discount**
- **Add contact**
- Toggle **feature flags**

---

## 3. Health scores

**What it is:** Which customers are happy vs struggling.

**What you see:**

- Counts: healthy, watch, at-risk, average score
- A list of customers needing attention (low scores)
- Why they’re flagged (e.g. low logins, support tickets)

**What you can do:**

- Click actions like **Schedule call** or **Send check-in** to log follow-up work

**How score works:** Built from login frequency, feature use, support volume, NPS, and renewal intent.

---

## 4. Trials & extensions

**What it is:** Manage who is on trial and when access runs out.

**What you see:**

- Trial stats (standard trials, extensions, free access, expiring this week)
- Table of all active trials with expiry dates
- Trial default settings (length, notifications, etc.)

**What you can do:**

- **Grant access** — extend trial or give free access (logged in audit trail)
- **Extend** or **Convert** trial to paid
- Adjust trial rules at the bottom

**Permissions:** SI Super Admin and Jiganto Staff can grant access. Other roles see a permission warning.

---

## 5. Beta programmes

**What it is:** Special programmes for early access, design partners, beta cohorts, etc.

**What you see:**

- Active programmes, participants, and how much free access they cost
- Cards for each programme with slots and end date

**What you can do:**

- **Create programme**
- **Manage participants** (add/remove orgs)

---

## 6. Renewal pipeline

**What it is:** Upcoming contract renewals in the next 90 days.

**What you see:**

- MRR at risk in 30 / 31–90 days
- At-risk renewals and expected renewal rate
- Table sorted by renewal date

**What you can do:**

- Take renewal actions (e.g. **Send proposal**, **Schedule call**)
- Prioritise outreach by MRR and health

---

## 7. Pricing & plans

**What it is:** Your product pricing structure.

**What you see:**

- **Starter**, **Growth**, **Enterprise** plan cards with prices and features
- **Discount rules** table (e.g. “20% off first year”)

**What you can do:**

- **Edit plan** details
- **Add / edit discount rules**

---

## 8. Billing overview

**What it is:** Money overview across all customers.

**What you see:**

- MRR, ARR, overdue invoices, free-access cost
- Revenue by plan
- MRR trend chart and monthly waterfall (new, expansion, churn)
- Recent invoices list

**What you can do:**

- **Sync from Stripe** (if Stripe is configured) to pull live invoices

**Stripe:** This page is the main one that uses Stripe — for invoice sync and payment automation. Other pages work without it.

---

## 9. Plan settings

**What it is:** Global rules for the whole module.

**What you see / configure:**

- **Trial defaults** — trial length, credit card required, notifications, auto-suspend
- **Permissions** — who can grant extensions, free access, create programmes, apply discounts
- **Free access alerts** — warn when free/beta access costs too much vs MRR
- **Billing config** — invoice due days, payment retries, suspend on failed payments (Stripe)

---

## Shared features (every page when customers exist)

- **Tab badges** — customer count, at-risk count, trials expiring
- **Integration banner** — Postgres status, Stripe/email/webhook configured
- **Sync tenant profiles** — link new Jiganto tenants to commercial profiles

---

## Glossary

| Term | Meaning |
|------|---------|
| **CSM** | Customer Success Manager — the internal person assigned to look after an organisation |
| **MRR** | Monthly Recurring Revenue — how much a customer pays per month |
| **ARR** | Annual Recurring Revenue — MRR × 12 |
| **Health score** | 0–100 score showing how well a customer is using and engaging with the product |

---

## Quick reference

| Page | Purpose |
|------|---------|
| All customers | Who you have |
| Customer detail | One org deep-dive |
| Health scores | Who needs help |
| Trials & extensions | Time-limited access |
| Beta programmes | Beta cohorts |
| Renewal pipeline | Contracts coming up |
| Pricing & plans | Plans & discounts |
| Billing overview | Money & invoices |
| Plan settings | Rules for everything |
