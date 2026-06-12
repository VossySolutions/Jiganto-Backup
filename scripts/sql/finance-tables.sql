-- Finance Module 07 — schema migration
-- Run in Supabase SQL editor if `npm run db:push` is slow

-- Timesheet ADR-004 columns
ALTER TABLE timesheet_periods ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft';
ALTER TABLE timesheet_periods ADD COLUMN IF NOT EXISTS approved_by_pm_id VARCHAR REFERENCES users(id);
ALTER TABLE timesheet_periods ADD COLUMN IF NOT EXISTS approved_by_pm_at TIMESTAMPTZ;
ALTER TABLE timesheet_periods ADD COLUMN IF NOT EXISTS approved_by_rm_id VARCHAR REFERENCES users(id);
ALTER TABLE timesheet_periods ADD COLUMN IF NOT EXISTS approved_by_rm_at TIMESTAMPTZ;

ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS entry_date DATE;
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS charge_rate NUMERIC(10,2);
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS cost_rate NUMERIC(10,2);
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS calculated_charge NUMERIC(15,2);
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS calculated_cost NUMERIC(15,2);
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS is_invoiced BOOLEAN DEFAULT false;

-- Rate card enhancements
ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS card_type TEXT DEFAULT 'standard';
ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS client_id INTEGER;
ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS project_id INTEGER;
ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE rate_card_items ADD COLUMN IF NOT EXISTS hourly_charge_rate NUMERIC(10,2);
ALTER TABLE rate_card_items ADD COLUMN IF NOT EXISTS hourly_cost_rate NUMERIC(10,2);

-- Finance settings
CREATE TABLE IF NOT EXISTS finance_settings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL UNIQUE,
  base_currency TEXT NOT NULL DEFAULT 'GBP',
  timesheet_approval_mode TEXT NOT NULL DEFAULT 'both',
  invoice_prefix TEXT DEFAULT 'INV',
  default_payment_terms TEXT DEFAULT 'net_30',
  org_address TEXT,
  org_bank_details TEXT,
  mileage_rate_car NUMERIC(6,2) DEFAULT 0.45,
  mileage_rate_motorcycle NUMERIC(6,2) DEFAULT 0.24,
  mileage_rate_bicycle NUMERIC(6,2) DEFAULT 0.20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC(12,6) NOT NULL,
  rate_date DATE NOT NULL,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_budgets (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  client_id INTEGER,
  contract_type TEXT NOT NULL DEFAULT 'fixed_price',
  contract_value NUMERIC(15,2),
  budget_currency TEXT NOT NULL DEFAULT 'GBP',
  billing_currency TEXT NOT NULL DEFAULT 'GBP',
  labour_budget NUMERIC(15,2) DEFAULT 0,
  expense_budget NUMERIC(15,2) DEFAULT 0,
  total_budget NUMERIC(15,2) DEFAULT 0,
  target_margin_pct NUMERIC(5,2),
  rate_card_id INTEGER,
  exchange_rate NUMERIC(12,6),
  billed_to_date NUMERIC(15,2) DEFAULT 0,
  actual_cost NUMERIC(15,2) DEFAULT 0,
  forecast_cost NUMERIC(15,2),
  evm_enabled BOOLEAN DEFAULT false,
  deliverable_progress_pct NUMERIC(5,2) DEFAULT 0,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budget_labour_lines (
  id SERIAL PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES project_budgets(id) ON DELETE CASCADE,
  phase TEXT,
  role_name TEXT NOT NULL,
  budgeted_days NUMERIC(8,1) DEFAULT 0,
  budgeted_cost NUMERIC(15,2) DEFAULT 0,
  actual_days NUMERIC(8,1) DEFAULT 0,
  actual_cost NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budget_expense_lines (
  id SERIAL PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES project_budgets(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  budgeted_amount NUMERIC(15,2) DEFAULT 0,
  actual_amount NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budget_milestone_lines (
  id SERIAL PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES project_budgets(id) ON DELETE CASCADE,
  milestone_id INTEGER,
  name TEXT NOT NULL,
  value NUMERIC(15,2) NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'pending',
  is_invoiced BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expense_reports (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  project_id INTEGER NOT NULL REFERENCES pm_projects(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'GBP',
  exchange_rate NUMERIC(12,6),
  total_amount NUMERIC(15,2) DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  approved_by VARCHAR REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  paid_at TIMESTAMPTZ,
  reimbursed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expense_items (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES expense_reports(id) ON DELETE CASCADE,
  item_date DATE NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  receipt_url TEXT,
  is_billable BOOLEAN DEFAULT true,
  vat_amount NUMERIC(15,2),
  payment_method TEXT DEFAULT 'personal_card',
  is_invoiced BOOLEAN DEFAULT false,
  mileage_distance NUMERIC(8,1),
  mileage_vehicle_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_invoices (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL REFERENCES pm_projects(id),
  client_id INTEGER REFERENCES crm_accounts(id),
  invoice_number TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'fixed_price',
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_terms TEXT DEFAULT 'net_30',
  currency TEXT NOT NULL DEFAULT 'GBP',
  exchange_rate NUMERIC(12,6),
  subtotal NUMERIC(15,2) DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  total NUMERIC(15,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  paid_date DATE,
  amount_paid NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  po_number TEXT,
  erp_reference TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_invoice_lines (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES finance_invoices(id) ON DELETE CASCADE,
  line_type TEXT NOT NULL DEFAULT 'fixed_fee',
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_rate NUMERIC(15,2) DEFAULT 0,
  amount NUMERIC(15,2) NOT NULL,
  timesheet_entry_ids JSONB,
  expense_item_ids JSONB,
  milestone_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_invoice_payments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES finance_invoices(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  payment_method TEXT DEFAULT 'bank_transfer',
  reference TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS erp_integrations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  system TEXT NOT NULL,
  credentials_json JSONB,
  field_mapping_json JSONB,
  webhook_url TEXT,
  webhook_auth_header TEXT,
  auto_sync BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS erp_sync_log (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  integration_id INTEGER REFERENCES erp_integrations(id),
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
