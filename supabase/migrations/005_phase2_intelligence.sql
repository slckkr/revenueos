-- =============================================================================
-- Phase 2: Core Intelligence — Metrik Güçlendirme & Audit Trail
-- =============================================================================

-- ─── metric_snapshots ─────────────────────────────────────────────────────────
-- Monthly pre-computed metric cache for fast reads and historical trending.
CREATE TABLE IF NOT EXISTS metric_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  month         VARCHAR(10) NOT NULL,        -- 'YYYY-MM-01'
  metric_key    VARCHAR(50) NOT NULL,         -- 'mrr', 'nrr', 'arpa', 'expansion_rate', etc.
  metric_value  DECIMAL(18,4),
  segment_id    UUID REFERENCES segments(id) ON DELETE SET NULL,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  company_id    UUID REFERENCES companies(id) ON DELETE SET NULL,
  computed_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metric_snapshots_lookup
  ON metric_snapshots(tenant_id, metric_key, month);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_segment
  ON metric_snapshots(tenant_id, metric_key, month, segment_id)
  WHERE segment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_product
  ON metric_snapshots(tenant_id, metric_key, month, product_id)
  WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_snapshots_unique
  ON metric_snapshots(tenant_id, metric_key, month, COALESCE(segment_id::text,''), COALESCE(product_id::text,''), COALESCE(company_id::text,''));

-- ─── import_files ─────────────────────────────────────────────────────────────
-- Extend existing import_files table (created in 002) with Phase 2 audit fields.
ALTER TABLE import_files
  ADD COLUMN IF NOT EXISTS checksum    VARCHAR(64),
  ADD COLUMN IF NOT EXISTS storage_url VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS record_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_count  INTEGER DEFAULT 0;

-- index uses created_at which already exists in the table
CREATE INDEX IF NOT EXISTS idx_import_files_tenant_created
  ON import_files(tenant_id, created_at DESC);

-- ─── import_file_references ───────────────────────────────────────────────────
-- Links imported records back to the originating file, sheet, and row.
CREATE TABLE IF NOT EXISTS import_file_references (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id     UUID NOT NULL REFERENCES import_files(id) ON DELETE CASCADE,
  object_type VARCHAR(50) NOT NULL,   -- 'invoice', 'company', 'ledger_entry', etc.
  object_id   UUID NOT NULL,
  sheet_name  VARCHAR(100),
  row_number  INTEGER,
  xml_path    VARCHAR(500),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_refs_object
  ON import_file_references(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_import_refs_file
  ON import_file_references(file_id);

-- ─── manual_journal_entries ───────────────────────────────────────────────────
-- Allows finance team to add manual MRR adjustments with justification.
CREATE TABLE IF NOT EXISTS manual_journal_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  month             VARCHAR(10) NOT NULL,
  company_id        UUID REFERENCES companies(id) ON DELETE SET NULL,
  product_id        UUID REFERENCES products(id) ON DELETE SET NULL,
  amount_reporting  DECIMAL(18,4) NOT NULL,
  currency          VARCHAR(10) DEFAULT 'USD',
  reason            TEXT NOT NULL,
  created_by        VARCHAR(100) DEFAULT 'admin',
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant
  ON manual_journal_entries(tenant_id, month);

-- ─── audit_logs ───────────────────────────────────────────────────────────────
-- Immutable log of all create/update/delete actions on key objects.
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  actor_id    VARCHAR(100) DEFAULT 'admin',   -- user id or 'system'
  action      VARCHAR(20) NOT NULL,            -- 'CREATE', 'UPDATE', 'DELETE'
  object_type VARCHAR(50) NOT NULL,            -- 'company', 'invoice', 'ledger_entry', etc.
  object_id   UUID NOT NULL,
  before_json JSONB,
  after_json  JSONB,
  ip_address  VARCHAR(45),
  user_agent  VARCHAR(500),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_object
  ON audit_logs(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant
  ON audit_logs(tenant_id, created_at DESC);

-- ─── reconciliation_issues ────────────────────────────────────────────────────
-- Detected data quality and reconciliation problems.
CREATE TABLE IF NOT EXISTS reconciliation_issues (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  issue_type          VARCHAR(50) NOT NULL,  -- 'unmatched_company', 'unmapped_sku', 'missing_service_period', 'duplicate_invoice', 'fx_gap'
  severity            VARCHAR(20) NOT NULL,  -- 'critical', 'warning', 'info'
  object_type         VARCHAR(50),           -- 'invoice', 'company', 'ledger_entry', etc.
  object_id           UUID,
  object_display      VARCHAR(500),          -- human-readable description of the object
  description         TEXT,
  suggested_fix_json  JSONB,
  detected_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status              VARCHAR(20) DEFAULT 'open',  -- 'open', 'resolved', 'ignored'
  resolved_at         TIMESTAMP WITH TIME ZONE,
  resolved_by         VARCHAR(100),
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recon_issues_tenant
  ON reconciliation_issues(tenant_id, status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_recon_issues_object
  ON reconciliation_issues(object_type, object_id)
  WHERE object_id IS NOT NULL;
