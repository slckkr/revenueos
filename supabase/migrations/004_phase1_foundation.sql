-- ============================================================
-- RevenueOS — Migration 004: Phase 1 Foundation Enhancement
-- Additive-only: no existing tables/columns removed
-- Run in Supabase SQL Editor
-- ============================================================

-- ─── companies — new columns ─────────────────────────────────────────────────
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS employee_count  integer,
  ADD COLUMN IF NOT EXISTS country         varchar(100),
  ADD COLUMN IF NOT EXISTS city            varchar(100),
  ADD COLUMN IF NOT EXISTS industry        varchar(100),
  ADD COLUMN IF NOT EXISTS owner_id        uuid,           -- references auth user id (no FK constraint)
  ADD COLUMN IF NOT EXISTS status          varchar(20)  NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS annual_revenue  numeric(18,2),
  ADD COLUMN IF NOT EXISTS source          varchar(50)  NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz  NOT NULL DEFAULT now();

-- Backfill existing rows
UPDATE companies SET status = 'active' WHERE status IS NULL;
UPDATE companies SET source = 'manual'  WHERE source  IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_status  ON companies(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_companies_country ON companies(tenant_id, country);

-- ─── products — new columns ───────────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS description    text,
  ADD COLUMN IF NOT EXISTS pricing_model  varchar(20)  NOT NULL DEFAULT 'flat',
  ADD COLUMN IF NOT EXISTS category       varchar(100),
  ADD COLUMN IF NOT EXISTS status         varchar(20)  NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS launched_at    date,
  ADD COLUMN IF NOT EXISTS default_price  numeric(15,2),
  ADD COLUMN IF NOT EXISTS currency       char(3)      NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS updated_at     timestamptz  NOT NULL DEFAULT now();

UPDATE products SET pricing_model = 'flat'   WHERE pricing_model IS NULL;
UPDATE products SET status        = 'active' WHERE status IS NULL;
UPDATE products SET currency      = 'USD'    WHERE currency IS NULL;

-- ─── invoices — new columns ───────────────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS paid_date   date,
  ADD COLUMN IF NOT EXISTS external_id varchar(255);

-- ─── subscriptions — new columns ─────────────────────────────────────────────
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle        varchar(20) NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS next_renewal_date    date,
  ADD COLUMN IF NOT EXISTS last_renewal_date    date,
  ADD COLUMN IF NOT EXISTS cancellation_date    date,
  ADD COLUMN IF NOT EXISTS cancellation_reason  text,
  ADD COLUMN IF NOT EXISTS trial_end_date       date;

UPDATE subscriptions SET billing_cycle = 'monthly' WHERE billing_cycle IS NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal ON subscriptions(tenant_id, next_renewal_date);

-- ─── contacts — new columns (existing: id, tenant_id, company_id, name, email, hubspot_id, created_at)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS first_name  varchar(100),
  ADD COLUMN IF NOT EXISTS last_name   varchar(100),
  ADD COLUMN IF NOT EXISTS phone       varchar(50),
  ADD COLUMN IF NOT EXISTS title       varchar(200),
  ADD COLUMN IF NOT EXISTS role_type   varchar(50),   -- champion/decision-maker/user/billing
  ADD COLUMN IF NOT EXISTS is_primary  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- ─── payments ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL,
  company_id   uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id   uuid        REFERENCES invoices(id) ON DELETE SET NULL,
  payment_date date        NOT NULL,
  amount       numeric(15,2) NOT NULL,
  currency     char(3)     NOT NULL DEFAULT 'USD',
  method       varchar(50),   -- bank_transfer / credit_card / other
  status       varchar(20) NOT NULL DEFAULT 'completed',
  external_id  varchar(255),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant    ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_company   ON payments(company_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice   ON payments(invoice_id);

-- ─── payment_methods ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_methods (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL,
  company_id   uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type         varchar(50),      -- credit_card / bank_account / other
  last_four    varchar(4),
  brand        varchar(50),      -- visa / mastercard / amex
  expiry_month integer,
  expiry_year  integer,
  is_default   boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_company ON payment_methods(company_id);

-- ─── roles ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL,
  name             varchar(50) NOT NULL,
  permissions_json jsonb       NOT NULL DEFAULT '{}',
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- Seed roles for default tenant
INSERT INTO roles (tenant_id, name, permissions_json, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin',     '{"all": true}', true),
  ('00000000-0000-0000-0000-000000000001', 'sales_rep', '{"read": ["companies","deals","contacts"], "write": ["deals","activities"]}', false),
  ('00000000-0000-0000-0000-000000000001', 'csm',       '{"read": ["companies","contacts","invoices"], "write": ["activities","notes"]}', false),
  ('00000000-0000-0000-0000-000000000001', 'finance',   '{"read": ["invoices","payments","ledger","metrics"], "write": ["payments"]}', false),
  ('00000000-0000-0000-0000-000000000001', 'ceo',       '{"read": ["all"]}', false)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ─── integrations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integrations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL,
  provider     varchar(50) NOT NULL,   -- hubspot / logo / trendyol / woocommerce / stripe / salesforce
  status       varchar(20) NOT NULL DEFAULT 'disconnected',
  config_json  jsonb       NOT NULL DEFAULT '{}',
  last_sync_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integrations_tenant ON integrations(tenant_id, provider);

-- Seed integrations for default tenant
INSERT INTO integrations (tenant_id, provider, status)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'hubspot',     'disconnected'),
  ('00000000-0000-0000-0000-000000000001', 'logo',        'file_import'),
  ('00000000-0000-0000-0000-000000000001', 'trendyol',    'coming_soon'),
  ('00000000-0000-0000-0000-000000000001', 'woocommerce', 'coming_soon'),
  ('00000000-0000-0000-0000-000000000001', 'stripe',      'coming_soon'),
  ('00000000-0000-0000-0000-000000000001', 'salesforce',  'coming_soon')
ON CONFLICT (tenant_id, provider) DO NOTHING;

-- ─── sync_logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL,
  integration_id  uuid        NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  sync_type       varchar(20) NOT NULL DEFAULT 'full',   -- full / incremental
  status          varchar(20) NOT NULL DEFAULT 'running',
  records_synced  integer     NOT NULL DEFAULT 0,
  errors_json     jsonb       NOT NULL DEFAULT '[]',
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_integration ON sync_logs(integration_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_tenant      ON sync_logs(tenant_id, started_at DESC);

-- ─── segments ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS segments (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid         NOT NULL,
  name          varchar(100) NOT NULL,
  criteria_json jsonb        NOT NULL DEFAULT '{}',
  created_at    timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- Seed default segments
INSERT INTO segments (tenant_id, name, criteria_json)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Enterprise',   '{"segment": "ENT"}'),
  ('00000000-0000-0000-0000-000000000001', 'Mid-Market',   '{"segment": "MID"}'),
  ('00000000-0000-0000-0000-000000000001', 'SMB',          '{"segment": "SMB"}')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ─── company_tags ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_tags (
  id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid         NOT NULL,
  company_id uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tag        varchar(100) NOT NULL,
  created_at timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, company_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_company_tags_company ON company_tags(company_id);
CREATE INDEX IF NOT EXISTS idx_company_tags_tenant  ON company_tags(tenant_id, tag);
