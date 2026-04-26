import { supabase } from '../config/supabase'
import { fxService } from './fx.service'
import logger from '../logger'
import type { Invoice, RecognitionMethod } from '../types'

/**
 * Populates the revenue_ledger table from invoices.
 *
 * Accrual: spread the invoice amount proportionally across months in service period.
 * Cash: entire amount goes to the invoice issue_date month.
 */
class RevenueRecognitionService {
  /**
   * Rebuild ledger for all invoices in a date range.
   * Deletes existing ledger entries for the period, then re-inserts in batches.
   */
  async rebuildLedger(
    tenantId: string,
    fromMonth: string,   // 'YYYY-MM'
    toMonth: string,     // 'YYYY-MM'
    reportingCurrency = 'USD',
    method: RecognitionMethod = 'accrual'
  ): Promise<{ processed: number; errors: number }> {
    const fromDate = `${fromMonth}-01`
    // Use last day of toMonth so invoices dated anywhere in the month are included
    const toDate = lastDayOfMonth(`${toMonth}-01`)

    logger.info(`Rebuilding ledger ${fromMonth} → ${toMonth} [${method}]`)

    // Fetch all non-void invoices for this tenant (paginated — Supabase caps at 1000/request)
    const allInvoices: any[] = []
    const PAGE = 1000
    let offset = 0
    while (true) {
      const { data: page, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('tenant_id', tenantId)
        .not('status', 'eq', 'void')
        .range(offset, offset + PAGE - 1)

      if (error) throw new Error(error.message)
      if (!page || page.length === 0) break
      allInvoices.push(...page)
      if (page.length < PAGE) break
      offset += PAGE
    }

    // Filter to invoices whose effective period overlaps with [fromDate, toDate]
    const invoices = allInvoices.filter((inv) => {
      const start = inv.service_period_start || inv.issue_date
      const end   = inv.service_period_end   || inv.issue_date
      return start <= toDate && end >= fromDate
    })

    if (invoices.length === 0) {
      logger.info('No invoices found overlapping rebuild range — nothing to process')
      return { processed: 0, errors: 0 }
    }

    logger.info(`Processing ${invoices.length} invoices`)

    // Delete existing ledger entries for these specific invoices (by source_id, all months)
    const sourceIds = invoices.map((inv) => inv.id)
    for (let i = 0; i < sourceIds.length; i += 200) {
      await supabase
        .from('revenue_ledger')
        .delete()
        .eq('tenant_id', tenantId)
        .in('source_id', sourceIds.slice(i, i + 200))
    }

    // Pre-warm FX rate cache: collect unique (date, currency) pairs and fetch once
    const fxCache = new Map<string, number>()
    const uniqueFxKeys = new Set<string>()
    for (const inv of invoices) {
      if (inv.currency === reportingCurrency) continue
      if (method === 'cash') {
        uniqueFxKeys.add(`${inv.issue_date}|${inv.currency}`)
      } else {
        const start = inv.service_period_start || inv.issue_date
        const end   = inv.service_period_end   || inv.issue_date
        for (const m of getMonthsBetween(start, end)) {
          uniqueFxKeys.add(`${m}|${inv.currency}`)
        }
      }
    }
    for (const key of uniqueFxKeys) {
      const [date, currency] = key.split('|')
      const rate = await fxService.getRate(date, currency, reportingCurrency)
      fxCache.set(key, rate)
    }

    const getFx = (date: string, currency: string): number => {
      if (currency === reportingCurrency) return 1
      return fxCache.get(`${date}|${currency}`) ?? 1
    }

    // Build all ledger rows in memory, then bulk-insert in batches of 500
    const rows: any[] = []
    let processed = 0
    let errors = 0

    for (const invoice of invoices) {
      try {
        if (method === 'cash') {
          const month = toMonthStart(invoice.issue_date)
          const fxRate = getFx(invoice.issue_date, invoice.currency)
          rows.push({
            tenant_id: tenantId,
            company_id: invoice.company_id,
            product_id: null,
            month,
            event_type: 'NEW',
            amount_original: invoice.total_amount,
            currency: invoice.currency,
            fx_rate: fxRate,
            amount_reporting: round(invoice.total_amount * fxRate),
            recognition_method: 'cash',
            source_type: 'invoice',
            source_id: invoice.id,
          })
        } else {
          const start = invoice.service_period_start || invoice.issue_date
          const end   = invoice.service_period_end   || invoice.issue_date
          const months = getMonthsBetween(start, end)
          const totalDays = daysBetween(start, end) || 1

          for (const month of months) {
            const monthEnd = lastDayOfMonth(month)
            const effectiveStart = maxDate(start, month)
            const effectiveEnd   = minDate(end, monthEnd)
            const daysInMonth    = daysBetween(effectiveStart, effectiveEnd) + 1
            const proportion     = daysInMonth / totalDays
            const amountOriginal = round(invoice.total_amount * proportion)
            const fxRate         = getFx(month, invoice.currency)

            rows.push({
              tenant_id: tenantId,
              company_id: invoice.company_id,
              product_id: null,
              month,
              event_type: 'NEW',
              amount_original: amountOriginal,
              currency: invoice.currency,
              fx_rate: fxRate,
              amount_reporting: round(amountOriginal * fxRate),
              recognition_method: 'accrual',
              source_type: 'invoice',
              source_id: invoice.id,
            })
          }
        }
        processed++
      } catch (err) {
        logger.warn(`Failed to process invoice ${invoice.invoice_number}`, err)
        errors++
      }
    }

    // Bulk insert in batches of 500
    const INSERT_BATCH = 500
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const { error } = await supabase.from('revenue_ledger').insert(rows.slice(i, i + INSERT_BATCH))
      if (error) throw new Error(error.message)
    }

    logger.info(`Ledger rebuild complete: ${processed} processed, ${errors} errors`)
    return { processed, errors }
  }

