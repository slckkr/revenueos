# RevenueOS — Master Blueprint
## Tek Kaynak Doküman (Single Source of Truth)

**Versiyon:** v2.0  
**Tarih:** 2026-03-16  
**Dil:** Türkçe / İngilizce (Teknik terimler İngilizce korunmuştur)  
**Amaç:** Tüm geliştirme fazları için referans doküman  

---

# İÇİNDEKİLER

1. [Executive Summary](#1-executive-summary)
2. [Current System Analysis](#2-current-system-analysis)
3. [Research Insights & Best Practices](#3-research-insights--best-practices)
4. [Enhanced PRD: Target System Design](#4-enhanced-prd-target-system-design)
   - 4.1 Enhanced Company Page
   - 4.2 Enhanced Product Page
   - 4.3 Complete Data Model
   - 4.4 Metric Calculation Library
   - 4.5 UI/UX Screens
5. [Gap Analysis: Current vs Target](#5-gap-analysis-current-vs-target)
6. [Phase-by-Phase Enhancement Roadmap](#6-phase-by-phase-enhancement-roadmap)
7. [API Integration Strategy](#7-api-integration-strategy)
8. [Technical Architecture](#8-technical-architecture)
9. [Rollout Strategy](#9-rollout-strategy)
10. [Appendices](#10-appendices)

---

# 1. EXECUTIVE SUMMARY

## 1.1 Vizyon

RevenueOS, B2B SaaS şirketleri için **dünya standartlarında bir Revenue Intelligence Platform** olarak konumlandırılmaktadır. Hedef, "Notion for Revenue" — yani Stripe + HubSpot + ChartMogul + Clari'nin tek bir platformda birleşimi olmaktır.

Platform şu temel özellikleriyle rakiplerinden ayrılacaktır:

- **Multi-product aware:** Her ürün için bağımsız SaaS metrikleri (Product NRR, Product LTV, Product CAC, Product Churn)
- **Segment-aware:** Enterprise/SMB/Mid-Market bazında kırılımlı analiz
- **Event-driven revenue model:** Kopyalanması zor, ledger-tabanlı gelir takibi
- **AI-driven GTM:** Expansion önerileri, churn tahmini, aksiyon playbook'ları
- **Scalable SaaS:** Önce tek kullanıcı (1000+ ürün, 10.000+ müşteri), sonra multi-tenant SaaS modeline geçiş

## 1.2 Mevcut Durum Özeti

RevenueOS MVP aşamasında çalışan bir sisteme sahiptir. Temel güçlü yönleri:

| Alan | Mevcut Durum |
|------|-------------|
| **Veri Modeli** | 24 entity, multi-tenant, ledger-centric mimari |
| **Revenue Ledger** | Event-driven (NEW/EXPANSION/CONTRACTION/CHURN/REACTIVATION/PRICE_INCREASE) |
| **Metrikler** | MRR, ARR, NRR, GRR, Quick Ratio, Net New MRR, Churn Rate |
| **Import** | Excel/CSV/XML template, Logo ERP export |
| **Entegrasyonlar** | HubSpot CRM (Company/Contact/Deal) |
| **Multi-Currency** | Orijinal tutar + historical FX conversion |
| **Revenue Recognition** | Accrual (varsayılan) + Cash |
| **UI** | Dashboard, Revenue Ledger, Import Center, Companies, Products, Settings |

## 1.3 Hedef Durum Özeti

| Alan | Hedef Durum |
|------|------------|
| **Company Page** | 360° müşteri görünümü: finansal, CRM, ürün, analitik, timeline |
| **Product Page** | Ürün bazlı P&L: Product NRR/LTV/CAC/Churn, cross-sell matrix |
| **Metrikler** | 25+ metrik: CAC, LTV, LTV/CAC, CAC Payback, Burn Multiple, Rule of 40, Expansion Rate, Revenue/Employee, Pipeline Coverage, GTM Efficiency Score |
| **Segment Engine** | Enterprise/SMB/Region/Industry bazında tüm metriklerin kırılımı |
| **Entegrasyonlar** | HubSpot + Logo + Trendyol + WooCommerce (+ placeholder: Stripe, Salesforce, vb.) |
| **AI** | Churn prediction, expansion scoring, AI playbooks |
| **Roller** | Admin (aktif) + Sales Rep, CSM, Finance, CEO (placeholder) |
| **Dashboard** | CEO Dashboard: 15 metrik haftalık takip |
| **Ölçek** | 10.000+ müşteri, 1.000+ ürün, sorunsuz performans |

## 1.4 Stratejik Yaklaşım

**Enhancement-driven, not rebuild.** Mevcut sistem güçlü temellere sahiptir. Strateji:

1. **Mevcut çalışan özellikleri koruma** — Ledger-centric mimari, revenue event classification, multi-currency, accrual recognition
2. **Katmanlı geliştirme** — Her faz önceki fazın üzerine inşa edilir
3. **Backward compatibility** — Hiçbir faz mevcut işlevselliği bozmaz
4. **Data-first yaklaşım** — Önce veri modeli, sonra hesaplama, sonra UI
5. **Placeholder pattern** — Gelecek entegrasyonlar için altyapı hazır, implementasyon sonra

---

# 2. CURRENT SYSTEM ANALYSIS

## 2.1 Mevcut Mimari Güçlü Yönleri

Mevcut sistem, aşağıdaki alanlarda sağlam bir temel sunmaktadır. Bu özellikler **kesinlikle korunmalıdır:**

### 2.1.1 Ledger-Centric Mimari (Korunacak ✅)
Revenue Ledger, tüm gelir hareketlerinin tek kaynağıdır. Her metrik bu ledger'dan türetilir. Bu yaklaşım veri tutarlılığını garanti eder ve CFO güvenini sağlar.

### 2.1.2 Revenue Event Taxonomy (Korunacak ✅)
Altı event tipi (NEW, EXPANSION, CONTRACTION, CHURN, REACTIVATION, PRICE_INCREASE) SaaS yaşam döngüsünün tamamını kapsar ve endüstri standardıyla uyumludur.

### 2.1.3 Multi-Currency with Historical FX (Korunacak ✅)
Orijinal tutarlar korunarak, kullanılan FX rate ile birlikte saklanması best practice'dir. Restatement, audit ve multi-currency raporlama sağlar.

### 2.1.4 Dual Recognition (Korunacak ✅)
Accrual ve Cash revenue recognition desteklenmesi finans ekipleri için kritiktir.

### 2.1.5 Full Audit Trail Design (Korunacak ✅)
Metric → Ledger → Source → Raw File zinciri, CFO'nun #1 itirazını karşılar.

### 2.1.6 Multi-Tenant by Design (Korunacak ✅)
Her entity `tenant_id` ile izole edilmiştir. SaaS'a dönüşüm için altyapı hazırdır.

## 2.2 Mevcut Database Schema

### Core Entities (MVP — 10 Entity)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   tenants    │    │    users     │    │  fx_rates    │
│─────────────│    │─────────────│    │─────────────│
│ id (PK)      │    │ id (PK)      │    │ date (PK)    │
│ name         │    │ tenant_id    │    │ from_curr(PK)│
│ settings     │    │ email        │    │ to_curr (PK) │
│ created_at   │    │ role         │    │ rate         │
└─────────────┘    └─────────────┘    └─────────────┘

┌─────────────┐    ┌─────────────┐    ┌─────────────────┐
│  companies   │    │   products   │    │    invoices      │
│─────────────│    │─────────────│    │─────────────────│
│ id (PK)      │    │ id (PK)      │    │ id (PK)          │
│ tenant_id    │    │ tenant_id    │    │ tenant_id        │
│ name         │    │ name         │    │ company_id (FK)  │
│ domain       │    │ sku          │    │ invoice_number   │
│ external_id  │    │ created_at   │    │ issue_date       │
│ segment      │    └─────────────┘    │ amount           │
│ notes        │                        │ currency         │
│ created_at   │                        │ service_start    │
│ updated_at   │                        │ service_end      │
└─────────────┘                        │ product          │
                                        └─────────────────┘

┌──────────────────┐    ┌─────────────────────┐
│  invoice_lines   │    │   subscriptions      │
│──────────────────│    │─────────────────────│
│ id (PK)          │    │ id (PK)              │
│ invoice_id (FK)  │    │ tenant_id            │
│ product_id (FK)  │    │ company_id (FK)      │
│ amount           │    │ product_id (FK)      │
│ currency         │    │ status               │
│ service_start    │    │ start_date           │
│ service_end      │    │ end_date             │
└──────────────────┘    │ mrr_amount           │
                         │ currency             │
┌──────────────────────┐ └─────────────────────┘
│  subscription_items  │
│──────────────────────│
│ id (PK)              │
│ subscription_id (FK) │
│ product_id (FK)      │
│ quantity             │
│ unit_price           │
└──────────────────────┘

┌────────────────────────────────────────┐
│          ledger_entries                 │
│────────────────────────────────────────│
│ id (PK)                                │
│ tenant_id                              │
│ month                                  │
│ company_id (FK)                        │
│ product_id (FK, nullable)              │
│ event_type (ENUM)                      │
│ amount_original                        │
│ currency_original                      │
│ fx_rate_used                           │
│ fx_rate_date                           │
│ amount_reporting                       │
│ source_type (ENUM)                     │
│ source_id                              │
│ recognition_method (ENUM)              │
│ created_at                             │
└────────────────────────────────────────┘
```

### Phase 2 Entities (14 Entity)

| Entity | Kategori | Amaç |
|--------|----------|------|
| `import_files` | Trust Layer | Import dosya takibi |
| `import_file_references` | Trust Layer | Dosya-satır referansı |
| `manual_journal_entries` | Trust Layer | Manuel düzeltmeler |
| `audit_logs` | Trust Layer | Değişiklik kaydı |
| `reconciliation_issues` | Data Quality | Tutarsızlık tespiti |
| `data_health_snapshots` | Data Quality | Veri kalite skoru |
| `financial_inputs_monthly` | Executive Pack | COGS, OPEX, headcount |
| `account_scores_monthly` | Revenue Actions | Expansion skorları |
| `playbooks` | Revenue Actions | AI aksiyon önerileri |
| `benchmark_optins` | Benchmark | Peer karşılaştırma opt-in |
| `benchmark_aggregates` | Benchmark | Anonim benchmark verisi |
| `notes` | Collaboration | Notlar |
| `tasks` | Collaboration | Görevler |
| `slack_connections` | Collaboration | Slack webhook |

**Toplam Mevcut Entity: 24**

## 2.3 Mevcut Özellikler & İş Akışları

### Çalışan İş Akışları

**1. Import Workflow:**
```
Kullanıcı Excel/CSV/XML yükler
  → Şema validasyonu (Companies + Invoices sheet)
  → Company matching (ad/domain)
  → Product/SKU mapping
  → Invoice line parsing
  → Revenue recognition (accrual spreading)
  → Event classification (NEW/EXPANSION/CONTRACTION...)
  → Ledger entry oluşturma
  → Dashboard metrikleri güncelleme
```

**2. HubSpot Sync Workflow:**
```
HubSpot webhook veya scheduled pull
  → Company sync (external_id/domain matching)
  → Contact sync
  → Deal sync → subscription/revenue event mapping
  → Ledger güncelleme
  → Metrik refresh
```

**3. Metric Calculation Flow:**
```
Ledger entries (month × company × product × event)
  → MRR: sum(amount_reporting) where month = target
  → ARR: MRR × 12
  → Net New MRR: New + Expansion - Contraction - Churn
  → NRR: (MRR_end - New_MRR) / MRR_start × 100
  → GRR: (MRR_start - Contraction - Churn) / MRR_start × 100
  → Quick Ratio: (New + Expansion) / (Contraction + Churn)
```

### Mevcut UI Ekranları

| Ekran | Faz | Açıklama |
|-------|-----|----------|
| Dashboard (Home) | MVP | MRR, ARR, NRR, GRR, Quick Ratio, Churn kartları |
| Revenue Ledger | MVP | Filtrelenebilir ledger tablosu |
| Import Center | MVP | Excel/CSV/XML yükleme, geçmiş importlar |
| Companies List | MVP | Müşteri listesi (segment, domain, gelir özeti) |
| Company Detail | MVP | Tek müşteri görünümü (abonelik geçmişi, gelir timeline) |
| Products List | MVP | Ürün kataloğu, SKU mapping |
| Settings | MVP | HubSpot bağlantısı, para birimi, recognition method |

## 2.4 Mevcut Metrik Hesaplamaları

| Metrik | Formül | Veri Kaynağı |
|--------|--------|-------------|
| MRR | sum(amount_reporting) for month | ledger_entries |
| ARR | MRR × 12 | Derived |
| Net New MRR | New + Expansion − Contraction − Churn | ledger_entries by event_type |
| NRR | (MRR_end − New_MRR) / MRR_start × 100 | ledger_entries |
| GRR | (MRR_start − Contraction − Churn) / MRR_start × 100 | ledger_entries |
| Quick Ratio | (New + Expansion) / (Contraction + Churn) | ledger_entries |
| Churn Rate | Churned_MRR / MRR_start × 100 | ledger_entries |
| Logo Churn | Churned companies / Total active companies | Company status |

## 2.5 Mevcut Import Template Yapısı

**Companies Sheet:**
| Kolon | Tip | Zorunlu | Örnek |
|-------|-----|---------|-------|
| Company | String | Evet | Acme Corp |
| Domain | String | Hayır | acme.com |
| Segment | String | Hayır | enterprise |
| Notes | String | Hayır | Optional |

**Invoices Sheet:**
| Kolon | Tip | Zorunlu | Örnek |
|-------|-----|---------|-------|
| Company | String | Evet | Acme Corp |
| Invoice No | String | Evet | INV-2024-001 |
| Date | Date | Evet | 2024-01-15 |
| Amount | Decimal | Evet | 5000 |
| Currency | String | Evet | USD |
| Service Start | Date | Önerilen | 2024-01-01 |
| Service End | Date | Önerilen | 2024-01-31 |
| Product | String | Hayır | SaaS Plan Pro |

---

# 3. RESEARCH INSIGHTS & BEST PRACTICES

## 3.1 Yüksek NRR Stratejileri — Lider Şirket Analizleri

### Snowflake (NRR: 169%)
- **Model:** Consumption-based pricing (kullanıma dayalı)
- **Strateji:** Müşteri değeri ile fiyat doğru orantılı; kullanım arttıkça gelir otomatik büyür
- **Öğrenim:** Consumption-based modeller, geleneksel aboneliklere kıyasla **%28 daha yüksek NRR** sağlar
- **RevenueOS İçin:** Usage event tracking desteği eklenmeli

### Datadog (NRR: 146%)
- **Model:** Usage-based + multi-product
- **Strateji:** Müşteri altyapısı büyüdükçe monitoring ihtiyacı artar → doğal expansion
- **Öğrenim:** Proaktif customer success + usage monitoring ile churn önleme
- **RevenueOS İçin:** Product-level metrics ve cross-sell matrix kritik

### HubSpot (NRR: 70% → 110%+)
- **Evrim:** Sabit fiyat → usage-based → freemium → multi-product hubs
- **Strateji:** Land-and-expand; temel ürünle gir, hub'larla genişle
- **Öğrenim:** Pricing model evrimi NRR'yi %41 artırabilir
- **RevenueOS İçin:** Multi-product tracking ve expansion path analizi

## 3.2 SaaS Metrik Benchmarkları (2024-2025)

| Metrik | P25 | Median (P50) | P75 | Elite |
|--------|-----|-------------|-----|-------|
| **NRR** | 95% | 101% | 110% | 130%+ |
| **GRR** | 79% | 91% | 95% | 97%+ |
| **Quick Ratio** | 1.0 | 2.0 | 3.5 | 4.0+ |
| **LTV/CAC** | 1.5 | 3.0 | 5.0 | 8.0+ |
| **CAC Payback** | 18 ay | 12 ay | 8 ay | 6 ay |
| **Blended CAC Ratio** | $2.50 | $1.61 | $1.10 | $0.80 |
| **Expansion CAC Ratio** | $1.50 | $1.00 | $0.70 | $0.40 |
| **Burn Multiple** | 3.0x | 1.5x | 1.0x | 0.5x |
| **Rule of 40** | 15 | 30 | 45 | 60+ |
| **Revenue per Employee** | $100K | $200K | $350K | $500K+ |
| **Gross Margin** | 60% | 72% | 80% | 85%+ |

> **Kaynak:** Bessemer Venture Partners, SaaS Capital, Benchmarkit 2024 Benchmarks

## 3.3 Mimari Best Practices

### Event-Driven Revenue Model
- Her gelir hareketi atomik bir event olarak kaydedilmeli
- Events: NEW, EXPANSION, CONTRACTION, CHURN, REACTIVATION, PRICE_INCREASE
- Month-over-month karşılaştırma ile otomatik classification
- **RevenueOS zaten bu modeli uygulamaktadır ✅**

### Revenue Intelligence Katmanları (6 Katman)
```
Katman 6: AI & Prediction Layer    → Churn prediction, expansion scoring
Katman 5: Forecasting Module       → Pipeline, renewal, growth projection
Katman 4: Segment Engine           → Segment/cohort bazlı kırılımlar
Katman 3: Metrics Computation      → 25+ SaaS metrikleri
Katman 2: Revenue Ledger           → Event-based fact table
Katman 1: Data Layer               → Entity model, ingestion, integration
```

### Cohort Analysis Yaklaşımı
- **Acquisition cohorts:** Signup tarihine göre müşteri grupları
- **Behavioral cohorts:** Ürün kullanım davranışına göre gruplar
- **Revenue cohorts:** MRR aralıklarına göre müşteri grupları
- B2B SaaS'ta analiz **şirket seviyesinde** yapılmalı (user değil)

### GTM Model Ayrımı
Platform, farklı GTM modellerini desteklemelidir:

| Özellik | Sales-Led SaaS | PLG SaaS |
|---------|---------------|----------|
| CAC | Yüksek | Düşük |
| Sales Cycle | Uzun | Kısa |
| ACV | Yüksek | Düşük |
| Key Metric | Pipeline Coverage | Activation Rate |
| Growth Driver | Sales team | Product-led |

## 3.4 Rakip Analizi & Farklılaşma

| Özellik | ChartMogul | Baremetrics | Clari | **RevenueOS** |
|---------|-----------|-------------|-------|--------------|
| Multi-product metrics | ❌ | ❌ | ❌ | ✅ |
| Segment-aware analytics | Kısıtlı | Kısıtlı | ❌ | ✅ |
| Event-driven ledger | ❌ | ❌ | ❌ | ✅ |
| Revenue recognition (Accrual) | ❌ | ❌ | ❌ | ✅ |
| Multi-currency + FX audit | Kısıtlı | ❌ | ❌ | ✅ |
| Logo ERP / Trendyol | ❌ | ❌ | ❌ | ✅ |
| AI expansion playbooks | ❌ | ❌ | Kısıtlı | ✅ |
| Audit trail (metric→source) | ❌ | ❌ | ❌ | ✅ |

---

# 4. ENHANCED PRD: TARGET SYSTEM DESIGN

## 4.1 Enhanced Company Page — 360° Müşteri Görünümü

Company Page, bir müşterinin tüm gelir, ürün, CRM ve analitik bilgilerini tek ekranda sunan kapsamlı bir görünüm olacaktır.

### 4.1.1 Basic Info Section

| Alan | Kaynak | Açıklama |
|------|--------|----------|
| Company Name | companies.name | Şirket adı |
| Domain | companies.domain | Web domain (matching için) |
| Segment | companies.segment | enterprise / mid-market / smb |
| Employee Count | companies.employee_count (YENİ) | Çalışan sayısı |
| Location / Country | companies.country (YENİ) | Ülke / Şehir |
| Industry | companies.industry (YENİ) | Sektör |
| Account Owner | companies.owner_id (YENİ) | Hesap sahibi (user FK) |
| Customer Since | companies.created_at | İlk kayıt tarihi |
| External IDs | companies.external_id | HubSpot ID, Logo ID, vb. |
| Tags | company_tags (YENİ tablo) | Özel etiketler |
| Status | companies.status (YENİ) | active / churned / at-risk / prospect |

### 4.1.2 Products Used Section

| Alan | Kaynak | Açıklama |
|------|--------|----------|
| Product List | subscriptions → products | Aktif abonelikler |
| Pricing Plan | subscription_items.plan_name (YENİ) | Plan adı (Basic/Pro/Enterprise) |
| Subscription Status | subscriptions.status | active / cancelled / paused / trial |
| Start Date | subscriptions.start_date | Başlangıç tarihi |
| Seat Count | subscription_items.quantity | Kullanılan seat sayısı |
| MRR per Product | Hesaplanan | Ürün bazlı MRR |
| Last Renewal | subscriptions.last_renewal_date (YENİ) | Son yenileme |
| Next Renewal | subscriptions.next_renewal_date (YENİ) | Sıradaki yenileme |

### 4.1.3 Financial Section

**Invoices Tab:**
| Alan | Kaynak |
|------|--------|
| Invoice Number | invoices.invoice_number |
| Issue Date | invoices.issue_date |
| Amount | invoices.amount + invoices.currency |
| Status | invoices.status (YENİ: paid/pending/overdue) |
| Service Period | invoices.service_start → service_end |
| Product | invoice_lines → products |

**Invoice Line Items Tab:**
| Alan | Kaynak |
|------|--------|
| Product | invoice_lines.product_id → products.name |
| Amount | invoice_lines.amount |
| Service Period | invoice_lines.service_start → service_end |
| Recognition | invoice_lines → ledger_entries |

**Payment History Tab (YENİ):**
| Alan | Kaynak |
|------|--------|
| Payment Date | payments.payment_date |
| Amount | payments.amount |
| Method | payments.method (bank_transfer/credit_card/other) |
| Invoice Reference | payments.invoice_id |
| Status | payments.status (completed/pending/failed) |

**Payment Methods Tab (YENİ):**
| Alan | Kaynak |
|------|--------|
| Method Type | payment_methods.type |
| Last 4 Digits | payment_methods.last_four |
| Expiry | payment_methods.expiry |
| Default | payment_methods.is_default |

### 4.1.4 CRM Section

| Alan | Kaynak | Açıklama |
|------|--------|----------|
| Account Owner | users (via companies.owner_id) | Hesap yöneticisi |
| Contacts | contacts (company_id FK) | İlgili kişiler |
| Meetings | activities (type=meeting) | Toplantı geçmişi |
| Activities | activities (YENİ tablo) | Email, call, meeting log |
| Notes | notes (object_type=company) | Hesap notları |
| Tasks | tasks (object_type=company) | Açık görevler |

### 4.1.5 Deals & Proposals Section (YENİ)

| Alan | Kaynak | Açıklama |
|------|--------|----------|
| Deal Name | deals.name | Fırsat adı |
| Deal Stage | deals.stage | Pipeline stage |
| Deal Amount | deals.amount | Fırsat tutarı |
| Expected Close | deals.expected_close_date | Tahmini kapanış |
| Probability | deals.probability | Kapanma olasılığı |
| Proposal Status | proposals.status (YENİ) | draft/sent/accepted/rejected |
| Quote Amount | proposals.amount | Teklif tutarı |

### 4.1.6 Analytics Section

| Metrik | Hesaplama | Açıklama |
|--------|-----------|----------|
| **Total Revenue** | sum(ledger_entries.amount_reporting) for company | Toplam gelir (tüm zamanlar) |
| **Current MRR** | Aktif ay ledger toplamı | Aylık tekrarlayan gelir |
| **ARR Contribution** | MRR × 12 | Yıllık katkı |
| **LTV** | MRR × (1/churn_rate) × gross_margin | Müşteri yaşam boyu değeri |
| **Churn Risk Score** | account_scores_monthly (churn) | 0-100 risk skoru |
| **Expansion Score** | account_scores_monthly (expansion) | 0-100 expansion potansiyeli |
| **Health Score** | Composite (usage + payment + engagement) | Müşteri sağlık skoru |
| **Revenue Trend** | 12 aylık MRR grafiği | Trend çizgisi |
| **NRR (Account)** | Account-level NRR hesabı | Hesap bazlı NRR |

### 4.1.7 Timeline Section

| Event | Kaynak | Açıklama |
|-------|--------|----------|
| Revenue Events | ledger_entries | NEW, EXPANSION, CONTRACTION, CHURN, REACTIVATION |
| Expansion History | ledger_entries (event=EXPANSION) | Genişleme geçmişi |
| Contraction History | ledger_entries (event=CONTRACTION) | Küçülme geçmişi |
| Product Changes | subscription audit | Ürün ekleme/çıkarma |
| Plan Changes | subscription audit | Plan yükseltme/düşürme |
| Import Events | import_file_references | Veri import geçmişi |
| Notes & Activities | notes, activities | Notlar ve aktiviteler |

---

## 4.2 Enhanced Product Page — Ürün Bazlı P&L

### 4.2.1 Basic Info Section

| Alan | Kaynak | Açıklama |
|------|--------|----------|
| Product Name | products.name | Ürün adı |
| SKU | products.sku | Benzersiz ürün kodu |
| Description | products.description (YENİ) | Ürün açıklaması |
| Pricing Model | products.pricing_model (YENİ) | flat/tiered/usage/per-seat |
| Category | products.category (YENİ) | Ürün kategorisi |
| Status | products.status (YENİ) | active/deprecated/beta |
| Launch Date | products.launched_at (YENİ) | Lansman tarihi |

### 4.2.2 Pricing & Plans Section (YENİ)

| Alan | Kaynak | Açıklama |
|------|--------|----------|
| Plan Name | product_plans.name | Plan adı (Basic/Pro/Enterprise) |
| Monthly Price | product_plans.monthly_price | Aylık fiyat |
| Annual Price | product_plans.annual_price | Yıllık fiyat |
| Features | product_plans.features_json | Plan özellikleri |
| Active Subscribers | Hesaplanan | Bu plandaki aktif müşteri sayısı |

### 4.2.3 Usage Section

| Alan | Hesaplama | Açıklama |
|------|-----------|----------|
| Active Subscriptions | count(subscriptions where product_id = X and status = active) | Aktif abonelik sayısı |
| Total Seats | sum(subscription_items.quantity) | Toplam seat sayısı |
| Avg Seats per Company | avg(subscription_items.quantity) | Ortalama seat |
| Companies Using | count(distinct company_id) | Kullanan şirket sayısı |

### 4.2.4 Revenue Section

| Metrik | Hesaplama |
|--------|-----------|
| **Total Revenue** | sum(ledger_entries.amount_reporting) where product_id = X |
| **Current MRR** | sum(ledger_entries) for current month, product_id = X |
| **ARR** | Product MRR × 12 |
| **Avg Revenue per Company** | Product MRR / Active companies |
| **MRR Breakdown** | New + Expansion + Reactivation − Contraction − Churn per month |
| **Revenue Trend** | 12 aylık MRR trend grafiği |

### 4.2.5 Product-Level SaaS Metrics (YENİ — Farklılaştırıcı)

| Metrik | Formül | Açıklama |
|--------|--------|----------|
| **Product NRR** | (Product_MRR_end − Product_New_MRR) / Product_MRR_start × 100 | Ürün bazlı net retention |
| **Product GRR** | (Product_MRR_start − Product_Contraction − Product_Churn) / Product_MRR_start × 100 | Ürün bazlı gross retention |
| **Product LTV** | Product_MRR × (1/Product_Churn_Rate) × Product_Gross_Margin | Ürün bazlı yaşam boyu değer |
| **Product CAC** | Allocated S&M spend / New product customers | Ürün bazlı müşteri edinme maliyeti |
| **Product Churn Rate** | Churned_Product_MRR / Product_MRR_start × 100 | Ürün bazlı churn oranı |
| **Product Gross Margin** | (Product_Revenue − Product_COGS) / Product_Revenue × 100 | Ürün bazlı brüt kar marjı |
| **Cross-sell Rate** | Companies with Product X AND another product / Total companies with Product X | Çapraz satış oranı |
| **Product Quick Ratio** | (New + Expansion) / (Contraction + Churn) for product | Ürün bazlı Quick Ratio |

### 4.2.6 Segment Performance Section

| Kırılım | Metrikler |
|---------|----------|
| By Segment (Enterprise/SMB/Mid-Market) | MRR, NRR, Churn, LTV per segment |
| By Country | MRR, customer count per country |
| By Plan | MRR, customer count per plan |
| Focus Segments | En yüksek gelir getiren segmentler |

### 4.2.7 Sales & Proposals Section

| Alan | Hesaplama |
|------|-----------|
| Proposals Sent | count(proposals where product_id = X) |
| Proposal Status Breakdown | draft/sent/accepted/rejected counts |
| Conversion Rate | Accepted / Total proposals × 100 |
| Avg Deal Size | avg(accepted proposal amounts) |
| Sales Cycle Length | avg(days from proposal_sent to accepted) |

### 4.2.8 Cross-Sell Matrix (YENİ — Farklılaştırıcı)

```
                Product A   Product B   Product C   Product D
Product A         —          35%         22%         12%
Product B        40%          —          28%         18%
Product C        25%         30%          —          15%
Product D        15%         20%         18%          —
```

Bu matrix, ürün çiftleri arasındaki co-adoption oranını gösterir. Satır: Mevcut ürün, Sütun: Çapraz ürün yüzdesi.

---

## 4.3 Complete Data Model — Hedef Schema

### 4.3.1 Yeni Entity'ler (Mevcut 24'e Ek)

Mevcut 24 entity korunarak, aşağıdaki yeni entity'ler eklenecektir:

#### Core Entities — Yeni

**`contacts`** — Müşteri şirketlerdeki kişiler
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| company_id | UUID | FK → companies | |
| first_name | VARCHAR | NOT NULL | |
| last_name | VARCHAR | NOT NULL | |
| email | VARCHAR | | |
| phone | VARCHAR | | |
| title | VARCHAR | | İş unvanı |
| role_type | VARCHAR | | champion/decision-maker/user/billing |
| external_id | VARCHAR | | HubSpot Contact ID |
| is_primary | BOOLEAN | default false | Ana kontak |
| created_at | TIMESTAMP | | |
| updated_at | TIMESTAMP | | |

**`deals`** — Satış fırsatları / pipeline
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| company_id | UUID | FK → companies | |
| name | VARCHAR | NOT NULL | Fırsat adı |
| stage | VARCHAR | NOT NULL | Pipeline stage |
| amount | DECIMAL | | Fırsat tutarı |
| currency | VARCHAR(3) | | |
| probability | DECIMAL | | 0-100 kapanma olasılığı |
| expected_close_date | DATE | | |
| actual_close_date | DATE | | |
| deal_type | VARCHAR | | new_business / expansion / renewal |
| owner_id | UUID | FK → users | |
| product_id | UUID | FK → products, NULLABLE | |
| external_id | VARCHAR | | HubSpot Deal ID |
| status | VARCHAR | | open / won / lost |
| created_at | TIMESTAMP | | |
| updated_at | TIMESTAMP | | |

**`payments`** — Ödeme kayıtları
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| company_id | UUID | FK → companies | |
| invoice_id | UUID | FK → invoices, NULLABLE | |
| payment_date | DATE | NOT NULL | |
| amount | DECIMAL | NOT NULL | |
| currency | VARCHAR(3) | NOT NULL | |
| method | VARCHAR | | bank_transfer/credit_card/other |
| status | VARCHAR | | completed/pending/failed/refunded |
| external_id | VARCHAR | | Gateway payment ID |
| created_at | TIMESTAMP | | |

**`payment_methods`** — Ödeme yöntemleri
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| company_id | UUID | FK → companies | |
| type | VARCHAR | | credit_card/bank_account/other |
| last_four | VARCHAR(4) | | Son 4 hane |
| brand | VARCHAR | | visa/mastercard/amex |
| expiry_month | INTEGER | | |
| expiry_year | INTEGER | | |
| is_default | BOOLEAN | | |
| created_at | TIMESTAMP | | |

**`activities`** — CRM aktiviteleri
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| company_id | UUID | FK → companies | |
| contact_id | UUID | FK → contacts, NULLABLE | |
| type | VARCHAR | NOT NULL | email/call/meeting/demo/other |
| subject | VARCHAR | | |
| description | TEXT | | |
| activity_date | TIMESTAMP | NOT NULL | |
| owner_id | UUID | FK → users | |
| deal_id | UUID | FK → deals, NULLABLE | |
| external_id | VARCHAR | | HubSpot Activity ID |
| created_at | TIMESTAMP | | |

**`proposals`** — Teklifler / quotes
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| company_id | UUID | FK → companies | |
| deal_id | UUID | FK → deals, NULLABLE | |
| proposal_number | VARCHAR | | |
| amount | DECIMAL | | |
| currency | VARCHAR(3) | | |
| status | VARCHAR | | draft/sent/viewed/accepted/rejected/expired |
| sent_date | DATE | | |
| expiry_date | DATE | | |
| accepted_date | DATE | | |
| created_by | UUID | FK → users | |
| created_at | TIMESTAMP | | |

**`proposal_items`** — Teklif kalemleri
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| proposal_id | UUID | FK → proposals | |
| product_id | UUID | FK → products | |
| quantity | INTEGER | | |
| unit_price | DECIMAL | | |
| total_price | DECIMAL | | |
| description | VARCHAR | | |

**`product_plans`** — Ürün planları
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| product_id | UUID | FK → products | |
| name | VARCHAR | NOT NULL | Basic/Pro/Enterprise |
| monthly_price | DECIMAL | | |
| annual_price | DECIMAL | | |
| features_json | JSONB | | Plan özellikleri |
| is_active | BOOLEAN | default true | |
| sort_order | INTEGER | | Sıralama |
| created_at | TIMESTAMP | | |

**`contracts`** — Sözleşmeler
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| company_id | UUID | FK → companies | |
| contract_number | VARCHAR | | |
| start_date | DATE | NOT NULL | |
| end_date | DATE | NOT NULL | |
| total_value | DECIMAL | | Sözleşme toplam değeri |
| currency | VARCHAR(3) | | |
| auto_renewal | BOOLEAN | default false | |
| renewal_term_months | INTEGER | | |
| status | VARCHAR | | active/expired/cancelled/pending_renewal |
| signed_date | DATE | | |
| created_at | TIMESTAMP | | |

**`usage_events`** — Kullanım verileri
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| company_id | UUID | FK → companies | |
| product_id | UUID | FK → products | |
| event_name | VARCHAR | NOT NULL | login/feature_use/api_call |
| event_value | DECIMAL | | Kullanım miktarı |
| event_date | TIMESTAMP | NOT NULL | |
| metadata_json | JSONB | | Ek bilgiler |

**`funnel_stages`** — Satış hunisi aşamaları
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| name | VARCHAR | NOT NULL | lead/mql/sql/opportunity/won/lost |
| sort_order | INTEGER | | |
| conversion_target | DECIMAL | | Hedef dönüşüm oranı |

**`funnel_entries`** — Huni geçişleri
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| company_id | UUID | FK → companies, NULLABLE | |
| deal_id | UUID | FK → deals, NULLABLE | |
| product_id | UUID | FK → products, NULLABLE | |
| stage_id | UUID | FK → funnel_stages | |
| entered_at | TIMESTAMP | NOT NULL | |
| exited_at | TIMESTAMP | | |
| exit_reason | VARCHAR | | converted/lost/stalled |

**`company_tags`** — Şirket etiketleri
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| company_id | UUID | FK → companies | |
| tag | VARCHAR | NOT NULL | |

**`integrations`** — Entegrasyon bağlantıları
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| provider | VARCHAR | NOT NULL | hubspot/logo/trendyol/woocommerce |
| status | VARCHAR | | connected/disconnected/error |
| config_json | JSONB | | Bağlantı konfigürasyonu |
| last_sync_at | TIMESTAMP | | |
| created_at | TIMESTAMP | | |

**`sync_logs`** — Senkronizasyon kayıtları
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| integration_id | UUID | FK → integrations | |
| sync_type | VARCHAR | | full/incremental |
| status | VARCHAR | | running/completed/failed |
| records_synced | INTEGER | | |
| errors_json | JSONB | | |
| started_at | TIMESTAMP | | |
| completed_at | TIMESTAMP | | |

**`roles`** — Kullanıcı rolleri
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| name | VARCHAR | NOT NULL | admin/sales_rep/csm/finance/ceo |
| permissions_json | JSONB | | İzin tanımları |
| is_active | BOOLEAN | default true | |

**`segments`** — Segment tanımları
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| name | VARCHAR | NOT NULL | |
| criteria_json | JSONB | | Segment kuralları |
| created_at | TIMESTAMP | | |

**`metric_snapshots`** — Metrik anlık görüntüleri
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| month | VARCHAR | | 2024-01 formatı |
| metric_key | VARCHAR | NOT NULL | mrr/arr/nrr/grr/... |
| metric_value | DECIMAL | | |
| segment_id | UUID | FK → segments, NULLABLE | |
| product_id | UUID | FK → products, NULLABLE | |
| company_id | UUID | FK → companies, NULLABLE | |
| computed_at | TIMESTAMP | | |

**`notifications`** — Bildirimler (Placeholder)
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants | |
| user_id | UUID | FK → users | |
| type | VARCHAR | | alert/info/action_required |
| title | VARCHAR | | |
| body | TEXT | | |
| is_read | BOOLEAN | default false | |
| link | VARCHAR | | İlgili sayfa linki |
| created_at | TIMESTAMP | | |

### 4.3.2 Mevcut Entity Güncellemeleri

**`companies` — Yeni Alanlar:**
| Yeni Alan | Type | Açıklama |
|-----------|------|----------|
| employee_count | INTEGER | Çalışan sayısı |
| country | VARCHAR | Ülke |
| city | VARCHAR | Şehir |
| industry | VARCHAR | Sektör |
| owner_id | UUID, FK → users | Hesap sahibi |
| status | VARCHAR | active/churned/at-risk/prospect |
| annual_revenue | DECIMAL | Yıllık ciro (müşterinin kendi cirosu) |
| source | VARCHAR | hubspot/manual/import/trendyol/woocommerce |
| health_score | DECIMAL | Hesaplanan sağlık skoru (cache) |

**`products` — Yeni Alanlar:**
| Yeni Alan | Type | Açıklama |
|-----------|------|----------|
| description | TEXT | Ürün açıklaması |
| pricing_model | VARCHAR | flat/tiered/usage/per-seat |
| category | VARCHAR | Ürün kategorisi |
| status | VARCHAR | active/deprecated/beta |
| launched_at | DATE | Lansman tarihi |
| default_price | DECIMAL | Varsayılan fiyat |
| currency | VARCHAR(3) | Varsayılan para birimi |

**`invoices` — Yeni Alanlar:**
| Yeni Alan | Type | Açıklama |
|-----------|------|----------|
| status | VARCHAR | paid/pending/overdue/cancelled |
| due_date | DATE | Vade tarihi |
| paid_date | DATE | Ödeme tarihi |
| source | VARCHAR | import/hubspot/logo/trendyol/woocommerce |
| external_id | VARCHAR | Dış sistem fatura ID |

**`subscriptions` — Yeni Alanlar:**
| Yeni Alan | Type | Açıklama |
|-----------|------|----------|
| plan_id | UUID, FK → product_plans | Seçili plan |
| billing_cycle | VARCHAR | monthly/quarterly/annual |
| next_renewal_date | DATE | Sıradaki yenileme |
| last_renewal_date | DATE | Son yenileme |
| cancellation_date | DATE | İptal tarihi |
| cancellation_reason | TEXT | İptal nedeni |
| trial_end_date | DATE | Trial bitiş |

**`users` — Yeni Alanlar:**
| Yeni Alan | Type | Açıklama |
|-----------|------|----------|
| role_id | UUID, FK → roles | Rol |
| first_name | VARCHAR | Ad |
| last_name | VARCHAR | Soyad |
| avatar_url | VARCHAR | Profil resmi |
| is_active | BOOLEAN | Aktif/Pasif |
| last_login_at | TIMESTAMP | Son giriş |

### 4.3.3 Güncellenmiş Entity Relationship Diagram

```
tenants
  ├── users ←→ roles
  ├── companies
  │     ├── contacts
  │     ├── invoices → invoice_lines → products
  │     ├── payments → invoices (optional)
  │     ├── payment_methods
  │     ├── subscriptions → subscription_items → products
  │     │     └── → product_plans
  │     ├── contracts
  │     ├── deals → proposals → proposal_items → products
  │     ├── activities → contacts (optional)
  │     ├── usage_events → products
  │     ├── funnel_entries → funnel_stages
  │     ├── ledger_entries → products
  │     ├── account_scores_monthly
  │     ├── company_tags
  │     ├── notes
  │     └── tasks
  ├── products
  │     └── product_plans
  ├── segments
  ├── funnel_stages
  ├── integrations → sync_logs
  ├── import_files → import_file_references
  ├── manual_journal_entries → ledger_entries
  ├── audit_logs
  ├── reconciliation_issues
  ├── data_health_snapshots
  ├── financial_inputs_monthly
  ├── metric_snapshots
  ├── playbooks
  ├── benchmark_optins
  ├── notifications
  ├── fx_rates
  └── slack_connections

benchmark_aggregates (cross-tenant, anonymized)
```

### 4.3.4 Toplam Entity Sayısı (Hedef)

| Kategori | Entity Sayısı |
|----------|--------------|
| Core MVP (Mevcut) | 10 |
| Phase 2 (Mevcut) | 14 |
| Yeni Core Entities | 19 |
| **Toplam** | **43** |

### 4.3.5 Performans İndeksleri

```sql
-- Kritik sorgular için indeksler
CREATE INDEX idx_ledger_tenant_month ON ledger_entries(tenant_id, month);
CREATE INDEX idx_ledger_company_month ON ledger_entries(company_id, month);
CREATE INDEX idx_ledger_product_month ON ledger_entries(product_id, month);
CREATE INDEX idx_ledger_event_type ON ledger_entries(tenant_id, event_type, month);
CREATE INDEX idx_ledger_source ON ledger_entries(source_type, source_id);

CREATE INDEX idx_invoices_company ON invoices(company_id, issue_date);
CREATE INDEX idx_invoices_status ON invoices(tenant_id, status);

CREATE INDEX idx_subscriptions_company ON subscriptions(company_id, status);
CREATE INDEX idx_subscriptions_product ON subscriptions(product_id, status);
CREATE INDEX idx_subscriptions_renewal ON subscriptions(tenant_id, next_renewal_date);

CREATE INDEX idx_payments_company ON payments(company_id, payment_date);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);

CREATE INDEX idx_deals_company ON deals(company_id, status);
CREATE INDEX idx_deals_stage ON deals(tenant_id, stage, status);

CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_activities_company ON activities(company_id, activity_date);

CREATE INDEX idx_usage_events_company_product ON usage_events(company_id, product_id, event_date);

CREATE INDEX idx_funnel_entries_stage ON funnel_entries(stage_id, entered_at);

CREATE INDEX idx_metric_snapshots_lookup ON metric_snapshots(tenant_id, metric_key, month);

CREATE INDEX idx_companies_segment ON companies(tenant_id, segment);
CREATE INDEX idx_companies_status ON companies(tenant_id, status);
CREATE INDEX idx_companies_owner ON companies(owner_id);
```

### 4.3.6 Migration Stratejisi

Her faz için migration yaklaşımı:
1. **Additive-only migrations** — Mevcut tablolar ve kolonlar silinmez
2. **Default values** — Yeni kolonlar nullable veya default value ile eklenir
3. **Data backfill** — Mevcut veriler yeni kolonlara script ile taşınır
4. **Rollback plan** — Her migration'ın geri alma scripti hazırlanır
5. **Zero-downtime** — Tüm migration'lar production'da çalışırken uygulanabilir

---

## 4.4 Metric Calculation Library

### 4.4.1 Revenue Metrics

#### MRR (Monthly Recurring Revenue)
```
Formül: sum(ledger_entries.amount_reporting) WHERE month = target_month AND tenant_id = X
Veri Kaynağı: ledger_entries
Hesaplama Mantığı:
  1. Hedef ay için tüm ledger entry'lerini çek
  2. amount_reporting alanlarını topla
  3. Sadece recurring revenue dahil (one-time hariç)
Eksik Veri Durumu:
  - Ledger entry yoksa → MRR = 0
  - FX rate eksikse → reconciliation issue oluştur, son bilinen rate kullan
Validasyon:
  - MRR >= 0 olmalı
  - MRR = sum(New) + sum(Expansion) + sum(Reactivation) - sum(Contraction) - sum(Churn) + Previous MRR
Benchmark: Şirket büyüklüğüne göre değişir
```

#### ARR (Annual Recurring Revenue)
```
Formül: MRR × 12
Veri Kaynağı: MRR (derived)
Hesaplama Mantığı: Basit çarpma
Eksik Veri Durumu: MRR yoksa → ARR = 0
Validasyon: ARR = MRR × 12
Benchmark: $1M-$100M+ (şirket aşamasına göre)
```

#### Net New MRR
```
Formül: New_MRR + Expansion_MRR + Reactivation_MRR - Contraction_MRR - Churn_MRR
Veri Kaynağı: ledger_entries (event_type bazında grupla)
Hesaplama Mantığı:
  1. event_type = NEW → sum(amount_reporting) = New_MRR
  2. event_type = EXPANSION → sum(amount_reporting) = Expansion_MRR
  3. event_type = REACTIVATION → sum(amount_reporting) = Reactivation_MRR
  4. event_type = CONTRACTION → sum(amount_reporting) = Contraction_MRR
  5. event_type = CHURN → sum(amount_reporting) = Churn_MRR
  6. Net New = (1) + (2) + (3) - (4) - (5)
Validasyon: MRR_end = MRR_start + Net_New_MRR
Benchmark: Pozitif = büyüme, Negatif = küçülme
```

#### NRR (Net Revenue Retention)
```
Formül: ((MRR_end - New_MRR) / MRR_start) × 100
Veri Kaynağı: ledger_entries
Hesaplama Mantığı:
  1. MRR_start: Önceki ayın toplam MRR'ı
  2. MRR_end: Bu ayın toplam MRR'ı
  3. New_MRR: Bu ay event_type=NEW olan toplamlar
  4. NRR = ((MRR_end - New_MRR) / MRR_start) × 100
  NOT: New MRR çıkarılır çünkü sadece mevcut müşterilerden retention ölçülür
Eksik Veri: MRR_start = 0 ise → NRR hesaplanamaz (N/A)
Validasyon: Tipik aralık: 70%-170%
Benchmark:
  P25: 95% | P50: 101% | P75: 110% | Elite: 130%+
```

#### GRR (Gross Revenue Retention)
```
Formül: ((MRR_start - Contraction_MRR - Churn_MRR) / MRR_start) × 100
Veri Kaynağı: ledger_entries
Hesaplama Mantığı:
  1. MRR_start: Önceki ayın toplam MRR'ı
  2. Contraction: event_type=CONTRACTION toplamı
  3. Churn: event_type=CHURN toplamı
  4. GRR = ((MRR_start - Contraction - Churn) / MRR_start) × 100
  NOT: Expansion dahil edilmez — saf retention ölçümü
Eksik Veri: MRR_start = 0 → GRR hesaplanamaz (N/A)
Validasyon: 0% <= GRR <= 100% (asla 100%'ü geçemez)
Benchmark:
  P25: 79% | P50: 91% | P75: 95% | Elite: 97%+
```

#### Quick Ratio
```
Formül: (New_MRR + Expansion_MRR) / (Contraction_MRR + Churn_MRR)
Veri Kaynağı: ledger_entries
Hesaplama Mantığı:
  1. Büyüme: New + Expansion
  2. Küçülme: Contraction + Churn
  3. Quick Ratio = Büyüme / Küçülme
Eksik Veri: Küçülme = 0 ise → Quick Ratio = ∞ (mükemmel)
Validasyon: Quick Ratio > 0
Benchmark:
  < 1: Tehlike | 1-2: Orta | 2-4: İyi | 4+: Elite SaaS
```

### 4.4.2 Efficiency Metrics

#### CAC (Customer Acquisition Cost)
```
Formül: Total S&M Spend / New Customers Acquired
Veri Kaynağı: financial_inputs_monthly (opex), companies (new logos)
Hesaplama Mantığı:
  1. S&M Spend: financial_inputs_monthly'den satış+pazarlama harcaması
  2. New Customers: O ayda event_type=NEW olan unique company sayısı
  3. CAC = S&M Spend / New Customers
Eksik Veri:
  - financial_inputs_monthly girilmemişse → CAC hesaplanamaz
  - UI'da "Financial Inputs eksik" uyarısı göster
Validasyon: CAC > 0
Benchmark: ACV'ye göre değişir
```

#### LTV (Customer Lifetime Value)
```
Formül: ARPA × (1 / Monthly_Churn_Rate) × Gross_Margin
Veri Kaynağı: ledger_entries (ARPA), ledger_entries (churn rate), financial_inputs_monthly (margin)
Hesaplama Mantığı:
  1. ARPA (Average Revenue Per Account): Total MRR / Active Company Count
  2. Monthly Churn Rate: Churned_MRR / MRR_start
  3. Avg Customer Lifetime (months): 1 / Monthly_Churn_Rate
  4. Gross Margin: (Revenue - COGS) / Revenue (financial_inputs_monthly'den)
  5. LTV = ARPA × Lifetime × Gross Margin
Eksik Veri:
  - Churn rate = 0 → LTV = ∞ (cap at reasonable max, e.g., 120 months)
  - Gross margin yoksa → default %75 kullan, uyarı göster
Validasyon: LTV > 0
Benchmark: LTV/CAC >= 3:1 ideal
```

#### LTV/CAC Ratio
```
Formül: LTV / CAC
Veri Kaynağı: Derived (LTV, CAC)
Hesaplama Mantığı: Basit bölme
Validasyon: > 0
Benchmark:
  < 1: Sürdürülemez | 1-3: Gelişmeli | 3-5: İyi | 5+: Mükemmel
```

#### CAC Payback Period
```
Formül: CAC / (ARPA × Gross_Margin)
Veri Kaynağı: Derived
Hesaplama Mantığı:
  1. Aylık gross profit per customer = ARPA × Gross Margin
  2. Payback = CAC / Monthly Gross Profit
  Sonuç: Ay cinsinden
Eksik Veri: Gross margin yoksa → default %75
Validasyon: > 0 ay
Benchmark:
  P25: 18 ay | P50: 12 ay | P75: 8 ay | Elite: 6 ay
```

#### Burn Multiple
```
Formül: Net Burn / Net New ARR
Veri Kaynağı: financial_inputs_monthly (burn), ledger_entries (net new ARR)
Hesaplama Mantığı:
  1. Net Burn = Total Expenses - Total Revenue (nakit bazlı)
  2. Net New ARR = Net New MRR × 12
  3. Burn Multiple = Net Burn / Net New ARR
Eksik Veri: Financial inputs yoksa → hesaplanamaz
Validasyon: Düşük = iyi
Benchmark:
  > 3x: Kötü | 1.5-3x: Orta | 1-1.5x: İyi | < 1x: Mükemmel
```

#### Rule of 40
```
Formül: ARR Growth Rate (%) + Profit Margin (%)
Veri Kaynağı: ledger_entries (growth), financial_inputs_monthly (margin)
Hesaplama Mantığı:
  1. ARR Growth Rate: ((ARR_current - ARR_previous_year) / ARR_previous_year) × 100
  2. Profit Margin: financial_inputs_monthly.profit_margin_override
     VEYA (Revenue - COGS - OPEX) / Revenue × 100
  3. Rule of 40 = Growth Rate + Profit Margin
Eksik Veri: En az 12 ay veri gerekli; financial inputs gerekli
Validasyon: Negatif olabilir
Benchmark:
  < 20: Düşük | 20-40: Orta | 40-60: İyi | 60+: Elite
```

#### Expansion Rate
```
Formül: (Expansion_MRR / MRR_start) × 100
Veri Kaynağı: ledger_entries
Hesaplama Mantığı:
  1. Expansion MRR: event_type=EXPANSION toplamı
  2. MRR Start: Önceki ay MRR
  3. Rate = (Expansion / MRR Start) × 100
Benchmark: > 5% aylık = iyi
```

#### Revenue per Employee
```
Formül: ARR / Headcount
Veri Kaynağı: ledger_entries (ARR), financial_inputs_monthly.headcount
Hesaplama Mantığı: Basit bölme
Eksik Veri: Headcount yoksa → hesaplanamaz
Benchmark:
  P25: $100K | P50: $200K | P75: $350K | Elite: $500K+
```

#### Magic Number
```
Formül: Net New ARR / Previous Quarter S&M Spend
Veri Kaynağı: ledger_entries, financial_inputs_monthly
Hesaplama Mantığı:
  1. Net New ARR (bu çeyrek)
  2. S&M Spend (önceki çeyrek) 
  3. Magic Number = Net New ARR / S&M Spend
Benchmark: > 1.0 = verimli büyüme
```

#### Bessemer Efficiency Score
```
Formül: Net New ARR / Net Burn
Veri Kaynağı: ledger_entries, financial_inputs_monthly
Benchmark: > 1.5x = mükemmel
```

### 4.4.3 Sales & Pipeline Metrics

#### Sales Cycle Length
```
Formül: avg(deal.actual_close_date - deal.created_at) WHERE status = 'won'
Veri Kaynağı: deals
Benchmark: Segment'e göre değişir (SMB: 14 gün, Enterprise: 90+ gün)
```

#### Pipeline Coverage Ratio
```
Formül: Total Pipeline Value / Revenue Target
Veri Kaynağı: deals (open), financial targets
Benchmark: 3x+ = sağlıklı pipeline
```

#### Win Rate
```
Formül: (Won Deals / Total Closed Deals) × 100
Veri Kaynağı: deals
Benchmark: 20-30% = ortalama
```

### 4.4.4 Customer Health Metrics

#### Logo Churn Rate
```
Formül: (Churned Companies / Active Companies at Start) × 100
Veri Kaynağı: companies (status değişiklikleri)
Benchmark: < 5% yıllık = iyi
```

#### ARPA (Average Revenue Per Account)
```
Formül: Total MRR / Active Company Count
Veri Kaynağı: ledger_entries, companies
```

#### Customer Health Score (Composite)
```
Formül: Weighted composite:
  - Payment timeliness: 25%
  - Product usage trend: 25%
  - Engagement (activities/meetings): 20%
  - Expansion signals: 15%
  - Contract status: 15%
Veri Kaynağı: payments, usage_events, activities, ledger_entries, contracts
```

### 4.4.5 GTM Efficiency Score (Özel Metrik — Farklılaştırıcı)
```
Formül: (NRR × Quick_Ratio × Gross_Margin) / CAC_Payback
Veri Kaynağı: Derived (all component metrics)
Hesaplama Mantığı:
  1. NRR: decimal (e.g., 1.10 for 110%)
  2. Quick Ratio: decimal (e.g., 3.5)
  3. Gross Margin: decimal (e.g., 0.75 for 75%)
  4. CAC Payback: months (e.g., 12)
  5. GTM Score = (1.10 × 3.5 × 0.75) / 12 = 0.24
Yorum: Yüksek = verimli GTM operasyonu
Benchmark: Henüz endüstri standardı yok (RevenueOS proprietary metric)
```

### 4.4.6 Product-Level Metrics

Tüm yukarıdaki metrikler product_id filtresi ile ürün bazlı hesaplanabilir:
- **Product NRR:** NRR formülü, ledger_entries WHERE product_id = X
- **Product LTV:** LTV formülü, product-specific ARPA ve churn ile
- **Product CAC:** S&M allocation / product new customers
- **Product Churn:** Churn formülü, product-specific
- **Product Gross Margin:** (Product Revenue - Product COGS) / Product Revenue

### 4.4.7 Segment-Level Metrics

Tüm metrikler segment kırılımı ile hesaplanabilir:
- **Segment filtresi:** companies.segment = 'enterprise' | 'mid-market' | 'smb'
- **Country filtresi:** companies.country = 'TR' | 'DE' | 'US'
- **Industry filtresi:** companies.industry = 'technology' | 'finance' | 'retail'

---

## 4.5 UI/UX Screens

### 4.5.1 Ekran Listesi (Hedef)

| # | Ekran | Faz | Öncelik |
|---|-------|-----|---------|
| 1 | CEO Dashboard (Home) | Phase 1 Enhanced | P0 |
| 2 | Revenue Ledger | MVP (mevcut) | P0 |
| 3 | MRR Bridge / Waterfall Chart | Phase 2 | P0 |
| 4 | Companies List | MVP Enhanced | P0 |
| 5 | Company Detail (360°) | Phase 2 | P0 |
| 6 | Products List | MVP Enhanced | P0 |
| 7 | Product Detail (P&L) | Phase 3 | P0 |
| 8 | Import Center | MVP (mevcut) | P0 |
| 9 | Contacts List | Phase 2 | P1 |
| 10 | Deals / Pipeline | Phase 3 | P1 |
| 11 | Proposals | Phase 3 | P1 |
| 12 | Contracts & Renewals | Phase 4 | P1 |
| 13 | Metric Drill-Down Drawer | Phase 2 | P0 |
| 14 | Ops Center (Reconciliation) | Phase 2 | P1 |
| 15 | Data Health Dashboard | Phase 3 | P1 |
| 16 | Executive Pack / Rule of 40 | Phase 3 | P1 |
| 17 | Expansion Opportunities | Phase 5 | P2 |
| 18 | AI Playbooks | Phase 5 | P2 |
| 19 | Benchmark Dashboard | Phase 6 | P2 |
| 20 | Funnel Analysis | Phase 4 | P1 |
| 21 | Cohort Analysis | Phase 4 | P1 |
| 22 | Settings / Integrations | MVP Enhanced | P0 |
| 23 | User Management | Phase 2 | P1 |
| 24 | Segment Management | Phase 3 | P1 |
| 25 | Financial Inputs | Phase 3 | P1 |
| 26 | Notifications Center | Phase 5 | P2 |

### 4.5.2 CEO Dashboard Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│  RevenueOS                    [Search]  [Notifications] [User]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📊 CEO Dashboard          Period: [March 2026 ▼]  [Export]    │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │   ARR      │ │ Net New ARR│ │ MRR Growth │ │    NRR     │  │
│  │ $2.4M ↑12% │ │ $48K  ↑5% │ │  8.2% ↑   │ │ 112% ↑    │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │    GRR     │ │Quick Ratio │ │    CAC     │ │    LTV     │  │
│  │  94% ↑    │ │  3.2 ↑     │ │ $1,200 ↓  │ │ $18,000 ↑ │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │  LTV/CAC   │ │CAC Payback │ │Burn Multiple│ │Gross Margin│  │
│  │  15.0x ✓  │ │  8 mo ✓   │ │  1.2x ✓   │ │  78% ✓    │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                  │
│  │Expansion % │ │Sales Cycle │ │Pipeline Cov│                  │
│  │  6.2% ↑   │ │  32 days   │ │  3.8x ✓   │                  │
│  └────────────┘ └────────────┘ └────────────┘                  │
│                                                                  │
│  ┌──────────────────────────┐ ┌──────────────────────────┐     │
│  │  MRR Bridge (Waterfall)  │ │  ARR Trend (12 months)   │     │
│  │  ████ +New               │ │  ╱──────────╲            │     │
│  │  ████ +Expansion         │ │ ╱            ╲───────    │     │
│  │  ░░░░ -Contraction       │ │╱                         │     │
│  │  ░░░░ -Churn             │ │                          │     │
│  └──────────────────────────┘ └──────────────────────────┘     │
│                                                                  │
│  ┌──────────────────────────┐ ┌──────────────────────────┐     │
│  │  NRR by Segment          │ │  Top Expansion Opps      │     │
│  │  Enterprise: 118% ✓     │ │  1. Acme Corp  +$2.4K   │     │
│  │  Mid-Market: 108% ✓     │ │  2. Beta Inc   +$1.8K   │     │
│  │  SMB:         96% ⚠     │ │  3. Gamma Ltd  +$1.2K   │     │
│  └──────────────────────────┘ └──────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5.3 Navigation Flow

```
Sidebar Navigation:
├── 📊 Dashboard (CEO Dashboard)
├── 💰 Revenue
│   ├── Revenue Ledger
│   ├── MRR Bridge
│   └── Cohort Analysis
├── 🏢 Companies
│   ├── All Companies
│   └── Segments
├── 📦 Products
│   ├── All Products
│   └── Cross-sell Matrix
├── 👥 Contacts
├── 💼 Sales
│   ├── Deals / Pipeline
│   ├── Proposals
│   └── Funnel Analysis
├── 📄 Contracts & Renewals
├── 📥 Import Center
├── ⚙️ Ops Center
│   ├── Reconciliation
│   └── Data Health
├── 📈 Executive Pack
│   ├── Rule of 40
│   ├── Efficiency Metrics
│   └── Financial Inputs
├── 🎯 Actions
│   ├── Expansion Opportunities
│   ├── AI Playbooks
│   └── Benchmarks
├── 🔔 Notifications
└── ⚙️ Settings
    ├── Integrations
    ├── Users & Roles
    ├── Import Templates
    └── General
```

### 4.5.4 User Workflows (Hedef)

**Workflow 1: Yeni Müşteri Ekleme**
```
Import Center → Excel Upload → Company created → Products mapped → 
Invoices imported → Revenue recognized → Ledger entries created → 
Dashboard updated → Company appears in list
```

**Workflow 2: Metrik İnceleme (Drill-Down)**
```
Dashboard → Click MRR card → Drawer opens → 
  View by segment/product/company → 
  Click specific company → View ledger entries → 
  Click entry → View source (invoice/subscription) → 
  Click source → View raw file reference
```

**Workflow 3: Expansion Fırsat Yönetimi**
```
Expansion Opportunities page → Sort by score → 
  Click company → View 360° company page → 
  Review products used → Identify cross-sell opportunity → 
  Create deal → Create proposal → Track in pipeline
```

**Workflow 4: Renewal Yönetimi**
```
Contracts & Renewals → Filter "next 30 days" → 
  View at-risk renewals → Click company → 
  Review health score → Review activity history → 
  Create task for account owner → Track renewal outcome
```

---

# 5. GAP ANALYSIS: CURRENT VS TARGET

## 5.1 Feature Gap Matrix

| # | Feature Area | Current State | Target State | Gap | Priority | Phase |
|---|-------------|---------------|--------------|-----|----------|-------|
| 1 | **Company Page** | Temel liste + basit detay | 360° görünüm (7 section) | Büyük | P0 | 2 |
| 2 | **Product Page** | SKU listesi | Ürün bazlı P&L (8 section) | Büyük | P0 | 3 |
| 3 | **Contacts** | Yok (HubSpot sync var ama schema yok) | Contacts table + company linkage | Orta | P1 | 2 |
| 4 | **Deals/Pipeline** | Yok (HubSpot Deal sync var ama schema yok) | Full pipeline management | Orta | P1 | 3 |
| 5 | **Proposals** | Yok | Teklif oluşturma ve takip | Orta | P1 | 3 |
| 6 | **Contracts** | Yok | Sözleşme ve yenileme yönetimi | Büyük | P1 | 4 |
| 7 | **Payments** | Yok | Ödeme takibi ve yöntemleri | Orta | P1 | 2 |
| 8 | **Activities/CRM** | Yok | Email, call, meeting logging | Orta | P1 | 3 |
| 9 | **MRR Bridge Chart** | Yok | Waterfall chart (New/Exp/Cont/Churn) | Orta | P0 | 2 |
| 10 | **CAC** | Yok | Full CAC calculation | Büyük | P0 | 3 |
| 11 | **LTV** | Yok | LTV + LTV/CAC | Büyük | P0 | 3 |
| 12 | **CAC Payback** | Yok | CAC Payback Period | Orta | P0 | 3 |
| 13 | **Burn Multiple** | Yok | Burn Multiple calculation | Orta | P1 | 3 |
| 14 | **Rule of 40** | Yok | Rule of 40 dashboard | Orta | P1 | 3 |
| 15 | **Revenue/Employee** | Yok | Revenue per Employee | Küçük | P1 | 3 |
| 16 | **Expansion Rate** | Yok | Expansion Rate calculation | Küçük | P0 | 2 |
| 17 | **Pipeline Coverage** | Yok | Pipeline Coverage Ratio | Orta | P1 | 3 |
| 18 | **GTM Efficiency Score** | Yok | Proprietary composite metric | Orta | P2 | 5 |
| 19 | **Segment Engine** | segment field var ama kırılım yok | Full segment-based analytics | Büyük | P0 | 2 |
| 20 | **Product-Level Metrics** | Yok | Product NRR/LTV/CAC/Churn | Büyük | P0 | 3 |
| 21 | **Cohort Analysis** | Yok | Acquisition + Revenue cohorts | Büyük | P1 | 4 |
| 22 | **Cross-sell Matrix** | Yok | Product co-adoption matrix | Orta | P1 | 3 |
| 23 | **Funnel Analysis** | Yok | Sales funnel stages + conversion | Orta | P1 | 4 |
| 24 | **Audit Trail** | Design var, implementation yok | Full metric→source drill-down | Büyük | P0 | 2 |
| 25 | **Reconciliation** | Design var, implementation yok | Automated issue detection + fix flows | Orta | P1 | 2 |
| 26 | **Data Health** | Design var, implementation yok | 0-100 score + confidence labels | Orta | P1 | 3 |
| 27 | **Financial Inputs** | Design var, implementation yok | Monthly COGS/OPEX/Headcount entry | Orta | P1 | 3 |
| 28 | **User Roles** | Yok | Admin (aktif) + 4 role (placeholder) | Küçük | P1 | 2 |
| 29 | **Logo Integration** | File import (Excel/XML) | File import + placeholder direct API | Küçük | P0 | 1 |
| 30 | **Trendyol Integration** | Yok | E-commerce data sync | Orta | P1 | 4 |
| 31 | **WooCommerce Integration** | Yok | E-commerce data sync | Orta | P1 | 4 |
| 32 | **Integration Placeholders** | Yok | Stripe, Salesforce, Xero, vb. | Küçük | P2 | 4 |
| 33 | **Expansion Scoring** | Design var | ML/rule-based scoring | Orta | P2 | 5 |
| 34 | **AI Playbooks** | Design var | Trigger → action recommendations | Orta | P2 | 5 |
| 35 | **Churn Prediction** | Yok | Predictive churn model | Büyük | P2 | 6 |
| 36 | **Benchmarks** | Design var | Peer comparison (opt-in) | Küçük | P2 | 6 |
| 37 | **Notifications** | Yok | In-app + placeholder email/Slack | Küçük | P2 | 5 |
| 38 | **Scheduled Reports** | Yok | Weekly/monthly email reports | Küçük | P2 | 6 |
| 39 | **Customer Health Score** | Yok | Composite health score | Orta | P1 | 5 |
| 40 | **Usage Events** | Yok | Usage data ingestion | Orta | P2 | 5 |
| 41 | **Metric Snapshots** | Yok | Historical metric storage | Orta | P1 | 2 |

## 5.2 Gap Öncelik Özeti

| Öncelik | Gap Sayısı | Açıklama |
|---------|-----------|----------|
| P0 (Must Have) | 12 | Temel gelir metrikleri, company/product page, audit trail |
| P1 (Should Have) | 18 | CRM features, advanced metrics, integrations |
| P2 (Nice to Have) | 11 | AI features, benchmarks, advanced analytics |

---

# 6. PHASE-BY-PHASE ENHANCEMENT ROADMAP

Bu roadmap 7 faz olarak tasarlanmıştır. Her faz önceki fazın üzerine inşa edilir ve mevcut işlevselliği korur.

---

```
═══════════════════════════════════════════════════════════
📦 PHASE 1: Foundation Enhancement — Veri Modeli Güçlendirme
═══════════════════════════════════════════════════════════
```

### 🎯 OBJECTIVES
- Mevcut database schema'yı genişlet (companies, products, invoices, users tabloları)
- Yeni core entity'ler ekle (contacts, payments, roles, integrations, segments)
- User role altyapısını kur (Admin aktif, diğerleri placeholder)
- Import template'i genişlet
- Mevcut tüm işlevselliği koru

### 📊 SCOPE

**Features to add:**
- Companies tablosuna yeni alanlar (employee_count, country, industry, status, owner_id)
- Products tablosuna yeni alanlar (description, pricing_model, category, status)
- Invoices tablosuna yeni alanlar (status, due_date, paid_date, source)
- Contacts tablosu (company linkage)
- Payments tablosu
- Roles tablosu (Admin aktif, Sales Rep/CSM/Finance/CEO placeholder)
- Integrations tablosu (HubSpot/Logo mevcut, Trendyol/WooCommerce placeholder)
- Segments tablosu
- Sync_logs tablosu
- Subscriptions tablosuna yeni alanlar

**Database changes:**
- New tables: contacts, payments, payment_methods, roles, integrations, sync_logs, segments, company_tags
- New columns: companies (8 new), products (6 new), invoices (5 new), subscriptions (6 new), users (6 new)
- Migrations: Additive-only, backward compatible

**UI changes:**
- Enhanced screens: Companies List (yeni kolonlar), Products List (yeni kolonlar)
- New screens: Basic User Management, Basic Integration Settings

```
═══════════════════════════════════════════════════════════
🔍 STEP 1: PRE-PHASE ANALYSIS
═══════════════════════════════════════════════════════════
```

**Analysis Prompt (Copy-Paste):**
```
RevenueOS sisteminin mevcut durumunu Phase 1: Foundation Enhancement öncesi analiz et.

Analiz Kapsamı:
1. DATABASE SCHEMA İNCELEME
   - companies tablosunun mevcut yapısını kontrol et (alanlar, constraint'ler, index'ler)
   - products tablosunun mevcut yapısını kontrol et
   - invoices tablosunun mevcut yapısını kontrol et
   - subscriptions tablosunun mevcut yapısını kontrol et
   - users tablosunun mevcut yapısını kontrol et
   - Tüm mevcut foreign key ilişkilerini listele

2. MEVCUT ÖZELLİK ENVANTERİ
   - Import workflow çalışıyor mu? Test et: Excel upload → company match → invoice parse → ledger entry
   - HubSpot sync çalışıyor mu? Bağlantı durumunu kontrol et
   - Dashboard metrikleri doğru hesaplanıyor mu? MRR, ARR, NRR, GRR değerlerini doğrula
   - Revenue event classification çalışıyor mu?

3. ÇAKIŞMA ANALİZİ
   - Yeni eklenecek alanlar (employee_count, country, industry, vb.) mevcut alanlarla çakışıyor mu?
   - contacts tablosu oluşturulurken mevcut HubSpot Contact sync nasıl etkilenir?
   - Yeni roles tablosu mevcut user authentication'ı nasıl etkiler?

4. VERİ MİGRASYON GEREKSİNİMLERİ
   - Mevcut companies verilerinin yeni alanlara default değer atanması
   - Mevcut invoices verilerinin status alanı için default 'paid' atanması
   - Mevcut users verilerinin role_id ilişkilendirmesi

5. GERİYE UYUMLULUK
   - Import template değişiklikleri mevcut template'lerle uyumlu mu?
   - API endpoint'leri mevcut client'larla uyumlu mu?
   - Dashboard hesaplamaları etkileniyor mu?

ÇIKTI:
- Pre-Phase Analysis Report (markdown)
- Risk değerlendirmesi
- Go/No-go önerisi

Raporu /home/ubuntu/revenueos_phase1_analysis.md olarak kaydet.
```

**Analysis Checklist:**
- □ Database schema documented
- □ Existing features tested and working
- □ Potential conflicts identified
- □ Migration plan drafted
- □ Backward compatibility verified

**Expected Output:**
- Pre-Phase Analysis Report (markdown)
- Risk assessment
- Go/No-go recommendation

```
═══════════════════════════════════════════════════════════
🛠️ STEP 2: DEVELOPMENT
═══════════════════════════════════════════════════════════
```

**Development Prompt (Copy-Paste):**
```
RevenueOS sistemini [project_path] konumunda Phase 1: Foundation Enhancement ile güçlendir.

⚠️ KORUNACAK MEVCUT ÖZELLİKLER (BOZULMAMALI):
- Revenue Ledger ve tüm ledger_entries işlevselliği
- Revenue Event Classification (NEW/EXPANSION/CONTRACTION/CHURN/REACTIVATION/PRICE_INCREASE)
- MRR/ARR/NRR/GRR/Quick Ratio hesaplamaları
- Excel/CSV/XML import workflow
- HubSpot CRM sync
- Multi-currency support ve FX conversion
- Accrual/Cash revenue recognition
- Dashboard metric cards

EKLENECEK YENİLİKLER:

1. DATABASE MİGRASYONLARI:

A) companies tablosuna yeni alanlar:
   ALTER TABLE companies ADD COLUMN employee_count INTEGER;
   ALTER TABLE companies ADD COLUMN country VARCHAR(100);
   ALTER TABLE companies ADD COLUMN city VARCHAR(100);
   ALTER TABLE companies ADD COLUMN industry VARCHAR(100);
   ALTER TABLE companies ADD COLUMN owner_id UUID REFERENCES users(id);
   ALTER TABLE companies ADD COLUMN status VARCHAR(20) DEFAULT 'active';
   ALTER TABLE companies ADD COLUMN annual_revenue DECIMAL;
   ALTER TABLE companies ADD COLUMN source VARCHAR(50) DEFAULT 'manual';

B) products tablosuna yeni alanlar:
   ALTER TABLE products ADD COLUMN description TEXT;
   ALTER TABLE products ADD COLUMN pricing_model VARCHAR(20) DEFAULT 'flat';
   ALTER TABLE products ADD COLUMN category VARCHAR(100);
   ALTER TABLE products ADD COLUMN status VARCHAR(20) DEFAULT 'active';
   ALTER TABLE products ADD COLUMN launched_at DATE;
   ALTER TABLE products ADD COLUMN default_price DECIMAL;
   ALTER TABLE products ADD COLUMN currency VARCHAR(3) DEFAULT 'USD';

C) invoices tablosuna yeni alanlar:
   ALTER TABLE invoices ADD COLUMN status VARCHAR(20) DEFAULT 'paid';
   ALTER TABLE invoices ADD COLUMN due_date DATE;
   ALTER TABLE invoices ADD COLUMN paid_date DATE;
   ALTER TABLE invoices ADD COLUMN source VARCHAR(50) DEFAULT 'import';
   ALTER TABLE invoices ADD COLUMN external_id VARCHAR(255);

D) subscriptions tablosuna yeni alanlar:
   ALTER TABLE subscriptions ADD COLUMN billing_cycle VARCHAR(20) DEFAULT 'monthly';
   ALTER TABLE subscriptions ADD COLUMN next_renewal_date DATE;
   ALTER TABLE subscriptions ADD COLUMN last_renewal_date DATE;
   ALTER TABLE subscriptions ADD COLUMN cancellation_date DATE;
   ALTER TABLE subscriptions ADD COLUMN cancellation_reason TEXT;
   ALTER TABLE subscriptions ADD COLUMN trial_end_date DATE;

E) users tablosuna yeni alanlar:
   ALTER TABLE users ADD COLUMN role_id UUID;
   ALTER TABLE users ADD COLUMN first_name VARCHAR(100);
   ALTER TABLE users ADD COLUMN last_name VARCHAR(100);
   ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);
   ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
   ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP;

F) Yeni tablolar:

   CREATE TABLE contacts (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     company_id UUID NOT NULL REFERENCES companies(id),
     first_name VARCHAR(100) NOT NULL,
     last_name VARCHAR(100) NOT NULL,
     email VARCHAR(255),
     phone VARCHAR(50),
     title VARCHAR(200),
     role_type VARCHAR(50),
     external_id VARCHAR(255),
     is_primary BOOLEAN DEFAULT false,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );

   CREATE TABLE payments (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     company_id UUID NOT NULL REFERENCES companies(id),
     invoice_id UUID REFERENCES invoices(id),
     payment_date DATE NOT NULL,
     amount DECIMAL NOT NULL,
     currency VARCHAR(3) NOT NULL DEFAULT 'USD',
     method VARCHAR(50),
     status VARCHAR(20) DEFAULT 'completed',
     external_id VARCHAR(255),
     created_at TIMESTAMP DEFAULT NOW()
   );

   CREATE TABLE payment_methods (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     company_id UUID NOT NULL REFERENCES companies(id),
     type VARCHAR(50),
     last_four VARCHAR(4),
     brand VARCHAR(50),
     expiry_month INTEGER,
     expiry_year INTEGER,
     is_default BOOLEAN DEFAULT false,
     created_at TIMESTAMP DEFAULT NOW()
   );

   CREATE TABLE roles (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     name VARCHAR(50) NOT NULL,
     permissions_json JSONB DEFAULT '{}',
     is_active BOOLEAN DEFAULT true,
     created_at TIMESTAMP DEFAULT NOW()
   );
   -- Seed data:
   -- INSERT: admin (is_active=true, full permissions)
   -- INSERT: sales_rep (is_active=false, placeholder)
   -- INSERT: csm (is_active=false, placeholder)
   -- INSERT: finance (is_active=false, placeholder)
   -- INSERT: ceo (is_active=false, placeholder)

   CREATE TABLE integrations (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     provider VARCHAR(50) NOT NULL,
     status VARCHAR(20) DEFAULT 'disconnected',
     config_json JSONB DEFAULT '{}',
     last_sync_at TIMESTAMP,
     created_at TIMESTAMP DEFAULT NOW()
   );

   CREATE TABLE sync_logs (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     integration_id UUID NOT NULL REFERENCES integrations(id),
     sync_type VARCHAR(20),
     status VARCHAR(20) DEFAULT 'running',
     records_synced INTEGER DEFAULT 0,
     errors_json JSONB DEFAULT '[]',
     started_at TIMESTAMP DEFAULT NOW(),
     completed_at TIMESTAMP
   );

   CREATE TABLE segments (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     name VARCHAR(100) NOT NULL,
     criteria_json JSONB DEFAULT '{}',
     created_at TIMESTAMP DEFAULT NOW()
   );

   CREATE TABLE company_tags (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     company_id UUID NOT NULL REFERENCES companies(id),
     tag VARCHAR(100) NOT NULL,
     UNIQUE(tenant_id, company_id, tag)
   );

G) İndeksler:
   CREATE INDEX idx_contacts_company ON contacts(company_id);
   CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
   CREATE INDEX idx_payments_company ON payments(company_id, payment_date);
   CREATE INDEX idx_payments_invoice ON payments(invoice_id);
   CREATE INDEX idx_companies_segment ON companies(tenant_id, segment);
   CREATE INDEX idx_companies_status ON companies(tenant_id, status);
   CREATE INDEX idx_companies_owner ON companies(owner_id);
   CREATE INDEX idx_integrations_tenant ON integrations(tenant_id, provider);

2. BACKEND DEĞİŞİKLİKLER:

   Yeni API Endpoints:
   - GET /api/contacts?company_id=X → Şirketin kontakları
   - POST /api/contacts → Yeni kontak
   - PUT /api/contacts/:id → Kontak güncelle
   - DELETE /api/contacts/:id → Kontak sil
   - GET /api/payments?company_id=X → Ödeme listesi
   - POST /api/payments → Yeni ödeme
   - GET /api/roles → Rol listesi
   - GET /api/integrations → Entegrasyon listesi
   - POST /api/integrations/:provider/connect → Entegrasyon bağla
   - GET /api/segments → Segment listesi
   - POST /api/segments → Yeni segment

   Enhanced Endpoints:
   - GET /api/companies → Yeni alanları da döndür
   - GET /api/companies/:id → Genişletilmiş company detail
   - PUT /api/companies/:id → Yeni alanları güncelleyebilir
   - GET /api/products → Yeni alanları da döndür
   - PUT /api/products/:id → Yeni alanları güncelleyebilir

3. FRONTEND DEĞİŞİKLİKLER:

   Enhanced Pages:
   - Companies List: employee_count, country, industry, status kolonları ekle
   - Products List: pricing_model, category, status kolonları ekle
   - Settings/Integrations: Integration status cards (HubSpot: connected, Logo: file-import, Trendyol: coming-soon, WooCommerce: coming-soon)

   New Pages:
   - User Management (basit): Kullanıcı listesi + rol atama
   - Integration Settings: Provider bazlı bağlantı yönetimi

4. VERİ MİGRASYON SCRIPTLERİ:
   - Mevcut companies → status = 'active' (tümü)
   - Mevcut invoices → status = 'paid' (tümü), source = 'import'
   - Mevcut users → role_id = admin_role_id (tümü)
   - Seed roles: admin, sales_rep, csm, finance, ceo
   - Seed integrations: hubspot, logo, trendyol (placeholder), woocommerce (placeholder)

TEST GEREKSİNİMLERİ:
- Mevcut import workflow hala çalışıyor
- Mevcut dashboard metrikleri değişmedi
- Yeni alanlar companies/products listelerinde görünüyor
- Contacts CRUD operasyonları çalışıyor
- Payments CRUD operasyonları çalışıyor
- Roles seed verileri doğru

Geliştirme raporunu /home/ubuntu/revenueos_phase1_dev_report.md olarak kaydet.
```

**Development Checklist:**
- □ Database migrations created and tested
- □ New API endpoints implemented
- □ New UI screens created
- □ Existing features preserved
- □ Code documented
- □ No breaking changes

**Backward Compatibility Strategy:**
- Tüm yeni alanlar nullable veya default value ile eklenir
- Mevcut API response'ları genişletilir, kırılmaz
- Import template backward compatible (eski template'ler hala çalışır)
- Dashboard hesaplamaları değişmez (aynı ledger query'leri)

```
═══════════════════════════════════════════════════════════
🧪 STEP 3: TESTING
═══════════════════════════════════════════════════════════
```

**Testing Prompt (Copy-Paste):**
```
RevenueOS sistemini Phase 1: Foundation Enhancement sonrası test et.

REGRESSION TESTLERİ (Mevcut Özellikler):

1. Import Workflow Testi:
   - Mevcut Excel template ile import yap
   - Companies doğru eşleşiyor mu?
   - Invoices doğru parse ediliyor mu?
   - Revenue recognition (accrual) çalışıyor mu?
   - Revenue event classification doğru mu?
   - Ledger entries oluşturuluyor mu?
   Beklenen: Tüm mevcut import akışı değişmeden çalışmalı

2. Dashboard Metrik Testi:
   - MRR hesaplaması doğru mu? (ledger sum = dashboard value)
   - ARR = MRR × 12 mi?
   - NRR hesaplaması doğru mu?
   - GRR hesaplaması doğru mu?
   - Quick Ratio doğru mu?
   Beklenen: Tüm metrikler migration öncesi ile aynı değerde

3. HubSpot Sync Testi:
   - HubSpot bağlantısı hala aktif mi?
   - Company sync çalışıyor mu?
   Beklenen: Mevcut sync kesintisiz devam etmeli

4. Revenue Ledger Testi:
   - Ledger tablosu filtreleme çalışıyor mu?
   - Event type bazında filtreleme doğru mu?
   Beklenen: Mevcut ledger görünümü değişmeden çalışmalı

YENİ ÖZELLİK TESTLERİ:

5. Companies Enhanced Test:
   - Yeni alanlar (employee_count, country, industry, status) API'de görünüyor mu?
   - Companies listesinde yeni kolonlar var mı?
   - Company update ile yeni alanlar güncellenebiliyor mu?
   Beklenen: Tüm yeni alanlar CRUD operasyonlarında çalışmalı

6. Products Enhanced Test:
   - Yeni alanlar (description, pricing_model, category, status) API'de görünüyor mu?
   - Product update ile yeni alanlar güncellenebiliyor mu?
   Beklenen: Tüm yeni alanlar CRUD operasyonlarında çalışmalı

7. Contacts CRUD Test:
   - POST /api/contacts → Yeni kontak oluştur
   - GET /api/contacts?company_id=X → Kontakları listele
   - PUT /api/contacts/:id → Kontak güncelle
   - DELETE /api/contacts/:id → Kontak sil
   Beklenen: Tüm CRUD operasyonları başarılı

8. Payments CRUD Test:
   - POST /api/payments → Yeni ödeme kaydı
   - GET /api/payments?company_id=X → Ödemeleri listele
   Beklenen: Tüm CRUD operasyonları başarılı

9. Roles Test:
   - GET /api/roles → 5 rol listeleniyor mu? (admin, sales_rep, csm, finance, ceo)
   - Admin rolü aktif mi?
   - Diğer roller placeholder (inactive) mı?
   Beklenen: Seed veriler doğru

10. Integrations Test:
    - GET /api/integrations → 4 entegrasyon listeleniyor mu?
    - HubSpot status = connected mu?
    - Trendyol/WooCommerce status = placeholder mı?
    Beklenen: Entegrasyon kayıtları doğru

VERİ BÜTÜNLÜĞÜ TESTLERİ:

11. Migration Verification:
    - Mevcut companies'lerin tamamı status = 'active' mi?
    - Mevcut invoices'ların tamamı status = 'paid' mi?
    - Mevcut users role_id = admin_role_id mi?
    Beklenen: Backfill doğru çalışmış

12. Foreign Key Integrity:
    - contacts.company_id geçerli company'lere mi referans veriyor?
    - payments.invoice_id geçerli invoice'lara mı referans veriyor?
    Beklenen: Tüm FK ilişkileri sağlam

PERFORMANS TESTLERİ:

13. Companies List Query:
    - 10.000 company ile liste sorgusu < 500ms mi?
    - Filtreleme (segment, status) ile < 300ms mi?
    Beklenen: İndeksler sayesinde performans kabul edilebilir

Test raporunu /home/ubuntu/revenueos_phase1_test_report.md olarak kaydet.
```

**Success Criteria:**
- □ All regression tests pass
- □ All new feature tests pass
- □ Data integrity maintained
- □ Performance acceptable (< 500ms response time)
- □ No breaking changes detected

```
═══════════════════════════════════════════════════════════
📊 STEP 4: POST-PHASE REVIEW
═══════════════════════════════════════════════════════════
```

**Post-Phase Checklist:**
- □ Tüm özellikler beklenen şekilde çalışıyor
- □ Database schema güncellenmiş ve dokümante edilmiş
- □ API documentation güncellendi
- □ Migration scriptleri çalıştı ve doğrulandı
- □ Bilinen sorunlar dokümante edildi
- □ Phase 2 ön koşulları sağlandı

**Deliverables:**
- Updated database schema (24 → 32 entities)
- Updated API documentation (yeni endpoints)
- Test report
- Known issues list
- Phase 2 readiness assessment

**Next Phase Prerequisites:**
- Tüm yeni tablolar oluşturulmuş ve çalışıyor
- companies, products, invoices enhanced alanları çalışıyor
- contacts ve payments CRUD çalışıyor
- roles ve integrations seed verileri doğru

---

```
═══════════════════════════════════════════════════════════
📦 PHASE 2: Core Intelligence — Metrik Güçlendirme & Audit Trail
═══════════════════════════════════════════════════════════
```

### 🎯 OBJECTIVES
- Metric Drill-Down & Audit Trail implementasyonu (metric → ledger → source → raw file)
- MRR Bridge / Waterfall Chart eklenmesi
- Segment-based analytics altyapısı
- metric_snapshots tablosu ve hesaplama engine'i
- Expansion Rate, ARPA, Logo Churn hesaplamaları
- Enhanced Company Detail sayfası (360° görünümün ilk versiyonu)
- Reconciliation Engine (temel)

### 📊 SCOPE

**Features to add:**
- Metric Drill-Down Drawer (her metric kartından erişim)
- MRR Bridge Waterfall Chart
- Segment kırılımları (Enterprise/SMB/Mid-Market NRR, Churn, MRR)
- metric_snapshots tablosu (aylık metric cache)
- Expansion Rate hesaplaması
- ARPA hesaplaması
- Logo Churn Rate hesaplaması
- Enhanced Company Detail (Basic Info + Products Used + Financial + Timeline)
- Reconciliation Issues tablosu ve temel detection

**Database changes:**
- New tables: metric_snapshots, import_files, import_file_references, manual_journal_entries, audit_logs, reconciliation_issues
- Migrations: Ledger source referanslarının doğrulanması

**UI changes:**
- New: Metric Drill-Down Drawer, MRR Bridge Chart, Ops Center (basic)
- Enhanced: Dashboard (segment kırılımları), Company Detail (360° v1)

```
═══════════════════════════════════════════════════════════
🔍 STEP 1: PRE-PHASE ANALYSIS
═══════════════════════════════════════════════════════════
```

**Analysis Prompt (Copy-Paste):**
```
RevenueOS sisteminin mevcut durumunu Phase 2: Core Intelligence öncesi analiz et.

Phase 1'in başarıyla tamamlandığını doğrula:
1. DATABASE SCHEMA KONTROL
   - companies tablosunda employee_count, country, industry, status, owner_id alanları var mı?
   - products tablosunda description, pricing_model, category, status alanları var mı?
   - contacts tablosu oluşturulmuş ve çalışıyor mu?
   - payments tablosu oluşturulmuş ve çalışıyor mu?
   - roles tablosu seed verileri doğru mu?
   - integrations tablosu seed verileri doğru mu?

2. LEDGER ANALİZİ
   - ledger_entries tablosunda source_type ve source_id alanları dolu mu?
   - Her ledger entry'nin bir source referansı var mı?
   - invoice_lines ile ledger_entries arasındaki bağlantı sağlam mı?
   - Kaç adet ledger entry var ve event type dağılımı nasıl?

3. METRİK DOĞRULAMA
   - Mevcut MRR hesaplaması doğru çalışıyor mu?
   - MRR = ledger_entries toplamı eşitliği sağlanıyor mu?
   - Hangi aylar için veri var?

4. SEGMENT VERİSİ ANALİZİ
   - Kaç company'nin segment alanı dolu?
   - Segment dağılımı nasıl? (enterprise/mid-market/smb sayıları)
   - Segment bazlı MRR kırılımı yapılabilir durumda mı?

5. AUDIT TRAIL HAZIRLIK
   - Import edilen dosyaların referansları saklanıyor mu?
   - Ledger entry → invoice_line → invoice → raw file zinciri kurulabilir mi?

6. RİSK DEĞERLENDİRME
   - Metric Drill-Down implementasyonu mevcut hesaplamaları etkiler mi?
   - MRR Bridge Chart için gerekli event type ayrımı mevcut mu?
   - Reconciliation kontrollerinin false positive riski var mı?

Raporu /home/ubuntu/revenueos_phase2_analysis.md olarak kaydet.
```

**Analysis Checklist:**
- □ Phase 1 deliverables verified
- □ Ledger integrity confirmed
- □ Segment data availability assessed
- □ Audit trail readiness evaluated
- □ Performance baseline measured

```
═══════════════════════════════════════════════════════════
🛠️ STEP 2: DEVELOPMENT
═══════════════════════════════════════════════════════════
```

**Development Prompt (Copy-Paste):**
```
RevenueOS sistemini [project_path] konumunda Phase 2: Core Intelligence ile güçlendir.

⚠️ KORUNACAK MEVCUT ÖZELLİKLER:
- Phase 1'de eklenen tüm yeni tablolar ve alanlar
- Revenue Ledger ve event classification
- MRR/ARR/NRR/GRR/Quick Ratio hesaplamaları
- Import workflow
- HubSpot sync
- Multi-currency ve FX conversion
- contacts, payments CRUD

EKLENECEK YENİLİKLER:

1. DATABASE DEĞİŞİKLİKLER:

   CREATE TABLE metric_snapshots (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     month VARCHAR(7) NOT NULL,
     metric_key VARCHAR(50) NOT NULL,
     metric_value DECIMAL,
     segment_id UUID REFERENCES segments(id),
     product_id UUID REFERENCES products(id),
     company_id UUID REFERENCES companies(id),
     computed_at TIMESTAMP DEFAULT NOW()
   );
   CREATE INDEX idx_metric_snapshots_lookup ON metric_snapshots(tenant_id, metric_key, month);
   CREATE INDEX idx_metric_snapshots_segment ON metric_snapshots(tenant_id, metric_key, month, segment_id);
   CREATE INDEX idx_metric_snapshots_product ON metric_snapshots(tenant_id, metric_key, month, product_id);

   CREATE TABLE import_files (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     source VARCHAR(50) NOT NULL,
     filename VARCHAR(500) NOT NULL,
     checksum VARCHAR(64),
     storage_url VARCHAR(1000),
     uploaded_at TIMESTAMP DEFAULT NOW(),
     created_by UUID REFERENCES users(id)
   );

   CREATE TABLE import_file_references (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     file_id UUID NOT NULL REFERENCES import_files(id),
     object_type VARCHAR(50) NOT NULL,
     object_id UUID NOT NULL,
     sheet_name VARCHAR(100),
     row_number INTEGER,
     xml_path VARCHAR(500)
   );
   CREATE INDEX idx_import_refs_object ON import_file_references(object_type, object_id);

   CREATE TABLE manual_journal_entries (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     month VARCHAR(7) NOT NULL,
     company_id UUID REFERENCES companies(id),
     product_id UUID REFERENCES products(id),
     amount_reporting DECIMAL NOT NULL,
     reason TEXT NOT NULL,
     created_by UUID NOT NULL REFERENCES users(id),
     created_at TIMESTAMP DEFAULT NOW()
   );

   CREATE TABLE audit_logs (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     actor_id UUID REFERENCES users(id),
     action VARCHAR(20) NOT NULL,
     object_type VARCHAR(50) NOT NULL,
     object_id UUID NOT NULL,
     before_json JSONB,
     after_json JSONB,
     created_at TIMESTAMP DEFAULT NOW()
   );
   CREATE INDEX idx_audit_logs_object ON audit_logs(object_type, object_id);
   CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id, created_at);

   CREATE TABLE reconciliation_issues (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     issue_type VARCHAR(50) NOT NULL,
     severity VARCHAR(20) NOT NULL,
     object_type VARCHAR(50),
     object_id UUID,
     detected_at TIMESTAMP DEFAULT NOW(),
     status VARCHAR(20) DEFAULT 'open',
     suggested_fix_json JSONB,
     resolved_at TIMESTAMP,
     resolved_by UUID REFERENCES users(id)
   );
   CREATE INDEX idx_recon_issues_tenant ON reconciliation_issues(tenant_id, status);

2. BACKEND — METRIC CALCULATION ENGINE:

   A) Metric Snapshot Service:
   - Her ay sonunda (veya tetikleme ile) tüm metrikleri hesapla ve metric_snapshots'a kaydet
   - Global metrikler: MRR, ARR, Net New MRR, NRR, GRR, Quick Ratio, Churn Rate, Logo Churn, ARPA, Expansion Rate
   - Segment bazlı: Her segment için aynı metrikler
   - Product bazlı: Her product için aynı metrikler

   B) Yeni Metrik Hesaplamaları:
   - Expansion Rate = (Expansion_MRR / MRR_start) × 100
   - ARPA = Total_MRR / Active_Company_Count
   - Logo Churn Rate = (Churned_Companies / Total_Active_Companies_Start) × 100

   C) MRR Bridge Data:
   - Endpoint: GET /api/metrics/mrr-bridge?month=2024-03
   - Response: { start_mrr, new, expansion, reactivation, contraction, churn, end_mrr }
   - Her event type'ın MRR katkısı ayrı hesaplanır

   D) Metric Drill-Down:
   - Endpoint: GET /api/metrics/{metric_key}/drilldown?month=X&segment=Y&product_id=Z
   - Response: { summary, drivers: [{company, product, amount, event_type}], ledger_entries: [...] }

   E) Ledger Source Chain:
   - Endpoint: GET /api/ledger/entries/{id}/source
   - Response: { source_type, source_data, raw_file_reference: {file_id, sheet, row} }

   F) Reconciliation Engine (Basic):
   - Job: reconciliation_scan_job (nightly)
   - Check 1: Unmatched companies (billing'de var, CRM'de yok veya tersi)
   - Check 2: Unmapped SKUs (invoice_line SKU → product mapping eksik)
   - Check 3: Missing service period (accrual için service_start/end eksik)
   - Check 4: Duplicate invoices (aynı invoice_number + company + date)
   - Check 5: FX rate gaps (ledger entry var ama FX rate yok)

