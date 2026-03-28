# RevenueOS — Ultimate PRD (MVP + Phase 2 Detailed Spec)

**Versiyon:** v1.1  **Tarih:** 2026-03-15  **Stack:** Antigravit (Frontend) + Cloud Code (Backend/API/Jobs)

Bu doküman v1.0 PRD’nin üzerine Phase 2 için detaylı teknik ve ürün spesifikasyonlarını ekler:
- Audit Trail (drill-down + reconciliation)
- Data Health Score (veri kalitesi operasyonu)
- Executive/Investor Pack (Rule of 40 + efficiency)
- Expansion Opportunity Scoring (aksiyon motoru)
- Benchmark Library (opt-in, anonymized)
- Collaborative GTM (notes/tasks + Slack placeholder)

## 0) Phase 2 hedefi (ürünü “dashboard”tan “operating system”e taşımak)

Phase 2’de odak:
1) Finans ve RevOps güveni (auditability + veri kalitesi)
2) CEO/Board için tek ekran (yatırımcı metrikleri)
3) CRO için aksiyon (hangi hesaba gidilmeli?)
4) AI ile metrik → açıklama → aksiyon

## 1) MVP kapsamı (hatırlatma)

MVP:
- HubSpot entegrasyonu (Company / Contact ops / Deal ops)
- Excel/CSV/XML import
- Logo’dan dosya/export ile import (XML/Excel)
- Multi-currency: original stored + historical FX conversion
- Revenue recognition: Accrual default, Cash optional
- Revenue Ledger + Revenue Events (NEW/EXPANSION/CONTRACTION/CHURN/REACTIVATION/PRICE_INCREASE)
- Core metrikler: MRR/ARR, NRR/GRR, Net New MRR, Quick Ratio, churn
- Basit AI: rule-based flag + metrik açıklama

## 2) Phase 2 roadmap (öneri: 6–8 hafta, 4 epik)

### Epic A - Trust Layer (Audit + Reconciliation)
- A1) Audit Trail (metric → ledger → invoice line → raw source)
- A2) Reconciliation (CRM/Billing/Ledger tutarlılık kontrolleri)
- A3) Manual journal adjustments (denetimli düzeltme)

### Epic B - Data Quality & Ops (Data Health)
- B1) Data Health Score + issue list
- B2) Import templates + schema registry
- B3) Remediation flows (mapping/eksik period/duplicate çözümü)

### Epic C - Executive & Investor Pack
- C1) Rule of 40 dashboard
- C2) Efficiency pack (Burn multiple, Magic number, Revenue/Employee) (opsiyonel)
- C3) Board-ready snapshots/export

### Epic D - Revenue Actions
- D1) Expansion Opportunity Scoring
- D2) AI Playbooks (metric trigger → önerilen aksiyon)
- D3) Collaborative GTM (notes/tasks + Slack placeholder)
- D4) Benchmark Library (opt-in, anonymized)

## 3) Phase 2 detaylı özellik spesifikasyonları

### 3.1) Audit Trail (CFO Trust)

#### Problem
“Bu MRR nasıl hesaplandı?” sorusuna hızlı ve kanıtlı cevap veremeyen sistemlere Finance güvenmez.

#### Hedef
Her metrik için uçtan uca izlenebilirlik:
Metric → Ledger entries → Source (invoice/subscription/manual) → Raw import (Logo/Excel dosyası, satır referansı)

#### User stories
- Finance: Şubat MRR artışını ürün/müşteri bazında kaynak faturaya kadar görmek
- RevOps: Mükerrer import (duplicate) veya yanlış mapping yüzünden oluşan hatayı bulmak
- CEO: NRR düşüşünün hangi segment ve ürün kombinasyonundan geldiğini görmek

#### Functional requirements
1) Metric drill-down
- Her dashboard kartında “Explain / View calculation”
- Filtreler: month, segment, product, company
- Çıktı: ilgili ledger entry listesi + toplamla eşleşen sum

2) Ledger entry → source
- Ledger entry üzerinde “View source”
- Source türleri: invoice_line, subscription_item, manual_journal

3) Source → raw import reference
- Excel/Logo importlarında:
  - raw file saklanır (object storage)
  - row reference saklanır (sheet_name + row_number) veya XML path

4) FX ve accrual açıklaması
- Her kaynak satırı için:
  - original amount + currency
  - fx_rate_date + fx_rate_used
  - reporting amount
  - accrual dağılımı (aylara bölünmüş recognized amounts)

5) Manual journal adjustments (kontrollü)
- Finance rolü “manual journal entry” girebilir
- Journal entry her zaman audit log’a düşer
- Journal entries ledger’a source_type=manual_journal olarak eklenir

#### Data model additions
- import_files(id, tenant_id, source, filename, checksum, storage_url, uploaded_at, created_by)
- import_file_references(id, file_id, object_type, object_id, sheet_name, row_number, xml_path)
- manual_journal_entries(id, tenant_id, month, company_id, product_id, amount_reporting, reason, created_by, created_at)
- audit_logs(id, tenant_id, actor_id, action, object_type, object_id, before_json, after_json, created_at)

