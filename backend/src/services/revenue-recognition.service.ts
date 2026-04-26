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
   * Deletes existing ledger entries for the period, then re-inserts.
   */
  async rebuildLedger(
    tenantId: string,
    fromMonth: string,   // 'YYYY-MM'
    toMonth: string,     // 'YYYY-MM'
    reportingCurrency = 'USD',
    method: RecognitionMethod = 'accrual'
  ): Promise<{ processed: number; errors: number }> {
    const fromDate = `${fromMonth}-01`
    const toDate = `${toMonth}-01`

    logger.info(`Rebuilding ledger ${fromMonth} → ${toMonth} [${method}]`)

    // Fetch all non-void invoices for this tenant
    const { data: allInvoices, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('tenant_id', tenantId)
      .not('status', 'eq', 'void')

    if (error) throw new Error(error.message)

    // Filter to invoices whose effective period overlaps with [fromDate, toDate]
    const invoices = (allInvoices || []).filter((inv) => {
      const start = inv.service_period_start || inv.issue_date
      const end   = inv.service_period_end   || inv.issue_date
      return start <= toDate && end >= fromDate
    })

    if (invoices.length === 0) {
      logger.info('No invoices found overlapping rebuild range — nothing to process')
      return { processed: 0, errors: 0 }
    }

    // Delete existing ledger entries for these specific invoices (by source_id, all months)
    // This avoids duplicate entries when the same invoice is rebuilt multiple times.
    const sourceIds = invoices.map((inv) => inv.id)
    for (let i = 0; i < sourceIds.length; i += 200) {
      await supabase
        .from('revenue_ledger')
        .delete()
        .eq('tenant_id', tenantId)
        .in('source_id', sourceIds.slice(i, i + 200))
    }

    let processed = 0
    let errors = 0

    for (const invoice of invoices) {
      try {
        await this.processInvoice(invoice, tenantId, reportingCurrency, method)
        processed++
      } catch (err) {
        logger.warn(`Failed to process invoice ${invoice.invoice_number}`, err)
        errors++
      }
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
    if (method === 'cash') {
      await this.processCash(invoice, tenantId, reportingCurrency)
    } else {
      await this.processAccrual(invoice, tenantId, reportingCurrency)
    }
  }

  private async processCash(
    invoice: Invoice,
    tenantId: string,
    reportingCurrency: string
  ): Promise<void> {
    const month = toMonthStart(invoice.issue_date)
    const fxRate = await fxService.getRate(invoice.issue_date, invoice.currency, reportingCurrency)
    const amountReporting = round(invoice.total_amount * fxRate)

    await supabase.from('revenue_ledger').insert({
      tenant_id: tenantId,
      company_id: invoice.company_id,
      product_id: null,
      month,
      event_type: 'NEW',   // will be overridden by events service
      amount_original: invoice.total_amount,
      currency: invoice.currency,
      fx_rate: fxRate,
      amount_reporting: amountReporting,
      recognition_method: 'cash',
      source_type: 'invoice',
      source_id: invoice.id,
    })
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
        event_type: 'NEW',   // overridden by events service
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
