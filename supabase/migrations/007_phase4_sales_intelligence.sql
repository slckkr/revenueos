-- Phase 4: Sales Intelligence & Integration Expansion
-- Deals, Proposals, Contracts, Activities, Funnel, Cohort

-- ─────────────────────────────────────────────
-- DEALS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  stage VARCHAR(50) NOT NULL DEFAULT 'lead',
  amount DECIMAL(15,2),
  currency VARCHAR(3) DEFAULT 'USD',
  probability DECIMAL(5,2) CHECK (probability >= 0 AND probability <= 100),
  expected_close_date DATE,
  actual_close_date DATE,
  deal_type VARCHAR(50),
  owner_id UUID,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  external_id VARCHAR(255),
  hubspot_deal_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deals_tenant ON deals(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_id, status);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(tenant_id, stage, status);

-- ─────────────────────────────────────────────
-- PROPOSALS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  proposal_number VARCHAR(50),
  title VARCHAR(255),
  amount DECIMAL(15,2),
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
  sent_date DATE,
  expiry_date DATE,
  accepted_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_proposals_tenant ON proposals(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_company ON proposals(company_id);

CREATE TABLE IF NOT EXISTS proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  description VARCHAR(500),
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(15,2),
  total_price DECIMAL(15,2),
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal ON proposal_items(proposal_id);

-- ─────────────────────────────────────────────
-- CONTRACTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_number VARCHAR(100),
  title VARCHAR(255),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_value DECIMAL(15,2),
  currency VARCHAR(3) DEFAULT 'USD',
  auto_renewal BOOLEAN DEFAULT false,
  renewal_term_months INTEGER,
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expired', 'cancelled', 'renewed')),
  signed_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant ON contracts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_company ON contracts(company_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_renewal ON contracts(tenant_id, end_date, status);

-- ─────────────────────────────────────────────
-- ACTIVITIES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note', 'task', 'demo', 'follow_up')),
  subject VARCHAR(500),
  description TEXT,
  activity_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_id UUID,
  external_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activities_tenant ON activities(tenant_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_company ON activities(company_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_deal ON activities(deal_id);

-- ─────────────────────────────────────────────
-- FUNNEL STAGES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funnel_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  conversion_target DECIMAL(5,2),
  color VARCHAR(20) DEFAULT '#10b981',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_funnel_stages_tenant ON funnel_stages(tenant_id, sort_order);

CREATE TABLE IF NOT EXISTS funnel_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  stage_id UUID NOT NULL REFERENCES funnel_stages(id) ON DELETE CASCADE,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exited_at TIMESTAMPTZ,
  exit_reason VARCHAR(50)
);
CREATE INDEX IF NOT EXISTS idx_funnel_entries_stage ON funnel_entries(stage_id, entered_at);
CREATE INDEX IF NOT EXISTS idx_funnel_entries_tenant ON funnel_entries(tenant_id, entered_at);

-- ─────────────────────────────────────────────
-- SEED: Default funnel stages per tenant
-- (Inserted when a tenant is first created — here we seed for any existing tenants)
-- Each tenant running this migration gets default stages.
-- ─────────────────────────────────────────────
-- We use a DO block to seed only tenants that have no funnel stages yet
DO $$
DECLARE
  t_id UUID;
BEGIN
  FOR t_id IN (
    SELECT DISTINCT tenant_id FROM settings
    WHERE tenant_id NOT IN (SELECT DISTINCT tenant_id FROM funnel_stages)
  ) LOOP
    INSERT INTO funnel_stages (tenant_id, name, sort_order, conversion_target, color) VALUES
      (t_id, 'Lead',        1, 30, '#94a3b8'),
      (t_id, 'MQL',         2, 50, '#3b82f6'),
      (t_id, 'SQL',         3, 60, '#8b5cf6'),
      (t_id, 'Opportunity', 4, 70, '#f59e0b'),
      (t_id, 'Negotiation', 5, 80, '#f97316'),
      (t_id, 'Won',         6, 100, '#10b981'),
      (t_id, 'Lost',        7, 0,   '#ef4444');
  END LOOP;
END;
$$;
