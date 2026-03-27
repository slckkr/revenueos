-- Phase 5: AI & Action Engine
-- usage_events, account_scores_monthly, playbooks, notifications, notes, tasks, slack_connections
-- NOTE: tenant_id is a plain UUID (no tenants table) — same pattern as all other migrations.

-- Usage Events (product telemetry ingestion)
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  event_name VARCHAR(100) NOT NULL,
  event_value DECIMAL,
  event_date TIMESTAMPTZ NOT NULL,
  metadata_json JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_usage_events_company ON usage_events(tenant_id, company_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_product ON usage_events(product_id, event_date DESC);

-- Account Scores Monthly (expansion + health + churn_risk scores)
CREATE TABLE IF NOT EXISTS account_scores_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  month VARCHAR(7) NOT NULL,          -- e.g. "2025-03"
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  score_type VARCHAR(50) NOT NULL,    -- 'expansion' | 'health' | 'churn_risk'
  score_value DECIMAL NOT NULL CHECK (score_value >= 0 AND score_value <= 100),
  reasons_json JSONB DEFAULT '[]',
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, month, company_id, score_type)
);
CREATE INDEX IF NOT EXISTS idx_account_scores_company ON account_scores_monthly(tenant_id, company_id, score_type);
CREATE INDEX IF NOT EXISTS idx_account_scores_month ON account_scores_monthly(tenant_id, month, score_type);

-- Cache health_score and expansion_score on companies for quick access
ALTER TABLE companies ADD COLUMN IF NOT EXISTS health_score DECIMAL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS expansion_score DECIMAL;

-- Playbooks (trigger → recommended actions)
CREATE TABLE IF NOT EXISTS playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,   -- 'metric_threshold' | 'expansion_signal' | 'health_alert' | 'renewal_approaching'
  trigger_key VARCHAR(100) NOT NULL,   -- e.g. 'nrr_below_100', 'expansion_score_above_80'
  trigger_threshold DECIMAL,
  recommended_actions_json JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_playbooks_tenant ON playbooks(tenant_id, is_active);

-- Playbook Trigger Log (history of fires)
CREATE TABLE IF NOT EXISTS playbook_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  trigger_value DECIMAL,
  fired_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_playbook_triggers ON playbook_triggers(tenant_id, playbook_id, fired_at DESC);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  type VARCHAR(30) NOT NULL,           -- 'playbook' | 'task_assigned' | 'renewal' | 'anomaly'
  title VARCHAR(255) NOT NULL,
  body TEXT,
  is_read BOOLEAN DEFAULT false,
  link VARCHAR(500),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id, is_read, created_at DESC);

-- Notes (attached to companies, deals, proposals, contracts)
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  object_type VARCHAR(50) NOT NULL,   -- 'company' | 'deal' | 'proposal' | 'contract'
  object_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notes_object ON notes(object_type, object_id, created_at DESC);

-- Tasks (linked to company/deal/contract)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  object_type VARCHAR(50),             -- 'company' | 'deal' | 'proposal' | 'contract' | null
  object_id UUID,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(tenant_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_object ON tasks(object_type, object_id);

-- Slack Connections (placeholder, full impl Phase 7)
CREATE TABLE IF NOT EXISTS slack_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  webhook_url VARCHAR(500),
  channel_default VARCHAR(100),
  notify_on_churn_risk BOOLEAN DEFAULT true,
  notify_on_expansion BOOLEAN DEFAULT true,
  notify_on_renewal BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default playbooks for existing tenants (settings table holds one row per tenant)
DO $$
DECLARE
  t_id UUID;
BEGIN
  FOR t_id IN SELECT DISTINCT tenant_id FROM settings LOOP
    INSERT INTO playbooks (tenant_id, name, trigger_type, trigger_key, trigger_threshold, recommended_actions_json)
    VALUES
      (t_id, 'Low NRR Alert', 'metric_threshold', 'nrr_below_100', 100,
        '["Review churned accounts this month", "Schedule QBRs with at-risk accounts", "Analyze product usage drop trends"]'),
      (t_id, 'Quick Ratio Warning', 'metric_threshold', 'quick_ratio_below_1', 1,
        '["Audit expansion pipeline for blockers", "Review churn reasons from last 90 days", "Accelerate upsell plays for top accounts"]'),
      (t_id, 'Expansion Opportunity', 'expansion_signal', 'expansion_score_above_80', 80,
        '["Reach out to account with expansion offer", "Schedule product review call", "Prepare upsell proposal"]'),
      (t_id, 'Health Alert', 'health_alert', 'health_score_below_30', 30,
        '["Initiate executive-level outreach", "Schedule emergency QBR", "Offer concession or extended trial"]'),
      (t_id, 'Renewal Approaching', 'renewal_approaching', 'renewal_within_30_days', 30,
        '["Send renewal proposal", "Review account health before renewal", "Offer multi-year discount if health is good"]')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
