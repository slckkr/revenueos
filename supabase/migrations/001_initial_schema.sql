-- ============================================================
-- RevenueOS — Migration 001: Initial Schema
-- Run this in Supabase SQL Editor (or via supabase db push)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Settings (singleton per tenant) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL UNIQUE,
  reporting_currency      char(3) NOT NULL DEFAULT 'USD',
  recognition_method      text NOT NULL DEFAULT 'accrual'
                            CHECK (recognition_method IN ('accrual', 'cash')),
  hubspot_token_encrypted text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ─── Companies ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  name        text NOT NULL,
  domain      text,
  external_id text,       -- Logo / ERP customer code
  hubspot_id  text UNIQUE,
  segment     text CHECK (segment IN ('SMB', 'MID', 'ENT')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_tenant    ON companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_hubspot   ON companies(hubspot_id);
CREATE INDEX IF NOT EXISTS idx_companies_external  ON companies(external_id);

-- ─── Contacts ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  company_id  uuid REFERENCES companies(id) ON DELETE SET NULL,
  name        text NOT NULL,
  email       text,
  hubspot_id  text UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant    ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company   ON contacts(company_id);

-- ─── Products ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  name           text NOT NULL,
  sku            text,
  billing_period text NOT NULL DEFAULT 'monthly'
                   CHECK (billing_period IN ('monthly', 'annual', 'one_time')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);

-- ─── Subscriptions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES products(id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'churned', 'paused')),
  start_date  date NOT NULL,
  end_date    date,
  mrr_amount  numeric(15,2) NOT NULL,
  currency    char(3) NOT NULL DEFAULT 'USD',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant  ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON subscriptions(status);

-- ─── FX Rates ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fx_rates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date NOT NULL,
  from_currency char(3) NOT NULL,
  to_currency   char(3) NOT NULL,
  rate          numeric(20,8) NOT NULL,
  source        text DEFAULT 'ecb',
  UNIQUE (date, from_currency, to_currency)
);

CREATE INDEX IF NOT EXISTS idx_fx_rates_lookup ON fx_rates(date, from_currency, to_currency);

-- ─── Invoices ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL,
  company_id           uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  invoice_number       text NOT NULL,
  issue_date           date NOT NULL,
  due_date             date,
  service_period_start date,
  service_period_end   date,
  total_amount         numeric(15,2) NOT NULL,
  currency             char(3) NOT NULL,
  status               text NOT NULL DEFAULT 'issued'
                         CHECK (status IN ('draft', 'issued', 'paid', 'void')),
  source_type          text NOT NULL
                         CHECK (source_type IN ('hubspot', 'logo_import', 'excel_import', 'manual')),
  hubspot_deal_id      text,
  import_file_id       uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant     ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company    ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_period     ON invoices(service_period_start, service_period_end);
CREATE INDEX IF NOT EXISTS idx_invoices_hubspot    ON invoices(hubspot_deal_id);

-- ─── Invoice Lines ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES products(id) ON DELETE SET NULL,
  description text,
  quantity    numeric(10,4) NOT NULL DEFAULT 1,
  unit_price  numeric(15,2) NOT NULL,
  total_price numeric(15,2) NOT NULL,
  currency    char(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);

-- ─── Updated_at trigger for settings ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
