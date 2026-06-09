# Clients Module — Quick Guide

**What it is:** Create and switch between **client workspaces**. Each workspace scopes the platform to one customer engagement.

**Not:** CRM, contacts, or billing (those are separate modules).

**Route:** `/clients` · Detail: `/clients/:id` · Legacy `/modules/clients` redirects here

---

## Who can do what

| Role | See `/clients` | Create / delete | Enter workspace |
|------|----------------|-----------------|-----------------|
| Jiganto Staff | Yes | Yes | Yes |
| SI Super Admin | Yes | Yes | Yes |
| SI Consultant / PM | Yes | No | Only assigned workspaces |
| Client user | No | No | Their workspace only |

---

## Getting started

1. Open **Clients** in the sidebar (Management).
2. Click **Add Client** → enter **Client Name** → **Create Client**.
3. Click **Enter workspace** on the card to work in that client’s view.

On create, the system also: adds you as workspace admin, provisions a Chat team, and applies data isolation (RLS).

---

## Landing page (`/clients`)

- **KPI strip** — total clients, active engagements, projects, at-risk count
- **Tabs** — Active · Archived · All
- **Cards** — one per workspace (badge, name, industry, project counts, **Enter workspace**)
- **Pending deletion** — admin panel for soft-deleted workspaces (restore / purge)

**Card menu (⋯):** Edit details · Archive · Delete

---

## Client detail (`/clients/:id`)

View and edit workspace info. Actions:

- **Edit details** — name, industry, dates, account manager, tags, notes
- **Manage members** — add SI consultants or invite client users by email
- **Module visibility** — toggle optional modules (SI Super Admin)

---

## Enter / exit a workspace

**Enter:** Card → **Enter workspace** → session updates → reload to `/ws/[slug]`

**Exit to master (SI) view:** Sidebar switcher → select your **organisation name** (not the client)

**Shortcut:** `Ctrl+Shift+W` / `Cmd+Shift+W` toggles master ↔ last workspace

### What changes in client view

- Dashboard, projects, tasks, documents, etc. are scoped to that client
- Sidebar shows client name and brand colour
- **Hidden modules:** Business, Clients, CRM, Finance, Customer Management
- **Optional modules** (off by default): Resources, Service Desk, Test Management, BPM — enable via **Module visibility**

Workspace context is stored in the **server session**, not `localStorage`.

---

## Members

| Type | How to add | Roles |
|------|------------|-------|
| SI team | Pick user from dropdown | workspace_admin, editor, viewer |
| Client user | Invite by email | workspace_admin, editor, viewer |

Client users never see `/clients` or other workspaces.

---

## Archive & delete

| Action | Result |
|--------|--------|
| **Archive** | Read-only; moves to Archived tab; can restore |
| **Delete** | 30-day soft delete → **Pending deletion** panel → restore or purge |

---

## Main APIs

| Action | Endpoint |
|--------|----------|
| List | `GET /api/clients?includeArchived=true` |
| KPIs | `GET /api/clients/kpis` |
| Create | `POST /api/clients` |
| Update | `PUT /api/clients/:id` |
| Archive | `DELETE /api/clients/:id` |
| Delete request | `POST /api/clients/:id/delete-request` |
| Switch context | `GET/PUT /api/clients/workspace-context` |
| Members | `GET/POST/DELETE /api/clients/:id/users` |
| Invites | `POST /api/clients/:id/invitations` |
| Module visibility | `GET/PUT /api/clients/:id/module-visibility` |

---

## Setup notes

- **RLS:** Run `npm run db:clients-rls` (uses `DATABASE_URL` from `.env`) or paste `scripts/sql/clients-rls.sql` in Supabase SQL Editor
- **Indexes:** Run `npm run db:clients-indexes` after schema changes (speeds up `/api/clients` list and KPIs)
- **Database:** See `docs/SUPABASE.md`
- **Related:** Customer Management = internal billing · CRM = pipeline (hidden in client view)
