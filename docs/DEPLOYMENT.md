# Deployment checklist — modules 6–20 (public / self-hosted)

Scope: **CRM, Finance, Resources, Resource Planning, Portfolio, Projects, Tasks, Workspaces, Service Desk, Help Desk, Test Management, BPM, Surveys, Templates** (Documents module excluded).

## 1. Environment file

```bash
cp .env.example .env
```

Edit `.env` locally or on the server. **Never commit `.env`** — it is gitignored. Ship **`.env.example`** with the repo so operators know every variable.

### Required (modules will not work in production without these)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL (Supabase session pooler recommended) |
| `SESSION_SECRET` | Express session signing (32+ random chars) |
| `SUPABASE_URL` | Server-side auth validation |
| `SUPABASE_ANON_KEY` | Server-side auth validation |
| `VITE_SUPABASE_URL` | Client Supabase SDK (same project URL) |
| `VITE_SUPABASE_ANON_KEY` | Client Supabase SDK |
| `ENABLE_DEV_LOGIN` | Must be `false` in production |
| `NODE_ENV` | `production` on live servers |

### Recommended for production

| Variable | Purpose |
|----------|---------|
| `APP_URL` or `PUBLIC_APP_URL` | Survey links, help-desk CSAT, portfolio report emails, eSign links |
| `PORT` / `HOST` | Default `5000` / `0.0.0.0` |

### Optional — feature degrades gracefully if unset

| Variable | Module(s) | Without it |
|----------|-----------|------------|
| `OPENAI_API_KEY` | RP AI, Business, Portfolio narrative, Surveys, Test gen | Rule-based / static fallbacks |
| `RESEND_API_KEY` + `INVITE_EMAIL_FROM` | Invites, eSign, report email | In-app only; no outbound email |
| `SMTP_PASSWORD` + `SMTP_FROM` | Same as Resend | Same |
| `XERO_*` / `QUICKBOOKS_*` | Finance ERP OAuth | Use **generic webhook** in Finance → Integrations UI |
| `WEBHOOK_SIGNING_SECRET` | Outbound ERP webhooks | Unsigned webhooks |
| `DISABLE_PLATFORM_JOBS=true` | Portfolio snapshots, surveys close, eSign reminders | **Do not set** in production |

See **[.env.example](../.env.example)** for the full list and comments.

## 2. Database & auth setup

```bash
npm install
npm run db:push
```

1. Create a Supabase project → copy **Session pooler** URI to `DATABASE_URL`.
2. Copy **Project URL** + **anon key** to all four Supabase env vars.
3. Run **`scripts/sql/sync-auth-users.sql`** once in the Supabase SQL Editor (keeps `public.users` in sync with `auth.users`).

Details: **[docs/SUPABASE.md](./SUPABASE.md)**

## 3. Build & run

### Development

```bash
npm run dev
```

Open http://localhost:5000 → sign in with Supabase.

### Production

```bash
npm run build
npm run start
```

Place **nginx** (or similar) with HTTPS in front. Set `NODE_ENV=production`.

## 4. Background jobs

When the server runs with `DISABLE_PLATFORM_JOBS` **unset**, daily jobs include:

- Portfolio **health matrix snapshots** (Mondays) — powers dashboard health trend
- Scheduled portfolio report emails
- Survey / poll auto-close
- eSign expiry and reminders
- Notification digests, data retention

The server process must stay running (or use a process manager such as systemd / PM2).

## 5. Module readiness matrix

| Module | Core features | Needs optional env |
|--------|---------------|-------------------|
| CRM | ✅ DB-backed | OpenAI only for future AI assist |
| Finance | ✅ DB-backed | ERP OAuth keys for Xero/QB (webhook works without) |
| Resources | ✅ DB-backed | — |
| Resource Planning | ✅ DB-backed | `OPENAI_API_KEY` for AI planner chat |
| Portfolio | ✅ DB-backed | `OPENAI_API_KEY` for AI narrative; `APP_URL` for report emails |
| Projects | ✅ DB-backed | — |
| Tasks | ✅ DB-backed | — |
| Workspaces | ✅ DB-backed | — |
| Service Desk | ✅ DB-backed | SLA target derived from SLA config in UI |
| Help Desk | ✅ DB-backed | `APP_URL` for CSAT links |
| Test Management | ✅ DB-backed | `OPENAI_API_KEY` for AI test generation |
| BPM | ✅ DB-backed | — |
| Surveys | ✅ DB-backed | `OPENAI_API_KEY` for AI question gen; `APP_URL` for public survey links |
| Templates | ✅ DB-backed | — |

## 6. Smoke tests (optional, CI / staging)

Start the dev server, then:

```bash
# Set in .env or shell:
# SMOKE_BASE_URL=http://127.0.0.1:5000
# SMOKE_BEARER_TOKEN=<supabase access token>

npm run smoke:finance
npm run smoke:resources
npm run smoke:portfolio
npm run smoke:tasks
npm run smoke:workspaces
npm run smoke:service-desk
npm run smoke:help-desk
npm run smoke:test-mgmt
npm run smoke:surveys
npm run smoke:templates
npm run smoke:resource-planning
npm run smoke:validate-all
```

## 7. Known limits for public launch

1. **Finance Xero / QuickBooks OAuth** — UI stores integration profile; live OAuth sync needs env keys and server OAuth routes (generic webhook integration works today).
2. **Email** — requires Resend or SMTP env vars for outbound mail.
3. **First-week portfolio health trend** — shows “No prior snapshot” until Monday background job runs (or open Portfolio health matrix once to seed snapshots).

## 8. Quick production checklist

- [ ] `.env` created from `.env.example` (not committed)
- [ ] All **required** vars set
- [ ] `ENABLE_DEV_LOGIN=false`
- [ ] `sync-auth-users.sql` executed in Supabase
- [ ] `npm run db:push` succeeded
- [ ] `npm run build` succeeded
- [ ] HTTPS reverse proxy configured
- [ ] `APP_URL` set to public HTTPS URL
- [ ] Process manager keeps Node server running
- [ ] `DISABLE_PLATFORM_JOBS` **not** set to `true`
