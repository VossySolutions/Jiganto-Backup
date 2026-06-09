-- Defense-in-depth RLS (Docs §7.1) — requires app.client_id set per request via middleware.
-- Master org view: app.client_id is empty → all tenant rows visible (app enforces tenant).
-- Client workspace: only rows with matching client_id (NULL client_id rows hidden).

CREATE OR REPLACE FUNCTION jiganto_client_scope_allowed(row_client_id integer) RETURNS boolean
  LANGUAGE sql STABLE AS $$
    SELECT
      COALESCE(current_setting('app.client_id', true), '') = ''
      OR (
        row_client_id IS NOT NULL
        AND row_client_id = NULLIF(current_setting('app.client_id', true), '')::integer
      );
  $$;

-- Helper: idempotent policy creation for a table with client_id column
CREATE OR REPLACE PROCEDURE jiganto_apply_client_rls(tbl text) LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_client_scope', tbl);
  EXECUTE format(
    'CREATE POLICY %I ON %I USING (jiganto_client_scope_allowed(client_id)) WITH CHECK (jiganto_client_scope_allowed(client_id))',
    tbl || '_client_scope',
    tbl
  );
END;
$$;

CALL jiganto_apply_client_rls('pm_projects');
CALL jiganto_apply_client_rls('crm_accounts');
CALL jiganto_apply_client_rls('documents');
CALL jiganto_apply_client_rls('document_folders');
CALL jiganto_apply_client_rls('tasks');
CALL jiganto_apply_client_rls('notifications');
CALL jiganto_apply_client_rls('strategy_items');
CALL jiganto_apply_client_rls('initiatives');
CALL jiganto_apply_client_rls('governance_items');