3. API ENDPOINTS (YENİ):
   - GET /api/metrics/mrr-bridge?month=X
   - GET /api/metrics/{key}/drilldown?month=X&segment=Y&product_id=Z&company_id=W
   - GET /api/metrics/snapshot?month=X → Tüm metrikler tek seferde
   - GET /api/metrics/segment-breakdown?metric=nrr&month=X
   - GET /api/ledger/entries/{id}/source
   - GET /api/imports/files → Import dosya listesi
   - GET /api/imports/files/{id}/references → Dosya referansları
   - POST /api/journal-entries → Manuel düzeltme
   - GET /api/reconciliation/issues → Issue listesi
   - PUT /api/reconciliation/issues/{id}/resolve → Issue çöz

4. FRONTEND DEĞİŞİKLİKLER:

   A) Dashboard Enhanced:
   - Her metric kartına "Explain / Drill-Down" butonu ekle
   - Segment selector: [All | Enterprise | Mid-Market | SMB]
   - MRR Bridge Waterfall Chart (yeni widget)
   - Expansion Rate, ARPA metric kartları ekle

   B) Metric Drill-Down Drawer (YENİ):
   - Metric kartına tıkla → Sağdan drawer açılır
   - Tabs: Summary | Drivers | Ledger Entries | Source
   - Drivers tab: Company bazlı kırılım tablosu
   - Ledger tab: İlgili ledger entries listesi
   - Source tab: Seçili entry'nin kaynağı (invoice/subscription/journal)

   C) Company Detail Enhanced (360° v1):
   - Basic Info section (yeni alanlar ile)
   - Products Used section (aktif abonelikler)
   - Financial section (invoices + payments)
   - Revenue Timeline section (ledger events)

   D) Ops Center (YENİ — Basic):
   - Reconciliation issues listesi
   - Severity badge'leri (critical/warning/info)
   - "Resolve" butonu

