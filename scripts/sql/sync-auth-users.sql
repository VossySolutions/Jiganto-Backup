-- Supabase SQL Editor: sync auth.users → public.users (standard dual-layer auth)
-- Run once after enabling Supabase Auth. Safe to re-run (idempotent).

-- ---------------------------------------------------------------------------
-- 1) Trigger: auto-create / update public.users when auth.users changes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_auth_user_to_app_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full text;
  v_first text;
  v_last text;
BEGIN
  v_full := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );
  v_first := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    NULLIF(split_part(trim(v_full), ' ', 1), ''),
    'User'
  );
  v_last := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    NULLIF(
      trim(substring(trim(v_full) from length(split_part(trim(v_full), ' ', 1)) + 1)),
      ''
    ),
    ''
  );

  INSERT INTO public.users (id, email, first_name, last_name, profile_image_url, updated_at)
  VALUES (
    NEW.id::text,
    NEW.email,
    v_first,
    v_last,
    NEW.raw_user_meta_data->>'avatar_url',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    profile_image_url = COALESCE(EXCLUDED.profile_image_url, public.users.profile_image_url),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_auth_user_to_app_users();

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_auth_user_to_app_users();

-- ---------------------------------------------------------------------------
-- 2) Backfill: copy existing Supabase Auth users into public.users
-- ---------------------------------------------------------------------------
INSERT INTO public.users (id, email, first_name, last_name, profile_image_url, updated_at)
SELECT
  u.id::text,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'first_name',
    NULLIF(split_part(trim(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', 'User')), ' ', 1), ''),
    'User'
  ),
  COALESCE(
    u.raw_user_meta_data->>'last_name',
    NULLIF(
      trim(
        substring(
          trim(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''))
          from length(split_part(trim(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ' ')), ' ', 1)) + 1
        )
      ),
      ''
    ),
    ''
  ),
  u.raw_user_meta_data->>'avatar_url',
  NOW()
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  profile_image_url = COALESCE(EXCLUDED.profile_image_url, public.users.profile_image_url),
  updated_at = NOW();
