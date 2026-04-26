-- ============================================================
-- Migration 010: Security Fixes
-- Fixes:
--   1. SECURITY DEFINER views → security_invoker = true
--   2. RLS enabled on all public tables (46 tables)
-- Strategy:
--   Backend uses service_role key → bypasses RLS automatically.
--   Direct PostgREST access (anon/authenticated) is blocked.
--   Only fx_rates and benchmark_aggregates get a SELECT policy
--   since they are global reference data with no tenant_id.
-- ============================================================

-- ─── 1. Fix SECURITY DEFINER Views ───────────────────────────────────────────

DROP VIEW IF EXISTS public.monthly_mrr;
CREATE VIEW public.monthly_mrr
WITH (security_invoker = true)
AS
SELECT
  tenant_id,
  month,
  SUM(amount_reporting)        AS mrr,
  SUM(amount_reporting) * 12   AS arr,
  COUNT(DISTINCT company_id)   AS active_companies
FROM public.revenue_ledger
WHERE event_type NOT IN ('CHURN', 'CONTRACTION')
GROUP BY tenant_id, month;

DROP VIEW IF EXISTS public.monthly_events_summary;
CREATE VIEW public.monthly_events_summary
WITH (security_invoker = true)
AS
SELECT
  tenant_id,
  month,
  SUM(CASE WHEN event_type = 'NEW'            THEN mrr_impact ELSE 0 END) AS new_mrr,
  SUM(CASE WHEN event_type = 'EXPANSION'      THEN mrr_impact ELSE 0 END) AS expansion_mrr,
  SUM(CASE WHEN event_type = 'CONTRACTION'    THEN mrr_impact ELSE 0 END) AS contraction_mrr,
  SUM(CASE WHEN event_type = 'CHURN'          THEN mrr_impact ELSE 0 END) AS churned_mrr,
  SUM(CASE WHEN event_type = 'REACTIVATION'   THEN mrr_impact ELSE 0 END) AS reactivation_mrr,
  SUM(CASE WHEN event_type = 'PRICE_INCREASE' THEN mrr_impact ELSE 0 END) AS price_increase_mrr,
  SUM(mrr_impact)                                                          AS net_new_mrr
FROM public.revenue_events
GROUP BY tenant_id, month;

-- ─── 2. Enable RLS on all tables ─────────────────────────────────────────────
-- Using DO block so missing tables don't abort the whole migration.

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    -- Core
    'settings', 'companies', 'contacts', 'products', 'subscriptions',
    'invoices', 'invoice_lines', 'payments', 'payment_methods',
    -- Revenue engine
    'import_files', 'revenue_ledger', 'revenue_events',
    'hubspot_sync_logs', 'sync_logs', 'integrations',
    -- Global reference
    'fx_rates',
    -- Phase 1
    'segments', 'company_tags', 'reconciliation_issues',
    'data_health_snapshots', 'import_file_references',
    'manual_journal_entries', 'financial_inputs_monthly',
    'audit_logs', 'roles',
    -- Phase 2
    'product_plans',
    -- Phase 4 – Sales Intelligence
    'deals', 'proposals', 'proposal_items', 'contracts',
    'activities', 'funnel_stages', 'funnel_entries',
    -- Phase 5 – AI Engine
    'account_scores_monthly', 'playbooks', 'playbook_triggers',
    'usage_events', 'notifications', 'notes', 'tasks',
    'slack_connections',
    -- Phase 6 – Predictive
    'benchmark_optins', 'benchmark_aggregates',
    'scheduled_reports', 'metric_snapshots'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      RAISE NOTICE 'RLS enabled on %', tbl;
    ELSE
      RAISE NOTICE 'Table % not found — skipped', tbl;
    END IF;
  END LOOP;
END $$;

-- ─── 3. Policies for global reference tables ─────────────────────────────────
-- fx_rates: no tenant_id — global currency rates. Allow authenticated SELECT.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fx_rates' AND policyname = 'fx_rates_select'
  ) THEN
    EXECUTE $p$
      CREATE POLICY fx_rates_select ON public.fx_rates
        FOR SELECT TO authenticated USING (true)
    $p$;
  END IF;
END $$;

-- benchmark_aggregates: anonymised industry data — safe to read.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename   = 'benchmark_aggregates'
      AND policyname  = 'benchmark_aggregates_select'
  ) THEN
    EXECUTE $p$
      CREATE POLICY benchmark_aggregates_select ON public.benchmark_aggregates
        FOR SELECT TO authenticated USING (true)
    $p$;
  END IF;
END $$;
