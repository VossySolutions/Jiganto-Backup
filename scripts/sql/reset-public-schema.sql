-- WARNING: Deletes ALL application data in public schema (tables, views, functions in public).
-- Does NOT delete auth.users (Supabase Authentication logins are kept).
--
-- Use via: npm run db:reset
-- Or paste into Supabase SQL Editor, then run: npm run db:push

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Supabase API roles (safe if roles exist; ignore errors on local Postgres)
DO $$
BEGIN
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