TEST GEREKSİNİMLERİ:
- metric_snapshots doğru hesaplanıyor
- MRR Bridge değerleri MRR değişimi ile tutarlı
- Drill-Down zinciri: metric → ledger → source → raw file
- Segment kırılımları doğru
- Reconciliation job sorunları tespit ediyor
- Mevcut dashboard metrikleri değişmedi
- Import workflow hala çalışıyor

Raporla: /home/ubuntu/revenueos_phase2_dev_report.md
```

**Development Checklist:**
- □ metric_snapshots tablosu oluşturuldu ve populate ediliyor
- □ Audit trail tabloları oluşturuldu (import_files, import_file_references, manual_journal_entries, audit_logs)
- □ MRR Bridge endpoint çalışıyor
- □ Metric Drill-Down endpoint çalışıyor
- □ Ledger source chain endpoint çalışıyor
- □ Reconciliation engine çalışıyor
- □ Segment bazlı metrikler hesaplanıyor
- □ Company Detail 360° v1 görünümü çalışıyor
- □ Ops Center basic sayfası çalışıyor
- □ Mevcut özellikler korundu

```
═══════════════════════════════════════════════════════════
🧪 STEP 3: TESTING
═══════════════════════════════════════════════════════════
```

**Testing Prompt (Copy-Paste):**
```
RevenueOS sistemini Phase 2: Core Intelligence sonrası kapsamlı test et.

