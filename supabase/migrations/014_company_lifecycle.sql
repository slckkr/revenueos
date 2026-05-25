-- ============================================================
-- RevenueOS — Migration 014: Company Lifecycle & Intelligence
-- Adds lifecycle_stage (CRM pipeline) and strategic_notes
-- ============================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS lifecycle_stage  varchar(20),
  ADD COLUMN IF NOT EXISTS strategic_notes  text;

-- Valid stages: target → prospect → qualified → hot_lead → proposal → customer → at_risk → churned
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'companies' AND constraint_name = 'companies_lifecycle_stage_check'
  ) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_lifecycle_stage_check
      CHECK (lifecycle_stage IS NULL OR lifecycle_stage IN (
        'target', 'prospect', 'qualified', 'hot_lead',
        'proposal', 'customer', 'at_risk', 'churned'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_companies_lifecycle ON companies(tenant_id, lifecycle_stage);