#### Cloud Code endpoints
- GET /metrics/{metric}/drilldown?month=&segment=&product_id=&company_id=
- GET /ledger/entries?month=&company_id=&product_id=
- GET /ledger/entries/{id}/source
- POST /journal_entries
- GET /imports/files/{id}

#### Antigravit UI
- Metric card → Drawer
  - Summary
  - Drivers table
  - Ledger entries table
  - Source preview
  - “Open raw reference” (download link / show row)

#### Acceptance criteria
- Dashboard MRR = ledger sum (100% match)
- Her ledger entry’nin source link’i var
- Import satır referansı gösterilebiliyor

### 3.2) Reconciliation (CRM ↔ Billing ↔ Ledger)

#### Problem
CRM’de müşteri var ama billing’de yok; billing’de var ama CRM’de yok; mapping hataları büyümeyi yanlış gösterir.

#### Hedef
Tutarsızlıkları otomatik bul, listele, düzeltme akışı sağla.

#### Checks (v1)
- Unmatched company: billing company bulunamadı (domain/external_id yok)
- Unmapped SKU: invoice_line SKU product’a bağlanamıyor
- Missing service period: accrual için period yok
- Duplicate invoices: aynı invoice_number + issue_date + company ile iki kayıt
- FX gaps: ilgili tarihte FX rate yok

#### Data model
- reconciliation_issues(id, tenant_id, issue_type, severity, object_type, object_id, detected_at, status, suggested_fix_json)

#### UI
- “Ops Center” ekranı
- Issue list + severity + estimated impact (MRR at risk)
- Fix flows: company mapping wizard, SKU mapping wizard, service period quick fix, duplicate resolution

### 3.3) Data Health Score

#### Problem
Kullanıcı metrikleri yanlış yorumlar çünkü veri eksik/kirli; ürün bunu görünür kılmalı.

#### Hedef
0–100 arası bir skor + boyut bazlı kırılım + aksiyon listesi.

#### Boyutlar
- Completeness
- Consistency
- Freshness
- Uniqueness
- Mapping coverage

#### Scoring (başlangıç)
- Mapping coverage: 30
- Completeness: 25
- Consistency: 25
- Freshness: 10
- Uniqueness: 10

#### Data model
- data_health_snapshots(tenant_id, snapshot_date, score, breakdown_json)

#### Jobs
- nightly data_quality_scan_job
- hourly freshness_monitor_job

#### UI
- Data Health dashboard
- Her metric kartında “confidence” etiketi

### 3.4) Executive/Investor Pack: Rule of 40 + Efficiency

#### Problem
CEO/Board yatırımcı diliyle “growth + profitability + efficiency” ister.

#### Hedef
Board-ready tek ekran: Rule of 40, growth bridge, efficiency.

#### Data model
- financial_inputs_monthly(tenant_id, month, cogs, opex, headcount, profit_margin_override, notes)

### 3.5) Expansion Opportunity Scoring

#### Problem
Satış ekibi “hangi hesaba gitmeliyim?” ister.

#### Hedef
Account ve account×product seviyesinde Expansion Score üret; top fırsatları listele; nedenlerini ve aksiyonlarını ver.

#### Data model
- account_scores_monthly(tenant_id, month, company_id, score_type, score_value, reasons_json)
- playbooks(id, tenant_id, trigger_type, trigger_key, recommended_actions_json, created_at)

#### Jobs
- expansion_scoring_job (weekly)

### 3.6) Benchmark Library (opt-in, anonymized)

#### Hedef
Peer benchmark (p25/p50/p75) göster. k-anonymity: n < 10 ise gösterme.

#### Data model
- benchmark_optins(tenant_id, enabled, enabled_at)
- benchmark_aggregates(cohort_key, metric_key, p25, p50, p75, n, computed_at)

### 3.7) Collaborative GTM (Notes/Tasks + Slack placeholder)

#### Hedef
Metric/account üzerinde note ve task; istenirse Slack’e gönder.

#### Data model
- notes(id, tenant_id, object_type, object_id, body, created_by, created_at)
- tasks(id, tenant_id, object_type, object_id, title, due_date, owner_id, status)
- slack_connections(id, tenant_id, webhook_url, channel_default)

## 4) Logo entegrasyonu (Phase 2: Direct)

MVP: export import.
Phase 2: API ile incremental sync + idempotency.

## 5) AI Insight Engine (Phase 2)

Prensip: Rule-first, LLM-second. Her insight “sources” içerir ve confidence Data Health skorundan türetilir.

## 6) Phase 2 teslim planı

Sprint 1–2: Trust Layer
Sprint 3: Data Health
Sprint 4: Exec Pack
Sprint 5–6: Expansion + Collaboration
Sprint 7–8: Benchmarks
