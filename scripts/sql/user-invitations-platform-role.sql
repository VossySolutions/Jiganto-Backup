-- Optional columns for explicit platform role on user invitations (Phase B).
-- Run in Supabase SQL Editor if db:push is slow or fails.

ALTER TABLE user_invitations
  ADD COLUMN IF NOT EXISTS platform_role text,
  ADD COLUMN IF NOT EXISTS locked_workspace_id integer;