  async processInvoice(
    invoice: Invoice,
    tenantId: string,
    reportingCurrency: string,
    method: RecognitionMethod
  ): Promise<void> {
    const fxRate = await fxService.getRate(invoice.issue_date, invoice.currency, reportingCurrency)
    if (method === 'cash') {
      const month = toMonthStart(invoice.issue_date)
      const amountReporting = round(invoice.total_amount * fxRate)
      await supabase.from('revenue_ledger').insert({
        tenant_id: tenantId,
        company_id: invoice.company_id,
        product_id: null,
        month,
        event_type: 'NEW',
        amount_original: invoice.total_amount,
        currency: invoice.currency,
        fx_rate: fxRate,
        amount_reporting: amountReporting,
        recognition_method: 'cash',
        source_type: 'invoice',
        source_id: invoice.id,
      })
    } else {
      await this.processAccrual(invoice, tenantId, reportingCurrency)
    }
  }

  private async processAccrual(
    invoice: Invoice,
    tenantId: string,
    reportingCurrency: string
  ): Promise<void> {
    const start = invoice.service_period_start || invoice.issue_date
    const end = invoice.service_period_end || invoice.issue_date

    const months = getMonthsBetween(start, end)
    const totalDays = daysBetween(start, end) || 1

    const rows = []
    for (const month of months) {
      const monthStart = month
      const monthEnd = lastDayOfMonth(month)
      const effectiveStart = maxDate(start, monthStart)
      const effectiveEnd = minDate(end, monthEnd)
      const daysInMonth = daysBetween(effectiveStart, effectiveEnd) + 1

      const proportion = daysInMonth / totalDays
      const amountOriginal = round(invoice.total_amount * proportion)

      const fxRate = await fxService.getRate(month, invoice.currency, reportingCurrency)
      const amountReporting = round(amountOriginal * fxRate)

      rows.push({
        tenant_id: tenantId,
        company_id: invoice.company_id,
        product_id: null,
        month,
        event_type: 'NEW',
        amount_original: amountOriginal,
        currency: invoice.currency,
        fx_rate: fxRate,
        amount_reporting: amountReporting,
        recognition_method: 'accrual',
        source_type: 'invoice',
        source_id: invoice.id,
      })
    }

    if (rows.length > 0) {
      const { error } = await supabase.from('revenue_ledger').insert(rows)
      if (error) throw new Error(error.message)
    }
  }
}

// ─── Helper functions ────────────────────────────────────────────────────────

function toMonthStart(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`
}

function getMonthsBetween(start: string, end: string): string[] {
  const months: string[] = []
  const current = new Date(`${start.slice(0, 7)}-01`)
  const last = new Date(`${end.slice(0, 7)}-01`)

  while (current <= last) {
    months.push(current.toISOString().split('T')[0])
    current.setMonth(current.getMonth() + 1)
  }
  return months
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay)
}

function lastDayOfMonth(monthStart: string): string {
  const d = new Date(monthStart)
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  return d.toISOString().split('T')[0]
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b
}

function minDate(a: string, b: string): string {
  return a < b ? a : b
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

export const revenueRecognitionService = new RevenueRecognitionService()
