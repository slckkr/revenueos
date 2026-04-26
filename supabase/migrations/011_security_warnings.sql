-- ============================================================
-- Migration 011: Security Warning Fixes
-- Fixes:
--   1. Function search_path mutable → SET search_path = pg_catalog, public
--   2. pg_graphql anon role exposes all tables/views →
--      REVOKE SELECT from anon on every public table and view
-- ============================================================

-- ─── 1. Fix update_updated_at_column search_path ─────────────────────────────
-- Re-create the function with a pinned search_path so it is not
-- vulnerable to search_path hijacking attacks.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── 2. Revoke anon SELECT from all public tables and views ──────────────────
-- RevenueOS uses a Node.js backend with service_role key — the anon
-- role never needs direct table access. Revoking these grants removes
-- every table and view from the pg_graphql /graphql/v1 introspection
-- endpoint for unauthenticated callers.

DO $$
DECLARE
  obj TEXT;
  objects TEXT[] := ARRAY[
    -- Tables
    'account_scores_monthly', 'activities', 'audit_logs',
    'benchmark_aggregates', 'benchmark_optins', 'companies',
    'company_tags', 'contacts', 'contracts', 'data_health_snapshots',
    'deals', 'financial_inputs_monthly', 'funnel_entries', 'funnel_stages',
    'fx_rates', 'hubspot_sync_logs', 'import_file_references', 'import_files',
    'integrations', 'invoice_lines', 'invoices', 'manual_journal_entries',
    'metric_snapshots', 'notes', 'notifications', 'payment_methods', 'payments',
    'playbook_triggers', 'playbooks', 'product_plans', 'products',
    'proposal_items', 'proposals', 'reconciliation_issues', 'revenue_events',
    'revenue_ledger', 'roles', 'scheduled_reports', 'segments', 'settings',
    'slack_connections', 'subscriptions', 'sync_logs', 'tasks', 'usage_events',
    -- Views
    'monthly_events_summary', 'monthly_mrr'
  ];
BEGIN
  FOREACH obj IN ARRAY objects LOOP
    -- REVOKE from anon
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public.%I FROM anon',
      obj
    );
    -- REVOKE from authenticated (belt-and-suspenders: backend uses service_role)
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public.%I FROM authenticated',
      obj
    );
    RAISE NOTICE 'Revoked privileges on %', obj;
  END LOOP;
END $$;

-- Also revoke future-granted defaults so newly created tables don't
-- automatically inherit public privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