REGRESSION TESTLERİ:
1. Import Workflow: Mevcut Excel template import → ledger entries oluşma
2. Dashboard Metrikleri: MRR, ARR, NRR, GRR, Quick Ratio değerleri doğru
3. HubSpot Sync: Company sync çalışıyor
4. Phase 1 Features: Contacts CRUD, Payments CRUD, Roles, Integrations

YENİ ÖZELLİK TESTLERİ:

5. MRR Bridge Testi:
   - GET /api/metrics/mrr-bridge?month=2024-03
   - start_mrr + new + expansion + reactivation - contraction - churn = end_mrr
   - Waterfall chart doğru render ediliyor mu?
   Beklenen: Bridge tutarlı

6. Metric Drill-Down Testi:
   - Dashboard'da MRR kartına tıkla → Drawer açılıyor mu?
   - Drivers tab: Company bazlı kırılım doğru mu?
   - Ledger tab: İlgili ledger entries listeleniyor mu?
   - Source tab: Ledger entry'nin kaynağı (invoice/subscription) gösteriliyor mu?
   - Raw file reference: Import dosyası ve satır numarası gösteriliyor mu?
   Beklenen: Tam audit trail zinciri çalışıyor

7. Segment Analytics Testi:
   - Dashboard'da segment selector'ü değiştir (All → Enterprise)
   - Metrikler segmente göre filtreleniyor mu?
   - NRR by segment breakdown doğru mu?
   Beklenen: Her segment için ayrı metrik hesabı

