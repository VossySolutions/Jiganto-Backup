# Supabase setup (database + auth)

Jiganto uses Supabase for **PostgreSQL** and **authentication**. Application data and foreign keys use `public.users`; Supabase stores logins in `auth.users`. Both share the **same user id** (UUID).

For production deployment of modules 6–20, see also **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

## Architecture (standard pattern)

```
auth.users (Supabase Auth)     login, password, JWT
       │ same id (UUID)
       ▼
public.users (app)             profiles, FKs: tasks, CRM, org_memberships, …
```

| Layer | Table / service | Purpose |
|--------|-----------------|--------|
| Login | `auth.users` | Sign up, sign in, email |
| App identity | `public.users` | All `user_id` / `owner_id` foreign keys |
| Access | `org_memberships` | Platform role per organisation |

Sync happens in **three places** (defence in depth):

1. **SQL trigger** — `scripts/sql/sync-auth-users.sql` (run once in SQL Editor)
2. **API** — every authenticated request runs `syncSupabaseUserToApp` (`server/auth/appUserSync.ts`)
3. **Client** — `SupabaseAuthSync` on sign-in / token refresh

## 1. Environment

Copy `.env.example` → `.env`:

```env
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@....pooler.supabase.com:5432/postgres
SESSION_SECRET=long-random-string
PORT=5000

SUPABASE_URL=https://YOUR_REF.supabase.co
SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_URL=https://YOUR_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

ENABLE_DEV_LOGIN=false
```

Use the **project URL** (`https://xxx.supabase.co`), not `/rest/v1/`.

## 2. Schema

```bash
npm run db:push
```

### Full reset (drop all app tables and recreate)

**Deletes all application data.** Supabase logins (`auth.users`) are kept.

```bash
# Stop npm run dev first
npm run db:reset
```

This runs: `reset-public-schema.sql` → `drizzle-kit push` → `sync-auth-users.sql`.

Or run SQL scripts manually in **Supabase → SQL Editor** (see `scripts/sql/`).

**Required for auth sync:**

```text
scripts/sql/sync-auth-users.sql    ← trigger + backfill auth → public.users
scripts/sql/permissions-tables.sql ← org_memberships, roles
```

## 3. Supabase Auth settings (dashboard)

| Setting | Local dev | Production |
|---------|-----------|------------|
| **Email provider** | On | On |
| **Confirm email** | Off (easier testing) | On (recommended) |
| **Allow new users to sign up** | On | As needed |
| **Site URL** | `http://localhost:5000` | Your domain |
| **Redirect URLs** | `http://localhost:5000/**` | Your domain `/**` |

Built-in email is limited (~2/hour). Use **custom SMTP** (Resend, SendGrid) for production.

## 4. First administrator

1. **Create account** on the welcome page (or sign in).
2. **Access pending** → **Set up as first administrator** (only when no admin exists).
3. Invite others: **Settings → Roles & Permissions**.

## 5. Verify user sync

```sql
-- Supabase SQL Editor
SELECT u.id, u.email, au.email AS auth_email
FROM public.users u
LEFT JOIN auth.users au ON au.id::text = u.id
ORDER BY u.created_at DESC
LIMIT 20;
```

Every row in **Authentication → Users** should have a matching `public.users` row with the **same id**.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| User in Auth but not in `users` | Run `sync-auth-users.sql`; sign in again |
| 429 rate limit | Wait; use Sign in; turn off confirm email in dev |
| FK error on `user_id` | Ensure `public.users` row exists for that UUID |
| Old `local-dev-user` data | Dev-only id; new Supabase users use UUIDs |
| `db:push` hangs | Use focused SQL scripts instead |

## Row Level Security (client workspaces)

Client workspace isolation uses **defence in depth**:

1. **Express middleware** — `setWorkspaceRlsContext` sets `app.client_id` per API request; module guards block SI routes in workspace mode.
2. **Postgres RLS** — `jiganto_client_scope_allowed()` policies on all `client_id` tables: `pm_projects`, `crm_accounts`, `documents`, `document_folders`, `tasks`, `notifications`, `strategy_items`, `initiatives`, `governance_items` (see `scripts/sql/clients-rls.sql`).
3. **Session workspace** — active workspace is stored in the Express session (`workspace_id` / `activeClientId`); not in `localStorage`. API scoping reads session first.

Apply or refresh policies after schema changes:

```bash
# Supabase SQL Editor, or run scripts/sql/clients-rls.sql
```

## What is not used (yet)

- **Supabase Storage** — local `uploads/` for files

See also: [USER_GUIDE.md](./USER_GUIDE.md), [PERMISSIONS.md](./PERMISSIONS.md), [MULTI_TENANCY.md](./MULTI_TENANCY.md).
