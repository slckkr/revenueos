-- ============================================================
-- RevenueOS — Migration 013: Company Profile Enrichment
-- Adds financial, structural, location and contact fields
-- inspired by ISO-500 / Turkey Top Companies dataset
-- Additive-only: no existing columns removed
-- ============================================================

ALTER TABLE companies
  -- Financial metrics (TL unless noted)
  ADD COLUMN IF NOT EXISTS net_sales               numeric(20,2),
  ADD COLUMN IF NOT EXISTS production_sales_net    numeric(20,2),
  ADD COLUMN IF NOT EXISTS gross_value_added       numeric(20,2),
  ADD COLUMN IF NOT EXISTS equity                  numeric(20,2),
  ADD COLUMN IF NOT EXISTS total_assets            numeric(20,2),
  ADD COLUMN IF NOT EXISTS pre_tax_profit          numeric(20,2),
  ADD COLUMN IF NOT EXISTS ebitda                  numeric(20,2),
  ADD COLUMN IF NOT EXISTS exports_usd             numeric(20,2),   -- thousands of USD

  -- Capital structure (percentages 0-100)
  ADD COLUMN IF NOT EXISTS capital_share_public    numeric(6,2),
  ADD COLUMN IF NOT EXISTS capital_share_private   numeric(6,2),
  ADD COLUMN IF NOT EXISTS capital_share_foreign   numeric(6,2),
  ADD COLUMN IF NOT EXISTS capital_share_float     numeric(6,2),

  -- Industry classification
  ADD COLUMN IF NOT EXISTS nace_description        varchar(300),
  ADD COLUMN IF NOT EXISTS nace_code               varchar(10),
  ADD COLUMN IF NOT EXISTS isic_description        varchar(300),
  ADD COLUMN IF NOT EXISTS isic_code               varchar(10),
  ADD COLUMN IF NOT EXISTS chamber_of_commerce     varchar(200),

  -- Location (city already exists; district + address added)
  ADD COLUMN IF NOT EXISTS district                varchar(100),
  ADD COLUMN IF NOT EXISTS address                 text,
  ADD COLUMN IF NOT EXISTS postal_code             varchar(20),

  -- Contact
  ADD COLUMN IF NOT EXISTS phone1                  varchar(50),
  ADD COLUMN IF NOT EXISTS phone2                  varchar(50),
  ADD COLUMN IF NOT EXISTS email                   varchar(255),

  -- Rankings / dataset metadata
  ADD COLUMN IF NOT EXISTS iso500_rank             integer,
  ADD COLUMN IF NOT EXISTS iso500_rank_prev_year   integer,
  ADD COLUMN IF NOT EXISTS data_year               integer;

CREATE INDEX IF NOT EXISTS idx_companies_iso500_rank ON companies(tenant_id, iso500_rank);
CREATE INDEX IF NOT EXISTS idx_companies_nace_code   ON companies(tenant_id, nace_code);
