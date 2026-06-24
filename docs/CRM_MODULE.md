# CRM Module — Quick Guide

**What it is:** Sales pipeline management — leads, opportunities, accounts, contacts, contracts, forecasting, and account 360° views.

**Not:** Client workspaces (`/clients`) or internal billing (Customer Management). Those are separate modules.

**Route:** `/modules/crm` · Deep links: `?tab=pipeline`, `?tab=contracts&contract=3`, etc.

**Visibility:** Hidden when working inside a **client workspace** (master / SI org view only).

---

## Who can do what


| Role               | Access CRM | Create / edit records | Manage pipelines & stages |
| ------------------ | ---------- | --------------------- | ------------------------- |
| Jiganto Staff      | Yes        | Yes                   | Yes                       |
| SI Super Admin     | Yes        | Yes                   | Yes                       |
| SI Consultant / PM | Yes        | Yes (assigned)        | Usually view + edit deals |
| Client user        | No         | No                    | No                        |


---

## Tabs overview


| Tab               | Purpose                                                 |
| ----------------- | ------------------------------------------------------- |
| **Dashboard**     | KPIs, stage breakdown, hot deals, activity, leaderboard |
| **360° View**     | Single-account hub: deals, contacts, notes, KPIs        |
| **Leads**         | Pre-qualification; convert to account/opportunity       |
| **Opportunities** | Deal list with filters, saved views, bulk actions       |
| **Pipeline**      | Kanban board — drag deals between stages                |
| **Customers**     | Account list (prospects & customers)                    |
| **Contracts**     | MSAs, SOWs, renewals; link to eSign                     |
| **Contacts**      | People linked to accounts                               |
| **Forecasting**   | Weighted forecast matrix & sales forecast dashboard     |
| **Resource Plan** | Staffing / capacity linked to opportunities             |


---

## Dashboard KPIs (what the numbers mean)


| Metric                 | Meaning                               |
| ---------------------- | ------------------------------------- |
| **Total Pipeline**     | Sum of open deal amounts (unweighted) |
| **Weighted Pipeline**  | Each deal × stage/win probability     |
| **Revenue Won**        | Closed-won deal value (period)        |
| **Win Rate (90d)**     | Won ÷ (won + lost) in last 90 days    |
| **Avg Deal Size**      | Mean amount of open deals in pipeline |
| **Open Opportunities** | Count of non-closed deals             |
| **Active Leads**       | Leads not yet converted/disqualified  |
| **Hot Leads**          | High-score or recently engaged leads  |
| **Active Contracts**   | Contracts in active status            |
| **Expiring Contracts** | Active contracts ending soon          |


Hover the **?** on any metric card for the same definition in-app.

---

## Pipeline (Kanban)

- Select **pipeline** and **owner** filters at the top.
- Drag deal cards between stages (grip handle on the left).
- Moving to a **closed won/lost** stage prompts for win/loss reason.
- **Manage Stages** — add, edit, reorder stages per pipeline.
- **Card fields** — toggle which fields show on kanban cards.

KPI strip on Pipeline tab:


| Metric                   | Meaning                                        |
| ------------------------ | ---------------------------------------------- |
| **Open Deals**           | Deals in the selected pipeline (after filters) |
| **Total Pipeline Value** | Sum of deal amounts (open)                     |
| **Weighted Value**       | Probability-adjusted total                     |
| **Avg Deal Size**        | Total ÷ deal count                             |


---

## Leads → Opportunities → Accounts

1. **Lead** — capture name, company, source, score, owner.
2. **Convert** — creates/links account and optionally an opportunity.
3. **Opportunity** — amount, stage, probability, expected close, owner.
4. **Account (Customer)** — company record; parent/child accounts supported.

---

## Contracts

- Types: MSA, SOW, renewal, etc.
- Status: draft, active, expired, terminated.
- **Send for sign-off** — deep link to eSign with `crmContractId`.
- KPIs: **Active Contracts** (count), **Annual Revenue (Accounts)** (sum of account annual revenue fields — not contract value).

---

## Forecasting

- **Forecast matrix** — reps × periods with commit / best case / pipeline.
- **Sales forecast dashboard** — trend charts and category breakdown.
- Uses open opportunities + stage probabilities from the database.

---

## Main APIs


| Area            | Endpoint                                     |
| --------------- | -------------------------------------------- |
| Dashboard stats | `GET /api/crm/dashboard-stats`               |
| Accounts        | `GET/POST/PUT/DELETE /api/crm/accounts`      |
| Contacts        | `GET/POST/PUT/DELETE /api/crm/contacts`      |
| Leads           | `GET/POST/PUT/DELETE /api/crm/leads`         |
| Opportunities   | `GET/POST/PUT/DELETE /api/crm/opportunities` |
| Pipelines       | `GET/POST /api/crm/pipelines`                |
| Stages          | `GET/POST/PUT/DELETE /api/crm/stages`        |
| Contracts       | `GET/POST/PUT/DELETE /api/crm/contracts`     |
| Forecasts       | `GET/POST /api/crm/forecasts`                |
| Activities      | `GET/POST /api/crm/activities`               |
| Saved views     | `GET/POST/PUT/DELETE /api/crm/saved-views`   |


All routes are **tenant-scoped** via session (no client-supplied `tenantId`). KPIs and lists are computed from **live database records** only — there is no demo or mock data layer in the CRM UI.

---

## UX patterns (production)

- **One primary create action** per tab — toolbar button hidden when the list is empty (empty state has the CTA).
- **Metric cards** — title, value, subtitle, and **?** tooltip on dashboards and list tabs.
- **Kanban** — shared `@hello-pangea/dnd` board with optimistic drag, revert on API failure, saving spinner on card.
- **Account detail panel** — slides in from the right on Customers / 360° without losing list context.

---

## Related modules


| Module                  | Relationship                                    |
| ----------------------- | ----------------------------------------------- |
| **Clients**             | Workspace isolation; CRM hidden in client view  |
| **Customer Management** | Paying org subscriptions (not sales pipeline)   |
| **eSign**               | Contract sign-off from CRM Contracts tab        |
| **Projects**            | Opportunities/contracts can link to `projectId` |
| **Resource Planning**   | CRM Resource Plan tab                           |


---

## Setup

- Schema: Drizzle models under `shared/` + `npm run db:push`
- Data: create accounts, leads, and opportunities in the CRM UI (or via your migration/import). The module reads **only persisted database records**.
- See also: `docs/SUPABASE.md`, `docs/DEPLOYMENT.md` (CRM listed as DB-backed)

---