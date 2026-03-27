-- =============================================================================
-- Phase 3: Advanced Metrics & Product Intelligence
-- =============================================================================

-- ─── data_health_snapshots ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_health_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  snapshot_date   DATE NOT NULL,
  score           INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  breakdown_json  JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (tenant_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_data_health_tenant
  ON data_health_snapshots(tenant_id, snapshot_date DESC);

-- ─── financial_inputs_monthly ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_inputs_monthly (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  month                   VARCHAR(10) NOT NULL,   -- 'YYYY-MM-01'
  total_revenue_override  DECIMAL(18,4),
  cogs                    DECIMAL(18,4),
  opex                    DECIMAL(18,4),
  sales_marketing_spend   DECIMAL(18,4),
  headcount               INTEGER,
  profit_margin_override  DECIMAL(8,4),           -- percent, e.g. 22.5 = 22.5%
  notes                   TEXT,
  created_by              VARCHAR(100) DEFAULT 'admin',
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (tenant_id, month)
);

CREATE INDEX IF NOT EXISTS idx_financial_inputs_tenant
  ON financial_inputs_monthly(tenant_id, month DESC);

-- ─── product_plans ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  monthly_price DECIMAL(18,4),
  annual_price  DECIMAL(18,4),
  features_json JSONB DEFAULT '[]',
  is_active     BOOLEAN DEFAULT true,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_plans_product
  ON product_plans(product_id);
CREATE INDEX IF NOT EXISTS idx_product_plans_tenant
  ON product_plans(tenant_id);
