import * as XLSX from 'xlsx'
import { supabase } from '../config/supabase'

class ExportExcelService {
  /**
   * Rich import template: Instructions sheet + 15 sample invoice rows + Companies reference.
   */
  generateTemplate(): Buffer {
    const wb = XLSX.utils.book_new()

    // ── Sheet 1: Instructions ──────────────────────────────────────────────
    const instrRows = [
      ['RevenueOS — Invoice Import Template'],
      [''],
      ['HOW TO USE'],
      ['1. Fill in the "Invoices" sheet. Each row = one invoice.'],
      ['2. The "Companies" sheet is optional — companies are auto-created from invoice data.'],
      ['3. Upload the file via Import Center → CSV or Excel tab.'],
      ['4. After import, use "Rebuild Revenue Ledger" in Import Center to update metrics.'],
      [''],
      ['REQUIRED COLUMNS (Invoices sheet)'],
      ['Column', '', 'Description'],
      ['Company', '', 'Customer name. Auto-created if not found.'],
      ['Invoice No', '', 'Unique invoice number (INV-2024-001, 2024/001, etc.)'],
      ['Date', '', 'Invoice issue date. Formats: YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY'],
      ['Amount', '', 'Total invoice amount. Formats: 5000 or 5.000,00 or 5,000.00'],
      [''],
      ['OPTIONAL COLUMNS'],
      ['Column', '', 'Description'],
      ['Currency', '', 'ISO code (USD, EUR, TRY, GBP, CHF, JPY, CAD, AUD). Default: USD'],
      ['Service Start', '', 'Period start date for accrual recognition (e.g. 2024-01-01)'],
      ['Service End', '', 'Period end date for accrual recognition (e.g. 2024-12-31)'],
      ['Product', '', 'Product/plan name (e.g. Pro Plan, Enterprise, Basic)'],
      [''],
      ['TURKISH COLUMN NAMES (also accepted)'],
      ['Müşteri → Company', '', 'Fatura No → Invoice No'],
      ['Tarih → Date', '', 'Tutar → Amount'],
      ['Para Birimi → Currency', '', 'Başlangıç → Service Start'],
      ['Bitiş → Service End', '', 'Ürün / Hizmet → Product'],
      [''],
      ['CONFLICT HANDLING'],
      ['If you import a file with invoice numbers that already exist:'],
      [' • Skip (default): existing invoice is kept as-is, duplicate row is skipped'],
      [' • Overwrite: existing invoice is updated with the new data'],
      ['You will be shown a conflict list and can choose the resolution before confirming.'],
      [''],
      ['FX RATES'],
      ['Supported currencies: USD, EUR, TRY, GBP, CHF, JPY, CAD, AUD'],
      ['Rates are fetched nightly from the ECB (European Central Bank) via Frankfurter.app.'],
      ['All amounts are converted to your reporting currency at the rate of the invoice date.'],
    ]

    const instrSheet = XLSX.utils.aoa_to_sheet(instrRows)
    instrSheet['!cols'] = [{ wch: 24 }, { wch: 4 }, { wch: 65 }]
    XLSX.utils.book_append_sheet(wb, instrSheet, 'Instructions')

    // ── Sheet 2: Invoices (15 sample rows) ───────────────────────────────
    const invoicesData = [
      { Company: 'Acme Corporation',    'Invoice No': 'INV-2024-001', Date: '2024-01-15', Amount: 12000, Currency: 'USD', 'Service Start': '2024-01-01', 'Service End': '2024-12-31', Product: 'Enterprise Plan' },
      { Company: 'Beta Technologies',   'Invoice No': 'INV-2024-002', Date: '2024-01-20', Amount: 4800,  Currency: 'USD', 'Service Start': '2024-01-01', 'Service End': '2024-06-30', Product: 'Pro Plan' },
      { Company: 'Gamma Solutions',     'Invoice No': 'INV-2024-003', Date: '2024-02-01', Amount: 1200,  Currency: 'EUR', 'Service Start': '2024-02-01', 'Service End': '2024-02-29', Product: 'Starter Plan' },
      { Company: 'Delta Analytics',     'Invoice No': 'INV-2024-004', Date: '2024-02-10', Amount: 36000, Currency: 'USD', 'Service Start': '2024-01-01', 'Service End': '2024-12-31', Product: 'Enterprise Plan' },
      { Company: 'Epsilon Software',    'Invoice No': 'INV-2024-005', Date: '2024-02-15', Amount: 9600,  Currency: 'GBP', 'Service Start': '2024-02-01', 'Service End': '2025-01-31', Product: 'Pro Plan' },
      { Company: 'Zeta Consulting',     'Invoice No': 'INV-2024-006', Date: '2024-03-01', Amount: 2400,  Currency: 'USD', 'Service Start': '2024-03-01', 'Service End': '2024-03-31', Product: 'Starter Plan' },
      { Company: 'Acme Corporation',    'Invoice No': 'INV-2024-007', Date: '2024-04-01', Amount: 14400, Currency: 'USD', 'Service Start': '2024-04-01', 'Service End': '2025-03-31', Product: 'Enterprise Plan' },
      { Company: 'Eta Dynamics',        'Invoice No': 'INV-2024-008', Date: '2024-04-15', Amount: 6000,  Currency: 'EUR', 'Service Start': '2024-04-01', 'Service End': '2024-09-30', Product: 'Growth Plan' },
      { Company: 'Theta Innovations',   'Invoice No': 'INV-2024-009', Date: '2024-05-01', Amount: 48000, Currency: 'USD', 'Service Start': '2024-01-01', 'Service End': '2024-12-31', Product: 'Enterprise Plan' },
      { Company: 'Iota Ventures',       'Invoice No': 'INV-2024-010', Date: '2024-05-20', Amount: 3600,  Currency: 'TRY', 'Service Start': '2024-05-01', 'Service End': '2024-05-31', Product: 'Basic Plan' },
      { Company: 'Beta Technologies',   'Invoice No': 'INV-2024-011', Date: '2024-06-01', Amount: 5400,  Currency: 'USD', 'Service Start': '2024-07-01', 'Service End': '2024-12-31', Product: 'Pro Plan' },
      { Company: 'Kappa Systems',       'Invoice No': 'INV-2024-012', Date: '2024-06-15', Amount: 18000, Currency: 'USD', 'Service Start': '2024-06-01', 'Service End': '2025-05-31', Product: 'Business Plan' },
      { Company: 'Lambda Tech',         'Invoice No': 'INV-2024-013', Date: '2024-07-01', Amount: 7200,  Currency: 'EUR', 'Service Start': '2024-07-01', 'Service End': '2024-12-31', Product: 'Pro Plan' },
      { Company: 'Mu Analytics',        'Invoice No': 'INV-2024-014', Date: '2024-08-10', Amount: 2400,  Currency: 'GBP', 'Service Start': '2024-08-01', 'Service End': '2024-10-31', Product: 'Starter Plan' },
      { Company: 'Nu Global',           'Invoice No': 'INV-2024-015', Date: '2024-09-01', Amount: 60000, Currency: 'USD', 'Service Start': '2024-01-01', 'Service End': '2024-12-31', Product: 'Enterprise Plan' },
    ]

    const invoicesSheet = XLSX.utils.json_to_sheet(invoicesData)
    invoicesSheet['!cols'] = [
      { wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 12 },
      { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
    ]
    XLSX.utils.book_append_sheet(wb, invoicesSheet, 'Invoices')

    // ── Sheet 3: Companies (optional) ────────────────────────────────────
    const companiesData = [
      { Company: 'Acme Corporation',  Domain: 'acme.com',          Segment: 'enterprise', Notes: 'Auto-created on import if not found' },
      { Company: 'Beta Technologies', Domain: 'beta-tech.io',      Segment: 'mid-market', Notes: '' },
      { Company: 'Gamma Solutions',   Domain: 'gammasolutions.com', Segment: 'smb',        Notes: '' },
      { Company: 'Delta Analytics',   Domain: 'delta.ai',          Segment: 'enterprise', Notes: '' },
      { Company: 'Epsilon Software',  Domain: 'epsilon.software',  Segment: 'mid-market', Notes: '' },
    ]
    const companiesSheet = XLSX.utils.json_to_sheet(companiesData)
    companiesSheet['!cols'] = [{ wch: 28 }, { wch: 25 }, { wch: 14 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(wb, companiesSheet, 'Companies (optional)')

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  }

  async exportCompanies(tenantId: string): Promise<Buffer> {
    const { data: companies } = await supabase
      .from('companies')
      .select('name, domain, segment, created_at')
      .eq('tenant_id', tenantId)
      .order('name')

    const rows = (companies ?? []).map((c) => ({
      Company: c.name,
      Domain: c.domain ?? '',
      Segment: c.segment ?? '',
      'Created At': c.created_at ? c.created_at.split('T')[0] : '',
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Company: '', Domain: '', Segment: '', 'Created At': '' }])
    ws['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 15 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Companies')
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  }

  async exportInvoices(tenantId: string, month?: string): Promise<Buffer> {
    let query = supabase
      .from('invoices')
      .select('invoice_number, issue_date, service_period_start, service_period_end, total_amount, currency, status, companies(name)')
      .eq('tenant_id', tenantId)
      .order('issue_date', { ascending: false })

    if (month) {
      // month format: YYYY-MM
      const start = `${month}-01`
      const end = new Date(new Date(start).setMonth(new Date(start).getMonth() + 1) - 1)
        .toISOString().split('T')[0]
      query = query.gte('issue_date', start).lte('issue_date', end)
    }

    const { data: invoices } = await query

    const rows = (invoices ?? []).map((inv: any) => ({
      Company: inv.companies?.name ?? '',
      'Invoice No': inv.invoice_number,
      Date: inv.issue_date,
      Amount: inv.total_amount,
      Currency: inv.currency,
      'Service Start': inv.service_period_start ?? '',
      'Service End': inv.service_period_end ?? '',
      Status: inv.status,
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}])
    ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices')
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  }

  async exportLedger(tenantId: string, month?: string): Promise<Buffer> {
    let query = supabase
      .from('revenue_ledger')
      .select('month, event_type, amount_original, currency, fx_rate, amount_reporting, recognition_method, source_type, companies(name)')
      .eq('tenant_id', tenantId)
      .order('month', { ascending: false })

    if (month) {
      query = query.eq('month', `${month}-01`)
    }

    const { data: entries } = await query

    const rows = (entries ?? []).map((e: any) => ({
      Month: e.month,
      Company: e.companies?.name ?? '',
      'Event Type': e.event_type,
      'Amount (Original)': e.amount_original,
      Currency: e.currency,
      'FX Rate': e.fx_rate,
      'Amount (Reporting)': e.amount_reporting,
      'Recognition Method': e.recognition_method,
      'Source Type': e.source_type,
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}])
    ws['!cols'] = [
      { wch: 12 }, { wch: 30 }, { wch: 14 }, { wch: 18 },
      { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 20 }, { wch: 15 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Revenue Ledger')
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  }
}

export const exportExcelService = new ExportExcelService()
