-- Phase 6: Predictive Intelligence & Benchmarks
-- churn_risk scoring, revenue forecasting, benchmark library, board snapshots
-- NOTE: tenant_id is a plain UUID (no tenants table) — same pattern as all other migrations.

-- Benchmark opt-ins (one row per tenant)
CREATE TABLE IF NOT EXISTS benchmark_optins (
  tenant_id UUID PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  enabled_at TIMESTAMPTZ
);

-- Benchmark aggregates (industry static + computed)
CREATE TABLE IF NOT EXISTS benchmark_aggregates (
  cohort_key VARCHAR(100) NOT NULL,   -- e.g. 'segment:smb', 'arr_range:1m-5m', 'industry:saas'
  metric_key VARCHAR(50) NOT NULL,    -- e.g. 'nrr', 'grr', 'logo_churn_rate', 'quick_ratio'
  p25 DECIMAL,
  p50 DECIMAL,
  p75 DECIMAL,
  n INTEGER NOT NULL DEFAULT 0,       -- sample size (0 = static/industry benchmark)
  source VARCHAR(50) DEFAULT 'industry',  -- 'industry' | 'computed'
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (cohort_key, metric_key)
);

-- Scheduled reports (placeholder — full cron in Phase 7)
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL,   -- 'board_snapshot' | 'mrr_summary' | 'churn_risk'
  cron_expr VARCHAR(100),             -- cron expression placeholder
  recipients_json JSONB DEFAULT '[]', -- email addresses
  is_active BOOLEAN DEFAULT false,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_tenant ON scheduled_reports(tenant_id, is_active);

-- Add forecast columns to metric_snapshots
ALTER TABLE metric_snapshots ADD COLUMN IF NOT EXISTS forecast_value DECIMAL;
ALTER TABLE metric_snapshots ADD COLUMN IF NOT EXISTS forecast_method VARCHAR(50);

-- ─── Static Industry Benchmark Data ─────────────────────────────────────────
-- Source: OpenView SaaS Benchmarks 2024, Bessemer State of the Cloud 2024,
--         KeyBanc SaaS Survey 2024, SaaStr industry data
-- These are median/percentile values for B2B SaaS companies

INSERT INTO benchmark_aggregates (cohort_key, metric_key, p25, p50, p75, n, source) VALUES

-- Global SaaS benchmarks (all sizes)
('global:saas', 'nrr',              95,  110, 125, 0, 'industry'),
('global:saas', 'grr',              82,  88,  93,  0, 'industry'),
('global:saas', 'logo_churn_rate',  1.5, 3.0, 6.0, 0, 'industry'),
('global:saas', 'quick_ratio',      1.0, 2.0, 4.0, 0, 'industry'),
('global:saas', 'arpa',             500, 1500, 5000, 0, 'industry'),
('global:saas', 'ltv_cac_ratio',    2.5, 4.0, 7.0, 0, 'industry'),
('global:saas', 'cac_payback_months', 12, 18, 30, 0, 'industry'),
('global:saas', 'rule_of_40',       10,  30,  55, 0, 'industry'),
('global:saas', 'revenue_per_employee', 120000, 175000, 250000, 0, 'industry'),
('global:saas', 'magic_number',     0.5, 0.75, 1.2, 0, 'industry'),

-- SMB-focused SaaS (<$1M ARR)
('arr_range:sub_1m', 'nrr',              88,  100, 115, 0, 'industry'),
('arr_range:sub_1m', 'grr',              78,  85,  90,  0, 'industry'),
('arr_range:sub_1m', 'logo_churn_rate',  2.0, 5.0, 10.0, 0, 'industry'),
('arr_range:sub_1m', 'quick_ratio',      0.8, 1.5, 3.0, 0, 'industry'),
('arr_range:sub_1m', 'arpa',             100, 400, 1200, 0, 'industry'),

-- Growth stage ($1M–$10M ARR)
('arr_range:1m_10m', 'nrr',              100, 112, 128, 0, 'industry'),
('arr_range:1m_10m', 'grr',              85,  90,  94,  0, 'industry'),
('arr_range:1m_10m', 'logo_churn_rate',  1.0, 2.5, 5.0, 0, 'industry'),
('arr_range:1m_10m', 'quick_ratio',      1.2, 2.5, 5.0, 0, 'industry'),
('arr_range:1m_10m', 'arpa',             800, 2500, 8000, 0, 'industry'),
('arr_range:1m_10m', 'cac_payback_months', 10, 15, 24, 0, 'industry'),
('arr_range:1m_10m', 'rule_of_40',       20, 40, 65, 0, 'industry'),

-- Scale stage ($10M–$50M ARR)
('arr_range:10m_50m', 'nrr',             105, 118, 135, 0, 'industry'),
('arr_range:10m_50m', 'grr',             88,  92,  96,  0, 'industry'),
('arr_range:10m_50m', 'logo_churn_rate', 0.5, 1.5, 3.5, 0, 'industry'),
('arr_range:10m_50m', 'quick_ratio',     1.5, 3.0, 6.0, 0, 'industry'),
('arr_range:10m_50m', 'arpa',            2000, 8000, 25000, 0, 'industry'),
('arr_range:10m_50m', 'cac_payback_months', 8, 12, 20, 0, 'industry'),
('arr_range:10m_50m', 'rule_of_40',      30, 50, 75, 0, 'industry'),

-- Enterprise-led ($50M+ ARR)
('arr_range:50m_plus', 'nrr',            108, 120, 140, 0, 'industry'),
('arr_range:50m_plus', 'grr',            90,  94,  98,  0, 'industry'),
('arr_range:50m_plus', 'logo_churn_rate', 0.3, 1.0, 2.5, 0, 'industry'),
('arr_range:50m_plus', 'quick_ratio',    1.8, 3.5, 7.0, 0, 'industry'),
('arr_range:50m_plus', 'arpa',           10000, 35000, 120000, 0, 'industry'),
('arr_range:50m_plus', 'cac_payback_months', 6, 10, 16, 0, 'industry'),
('arr_range:50m_plus', 'rule_of_40',     40, 60, 85, 0, 'industry'),

-- By segment type
('segment:smb', 'nrr',              90,  102, 118, 0, 'industry'),
('segment:smb', 'grr',              80,  86,  91,  0, 'industry'),
('segment:smb', 'logo_churn_rate',  1.5, 4.0, 8.0, 0, 'industry'),
('segment:smb', 'quick_ratio',      0.8, 1.8, 3.5, 0, 'industry'),
('segment:mid', 'nrr',              100, 113, 130, 0, 'industry'),
('segment:mid', 'grr',              85,  90,  95,  0, 'industry'),
('segment:mid', 'logo_churn_rate',  0.8, 2.0, 4.5, 0, 'industry'),
('segment:mid', 'quick_ratio',      1.2, 2.5, 5.0, 0, 'industry'),
('segment:ent', 'nrr',              105, 120, 138, 0, 'industry'),
('segment:ent', 'grr',              88,  93,  97,  0, 'industry'),
('segment:ent', 'logo_churn_rate',  0.3, 1.2, 3.0, 0, 'industry'),
('segment:ent', 'quick_ratio',      1.5, 3.0, 6.5, 0, 'industry')

ON CONFLICT (cohort_key, metric_key) DO NOTHING;