8. Metric Snapshots Testi:
   - metric_snapshots tablosu populate edilmiş mi?
   - Her ay için temel metrikler kaydedilmiş mi?
   - Segment bazlı snapshot'lar var mı?
   Beklenen: Aylık metric history saklanıyor

9. Reconciliation Testi:
   - Nightly job çalıştır (veya manual trigger)
   - Unmatched company tespit ediliyor mu?
   - Unmapped SKU tespit ediliyor mu?
   - Ops Center'da issues listeleniyor mu?
   - Issue resolve flow çalışıyor mu?
   Beklenen: Issues doğru tespit edilip listeleniyor

10. Company Detail 360° Testi:
    - Company detail sayfasında Basic Info, Products, Financial, Timeline section'ları görünüyor mu?
    - Revenue timeline ledger events gösteriyor mu?
    - Invoice listesi doğru mu?
    - Payment listesi doğru mu?
    Beklenen: 360° görünümün ilk versiyonu çalışıyor

11. Yeni Metrik Testleri:
    - Expansion Rate hesaplanıyor mu?
    - ARPA hesaplanıyor mu?
    - Logo Churn Rate hesaplanıyor mu?
    Beklenen: Tüm yeni metrikler doğru

VERİ BÜTÜNLÜĞÜ:
12. MRR = Dashboard MRR = Ledger sum = metric_snapshot(mrr) eşitliği
13. NRR = metric_snapshot(nrr) = drill-down calculated NRR

PERFORMANS:
14. Metric drill-down query < 1000ms (10K companies)
15. MRR bridge query < 500ms
16. Company detail 360° load < 1000ms

Test raporunu /home/ubuntu/revenueos_phase2_test_report.md olarak kaydet.
```

**Success Criteria:**
- □ All regression tests pass
- □ Audit trail chain complete (metric → ledger → source → raw file)
- □ MRR Bridge balanced
- □ Segment analytics working
- □ Reconciliation detecting issues
- □ Performance < 1000ms for all queries

**Deliverables:**
- 6 new tables (metric_snapshots, import_files, import_file_references, manual_journal_entries, audit_logs, reconciliation_issues)
- Metric calculation engine
- MRR Bridge Chart
- Drill-Down Drawer
- Company Detail 360° v1
- Ops Center basic
- Segment-based analytics

**Next Phase Prerequisites:**
- Metric calculation engine çalışıyor
- metric_snapshots populate ediliyor
- Audit trail zinciri çalışıyor
- Segment kırılımları doğru

---

```
═══════════════════════════════════════════════════════════
📦 PHASE 3: Advanced Metrics & Product Intelligence
═══════════════════════════════════════════════════════════
```

### 🎯 OBJECTIVES
- Financial Inputs (COGS, OPEX, Headcount) veri girişi
- Advanced metrics: CAC, LTV, LTV/CAC, CAC Payback, Burn Multiple, Rule of 40, Revenue/Employee, Magic Number
- Product-Level metrics: Product NRR, Product LTV, Product CAC, Product Churn, Cross-sell Rate
- Enhanced Product Detail page (P&L görünümü)
- Data Health Score implementasyonu
- Cross-sell Matrix
- product_plans tablosu

### 📊 SCOPE

**Database changes:**
- New tables: data_health_snapshots, financial_inputs_monthly, product_plans, proposal_items
- Enhanced: products (yeni metric cache alanları)

**UI changes:**
- New: Financial Inputs page, Product Detail P&L page, Data Health Dashboard, Cross-sell Matrix
- Enhanced: Dashboard (advanced metric cards), CEO Dashboard (15 metrik)

```
═══════════════════════════════════════════════════════════
🔍 STEP 1: PRE-PHASE ANALYSIS
═══════════════════════════════════════════════════════════
```

**Analysis Prompt (Copy-Paste):**
```
RevenueOS sisteminin mevcut durumunu Phase 3: Advanced Metrics & Product Intelligence öncesi analiz et.

Phase 2'nin başarıyla tamamlandığını doğrula:
1. metric_snapshots tablosu oluşturulmuş ve populate ediliyor mu?
2. MRR Bridge endpoint çalışıyor mu? Bridge tutarlı mı?
3. Metric Drill-Down zinciri çalışıyor mu? (metric → ledger → source → file)
4. Segment kırılımları doğru hesaplanıyor mu?
5. Reconciliation engine çalışıyor mu?
6. Company Detail 360° v1 çalışıyor mu?

Phase 3 hazırlık:
7. Financial Inputs için veri var mı? (COGS, OPEX, Headcount)
   - Eğer yoksa, kullanıcıdan nasıl toplanacak?
   - financial_inputs_monthly tablosu için UI gerekli
8. Product bazlı metrikler için yeterli veri var mı?
   - Kaç ürün var ve her ürün için ledger entry sayısı nedir?
   - Product bazlı NRR hesaplaması yapılabilir mi?
9. CAC hesaplaması için S&M spend verisi nereden gelecek?
   - financial_inputs_monthly'ye S&M alanı eklenmeli mi?
10. Cross-sell analizi için yeterli multi-product müşteri var mı?

Raporu /home/ubuntu/revenueos_phase3_analysis.md olarak kaydet.
```

```
═══════════════════════════════════════════════════════════
🛠️ STEP 2: DEVELOPMENT
═══════════════════════════════════════════════════════════
```

**Development Prompt (Copy-Paste):**
```
RevenueOS sistemini [project_path] konumunda Phase 3: Advanced Metrics & Product Intelligence ile güçlendir.

⚠️ KORUNACAK:
- Phase 1 & 2'deki tüm özellikler
- Metric calculation engine ve snapshots
- Audit trail zinciri
- MRR Bridge
- Company Detail 360° v1
- Reconciliation engine

EKLENECEK YENİLİKLER:

1. DATABASE DEĞİŞİKLİKLER:

   CREATE TABLE data_health_snapshots (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     snapshot_date DATE NOT NULL,
     score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
     breakdown_json JSONB NOT NULL,
     created_at TIMESTAMP DEFAULT NOW(),
     UNIQUE(tenant_id, snapshot_date)
   );

   -- financial_inputs_monthly (PRD'den)
   CREATE TABLE financial_inputs_monthly (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     month VARCHAR(7) NOT NULL,
     total_revenue_override DECIMAL,
     cogs DECIMAL,
     opex DECIMAL,
     sales_marketing_spend DECIMAL,
     headcount INTEGER,
     profit_margin_override DECIMAL,
     notes TEXT,
     created_by UUID REFERENCES users(id),
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW(),
     UNIQUE(tenant_id, month)
   );

   CREATE TABLE product_plans (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     product_id UUID NOT NULL REFERENCES products(id),
     name VARCHAR(100) NOT NULL,
     monthly_price DECIMAL,
     annual_price DECIMAL,
     features_json JSONB DEFAULT '[]',
     is_active BOOLEAN DEFAULT true,
     sort_order INTEGER DEFAULT 0,
     created_at TIMESTAMP DEFAULT NOW()
   );

2. BACKEND — ADVANCED METRIC ENGINE:

   A) Financial Input Service:
   - POST /api/financial-inputs → Aylık finansal veri girişi
   - GET /api/financial-inputs?from=2024-01&to=2024-12 → Geçmiş veriler
   - PUT /api/financial-inputs/{id} → Güncelle

   B) Advanced Metric Calculations (financial_inputs_monthly gerektirir):
   
   CAC:
   - sales_marketing_spend / new_customer_count (o ay NEW event olan unique company sayısı)
   - Segment bazlı CAC: segment'e göre filtrele
   
   LTV:
   - ARPA × (1 / monthly_churn_rate) × gross_margin
   - gross_margin = (total_revenue - cogs) / total_revenue
   - Churn rate = 0 ise → LTV capped at ARPA × 120 (10 year max)
   - Segment bazlı LTV: her segment için ayrı ARPA ve churn kullan
   
   LTV/CAC:
   - LTV / CAC
   
   CAC Payback:
   - CAC / (ARPA × gross_margin) → ay cinsinden
   
   Burn Multiple:
   - net_burn / (net_new_mrr × 12)
   - net_burn = opex + cogs - total_revenue
   
   Rule of 40:
   - arr_growth_rate + profit_margin
   - arr_growth_rate = ((arr_current - arr_12m_ago) / arr_12m_ago) × 100
   - profit_margin = financial_inputs_monthly.profit_margin_override 
     OR ((revenue - cogs - opex) / revenue) × 100
   
   Revenue per Employee:
   - ARR / headcount
   
   Magic Number:
   - (net_new_arr_this_quarter) / (sales_marketing_spend_last_quarter)
   
   Bessemer Efficiency Score:
   - net_new_arr / net_burn

   C) Product-Level Metrics:
   - Product NRR: NRR formülü, ledger WHERE product_id = X
   - Product GRR: GRR formülü, ledger WHERE product_id = X
   - Product LTV: product-specific ARPA × (1/product_churn) × product_gross_margin
   - Product CAC: allocated_sm_spend / product_new_customers
   - Product Churn Rate: product churned MRR / product start MRR
   - Product Gross Margin: (product_revenue - allocated_cogs) / product_revenue
   - Cross-sell Rate per product pair

   D) Data Health Score Engine:
   - Job: data_health_scan_job (nightly)
   - Dimensions:
     * Mapping Coverage (30%): Yüzde kaç invoice_line'ın product mapping'i var?
     * Completeness (25%): Yüzde kaç invoice'ın service_start/end'i var?
     * Consistency (25%): CRM company count vs billing company count eşleşme oranı
     * Freshness (10%): En son import ne zaman yapıldı?
     * Uniqueness (10%): Duplicate invoice oranı
   - Score = weighted sum (0-100)
   - Per-metric confidence: "high" (score > 80), "medium" (50-80), "low" (< 50)

   E) Cross-sell Matrix:
   - Endpoint: GET /api/products/cross-sell-matrix
   - Her ürün çifti için: ortak müşteri sayısı / ürün A müşteri sayısı × 100
   - Response: matrix[product_a_id][product_b_id] = percentage

3. API ENDPOINTS (YENİ):
   - POST /api/financial-inputs
   - GET /api/financial-inputs?from=X&to=Y
   - PUT /api/financial-inputs/{id}
   - GET /api/metrics/advanced?month=X (CAC, LTV, LTV/CAC, Payback, Burn, Rule40, RevPerEmp)
   - GET /api/metrics/product/{product_id}?month=X (Product NRR, LTV, CAC, Churn)
   - GET /api/products/cross-sell-matrix
   - GET /api/data-health/current
   - GET /api/data-health/history
   - GET /api/product-plans?product_id=X
   - POST /api/product-plans

4. FRONTEND:

   A) Financial Inputs Page (YENİ):
   - Aylık tablo: COGS, OPEX, S&M Spend, Headcount, Profit Margin Override
   - Inline editing
   - "Eksik veri" uyarısı (metrik hesaplanamıyorsa)

   B) Dashboard Enhanced — CEO Dashboard:
   - 15 metric card (ARR, Net New ARR, MRR Growth, NRR, GRR, Quick Ratio, CAC, LTV, LTV/CAC, CAC Payback, Burn Multiple, Gross Margin, Expansion Rate, Sales Cycle Length, Pipeline Coverage)
   - Her kartta: değer, trend arrow (↑↓), benchmark karşılaştırma rengi (green/yellow/red)
   - "Financial Inputs Required" uyarısı (CAC/LTV/Burn hesaplanamıyorsa)

   C) Product Detail Page (YENİ):
   - Basic Info: name, SKU, pricing_model, category, status
   - Plans: product_plans listesi
   - Usage: active subscriptions, total seats, companies using
   - Revenue: MRR, ARR, trend chart
   - Product Metrics: Product NRR, GRR, LTV, CAC, Churn, Gross Margin
   - Cross-sell: Bu ürün ile en çok birlikte kullanılan diğer ürünler
   - Companies: Bu ürünü kullanan şirket listesi

   D) Data Health Dashboard (YENİ):
   - Score gauge (0-100)
   - Dimension breakdown (Mapping, Completeness, Consistency, Freshness, Uniqueness)
   - Issue list (eksik mapping, eksik period, duplicates)
   - Her metrik kartında confidence badge

   E) Cross-sell Matrix Page:
   - Heat map: ürün × ürün matrisi
   - Renk yoğunluğu: co-adoption yüzdesi

TEST:
- Financial inputs CRUD çalışıyor
- CAC, LTV, LTV/CAC doğru hesaplanıyor
- Rule of 40 doğru
- Product metrics doğru
- Cross-sell matrix doğru
- Data health score 0-100 arasında
- Mevcut tüm özellikler korunmuş

Raporla: /home/ubuntu/revenueos_phase3_dev_report.md
```

**Testing Prompt (Copy-Paste):**
```
RevenueOS Phase 3 kapsamlı test:

REGRESSION: Phase 1 & 2 tüm testler geçiyor mu?

YENİ:
1. Financial Inputs: CRUD + validation (cogs >= 0, headcount >= 0)
2. CAC = S&M Spend / New Customers (doğrula)
3. LTV = ARPA × (1/churn) × gross_margin (doğrula, churn=0 edge case)
4. LTV/CAC = LTV / CAC (doğrula)
5. CAC Payback = CAC / (ARPA × margin) (doğrula)
6. Burn Multiple = Net Burn / Net New ARR (doğrula)
7. Rule of 40 = Growth% + Margin% (doğrula, < 12 ay veri edge case)
8. Revenue per Employee = ARR / Headcount (doğrula, headcount=0 edge case)
9. Product NRR: Ürün bazlı doğru hesaplanıyor mu?
10. Product LTV: Ürün bazlı doğru mu?
11. Cross-sell Matrix: Oranlar doğru mu? (0-100%)
12. Data Health Score: 0-100 arasında, breakdown doğru mu?
13. CEO Dashboard: 15 metrik kartı görünüyor mu?
14. Product Detail: Tüm section'lar doğru veri gösteriyor mu?
15. Financial Inputs eksikse uyarı gösteriliyor mu?

PERFORMANS:
16. CEO Dashboard load < 2000ms (tüm 15 metrik)
17. Product metrics query < 1000ms
18. Cross-sell matrix < 2000ms (100 ürün)

Test raporunu /home/ubuntu/revenueos_phase3_test_report.md olarak kaydet.
```

**Deliverables:**
- Financial Inputs system
- 8+ advanced metrics (CAC, LTV, LTV/CAC, Payback, Burn, Rule40, RevPerEmp, Magic Number)
- Product-level metrics (6 metrics per product)
- Cross-sell Matrix
- Data Health Score
- Product Detail page
- CEO Dashboard (15 metrics)

**Next Phase Prerequisites:**
- Financial inputs veri girişi çalışıyor
- Advanced metrics hesaplanıyor
- Product-level metrics çalışıyor

---

```
═══════════════════════════════════════════════════════════
📦 PHASE 4: Sales Intelligence & Integration Expansion
═══════════════════════════════════════════════════════════
```

### 🎯 OBJECTIVES
- Deals & Pipeline management
- Proposals system
- Contracts & Renewal tracking
- Activities / CRM logging
- Funnel Analysis
- Cohort Analysis (acquisition + revenue)
- Trendyol & WooCommerce entegrasyonu
- Integration placeholder'lar (Stripe, Salesforce, vb.)

### 📊 SCOPE

**Database changes:**
- New tables: deals, proposals, proposal_items, contracts, activities, funnel_stages, funnel_entries
- Seed data: Default funnel stages

**UI changes:**
- New: Deals/Pipeline page, Proposals page, Contracts page, Activities page, Funnel Analysis, Cohort Analysis
- Enhanced: Company Detail 360° v2 (Deals, Proposals, Activities sections)

```
═══════════════════════════════════════════════════════════
🔍 STEP 1: PRE-PHASE ANALYSIS
═══════════════════════════════════════════════════════════
```

**Analysis Prompt (Copy-Paste):**
```
RevenueOS Phase 4 öncesi analiz:

