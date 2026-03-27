import { supabase } from '../config/supabase'
import logger from '../logger'
import type { EventType } from '../types'

/**
 * Derives revenue events (NEW/EXPANSION/CONTRACTION/CHURN/REACTIVATION) by
 * comparing each company's MRR month-over-month using the revenue_ledger.
 *
 * Algorithm:
 *   For each company×product pair:
 *   - prev_mrr = sum of amount_reporting in ledger for (month - 1)
 *   - curr_mrr = sum of amount_reporting in ledger for month
 *   - Then classify the delta as an event type
 */
class RevenueEventsService {
  async deriveEvents(tenantId: string, month: string): Promise<void> {
    logger.info(`Deriving revenue events for ${month}`)

    const prevMonth = getPrevMonth(month)

    // Get current month ledger grouped by company×product
    const { data: curr } = await supabase
      .from('revenue_ledger')
      .select('company_id, product_id, amount_reporting')
      .eq('tenant_id', tenantId)
      .eq('month', month)

    // Get previous month ledger grouped by company×product
    const { data: prev } = await supabase
      .from('revenue_ledger')
      .select('company_id, product_id, amount_reporting')
      .eq('tenant_id', tenantId)
      .eq('month', prevMonth)

    // Check for month before prev (to detect reactivation)
    const { data: prevPrev } = await supabase
      .from('revenue_ledger')
      .select('company_id, product_id, amount_reporting')
      .eq('tenant_id', tenantId)
      .eq('month', getPrevMonth(prevMonth))

    const currMap = buildMrrMap(curr || [])
    const prevMap = buildMrrMap(prev || [])
    const prevPrevMap = buildMrrMap(prevPrev || [])

    // Collect all company×product keys from both months
    const allKeys = new Set([...Object.keys(currMap), ...Object.keys(prevMap)])

    // Delete existing events for this month
    await supabase
      .from('revenue_events')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('month', month)

    const events: Array<{
      tenant_id: string
      company_id: string
      product_id: string | null
      month: string
      event_type: EventType
      mrr_impact: number
      prev_mrr: number
      new_mrr: number
    }> = []

    for (const key of allKeys) {
      const [companyId, productId] = parseKey(key)
      const prevMrr = prevMap[key] || 0
      const currMrr = currMap[key] || 0
      const prevPrevMrr = prevPrevMap[key] || 0

      if (prevMrr === 0 && currMrr > 0) {
        // No revenue last month, has revenue now
        const eventType: EventType = prevPrevMrr > 0 ? 'REACTIVATION' : 'NEW'
        events.push({
          tenant_id: tenantId,
          company_id: companyId,
          product_id: productId,
          month,
          event_type: eventType,
          mrr_impact: round(currMrr),
          prev_mrr: 0,
          new_mrr: round(currMrr),
        })
      } else if (prevMrr > 0 && currMrr === 0) {
        // Had revenue, now gone
        events.push({
          tenant_id: tenantId,
          company_id: companyId,
          product_id: productId,
          month,
          event_type: 'CHURN',
          mrr_impact: round(-prevMrr),
          prev_mrr: round(prevMrr),
          new_mrr: 0,
        })
      } else if (prevMrr > 0 && currMrr > prevMrr) {
        events.push({
          tenant_id: tenantId,
          company_id: companyId,
          product_id: productId,
          month,
          event_type: 'EXPANSION',
          mrr_impact: round(currMrr - prevMrr),
          prev_mrr: round(prevMrr),
          new_mrr: round(currMrr),
        })
      } else if (prevMrr > 0 && currMrr < prevMrr && currMrr > 0) {
        events.push({
          tenant_id: tenantId,
          company_id: companyId,
          product_id: productId,
          month,
          event_type: 'CONTRACTION',
          mrr_impact: round(currMrr - prevMrr),   // negative
          prev_mrr: round(prevMrr),
          new_mrr: round(currMrr),
        })
      }
      // else: prevMrr === currMrr → no event (stable)
    }

    if (events.length > 0) {
      const { error } = await supabase.from('revenue_events').insert(events)
      if (error) logger.error('Failed to insert revenue events', error)
    }

    logger.info(`Derived ${events.length} events for ${month}`)
  }

  async deriveEventsRange(tenantId: string, fromMonth: string, toMonth: string): Promise<void> {
    const months = getMonthsBetween(fromMonth, toMonth)
    for (const month of months) {
      await this.deriveEvents(tenantId, month)
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMrrMap(rows: Array<{ company_id: string; product_id: string | null; amount_reporting: number }>): Record<string, number> {
  const map: Record<string, number> = {}
  for (const row of rows) {
    const key = makeKey(row.company_id, row.product_id)
    map[key] = (map[key] || 0) + Number(row.amount_reporting)
  }
  return map
}

function makeKey(companyId: string, productId: string | null): string {
  return `${companyId}::${productId || '__none__'}`
}

function parseKey(key: string): [string, string | null] {
  const [companyId, productId] = key.split('::')
  return [companyId, productId === '__none__' ? null : productId]
}

function getPrevMonth(month: string): string {
  const d = new Date(`${month.slice(0, 7)}-01`)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().split('T')[0]
}

function getMonthsBetween(from: string, to: string): string[] {
  const months: string[] = []
  const current = new Date(`${from.slice(0, 7)}-01`)
  const last = new Date(`${to.slice(0, 7)}-01`)
  while (current <= last) {
    months.push(current.toISOString().split('T')[0])
    current.setMonth(current.getMonth() + 1)
  }
  return months
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

export const revenueEventsService = new RevenueEventsService()
