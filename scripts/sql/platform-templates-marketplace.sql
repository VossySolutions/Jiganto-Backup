-- Module 20 — Marketplace columns (Phase 3)
ALTER TABLE platform_templates ADD COLUMN IF NOT EXISTS marketplace_listed BOOLEAN DEFAULT false;
ALTER TABLE platform_templates ADD COLUMN IF NOT EXISTS marketplace_featured BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_platform_templates_marketplace ON platform_templates(marketplace_listed) WHERE marketplace_listed = true;