1. Phase 3 doğrulama:
   - Financial inputs çalışıyor mu?
   - Advanced metrics (CAC, LTV, vb.) hesaplanıyor mu?
   - Product-level metrics çalışıyor mu?
   - Data Health Score hesaplanıyor mu?

2. Deals/Pipeline hazırlık:
   - HubSpot'tan Deal data senkronize ediliyor mu?
   - Deal verisi varsa yapısı nasıl?
   - Pipeline stages tanımlanmış mı?

3. Trendyol/WooCommerce integration hazırlık:
   - Trendyol API erişimi var mı? API anahtarları?
   - WooCommerce API erişimi var mı?
   - Bu entegrasyonlardan hangi veriler çekilecek? (orders → invoices mapping)

4. Cohort analizi için veri yeterliliği:
   - Kaç aylık veri var?
   - Company created_at alanları dolu mu?
   - Cohort bazlı NRR hesaplaması yapılabilir mi?

Raporu /home/ubuntu/revenueos_phase4_analysis.md olarak kaydet.
```

```
═══════════════════════════════════════════════════════════
🛠️ STEP 2: DEVELOPMENT
═══════════════════════════════════════════════════════════
```

**Development Prompt (Copy-Paste):**
```
RevenueOS Phase 4: Sales Intelligence & Integration Expansion

⚠️ KORUNACAK: Phase 1-3 tüm özellikler

EKLENECEK:

1. DATABASE:

   CREATE TABLE deals (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     company_id UUID NOT NULL REFERENCES companies(id),
     name VARCHAR(255) NOT NULL,
     stage VARCHAR(50) NOT NULL DEFAULT 'lead',
     amount DECIMAL,
     currency VARCHAR(3) DEFAULT 'USD',
     probability DECIMAL CHECK (probability >= 0 AND probability <= 100),
     expected_close_date DATE,
     actual_close_date DATE,
     deal_type VARCHAR(50),
     owner_id UUID REFERENCES users(id),
     product_id UUID REFERENCES products(id),
     external_id VARCHAR(255),
     status VARCHAR(20) DEFAULT 'open',
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   CREATE INDEX idx_deals_company ON deals(company_id, status);
   CREATE INDEX idx_deals_stage ON deals(tenant_id, stage, status);
   CREATE INDEX idx_deals_owner ON deals(owner_id, status);

   CREATE TABLE proposals (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     company_id UUID NOT NULL REFERENCES companies(id),
     deal_id UUID REFERENCES deals(id),
     proposal_number VARCHAR(50),
     amount DECIMAL,
     currency VARCHAR(3) DEFAULT 'USD',
     status VARCHAR(20) DEFAULT 'draft',
     sent_date DATE,
     expiry_date DATE,
     accepted_date DATE,
     created_by UUID REFERENCES users(id),
     created_at TIMESTAMP DEFAULT NOW()
   );

   CREATE TABLE proposal_items (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     proposal_id UUID NOT NULL REFERENCES proposals(id),
     product_id UUID REFERENCES products(id),
     quantity INTEGER DEFAULT 1,
     unit_price DECIMAL,
     total_price DECIMAL,
     description VARCHAR(500)
   );

   CREATE TABLE contracts (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     company_id UUID NOT NULL REFERENCES companies(id),
     contract_number VARCHAR(100),
     start_date DATE NOT NULL,
     end_date DATE NOT NULL,
     total_value DECIMAL,
     currency VARCHAR(3) DEFAULT 'USD',
     auto_renewal BOOLEAN DEFAULT false,
     renewal_term_months INTEGER,
     status VARCHAR(30) DEFAULT 'active',
     signed_date DATE,
     created_at TIMESTAMP DEFAULT NOW()
   );
   CREATE INDEX idx_contracts_company ON contracts(company_id, status);
   CREATE INDEX idx_contracts_renewal ON contracts(tenant_id, end_date, status);

   CREATE TABLE activities (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     company_id UUID NOT NULL REFERENCES companies(id),
     contact_id UUID REFERENCES contacts(id),
     type VARCHAR(50) NOT NULL,
     subject VARCHAR(500),
     description TEXT,
     activity_date TIMESTAMP NOT NULL,
     owner_id UUID REFERENCES users(id),
     deal_id UUID REFERENCES deals(id),
     external_id VARCHAR(255),
     created_at TIMESTAMP DEFAULT NOW()
   );
   CREATE INDEX idx_activities_company ON activities(company_id, activity_date);

   CREATE TABLE funnel_stages (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     name VARCHAR(100) NOT NULL,
     sort_order INTEGER DEFAULT 0,
     conversion_target DECIMAL
   );
   -- Seed: lead → mql → sql → opportunity → negotiation → won → lost

   CREATE TABLE funnel_entries (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     company_id UUID REFERENCES companies(id),
     deal_id UUID REFERENCES deals(id),
     product_id UUID REFERENCES products(id),
     stage_id UUID NOT NULL REFERENCES funnel_stages(id),
     entered_at TIMESTAMP NOT NULL DEFAULT NOW(),
     exited_at TIMESTAMP,
     exit_reason VARCHAR(50)
   );
   CREATE INDEX idx_funnel_entries_stage ON funnel_entries(stage_id, entered_at);

2. BACKEND:

   A) Deals & Pipeline:
   - CRUD: GET/POST/PUT/DELETE /api/deals
   - Pipeline view: GET /api/deals/pipeline → stage bazlı gruplu
   - Deal metrics: Win rate, Avg deal size, Sales cycle length
   - Pipeline Coverage = Total pipeline value / Revenue target

   B) Proposals:
   - CRUD: GET/POST/PUT/DELETE /api/proposals
   - Proposal → Deal linkage
   - Status workflow: draft → sent → viewed → accepted/rejected/expired

   C) Contracts & Renewals:
   - CRUD: GET/POST/PUT/DELETE /api/contracts
   - Upcoming renewals: GET /api/contracts/upcoming?days=30
   - Renewal calendar view data

   D) Activities:
   - CRUD: GET/POST /api/activities
   - Company activity feed: GET /api/activities?company_id=X

   E) Funnel Analysis:
   - Conversion rates per stage: GET /api/funnel/analysis?from=X&to=Y
   - Stage-to-stage conversion: entries at stage N+1 / entries at stage N
   - Product-specific funnels: GET /api/funnel/analysis?product_id=X

   F) Cohort Analysis:
   - Acquisition cohorts: GET /api/analytics/cohorts/acquisition?period=monthly
     * Müşterileri created_at month'a göre grupla
     * Her cohort için: retention %, MRR, churn over time
   - Revenue cohorts: GET /api/analytics/cohorts/revenue?period=monthly
     * Müşterileri initial MRR band'e göre grupla
     * Band'ler: $0-500, $500-2K, $2K-10K, $10K+

   G) Trendyol Integration:
   - GET /api/integrations/trendyol/connect
   - Trendyol API → orders fetch → invoice mapping
   - Order → Company match (by store name/tax ID)
   - Order items → Products match
   - Sync frequency: daily

   H) WooCommerce Integration:
   - GET /api/integrations/woocommerce/connect
   - WooCommerce REST API → orders/subscriptions fetch
   - Order → Invoice mapping
   - Customer → Company mapping
   - Sync frequency: daily

   I) Integration Placeholders:
   - Stripe: integrations tablosunda placeholder, config_json'da "coming_soon: true"
   - Salesforce: aynı pattern
   - Xero/QuickBooks: aynı pattern
   - Zendesk/Intercom: aynı pattern

3. FRONTEND:

   A) Deals / Pipeline Page (YENİ):
   - Kanban board view (stage columns)
   - List view (tablo)
   - Deal detail modal
   - Pipeline Coverage metric

   B) Proposals Page (YENİ):
   - Proposal list + status filters
   - Create proposal form (select company, add products/items)
   - Proposal detail + status change

   C) Contracts & Renewals Page (YENİ):
   - Active contracts list
   - Upcoming renewals calendar/list
   - Contract detail

   D) Funnel Analysis Page (YENİ):
   - Funnel visualization (stage bars)
   - Conversion rates between stages
   - Product-specific funnel selector

   E) Cohort Analysis Page (YENİ):
   - Retention heatmap (acquisition cohorts × months)
   - MRR cohort trend lines
   - Segment selector

   F) Company Detail 360° v2:
   - Deals section ekle
   - Proposals section ekle
   - Activities section ekle
   - Contracts section ekle

   G) Settings/Integrations Enhanced:
   - Trendyol connect card
   - WooCommerce connect card
   - Placeholder cards (Stripe, Salesforce, vb.)

TEST: Phase 1-3 regression + tüm yeni CRUD + funnel + cohort + integrations
Raporla: /home/ubuntu/revenueos_phase4_dev_report.md
```

**Testing Prompt (Copy-Paste):**
```
Phase 4 kapsamlı test:

REGRESSION: Phase 1-3 tüm testler

YENİ:
1. Deals CRUD + pipeline view
2. Proposals CRUD + status workflow (draft→sent→accepted)
3. Contracts CRUD + upcoming renewals query
4. Activities CRUD + company feed
5. Funnel stages seed data doğru mu?
6. Funnel conversion rates hesaplanıyor mu?
7. Acquisition cohort heatmap doğru mu?
8. Revenue cohort analizi doğru mu?
9. Trendyol integration: connect + sync + order→invoice mapping
10. WooCommerce integration: connect + sync
11. Pipeline Coverage = pipeline value / target doğru mu?
12. Sales Cycle Length doğru hesaplanıyor mu?
13. Win Rate doğru mu?
14. Company Detail 360° v2: Deals, Proposals, Activities, Contracts gösteriyor mu?
15. Integration placeholder'lar doğru gösteriliyor mu?

PERFORMANS:
16. Pipeline view < 1000ms
17. Cohort analysis < 2000ms
18. Company detail 360° v2 < 1500ms

Test raporunu /home/ubuntu/revenueos_phase4_test_report.md olarak kaydet.
```

**Next Phase Prerequisites:**
- Deals/Pipeline çalışıyor
- Contracts/Renewals çalışıyor
- Trendyol/WooCommerce entegrasyonu çalışıyor veya placeholder
- Cohort analysis veri üretiyor

---

```
═══════════════════════════════════════════════════════════
📦 PHASE 5: AI & Action Engine
═══════════════════════════════════════════════════════════
```

### 🎯 OBJECTIVES
- Expansion Opportunity Scoring
- Customer Health Score
- AI Playbooks (trigger → action)
- Usage Events ingestion
- Notifications system
- GTM Efficiency Score
- Notes & Tasks collaboration
- Slack integration (placeholder)

```
═══════════════════════════════════════════════════════════
🔍 STEP 1: PRE-PHASE ANALYSIS
═══════════════════════════════════════════════════════════
```

**Analysis Prompt (Copy-Paste):**
```
RevenueOS Phase 5 öncesi analiz:

1. Phase 4 doğrulama: Deals, Contracts, Funnels, Cohorts, Integrations çalışıyor mu?
2. Expansion scoring için veri:
   - Seat utilization datası var mı?
   - Feature adoption datası var mı?
   - Login frequency datası var mı?
   - Billing history yeterli mi?
3. Health score için veri:
   - Payment timeliness datası var mı?
   - Product usage trend datası var mı?
   - Activity/engagement datası var mı?
4. Usage events: Henüz usage_events tablosu oluşturuldu mu?
5. Notifications altyapısı: Frontend notification component var mı?

Raporu /home/ubuntu/revenueos_phase5_analysis.md olarak kaydet.
```

```
═══════════════════════════════════════════════════════════
🛠️ STEP 2: DEVELOPMENT
═══════════════════════════════════════════════════════════
```

**Development Prompt (Copy-Paste):**
```
RevenueOS Phase 5: AI & Action Engine

⚠️ KORUNACAK: Phase 1-4 tüm özellikler

EKLENECEK:

1. DATABASE:

   CREATE TABLE usage_events (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     company_id UUID NOT NULL REFERENCES companies(id),
     product_id UUID REFERENCES products(id),
     event_name VARCHAR(100) NOT NULL,
     event_value DECIMAL,
     event_date TIMESTAMP NOT NULL,
     metadata_json JSONB DEFAULT '{}'
   );
   CREATE INDEX idx_usage_events ON usage_events(company_id, product_id, event_date);

   -- account_scores_monthly (PRD'den)
   CREATE TABLE account_scores_monthly (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     month VARCHAR(7) NOT NULL,
     company_id UUID NOT NULL REFERENCES companies(id),
     score_type VARCHAR(50) NOT NULL,
     score_value DECIMAL NOT NULL,
     reasons_json JSONB DEFAULT '[]',
     UNIQUE(tenant_id, month, company_id, score_type)
   );

   -- playbooks (PRD'den)
   CREATE TABLE playbooks (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     trigger_type VARCHAR(50) NOT NULL,
     trigger_key VARCHAR(100) NOT NULL,
     trigger_threshold DECIMAL,
     recommended_actions_json JSONB NOT NULL DEFAULT '[]',
     is_active BOOLEAN DEFAULT true,
     created_at TIMESTAMP DEFAULT NOW()
   );

   CREATE TABLE notifications (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     user_id UUID REFERENCES users(id),
     type VARCHAR(30) NOT NULL,
     title VARCHAR(255) NOT NULL,
     body TEXT,
     is_read BOOLEAN DEFAULT false,
     link VARCHAR(500),
     created_at TIMESTAMP DEFAULT NOW()
   );
   CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at);

   -- notes (PRD'den)
   CREATE TABLE notes (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     object_type VARCHAR(50) NOT NULL,
     object_id UUID NOT NULL,
     body TEXT NOT NULL,
     created_by UUID NOT NULL REFERENCES users(id),
     created_at TIMESTAMP DEFAULT NOW()
   );
   CREATE INDEX idx_notes_object ON notes(object_type, object_id);

   -- tasks (PRD'den)
   CREATE TABLE tasks (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     object_type VARCHAR(50),
     object_id UUID,
     title VARCHAR(255) NOT NULL,
     description TEXT,
     due_date DATE,
     owner_id UUID REFERENCES users(id),
     status VARCHAR(20) DEFAULT 'open',
     priority VARCHAR(20) DEFAULT 'medium',
     created_at TIMESTAMP DEFAULT NOW()
   );
   CREATE INDEX idx_tasks_owner ON tasks(owner_id, status);
   CREATE INDEX idx_tasks_object ON tasks(object_type, object_id);

   -- slack_connections (PRD'den)
   CREATE TABLE slack_connections (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id),
     webhook_url VARCHAR(500),
     channel_default VARCHAR(100),
     is_active BOOLEAN DEFAULT false,
     created_at TIMESTAMP DEFAULT NOW()
   );

2. BACKEND:

   A) Expansion Scoring Engine:
   - Job: expansion_scoring_job (weekly)
   - Scoring factors (rule-based, Phase 1):
     * Seat utilization (> 80% → high expansion signal) — Ağırlık: 25%
     * Revenue growth trend (3-month MRR trend positive) — Ağırlık: 25%
     * Multi-product potential (uses 1 product, peers use 2+) — Ağırlık: 20%
     * Contract renewal approaching (within 60 days) — Ağırlık: 15%
     * Activity level (recent meetings/notes) — Ağırlık: 15%
   - Score: 0-100
   - Store in account_scores_monthly (score_type = 'expansion')
   - Output reasons_json: ["Seat utilization at 92%", "3-month positive MRR trend"]

   B) Customer Health Score:
   - Job: health_scoring_job (weekly)
   - Scoring factors:
     * Payment timeliness (invoices paid on time %) — Ağırlık: 25%
     * Product usage trend (usage_events trend) — Ağırlık: 25%
     * Engagement (activities count last 30 days) — Ağırlık: 20%
     * Expansion signals (positive MRR change) — Ağırlık: 15%
     * Contract status (active, approaching renewal) — Ağırlık: 15%
   - Score: 0-100
   - Store in account_scores_monthly (score_type = 'health')
   - Update companies.health_score cache

   C) AI Playbooks (Rule-based):
   - Trigger types:
     * metric_threshold: "nrr_below_100", "quick_ratio_below_1", "churn_rate_above_5"
     * expansion_signal: "expansion_score_above_80"
     * health_alert: "health_score_below_30"
     * renewal_approaching: "renewal_within_30_days"
   - When trigger fires → create notification + suggested actions
   - Example playbook:
     Trigger: nrr_below_100 for segment
     Actions: ["Review churned accounts", "Schedule QBRs with at-risk accounts", "Analyze product usage drop"]

   D) GTM Efficiency Score:
   - GTM_Score = (NRR × Quick_Ratio × Gross_Margin) / CAC_Payback
   - Add to metric_snapshots and dashboard

   E) Usage Events API:
   - POST /api/usage-events (batch) → Bulk insert
   - GET /api/usage-events?company_id=X&product_id=Y&from=Z&to=W
   - Usage summary: GET /api/usage-events/summary?company_id=X

   F) Notes & Tasks:
   - CRUD for notes (attached to company, deal, metric)
   - CRUD for tasks (assigned to user, linked to company/deal)

   G) Notifications:
   - GET /api/notifications → User notifications (unread first)
   - PUT /api/notifications/{id}/read → Mark as read
   - Notification triggers: playbook fires, task assigned, renewal approaching

   H) Slack Integration (Placeholder):
   - POST /api/slack/connect → Store webhook URL
   - Placeholder: Send test message
   - Full implementation: Phase 7

3. FRONTEND:
   - Expansion Opportunities page: Ranked list, score, reasons, suggested actions
   - Customer Health dashboard: Health score distribution, at-risk accounts
   - AI Playbooks page: Active playbooks list, trigger history
   - Notifications bell icon + dropdown
   - Notes & Tasks on Company Detail
   - GTM Score on CEO Dashboard
   - Usage Events (admin/settings page for API key generation)

TEST: Phase 1-4 regression + all new scoring + playbooks + notifications
Raporla: /home/ubuntu/revenueos_phase5_dev_report.md
```

**Testing Prompt (Copy-Paste):**
```
Phase 5 test:

REGRESSION: Phase 1-4

YENİ:
1. Expansion scoring job çalışıyor mu? Scores 0-100?
2. Health scoring job çalışıyor mu? Scores 0-100?
3. account_scores_monthly doğru populate ediliyor mu?
4. Playbook trigger'ları çalışıyor mu?
5. Notification oluşturuluyor mu?
6. GTM Efficiency Score doğru hesaplanıyor mu?
7. Usage events CRUD çalışıyor mu?
8. Notes CRUD çalışıyor mu?
9. Tasks CRUD çalışıyor mu?
10. Expansion Opportunities sayfası doğru sıralıyor mu?
11. Company Detail'de notes/tasks görünüyor mu?
12. Notification bell doğru çalışıyor mu?
13. Slack placeholder bağlantısı kurulabiliyor mu?

Test: /home/ubuntu/revenueos_phase5_test_report.md
```

**Next Phase Prerequisites:**
- Scoring engine çalışıyor
- Playbooks trigger ediliyor
- Health/Expansion scores hesaplanıyor

---

```
═══════════════════════════════════════════════════════════
📦 PHASE 6: Predictive Intelligence & Benchmarks
═══════════════════════════════════════════════════════════
```

### 🎯 OBJECTIVES
- Predictive Churn Model (rule-based → ML-ready)
- Revenue Forecasting (basic)
- Benchmark Library (opt-in, anonymized, k-anonymity)
- Board-ready snapshots & export
- Scheduled reports (placeholder)
- Executive Pack finalization

```
═══════════════════════════════════════════════════════════
🔍 STEP 1: PRE-PHASE ANALYSIS
═══════════════════════════════════════════════════════════
```

**Analysis Prompt (Copy-Paste):**
```
RevenueOS Phase 6 öncesi analiz:

1. Phase 5 doğrulama: Expansion/Health scoring, Playbooks, Notifications, GTM Score
2. Churn prediction için veri:
   - Seat drop verileri var mı?
   - Usage drop trend verileri var mı?
   - Invoice delay verileri var mı?
   - NPS/CSAT verisi var mı?
   - En az 6 aylık historical churn data var mı?
3. Revenue forecasting için:
   - Pipeline data yeterli mi? (deals)
   - Renewal calendar data yeterli mi? (contracts)
   - Historical growth trend yeterli mi?
4. Benchmark library için:
   - Multi-tenant data var mı? (şuan tek kullanıcı)
   - k-anonymity threshold (n < 10 suppress) anlamlı mı?

Raporu /home/ubuntu/revenueos_phase6_analysis.md olarak kaydet.
```

```
═══════════════════════════════════════════════════════════
🛠️ STEP 2: DEVELOPMENT
═══════════════════════════════════════════════════════════
```

**Development Prompt (Copy-Paste):**
```
RevenueOS Phase 6: Predictive Intelligence & Benchmarks

⚠️ KORUNACAK: Phase 1-5 tüm özellikler

EKLENECEK:

1. DATABASE:

   CREATE TABLE benchmark_optins (
     tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
     enabled BOOLEAN DEFAULT false,
     enabled_at TIMESTAMP
   );

   CREATE TABLE benchmark_aggregates (
     cohort_key VARCHAR(100) NOT NULL,
     metric_key VARCHAR(50) NOT NULL,
     p25 DECIMAL,
     p50 DECIMAL,
     p75 DECIMAL,
     n INTEGER NOT NULL,
     computed_at TIMESTAMP DEFAULT NOW(),
     PRIMARY KEY (cohort_key, metric_key)
   );

   -- Churn prediction skorları account_scores_monthly'ye eklenir (score_type = 'churn_risk')

   ALTER TABLE metric_snapshots ADD COLUMN forecast_value DECIMAL;
   ALTER TABLE metric_snapshots ADD COLUMN forecast_method VARCHAR(50);

