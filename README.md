# Jiganto

Enterprise SaaS platform (React + Express + PostgreSQL). Self-hosted on Windows or Ubuntu.

## Quick start

```bash
cp .env.example .env
# Edit .env — see docs/DEPLOYMENT.md for modules 6–20 checklist
npm install
npm run db:push
npm run dev
```

Open http://localhost:5000 → **Sign in** (Supabase auth).

## Database & authentication

Jiganto uses **Supabase PostgreSQL** and **Supabase Auth**. Application data lives in `public.users` (synced from `auth.users`).

- **[docs/SUPABASE.md](docs/SUPABASE.md)** — database + auth setup
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — production checklist for CRM → Templates modules
- **[.env.example](.env.example)** — all environment variables (required vs optional)

### Required `.env` variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Session signing key |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Server auth |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Client auth |
| `ENABLE_DEV_LOGIN=false` | Production (use Supabase login) |

Optional third-party keys (`OPENAI_API_KEY`, `RESEND_API_KEY`, Finance ERP OAuth, etc.) are documented in `.env.example`. Core modules work without them; specific features degrade gracefully.

## Local development (Windows)

1. Install [Node.js 20+](https://nodejs.org/).
2. Use Supabase (recommended) or local Postgres: `DATABASE_URL=postgresql://postgres:pass@localhost:5432/jiganto`.
3. Copy `.env.example` → `.env`, fill required values.
4. Run `npm install` → `npm run db:push` → `npm run dev`.

For local-only dev without Supabase login, set `ENABLE_DEV_LOGIN=true` (never in production).

## Production (Ubuntu)

```bash
npm install
npm run db:push
npm run build
npm run start
```

Set `NODE_ENV=production`, all required Supabase vars, and `ENABLE_DEV_LOGIN=false`. Use nginx + HTTPS in front.

Full checklist: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

## Optional: OpenAI

Set `OPENAI_API_KEY` for AI planner (Resource Planning), Business insights, Portfolio narrative, Surveys generation, Test Management test generation, and the global assistant. Without it, those features use rule-based fallbacks.

## Smoke tests

With the dev server running and `SMOKE_BEARER_TOKEN` set in `.env`:

```bash
npm run smoke:validate-all
```

See `package.json` for per-module smoke scripts.
