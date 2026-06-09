-- Notifications workspace scoping + optional RLS helpers

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS client_id integer REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_client_id ON notifications(client_id);

-- Session variable used by app middleware: SET LOCAL app.client_id = '<id>'
