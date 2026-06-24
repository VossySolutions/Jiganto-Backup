# Archived one-time migration scripts

These scripts were used during incremental schema and tenant-route migrations before `npm run db:push` (Drizzle) became the primary schema sync path.

**Do not run on production** unless you are recovering a legacy database that predates the current Drizzle schema.

## Current workflow

1. Update models in `shared/` and run `npm run db:push`
2. Use `npm run db:seed-*` for demo data
3. Use `npm run smoke:*` for API verification

## Contents

| Script | Purpose |
|--------|---------|
| `patch-*-schema.mjs` | Module-specific SQL column/table patches |
| `patch-crm-columns.mjs` | CRM custom column backfill |
| `patch-routes-*.mjs` | Express route tenant scoping refactors |
| `patch-tm-tenant.mjs` | Test management tenant isolation |
| `migrate-require-tenant-routes.mjs` | Route middleware migration |
| `require-tenant-module-routes.mjs` | Tenant module route helper |
| `strip-*-tenant*.mjs` | Client/server tenant query cleanup |

Archived: June 2026 after migrations were applied to production schema via Drizzle.
