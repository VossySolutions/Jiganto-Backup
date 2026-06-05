# Jiganto

Enterprise SaaS platform (React + Express + PostgreSQL). Self-hosted on Windows or Ubuntu.

## Database: Supabase (free tier, recommended)

Jiganto uses **PostgreSQL only** from Supabase—not Supabase Auth or Storage. See **[docs/SUPABASE.md](docs/SUPABASE.md)** for step-by-step setup.

Quick version:

1. Create a free project at [supabase.com](https://supabase.com).
2. Copy the **Session pooler** URI → `DATABASE_URL` in `.env`.
3. Run:

```bash
cp .env.example .env
# edit .env with DATABASE_URL and SESSION_SECRET
npm install
npm run db:push
npm run dev
```

5. Open http://localhost:5000 → **Sign in**.

## Local development (Windows)

1. Install [Node.js 20+](https://nodejs.org/).
2. Use Supabase (above) **or** local Postgres with `DATABASE_URL=postgresql://postgres:pass@localhost:5432/jiganto`.
3. Copy `.env.example` → `.env`, set `SESSION_SECRET`.
4. `npm install` → `npm run db:push` → `npm run dev`.

## Production (Ubuntu)

1. Install Node.js 20+; use the same Supabase `DATABASE_URL` on the server.
2. Set `NODE_ENV=production`, `SESSION_SECRET`, and database URLs in `.env`.
3. Build and run:

```bash
npm install
npm run db:push
npm run build
npm run start
```

4. Use nginx + HTTPS in front. Secure session cookies are enabled in production.

## Authentication

Session-based sign-in (`/api/login`) with users stored in Postgres (including Supabase). Configure the first admin via `AUTH_USER_*` in `.env`. Add proper multi-user auth before a public launch.

## Optional: OpenAI

Set `OPENAI_API_KEY` for the AI assistant and survey generation.
