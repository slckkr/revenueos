-- ============================================================
-- Migration 012: AI Mapping Templates
-- Stores saved column mapping configurations per tenant
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mapping_templates (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID        NOT NULL,
  name         TEXT        NOT NULL,
  source_system TEXT,
  column_map   JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mapping_templates_tenant_id_idx
  ON public.mapping_templates (tenant_id);

ALTER TABLE public.mapping_templates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_mapping_templates_updated_at
  BEFORE UPDATE ON public.mapping_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Revoke from anon/authenticated (backend uses service_role)
REVOKE ALL PRIVILEGES ON public.mapping_templates FROM anon;
REVOKE ALL PRIVILEGES ON public.mapping_templates FROM authenticated;
