# Things to do — Jiganto

Handoff checklist after the **18-image settings/platform spec** work.  
Reference: `docs/1.png`–`docs/18.png`, [SPEC_18_IMAGES.md](docs/SPEC_18_IMAGES.md), [SETTINGS_SPEC_GAP.md](docs/SETTINGS_SPEC_GAP.md).

---

## Deferred (you said “later”) — platform gaps

These are **intentionally not built** until you pick them up:

- [ ] Live **SAML / Entra / Google OAuth** login
- [ ] **ERP** connectors (Xero, QuickBooks, NetSuite)
- [ ] **Slack / Microsoft Teams** integrations
- [ ] **API key authentication** on REST (`Bearer jig_…` middleware)
- [ ] **Full GDPR ZIP** (all modules — CRM, PM, documents, etc.)
- [ ] **Live billing** (Stripe, invoices, payments)
- [ ] **Per-module notification events** + recipient rules (manager, team lead, etc.)
- [ ] API key rotation UI (optional)

---

## When you come back — setup (ops)

- [ ] Copy `.env.example` → `.env` and fill Supabase + `SESSION_SECRET`
- [ ] Email: `RESEND_API_KEY` + `INVITE_EMAIL_FROM` **or** SMTP in Settings + `SMTP_PASSWORD` / `SMTP_FROM`
- [ ] Run SQL in Supabase (skip scripts already applied):
  1. `scripts/sql/permissions-tables.sql`
  2. `scripts/sql/user-invitations-platform-role.sql`
  3. `scripts/sql/org-audit-events.sql`
  4. `scripts/sql/users-preferences.sql`
  5. `scripts/sql/ai-token-tables.sql`
  6. `scripts/sql/sync-auth-users.sql`
- [ ] `npm run dev` → smoke-test `/settings/system`, `/settings/workspace`, `/settings/personal`

---

## Implemented (code in repo — verify in UI)

### Email & notifications
- [x] `notifyUser()` — in-app + email via org SMTP/Resend (used for CRM resource-plan notify; extend to more routes as needed)
- [x] Digest scheduler (daily) + manual **Run digest** API
- [x] Org notification defaults tab

### Billing
- [x] Seat limit enforcement on invite (Settings → Billing **Licensed seats**)
- [x] Billing metadata tab (plan, seats, renewal) — not Stripe

### Data & privacy
- [x] JSON + ZIP self-export (profile + notifications)
- [x] **Right to erasure** — user request + admin approve → anonymise
- [x] **Retention** — manual run + **nightly automated** job per org
- [x] **Public holidays import** (static regions) + business calendar helpers for SLA

### Organisation polish
- [x] **Logo upload** (PNG/SVG/JPEG data URL) — Settings → Branding
- [x] **Primary colour** applied globally (`OrgBrandingSync` + HSL CSS vars)
- [x] Fiscal year / business hours stored; `business-calendar` lib + `GET /api/settings/business-calendar`
- [x] **Org structure CSV** import/export (org units)

### AI
- [x] **Token limit enforcement** before chat (429 when over limit/balance)
- [x] **Monthly balance reset** (1st of month, background job)
- [x] **Per-user / per-module limits** in Settings → AI Usage

---

## Module product UI (still separate phase)

- [ ] CRM, Finance, PM, Help/Service Desk, Documents/eSign, Surveys, Test Mgmt, BPM, etc.  
  Use `docs/*.png` per module when you start this phase.

---

## Testing checklist

- [ ] Invite over seat limit → 400 with clear message
- [ ] Logo upload + primary colour visible in sidebar
- [ ] Org units CSV export/import
- [ ] Erasure request (Profile) → approve (Data & privacy)
- [ ] Import holidays → retention/SLA helpers
- [ ] AI chat blocked when balance/limit exceeded
- [ ] SMTP test + invite email via org SMTP

---

## Docs

| Doc | Purpose |
|-----|---------|
| [docs/SPEC_18_IMAGES.md](docs/SPEC_18_IMAGES.md) | Status per spec image |
| [docs/SETTINGS_SPEC_GAP.md](docs/SETTINGS_SPEC_GAP.md) | Platform gaps detail |
| [docs/MULTI_TENANCY.md](docs/MULTI_TENANCY.md) | Tenancy model |
| [docs/PERMISSIONS.md](docs/PERMISSIONS.md) | Roles & modules |
| [docs/SUPABASE.md](docs/SUPABASE.md) | Auth + DB |

---

*Deferred items stay unchecked until you implement them. “Implemented” items may still need your SQL + env setup before they work in your environment.*