2. BACKEND:

   A) Predictive Churn Model (Rule-Based v1):
   - Job: churn_prediction_job (weekly)
   - Signals:
     * MRR contraction last 2 months → +25 risk points
     * Payment delay > 30 days → +20 risk points
     * Activity drop (no meetings/notes last 60 days) → +15 risk points
     * Seat decrease → +15 risk points
     * Usage drop > 30% month-over-month → +15 risk points
     * Contract expiry within 30 days, no renewal → +10 risk points
   - Score: 0-100 (sum of applicable signals, capped at 100)
   - Output: account_scores_monthly (score_type = 'churn_risk')
   - Output: Estimated revenue at risk = company MRR × (churn_risk_score / 100)
   - Trigger playbook: churn_risk_above_70

   B) Revenue Forecasting (Basic):
   - Method 1: Linear trend (last 6 months MRR trend → project next 3 months)
   - Method 2: Pipeline-weighted (deals × probability → expected new revenue)
   - Method 3: Renewal-based (contracts ending → renewal probability × contract value)
   - Combined forecast: weighted average of methods
   - Store in metric_snapshots (forecast_value, forecast_method)
   - Endpoint: GET /api/forecast/revenue?months=3

   C) Benchmark Library:
   - Opt-in: POST /api/benchmarks/opt-in
   - Aggregation job: benchmark_aggregation_job (monthly)
     * Group tenants by cohort_key (segment:enterprise, arr_range:1m-5m, etc.)
     * For each metric: calculate p25, p50, p75
     * k-anonymity: suppress if n < 10
   - Endpoint: GET /api/benchmarks?cohort=segment:enterprise
   - NOT: Şu an tek kullanıcı olduğu için, static benchmark data ile seed edin
     * Use industry benchmark data from research

   D) Board-Ready Snapshots:
   - Endpoint: GET /api/reports/board-snapshot?month=X
   - Response: JSON with all executive metrics, trends, highlights
   - Export: PDF generation (HTML template → PDF)
   - Key sections: ARR summary, NRR/GRR, Rule of 40, Growth bridge, Top risks, Top opportunities

   E) Scheduled Reports (Placeholder):
   - Database: scheduled_reports table (cron, recipients, report_type)
   - Implementation: Placeholder with manual trigger
   - Full cron-based implementation in future

3. FRONTEND:
   - Churn Risk on Company Detail + Company List (risk badge)
   - Revenue Forecast chart (actual + projected)
   - Benchmark Dashboard (your metrics vs. peers: p25/p50/p75)
   - Board Snapshot Export button
   - Executive Pack page finalized
   - AI Insights on Dashboard: "3 accounts at high churn risk (est. $12K MRR at risk)"

TEST: Phase 1-5 regression + churn prediction + forecasting + benchmarks + export
Raporla: /home/ubuntu/revenueos_phase6_dev_report.md
```

**Testing Prompt (Copy-Paste):**
```
Phase 6 test:

REGRESSION: Phase 1-5

YENİ:
1. Churn prediction scores 0-100? Risk signals doğru?
2. Revenue at risk = MRR × risk% doğru mu?
3. Revenue forecast: 3 aylık projeksiyon mantıklı mı?
4. Benchmark opt-in çalışıyor mu?
5. Benchmark dashboard static data gösteriyor mu?
6. Board snapshot PDF export çalışıyor mu?
7. Churn risk badge Company listesinde görünüyor mu?
8. Forecast chart actual + projected gösteriyor mu?
9. Executive Pack sayfası tüm metrikleri gösteriyor mu?
10. Dashboard AI insight'ları görünüyor mu?

Test: /home/ubuntu/revenueos_phase6_test_report.md
```

---

```
═══════════════════════════════════════════════════════════
📦 PHASE 7: Polish, Performance & SaaS Readiness
═══════════════════════════════════════════════════════════
```

### 🎯 OBJECTIVES
- Performance optimization (10K+ customers, 1000+ products)
- Full RBAC implementation (5 roles active)
- Customizable dashboards
- Annotation/commentary on charts
- Full Slack integration
- Custom metric builder (basic)
- Data export capabilities (CSV/Excel/PDF)
- SaaS platform readiness (multi-tenant onboarding, billing hooks)
- Final polish & bug fixes

```
═══════════════════════════════════════════════════════════
🛠️ STEP 2: DEVELOPMENT
═══════════════════════════════════════════════════════════
```

**Development Prompt (Copy-Paste):**
```
RevenueOS Phase 7: Polish, Performance & SaaS Readiness

⚠️ KORUNACAK: Phase 1-6 tüm özellikler

EKLENECEK:

1. PERFORMANCE OPTİMİZASYON:
   - Materialized views for frequent queries (monthly MRR, NRR, segment breakdowns)
   - Query optimization: All metric queries < 500ms for 10K companies
   - Pagination: All list endpoints paginated (default 50, max 200)
   - Caching: Redis cache for dashboard metrics (TTL: 5 min)
   - Background jobs: All metric calculations async
   - Database: Connection pooling, query analysis, slow query logging

2. FULL RBAC:
   - Activate all 5 roles: admin, sales_rep, csm, finance, ceo
   - Permission matrix:
     * Admin: Full access (all CRUD, settings, integrations, user management)
     * CEO: Read all, financial inputs, board snapshots, no delete
     * Finance: Financial inputs, invoices, payments, metrics, reports, no CRM
     * Sales Rep: Companies (own), deals (own), proposals (own), contacts, limited metrics
     * CSM: Companies (own), health scores, expansion scores, activities, tasks
   - Middleware: Permission check on every API endpoint
   - UI: Hide/disable unauthorized elements

3. CUSTOMIZABLE DASHBOARDS:
   - Widget system: Users can add/remove/rearrange metric cards
   - Saved views: Personal dashboard configurations
   - Widget library: All 25+ metrics available as widgets

4. DATA EXPORT:
   - CSV export: All tables (companies, invoices, ledger, metrics)
   - Excel export: Formatted with headers, filters
   - PDF export: Board snapshots, reports
   - Scheduled export (placeholder)

5. FULL SLACK INTEGRATION:
   - Connect Slack workspace
   - Channel selection for different alert types
   - Notifications → Slack messages
   - Playbook triggers → Slack alerts

6. CHART ANNOTATIONS:
   - Add notes/context to specific data points on charts
   - E.g., "Lost BigCo in March" on MRR chart
   - Annotations stored in database, visible to all users

7. SAAS PLATFORM READINESS:
   - Tenant onboarding flow: signup → workspace creation → initial setup wizard
   - Billing hooks: Placeholder for subscription management
   - Tenant isolation verification: Data leakage tests
   - Rate limiting: Per-tenant API rate limits
   - Audit: Tenant admin can view all audit logs

TEST: Full regression (Phase 1-6) + performance benchmarks + RBAC + exports
Raporla: /home/ubuntu/revenueos_phase7_dev_report.md
```

**Testing Prompt (Copy-Paste):**
```
Phase 7 kapsamlı final test:

REGRESSION: Phase 1-6 tüm testler

PERFORMANS:
1. Companies list (10K records) < 500ms
2. CEO Dashboard (15 metrics) < 2000ms
3. Company Detail 360° < 1500ms
4. Metric drill-down < 1000ms
5. Cohort analysis < 2000ms
6. Cross-sell matrix (100 products) < 2000ms
7. Revenue forecast < 1000ms

RBAC:
8. Admin: Tüm CRUD çalışıyor
9. CEO: Read-only erişim doğru, delete engellenmiş
10. Finance: Financial inputs erişimi var, CRM erişimi engelli
11. Sales Rep: Sadece kendi companies/deals erişimi
12. CSM: Sadece kendi companies + scores erişimi

EXPORT:
13. CSV export: Companies, Invoices, Ledger
14. Excel export: Formatted headers
15. PDF export: Board snapshot

SLACK:
16. Slack connect çalışıyor mu?
17. Test message gönderilebiliyor mu?

SAAS:
18. Tenant isolation: Tenant A, Tenant B verilerini göremez
19. Rate limiting çalışıyor mu?

Test: /home/ubuntu/revenueos_phase7_test_report.md
```

---

# 7. API INTEGRATION STRATEGY

## 7.1 HubSpot Integration (Mevcut — Güçlendirilecek)

### Architecture
```
HubSpot API (OAuth 2.0)
  ├── Companies → companies table (external_id match)
  ├── Contacts → contacts table (external_id match)
  ├── Deals → deals table (external_id match)
  └── Activities → activities table
```

### API Endpoints Used
| HubSpot API | Method | RevenueOS Entity | Sync |
|-------------|--------|-----------------|------|
| `/crm/v3/objects/companies` | GET | companies | Bi-directional |
| `/crm/v3/objects/contacts` | GET | contacts | Inbound |
| `/crm/v3/objects/deals` | GET | deals | Inbound |
| `/crm/v3/objects/engagements` | GET | activities | Inbound |

### Data Mapping
```
HubSpot Company → RevenueOS Company:
  hs_object_id → external_id
  name → name
  domain → domain
  industry → industry
  numberofemployees → employee_count
  country → country
  city → city
  
HubSpot Contact → RevenueOS Contact:
  hs_object_id → external_id
  firstname → first_name
  lastname → last_name
  email → email
  phone → phone
  jobtitle → title
  associatedcompanyid → company_id (via external_id match)

HubSpot Deal → RevenueOS Deal:
  hs_object_id → external_id
  dealname → name
  dealstage → stage
  amount → amount
  closedate → expected_close_date
  pipeline → deal_type
  hubspot_owner_id → owner_id (via user mapping)
```

### Sync Frequency
- **Initial sync:** Full pull of all objects
- **Incremental sync:** Every 15 minutes via webhook or scheduled pull
- **Conflict resolution:** HubSpot wins for CRM fields, RevenueOS wins for financial fields

### Error Handling
- Rate limit: Retry with exponential backoff
- Missing mapping: Create reconciliation_issue (type: unmatched_company)
- Duplicate: Check by external_id before insert

## 7.2 Logo ERP Integration

### Architecture
```
Phase 1 (MVP): File Import
  Logo ERP → Export XML/Excel → User uploads → RevenueOS processes

Phase 2 (Future): Direct API
  Logo REST API → Scheduled pull → Incremental sync → Idempotent upsert
```

### Data Mapping (File Import)
```
Logo Invoice → RevenueOS Invoice:
  Fatura No → invoice_number
  Fatura Tarihi → issue_date
  Tutar → amount
  Döviz → currency
  Cari Hesap → company (name/tax_id match)
  Kalem → product (name/code match)
  Hizmet Başlangıç → service_start
  Hizmet Bitiş → service_end
```

### Placeholder Implementation (Phase 1)
- integrations tablosunda `provider = 'logo'`, `status = 'file_import'`
- Settings page'de Logo kartı: "Currently supports file import (Excel/XML)"
- Upload flow: Import Center → Source = Logo

### Full Implementation (Phase 2+)
- Logo REST API connector
- OAuth/API key authentication
- Incremental sync with idempotency keys
- Real-time webhook support (if available)

## 7.3 Trendyol Integration

### Architecture
```
Trendyol Seller API
  ├── Orders → invoices table
  ├── Products → products table (match by barcode/SKU)
  └── Customers → companies table (by store/tax info)
```

### API Endpoints
| Trendyol API | Method | RevenueOS Entity |
|-------------|--------|-----------------|
| `/sapigw/suppliers/{supplierId}/orders` | GET | invoices |
| `/sapigw/suppliers/{supplierId}/products` | GET | products |

### Data Mapping
```
Trendyol Order → RevenueOS Invoice:
  orderNumber → invoice_number
  orderDate → issue_date
  totalPrice → amount
  currency → currency (TRY default)
  
Trendyol Order Line → RevenueOS Invoice Line:
  productName → product match
  quantity × price → amount
  
Trendyol → RevenueOS Company:
  customerName → company name (veya "Trendyol Marketplace" tek company)
```

### Sync Frequency
- Daily sync: Pull new orders from last 24 hours
- Full sync: Weekly reconciliation

### Placeholder Implementation (Phase 1-3)
- integrations tablosunda `provider = 'trendyol'`, `status = 'coming_soon'`
- Settings page'de Trendyol kartı: "Coming Soon" badge

### Full Implementation (Phase 4)
- Trendyol API connector with supplier credentials
- Order → Invoice mapping
- Product sync
- Error handling for API limits

## 7.4 WooCommerce Integration

### Architecture
```
WooCommerce REST API
  ├── Orders → invoices table
  ├── Subscriptions → subscriptions table
  ├── Products → products table
  └── Customers → companies table
```

### API Endpoints
| WooCommerce API | Method | RevenueOS Entity |
|----------------|--------|-----------------|
| `/wp-json/wc/v3/orders` | GET | invoices |
| `/wp-json/wc/v3/subscriptions` | GET | subscriptions |
| `/wp-json/wc/v3/products` | GET | products |
| `/wp-json/wc/v3/customers` | GET | companies |

### Data Mapping
```
WooCommerce Order → RevenueOS Invoice:
  id → external_id
  number → invoice_number
  date_created → issue_date
  total → amount
  currency → currency
  
WooCommerce Customer → RevenueOS Company:
  id → external_id
  company → name (veya first_name + last_name)
  email → domain extraction
  
WooCommerce Subscription → RevenueOS Subscription:
  id → external_id
  status → status mapping
  billing_period → billing_cycle
  total → mrr_amount
```

### Sync Frequency
- Webhook-based: Real-time order/subscription events
- Fallback: Hourly scheduled pull

### Placeholder Implementation (Phase 1-3)
- integrations tablosunda `provider = 'woocommerce'`, `status = 'coming_soon'`

### Full Implementation (Phase 4)
- WooCommerce REST API v3 connector
- Webhook receiver for real-time events
- Order → Invoice, Subscription → Subscription mapping

## 7.5 Placeholder Integrations

Aşağıdaki entegrasyonlar için integrations tablosunda placeholder kaydı oluşturulur:

| Provider | Status | Planned Phase | Data Type |
|----------|--------|--------------|-----------|
| Stripe | coming_soon | Future | Payments, Subscriptions, Invoices |
| Salesforce | coming_soon | Future | CRM (Companies, Contacts, Deals) |
| Xero | coming_soon | Future | Accounting (GL reconciliation) |
| QuickBooks | coming_soon | Future | Accounting |
| Zendesk | coming_soon | Future | Support tickets (health scoring) |
| Intercom | coming_soon | Future | Chat/support data |
| Segment | coming_soon | Future | Usage events |
| Mixpanel | coming_soon | Future | Product analytics |

---

# 8. TECHNICAL ARCHITECTURE

## 8.1 System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Antigravit Frontend (React-based)                           │  │
│  │  ├── CEO Dashboard        ├── Company Detail 360°            │  │
│  │  ├── Revenue Ledger       ├── Product Detail P&L             │  │
│  │  ├── Import Center        ├── Deals/Pipeline                 │  │
│  │  ├── Ops Center           ├── Funnel/Cohort Analysis         │  │
│  │  └── Settings             └── AI Playbooks/Expansion         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Cloud Code Backend (REST API)                               │  │
│  │  ├── Auth Middleware (RBAC: Admin/CEO/Finance/Sales/CSM)     │  │
│  │  ├── Rate Limiting (per-tenant)                              │  │
│  │  ├── Request Validation                                      │  │
│  │  └── Audit Logging                                           │  │
│  │                                                              │  │
│  │  API Groups:                                                 │  │
│  │  ├── /api/companies     — Company CRUD + 360° data           │  │
│  │  ├── /api/products      — Product CRUD + P&L metrics         │  │
│  │  ├── /api/invoices      — Invoice management                 │  │
│  │  ├── /api/ledger        — Revenue ledger + source chain      │  │
│  │  ├── /api/metrics       — Metric calculation + drill-down    │  │
│  │  ├── /api/deals         — Pipeline management                │  │
│  │  ├── /api/contracts     — Contract/renewal management        │  │
│  │  ├── /api/integrations  — Integration management + sync      │  │
│  │  ├── /api/forecast      — Revenue forecasting                │  │
│  │  ├── /api/analytics     — Cohorts, funnels, segments         │  │
│  │  └── /api/ai            — Scoring, playbooks, predictions    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                      PROCESSING LAYER                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐   │
│  │  Ingestion    │ │  Revenue     │ │  Metric Computation      │   │
│  │  Engine       │ │  Engine      │ │  Engine                  │   │
│  │  ─────────── │ │  ─────────── │ │  ──────────────────────  │   │
│  │  File parser  │ │  Recognition │ │  MRR/ARR/NRR/GRR        │   │
│  │  Validator    │ │  (Accrual/   │ │  CAC/LTV/Payback        │   │
│  │  Company      │ │   Cash)      │ │  Rule of 40/Burn        │   │
│  │  matcher      │ │  FX Convert  │ │  Product-level metrics  │   │
│  │  SKU mapper   │ │  Event       │ │  Segment breakdowns     │   │
│  │  Dedup check  │ │  classify    │ │  Cohort analysis        │   │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘   │
│                                                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐   │
│  │  Scoring     │ │  Forecast    │ │  Reconciliation          │   │
│  │  Engine      │ │  Engine      │ │  Engine                  │   │
│  │  ─────────── │ │  ─────────── │ │  ──────────────────────  │   │
│  │  Expansion   │ │  Linear      │ │  CRM↔Billing checks     │   │
│  │  Health      │ │  Pipeline    │ │  Issue detection         │   │
│  │  Churn risk  │ │  Renewal     │ │  Fix suggestions         │   │
│  │  GTM Score   │ │  Combined    │ │  Data Health Score       │   │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                  │
│  ┌──────────────────────────────┐  ┌───────────────────────────┐  │
│  │  PostgreSQL Database          │  │  Object Storage            │  │
│  │  ───────────────────────────  │  │  ────────────────────────  │  │
│  │  43 tables (target)           │  │  Import files (raw)        │  │
│  │  Multi-tenant (tenant_id)     │  │  Export files (PDF/Excel)  │  │
│  │  Revenue Ledger (fact table)  │  │  Board snapshots           │  │
│  │  Metric Snapshots (cache)     │  │                            │  │
│  │  Audit Logs (immutable)       │  │                            │  │
│  └──────────────────────────────┘  └───────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────┐  ┌───────────────────────────┐  │
│  │  Redis Cache                  │  │  Background Jobs           │  │
│  │  ───────────────────────────  │  │  ────────────────────────  │  │
│  │  Dashboard metrics (5min TTL) │  │  Nightly: data_quality     │  │
│  │  Session data                 │  │  Nightly: reconciliation   │  │
│  │  Rate limit counters          │  │  Weekly: expansion_scoring │  │
│  │  Integration sync locks       │  │  Weekly: health_scoring    │  │
│  └──────────────────────────────┘  │  Weekly: churn_prediction   │  │
│                                     │  Monthly: benchmarks        │  │
│                                     │  Hourly: freshness_monitor  │  │
│                                     └───────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                    INTEGRATION LAYER                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ HubSpot  │ │  Logo    │ │ Trendyol │ │WooComm.  │            │
│  │ (Active) │ │ (File)   │ │ (Phase4) │ │(Phase4)  │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  Stripe  │ │Salesforce│ │   Xero   │ │ Zendesk  │            │
│  │(Planned) │ │(Planned) │ │(Planned) │ │(Planned) │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
└────────────────────────────────────────────────────────────────────┘
```

## 8.2 Data Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Input   │────→│ Ingest  │────→│ Process │────→│ Store   │
│ Sources  │     │ & Parse │     │ & Calc  │     │ & Index │
└─────────┘     └─────────┘     └─────────┘     └────┬────┘
                                                       │
                                                       ▼
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Present │←────│ Compute │←────│ Analyze │←────│  Query  │
│  (UI)   │     │ Metrics │     │ & Score │     │ Ledger  │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
```

## 8.3 Scalability Considerations

### 10K+ Customers, 1000+ Products

| Concern | Strategy |
|---------|----------|
| **Ledger query performance** | Composite indexes on (tenant_id, month, company_id, product_id); Materialized views for monthly aggregations |
| **Dashboard load time** | metric_snapshots cache table; Redis for hot metrics; Async computation |
| **Company list pagination** | Server-side pagination with cursor; Virtual scrolling on frontend |
| **Metric computation** | Background jobs; Incremental computation (delta since last snapshot) |
| **Import processing** | Batch processing with progress tracking; Async file parsing |
| **Multi-tenant isolation** | Tenant ID on every query; Row-level security (RLS) in PostgreSQL |
| **API performance** | Connection pooling; Query optimization; Rate limiting per tenant |
| **Storage** | Object storage for raw files; Database for structured data; Archive policy for old data |

### Performance Targets

| Operation | Target | Strategy |
|-----------|--------|----------|
| Dashboard load | < 2s | Cached metrics + async |
| Company list (10K) | < 500ms | Paginated + indexed |
| Company detail | < 1.5s | Parallel queries |
| Metric drill-down | < 1s | Pre-computed snapshots |
| Import (1000 invoices) | < 30s | Batch + async |
| Cohort analysis | < 2s | Materialized views |
| Cross-sell matrix | < 2s | Pre-computed weekly |

---

# 9. ROLLOUT STRATEGY

## 9.1 Geçiş Planı

```
Aşama 1: Foundation (Phase 1)
  └── Mevcut sistem çalışır durumda kalır
  └── Yeni tablolar eklenir (additive-only)
  └── Mevcut veriler backfill edilir
  └── ✅ Zero downtime

Aşama 2: Intelligence (Phase 2-3)
  └── Metric engine güçlendirilir
  └── Yeni hesaplamalar eklenir
  └── UI genişletilir
  └── ✅ Mevcut dashboardlar bozulmaz

Aşama 3: Sales & Integration (Phase 4)
  └── CRM özellikleri eklenir
  └── Yeni entegrasyonlar bağlanır
  └── ✅ Mevcut HubSpot sync korunur

Aşama 4: AI & Polish (Phase 5-7)
  └── AI scoring aktifleşir
  └── RBAC tam aktif
  └── Performans optimize
  └── ✅ SaaS'a hazır
