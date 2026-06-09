-- Run in Supabase SQL Editor after pull (Section 3 + 4 complete)
-- Auth: sync auth.users → public.users (run sync-auth-users.sql first if using Supabase Auth)
\i sync-auth-users.sql
\i permissions-tables.sql
\i clients-slug.sql
\i client-workspace-grants.sql
\i documents-client-id.sql
\i initiatives-client-id.sql
-- Client workspace RLS (or: npm run db:clients-rls)
\i clients-rls.sql
-- Clients API indexes (or: npm run db:clients-indexes)
\i clients-indexes.sql
