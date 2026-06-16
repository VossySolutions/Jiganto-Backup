-- Performance indexes for hot query paths (idempotent).
-- Run: npm run db:performance-indexes

CREATE INDEX IF NOT EXISTS idx_org_memberships_user_active ON org_memberships (user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_user ON org_memberships (org_id, user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_user_tenant ON profiles (user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_module_permissions_profile ON user_module_permissions (profile_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_documents_tenant_folder ON documents (tenant_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_client ON documents (tenant_id, client_id);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_client ON tasks (tenant_id, client_id);

CREATE INDEX IF NOT EXISTS idx_pm_projects_tenant ON pm_projects (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pm_projects_client ON pm_projects (client_id);

CREATE INDEX IF NOT EXISTS idx_pm_epics_workstream ON pm_epics (agile_workstream_id);
CREATE INDEX IF NOT EXISTS idx_pm_agile_stories_workstream ON pm_agile_stories (agile_workstream_id);
CREATE INDEX IF NOT EXISTS idx_pm_agile_sprints_workstream ON pm_agile_sprints (agile_workstream_id);
CREATE INDEX IF NOT EXISTS idx_pm_agile_defects_workstream ON pm_agile_defects (agile_workstream_id);

CREATE INDEX IF NOT EXISTS idx_crm_accounts_tenant_client ON crm_accounts (tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_rate_card_items_card ON rate_card_items (rate_card_id);
CREATE INDEX IF NOT EXISTS idx_resource_plan_template_rows_template ON resource_plan_template_rows (template_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_resource_rows_plan ON opportunity_resource_rows (plan_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions (message_id);

CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients (tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_users_client ON client_users (client_id);
