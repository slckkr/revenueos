// ─── Core Domain Types ─────────────────────────────────────────────────────

export type EventType =
  | 'NEW'
  | 'EXPANSION'
  | 'CONTRACTION'
  | 'CHURN'
  | 'REACTIVATION'
  | 'PRICE_INCREASE'

export type RecognitionMethod = 'accrual' | 'cash'

export type SourceType = 'invoice' | 'subscription' | 'hubspot_deal' | 'manual'

export type BillingPeriod = 'monthly' | 'annual' | 'one_time'

export type SubscriptionStatus = 'active' | 'churned' | 'paused'

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void'

export type InvoiceSourceType = 'hubspot' | 'logo_import' | 'excel_import' | 'manual'

export type ImportSource = 'excel' | 'csv' | 'xml_logo'

export type ImportStatus = 'pending' | 'processing' | 'done' | 'error'

export type SyncStatus = 'running' | 'done' | 'error'

export type CompanySegment = 'SMB' | 'MID' | 'ENT'

// ─── Database Entity Types ──────────────────────────────────────────────────

export interface Settings {
  id: string
  tenant_id: string
  reporting_currency: string
  recognition_method: RecognitionMethod
  hubspot_token_encrypted: string | null
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  tenant_id: string
  name: string
  domain: string | null
  external_id: string | null
  hubspot_id: string | null
  segment: CompanySegment | null
  created_at: string
}

export interface Contact {
  id: string
  tenant_id: string
  company_id: string | null
  name: string
  email: string | null
  hubspot_id: string | null
  created_at: string
}

export interface Product {
  id: string
  tenant_id: string
  name: string
  sku: string | null
  billing_period: BillingPeriod
  created_at: string
}

export interface Subscription {
  id: string
  tenant_id: string
  company_id: string
  product_id: string | null
  status: SubscriptionStatus
  start_date: string
  end_date: string | null
  mrr_amount: number
  currency: string
  created_at: string
}

export interface Invoice {
  id: string
  tenant_id: string
  company_id: string
  invoice_number: string
  issue_date: string
  due_date: string | null
  service_period_start: string | null
  service_period_end: string | null
  total_amount: number
  currency: string
  status: InvoiceStatus
  source_type: InvoiceSourceType
  hubspot_deal_id: string | null
  import_file_id: string | null
  created_at: string
}

export interface InvoiceLine {
  id: string
  invoice_id: string
  product_id: string | null
  description: string | null
  quantity: number
  unit_price: number
  total_price: number
  currency: string
}

export interface FxRate {
  id: string
  date: string
  from_currency: string
  to_currency: string
  rate: number
  source: string
}

export interface ImportFile {
  id: string
  tenant_id: string
  source: ImportSource
  filename: string
  status: ImportStatus
  records_imported: number
  errors_json: Record<string, unknown>[] | null
  created_at: string
  created_by: string | null
}

export interface RevenueLedgerEntry {
  id: string
  tenant_id: string
  company_id: string
  product_id: string | null
  month: string           // ISO date, always 1st of month: 2024-01-01
  event_type: EventType
  amount_original: number
  currency: string
  fx_rate: number
  amount_reporting: number
  recognition_method: RecognitionMethod
  source_type: SourceType
  source_id: string | null
  created_at: string
}

export interface RevenueEvent {
  id: string
  tenant_id: string
  company_id: string
  product_id: string | null
  month: string
  event_type: EventType
  mrr_impact: number      // signed: positive = growth, negative = churn/contraction
  prev_mrr: number
  new_mrr: number
  created_at: string
}

export interface HubSpotSyncLog {
  id: string
  tenant_id: string
  synced_at: string
  status: SyncStatus
  companies_synced: number
  contacts_synced: number
  deals_synced: number
  error_message: string | null
}

// ─── Metric Types ───────────────────────────────────────────────────────────

export interface MetricsSummary {
  month: string
  mrr: number
  arr: number
  new_mrr: number
  expansion_mrr: number
  contraction_mrr: number
  churned_mrr: number
  reactivation_mrr: number
  price_increase_mrr: number
  net_new_mrr: number
  nrr: number           // percentage, e.g. 112 = 112%
  grr: number           // percentage, max 100
  quick_ratio: number
  logo_churn_rate: number     // percentage
  revenue_churn_rate: number  // percentage
  active_customers: number
  churned_customers: number
}

export interface MrrHistoryPoint {
  month: string
  mrr: number
  arr: number
  new_mrr: number
  expansion_mrr: number
  contraction_mrr: number
  churned_mrr: number
  net_new_mrr: number
  nrr: number
  active_customers: number
}

export interface NetNewMrrBreakdown {
  month: string
  new_mrr: number
  expansion_mrr: number
  reactivation_mrr: number
  contraction_mrr: number   // negative
  churned_mrr: number       // negative
  net_new_mrr: number
}

export interface AnomalyFlag {
  type: string
  severity: 'critical' | 'warning' | 'info'
  metric: string
  value: number
  threshold: number
  message: string
  explanation: string
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true
  data: T
  meta?: {
    total?: number
    page?: number
    limit?: number
  }
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
  }
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError

// ─── HubSpot Types ──────────────────────────────────────────────────────────

export interface HubSpotCompany {
  id: string
  properties: {
    name: string
    domain: string | null
    hs_object_id: string
    [key: string]: unknown
  }
}

export interface HubSpotContact {
  id: string
  properties: {
    firstname: string | null
    lastname: string | null
    email: string | null
    associatedcompanyid: string | null
    [key: string]: unknown
  }
}

export interface HubSpotDeal {
  id: string
  properties: {
    dealname: string
    amount: string | null
    closedate: string | null
    dealstage: string
    pipeline: string
    hs_object_id: string
    [key: string]: unknown
  }
  associations?: {
    companies?: { results: Array<{ id: string }> }
  }
}
