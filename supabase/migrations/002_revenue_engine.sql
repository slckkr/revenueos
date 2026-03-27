-- ============================================================
-- RevenueOS — Migration 002: Revenue Engine Tables
-- ============================================================

-- ─── Import Files ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_files (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  source           text NOT NULL CHECK (source IN ('excel', 'csv', 'xml_logo')),
  filename         text NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'processing', 'done', 'error')),
  records_imported int NOT NULL DEFAULT 0,
  errors_json      jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       text
);

CREATE INDEX IF NOT EXISTS idx_import_files_tenant ON import_files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_files_status ON import_files(status);

-- ─── Revenue Ledger (source of truth for all metrics) ────────────────────────
-- Each row = one month's revenue contribution for a company×product pair
-- event_type here is the nature of the revenue (what caused this amount to appear)
CREATE TABLE IF NOT EXISTS revenue_ledger (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id          uuid REFERENCES products(id) ON DELETE SET NULL,
  month               date NOT NULL,  -- always 1st of month: 2024-01-01
  event_type          text NOT NULL
                        CHECK (event_type IN (
                          'NEW','EXPANSION','CONTRACTION','CHURN',
                          'REACTIVATION','PRICE_INCREASE'
                        )),
  amount_original     numeric(15,2) NOT NULL,
  currency            char(3) NOT NULL,
  fx_rate             numeric(20,8) NOT NULL DEFAULT 1,
  amount_reporting    numeric(15,2) NOT NULL,  -- in tenant's reporting currency
  recognition_method  text NOT NULL DEFAULT 'accrual'
                        CHECK (recognition_method IN ('accrual', 'cash')),
  source_type         text NOT NULL
                        CHECK (source_type IN (
                          'invoice','subscription','hubspot_deal','manual'
                        )),
  source_id           uuid,   -- FK to invoice.id or subscription.id
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_tenant_month   ON revenue_ledger(tenant_id, month);
CREATE INDEX IF NOT EXISTS idx_ledger_company_month  ON revenue_ledger(tenant_id, company_id, month);
CREATE INDEX IF NOT EXISTS idx_ledger_event_month    ON revenue_ledger(tenant_id, event_type, month);
CREATE INDEX IF NOT EXISTS idx_ledger_source         ON revenue_ledger(source_type, source_id);

-- ─── Revenue Events ───────────────────────────────────────────────────────────
-- Derived table: one row per company×product×month showing the MRR transition
-- Populated by the revenue-events service after ledger is built
CREATE TABLE IF NOT EXISTS revenue_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES products(id) ON DELETE SET NULL,
  month       date NOT NULL,
  event_type  text NOT NULL
                CHECK (event_type IN (
                  'NEW','EXPANSION','CONTRACTION','CHURN',
                  'REACTIVATION','PRICE_INCREASE'
                )),
  mrr_impact  numeric(15,2) NOT NULL,  -- signed: positive = growth, negative = contraction/churn
  prev_mrr    numeric(15,2) NOT NULL DEFAULT 0,
  new_mrr     numeric(15,2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, company_id, product_id, month, event_type)
);

CREATE INDEX IF NOT EXISTS idx_events_tenant_month  ON revenue_events(tenant_id, month);
CREATE INDEX IF NOT EXISTS idx_events_company       ON revenue_events(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_events_type          ON revenue_events(tenant_id, event_type, month);

-- ─── HubSpot Sync Logs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hubspot_sync_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  synced_at         timestamptz NOT NULL DEFAULT now(),
  status            text NOT NULL CHECK (status IN ('running', 'done', 'error')),
  companies_synced  int NOT NULL DEFAULT 0,
  contacts_synced   int NOT NULL DEFAULT 0,
  deals_synced      int NOT NULL DEFAULT 0,
  error_message     text
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_tenant ON hubspot_sync_logs(tenant_id, synced_at DESC);

-- ─── Useful Views ─────────────────────────────────────────────────────────────

-- Monthly MRR summary view
CREATE OR REPLACE VIEW monthly_mrr AS
SELECT
  tenant_id,
  month,
  SUM(amount_reporting) AS mrr,
  SUM(amount_reporting) * 12 AS arr,
  COUNT(DISTINCT company_id) AS active_companies
FROM revenue_ledger
WHERE event_type NOT IN ('CHURN', 'CONTRACTION')
GROUP BY tenant_id, month;

-- Event type breakdown view
CREATE OR REPLACE VIEW monthly_events_summary AS
SELECT
  tenant_id,
  month,
  SUM(CASE WHEN event_type = 'NEW' THEN mrr_impact ELSE 0 END) AS new_mrr,
  SUM(CASE WHEN event_type = 'EXPANSION' THEN mrr_impact ELSE 0 END) AS expansion_mrr,
  SUM(CASE WHEN event_type = 'CONTRACTION' THEN mrr_impact ELSE 0 END) AS contraction_mrr,
  SUM(CASE WHEN event_type = 'CHURN' THEN mrr_impact ELSE 0 END) AS churned_mrr,
  SUM(CASE WHEN event_type = 'REACTIVATION' THEN mrr_impact ELSE 0 END) AS reactivation_mrr,
  SUM(CASE WHEN event_type = 'PRICE_INCREASE' THEN mrr_impact ELSE 0 END) AS price_increase_mrr,
  SUM(mrr_impact) AS net_new_mrr
FROM revenue_events
GROUP BY tenant_id, month;
