# Jiganto — Full Codebase Feature & API Audit

**Basis**: Direct source-code reading of `server/`, `client/src/`, and `shared/` as of 2026-09-24 (5 parallel deep-dive passes covering all ~24 functional modules). Cross-check against `docs/TECHNICAL_DOCUMENTATION_PACK.md` (tech stack) and existing module docs where present; discrepancies are called out inline.

**Scale**: 191 server `.ts` files, a single 11,123-line `server/routes.ts` monolith carrying a large share of inline route handlers (CRM, Business Management, Documents, Projects/PM, Test Management CRUD, BPM diagrams, Workspaces, Clients-adjacent bits) alongside ~20 dedicated `server/<module>/` folders; 35 top-level client pages plus 31 component folders (largest: `crm` 42 files, `ui` 35, `projects` 26, `settings` 25, `testmgmt` 19).

---

## Table of contents

1. [Platform architecture recap](#1-platform-architecture-recap)
2. [Core Platform: Auth & Identity](#2-auth--identity)
3. [Core Platform: Settings / Tenants](#3-settings--tenants)
4. [Core Platform: Workspaces](#4-workspaces-notion-style-collaboration)
5. [Core Platform: Clients (SI client workspaces)](#5-clients-si-client-workspaces)
6. [Core Platform: Dashboard](#6-dashboard)
7. [Commercial: CRM](#7-crm)
8. [Commercial: Business Management](#8-business-management)
9. [Commercial: Customer Management](#9-customer-management-commercialbilling-admin)
10. [Commercial: Finance](#10-finance)
11. [Delivery: Projects Management](#11-projects-management-incl-ganttwbs)
12. [Delivery: Portfolio Management](#12-portfolio-management)
13. [Delivery: Tasks Management](#13-tasks-management)
14. [Delivery: Resource Planning](#14-resource-planning)
15. [Delivery: Resources Management](#15-resources-management)
16. [Process/Collab: BPM](#16-bpm-business-process-management)
17. [Process/Collab: Templates](#17-templates-cross-module-platform-templates)
18. [Process/Collab: Surveys & Polls](#18-surveys--polls)
19. [Process/Collab: Whiteboard](#19-whiteboard-collaborative-canvas)
20. [Process/Collab: Test Management](#20-test-management)
21. [Comms/Support: Chat](#21-chat-team-messaging)
22. [Comms/Support: Document Management](#22-document-management)
23. [Comms/Support: Help Desk](#23-help-desk-incl-customer-portal--csat)
24. [Comms/Support: Service Desk](#24-service-desk-internal-itops)
25. [Comms/Support: e-Sign / Sign-Off](#25-e-sign--sign-off)
26. [Cross-cutting platform observations](#26-cross-cutting-platform-observations)
27. [Notable gaps, stubs & inconsistencies (consolidated)](#27-notable-gaps-stubs--inconsistencies-consolidated)

---

## 1. Platform architecture recap

Modular monolith: one Express 5 process serves a React 18/Vite SPA plus REST APIs and WebSocket endpoints, backed by PostgreSQL (Supabase) via Drizzle ORM. See `docs/TECHNICAL_DOCUMENTATION_PACK.md` for the full tech-stack inventory (frontend/backend/DB libraries, dependency list, DevOps posture, due-diligence scoring). This document instead catalogues **what the product does and every API surface**, module by module.

Every module below sits behind one global middleware pipeline registered in `server/routes.ts` right after auth setup:

```
attachPermissionContext → injectApiTenantScope → enforceOrgMembershipAccess →
attachWorkspaceContext → attachWorkspaceClaims → injectWorkspaceQueryScope →
enforceWorkspaceMutations → enforceArchivedWorkspaceReadOnly → guardPmProjectScope →
guardWorkspaceResourceAccess → restrictClientWorkspaceModules → setWorkspaceRlsContext →
enforceModulePermissions → enforceReadOnlyApiAccess → filterWorkspaceResponses
```

This is the backbone of multi-tenancy, per-client-workspace isolation, and role/module permission enforcement for the entire app — it is not repeated per module below.

**Terminology note**: "Workspaces" (§4, a Notion-style docs/database tool) and "Clients" (§5, the SI's client-tenant boundary, informally also called "client workspaces") are separate subsystems with separate schemas/routes despite the name overlap.

---

## 2. Auth & Identity

**Purpose**: Authentication (Supabase JWT in production, Passport dev-session locally), per-organisation effective role/permission resolution, invitations, and staff impersonation.

**Key features**
- Dual auth mode auto-selected by `authMode()` (`server/auth/supabaseAuth.ts`): `"supabase"` if `SUPABASE_URL`/`SUPABASE_ANON_KEY` set, else `"dev-session"` (Passport + Postgres session store).
- Supabase bearer-token verification with in-memory cache (`server/lib/supabase-auth-cache.ts`); auto-provisions `public.users` from Supabase identity (`server/auth/appUserSync.ts`).
- Dev/role-based login presets (`GET /api/login?preset=<id>`) for local dev/demos.
- "Bootstrap first admin": the first authenticated user with zero org memberships anywhere can self-provision an org and become `si_super_admin`.
- 6-role, additive-across-orgs platform-role model (see below), cached per user/org.
- Two independent invitation systems: org-level (`userInvitations`) and client-workspace-level (`clientInvitations`, see §5) — do not confuse them.
- Jiganto-staff "login as user" impersonation with session state + audit trail.
- Legacy-role inference fallback chain when no `org_memberships` row exists.

**API endpoints**

| Method | Path | Purpose |
|---|---|---|
| GET | /api/auth/config | Auth mode, dev-login availability, preset list |
| GET | /api/auth/user | Current user record |
| GET | /api/auth/access | Whether user has an active org membership + bootstrap availability |
| POST | /api/auth/bootstrap-admin | Self-provision org + become si_super_admin (only if zero orgs exist) |
| GET | /api/auth/invitations/:token/preview | Public org-invite preview |
| GET | /api/auth/invitations/:token | Authenticated invitation detail |
| POST | /api/auth/invitations/:token/accept | Accept org invite → org_memberships + profiles |
| POST | /api/auth/clear-dev-session | Drop legacy Passport cookie |
| GET | /api/login (+?preset=) | Dev-session / preset persona login |
| GET | /api/logout | Passport logout |
| GET | /api/auth/roles | Static platform-role catalogue |
| GET | /api/auth/session | Resolved EffectivePermissions + resourceScope + active workspace |
| GET | /api/auth/session/modules | Legacy per-module ACL |
| GET | /api/auth/impersonation/status | Current impersonation state |
| POST | /api/auth/impersonation/start | Staff-only: begin impersonating a user |
| POST | /api/auth/impersonation/end | End impersonation |
| GET | /api/org-memberships | List platform-role memberships + workspace grants (org-admin) |
| POST | /api/org-memberships | Create a membership |
| PATCH/DELETE | /api/org-memberships/:id | Update/remove (blocks immutable roles) |
| POST | /api/client-workspace-grants | Grant an SI user access to one client workspace |
| DELETE | /api/client-workspace-grants/:id | Revoke a workspace grant |

(Invitation *creation* itself is a Settings endpoint, `POST /api/settings/invitations` — see §3.)

**Data model**: `orgMemberships` (userId, orgId, platformRole, lockedWorkspaceId, isActive), `clientWorkspaceGrants`, `staffImpersonationLogs` (approvalStatus: pending/approved/denied/active/ended), `orgAuditEvents`, `userInvitations`, `users` (PK = Supabase UUID).

**Frontend**: `use-auth.ts`, `use-permissions.tsx` (drives `platformRole`/`isReadOnly`/`showContextSwitcher`/`isJigantoStaff`/`workspace`), `AccessPendingPage.tsx`, `AcceptInvitationPage.tsx`, `LandingPage.tsx`, plus staff-only Settings tabs (`SettingsImpersonationTab`, `SettingsStaffAuditTab`, `SettingsStaffOrgSwitcher`).

**Platform roles** (`PLATFORM_ROLES`, ranked `none<read<write<admin<god`, effective level = max across all active memberships):
- `jiganto_staff` — cross-org god-mode
- `si_super_admin` — org owner (immutable, cannot be reassigned/deleted)
- `si_consultant_pm` — cross-workspace SI user with a context switcher, optionally scoped to specific clients via `client_workspace_grants`
- `client_project_user` — locked to one client workspace
- `client_executive` — read-only
- `client_jiganto_user` — independent client-org admin (SI is a guest)

**Notable business logic / edge cases**
- `jiganto_staff` and `si_super_admin` memberships are immutable via the Settings UI.
- **Possible bug**: `requestImpersonation` writes `approvalStatus: "approved"`, but `getActiveImpersonationForStaff` queries for `approvalStatus === "active"` — a freshly started impersonation may not be found as "active" by that lookup. Impact limited since impersonation start is staff-only gated.
- Read-only enforcement (`enforceReadOnlyApiAccess`) blocks all mutation verbs below `write` level, with an exemption list for auth/session/impersonation routes.

---

## 3. Settings / Tenants

**Purpose**: Tenant administration — users, roles, org units/cost centres, invitations, branding, billing/seats, integrations, data governance, API keys, audit logs. Almost entirely inline routes in `server/routes.ts`.

**Key features**
- Tenant CRUD via `shared/routes.ts` typed contract + inline `PUT /api/tenants/:id`.
- **Two parallel role systems coexist**: legacy `user_roles` (JSON per-module CRUD permission templates) and the newer `orgMemberships.platformRole` — both surfaced in Settings UI (`SettingsModuleRolesTab` vs `SettingsPlatformRolesTab`).
- Seat-limited invitations (`assertSeatAvailable`) with email + tenant webhook dispatch (`invitation.created/revoked/accepted`).
- Org units (group→company→division/brand→department hierarchy) and cost centres, with bulk/individual user assignment.
- Billing/seats stored denormalized inside `tenants.brandingConfig.billing.seatCount` — no dedicated billing table.
- AI usage tracking + per-tenant AI limits.
- Data governance: self-service export (JSON/ZIP), erasure request/approval workflow, scheduled retention job, notification digests — all gated by `tenant.brandingConfig.dataGovernance.allowSelfServiceExport`.
- Tenant API keys and webhook/SMTP test endpoints, stored inside `brandingConfig` JSON (not normalized tables).
- Org audit log covering invitations, membership changes, workspace grants, API-key creation, export/erasure.
- Public-holiday import + business-calendar config for scheduling.

**API endpoints** (`/api/settings/*` unless noted)

| Method | Path | Purpose |
|---|---|---|
| GET/POST | /api/tenants | List/create tenant |
| GET/PUT | /api/tenants/:id | Get/update tenant (org-admin, own org only unless Jiganto staff) |
| GET | /api/settings/clients | Lightweight client list for pickers |
| GET/POST | /api/settings/roles | Legacy module-permission roles |
| PUT/DELETE | /api/settings/roles/:id | Update/delete role |
| GET/POST | /api/settings/invitations | List/create (seat-checked) |
| DELETE | /api/settings/invitations/:id | Revoke |
| GET | /api/settings/audit/impersonation | Impersonation audit (staff/si_super_admin) |
| GET/PUT | /api/settings/preferences | Per-user preferences |
| POST | /api/settings/webhook-test | Test tenant webhook |
| POST | /api/settings/data-export | Log export request |
| GET | /api/settings/data-export/download | Download JSON/ZIP export |
| GET | /api/settings/ai-usage, /ai-usage/export | AI usage stats + CSV |
| GET/POST | /api/settings/ai-limits | Read/set AI usage limits |
| DELETE | /api/settings/ai-limits/:id | Remove limit |
| POST | /api/settings/smtp-test | Test tenant SMTP |
| GET/POST/DELETE | /api/settings/api-keys[/:id] | Tenant API key management |
| POST | /api/settings/retention-run, /digest-run | Manually trigger jobs |
| POST | /api/settings/data-erasure-request | Submit erasure request |
| GET | /api/settings/data-erasure-requests | List |
| POST | /api/settings/data-erasure-requests/:id/approve | Approve/execute |
| POST | /api/settings/holidays/import | Import public holidays |
| GET | /api/settings/business-calendar | Business calendar config |
| POST | /api/settings/logo | Upload tenant logo |
| GET/POST | /api/settings/org-units/export, /import | Bulk CSV |
| GET | /api/settings/audit/org-events | General audit trail |
| GET/PUT/POST/DELETE | /api/settings/users[/:id] | Profile CRUD |
| GET/PUT | /api/settings/users/:id/permissions | Legacy per-user module permissions |
| GET/POST/PUT/DELETE | /api/settings/org-units[/:id] | Org-unit hierarchy |
| GET/POST/PUT/DELETE | /api/settings/cost-centres[/:id] | Cost-centre CRUD |
| GET | /api/settings/assignment-counts | Assignment counts |
| GET/POST | /api/settings/users/:id/assignments | User's org/cost-centre assignments |
| POST | /api/settings/bulk-assignments | Bulk-assign users |
| PUT/DELETE | /api/settings/assignments/:id | Update/remove assignment |

**Data model**: `tenants` (branding/theming/contact + catch-all `brandingConfig` JSONB doubling as billing/API-key/webhook/data-governance/SMTP store), `userRoles`, `userInvitations`, `orgUnits`, `costCentres`, `profiles`, `userModulePermissions`, `userProjectAssignments`.

**Frontend**: `SettingsPage.tsx` (1,922 lines; tabs: personal, organization, branding, users, customers, cost-centres, roles, audit, integrations, notifications, ai-usage, billing, data, crm) + ~25 component files under `client/src/components/settings/`.

---

## 4. Workspaces (Notion-style collaboration)

**Purpose**: Internal collaboration tool — hierarchical pages, embedded Notion-style databases, templates. Distinct from "Clients" (§5).

**Key features**
- Hierarchical pages with document status (draft/review/awaiting_approval/published/archived), version history, nested/embedded databases.
- Databases: dynamic column types (text/long_text/number/select/multi_select/date/checkbox/person/url/rating/rag/created_date), JSON row data, saved views, CSV import/XLSX export.
- Row-level collaboration: comments, attachments, activity log, and a **30-second optimistic row lock** to prevent concurrent edits.
- Live presence tracking (60-second window).
- Public sharing via independently revocable tokens for both pages (`/public/workspace/pages/:token`, HTML) and rows (`/public/workspace/rows/:token`, JSON) — no expiry, manual revoke only.
- 8 seeded system templates (Meeting Management, Sprint Planning, Client Onboarding, Risk Tracker, Team OKRs, Decision Log, Project Retrospective, Knowledge Base) + user-saved custom templates; full deep-copy duplication.
- "Copy page to Documents" bridges into Document Management.
- **Generic task-tracker board engine** reused across Service Desk, Help Desk, BPM, Test Management, PM projects via a canonical 12-column schema (`shared/workspace-task-tracker.ts`) — Workspaces' database engine doubles as the platform's shared Kanban/table primitive.
- Workspace-level member permissions (view/edit/admin) independent of platform role.
- **Client-role users are blocked from all `/api/workspaces*` routes** when inside a client workspace — this is an SI-internal tool.

**API endpoints** (selected; ~45 routes total across base CRUD + extensions)

| Method | Path | Purpose |
|---|---|---|
| GET/POST | /api/workspaces | List/create |
| GET/PATCH/DELETE | /api/workspaces/:id | Detail/update/delete |
| GET/POST | /api/workspaces/:id/members | Membership |
| DELETE | /api/workspace-members/:id | Remove member |
| PATCH | /api/workspaces/:id/favorite | Favourite toggle |
| GET/POST | /api/workspaces/:workspaceId/pages | Pages |
| GET/PATCH/DELETE | /api/workspace-pages/:id | Page detail/update/delete |
| GET/POST | /api/workspace-pages/:pageId/databases | Embedded databases |
| POST | /api/workspace-pages/:pageId/databases/from-template | DB from template |
| GET/PATCH/DELETE | /api/workspace-databases/:id | DB detail/update/delete |
| GET/POST/PATCH/DELETE | /api/workspace-databases/:databaseId/columns, /workspace-database-columns/:id | Columns |
| GET/POST/PATCH/DELETE | /api/workspace-databases/:databaseId/rows, /workspace-database-rows/:id | Rows |
| POST | /api/workspace-database-rows/reorder | Reorder |
| GET/POST/PATCH/DELETE | /api/workspace-databases/:databaseId/views, /workspace-saved-views/:id | Saved views |
| GET | /api/workspaces/list?filter= | Filtered list (all/favorites/recent/shared/mine) |
| POST | /api/workspaces/:id/access | Record last-accessed |
| POST | /api/workspaces/:id/duplicate | Deep-copy |
| POST | /api/workspaces/:id/archive | Archive |
| GET | /api/workspace-templates | List (auto-seeds system templates) |
| POST | /api/workspaces/from-template/:templateId | Create from template |
| POST | /api/workspaces/:id/save-as-template | Save as custom template |
| POST | /api/workspace-pages/:id/copy-to-documents | Copy → Documents |
| GET/POST | /api/workspace-database-rows/:id/detail, /comments, /attachments, /activity | Row side panel |
| POST/POST | /api/workspace-database-rows/:id/lock, /unlock | Row locking |
| POST/GET | /api/workspaces/:id/presence | Live presence |
| GET/POST | /api/workspace-pages/:id/versions | Version history |
| POST | /api/workspace-page-versions/:id/restore | Restore version |
| GET/POST | /api/workspace-pages/:id/comments | Page comments |
| POST | /api/workspace-databases/:id/import-csv | CSV import |
| GET | /api/workspace-databases/:id/export-csv, /export-xlsx | Export |
| GET/POST | /api/projects/:projectId/tracking-board | Shared task-tracker board |
| GET | /api/service-desk/tracking-board, /api/help-desk/tracking-board, /api/bpm/tracking-board, /api/tm/projects/:projectId/tracking-board | Module-specific tracking boards |
| PATCH | /api/workspace-members/:id/permission | Change member permission |
| GET/POST/DELETE | /api/workspace-pages/:id/public-token, /api/workspace-database-rows/:id/public-token | Public share links |
| GET | /public/workspace/pages/:token, /public/workspace/rows/:token | Public unauthenticated views |

**Data model**: `workspaces`, `workspaceMembers`, `workspacePages` (self-referencing parentId), `workspaceDatabases`, `workspaceDatabaseColumns`, `workspaceDatabaseRows`, `workspaceSavedViews`, `workspaceAccessLog`, `workspaceRowComments/Attachments/Activity`, `workspacePageVersions`, `workspacePageComments`, `workspaceDocumentCopies`, `workspaceTemplates`, `workspacePresence`.

**Frontend**: `WorkspacesPage.tsx` (2,371 lines) + `client/src/components/workspaces/` (18 files: table/kanban/calendar views, row detail panel, presence avatars, share dialogs, filter bar, KPI strip, `ModuleTrackingBoard`).

---

## 5. Clients (SI client workspaces)

**Purpose**: Represents each SI client engagement as an isolated "client workspace" — the multi-tenant boundary *within* a tenant.

**Key features**
- Lifecycle: `active → archived → pending_delete → purged`, with name-confirmation-gated soft-delete (sets `purgeAt`), restore/unarchive, and a staff-only purge-expired sweep.
- Roster KPIs: total clients, active engagements, projects tracked, at-risk count.
- Per-client **module visibility** toggles for a configurable subset (`resource-mgmt`, `service-desk`, `test-mgmt`, `bpm`); business-mgmt/clients/crm/finance-mgmt/customer-mgmt are **always hidden** inside any client workspace regardless of config — prevents SI-internal data leakage.
- Client-scoped membership (`client_users`) with roles `workspace_admin/editor/viewer` and a member-type (`si` vs `client`).
- Separate client-invitation token system (7-day expiry) — distinct from org invitations.
- Auto-provisioning on creation: creator added as `workspace_admin`, default module-visibility seeded, dedicated chat team + `#announcements` channel created.
- Session concept `session.activeClientId` ("workspace context") drives the entire workspace-scoping middleware chain.
- Slug uniqueness auto-suffixing (`clientA`, `clientA-1`, …) for `/ws/:slug` deep links.

**API endpoints**

| Method | Path | Purpose |
|---|---|---|
| GET/PUT | /api/clients/workspace-context | Read/set active client workspace for session |
| GET | /api/clients/kpis | Portfolio KPI summary |
| GET | /api/clients | List (full for SI, own workspace only for client-role) |
| GET | /api/clients/pmo-dashboard | Master PMO cross-client dashboard |
| GET | /api/clients/by-slug/:slug | Slug lookup |
| GET | /api/clients/me | Caller's locked client membership |
| GET | /api/clients/admin/pending-delete | Clients pending purge |
| GET | /api/clients/:id | Full detail (users, invitations, module visibility, summary) |
| POST | /api/clients | Create (SI Super Admin only; auto-provisions workspace) |
| PUT | /api/clients/:id | Update |
| DELETE | /api/clients/:id | Archive |
| POST | /api/clients/:id/unarchive | Restore from archived |
| POST | /api/clients/:id/delete-request | Request permanent deletion |
| POST | /api/clients/:id/restore | Undo pending-delete |
| GET/POST | /api/clients/:id/users | List/add members |
| DELETE | /api/clients/:id/users/:userId | Remove member |
| POST | /api/clients/:id/invitations | Invite to client workspace |
| GET/PUT | /api/clients/:id/module-visibility | Module visibility config |
| GET | /api/clients/invitations/:token/preview | Public preview |
| POST | /api/clients/invitations/:token/accept | Accept invite |
| POST | /api/clients/purge-expired | Staff-only hard purge |

**Data model**: `clients` (slug, shortCode, status, engagementStatus, contractValue/dates, crmAccountId linkage, accountManagerId, deletedAt/purgeAt), `clientUsers` (role, memberType, isActive), `clientModuleVisibility`, `clientInvitations`.

**Frontend**: `ClientsPage.tsx` (964 lines, grid/table toggle), `ClientDetailPage.tsx`, `client/src/components/clients/` (admin panel, delete-confirmation dialog, members panel, module-visibility panel). `use-client-context.tsx` is the central provider resolving active client from session/URL-slug/locked-membership, exposing `isMasterView`/`isClientUser`/`isReadOnly`/`canViewPmoMaster` and a Cmd/Ctrl+Shift+W workspace-toggle shortcut.

**Notable business logic**
- Access tiers: `canAccessClientsModule` (SI + staff only), `canCreateClient`/`canDeleteClient` (Super Admin/staff only), `canManageClientMembers` (Super Admin + Consultant/PM + staff).
- Auto-single-client fallback: a non-PMO SI user in a tenant with exactly one client is silently placed into it; zero clients → master mode; 2+ clients with no PMO access → 403.
- Defense-in-depth: `restrictClientWorkspaceModules` middleware blocks client-role users from Workspaces/BPM/TM/Org-Chart/Surveys/e-Sign/Admin routes entirely — not just UI-hidden.

---

## 6. Dashboard

**Purpose**: Authenticated home screen — role/workspace-scoped KPIs, per-module analytics, a drag-and-drop custom dashboard builder with AI generation, sharing, and version history.

**Key features**
- KPI strip with both plain GET and a **Server-Sent Events stream** (30s refresh).
- Per-module dashboards: Projects, Tasks, CRM, Help Desk, Finance, Business.
- **Bespoke (custom) dashboards**: drag/resizable widget grids (1/2/3-col layouts), CRUD + duplicate + reorder/add/update/remove widgets, tenant/user/share-ACL scoped.
- Sharing with a specific user or client workspace (view/edit permission); scheduled email digest (daily/weekly) of a dashboard.
- Full version history with restore.
- AI dashboard generation from a natural-language prompt (picks 3–6 widgets from catalog); separate AI narrative-insights endpoint.
- Module entitlements read from `tenant.brandingConfig.billing.modules` (licensing axis, independent of RBAC).
- Generic widget-data resolver (`/api/dashboard-data/:widgetType`) for arbitrary widget types without a bespoke endpoint each.

**API endpoints**

| Method | Path | Purpose |
|---|---|---|
| GET | /api/dashboard/kpi-strip | KPI snapshot |
| GET | /api/dashboard/kpi-strip/stream | SSE live stream |
| GET | /api/dashboard/module-entitlements | Licensed module keys |
| GET | /api/dashboard/briefing | Daily briefing summary |
| GET | /api/dashboard/module/{projects,tasks,crm,helpdesk,finance,business} | Per-module payloads |
| GET | /api/dashboard/projects | Scoped project list for widgets |
| GET | /api/dashboard/widget-catalog | Available widget types |
| GET | /api/dashboard-data/:widgetType | Generic scoped data resolver |
| GET/POST | /api/dashboards | List/create bespoke dashboards |
| GET/PATCH/DELETE | /api/dashboards/:id | Detail/update/delete |
| POST | /api/dashboards/:id/duplicate | Duplicate |
| GET | /api/dashboards/:id/history | Version history |
| POST | /api/dashboards/:id/history/:hid/restore | Restore version |
| POST | /api/dashboards/:id/widgets/reorder | Reorder |
| POST | /api/dashboards/:id/widgets | Add widget |
| PATCH/DELETE | /api/dashboards/:id/widgets/:wid | Update/remove widget |
| POST | /api/dashboards/:id/share | Share |
| POST | /api/dashboards/:id/digest | Schedule digest |
| POST | /api/dashboard/ai/generate | AI-generate a dashboard |
| POST | /api/dashboard/ai-insights | AI narrative insights |
| GET/PATCH | /api/dashboard/preferences | Per-user preferences |

**Data model**: `dashboards` (type: system/module/bespoke; layout), `dashboardWidgets`, `dashboardShares`, `widgetCache`, `dashboardHistory`.

**Frontend**: `Dashboard.tsx` (840 lines) + `client/src/components/dashboard/` (16 files: KPI strip, briefing strip, context selector, bespoke view/settings, widget picker, AI-dashboard dialog, history panel, share dialog, executive overview).

**Notable**: AI generation requires `OPENAI_API_KEY`, degrades to 503 otherwise. Impersonation-aware — an impersonating staff member sees the target user's dashboard.

---

## 7. CRM

**Purpose**: Full sales CRM — lead-to-cash: leads, accounts, contacts, opportunities/pipelines, contracts, activities, sales forecasting, integrated with resource planning and Finance budgeting.

**Architecture note**: No dedicated `server/crm/` folder — all ~140 endpoints are inline in `server/routes.ts` (~lines 2476–4592). Only small shared helpers live outside routes.ts (`server/lib/crm-pipeline.ts`, `crm-api-body.ts`, `shared/crm-pipeline.ts`, `shared/crm-forecast-period.ts`, `shared/resource-plan-budget.ts`).

**Key features**
- Lead management: bulk import/delete, one-click **convert** (lead → account + contact + opportunity).
- Multiple pipelines with per-pipeline stages; kanban board, cloning, archiving, **convert-to-project**.
- Accounts, Contacts (with org-chart/relationship graph), Contracts, "Customer Systems" (installed systems per account).
- Activities, Tasks, polymorphic Notes, Attachments.
- Sales forecast matrix — configurable period grain, scenario toggle (expected/best/worst), pipeline/stage/owner filters.
- CRM Custom Fields, Automation Rules, Saved Views, Email Templates + logs, Territories.
- Rate Cards + items (labour cost basis for resource plans); Resource Plan Templates and per-opportunity Resource Plans (role/phase/dates/day-rate rows), cloning, reordering, stakeholder notify.
- Geo map view, Gantt/document alt-views, integrated capacity board, CSV paste-import, custom columns/labels.

**API endpoints** (all under `/api/crm`, exhaustive)

| Method | Path | Purpose |
|---|---|---|
| POST | /seed-demo-data | Seed demo data |
| GET | /dashboard-stats | KPIs |
| CRUD | /accounts[/:id] | Accounts |
| GET | /accounts/:id/tickets, /documents | 360-view related data |
| CRUD | /contacts[/:id] | Contacts |
| CRUD | /contacts/:id/relationships, /contact-relationships[/:id] | Contact relationship graph |
| CRUD | /saved-views[/:id], /email-templates[/:id] | Saved views/templates |
| GET/POST | /email-logs | Email logs |
| CRUD | /forecasts[/:id], /territories[/:id], /custom-fields[/:id], /automation-rules[/:id] | Config entities |
| GET | /forecast-matrix | Computed forecast grid |
| CRUD | /leads[/:id] | Leads |
| POST | /leads/bulk-import, /contacts/bulk-import, /accounts/bulk-import, /opportunities/bulk-import, /contracts/bulk-import | Bulk import |
| POST | /accounts/bulk-delete, /contacts/bulk-delete, /leads/bulk-delete, /opportunities/bulk-delete, /contracts/bulk-delete | Bulk delete |
| POST | /leads/:id/convert | Convert lead |
| CRUD | /pipelines[/:id], /stages[/:id], /opportunities[/:id] | Pipeline core |
| POST | /opportunities/:id/clone, /archive, /convert-to-project | Opportunity actions |
| CRUD | /activities[/:id] (+bulk-delete), /tasks[/:id], /notes[/:id] | Activity entities |
| GET/POST/DELETE | /attachments[/:id] | Attachments |
| CRUD | /contracts[/:id], /systems[/:id] | Contracts, systems |
| CRUD | /rate-cards[/:id], /rate-cards/:id/items, /rate-card-items/:id | Rate cards |
| CRUD | /resource-plan-templates[/:id], /:id/rows, /resource-plan-template-rows/:id | RP templates |
| GET | /resource-plans/summaries, /resource-plans/all-rows | RP roll-ups |
| GET | /opportunities/:oppId/resource-plans[/resource-plan] | Per-opportunity plan(s) |
| GET/POST/PUT | /resource-plans/:planId(/clone), /rows, /reorder | RP detail/rows |
| DELETE | /resource-plan-rows/:id | Delete row |
| POST | /resource-plans/:planId/notify | Notify stakeholders |
| POST | /seed-resource-plan-data | Seed demo data |

**Data model** (`shared/models/crm.ts`, ~802 lines, `crm_` prefix): `crmAccounts`, `crmContacts`, `crmContactRelationships`, `crmLeads`, `crmPipelines`, `crmOpportunityStages`, `crmOpportunities`, `crmResourceRequirements`, `crmActivities`, `crmTasks`, `crmNotes`, `crmContracts`, `crmCustomerSystems`, `crmAttachments`, `crmSavedViews`, `crmEmailTemplates`, `crmEmailLogs`, `crmForecasts`, `crmTerritories`, `crmCustomFields`, `crmAutomationRules`, `resourcePlanTemplates`, `resourcePlanTemplateRows`, `opportunityResourcePlans`, `opportunityResourceRows`.

**Frontend**: `CRMPage.tsx` (544 lines; tabs: dashboard/leads/opportunities/pipeline/customers/contracts/contacts/forecasting/360view/resourceplan). 42-file `client/src/components/crm/` folder — the largest in the app: `CrmPipelineKanban` (drag-drop), `SalesForecastDashboard`+`ForecastMatrix` (674 lines), `CrmResourcePlanTab`, `RateCardManager` (664 lines), `CrmGeoMap`, alt lead views (Gantt/document/paste-import/label editor), `CrmIntegratedCapacityBoard`, `ContactOrgChartView`, custom-fields admin, etc.

**Notable business logic / edge cases**
- **Legacy pipeline compatibility**: opportunities/stages with `pipelineId == null` are treated as belonging to the tenant's default pipeline — supports old data pre-dating multi-pipeline support.
- **Forecast matrix math**: only open-stage opportunities counted; per-cell value = full amount (best), amount-if-probability≥70% (worst), or amount×probability/100 (expected, default).
- **Lead conversion** resolves the correct default open stage and defaults probability to the stage's configured value or 20%.
- **CRM → Finance bridge**: `shared/resource-plan-budget.ts` converts resource-plan rows into budget labour lines consumed by Finance's budget-from-resource-plan endpoints — the one cross-module logic link between CRM and Finance.
- Some rate-card CRUD handlers under `/api/crm/rate-cards` appear to be stubs (ignore body/req) — possibly incomplete pending full Finance rate-card wiring.

---

## 8. Business Management

**Purpose**: Strategic management — OKRs/goals/objectives, strategy items, KPIs, governance, risk register, org structure — a top-down planning-to-review cockpit.

**Architecture note**: No dedicated server folder — ~90 endpoints inline in `routes.ts` (~lines 4593–5935), directly after the CRM block. Frontend logic is almost entirely in `BusinessManagementPage.tsx` (2,338 lines) — the component folder has only 2 minimal helper files, unlike CRM/Finance's larger dedicated folders.

**Key features**
- Strategy items (with bulk import), Risk register, Org structure (Departments/Processes/Tools).
- Goals → Key Results, Objectives, Initiatives, full OKR objects, KPIs with historical values.
- Business Tasks, Meetings, Governance items (decisions/policies), document links to strategy items.
- Review notes and RAG (red/amber/green) history per strategy item, with an overdue-reviews endpoint.
- Strategy map (visual strategy→goals→objectives→KPIs relationships).
- AI-assisted insights and AI drafting assist.
- **Entity reference numbering** (e.g. GOAL-001) with a backfill endpoint auto-run by the frontend on load.

**API endpoints** (all under `/api/business`)

| Method | Path | Purpose |
|---|---|---|
| GET/POST/PUT/DELETE | /strategy[/:id] (+bulk-import) | Strategy items |
| CRUD | /risks[/:id], /departments[/:id], /processes[/:id], /tools[/:id] | Registers/org structure |
| CRUD | /goals[/:id], /key-results[/:id], /kpis[/:id], /objectives[/:id], /okrs[/:id], /initiatives[/:id] | OKR hierarchy |
| CRUD | /tasks[/:id], /meetings[/:id] | Ops entities |
| GET | /stats | Dashboard KPIs |
| POST/DELETE | /seed-apex-data, /seed-demo | Demo data |
| CRUD | /review-notes[/:id] | Review notes |
| GET | /rag-history, /overdue-reviews, /strategy-map | Analytics/reporting |
| POST | /ai-insights, /ai-assist | AI features |
| GET/POST | /entity-refs, /entity-refs/backfill | Reference numbering |
| GET/POST/PATCH/DELETE | /governance[/:id] | Governance items (note: PATCH, not PUT — inconsistent with rest of module) |
| GET/POST/DELETE | /doc-links[/:id] | Document links |
| GET/POST/DELETE | /kpi-values[/:id] | KPI value history |

**Data model** (`shared/models/business.ts`, 670 lines): `strategyItems`, `risks`, `departments`, `processes`, `tools`, `goals`, `objectives`, `initiatives`, `okrs`, `keyResults`, `kpis`, `businessTasks`, `meetings`, `documentLinks`, `governanceItems`, `strategyDocumentLinks`, `strategyKpiValues`, `strategyReviewNotes`, `strategyRagHistory`, `strategyRefCounters`, `strategyEntityRefs`.

**Frontend**: `BusinessManagementPage.tsx` defines tabs (`dashboard, strategy-map, strategy, goals, objectives, initiatives, okrs, kpis, governance, reviews, documents`), each lazily querying only when active. AI insights wired via `useAIInsightsPanel`.

---

## 9. Customer Management (commercial/billing admin)

**Purpose**: Internal Jiganto-staff-only module ("Module 0") for managing Jiganto's own paying tenants — subscriptions, billing, health scoring, trials/beta programmes, discounts, Stripe sync. **Not** to be confused with CRM (which manages a *tenant's own* customers).

**Key features**
- Every route gated by `requireCommercialAdmin` (jiganto_staff / si_super_admin only).
- Customer roster with health scoring, MRR/ARR, churn/expansion tracking, renewal pipeline.
- Trial/free-access grant workflow with configurable per-grant-type approval permissions.
- Beta programme management, feature-flag toggles per customer, discount rules.
- Pricing plan management (starter/growth/enterprise).
- Stripe integration: link customer ID, manual invoice sync, signed webhook receiver.
- Tenant→commercial-profile auto-provisioning (creates a Stripe customer too, if configured, as a side effect of tenant creation).
- Usage tracking (seats, AI tokens, storage, e-sign docs) resolved live.
- AI-generated customer insights; activity log/notes; grant-notification emails.

**API endpoints** (`/api/customer-mgmt/*`, plus webhook mounted separately)

| Method | Path | Purpose |
|---|---|---|
| GET | /status | Config/readiness check |
| GET | /dashboard | Full dashboard payload |
| POST | /ai-insights | AI insights |
| GET | /customers/:slug | Customer detail |
| PUT | /settings | Module settings |
| POST | /grants | Apply access grant |
| POST | /programmes | Create beta programme |
| PATCH | /customers/:slug/feature-flags/:key | Toggle feature flag |
| POST | /stripe/sync | Manual Stripe invoice sync |
| POST | /provision/sync-tenants | Backfill missing commercial profiles |
| POST | /customers/:slug/stripe | Link Stripe customer ID |
| POST | /customers | Create customer record |
| PATCH | /customers/:slug | Update customer |
| POST | /customers/:slug/contacts | Add key contact |
| POST | /customers/:slug/notes | Add activity note |
| PATCH | /customers/:slug/plan | Change plan tier |
| POST | /customers/:slug/discounts | Apply discount |
| POST | /customers/:slug/actions | Workflow action (health_follow_up/renewal_follow_up/convert_trial/complete_scheduled_check_in) |
| POST/PATCH | /discount-rules[/:externalId] | Discount rule CRUD |
| PATCH | /pricing/plans/:tier | Update pricing plan |
| POST/DELETE | /programmes/:programmeId/participants[/:initials] | Beta programme participants |
| POST | /stripe/webhook | Stripe webhook (raw-body, signature-verified, idempotent) |

**Data model** (`shared/models/commercial.ts`): `customerMgmtSettings`, `commercialCustomers` (stripeCustomerId/SubscriptionId, plan/status/health, JSON subscription/usage/healthSignals), `commercialContacts`, `commercialFeatureFlags`, `commercialActivityLog`, `commercialAccessGrants`, `commercialProgrammes`, `commercialInvoices`, `commercialStripeEvents`, `commercialDiscountRules`, `customerMgmtPlatformMetrics`.

**Frontend**: `CustomerManagementPage.tsx` (2,803 lines — largest of the 4 module pages). Views: customers, detail (subscription/health/contacts/flags/notes/history), health, trials, programmes, renewal, pricing, billing, settings.

**Notable business logic / edge cases**
- **Health score** = weighted average of login frequency, feature breadth (blended with AI adoption 60/40), support-load (penalized), engagement/NPS proxy, renewal intent (heavily penalized near trial expiry/overdue renewal). ≥70 healthy, ≥40 watch, else at_risk.
- **Usage limits hardcoded per tier**: starter 15 users/100k AI tokens/50GB/50 esign docs; growth 40/500k/200GB/50; enterprise 999/2M/500GB/100.
- **Stripe webhook idempotency** via `commercialStripeEvents` dedupe by event ID; only invoice/subscription lifecycle events are handled, others silently accepted.
- **Known stub**: expansion MRR is hardcoded to 0 in the metrics computation.
- MRR/ARR computed live on every dashboard fetch (not pre-aggregated).
- Grant permission rules (`grantTrialExtensions`, `grantFreeAccess`, `createBetaProgrammes`, `applyManualDiscounts`) are each independently role-scoped and enforced server-side, not just UI-hidden.

---

## 10. Finance

**Purpose**: Tenant-facing financial operations — project budgeting with EVM, timesheets with two-stage approval, expense reports, client invoicing, rate cards, ERP integration.

**Key features**
- Finance settings (currency, mileage rates, invoice terms) + multi-currency exchange rates.
- Project budgets (labour/expense/milestone lines), budget-vs-actual RAG status, EVM metrics.
- **Budget creation directly from a CRM opportunity resource plan** (preview + create) — the CRM↔Finance bridge.
- Rate cards (shared basis with CRM) with a rate-resolution lookup endpoint.
- Timesheets: periods, entries, submit → PM approval → RM approval → (or reject), "copy last week," utilisation/missing-timesheet reports.
- Expense reports: items, mileage calculation by vehicle type, receipt upload, submit/approve/reject.
- Invoicing: line items, payments, credit notes, PDF generation (jsPDF), email delivery.
- ERP integrations: config CRUD, sync log, push-to-ERP action.

**API endpoints** (all under `/api/finance`)

| Method | Path | Purpose |
|---|---|---|
| GET/PUT | /settings | Finance settings |
| GET | /dashboard | Summary |
| CRUD | /exchange-rates[/:id] | Exchange rates |
| GET/POST/PUT | /budgets, /budgets/:id | Budgets |
| GET | /budgets/from-resource-plan/:planId/preview | Preview from CRM resource plan |
| POST | /budgets/from-resource-plan | Create from CRM resource plan |
| POST | /budgets/:id/recalculate | Recalc totals/actuals |
| CRUD | /rate-cards[/:id] | Rate cards |
| GET | /rate-cards/resolve | Resolve applicable rate |
| POST/PUT/DELETE | /rate-cards/:id/items, /rate-card-items/:id | Rate card items |
| GET | /timesheets/periods[/:id], /periods/:id/entries, /projects/:projectId/entries | Timesheet reads |
| POST | /timesheets/periods/:id/submit, /approve-pm, /approve-rm, /reject | Approval workflow |
| POST | /timesheets/periods, /periods/:id/entries | Create period/entry |
| DELETE | /timesheets/entries/:id | Delete entry |
| POST | /timesheets/periods/:id/copy-last-week | Duplicate entries |
| GET | /timesheets/reports/utilisation, /reports/missing | Reports |
| POST | /expenses/mileage/calculate | Mileage reimbursement |
| POST | /invoices/:id/send-email | Send invoice |
| CRUD | /expenses/reports[/:id] | Expense reports |
| POST | /expenses/reports/:id/submit, /approve, /reject | Expense workflow |
| POST/PUT/DELETE | /expenses/reports/:id/items, /expenses/items/:id | Expense line items |
| POST | /expenses/items/:id/receipt | Upload receipt |
| GET/POST/PUT | /invoices, /invoices/:id | Invoices |
| POST | /invoices/:id/send, /payments, /credit-note | Invoice actions |
| GET | /invoices/:id/pdf | PDF (or JSON via ?format=json) |
| CRUD | /erp/integrations[/:id] | ERP config |
| GET | /erp/sync-log | Sync history |
| POST | /erp/sync | Push to ERP |

**Data model** (`shared/models/finance.ts`): `financeSettings`, `exchangeRates`, `projectBudgets`, `budgetLabourLines`, `budgetExpenseLines`, `budgetMilestoneLines`, `expenseReports`, `expenseItems`, `financeInvoices`, `financeInvoiceLines`, `financeInvoicePayments`, `erpIntegrations`, `erpSyncLog`.

**Frontend**: `FinanceManagementPage.tsx` (243 lines; tabs: dashboard/budgets/timesheets/expenses/invoices/rate-cards/integrations/settings, badge counts for pending approvals/unpaid invoices).

**Notable business logic / edge cases**
- **EVM**: PV = budget×elapsed%, EV = budget×progress%, AC = actual cost, SPI=EV/PV, CPI=EV/AC, EAC=budget/CPI (defaults SPI/CPI to 1 when denominators are 0).
- **Budget RAG**: green ≤80% spent, amber ≤95%, red >95% (aggressive red threshold).
- Budget-from-resource-plan refuses if the opportunity isn't linked to a project yet, or if a budget already exists for that project (one-budget-per-project rule).
- **ERP integration is effectively webhook-only today**: only `system: "generic"` with a configured webhook URL actually syncs; named systems (QuickBooks/Xero/NetSuite) immediately fail with "not configured — add OAuth credentials or use a generic webhook" — UI/schema-ready but not wired to real OAuth sync.
- Money stored as integer pence throughout (shared convention with Customer Management).

---

## 11. Projects Management (incl. Gantt/WBS)

**Purpose**: The core PM workspace — a per-project shell hosting a configurable set of "tools" (Gantt, WBS, RAID, RACI, Agile board, Milestones, Deliverables, Team, Finance, Timesheets, Status Reporting, BPM, etc.) on a single unified schedule model.

**Key features**
- **Unified Gantt/WBS engine**: every schedule row except the synthetic project root is one `pm_tasks` row; its "type" (`ganttType`: program/project/release/phase/workstream/activity/task/milestone) is just a property. Legacy `pm_project_phases`/`pm_workstreams`/`pm_milestones` auto-migrate into `pm_tasks` on first load, idempotently.
- Gantt chart is a **self-contained vanilla-JS engine** (`client/public/gantt-v4-engine.js`, 6,428 lines) embedded via iframe `srcDoc`, fed by REST data.
- **Critical Path Method** computed client-side (forward/backward pass over `predId` chain, FS/SS/FF dependency types, 0.01-day slack tolerance) — note: only single-predecessor chains, despite the schema supporting `predecessorIds`/`successorIds` arrays.
- WBS is a read-only rollup table over the same `pm_tasks`/phase rows.
- Gantt versions/snapshots (save-as-copy, activate, compare, import).
- **RAIDD log** (Risks/Assumptions/Issues/Dependencies/Decisions) — one unified table with escalation workflow, activity log, linked items, bulk import.
- **RACI module** — full role/activity/type/assignment/reusable-template model.
- **Agile/Scrum**: two parallel generations — legacy Wagile (per-phase sprints/backlog) and a newer flat Agile Workstream board (epics→sprints→stories→defects); a consolidation helper de-dupes legacy tool badges.
- Milestones (with isCritical/RAG/ref codes), Deliverables tracker (phases, owners/reviewers/approvers, audit log, versioning), Business Requirements module.
- **Project Tools framework**: ~26 tool types across 6 categories can be enabled/reordered/configured per project, with computed per-tool status badges + overall health score.
- Workspace-scoping middleware enforces every `/api/pm/projects/:id/*` route belongs to the caller's active client workspace.

**API endpoints** (143 distinct routes under `/api/pm/`, mostly inline in `routes.ts`)

| Area | Endpoints |
|---|---|
| Projects | GET/POST /projects, GET/PUT/DELETE /projects/:id, POST /projects/:id/seed-s4hana |
| Programs/Portfolios (core CRUD) | GET/POST /portfolios[/:id], /programs[/:id] |
| Phases | GET/POST /phases[/:id], GET /projects/:projectId/phases |
| Workstreams | GET/POST /workstreams[/:id] |
| Tasks/Gantt | GET /projects/:projectId/tasks, POST /tasks, GET/PUT/DELETE /tasks/:id, DELETE /projects/:projectId/tasks, POST /projects/:projectId/tasks/bulk-import, /gantt/import |
| Gantt versions | GET /gantt/versions[/active], POST /gantt/versions, PATCH/DELETE /gantt/versions/:vid, POST /gantt/versions/:vid/activate, /copy |
| Milestones | GET/POST /milestones[/:id], GET /projects/:projectId/milestones, POST /milestones/import |
| RAIDD | POST /raidd, GET/PUT/DELETE /raidd/:id, GET /projects/:projectId/raidd, POST bulk-import |
| RACI | CRUD on /raci/{roles,activities,types,assignments,templates}[/:id] |
| Agile | GET/POST /agile/workstreams, GET /agile/dashboard, CRUD on /agile/{epics,sprints,stories,defects}[/:id] |
| Sprints/Backlog (Wagile) | GET/POST/PUT/DELETE /sprints[/:id], /backlog[/:id] |
| Deliverables | CRUD /deliverable-phases[/:id], /deliverables[/:id], POST /deliverable-phases/template, PUT /replace |
| Requirements | GET/POST /requirements, GET/PUT/DELETE /requirements/:id |
| Team | POST /team, PUT/DELETE /team/:id, GET /projects/:projectId/team |
| Project Tools | GET /projects/:projectId/tools[/tool-badges], POST /tools, POST /tools/bulk, PUT /tools/reorder, PUT/DELETE /project-tools/:id |
| Templates | CRUD /templates[/:id] |
| Misc | GET /projects/:projectId/documents, POST /seed-erp-portfolio |

**Data model**: `pm_projects` (per-dimension RAG, governance fields, metadata JSONB), `pm_project_phases`, `pm_workstreams`, `pm_milestones`, `pm_tasks` (unified engine table: predecessorIds/successorIds arrays, legacySource breadcrumbs, wbsCode), `pm_gantt_versions`, `pm_team_members`, `pm_raidd_items`, 5× `pm_raci_*` tables, `pm_agile_workstreams`/`pm_epics`/`pm_agile_sprints`/`pm_agile_stories`/`pm_agile_defects`, `pm_sprints`/`pm_backlog_items` (legacy), `pm_deliverable_phases`/`pm_deliverables`, `pm_business_requirements`, `pm_phase_templates`, `pm_project_tools`.

**Frontend**: `ProjectsManagementPage.tsx` (1,114 lines) lazy-loads 20+ tool components (`AgileWorkspace`, `ReactGanttChart`, `RaiddLogTool`, `DeliverablesTracker`, `MilestoneTracker`, `PmRaciTool`, `PmResourceTrackerTool`, `PmTimesheetsTool`, `PmFinanceTrackerTool`, `PmWeeklyStatusReport`, `PmBpmTool`, `PmWbsTool`, `HelpDeskProjectTicketsTool`, `ProjectWhiteboardTool`, etc.), `ProjectWorkspaceSidebar.tsx` (per-tool badges), `CreateWorkItemWizard.tsx`.

**Notable business logic / edge cases**
- "Type is a property" model means changing Phase→Task rewrites fields on the same row, not moving data between tables — legacy tables kept only as compatibility shims.
- Migration is idempotent/partial-run safe via `legacySource`/`legacySourceId` breadcrumbs.
- Project row 1 (synthetic root) isn't a `pm_tasks` row — edits PUT directly to `/api/pm/projects/:id`.

---

## 12. Portfolio Management

**Purpose**: Cross-project rollup/governance — portfolios/programmes with many-to-many project links, executive dashboards, RAG health matrices with trend history, RAID consolidation, milestone registers, "360 Report" generation/export/scheduling.

**Key features**
- Hierarchy: `pm_portfolios` → `pm_programs` → `pm_projects`, plus an explicit **many-to-many** `pm_project_portfolios` join (a project can belong to multiple portfolios) alongside a legacy single `pm_projects.portfolioId` FK kept for backward compatibility — watch for the two disagreeing.
- Executive dashboard, programmes list/detail, roadmap.
- **Health Matrix**: 8-dimension RAG scorecard per project (overall/schedule/budget/quality/delivery/risk/resources/stakeholders), scored 0–100 (green=100/amber=60/red=20 averaged), weekly snapshots via a cron job, historical replay by week.
- **360 Report**: full narrative report (exec summary, RAG commentary, highlights/lowlights, Level-1-Plan Gantt bar chart, Activity Plan swimlane matrix) — editable inline and **synced back into real phase/workstream DB rows**, with AI-generated narrative and PPTX export.
- RAID consolidated view and Milestone Register roll up across the whole portfolio.
- **Custom report builder**: user-defined reports with configurable data source/fields/filters/group-by/sort, schema introspection.
- **Report scheduling**: daily/weekly/monthly cadence, recipient list, pdf/pptx format, executed by a daily job.

**API endpoints** (`/api/portfolio/*`)

| Method | Path | Purpose |
|---|---|---|
| GET | /dashboard | Executive dashboard |
| GET | /programmes, /programmes/:source/:id | List/detail (source = project\|program) |
| GET | /roadmap | Roadmap data |
| GET | /health-matrix (+?snapshotWeek=), /health-matrix/snapshot-weeks, /health-matrix/history/:projectId | Health matrix |
| POST | /health-matrix/capture | Manual snapshot capture |
| GET | /milestones | Milestone register |
| GET/POST | /portfolios | List/create |
| PUT/DELETE | /portfolios/:id | Update/delete |
| PUT | /projects/:projectId/portfolios | Link project to N portfolios |
| GET/PUT | /portfolios/:id/projects | Portfolio↔project link management |
| GET | /reports/summary, /reports/raid-consolidated | Reports |
| GET/POST | /reports/360/:projectId | 360 report |
| GET | /reports/360/:projectId/pptx | PPTX export |
| GET/POST | /reports/schedules | Report schedules |
| GET/POST | /custom-reports | Custom reports |
| GET | /custom-reports/fields/:dataSource | Field introspection |
| GET/PUT/DELETE | /custom-reports/:id | Update/delete |
| POST | /custom-reports/:id/run, /custom-reports/run | Run saved / ad-hoc report |

**Data model**: `pm_portfolios`, `pm_programs`, `pm_project_portfolios`, `pm_health_matrix_snapshots`, `pm_report_schedules`, `pm_report_snapshots`, `pm_custom_reports` — plus heavy reliance on Projects Management tables for rollups.

**Frontend**: `PortfolioManagementPage.tsx` with tabs Dashboard/Portfolios/Programmes/Roadmap/Health/Reports/Milestones (12-file `client/src/components/portfolio/` folder incl. `Level1PlanGantt`, `ActivityPlanMatrix`, `PortfolioCustomReportBuilder`).

**Notable**: Two different health-score formulas coexist in the codebase (Portfolio's flat 8-dimension average vs. Project Tools' RAG-average-minus-risk-penalty) for different surfaces — worth reconciling if a single "health" number is expected to match everywhere.

---

## 13. Tasks Management

**Purpose**: A cross-module "My Tasks" aggregation layer — merges native personal/team tasks with obligations surfaced from other modules into one unified list/board.

**Key features**
- **Aggregates 6+ sources**: native `tasks`, `pmTasks` (Projects), `crmTasks`, `signoffSigners`/`signoffRequests` (e-Sign), `timesheetPeriods` (Finance/Resources), `businessTasks`, `governanceItems` — returned as normalized `AggregatedTask[]` with composite IDs (e.g. `native:123`) so write-back routes correctly to the owning module.
- Multi-view board: table, kanban, calendar, gantt, list — each a saved per-user/tenant view.
- Subtasks/comments/time-logs/attachments/links — **native tasks only**; aggregated cross-module tasks are read/status-update only.
- AI tools: prioritise, weekly summary, natural-language → structured tasks, and a lightweight regex-based due-date detector (non-AI fallback).
- Bulk import (append/replace) and Task Boards for grouping.

**API endpoints** (`/api/tasks/*`)

| Method | Path | Purpose |
|---|---|---|
| GET | / | List (filters: source/status/priority/dueDatePreset/projectId/workspaceId/search) |
| GET | /summary | KPI counts |
| GET | /:id | Detail |
| POST | / | Create native task |
| PUT | /:id | Update (routes by ID shape) |
| DELETE | /:id | Delete (native only) |
| GET | /meta/workspaces, /meta/projects | Filter dropdown scopes |
| GET/POST | /views | Saved views |
| DELETE | /views/:id | Delete view |
| GET/POST | /boards | Task boards |
| POST | /ai/prioritize, /ai/summarise-week, /ai/from-text, /ai/detect-due-date | AI tools |
| POST | /bulk-import | Bulk import |
| GET/POST | /:taskId/subtasks | Subtasks |
| PUT/DELETE | /subtasks/:id | Update/delete subtask |
| GET/POST | /:taskId/comments | Comments |
| GET/POST | /:taskId/time-logs | Time logs |
| GET/POST | /:taskId/attachments | Attachments |
| DELETE | /attachments/:id | Delete attachment |
| GET/POST | /:taskId/links | Links |
| DELETE | /links/:id | Delete link |

**Data model**: native `tasks` + `task_boards`, `task_links`, `task_subtasks`, `task_comments`, `task_time_logs`, `task_attachments`, `task_recurrence`, `task_reminders`, `task_views`.

**Frontend**: `TaskManagementPage.tsx` (345 lines) + `client/src/components/tasks/` (KPI strip, filter bar, quick-create, detail sheet, AI tools panel, badges).

---

## 14. Resource Planning

**Purpose**: Forward-looking, persona-scoped workforce planning — demand vs. supply, resource heat-mapping/scheduling, bench management, pipeline-driven demand, recruitment forecasting, scenario/what-if planning with AI insights. Sits strictly *above* Resources Management (§15) — it owns no headcount data of its own beyond scenarios/recruitment/audit.

**Key features**
- **Persona-based access**: 4 personas (`res-mgr`, `exec`, `sales`, `hr`), each with distinct read/write ACLs across 10 features. Which personas a user may even assume is separately gated by platform role + Resources access scope; responses are field-redacted per persona (e.g. `exec`/`sales` never see bench/recruitment cost fields).
- Executive dashboard, Demand vs Supply matrix (skill × month, CSV/PDF export), Heat map (week/month/quarter granularity), drag/drop Scheduler with move/extend/promote actions.
- **Booking conflict detection**: overlap-checks against a resource's other active allocations, flags over-allocation vs. `workingDaysPerWeek` capacity — not calendar/holiday-aware.
- Bench Management with AI auto-match to open roles.
- **Pipeline-driven demand**: CRM opportunities synced into resource demand, with scenario weighting and a CRM webhook trigger.
- Recruitment forecasting (headcount/target month/time-to-hire/cost) with HR export.
- Scenario planning (saved what-if scenarios: revenue forecast, demand FTE, utilisation forecast, shortfall FTE).
- AI Workforce Planner (NL query + daily proactive insights).
- Tenant-scoped in-memory TTL response cache, invalidated (whole-tenant, coarse-grained) on every mutation.

**API endpoints** (`/api/resource-planning/*`)

| Method | Path | Purpose |
|---|---|---|
| GET | /personas, /dashboard | Persona catalog, executive dashboard |
| GET | /demand-supply, /demand-supply/export, /demand-supply/cell | Demand vs supply |
| GET | /heatmap, /scheduler | Heat map, scheduler |
| POST | /bookings | Create booking |
| PUT | /bookings/:id | Update |
| POST | /bookings/:id/move, /extend, /promote | Booking actions |
| DELETE | /bookings/:id | Delete |
| POST | /auto-match | Bench auto-match |
| GET | /skills-inventory | Skills inventory |
| GET | /pipeline | Pipeline demand |
| POST | /pipeline/sync, /pipeline/:id/promote | Pipeline actions |
| POST | /webhooks/crm | CRM opportunity webhook |
| GET | /recruitment | Recruitment forecast |
| POST | /recruitment/:id/status | Status update |
| GET | /recruitment/export | HR export |
| GET | /bench | Bench list |
| POST | /bench/:id/assign | Assign bench resource |
| GET/POST | /scenarios | Scenario planning |
| GET | /ai/insights | Daily AI insights |
| POST | /ai/query | NL workforce query |

**Data model**: `recruitment_recommendations`, `resource_planning_scenarios`, `resource_planning_audit_log` — layered on `resources`/`resource_allocations`/`skills`/`resource_skills` (owned by §15).

**Frontend**: `ResourcePlanningPage.tsx` (245 lines) — sidebar sections Planning (dashboard/demand-supply/heatmap/scheduler), Workforce (skills/pipeline/recruitment/bench), Intelligence (AI planner/scenarios).

**Notable**: The persona layer is a *second, independent* access control layer on top of platform-role RBAC — both `assertRpPersonaAllowed` and `assertRpAccess` must pass, and the same underlying dataset is served with different shapes per persona (financial data redacted for exec/sales) — meaning CSV exports differ by persona for the "same" data.

---

## 15. Resources Management

**Purpose**: Operational system-of-record for people — profiles, skills, allocations/utilization, timesheets (PM/RM approval + e-signature), rate cards, org chart, and a role-scoped "my resources" personal portal for contractors.

**Key features**
- **Resource-scope access model**: 3 roles derived from `resources`/`reportsToId` hierarchy — `manager` (full, all 9 tabs), `consultant` (self + direct reports, 3 tabs), `self` (own record only, 2 tabs; contractor/customer/partner/associate person-types routed to a dedicated Contractor Portal).
- People directory + extended stats (utilization %, bench count, over-allocated count), 12-month utilization trend, capacity-vs-demand, skills-demand heatmap (manager-only).
- **Skills library**: hierarchical (parent/child skills), categories, proficiency + numeric level (1–5), assessment type, certification tracking, multi-criteria search (AND/OR, min level/years, availability, location), skills-gap analysis against a plan.
- **Timesheets**: period→entries, two-stage approval (PM then RM, or reject at either level), bulk approval, audit log, CSV export, **e-signature integration** for period sign-off.
- Outbound integrations to external payroll/HR systems with a job runner.
- Rate cards (nested items), Project codes, Org chart (from `reportsToId`), Resource↔Document linking (CVs/certs/contracts), Leave management.
- Pipeline view (bench/upcoming availability) with a "flag capacity concern" action that posts a CRM activity — a direct Resources→CRM feedback loop.

**API endpoints**

Core CRUD (inline, `/api/resources/*`): resources, skills, skill-categories, allocations, basic timesheets/entries, rate-cards/items, project-codes.

Advanced (`server/resources/routes.ts`, `/api/resources/*`):

| Method | Path | Purpose |
|---|---|---|
| GET | /scope, /org-chart, /skills-map, /stats, /dashboard | Access scope, org chart, skills map, stats, role-branching dashboard |
| GET | /pipeline-view | Bench/availability view |
| POST | /skills/search | Multi-criteria search |
| GET | /skills/gap-analysis/:planId | Gap analysis |
| GET/POST | /leaves | Leave management |
| GET | /timesheets/export | Export |
| GET/POST | /timesheets/integrations | Integration config |
| POST | /timesheets/integrations/:id/deliver | Deliver |
| GET | /timesheets/integration-log | Log |
| POST | /timesheets/periods/bulk-approve | Bulk approve |
| POST | /timesheets/entries/:id/approve, /reject | Entry-level approval |
| GET | /timesheets/periods/:id/entries | Period entries |
| POST | /timesheets/periods/:id/submit, /approve-pm, /approve-rm, /reject, /request-signoff | Period workflow |
| GET/POST | /:id/documents | Resource documents |
| DELETE | /documents/:linkId | Remove link |
| GET | /:id/profile | Profile detail |
| POST | /pipeline/:oppId/flag-capacity | Flag capacity concern → CRM |

**Data model**: `resources` (personType, employmentType, fte, costRate/billRate, workingDaysPerWeek, rightToWorkStatus, reportsToId), `skill_categories`, `skills` (self-referential), `resource_skills`, `resource_allocations` (allocationType: confirmed/pipeline/soft), `timesheet_periods`/`timesheet_entries`, `rate_cards`/`rate_card_items`, `resource_leaves`, `timesheet_integrations`/`timesheet_integration_log`, `timesheet_audit_log`, `project_codes`, `document_resource_links`.

**Frontend**: `ResourceManagementPage.tsx` (361 lines, tabs gated by scope) + `client/src/components/resources/` (dashboard/people/allocations/pipeline/reports tabs, skills matrix/library dialog, profile panel, `ContractorPortalRedirect`).

**Notable**: `canAccessResource`/`filterResourcesByScope` are the single choke-point for row-level visibility across leaves/documents/timesheet-exports/profile — any new endpoint touching resource data must call these to avoid leaking cross-team data.

---

## 16. BPM (Business Process Management)

**Purpose**: Visual process-modeling suite — BPMN-style flowcharts, org charts, architecture diagrams, a BPML process register, methodology frameworks, and an employee-facing Process Portal.

**Key features**
- Multi-type canvas diagrams on **React Flow (`@xyflow/react`)**: flowchart, process_flow, bpml, org_chart, architecture, network, database_diagram, workflow, system_landscape, integration_architecture, data_flow, raci_matrix, deployment, custom.
- Rich node palette (start/end, task, gateways, subprocess, swimlane/pool, database, cloud, API-call, event-trigger, flowchart shapes, annotations).
- Swimlanes, BPM Libraries (folders), reusable BPM Templates with a submission/review workflow to promote customer templates to "system" tier.
- **BPML** — spreadsheet-like process register with configurable sections/fields, custom fields, ERP platform tags (SAP/Oracle/Microsoft/NetSuite/Workday), fit-gap assessment, RACI-like ownership, controls, bulk import/upsert, auto-generated process IDs.
- Org Charts — hierarchical trees, engagement levels (champion/supporter/neutral/resistant/blocker), templates, deep-clone duplication.
- Frameworks (SAP Activate, Workday methodology templates) with ordered phases.
- **Process Portal**: curated hierarchical menu assigning published diagrams to menu nodes, tenant portal settings (open vs tag-based access, business-area colors, custom asset types).
- **BPM Step Links** — link a diagram node to a test scenario/incident/document, computing test coverage per diagram from linked test-scenario pass rate.
- BPML entry change history (field-level diff audit trail).
- Process Report — on-the-fly aggregation of node attributes (cost, duration, FTE, automation %, risk rating).

**API endpoints** (partly `server/bpm/routes.ts`, partly inline)

Diagrams/canvas: `/api/bpm/diagrams[/:id]` CRUD + `/duplicate`, `/nodes`, `/edges`, `/swimlanes`, `/libraries`, `/templates`, `/attachments`, `/canvas` (bulk save), `/publish`; `/api/process-resources` CRUD; `/api/portal/menu-nodes` CRUD + `/seed`; `/api/portal/assignments`; `/api/frameworks` CRUD + `/bulk-import`; `/api/bpml/templates` and `/api/bpml/entries` CRUD + bulk ops; `/api/org-chart-templates`, `/api/org-charts` CRUD + `/duplicate` + members + bulk-import; `/api/bpm/upload-image`, `/api/org-charts/upload-photo`.

Extension routes: `/api/bpm/portal-settings`, `/api/bpml/entries/:id/history`, `/api/bpml/entries/bulk-upsert`, `/api/bpml/entries/:id/generate-id`, `/api/bpm/diagrams/:diagramId/step-links` (+delete), `/api/bpm/diagrams/:diagramId/test-coverage`, `/api/bpm/templates/:id/submit`, `/api/bpm/template-submissions` (+review), `/api/bpm/diagrams/:id/process-report`.

**Data model**: `bpm_diagrams`, `bpm_nodes`, `bpm_edges`, `bpm_swimlanes`, `bpm_libraries`, `bpm_templates`, `bpm_attachments`, `frameworks`, `portal_menu_nodes`, `portal_diagram_assignments`, `process_resources`, `process_portal_settings`, `bpml_entry_history`, `bpm_step_links`, `bpm_template_submissions`, `bpml_templates`, `bpml_entries` (very wide — 5-level process hierarchy, fit-gap, risk, controls, ERP platform, custom fields).

**Frontend**: `BPMPage.tsx` (4,348 lines — largest page in the app) + `client/src/components/bpm/` (13 files: `BpmCanvasEditor`, `BpmNodeTypes`, `BpmlView`, `OrgChartView`, `BpmTemplatePipeline`, `BpmStepLinksPanel`, `BpmProcessReportDialog`, `PortalAssetPanel`, `PortalSettingsDialog`).

**Notable**: Template-submission approval sets `tier: system` directly on `bpm_templates`, bypassing the newer unified `platform_templates` system — legacy/new template-tier duplication. Process ID generation scans max trailing digit and increments (no DB sequence — collision-prone under concurrency). Process Portal routes are deliberately registered twice to avoid being shadowed by Help Desk's generic `/api/portal/:token` route.

---

## 17. Templates (cross-module platform templates)

**Purpose**: A unified "template marketplace" letting any module's content (BPM diagrams/org charts/frameworks/BPML, projects, surveys, e-sign docs, workspaces, whiteboards, test-mgmt hierarchies) be saved, discovered, AI-generated, and applied.

**Key features**
- Central `platform_templates` table, `module` discriminator across 10 module types.
- Tiering: `system` (Jiganto-authored), `customer` (tenant-private), `submitted` (pending review).
- Discovery feed: featured, recently-used, popular, new/updated, industry-tag-based recommended (keyed off tenant's `industry`).
- **Snapshot/Apply pattern**: `snapshots.ts` builds a normalized JSON snapshot from a live entity; `apply.ts` materializes a new live entity from a snapshot — decouples templates from schema versions.
- "Save as template" shortcuts wired from source modules (frameworks, PM projects, org charts, BPML, TM, whiteboards).
- **Legacy-template sync**: one-time-per-tenant import of pre-existing per-module template tables into the unified table.
- AI template generation for 10 modules (OpenAI, JSON mode), token-allowance gated, logged.
- Review workflow (submit → approve/promote or decline).
- Usage logging drives "recently used"/popularity.

**API endpoints** (`/api/templates/*` plus per-module "save-as-template" hooks)

`GET /api/templates` (filtered list), `/marketplace`, `/discovery`, `/module-counts`, `/snapshot`; `GET/PATCH/DELETE /api/templates/:id`; `POST /api/templates`/`/register`; `POST /api/templates/apply`; `POST /api/templates/:id/submit`, `/review`; `POST /api/templates/ai-generate`; `POST /api/templates/sync`; plus `POST /api/frameworks/:id/save-as-template`, `/api/pm/projects/:id/save-as-template`, `/api/org-charts/:id/save-as-template`, `/api/bpml/templates/:id/save-as-template`, `/api/tm/projects/:id/save-as-template`, `/api/whiteboard/:id/save-as-template`, `/api/surveys/:id/save-template`.

**Data model**: `platform_templates` (module/tier/status/snapshotJsonb/categoryTags/usageCount/isFeatured/isAiGenerated/marketplaceListed), `template_usage_log`, `template_ai_generations`.

**Frontend**: `TemplatesPage.tsx` (976 lines — marketplace/gallery grid/list, AI-generate dialog, submit-for-review flow, tier badges) + `client/src/components/templates/` (thumbnail, save-as-template dialog reused across modules, submitted-templates review queue).

**Notable**: `applyTemplate` re-checks visibility/tier at apply time (not just list time). AI generation cost is tenant-token-gated (402 on insufficient tokens).

---

## 18. Surveys & Polls

**Purpose**: Survey builder and distribution engine (branching logic, public response portals, AI question generation/analysis) bundled with a lightweight polling feature integrated with team chat.

**Key features**
- Rich question types (multiple choice, scale, NPS, free text, paragraph, yes/no, star rating, Likert, checkbox, date, section headers).
- Settings: anonymous, showProgress, onePerPage, randomizeQuestions, allowMultipleResponses, showResultsToRespondents, allowExternal.
- **Branching/skip logic** (`shared/survey-logic.ts`, shared client/server): questions carry rules (equals/not_equals/contains) that jump to a target question.
- Distribution: link, workspace (all members), specific users/emails (with reminder scheduling), embed, QR.
- Public portal (token-based, no auth unless `allowExternal=false`) with allow-list access checks.
- File uploads for responses (public, token-scoped, 10MB limit).
- AI: generate questions from a description; analyze aggregate results (min 10 responses) — both token-gated.
- System templates (some locked/periodically re-synced) + tenant custom templates; "save as template" also registers into the unified Templates module.
- **Background jobs**: auto-close expired surveys/polls, send reminders to non-respondents.
- Polls: single/multi-select, anonymous or authenticated, allowVoteChange, duration/close-date based auto-close.
- **Chat integration**: chat-created polls mirror into the Surveys module; closing posts an automatic winner-summary back to the originating channel.
- CSAT hook: submitting a response can trigger Help Desk CSAT processing.

**API endpoints** (`/api/surveys/*`, `/api/polls/*`)

`POST /api/surveys/upload`, `/by-token/:token/upload` (public); `GET /by-token/:token`, `/by-token/:token/results` (public); `POST /by-token/:token/respond` (public); `GET/POST /api/polls/by-token/:token[/vote]` (public); `GET /api/surveys`, `/templates`, `/polls`, `/ai-status`; `GET/POST /api/surveys/polls/:id`; `POST /polls/:id/vote`, `/close`; `POST /ai-generate`; `POST /from-template/:id`; `GET /:id`, `/:id/results-summary`; `POST /:id/ai-analyze`; `POST /api/surveys` (create); `PATCH/DELETE /:id`; `POST /:id/activate`, `/close`, `/archive`, `/duplicate`, `/save-template`, `/distribute`; `POST /:id/questions`, `/questions/bulk`; `POST /questions/:qid/duplicate`; `PATCH/DELETE /questions/:qid`; `POST /:id/questions/reorder`; `GET /:id/responses`; `POST /api/survey-templates/:id/submit`.

**Data model**: `surveys`, `survey_questions` (logicJson, matrixRows/Cols, scaleMin/Max), `survey_responses`, `survey_answers`, `survey_distributions`, `survey_templates`, `module_polls`, `module_poll_votes`.

**Frontend**: `SurveysPage.tsx` (2,041 lines), `SurveyPortalPage.tsx` (552 lines, public), `PollPortalPage.tsx` (135 lines, public) + `client/src/components/surveys/`.

**Notable**: `assertSurveyPortalAccess` is the key security gate for non-public surveys. Deleting a question is blocked with 409 if responses already exist (single-delete route only, not bulk). Poll voting supports 3 identity models simultaneously (authenticated, anonymous session, fully anonymous).

---

## 19. Whiteboard (Collaborative Canvas)

**Purpose**: Real-time collaborative sticky-note whiteboard with live cursor presence, role-based membership, activity logging, public share links.

**Key features**
- Canvas via **react-konva**. Sticky notes (type/color/position/size, soft-delete, bulk delete, duplicate-with-offset).
- Permission model: owner (implicit) > admin > edit > view, per-member.
- Public share links with configurable permission + optional expiry + allowAnonymous flag.
- **Dedicated WebSocket server at `/ws/whiteboard`** (separate from chat's WS), messages: join/leave/cursor:moved/presence:ping (client→server), presence:joined/left/snapshot, cursor:moved, note:created/updated/moved/deleted (server→broadcast). Presence pruning every 10s (stale after 10s inactivity).
- Note CRUD is REST-for-persistence + WS-for-fan-out (not WS-native CRDT).
- Activity feed logging user_joined/note_created/edited/moved/deleted.
- Member search scoped to tenant; board listing with filters (mine/shared/project) and sort.

**API endpoints** (`/api/whiteboard/*`)

`GET /share/:token`, `/share/:token/detail` (public); `GET /` (list), `POST /` (create); `GET /users/search`; `GET /:id`; `PATCH/DELETE /:id`; `POST /:id/notes`; `PATCH /notes/:noteId`; `DELETE /notes/:noteId`; `POST /notes/:noteId/duplicate`; `POST /notes/bulk-delete`; `GET /:id/activity`; `GET/POST /:id/members`; `DELETE /:id/members/:memberUserId`; `POST /:id/share-token`.

**Data model**: `whiteboards`, `whiteboard_members`, `whiteboard_share_tokens`, `sticky_notes`, `whiteboard_activity`.

**Frontend**: `WhiteboardPage.tsx` (274 lines, listing), `WhiteboardCanvasPage.tsx` (520 lines, live canvas) + `WhiteboardCanvas.tsx`/`WhiteboardCanvasLazy.tsx`, `ProjectWhiteboardTool.tsx` (embeds in PM projects).

**Notable**: The WebSocket layer trusts client-supplied `userId`/`userName` query params on upgrade — no token/signature validation at the WS layer (REST-level permission checks still gate actual mutations, but presence/cursor broadcasts are client-asserted identity).

---

## 20. Test Management

**Purpose**: Full QA/test-management suite — hierarchical requirements→scenarios→cases→steps, test cycles/runs, defect management integrated with Help Desk, sign-off governance, dashboards, RTM, AI-assisted case generation.

**Key features**
- Configurable methodology labels (waterfall/agile/hybrid) remap terminology (e.g. "Scenario"→"User Story").
- Hierarchy: Project → Business Area → Business Process → Scenario → Test Case → Test Step, with auto-seed backfill from existing data.
- Test Cycles with computed metrics (pass rate excluding not_applicable/deferred, completion %).
- Release readiness score penalized (up to 60%) by open critical defects.
- Execution submission requires actualResult on fail / blockedReason on blocked; can auto-raise a Help Desk defect and progress any linked defect's retest workflow on pass.
- **Defect Board** (Kanban, backed by Help Desk tickets): BFS computes the shortest valid status path between arbitrary columns and walks each intermediate transition.
- **Multi-level Sign-Off governance** (scenario → business_process → business_area → test_cycle), each enforcing all children are already signed off before allowing sign-off; scenario sign-off additionally requires every linked case to have a pass/n-a result.
- Sign-off PDF export (jsPDF certificate with pass-rate + cascade history).
- AI test-case generation (OpenAI, with a deterministic template fallback when no API key configured).
- Dashboard: KPIs, 14-day burndown, defect trend, pass-rate trend, per-area/suite breakdowns (defect counts pulled from Help Desk tickets, not native `tm_defects`).
- Phase comparison report; audit trail (synthesized from existing records, no dedicated audit table); RTM support.
- Evidence upload (25MB); a raw-SQL schema-migration admin endpoint; demo-seed endpoints explicitly disabled (403, "live-data-only" policy).

**API endpoints** (split `server/testmgmt/routes.ts` + inline)

CRUD: `/api/tm/projects`, `/suites`, `/cases` (+`/steps`, `/steps/bulk`), `/runs` (+`/results`), `/requirements`, `/scenarios`, `/defects` (native), each `[/:id]`. Plus: `GET /api/tm/results/all`; `POST /migrate-project`; `GET /audit`; `POST /seed-demo`, `/seed-scenarios` (disabled, 403).

Extensions: `/api/tm/business-areas`, `/business-processes` CRUD; `GET /hierarchy`; `GET /cycles[/:id]`; `PATCH /cycles/:id/active`; `GET /dashboard`; `GET/POST /sign-offs`; `POST /sign-offs/entity`; `POST /cycles/:id/sign-off`; `POST /executions/:id/submit`; `GET /defects/hd`; `PATCH /defects/hd/:id/status`; `POST /migrate-schema`; `POST /seed-hierarchy`; `GET /reports/phase-comparison`; `GET /sign-offs/pdf`; `POST /ai/generate-tests`; `POST /evidence/upload`.

**Data model**: `tm_projects`, `tm_business_areas`, `tm_business_processes`, `tm_test_suites`, `tm_scenarios`, `tm_test_cases`, `tm_test_steps`, `tm_test_runs`, `tm_test_results`, `tm_sign_offs`, `tm_defects` (native), `tm_requirements`.

**Frontend**: `TestManagementPage.tsx` (331 lines, left-nav OVERVIEW/PLANNING/EXECUTION/COMPLIANCE) + 19-file `client/src/components/testmgmt/` (`CommandCentreScreen`, `DigitalTwinScreen`, `TestNavigatorScreen`, `TraceabilityScreen` (RTM), `ExecutionConsoleScreen`, `DefectBoardScreen`, `DefectTriageScreen`, `AuditTrailScreen`, `AccessRolesScreen`).

**Notable**: **Two parallel defect systems** — native `tm_defects` (simple CRUD, apparently unused by the primary UI) vs. Help-Desk-ticket-backed defects (`/api/tm/defects/hd`, used by dashboard/board/reports) — likely `tm_defects` is vestigial. Sign-off cascade validation only runs through the dedicated `/api/tm/sign-offs/entity` route, not the raw `/api/tm/sign-offs` POST — a possible inconsistency if the raw route is ever used directly.

---

## 21. Chat (Team Messaging)

**Purpose**: Internal team messaging (Slack/Teams-style) — channels, DMs, threads, polls, AI summarization, optional Slack/Teams bridges.

**Key features**
- Channels: public/private/announcement (admin-only posting)/direct, scoped to "teams".
- Threaded replies, reactions, message pinning, channel/user favourites.
- Polls (2–6 options, duration, anonymous option) synced into the Surveys module.
- File attachments; AI features (require `OPENAI_API_KEY`): summarise unread, summarise thread, `@jiganto` in-channel Q&A bot.
- Slack/Teams outbound bridges per channel; inbound bridge messages via shared-secret webhook.
- Real-time via a **custom WebSocket server** at `/ws/chat` (not Socket.IO) with typing indicators and presence.
- Per-channel notification preferences.
- **Note**: a second, unrelated simple AI chatbot exists (`/api/conversations`, SSE streaming) — distinct from the team-chat feature.

**API endpoints** (selected; ~35 routes)

Core (`server/routes.ts`): `/api/chat/projects` (teams) CRUD, `/api/chat/channels` CRUD + members/join/read, `/api/chat/channels/:id/messages` (list/send, thread support), `/api/chat/messages/:id` (edit/delete), reactions, `/api/chat/messages/:id/thread`, `/api/chat/inbox`, channel/user favourites, `/api/chat/teams`, `/api/chat/search`, polls (`/channels/:id/polls`, `/polls/:id`, `/vote`), `/api/chat/users/search`, `/api/chat/dm`.

Extended (`server/chat/extended-routes.ts`): `/api/chat/config`, `/ai-insights`, `/channels/:id/attachments`, `/pins`, `/bridge`, `/notifications`, `/summarize-unread`, `/messages/:id/summarize-thread`, `/bridges/incoming`.

Legacy chatbot: `/api/conversations[/:id]`, `/api/conversations/:id/messages`.

WS: `/ws/chat?userId=` — join/leave/typing/presence/message/reaction/poll_vote/pin broadcast.

**Data model**: `projects` (chat "teams"), `channels`, `channelMembers`, `chatMessages`, `messageAttachments`, `pinnedMessages`, `chatPolls`/`chatPollVotes`, `userFavorites`, `channelFavorites`, `messageReactions`, plus unrelated `conversations`/`messages` for the simple chatbot.

**Frontend**: `ChatPage.tsx` (745 lines) + `ConversationSidebar`, `MessageThread`, `MessageCompose`, `ChatRightPanel`, `PollCard`, `ChatDialogs`.

**Notable**: Presence auto-flips to "away" after 2 minutes of inactivity; typing indicators auto-expire after 3s. Announcement-channel posting restrictions and private/DM access checks are enforced server-side, not just UI-side. A synthetic `jiganto-bot` user is auto-created for AI-authored messages.

---

## 22. Document Management

**Purpose**: Rich-text document workspace (Notion/Confluence-style) — folders, TipTap editor, versioning, templates, ACL sharing, comments, tags, attachments, public links, e-Sign hook.

**Architecture note**: No `server/documents/` folder — the entire ~90-route module is inline in `server/routes.ts` (mostly lines 5960–7060).

**Key features**
- Folder tree (colour-coded, nested), document CRUD, recent/starred/shared-with-me/search views.
- **TipTap** rich-text editor with slash-commands (info/warning/success/danger callouts, collapsible sections, video embeds, math/LaTeX), autosave (~1.5s debounce, gzip-aware).
- Versioning on every content change, with restore.
- Word import (.docx→HTML via mammoth) and export (client-side docx package); server-side PDF export via Puppeteer (bundled Chromium, falls back to system Chrome/Edge) with configurable header/footer page-layout templates.
- Binary file attachments (separate `documentFiles` table/routes) with preview for docx/pptx/xlsx/text.
- Templates (global/department/module scope), tags, document-level ACL sharing, threaded/anchored comments, audit log, cross-module "initiative" links.
- Public read-only sharing via a 48-hex-char revocable token.
- Sign-off tab launches an e-Sign compose flow pre-attached to the document.

**API endpoints** (selected; ~35 routes)

`GET /public/documents/:token` (unauthenticated); `POST /api/documents/upload-image`; `document-files` CRUD (upload/download/preview); `documents/folders` CRUD; `GET /api/documents`, `/search`, `/favorites`, `/recent`, `/shared-with-me`; `GET/POST/DELETE /api/documents/:id/public-token`; `GET/POST /api/documents/:id/export-pdf`; documents CRUD; `POST /api/documents/:id/content` (autosave); `GET /api/documents/:id/versions`, `POST /versions/:versionId/restore`; tags CRUD; ACL CRUD; comments CRUD; templates CRUD; `GET /api/documents/audit-logs`; initiative-links CRUD.

**Data model**: `documentFolders`, `documents` (metadata JSONB incl. publicToken), `documentVersions`, `tags`/`documentTags`, `documentAcl`, `documentComments`, `documentAuditLogs`, `documentTemplates`, `documentInitiativeLinks`, `documentFiles` (binary uploads, separate from rich-text docs).

**Frontend**: `DocumentManagementPage.tsx` (4,728 lines — one of the largest pages) + `TipTapEditor.tsx`, `client/src/components/editor/` (content pane, image node view, page-layout/section-nav, header/footer editor).

**Notable**: Content-save auto-detects gzip via magic bytes; version creation is idempotent (no-op saves don't create a new version). PDF export's dual-fallback (puppeteer→puppeteer-core+discovered Chrome) is what makes it work across Windows dev and Linux/Docker prod. `docs/DOCUMENT_MODULE.md` matches the live code closely; the `documentFiles` binary-upload subsystem is somewhat under-documented there.

---

## 23. Help Desk (incl. Customer Portal + CSAT)

**Purpose**: Client-facing IT/support ticketing with SLA tracking, a public token-based customer self-service portal, and post-resolution CSAT surveys.

**Key features**
- **Shares the ticket engine with Service Desk** (§24) — same `sd_tickets` table, filtered by `source: "help_desk"`. Help Desk is a thin routing/reporting layer over that shared engine.
- Ticket types include a **defect** type (severity, repro steps, expected/actual result, environment, build/fix version) — defects can be created from failed Test Management results with a "ready for retest"→"fixed"/"reopened" loop.
- SLA dashboard (open tickets, SLA breached, avg resolution, CSAT score, open defects, billable hours), 12-week resolution trend, 6-month CSAT trend.
- Contracted support hours per client with 80%-usage alerting; maintenance windows that pause SLA clocks (interval-merge algorithm).
- Reports (SLA-by-type, defect analysis, agent performance, time/billing, per-client) exportable as PDF.
- **Finance sync**: billable time logs push into Finance timesheets (shared with Service Desk).
- **Customer portal**: tenant-branded, token-based, allow-listed emails/domains, email OTP login (6-digit, 15-min expiry), 8-hour session tokens, ticket submit/view/comment, admin activity log.
- **CSAT**: auto-triggered on ticket close, built on the platform Surveys module (hidden system template) plus a lightweight token-based quick-rate alternative; 3-day expiry window; sticky per-email opt-out.

**API endpoints** (selected)

`/api/help-desk/dashboard`; tickets CRUD + `/from-test-result`, `/status`, `/convert-to-incident`, `/comments`, `/time-logs`, `/attachments`; `sla-configs` CRUD; `contracted-hours`; `maintenance-windows` CRUD; `/reports`, `/reports/pdf`; `/projects/:projectId/tickets`; `/time-logs/sync-finance`; `portal/configs` CRUD + `/activity`, `/send-invite`; public: `GET /api/portal/:token`, `POST /request-code`, `/verify`, `GET/POST /tickets[/:ticketId]`, `POST /comments`; `GET/POST /api/help-desk/csat/:token` (public); `POST /api/help-desk/retest-result` (TM webhook).

**Data model**: `sdTickets` (shared, `source` discriminator), `hdPortalConfigs`, `hdPortalSessions`, `hdPortalActivityLog`, `hdSlaContractedHours`, `hdMaintenanceWindows`, plus shared `sdTicketComments`/`Attachments`/`TimeLogs`/`StatusHistory`.

**Frontend**: `HelpDeskPage.tsx` (authenticated), `HelpDeskPortalPage.tsx` (public portal), `HelpDeskCsatPage.tsx` (public quick-rate) + `client/src/components/help-desk/`.

**Notable**: Public portal auth is a fully separate two-step OTP flow (session via header, not cookies) from platform Supabase auth. CSAT opt-out is sticky per customer email, not per ticket, and the module explicitly rejects survey-shaped tokens from the "quick rate" endpoint to avoid double-counting.

---

## 24. Service Desk (Internal IT/Ops)

**Purpose**: Internal ITSM-style ticketing (incidents, service requests, change requests with CAB approval, defects) with a service catalogue, SLA engine, team routing, finance integration — same engine as Help Desk.

**Key features**
- Per-type status-machine (`VALID_TRANSITIONS`): incident, service_request, change_request (with CAB states), question, defect — each with its own valid transition graph.
- Service catalogue with categories, availability, visibility, cost model, owning team.
- **SLA engine**: business-hours-aware deadlines, pause/resume while pending, maintenance-window add-back (shared with Help Desk); default hours by priority differ for incidents vs defects, overridable per-client/per-service.
- **Auto-routing rules** (matched on type/priority/service/category/client/keyword) with round-robin agent assignment.
- **CAB workflow**: per-reviewer decisions, any rejection → rejected, all required approvals → approved, notifies CAB on submission.
- Post-go-live defect→incident conversion (re-runs SLA under incident rules, preserves history).
- Billable/non-billable time logging with Finance timesheet sync.
- Dashboard: open/breached/at-risk counts, avg resolution, P1/P2 open incidents, pending CAB approvals, 30-day trend, SLA compliance vs target.

**API endpoints** (`/api/service-desk/*`)

`GET /dashboard`; tickets CRUD; `POST /services/:serviceId/request`; `/tickets/:id/status`, `/comments`, `/time-logs`, `/attachments`, `/cab-review`; catalogue/services/categories CRUD; teams CRUD; routing-rules CRUD; sla-configs CRUD; `GET/PUT /cab-members`; `/reports/time-analysis`, `/reports/billable-time`; `/settings`; `/time-logs/sync-finance`.

**Data model**: `sdSettings` (ref-number counters), `sdServiceCategories`, `sdServices`, `sdServiceSlas`, `sdAgentTeams`/`sdAgentTeamMembers`, `sdRoutingRules`, `sdSlaConfigs`, `sdTickets` (shared with Help Desk), `sdCabReviews`/`sdCabMembers`.

**Frontend**: `ServiceDeskPage.tsx` + `client/src/components/service-desk/` (dashboard/tickets/catalogue/teams/SLA/reports tabs).

**Notable**: Ticket refs are transactional monotonic counters per tenant (separate for sd/hd prefixes). SLA-pause math is business-hours-aware. **Priority changes recompute SLA deadlines from original creation time** (not "now"), preserving elapsed-time fairness. `question`-type tickets are explicitly exempt from SLA tracking (deliberate rule).

---

## 25. e-Sign / Sign-Off

**Purpose**: End-to-end e-signature workflow — compose → sequential/parallel signing → OTP/eIDAS verification → signed PDF → audit trail — integrating with Documents, CRM Contracts, Projects/Deliverables, Finance/Timesheets, Test Management.

**Key features**
- Compose sources: raw upload (auto DOCX→PDF), a Jiganto Document (live HTML pull), inline HTML, or a saved template (incl. system-seeded NDA/SOW/Change Request templates auto-ensured on server start).
- Sequential or parallel signing order; per-signer tokenized links (only the current-turn signer gets an active token in sequential mode, enforced server-side).
- Signature capture (draw/type/upload) + optional field-level PDF placement.
- **Security features**: OTP email verification (6-digit, 15-min expiry, one-time use), eIDAS consent checkbox with custom text, "read to bottom" requirement, decline-with-reason.
- **Signature levels**: SES (default) or AdES via a configurable QTSP provider — only `mock` is actually implemented; `docusign`/`globalsign` are named but not production-complete (documented gap, not a bug).
- In-flight management: add/remove signers, remind, void, duplicate, save-as-template.
- Automatic PDF generation at every state change; daily jobs auto-expire past-deadline requests and auto-remind within 48h.
- Downstream automation: completing a request linked to a deliverable auto-completes it (100% progress); linked to a timesheet period logs a timesheet audit entry; completion emails the signed PDF.
- Full audit trail (every lifecycle event with actor/IP/user-agent/metadata), downloadable as a separate audit PDF.

**API endpoints** (`/api/signoff/*`, `/api/esign/*`)

Public: `GET /sign/:token`; `POST /sign/:token/view`, `/sign`, `/decline`, `/otp/send`, `/otp/verify`. Authenticated: `GET /` (list); `GET /api/esign/qtsp-status`; `/templates`, `/jiganto-docs`, `/projects`, `/users`; `/my-pending`; `GET /:id/signed-pdf`, `/audit-pdf`, `/file`; CRUD `/[:id]`; `POST /:id/duplicate`, `/void`, `/save-template`, `/send`, `/remind`; signer management `POST/PATCH/DELETE /:id/signers`, `/signers/:signerId`; `GET/PUT /:id/fields`.

**Data model**: `signoffRequests` (sourceType enum, fileData/signedPdfData as base64), `signoffSigners`, `signoffAuditLog`, `signoffSignatureFields`, `signoffOtpCodes`, `signoffTemplates`.

**Frontend**: `SignOffPage.tsx` (1,913 lines) + `SigningPortalPage.tsx` (710 lines, public) + `SignaturePad.tsx`, `FieldPlacementEditor.tsx`.

**Notable**: Sequential-turn enforcement and OTP/eIDAS consent are hard server-side gates (cannot bypass by calling the sign endpoint directly). QTSP timestamping is best-effort (try/catch) so a provider failure never blocks completion. Deep-link compose pre-fills from Documents/CRM/Projects/Test Management via query params.

---

## 26. Cross-cutting platform observations

- **Two structural patterns coexist**: some large modules (CRM, Business Management, Documents, much of Projects Management/Test Management CRUD, BPM diagrams) are implemented as **inline routes in the 11,123-line `server/routes.ts`**, while others (Customer Management, Finance, Resource Planning, Resources, Portfolio, Service Desk, Help Desk, Chat extensions, Templates, Surveys, Whiteboard, e-Sign) follow a **cleaner modular folder pattern** (routes/service/repository/domain-logic files). CRM and Business Management are the natural next candidates for extraction into dedicated server modules.
- **Ticket engine is shared**: Help Desk and Service Desk are not separate systems — one `sd_tickets` table and one `service.ts` engine, differentiated only by a `source` column.
- **Templates module is connective tissue**: BPM, Surveys, Whiteboard, Projects, Test Management, and Workspaces all hook into the same `platform_templates` snapshot/apply pipeline while retaining legacy per-module template tables that lazily sync in.
- **AI features share one gating pattern**: token-allowance checks (`checkAiTokenAllowance`/`recordAiTokenUsage`) and one OpenAI client bootstrap, used consistently by Templates, Surveys, Test Management, Business Management, Chat, Dashboard, Portfolio, Resource Planning, and Customer Management — but failure behavior differs (Test Management degrades gracefully to a deterministic fallback; Surveys/Templates/Dashboard AI routes hard-fail with 503/402).
- **Unified Work Items** is the single most consequential shared concept in Delivery: Projects Management's Gantt/WBS/Milestones all collapse onto one `pm_tasks` table, and Portfolio's 360 Report round-trips edits back into the same underlying rows — any schema change here has wide blast radius.
- **Tasks Management is the connective tissue for "my work"**: the only module that deliberately reads across Projects, CRM, e-Sign, Resources (timesheets), and Business/Governance into one aggregated inbox.
- **Resource Planning sits strictly above Resources Management**: no separate headcount/skill/allocation data — it's the same rows, re-projected through demand/supply/heatmap lenses with persona-based field redaction.
- **Consistent minor-unit currency convention**: Finance and Customer Management both store money as integer pence, with local (duplicated, not shared) formatting helpers per module.
- **Consistent multi-tenancy/workspace scoping helpers** (`requireApiTenantId`, `resolveListClientId`, `assertRecordInWorkspace`) are used across virtually every module — this is the de facto platform convention, though enforced ad hoc per-route rather than via a single declarative layer.
- **Public/unauthenticated access patterns differ by module** rather than sharing one mechanism: per-record token fields with allow-list checks (Surveys), separate share-token tables with expiry (Whiteboard, Workspaces, Documents), OTP+session-header flows (Help Desk portal), and signer-token flows with turn/consent gating (e-Sign).
- **Notification/email plumbing is shared**: `server/lib/user-notify.ts` (in-app/email notifications) and `server/lib/org-email.ts` (`sendOrgEmail`, tenant-branded outbound email) are used consistently by Chat, Help Desk, Service Desk, e-Sign, Documents, and Customer Management.
- **"Workspaces" vs "Clients" naming collision**: worth flagging to anyone new to the codebase — they are unrelated subsystems (§4 vs §5).

---

## 27. Notable gaps, stubs & inconsistencies (consolidated)

These are implementation details worth validating/tracking, not necessarily bugs — surfaced by the audit agents while reading the actual code:

1. **Impersonation status mismatch** (Auth): `requestImpersonation` writes `approvalStatus: "approved"` but the "active impersonation" lookup filters for `"active"` — a freshly started impersonation may not be found by that query. Impact limited (staff-only feature).
2. **Governance API inconsistency** (Business Management): uses PATCH where the rest of the module uses PUT.
3. **CRM rate-card stubs**: some `/api/crm/rate-cards` mutation handlers appear to ignore the request body — possibly incomplete pending full Finance rate-card wiring.
4. **Customer Management expansion MRR is hardcoded to 0** in the metrics computation — a known stub, not a bug.
5. **Finance ERP integration is webhook-only in practice**: named systems (QuickBooks/Xero/NetSuite) are schema/UI-ready but fail immediately at sync time with "not configured — add OAuth credentials"; only `system: "generic"` + webhook URL actually works end-to-end.
6. **e-Sign QTSP providers**: `docusign`/`globalsign` are named in code but not implemented — only `mock` works. This is called out consistently in code comments and `docs/ESIGN_MODULE.md`, so it's a documented/intentional gap.
7. **Two parallel defect systems in Test Management**: native `tm_defects` (simple CRUD) appears unused by the primary dashboard/board/report UI, which all read from Help-Desk-ticket-backed defects instead — `tm_defects` may be vestigial.
8. **Test Management sign-off cascade validation** only runs through the dedicated `/api/tm/sign-offs/entity` route; the raw `/api/tm/sign-offs` POST does no cascade validation — a possible inconsistency if any client code calls the raw route directly.
9. **Two coexisting health-score formulas**: Portfolio's flat 8-dimension RAG average vs. Projects' RAG-average-minus-risk-penalty (`pm-tool-badges.ts`) — different surfaces, different math, could confuse anyone expecting one canonical "health" number.
10. **Resource Planning over-allocation checks are not calendar-aware**: capacity math ignores the `business-calendar.ts` holiday/working-hours config used elsewhere.
11. **BPM template-submission approval bypasses the newer unified Templates system**, setting `tier: system` directly on the legacy `bpm_templates` table — legacy/new template-tier duplication not yet reconciled.
12. **BPML process-ID generation** scans for the max trailing digit and increments in application code (no DB sequence) — collision-prone under concurrent writes.
13. **Whiteboard WebSocket layer trusts client-supplied identity** (`userId`/`userName` query params) with no token/signature validation at the WS upgrade — REST-level permission checks still gate actual mutations, but presence/cursor broadcasts are unauthenticated at that layer.
14. **Portfolio project↔portfolio linkage** is genuinely many-to-many via a join table, but a legacy single `pm_projects.portfolioId` FK is also still present for backward compatibility — the two can disagree.
15. **CRM/Business Management/Documents/much of Projects PM & Test Management CRUD** remain inline in the 11k-line `server/routes.ts` rather than extracted into dedicated module folders — a maintainability/technical-debt item echoed by `docs/TECHNICAL_DOCUMENTATION_PACK.md`'s due-diligence section (see that document for the platform-wide CI/CD, testing, containerization, and observability gaps, which are out of scope for this feature/API-focused audit).

---

*This document was produced by direct source inspection (not from prior documentation) and should be treated as a snapshot as of 2026-09-24. Re-audit after significant refactors, especially any changes to `server/routes.ts`, `shared/schema.ts`, or the unified work-items/templates/ticket-engine subsystems that several modules depend on.*
