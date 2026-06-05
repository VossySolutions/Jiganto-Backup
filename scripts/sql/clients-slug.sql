-- Section 4.2 — workspace slugs for /ws/[slug] URLs
ALTER TABLE clients ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE clients
SET slug = lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

CREATE UNIQUE INDEX IF NOT EXISTS clients_tenant_slug_idx
  ON clients (tenant_id, slug)
  WHERE slug IS NOT NULL AND status = 'active';