```

## 9.2 Data Migration Approach

| Adım | Açıklama | Risk | Mitigasyon |
|------|----------|------|-----------|
| 1 | Schema migration (additive-only) | Düşük | Rollback scriptleri hazır |
| 2 | Default value backfill | Düşük | Batch güncelleme, progress tracking |
| 3 | Metric recalculation | Orta | Eski değerler saklanır, yeni hesaplamalar karşılaştırılır |
| 4 | Integration data sync | Orta | Incremental sync, duplicate detection |
| 5 | RBAC activation | Düşük | Admin rol ile başla, kademeli aktifleştir |

## 9.3 Rollback Strategy

Her faz için:
1. **Database rollback:** Migration down scriptleri hazır
2. **Code rollback:** Git tag ile önceki versiyon deploy edilebilir
3. **Data rollback:** Metric snapshots ile karşılaştırma
4. **Feature flags:** Yeni özellikler flag ile kapatılabilir

## 9.4 User Training Plan

| Faz | Training | Yöntem |
|-----|----------|--------|
| Phase 1-2 | Yeni alanlar ve metrik drill-down | In-app tooltips + onboarding |
| Phase 3 | Financial inputs ve advanced metrics | Tutorial sayfası |
| Phase 4 | Pipeline, proposals, integrations | Onboarding wizard |
| Phase 5 | AI features ve scoring | Feature announcement + guide |
| Phase 6-7 | Forecasting, benchmarks, RBAC | Admin guide + video |

---

# 10. APPENDICES

## Appendix A: Glossary / Terimler Sözlüğü

| Terim | Türkçe | Açıklama |
|-------|--------|----------|
| MRR | Aylık Tekrarlayan Gelir | Monthly Recurring Revenue — Aylık abonelik geliri toplamı |
| ARR | Yıllık Tekrarlayan Gelir | Annual Recurring Revenue — MRR × 12 |
| NRR | Net Gelir Tutma Oranı | Net Revenue Retention — Mevcut müşterilerden elde edilen gelirin korunma oranı (expansion dahil) |
| GRR | Brüt Gelir Tutma Oranı | Gross Revenue Retention — Mevcut müşterilerden elde edilen gelirin korunma oranı (expansion hariç) |
| Churn | Müşteri Kaybı | Müşterinin aboneliğini iptal etmesi veya gelirinin sıfırlanması |
| Expansion | Genişleme | Mevcut müşterinin gelirinin artması (upsell, cross-sell, seat artışı) |
| Contraction | Daralma | Mevcut müşterinin gelirinin azalması (downgrade, seat azalışı) |
| CAC | Müşteri Edinme Maliyeti | Customer Acquisition Cost — Yeni müşteri kazanmanın maliyeti |
| LTV | Müşteri Yaşam Boyu Değeri | Customer Lifetime Value — Bir müşterinin toplam getirisi |
| ARPA | Hesap Başına Ortalama Gelir | Average Revenue Per Account |
| Quick Ratio | Hızlı Oran | Büyüme / Küçülme oranı |
| Burn Multiple | Yakma Çarpanı | Her $1 yeni gelir için harcanan nakit |
| Rule of 40 | 40 Kuralı | Büyüme oranı + Kar marjı — 40'ın üzeri iyi |
| GTM | Go-to-Market | Pazara giriş stratejisi |
| PLG | Product-Led Growth | Ürün Odaklı Büyüme |
| Pipeline Coverage | Boru Hattı Kapsama | Pipeline değeri / Gelir hedefi oranı |
| Cohort | Kohort | Ortak özelliğe sahip müşteri grubu |
| Ledger | Defteri Kebir | Tüm gelir hareketlerinin kaydedildiği ana tablo |
| Revenue Event | Gelir Olayı | Gelir değişimini temsil eden atomik kayıt |
| Accrual | Tahakkuk | Gelirin hizmet dönemi boyunca tanınması |

## Appendix B: Metric Formulas Quick Reference

```
MRR         = Σ(ledger_entries.amount_reporting) for month M
ARR         = MRR × 12
Net New MRR = New + Expansion + Reactivation - Contraction - Churn
NRR         = (MRR_end - New_MRR) / MRR_start × 100
GRR         = (MRR_start - Contraction - Churn) / MRR_start × 100
Quick Ratio = (New + Expansion) / (Contraction + Churn)
Churn Rate  = Churned_MRR / MRR_start × 100
Logo Churn  = Churned_Companies / Active_Companies_Start × 100
ARPA        = MRR / Active_Companies
Expansion % = Expansion_MRR / MRR_start × 100
CAC         = S&M_Spend / New_Customers
LTV         = ARPA × (1/Monthly_Churn) × Gross_Margin
LTV/CAC     = LTV / CAC
CAC Payback = CAC / (ARPA × Gross_Margin) [months]
Burn Multi  = Net_Burn / Net_New_ARR
Rule of 40  = ARR_Growth_Rate% + Profit_Margin%
Rev/Emp     = ARR / Headcount
Magic #     = Net_New_ARR_Q / S&M_Spend_Previous_Q
GTM Score   = (NRR × Quick_Ratio × Gross_Margin) / CAC_Payback
Pipeline Cov = Pipeline_Value / Revenue_Target
Win Rate    = Won_Deals / Total_Closed × 100
Sales Cycle = avg(close_date - create_date) for won deals
```

## Appendix C: Database Schema — Complete Entity List (Target: 43)

| # | Entity | Category | Phase |
|---|--------|----------|-------|
| 1 | tenants | Core | MVP |
| 2 | users | Core | MVP |
| 3 | companies | Core | MVP + P1 |
| 4 | products | Core | MVP + P1 |
| 5 | invoices | Core | MVP + P1 |
| 6 | invoice_lines | Core | MVP |
| 7 | subscriptions | Core | MVP + P1 |
| 8 | subscription_items | Core | MVP |
| 9 | ledger_entries | Core | MVP |
| 10 | fx_rates | Core | MVP |
| 11 | contacts | Core | P1 |
| 12 | payments | Core | P1 |
| 13 | payment_methods | Core | P1 |
| 14 | roles | Core | P1 |
| 15 | integrations | Core | P1 |
| 16 | sync_logs | Core | P1 |
| 17 | segments | Core | P1 |
| 18 | company_tags | Core | P1 |
| 19 | metric_snapshots | Intelligence | P2 |
| 20 | import_files | Trust | P2 |
| 21 | import_file_references | Trust | P2 |
| 22 | manual_journal_entries | Trust | P2 |
| 23 | audit_logs | Trust | P2 |
| 24 | reconciliation_issues | Operations | P2 |
| 25 | data_health_snapshots | Operations | P3 |
| 26 | financial_inputs_monthly | Executive | P3 |
| 27 | product_plans | Product | P3 |
| 28 | deals | Sales | P4 |
| 29 | proposals | Sales | P4 |
| 30 | proposal_items | Sales | P4 |
| 31 | contracts | Sales | P4 |
| 32 | activities | CRM | P4 |
| 33 | funnel_stages | Analytics | P4 |
| 34 | funnel_entries | Analytics | P4 |
| 35 | usage_events | AI | P5 |
| 36 | account_scores_monthly | AI | P5 |
| 37 | playbooks | AI | P5 |
| 38 | notifications | System | P5 |
| 39 | notes | Collaboration | P5 |
| 40 | tasks | Collaboration | P5 |
| 41 | slack_connections | Collaboration | P5 |
| 42 | benchmark_optins | Benchmark | P6 |
| 43 | benchmark_aggregates | Benchmark | P6 |

## Appendix D: API Endpoint Reference (Complete)

### Core CRUD
```
GET    /api/companies                    → List companies (paginated, filterable)
GET    /api/companies/:id                → Company detail (360°)
POST   /api/companies                    → Create company
PUT    /api/companies/:id                → Update company
DELETE /api/companies/:id                → Delete company

GET    /api/products                     → List products
GET    /api/products/:id                 → Product detail (P&L)
POST   /api/products                     → Create product
PUT    /api/products/:id                 → Update product

GET    /api/contacts?company_id=X        → List contacts
POST   /api/contacts                     → Create contact
PUT    /api/contacts/:id                 → Update contact
DELETE /api/contacts/:id                 → Delete contact

GET    /api/invoices?company_id=X        → List invoices
POST   /api/invoices                     → Create invoice
GET    /api/invoices/:id                 → Invoice detail

GET    /api/payments?company_id=X        → List payments
POST   /api/payments                     → Create payment

GET    /api/deals                        → List deals (pipeline)
GET    /api/deals/pipeline               → Pipeline view (stage-grouped)
POST   /api/deals                        → Create deal
PUT    /api/deals/:id                    → Update deal

GET    /api/proposals                    → List proposals
POST   /api/proposals                    → Create proposal
PUT    /api/proposals/:id                → Update proposal status

GET    /api/contracts                    → List contracts
GET    /api/contracts/upcoming?days=30   → Upcoming renewals
POST   /api/contracts                    → Create contract

GET    /api/activities?company_id=X      → List activities
POST   /api/activities                   → Create activity

GET    /api/notes?object_type=X&id=Y     → List notes
POST   /api/notes                        → Create note

GET    /api/tasks?owner_id=X             → List tasks
POST   /api/tasks                        → Create task
PUT    /api/tasks/:id                    → Update task
```

### Metrics & Analytics
```
GET    /api/metrics/snapshot?month=X                          → All metrics for month
GET    /api/metrics/mrr-bridge?month=X                        → MRR bridge data
GET    /api/metrics/{key}/drilldown?month=X&segment=Y         → Metric drill-down
GET    /api/metrics/advanced?month=X                           → Advanced metrics (CAC, LTV, etc.)
GET    /api/metrics/product/{id}?month=X                       → Product-level metrics
GET    /api/metrics/segment-breakdown?metric=nrr&month=X       → Segment breakdown
GET    /api/products/cross-sell-matrix                          → Cross-sell matrix
GET    /api/analytics/cohorts/acquisition?period=monthly        → Acquisition cohorts
GET    /api/analytics/cohorts/revenue?period=monthly            → Revenue cohorts
GET    /api/funnel/analysis?from=X&to=Y                        → Funnel analysis
GET    /api/forecast/revenue?months=3                           → Revenue forecast
GET    /api/data-health/current                                 → Data health score
GET    /api/benchmarks?cohort=X                                 → Benchmark data
```

### Audit & Operations
```
GET    /api/ledger/entries?month=X&company_id=Y    → Ledger entries
GET    /api/ledger/entries/:id/source               → Source chain
POST   /api/journal-entries                          → Manual journal
GET    /api/reconciliation/issues                    → Reconciliation issues
PUT    /api/reconciliation/issues/:id/resolve        → Resolve issue
GET    /api/imports/files                             → Import files list
```

### AI & Scoring
```
GET    /api/ai/expansion-opportunities               → Expansion scores (ranked)
GET    /api/ai/churn-risks                            → Churn risk scores
GET    /api/ai/playbooks                              → Active playbooks
POST   /api/usage-events                              → Ingest usage events
```

### System
```
GET    /api/integrations                              → Integration list
POST   /api/integrations/:provider/connect             → Connect integration
GET    /api/roles                                      → Role list
GET    /api/notifications                              → User notifications
PUT    /api/notifications/:id/read                     → Mark notification read
POST   /api/financial-inputs                           → Financial data entry
GET    /api/financial-inputs?from=X&to=Y               → Financial data history
GET    /api/reports/board-snapshot?month=X              → Board snapshot
```

## Appendix E: Phase Summary & Timeline

```
╔════════════════════════════════════════════════════════════╗
║  PHASE   │  NAME                      │ NEW ENTITIES     ║
╠════════════════════════════════════════════════════════════╣
║  Phase 1 │ Foundation Enhancement      │ 8 tables         ║
║  Phase 2 │ Core Intelligence           │ 6 tables         ║
║  Phase 3 │ Advanced Metrics & Product  │ 3 tables         ║
║  Phase 4 │ Sales & Integration         │ 7 tables         ║
║  Phase 5 │ AI & Action Engine          │ 7 tables         ║
║  Phase 6 │ Predictive & Benchmarks     │ 2 tables         ║
║  Phase 7 │ Polish & SaaS Readiness     │ 0 (optimization) ║
╠════════════════════════════════════════════════════════════╣
║  TOTAL   │                             │ 43 tables        ║
╚════════════════════════════════════════════════════════════╝
```

## Appendix F: Benchmark Reference Card

```
╔═══════════════════════════╤══════╤══════╤══════╤══════════╗
║ Metric                    │  P25 │  P50 │  P75 │  Elite   ║
╠═══════════════════════════╪══════╪══════╪══════╪══════════╣
║ NRR                       │  95% │ 101% │ 110% │   130%+  ║
║ GRR                       │  79% │  91% │  95% │    97%+  ║
║ Quick Ratio               │  1.0 │  2.0 │  3.5 │    4.0+  ║
║ LTV/CAC                   │  1.5 │  3.0 │  5.0 │    8.0+  ║
║ CAC Payback (months)      │   18 │   12 │    8 │       6  ║
║ Burn Multiple             │ 3.0x │ 1.5x │ 1.0x │    0.5x  ║
║ Rule of 40                │   15 │   30 │   45 │     60+  ║
║ Revenue per Employee      │$100K │$200K │$350K │   $500K+ ║
║ Gross Margin              │  60% │  72% │  80% │    85%+  ║
║ Pipeline Coverage         │ 1.5x │ 2.5x │ 3.5x │    5.0x  ║
║ Sales Cycle (Enterprise)  │  90d │  60d │  45d │     30d  ║
║ Logo Churn (Annual)       │  10% │   7% │   4% │      2%  ║
╚═══════════════════════════╧══════╧══════╧══════╧══════════╝
```

---

# DOKÜMAN SONU

**Bu Master Blueprint, RevenueOS'un mevcut durumundan hedef durumuna geçişi için tek referans kaynağıdır.**

**Kullanım:**
1. Her fazın başında ilgili Phase bölümünü okuyun
2. Pre-Phase Analysis Prompt'unu copy-paste ederek analiz yapın
3. Development Prompt'unu copy-paste ederek geliştirme yapın
4. Testing Prompt'unu copy-paste ederek test edin
5. Post-Phase Checklist'i tamamlayın
6. Sonraki faza geçin

**Versiyon Geçmişi:**
| Versiyon | Tarih | Değişiklik |
|----------|-------|-----------|
| v2.0 | 2026-03-16 | Master Blueprint oluşturuldu |
| v2.1 | 2026-04-26 | AI Data Mapping Wizard, Hydration fix, Bulk delete, Sorting/Filtering |
| v2.2 | 2026-04-27 | Notification UI fix, Import auto-rebuild, Dashboard churn panel |

---

# UYGULANAN DEĞİŞİKLİKLER KAYIT DEFTERİ

## v2.1 — 2026-04-26

### 1. AI Data Mapping Wizard (Import Center)

**Amaç:** Farklı kaynaklardan gelen Excel/CSV dosyalarındaki kolonların, RevenueOS'un iç veri modeline otomatik ve doğrulukla eşlenmesini sağlamak.

**Yeni Dosyalar:**
- `backend/src/services/mapping.service.ts` — Levenshtein fuzzy matching, TR/EN alias dictionary, data type detection, confidence scoring (0–100)
- `backend/src/routes/mapping.routes.ts` — `POST /mapping/analyze`, `GET /mapping/templates`, `POST /mapping/templates`, `DELETE /mapping/templates/:id`
- `frontend/src/app/(app)/import/MappingWizard.tsx` — 5 adımlı wizard: analyzing → mapping → preview → importing → done
- `supabase/migrations/012_mapping_templates.sql` — `mapping_templates` tablosu (tenant_id, name, source_system, column_map JSONB)

**Değiştirilen Dosyalar:**
- `backend/src/routes/index.ts` — `/mapping` route eklendi
- `frontend/src/lib/api.ts` — `analyzeMapping`, `getMappingTemplates`, `saveMappingTemplate`, `deleteMappingTemplate` metodları eklendi; `importExcel`, `importCsv`, `previewImport` metodlarına `mapping` parametresi eklendi
- `frontend/src/app/(app)/import/page.tsx` — Excel/CSV için MappingWizard tetikleniyor; XML direkt import akışında kalıyor

**Teknik Detaylar:**
- Algoritma: Tam eşleşme (95 puan) → içerik eşleşmesi (78 puan) → Levenshtein benzerlik ≥0.7 (70 puana kadar)
- 8 hedef alan: company_name, invoice_number, issue_date, amount, currency, service_start, service_end, product
- Şablonlar Supabase'de JSONB olarak saklanır, yeniden kullanılabilir
- Mapping `JSON.stringify` ile FormData üzerinden backend'e iletilir

---

### 2. React Hydration Error Fix

**Sorun:** "Text content does not match server-rendered HTML. Server: '' Client: 'Expansion'" hatası — Zustand persist middleware'inin SSR ile çakışması.

**Değiştirilen Dosyalar:**
- `frontend/src/lib/theme.ts`:
  - SSR-safe storage eklendi (`createJSONStorage` ile `window` undefined kontrolü)
  - `skipHydration: true` ile persist yapılandırıldı
  - `applyTheme` fonksiyonuna `if (typeof window === 'undefined') return` guard eklendi
- `frontend/src/app/providers.tsx`:
  - `ThemeInitializer` bileşeni `mounted` state pattern ile yeniden yazıldı
  - Tek ve merkezi `rehydrate()` çağrısı
- `frontend/src/components/layout/Sidebar.tsx`:
  - `mounted` state eklendi; tema bağımlı render'lar client-only
  - `suppressHydrationWarning` toggle butonuna eklendi
  - `pathname` null guard: `!!pathname && ...`

---

### 3. Batch Insert Bug Fix (product_id)

**Sorun:** "Batch insert error: Could not find the 'product_id' column of 'invoices' in the schema cache" — `invoices` tablosunun `product_id` kolonu yoktu.

**Değiştirilen Dosyalar:**
- `backend/src/services/import-excel.service.ts`:
  - `product_id: productId` fatura insert payload'ından kaldırıldı
  - "BATCH STEP 3: Resolve products in bulk" adımı tamamen silindi
  - Adım numaraları güncellendi (3→conflict check, 4→build payloads, 5→insert)

---

### 4. Bulk Delete (Toplu Silme)

**Amaç:** Tüm liste sayfalarında çoklu kayıt seçip toplu silme.

**Değiştirilen Sayfalar:** Companies, Products, Ledger, Events, Deals, Proposals, Contracts, Activities

**Özellikler:**
- Her satırda checkbox
- "Tümünü seç" header checkbox
- Seçili kayıt sayısını gösteren kırmızı "Delete Selected (N)" butonu
- `POST /[entity]/bulk` DELETE endpoint'i (id array alır)

---

### 5. Sayfa Boyutu Seçici (Page Size Selector)

**Amaç:** Tüm liste sayfalarında 25/50/100/200 kayıt/sayfa seçeneği.

**Değiştirilen Sayfalar:** Companies, Products, Ledger, Events, Deals, Proposals, Contracts, Activities (8 sayfa)

**Özellikler:**
- Pagination footer'ında `<select>` dropdown: 25/50/100/200
- Sayfa boyutu değişince page=1'e sıfırlanır
- Backend parametresi olarak `limit` query param ile iletilir

---

## v2.2 — 2026-04-27

### 6. Bildirim (Notification) UI Fix

**Sorun:** Notification dropdown 320px genişliğinde (`w-80`) açılıyor, sidebar 224px (`w-56`) — dropdown ekranın soluna taşıyor ve sayfa yarım görünüyor.

**Değiştirilen Dosyalar:**
- `frontend/src/components/layout/NotificationBell.tsx`:
  - Dropdown konumu `right-0` → `left-0` olarak değiştirildi
  - Dropdown artık sidebar'ın sağ kenarından ana içerik alanına doğru açılıyor

---

### 7. Companies / Products / Ledger — Sıralama ve Filtreleme

**Amaç:** Tüm liste sayfalarında tıklanabilir sütun başlıklarıyla sıralama (A→Z, Z→A, büyükten küçüğe, küçükten büyüğe).

**Backend Değişiklikleri:**

| Route | Yeni Parametreler | Sıralama Alanları |
|-------|------------------|-------------------|
| `GET /companies` | `sort`, `order`, `status` | `name`, `segment`, `country`, `industry`, `mrr`, `arr`, `churn_risk` |
| `GET /products` | `sort`, `order`, `search` | `name`, `sku`, `billing_period`, `pricing_model`, `category`, `default_price`, `status` |
| `GET /ledger` | `sort`, `order` | `month`, `company_name`, `event_type`, `amount_original`, `amount_reporting` |

- `backend/src/routes/companies.routes.ts`: Tüm sıralama alanları in-memory sort ile işlenir; `churn_risk` için `ml_scores` tablosu ek sorgu; `status` filtresi eklendi
- `backend/src/routes/products.routes.ts`: Supabase `.order()` ile native DB sort; `search` (ilike) filtresi eklendi
- `backend/src/routes/ledger.routes.ts`: Direct kolon sort için Supabase `.order()`; `company_name` için `referencedTable: 'companies'`

**Frontend Değişiklikleri:**
- `frontend/src/lib/api.ts`: `getCompanies` (`status`, `order`), `getLedger` (`sort`, `order`), `getProducts` (`sort`, `order`, `search`) parametreleri eklendi
- `frontend/src/app/(app)/companies/page.tsx`: `SortTh` bileşeni, `sortBy`/`sortDir` state, `handleSort` fonksiyonu; status filtresi backend'e iletiliyor
- `frontend/src/app/(app)/products/page.tsx`: `SortTh` bileşeni, arama kutusu, sort state
- `frontend/src/app/(app)/ledger/page.tsx`: `SortTh` bileşeni, sort state

**UI:** Aktif sütunda yön oku (▲/▼), pasif sütunlarda gri `⇅` ikonu; tıklamada yön tersine döner.

---

### 8. Import Sonrası Otomatik Ledger Rebuild

**Sorun:** Fatura import etmek yalnızca `invoices` tablosunu dolduruyor. Dashboard `revenue_ledger` tablosunu okuyor. Import sonrası rebuild manuel tetiklenmeden Şubat/Mart verileri dashboard'a yansımıyor.

**Kök Neden & Bug:** `rebuildLedger` tüm faturaları tarih filtresi olmadan işliyordu → aynı range iki kez rebuild edilince Şubat/Mart için çift kayıt oluşuyordu.

**Değiştirilen Dosyalar:**

`backend/src/services/revenue-recognition.service.ts`:
- Tarih aralığıyla örtüşen faturalar in-memory filter ile seçiliyor (`service_period_start ≤ toDate && service_period_end ≥ fromDate`)
- Ay aralığı bazlı DELETE yerine `source_id` bazlı DELETE — aynı fatura birden fazla rebuild edilse de çift kayıt oluşmaz
- 200'lü chunk'lar halinde toplu silme

`backend/src/routes/import.routes.ts`:
- `autoRebuildAfterImport(tenantId, fileId)` yardımcı fonksiyonu eklendi
- Import edilen faturaların tarih aralığı (min service_period_start, max service_period_end veya issue_date) otomatik hesaplanır
- Tenant ayarlarından `reporting_currency` ve `recognition_method` alınır
- `rebuildLedger` + `deriveEventsRange` arka planda (fire-and-forget) tetiklenir
- Excel, CSV ve XML import endpoint'lerinin tamamına eklendi
- Response'a `rebuild_triggered: true` eklendi

**Mevcut Veri İçin Tek Seferlik Adım:**
```
POST /ledger/rebuild
{ "from_month": "2026-01", "to_month": "2026-03" }
```

---

### 9. Dashboard — "Churned This Month" Paneli

**Amaç:** Seçili ay için bir önceki ayda fatura kesilmiş ama bu ay fatura kesilmemiş (churn eden) şirketlerin adedini, ciro kaybını ve listesini dashboard'da belirgin şekilde göstermek.

**Değiştirilen Dosyalar:**
- `frontend/src/app/(app)/dashboard/page.tsx`:
  - Yeni `churnedCompaniesData` query eklendi (`/metrics/churn_mrr/drilldown?month=...`, her zaman aktif)
  - KPI kartlarının hemen altına "Churned — [Ay Adı]" paneli eklendi:
    - Kırmızı çerçeveli card
    - Header: Şirket sayısı + toplam MRR kaybı
    - Tablo: #, Şirket adı (şirket sayfasına link), MRR kaybı (büyükten küçüğe sıralı)
    - Scrollable (max 64 yükseklik), churned şirket yoksa görünmez

**Teknik Not:** Veriler mevcut `GET /metrics/churn_mrr/drilldown` endpoint'inden gelir; yeni backend endpoint gerekmez. CHURN event'i = önceki ay MRR > 0 olan ama bu ay MRR = 0 olan şirket.

---

## Supabase Migration Geçmişi

| Migration | Tarih | İçerik |
|-----------|-------|--------|
| 001_initial_schema | 2026-03 | Core tables |
| 002_revenue_engine | 2026-03 | revenue_ledger, revenue_events |
| 003-009 | 2026-03 | Additional entities |
| 010_security_fixes | 2026-04 | RLS policies, security hardening |
| 011_security_warnings | 2026-04 | Additional security warnings |
| 012_mapping_templates | 2026-04 | AI mapping template storage |

---
*Bu doküman RevenueOS geliştirme ekibi için oluşturulmuştur.*
*Tüm hakları saklıdır. © 2026*
