-- ============================================================
-- RevenueOS — Migration 003: Seed Data
-- Default tenant + sample data for development/testing
-- ============================================================

-- Default tenant settings
INSERT INTO settings (tenant_id, reporting_currency, recognition_method)
VALUES ('00000000-0000-0000-0000-000000000001', 'USD', 'accrual')
ON CONFLICT (tenant_id) DO NOTHING;

-- Sample products
INSERT INTO products (tenant_id, name, sku, billing_period) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Starter', 'REV-START-M', 'monthly'),
  ('00000000-0000-0000-0000-000000000001', 'Growth', 'REV-GROW-M', 'monthly'),
  ('00000000-0000-0000-0000-000000000001', 'Enterprise', 'REV-ENT-M', 'monthly'),
  ('00000000-0000-0000-0000-000000000001', 'Enterprise Annual', 'REV-ENT-A', 'annual')
ON CONFLICT DO NOTHING;

-- Sample FX rates (USD base) for testing
INSERT INTO fx_rates (date, from_currency, to_currency, rate, source) VALUES
  -- USD → USD (identity)
  ('2024-01-01', 'USD', 'USD', 1.0, 'seed'),
  ('2024-02-01', 'USD', 'USD', 1.0, 'seed'),
  ('2024-03-01', 'USD', 'USD', 1.0, 'seed'),
  ('2024-04-01', 'USD', 'USD', 1.0, 'seed'),
  ('2024-05-01', 'USD', 'USD', 1.0, 'seed'),
  ('2024-06-01', 'USD', 'USD', 1.0, 'seed'),
  -- EUR → USD
  ('2024-01-01', 'EUR', 'USD', 1.0923, 'seed'),
  ('2024-02-01', 'EUR', 'USD', 1.0871, 'seed'),
  ('2024-03-01', 'EUR', 'USD', 1.0834, 'seed'),
  -- TRY → USD
  ('2024-01-01', 'TRY', 'USD', 0.0333, 'seed'),
  ('2024-02-01', 'TRY', 'USD', 0.0323, 'seed'),
  ('2024-03-01', 'TRY', 'USD', 0.0311, 'seed'),
  ('2024-04-01', 'TRY', 'USD', 0.0306, 'seed'),
  ('2024-05-01', 'TRY', 'USD', 0.0300, 'seed'),
  ('2024-06-01', 'TRY', 'USD', 0.0295, 'seed'),
  -- GBP → USD
  ('2024-01-01', 'GBP', 'USD', 1.2732, 'seed'),
  ('2024-02-01', 'GBP', 'USD', 1.2676, 'seed'),
  ('2024-03-01', 'GBP', 'USD', 1.2713, 'seed')
ON CONFLICT (date, from_currency, to_currency) DO NOTHING;

-- Sample companies for demo
INSERT INTO companies (tenant_id, name, domain, segment) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Acme Corp', 'acme.com', 'MID'),
  ('00000000-0000-0000-0000-000000000001', 'TechStart Inc', 'techstart.io', 'SMB'),
  ('00000000-0000-0000-0000-000000000001', 'Enterprise Solutions', 'entsol.com', 'ENT'),
  ('00000000-0000-0000-0000-000000000001', 'Growth Ventures', 'growthvc.com', 'SMB'),
  ('00000000-0000-0000-0000-000000000001', 'Global Systems', 'globalsys.net', 'ENT')
ON CONFLICT DO NOTHING;
