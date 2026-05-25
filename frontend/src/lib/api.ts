const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('revenueos_token')
}

export function setToken(token: string) {
  localStorage.setItem('revenueos_token', token)
}

export function clearToken() {
  localStorage.removeItem('revenueos_token')
}

export async function fetchJSON<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  const data = await res.json()

  if (!res.ok) {
    if (res.status === 401) {
      clearToken()
      window.location.href = '/login'
    }
    throw new Error(data?.error?.message || `HTTP ${res.status}`)
  }

  return data as T
}

export async function uploadFile(
  path: string,
  file: File,
  extraFields?: Record<string, string>
): Promise<unknown> {
  const token = getToken()
  const formData = new FormData()
  formData.append('file', file)

  if (extraFields) {
    Object.entries(extraFields).forEach(([key, value]) => {
      formData.append(key, value)
    })
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
  return data
}

export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── API functions ────────────────────────────────────────────────────────────

export const api = {
  // Auth
  login: (username: string, password: string) =>
    fetchJSON<{ success: true; data: { token: string; user: { username: string } } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) }
    ),

  // Metrics
  getMetricsSummary: (month?: string) =>
    fetchJSON<{ success: true; data: MetricsSummary }>(
      `/metrics/summary${month ? `?month=${month}` : ''}`
    ),

  getMrrHistory: (months = 12) =>
    fetchJSON<{ success: true; data: MrrHistoryPoint[] }>(
      `/metrics/mrr-history?months=${months}`
    ),

  getNetNewMrr: (month?: string) =>
    fetchJSON<{ success: true; data: NetNewMrrBreakdown }>(
      `/metrics/net-new-mrr${month ? `?month=${month}` : ''}`
    ),

  getAnomalies: (month?: string) =>
    fetchJSON<{ success: true; data: AnomalyFlag[] }>(
      `/metrics/anomalies${month ? `?month=${month}` : ''}`
    ),

  getChurnRates: (months = 24) =>
    fetchJSON<{
      success: true; data: {
        monthly: Array<{
          month: string; logo_churn_rate: number; revenue_churn_rate: number
          churned_count: number; churned_mrr: number; prev_active_count: number; prev_mrr: number
          companies: Array<{ id: string; name: string; mrr_lost: number }>
        }>
        annual: Array<{
          year: number; logo_churn_rate: number; revenue_churn_rate: number
          churned_count: number; churned_mrr: number; avg_churned_mrr: number
          companies: Array<{ id: string; name: string; mrr_lost: number; month: string }>
        }>
      }
    }>(`/metrics/churn-rates?months=${months}`),

  // Companies
  getCompanies: (params?: {
    search?: string; segment?: string; status?: string; lifecycle_stage?: string
    city?: string; industry?: string; iso500?: boolean; capital_type?: string
    min_employees?: number; max_employees?: number
    min_net_sales?: number; max_net_sales?: number
    page?: number; sort?: string; order?: string; limit?: number
  }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.segment) qs.set('segment', params.segment)
    if (params?.status) qs.set('status', params.status)
    if (params?.lifecycle_stage) qs.set('lifecycle_stage', params.lifecycle_stage)
    if (params?.city) qs.set('city', params.city)
    if (params?.industry) qs.set('industry', params.industry)
    if (params?.iso500) qs.set('iso500', 'true')
    if (params?.capital_type) qs.set('capital_type', params.capital_type)
    if (params?.min_employees != null) qs.set('min_employees', String(params.min_employees))
    if (params?.max_employees != null) qs.set('max_employees', String(params.max_employees))
    if (params?.min_net_sales != null) qs.set('min_net_sales', String(params.min_net_sales))
    if (params?.max_net_sales != null) qs.set('max_net_sales', String(params.max_net_sales))
    if (params?.page) qs.set('page', String(params.page))
    if (params?.sort) qs.set('sort', params.sort)
    if (params?.order) qs.set('order', params.order)
    if (params?.limit) qs.set('limit', String(params.limit))
    return fetchJSON<{ success: true; data: Company[]; meta: { total: number; page: number; limit: number } }>(
      `/companies?${qs}`
    )
  },

  getCompany: (id: string) =>
    fetchJSON<{ success: true; data: Company & { mrr_history: LedgerEntry[]; recent_events: RevenueEvent[]; invoices: Invoice[] } }>(
      `/companies/${id}`
    ),
  createCompany: (data: Partial<Company>) =>
    fetchJSON<{ success: true; data: Company }>('/companies', { method: 'POST', body: JSON.stringify(data) }),
  updateCompany: (id: string, data: Partial<Company>) =>
    fetchJSON<{ success: true; data: Company }>(`/companies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCompany: (id: string) =>
    fetchJSON<{ success: true }>(`/companies/${id}`, { method: 'DELETE' }),
  bulkUpdateLifecycle: (ids: string[], lifecycle_stage: string) =>
    fetchJSON<{ success: true; updated: number }>('/companies/bulk/lifecycle', { method: 'PATCH', body: JSON.stringify({ ids, lifecycle_stage }) }),
  bulkDeleteCompanies: (ids: string[]) =>
    fetchJSON<{ success: true; deleted: number }>('/companies/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),

  // Ledger
  getLedger: (params?: { month?: string; company_id?: string; event_type?: string; page?: number; limit?: number; sort?: string; order?: string }) => {
    const qs = new URLSearchParams()
    if (params?.month) qs.set('month', params.month)
    if (params?.company_id) qs.set('company_id', params.company_id)
    if (params?.event_type) qs.set('event_type', params.event_type)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.sort) qs.set('sort', params.sort)
    if (params?.order) qs.set('order', params.order)
    return fetchJSON<{ success: true; data: LedgerEntry[]; meta: { total: number } }>(
      `/ledger?${qs}`
    )
  },

  createLedgerEntry: (data: Partial<LedgerEntry> & { company_id: string; month: string; event_type: string; amount_original: number }) =>
    fetchJSON<{ success: true; data: LedgerEntry }>('/ledger', { method: 'POST', body: JSON.stringify(data) }),
  updateLedgerEntry: (id: string, data: Partial<LedgerEntry>) =>
    fetchJSON<{ success: true; data: LedgerEntry }>(`/ledger/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLedgerEntry: (id: string) =>
    fetchJSON<{ success: true }>(`/ledger/${id}`, { method: 'DELETE' }),
  bulkDeleteLedger: (ids: string[]) =>
    fetchJSON<{ success: true; deleted: number }>('/ledger/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),

  rebuildLedger: (from_month: string, to_month: string) =>
    fetchJSON('/ledger/rebuild', {
      method: 'POST',
      body: JSON.stringify({ from_month, to_month }),
    }),

  // HubSpot
  syncHubSpot: () => fetchJSON('/hubspot/sync', { method: 'POST' }),
  getHubSpotStatus: () => fetchJSON('/hubspot/sync/status'),
  getHubSpotLogs: () => fetchJSON<{ success: true; data: HubSpotSyncLog[] }>('/hubspot/sync/logs'),

  // Settings
  getSettings: () =>
    fetchJSON<{ success: true; data: Settings }>('/settings'),
  updateSettings: (data: Partial<Settings & { hubspot_token?: string }>) =>
    fetchJSON('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  testHubSpotToken: () =>
    fetchJSON('/settings/hubspot/test', { method: 'POST' }),

  // Import
  getImportFiles: () =>
    fetchJSON<{ success: true; data: ImportFile[] }>('/import/files'),
  importExcel: (file: File, conflictMode: 'skip' | 'overwrite' = 'skip', mapping?: Record<string, string>) =>
    uploadFile('/import/excel', file, { conflict_mode: conflictMode, ...(mapping ? { mapping: JSON.stringify(mapping) } : {}) }),
  importCsv: (file: File, conflictMode: 'skip' | 'overwrite' = 'skip', mapping?: Record<string, string>) =>
    uploadFile('/import/csv', file, { conflict_mode: conflictMode, ...(mapping ? { mapping: JSON.stringify(mapping) } : {}) }),
  importXml: (file: File) => uploadFile('/import/xml', file),
  previewImport: (file: File, source: 'excel' | 'csv', mapping?: Record<string, string>) =>
    uploadFile('/import/preview', file, { source, ...(mapping ? { mapping: JSON.stringify(mapping) } : {}) }),
  deleteImport: (id: string) =>
    fetchJSON<{ success: true; data: { message: string; deleted_invoices: number } }>(
      `/import/files/${id}`,
      { method: 'DELETE' }
    ),

  // Products
  getProducts: (params?: { page?: number; limit?: number; sort?: string; order?: string; search?: string }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.sort) qs.set('sort', params.sort)
    if (params?.order) qs.set('order', params.order)
    if (params?.search) qs.set('search', params.search)
    const q = qs.toString()
    return fetchJSON<{ success: true; data: Product[]; meta: { total: number } }>(`/products${q ? `?${q}` : ''}`)
  },
  createProduct: (data: Partial<Product>) =>
    fetchJSON<{ success: true; data: Product }>('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: Partial<Product>) =>
    fetchJSON<{ success: true; data: Product }>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProduct: (id: string) =>
    fetchJSON<{ success: true }>(`/products/${id}`, { method: 'DELETE' }),
  bulkDeleteProducts: (ids: string[]) =>
    fetchJSON<{ success: true; deleted: number }>('/products/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),

  // Contacts
  getContacts: (params?: { company_id?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.company_id) qs.set('company_id', params.company_id)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    return fetchJSON<{ success: true; data: Contact[]; meta: { total: number } }>(`/contacts?${qs}`)
  },
  createContact: (data: Partial<Contact>) =>
    fetchJSON<{ success: true; data: Contact }>('/contacts', { method: 'POST', body: JSON.stringify(data) }),
  updateContact: (id: string, data: Partial<Contact>) =>
    fetchJSON<{ success: true; data: Contact }>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteContact: (id: string) =>
    fetchJSON<{ success: true; data: { message: string } }>(`/contacts/${id}`, { method: 'DELETE' }),

  // Payments
  getPayments: (params?: { company_id?: string; page?: number }) => {
    const qs = new URLSearchParams()
    if (params?.company_id) qs.set('company_id', params.company_id)
    if (params?.page) qs.set('page', String(params.page))
    return fetchJSON<{ success: true; data: Payment[]; meta: { total: number } }>(`/payments?${qs}`)
  },
  createPayment: (data: Partial<Payment>) =>
    fetchJSON<{ success: true; data: Payment }>('/payments', { method: 'POST', body: JSON.stringify(data) }),
  deletePayment: (id: string) =>
    fetchJSON<{ success: true; data: { message: string } }>(`/payments/${id}`, { method: 'DELETE' }),

  // Roles
  getRoles: () =>
    fetchJSON<{ success: true; data: Role[] }>('/roles'),

  // Integrations
  getIntegrations: () =>
    fetchJSON<{ success: true; data: Integration[] }>('/integrations'),
  updateIntegration: (provider: string, data: Partial<Integration>) =>
    fetchJSON<{ success: true; data: Integration }>(`/integrations/${provider}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Segments
  getSegments: () =>
    fetchJSON<{ success: true; data: Segment[] }>('/segments'),

  // Revenue Events
  getRevenueEvents: (params?: { month?: string; company_id?: string; event_type?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.month) qs.set('month', params.month)
    if (params?.company_id) qs.set('company_id', params.company_id)
    if (params?.event_type) qs.set('event_type', params.event_type)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    return fetchJSON<{ success: true; data: RevenueEvent[]; meta: { total: number } }>(`/revenue-events?${qs}`)
  },
  createRevenueEvent: (data: Partial<RevenueEvent>) =>
    fetchJSON<{ success: true; data: RevenueEvent }>('/revenue-events', { method: 'POST', body: JSON.stringify(data) }),
  updateRevenueEvent: (id: string, data: Partial<RevenueEvent>) =>
    fetchJSON<{ success: true; data: RevenueEvent }>(`/revenue-events/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRevenueEvent: (id: string) =>
    fetchJSON<{ success: true }>(`/revenue-events/${id}`, { method: 'DELETE' }),
  bulkDeleteRevenueEvents: (ids: string[]) =>
    fetchJSON<{ success: true; deleted: number }>('/revenue-events/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),

  // Phase 2: MRR Bridge
  getMrrBridge: (month?: string) =>
    fetchJSON<{ success: true; data: MrrBridge }>(
      `/metrics/mrr-bridge${month ? `?month=${month}` : ''}`
    ),

  // Phase 2: Segment breakdown
  getSegmentBreakdown: (month?: string) =>
    fetchJSON<{ success: true; data: SegmentBreakdown[] }>(
      `/metrics/segment-breakdown${month ? `?month=${month}` : ''}`
    ),

  // Phase 2: Metric drill-down
  getMetricDrilldown: (key: string, month?: string) =>
    fetchJSON<{ success: true; data: MetricDrilldown }>(
      `/metrics/${key}/drilldown${month ? `?month=${month}` : ''}`
    ),

  // Phase 2: Reconciliation
  getReconciliationIssues: (status?: string) =>
    fetchJSON<{ success: true; data: ReconciliationIssue[] }>(
      `/reconciliation/issues${status ? `?status=${status}` : ''}`
    ),
  runReconciliationScan: () =>
    fetchJSON<{ success: true; data: { scanned: number; issues_found: number } }>(
      '/reconciliation/scan',
      { method: 'POST' }
    ),
  resolveReconciliationIssue: (id: string) =>
    fetchJSON<{ success: true }>(`/reconciliation/issues/${id}/resolve`, { method: 'PUT' }),
  ignoreReconciliationIssue: (id: string) =>
    fetchJSON<{ success: true }>(`/reconciliation/issues/${id}/ignore`, { method: 'PUT' }),

  // Export
  downloadTemplate: () => downloadFile('/export/template', 'revenueos-import-template.xlsx'),
  exportCompanies: () => downloadFile('/export/companies', 'companies.xlsx'),
  exportInvoices: (month?: string) =>
    downloadFile(`/export/invoices${month ? `?month=${month}` : ''}`, month ? `invoices-${month}.xlsx` : 'invoices.xlsx'),
  exportLedger: (month?: string) =>
    downloadFile(`/export/ledger${month ? `?month=${month}` : ''}`, month ? `ledger-${month}.xlsx` : 'ledger.xlsx'),

  // Phase 3: Financial Inputs
  downloadFinancialInputsTemplate: () =>
    downloadFile('/financial-inputs/template', 'financial-inputs-template.xlsx'),
  exportFinancialInputs: () =>
    downloadFile('/financial-inputs/export', 'financial-inputs-export.xlsx'),
  importFinancialInputs: (file: File) =>
    uploadFile('/financial-inputs/import', file) as Promise<{
      success: true
      data: { imported: number; skipped: number; errors: Array<{ row: number; message: string }> }
    }>,

  getFinancialInputs: (from?: string, to?: string) => {
    const qs = new URLSearchParams()
    if (from) qs.set('from', from)
    if (to) qs.set('to', to)
    return fetchJSON<{ success: true; data: FinancialInput[] }>(`/financial-inputs?${qs}`)
  },
  getFinancialInputForMonth: (month: string) =>
    fetchJSON<{ success: true; data: FinancialInput | null }>(`/financial-inputs/${month}`),
  upsertFinancialInput: (month: string, data: Partial<FinancialInput>) =>
    fetchJSON<{ success: true; data: FinancialInput }>('/financial-inputs', {
      method: 'POST',
      body: JSON.stringify({ month, ...data }),
    }),
  deleteFinancialInput: (id: string) =>
    fetchJSON<{ success: true }>(`/financial-inputs/${id}`, { method: 'DELETE' }),

  // Phase 3: Advanced Metrics
  getAdvancedMetrics: (month?: string) =>
    fetchJSON<{ success: true; data: AdvancedMetrics }>(
      `/advanced-metrics${month ? `?month=${month}` : ''}`
    ),

  // Phase 3: Product Metrics
  getAllProductMetrics: (month?: string) =>
    fetchJSON<{ success: true; data: ProductMetrics[] }>(
      `/product-metrics${month ? `?month=${month}` : ''}`
    ),
  getProductMetrics: (productId: string, month?: string) =>
    fetchJSON<{ success: true; data: ProductMetrics }>(
      `/product-metrics/${productId}${month ? `?month=${month}` : ''}`
    ),
  getProductCompanies: (productId: string, month?: string) =>
    fetchJSON<{ success: true; data: ProductCompany[] }>(
      `/product-metrics/${productId}/companies${month ? `?month=${month}` : ''}`
    ),
  getCrossSellMatrix: () =>
    fetchJSON<{ success: true; data: CrossSellEntry[] }>('/product-metrics/cross-sell'),

  // Phase 3: Data Health
  getDataHealth: () =>
    fetchJSON<{ success: true; data: DataHealthSnapshot }>('/data-health'),
  computeDataHealth: () =>
    fetchJSON<{ success: true; data: DataHealthSnapshot }>('/data-health/compute', { method: 'POST' }),
  getDataHealthHistory: (days = 30) =>
    fetchJSON<{ success: true; data: Array<{ date: string; score: number }> }>(`/data-health/history?days=${days}`),

  // Phase 4: Deals
  getDeals: (params?: { status?: string; stage?: string; company_id?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.stage) qs.set('stage', params.stage)
    if (params?.company_id) qs.set('company_id', params.company_id)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    return fetchJSON<{ success: true; data: Deal[]; meta: { total: number } }>(`/deals?${qs}`)
  },
  getDealsPipeline: () =>
    fetchJSON<{ success: true; data: Record<string, { deals: Deal[]; total_value: number; count: number }>; metrics: PipelineMetrics }>('/deals/pipeline'),
  getDealMetrics: () =>
    fetchJSON<{ success: true; data: DealMetrics }>('/deals/metrics'),
  createDeal: (data: Partial<Deal>) =>
    fetchJSON<{ success: true; data: Deal }>('/deals', { method: 'POST', body: JSON.stringify(data) }),
  updateDeal: (id: string, data: Partial<Deal>) =>
    fetchJSON<{ success: true; data: Deal }>(`/deals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDeal: (id: string) =>
    fetchJSON<{ success: true }>(`/deals/${id}`, { method: 'DELETE' }),
  bulkDeleteDeals: (ids: string[]) =>
    fetchJSON<{ success: true; deleted: number }>('/deals/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),

  // Phase 4: Proposals
  getProposals: (params?: { company_id?: string; status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.company_id) qs.set('company_id', params.company_id)
    if (params?.status) qs.set('status', params.status)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    return fetchJSON<{ success: true; data: Proposal[]; meta: { total: number } }>(`/proposals?${qs}`)
  },
  createProposal: (data: Partial<Proposal>) =>
    fetchJSON<{ success: true; data: Proposal }>('/proposals', { method: 'POST', body: JSON.stringify(data) }),
  updateProposal: (id: string, data: Partial<Proposal>) =>
    fetchJSON<{ success: true; data: Proposal }>(`/proposals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProposal: (id: string) =>
    fetchJSON<{ success: true }>(`/proposals/${id}`, { method: 'DELETE' }),
  bulkDeleteProposals: (ids: string[]) =>
    fetchJSON<{ success: true; deleted: number }>('/proposals/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),

  // Phase 4: Contracts
  getContracts: (params?: { company_id?: string; status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.company_id) qs.set('company_id', params.company_id)
    if (params?.status) qs.set('status', params.status)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    return fetchJSON<{ success: true; data: Contract[]; meta: { total: number } }>(`/contracts?${qs}`)
  },
  getUpcomingRenewals: (days = 30) =>
    fetchJSON<{ success: true; data: Contract[] }>(`/contracts/upcoming?days=${days}`),
  createContract: (data: Partial<Contract>) =>
    fetchJSON<{ success: true; data: Contract }>('/contracts', { method: 'POST', body: JSON.stringify(data) }),
  updateContract: (id: string, data: Partial<Contract>) =>
    fetchJSON<{ success: true; data: Contract }>(`/contracts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteContract: (id: string) =>
    fetchJSON<{ success: true }>(`/contracts/${id}`, { method: 'DELETE' }),
  bulkDeleteContracts: (ids: string[]) =>
    fetchJSON<{ success: true; deleted: number }>('/contracts/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),

  // Phase 4: Activities
  getActivities: (params?: { company_id?: string; deal_id?: string; type?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.company_id) qs.set('company_id', params.company_id)
    if (params?.deal_id) qs.set('deal_id', params.deal_id)
    if (params?.type) qs.set('type', params.type)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    return fetchJSON<{ success: true; data: ActivityItem[]; meta: { total: number } }>(`/activities?${qs}`)
  },
  createActivity: (data: Partial<ActivityItem>) =>
    fetchJSON<{ success: true; data: ActivityItem }>('/activities', { method: 'POST', body: JSON.stringify(data) }),
  deleteActivity: (id: string) =>
    fetchJSON<{ success: true }>(`/activities/${id}`, { method: 'DELETE' }),
  bulkDeleteActivities: (ids: string[]) =>
    fetchJSON<{ success: true; deleted: number }>('/activities/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),

  // Phase 4: Funnel
  getFunnelStages: () =>
    fetchJSON<{ success: true; data: FunnelStage[] }>('/funnel/stages'),
  getFunnelAnalysis: (params?: { from?: string; to?: string; product_id?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.product_id) qs.set('product_id', params.product_id)
    return fetchJSON<{ success: true; data: FunnelStageResult[] }>(`/funnel/analysis?${qs}`)
  },

  // Phase 4: Cohorts
  getAcquisitionCohorts: (months = 12) =>
    fetchJSON<{ success: true; data: AcquisitionCohort[] }>(`/cohorts/acquisition?months=${months}`),
  getRevenueCohorts: (months = 12) =>
    fetchJSON<{ success: true; data: RevenueCohort[] }>(`/cohorts/revenue?months=${months}`),

  // Phase 5: Scores (Expansion & Health)
  getScores: (params?: { score_type?: string; month?: string; company_id?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.score_type) qs.set('score_type', params.score_type)
    if (params?.month) qs.set('month', params.month)
    if (params?.company_id) qs.set('company_id', params.company_id)
    if (params?.limit) qs.set('limit', String(params.limit))
    return fetchJSON<{ success: true; data: AccountScore[] }>(`/scores?${qs}`)
  },
  computeScores: (params?: { score_type?: string; month?: string }) =>
    fetchJSON<{ success: true; computed: number; notifications_created: number; month: string }>(
      '/scores/compute', { method: 'POST', body: JSON.stringify(params || {}) }
    ),
  computeCompanyScores: (companyId: string) =>
    fetchJSON<{ success: true; expansion: { score: number; reasons: string[] }; health: { score: number; reasons: string[] } }>(
      `/scores/compute/${companyId}`, { method: 'POST' }
    ),

  // Phase 5: Playbooks
  getPlaybooks: (active?: boolean) =>
    fetchJSON<{ success: true; data: Playbook[] }>(`/playbooks${active ? '?active=true' : ''}`),
  createPlaybook: (data: Partial<Playbook>) =>
    fetchJSON<{ success: true; data: Playbook }>('/playbooks', { method: 'POST', body: JSON.stringify(data) }),
  updatePlaybook: (id: string, data: Partial<Playbook>) =>
    fetchJSON<{ success: true; data: Playbook }>(`/playbooks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePlaybook: (id: string) =>
    fetchJSON<{ success: true }>(`/playbooks/${id}`, { method: 'DELETE' }),
  getPlaybookTriggers: (playbookId?: string) =>
    fetchJSON<{ success: true; data: PlaybookTrigger[] }>(`/playbooks/triggers${playbookId ? `?playbook_id=${playbookId}` : ''}`),
  firePlaybook: (id: string, params?: { company_id?: string; trigger_value?: number }) =>
    fetchJSON<{ success: true; playbook_name: string; actions: string[] }>(
      `/playbooks/${id}/trigger`, { method: 'POST', body: JSON.stringify(params || {}) }
    ),

  // Phase 5: Notifications
  getNotifications: (params?: { unread_only?: boolean; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.unread_only) qs.set('unread_only', 'true')
    if (params?.limit) qs.set('limit', String(params.limit))
    return fetchJSON<{ success: true; data: Notification[]; unread_count: number }>(`/notifications?${qs}`)
  },
  getNotificationCount: () =>
    fetchJSON<{ success: true; count: number }>('/notifications/count'),
  markNotificationRead: (id: string) =>
    fetchJSON<{ success: true }>(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () =>
    fetchJSON<{ success: true }>('/notifications/read-all', { method: 'PUT' }),
  deleteNotification: (id: string) =>
    fetchJSON<{ success: true }>(`/notifications/${id}`, { method: 'DELETE' }),

  // Phase 5: Notes
  getNotes: (params: { object_type: string; object_id: string }) =>
    fetchJSON<{ success: true; data: Note[] }>(`/notes?object_type=${params.object_type}&object_id=${params.object_id}`),
  createNote: (data: { object_type: string; object_id: string; body: string }) =>
    fetchJSON<{ success: true; data: Note }>('/notes', { method: 'POST', body: JSON.stringify(data) }),
  updateNote: (id: string, body: string) =>
    fetchJSON<{ success: true; data: Note }>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify({ body }) }),
  deleteNote: (id: string) =>
    fetchJSON<{ success: true }>(`/notes/${id}`, { method: 'DELETE' }),

  // Phase 5: Tasks
  getTasks: (params?: { object_type?: string; object_id?: string; status?: string; priority?: string }) => {
    const qs = new URLSearchParams()
    if (params?.object_type) qs.set('object_type', params.object_type)
    if (params?.object_id) qs.set('object_id', params.object_id)
    if (params?.status) qs.set('status', params.status)
    if (params?.priority) qs.set('priority', params.priority)
    return fetchJSON<{ success: true; data: Task[] }>(`/tasks?${qs}`)
  },
  createTask: (data: Partial<Task>) =>
    fetchJSON<{ success: true; data: Task }>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: Partial<Task>) =>
    fetchJSON<{ success: true; data: Task }>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (id: string) =>
    fetchJSON<{ success: true }>(`/tasks/${id}`, { method: 'DELETE' }),

  // Phase 5: Usage Events
  getUsageEvents: (params?: { company_id?: string; product_id?: string; from?: string; to?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.company_id) qs.set('company_id', params.company_id)
    if (params?.product_id) qs.set('product_id', params.product_id)
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    if (params?.limit) qs.set('limit', String(params.limit))
    return fetchJSON<{ success: true; data: UsageEvent[] }>(`/usage-events?${qs}`)
  },
  getUsageEventsSummary: (companyId: string) =>
    fetchJSON<{ success: true; data: UsageEventSummary[]; total_30d: number }>(`/usage-events/summary?company_id=${companyId}`),
  createUsageEvents: (events: Partial<UsageEvent> | Partial<UsageEvent>[]) =>
    fetchJSON<{ success: true; data: UsageEvent[]; count: number }>('/usage-events', { method: 'POST', body: JSON.stringify(events) }),

  // Phase 5: Slack
  getSlackConnection: () =>
    fetchJSON<{ success: true; data: SlackConnection | null }>('/slack'),
  connectSlack: (data: { webhook_url: string; channel_default?: string }) =>
    fetchJSON<{ success: true; data: SlackConnection }>('/slack/connect', { method: 'POST', body: JSON.stringify(data) }),
  testSlack: () =>
    fetchJSON<{ success: true; message: string }>('/slack/test', { method: 'POST' }),
  disconnectSlack: () =>
    fetchJSON<{ success: true }>('/slack/disconnect', { method: 'DELETE' }),

  // Phase 6: Churn Risk
  getChurnRisk: (params?: { month?: string; min_score?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.month) qs.set('month', params.month)
    if (params?.min_score) qs.set('min_score', String(params.min_score))
    if (params?.limit) qs.set('limit', String(params.limit))
    return fetchJSON<{ success: true; data: ChurnRiskScore[] }>(`/churn-risk?${qs}`)
  },
  computeChurnRisk: (companyId?: string) =>
    companyId
      ? fetchJSON<{ success: true; score: number; risk_category: string; reasons: string[] }>(`/churn-risk/compute/${companyId}`, { method: 'POST' })
      : fetchJSON<{ success: true; computed: number; notifications_created: number }>('/churn-risk/compute', { method: 'POST' }),

  // Phase 6: Forecast
  getForecast: (months = 3) =>
    fetchJSON<{ actual: ForecastPoint[]; forecasted: ForecastedPoint[]; summary: ForecastSummary }>(`/forecast/revenue?months=${months}`),

  // Phase 6: Benchmarks
  getBenchmarks: (cohort = 'global:saas') =>
    fetchJSON<{ success: true; data: BenchmarkRow[] }>(`/benchmarks?cohort=${cohort}`),
  getBenchmarkCohorts: () =>
    fetchJSON<{ success: true; data: BenchmarkCohort[] }>('/benchmarks/cohorts'),
  getBenchmarkOptIn: () =>
    fetchJSON<{ success: true; data: { enabled: boolean } }>('/benchmarks/opt-in'),
  setBenchmarkOptIn: (enabled: boolean) =>
    fetchJSON<{ success: true; data: { enabled: boolean } }>('/benchmarks/opt-in', { method: 'POST', body: JSON.stringify({ enabled }) }),

  // Phase 6: Board Snapshot
  getBoardSnapshot: (month?: string) =>
    fetchJSON<{ success: true; data: BoardSnapshot }>(`/reports/board-snapshot${month ? `?month=${month}` : ''}`),

  // AI Mapping
  analyzeMapping: (file: File) =>
    uploadFile('/mapping/analyze', file) as Promise<{ success: true; data: AnalyzeResult }>,
  getMappingTemplates: () =>
    fetchJSON<{ success: true; data: MappingTemplate[] }>('/mapping/templates'),
  saveMappingTemplate: (name: string, sourceSystem: string | null, columnMap: Record<string, string>) =>
    fetchJSON<{ success: true; data: MappingTemplate }>('/mapping/templates', {
      method: 'POST',
      body: JSON.stringify({ name, source_system: sourceSystem, column_map: columnMap }),
    }),
  deleteMappingTemplate: (id: string) =>
    fetchJSON(`/mapping/templates/${id}`, { method: 'DELETE' }),
}

// ─── Types (mirroring backend) ────────────────────────────────────────────────

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
  nrr: number
  grr: number
  quick_ratio: number
  logo_churn_rate: number
  revenue_churn_rate: number
  active_customers: number
  churned_customers: number
  // Phase 2
  arpa?: number
  expansion_rate?: number
}

export interface MrrBridge {
  month: string
  start_mrr: number
  new_mrr: number
  expansion_mrr: number
  reactivation_mrr: number
  contraction_mrr: number
  churn_mrr: number
  end_mrr: number
}

export interface SegmentBreakdown {
  segment: string | null
  segment_id: string | null
  mrr: number
  nrr: number
  active_customers: number
}

export interface MetricDrilldown {
  metric_key: string
  month: string
  total: number
  drivers: Array<{
    company_id: string
    company_name: string
    amount: number
    event_type?: string
  }>
}

export interface ReconciliationIssue {
  id: string
  tenant_id: string
  issue_type: string
  severity: 'critical' | 'warning' | 'info'
  object_type: string | null
  object_id: string | null
  object_display: string | null
  description: string
  suggested_fix_json: Record<string, unknown> | null
  detected_at: string
  status: 'open' | 'resolved' | 'ignored'
  resolved_at: string | null
  resolved_by: string | null
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
  contraction_mrr: number
  churned_mrr: number
  net_new_mrr: number
}

export interface Company {
  id: string
  name: string
  domain: string | null
  segment: 'SMB' | 'MID' | 'ENT' | null
  hubspot_id: string | null
  external_id: string | null
  created_at: string
  // Phase 1
  employee_count?: number | null
  country?: string | null
  city?: string | null
  industry?: string | null
  status?: 'active' | 'churned' | 'at-risk' | 'prospect'
  annual_revenue?: number | null
  source?: string | null
  owner_id?: string | null
  // Phase 5 scores
  health_score?: number | null
  expansion_score?: number | null
  // Financial metrics
  net_sales?: number | null
  production_sales_net?: number | null
  gross_value_added?: number | null
  equity?: number | null
  total_assets?: number | null
  pre_tax_profit?: number | null
  ebitda?: number | null
  exports_usd?: number | null
  // Capital structure
  capital_share_public?: number | null
  capital_share_private?: number | null
  capital_share_foreign?: number | null
  capital_share_float?: number | null
  // Industry classification
  nace_description?: string | null
  nace_code?: string | null
  isic_description?: string | null
  isic_code?: string | null
  chamber_of_commerce?: string | null
  // Location
  district?: string | null
  address?: string | null
  postal_code?: string | null
  // Contact
  phone1?: string | null
  phone2?: string | null
  email?: string | null
  // Rankings
  iso500_rank?: number | null
  iso500_rank_prev_year?: number | null
  data_year?: number | null
  // Lifecycle & intelligence
  lifecycle_stage?: 'target' | 'prospect' | 'qualified' | 'hot_lead' | 'proposal' | 'customer' | 'at_risk' | 'churned' | null
  strategic_notes?: string | null
  // Computed
  current_mrr?: number
  current_mrr_month?: string | null
}

export interface Invoice {
  id: string
  invoice_number: string
  issue_date: string
  service_period_start: string | null
  service_period_end: string | null
  total_amount: number
  currency: string
  status: string
}

export interface LedgerEntry {
  id: string
  company_id: string
  product_id: string | null
  month: string
  event_type: string
  amount_original: number
  currency: string
  fx_rate: number
  amount_reporting: number
  recognition_method: string
  companies?: { name: string }
  products?: { name: string }
}

export interface RevenueEvent {
  id: string
  tenant_id?: string
  company_id: string
  product_id?: string | null
  month: string
  event_type: string
  mrr_impact: number
  prev_mrr: number
  new_mrr: number
  companies?: { name: string }
  products?: { name: string } | null
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

export interface HubSpotSyncLog {
  id: string
  synced_at: string
  status: 'running' | 'done' | 'error'
  companies_synced: number
  contacts_synced: number
  deals_synced: number
  error_message: string | null
}

export interface Settings {
  id: string
  reporting_currency: string
  recognition_method: string
  hubspot_connected: boolean
}

export interface ImportFile {
  id: string
  source: string
  filename: string
  status: string
  records_imported: number
  errors_json: unknown[] | null
  created_at: string
}

export interface ConflictPreview {
  total_rows: number
  new_rows: number
  conflicts: Array<{
    invoice_number: string
    company: string
    existing_date: string
    existing_amount: number
    new_date: string
    new_amount: number
  }>
  detected_columns: Record<string, string>
  parse_errors: Array<{ row: number; message: string }>
}

export interface ImportResult {
  file_id: string
  records_imported: number
  skipped_duplicates: number
  overwritten_duplicates: number
  errors: Array<{ row: number; message: string }>
}

export interface Product {
  id: string
  tenant_id: string
  name: string
  sku: string | null
  billing_period: 'monthly' | 'annual' | 'one_time'
  // Phase 1 fields
  description?: string | null
  pricing_model?: 'flat' | 'tiered' | 'usage' | 'per-seat'
  category?: string | null
  status?: 'active' | 'deprecated' | 'beta'
  launched_at?: string | null
  default_price?: number | null
  currency?: string
  created_at: string
}

export interface Contact {
  id: string
  tenant_id: string
  company_id: string | null
  name: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  title?: string | null
  role_type?: string | null
  is_primary?: boolean
  hubspot_id?: string | null
  created_at: string
  companies?: { name: string }
}

export interface Payment {
  id: string
  tenant_id: string
  company_id: string
  invoice_id?: string | null
  payment_date: string
  amount: number
  currency: string
  method?: string | null
  status: string
  external_id?: string | null
  notes?: string | null
  created_at: string
  companies?: { name: string }
  invoices?: { invoice_number: string }
}

export interface Integration {
  id: string
  tenant_id: string
  provider: string
  status: 'connected' | 'disconnected' | 'file_import' | 'coming_soon' | 'error'
  config_json: Record<string, unknown>
  last_sync_at: string | null
  created_at: string
}

export interface Role {
  id: string
  tenant_id: string
  name: string
  permissions_json: Record<string, unknown>
  is_active: boolean
  created_at: string
}

export interface Segment {
  id: string
  tenant_id: string
  name: string
  criteria_json: Record<string, unknown>
  created_at: string
}

// ─── Phase 3 Types ─────────────────────────────────────────────────────────

export interface FinancialInput {
  id: string
  tenant_id: string
  month: string
  total_revenue_override: number | null
  cogs: number | null
  opex: number | null
  sales_marketing_spend: number | null
  headcount: number | null
  profit_margin_override: number | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface AdvancedMetrics {
  month: string
  has_financial_inputs: boolean
  // Unit economics
  cac: number | null
  ltv: number | null
  ltv_cac_ratio: number | null
  cac_payback_months: number | null
  // Efficiency
  burn_multiple: number | null
  magic_number: number | null
  bessemer_efficiency: number | null
  // Profitability
  rule_of_40: number | null
  arr_growth_rate: number | null
  profit_margin: number | null
  // Per employee
  revenue_per_employee: number | null
  arr_per_employee: number | null
  headcount: number | null
}

export interface ProductMetrics {
  product_id: string
  product_name: string
  month: string
  mrr: number
  arr: number
  active_customers: number
  new_customers: number
  churned_customers: number
  nrr: number
  grr: number
  logo_churn_rate: number
  arpa: number
  ltv_estimate: number | null
}

export interface ProductCompany {
  company_id: string
  company_name: string
  segment: string | null
  mrr: number
  event_type: string
}

export interface CrossSellEntry {
  product_a_id: string
  product_a_name: string
  product_b_id: string
  product_b_name: string
  shared_companies: number
  product_a_total: number
  cross_sell_rate: number
}

export interface DataHealthDimension {
  name: string
  score: number
  weight: number
  description: string
  detail: string
}

export interface DataHealthSnapshot {
  score: number
  confidence: 'high' | 'medium' | 'low'
  dimensions: DataHealthDimension[]
  snapshot_date: string
}

// ─── Phase 4 Types ────────────────────────────────────────────────────────────

export interface Deal {
  id: string
  tenant_id?: string
  company_id: string
  name: string
  stage: string
  amount?: number | null
  currency: string
  probability?: number | null
  expected_close_date?: string | null
  actual_close_date?: string | null
  deal_type?: string | null
  status: string
  notes?: string | null
  product_id?: string | null
  hubspot_deal_id?: string | null
  created_at?: string
  updated_at?: string
  companies?: { name: string; segment?: string | null }
  products?: { name: string } | null
}

export interface PipelineMetrics {
  win_rate: number
  avg_deal_size: number
  total_pipeline_value: number
  weighted_pipeline: number
  open_deals: number
}

export interface DealMetrics {
  win_rate: number
  avg_deal_size: number
  avg_sales_cycle_days: number
  weighted_pipeline: number
  open_count: number
  won_count: number
  lost_count: number
}

export interface Proposal {
  id: string
  tenant_id?: string
  company_id: string
  deal_id?: string | null
  proposal_number?: string | null
  title?: string | null
  amount?: number | null
  currency: string
  status: string
  sent_date?: string | null
  expiry_date?: string | null
  accepted_date?: string | null
  notes?: string | null
  created_at?: string
  companies?: { name: string }
  deals?: { name: string } | null
}

export interface Contract {
  id: string
  tenant_id?: string
  company_id: string
  contract_number?: string | null
  title?: string | null
  start_date: string
  end_date: string
  total_value?: number | null
  currency: string
  auto_renewal: boolean
  renewal_term_months?: number | null
  status: string
  signed_date?: string | null
  notes?: string | null
  created_at?: string
  companies?: { name: string; segment?: string | null }
}

export interface ActivityItem {
  id: string
  tenant_id?: string
  company_id: string
  contact_id?: string | null
  deal_id?: string | null
  type: string
  subject?: string | null
  description?: string | null
  activity_date: string
  created_at?: string
  companies?: { name: string }
  contacts?: { name: string; email: string } | null
  deals?: { name: string } | null
}

export interface FunnelStage {
  id: string
  tenant_id?: string
  name: string
  sort_order: number
  conversion_target?: number | null
  color?: string
}

export interface FunnelStageResult {
  id: string
  name: string
  sort_order: number
  color: string
  conversion_target?: number | null
  count: number
  conversion_from_prev: number | null
}

export interface AcquisitionCohort {
  cohort_month: string
  size: number
  periods: {
    period: number
    month: string
    retention: number
    mrr: number
    active: number
  }[]
}

export interface RevenueCohort {
  band: string
  size: number
  trend: {
    month: string
    mrr: number
    active: number
  }[]
}

// ─── Phase 5 Types ────────────────────────────────────────────────────────────

export interface AccountScore {
  id: string
  tenant_id?: string
  month: string
  company_id: string
  score_type: 'expansion' | 'health' | 'churn_risk'
  score_value: number
  reasons_json: string[]
  computed_at: string
  companies?: { id: string; name: string; segment?: string | null }
}

export interface Playbook {
  id: string
  tenant_id?: string
  name: string
  trigger_type: string
  trigger_key: string
  trigger_threshold?: number | null
  recommended_actions_json: string[]
  is_active: boolean
  triggers_30d?: number
  created_at?: string
  updated_at?: string
}

export interface PlaybookTrigger {
  id: string
  tenant_id?: string
  playbook_id: string
  company_id?: string | null
  trigger_value?: number | null
  fired_at: string
  playbooks?: { name: string; trigger_key: string }
  companies?: { name: string }
}

export interface Notification {
  id: string
  tenant_id?: string
  type: string
  title: string
  body?: string | null
  is_read: boolean
  link?: string | null
  company_id?: string | null
  created_at: string
  companies?: { name: string }
}

export interface Note {
  id: string
  tenant_id?: string
  object_type: string
  object_id: string
  body: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  tenant_id?: string
  object_type?: string | null
  object_id?: string | null
  title: string
  description?: string | null
  due_date?: string | null
  status: 'open' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  created_at?: string
  updated_at?: string
}

export interface UsageEvent {
  id: string
  tenant_id?: string
  company_id: string
  product_id?: string | null
  event_name: string
  event_value?: number | null
  event_date: string
  metadata_json?: Record<string, unknown>
  companies?: { name: string }
  products?: { name: string } | null
}

export interface UsageEventSummary {
  event_name: string
  count_30d: number
  count_prev_30d: number
  trend: number | null
}

export interface SlackConnection {
  id: string
  tenant_id: string
  webhook_url?: string | null
  channel_default?: string | null
  notify_on_churn_risk: boolean
  notify_on_expansion: boolean
  notify_on_renewal: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Phase 6 Types ────────────────────────────────────────────────────────────

export interface ChurnRiskScore {
  id: string
  tenant_id?: string
  month: string
  company_id: string
  score_type: 'churn_risk'
  score_value: number
  reasons_json: string[]
  computed_at: string
  risk_category?: 'high' | 'medium' | 'low'
  companies?: { id: string; name: string; segment?: string | null }
}

export interface ForecastPoint {
  month: string
  mrr: number
}

export interface ForecastedPoint {
  month: string
  trend_mrr: number
  pipeline_mrr: number
  renewal_mrr: number
  forecast_mrr: number
}

export interface ForecastSummary {
  last_actual_mrr: number
  forecast_end_mrr: number
  expected_growth_pct: number
  historical_cagr_pct: number
}

export interface BenchmarkRow {
  cohort_key: string
  metric_key: string
  label: string
  unit: string
  higher_is_better: boolean
  p25: number
  p50: number
  p75: number
  n: number
  source: string
  my_value: number | null
  percentile: string | null
  position: 'top' | 'above_median' | 'below_median' | 'bottom' | null
}

export interface BenchmarkCohort {
  key: string
  label: string
}

export interface ColumnInfo {
  name: string
  sample_values: string[]
  detected_type: 'date' | 'number' | 'text'
}

export interface FieldSuggestion {
  field: string
  label: string
  required: boolean
  suggested_column: string | null
  confidence: number
}

export interface AnalyzeResult {
  columns: ColumnInfo[]
  suggestions: FieldSuggestion[]
}

export interface MappingTemplate {
  id: string
  name: string
  source_system: string | null
  column_map: Record<string, string>
  created_at: string
}

export interface BoardSnapshot {
  month: string
  mrr: number
  arr: number
  mrr_growth_pct: number | null
  nrr: number | null
  grr: number | null
  logo_churn_rate: number | null
  quick_ratio: number | null
  rule_of_40: number | null
  weighted_pipeline: number
  open_deals_count: number
  high_risk_accounts: number
  expansion_ready_accounts: number
  top_at_risk: AccountScore[]
  top_expansion: AccountScore[]
  upcoming_renewals: Contract[]
  mrr_trend: ForecastPoint[]
}
