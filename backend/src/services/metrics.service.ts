import { supabase } from '../config/supabase'
import type { MetricsSummary, MrrHistoryPoint, NetNewMrrBreakdown } from '../types'

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

class MetricsService {
  /**
   * Full metrics summary for a given month.
   * Uses revenue_events for event breakdown, revenue_ledger for MRR sum.
   */
  async getSummary(tenantId: string, month: string): Promise<MetricsSummary> {
    const prevMonth = getPrevMonth(month)

    const [currMrr, prevMrr, events, prevEvents, activeCustomers, churnedCustomers] =
      await Promise.all([
        this.getMrr(tenantId, month),
        this.getMrr(tenantId, prevMonth),
        this.getEventBreakdown(tenantId, month),
        this.getEventBreakdown(tenantId, prevMonth),
        this.getActiveCustomers(tenantId, month),
        this.getChurnedCustomers(tenantId, month),
      ])

    const nrr = prevMrr > 0
      ? round(((prevMrr + events.expansion + events.contraction + events.churn) / prevMrr) * 100)
      : 0

    const grr = prevMrr > 0
      ? Math.min(100, round(((prevMrr + events.contraction + events.churn) / prevMrr) * 100))
      : 0

    const positiveFlow = events.new + events.expansion + events.reactivation
    const negativeFlow = Math.abs(events.contraction) + Math.abs(events.churn)
    const quickRatio = negativeFlow > 0 ? round(positiveFlow / negativeFlow) : null

    const prevActiveCustomers = await this.getActiveCustomers(tenantId, prevMonth)
    const logoChurnRate = prevActiveCustomers > 0
      ? round((churnedCustomers / prevActiveCustomers) * 100)
      : 0

    const revenueChurnRate = prevMrr > 0
      ? round((Math.abs(events.churn) + Math.abs(events.contraction)) / prevMrr * 100)
      : 0

    const netNewMrr = round(events.new + events.expansion + events.reactivation + events.contraction + events.churn + events.price_increase)

    return {
      month,
      mrr: round(currMrr),
      arr: round(currMrr * 12),
      new_mrr: round(events.new),
      expansion_mrr: round(events.expansion),
      contraction_mrr: round(events.contraction),
      churned_mrr: round(events.churn),
      reactivation_mrr: round(events.reactivation),
      price_increase_mrr: round(events.price_increase),
      net_new_mrr: netNewMrr,
      nrr,
      grr,
      quick_ratio: quickRatio ?? 0,
      logo_churn_rate: logoChurnRate,
      revenue_churn_rate: revenueChurnRate,
      active_customers: activeCustomers,
      churned_customers: churnedCustomers,
    }
  }

  async getMrrHistory(tenantId: string, months: number = 12): Promise<MrrHistoryPoint[]> {
    // Batch-fetch all ledger rows and events in 2 queries, then aggregate in memory

    const [{ data: ledgerRows }, { data: eventRows }] = await Promise.all([
      supabase
        .from('revenue_ledger')
        .select('month, company_id, amount_reporting')
        .eq('tenant_id', tenantId)
        .order('month', { ascending: true }),
      supabase
        .from('revenue_events')
        .select('month, event_type, mrr_impact')
        .eq('tenant_id', tenantId)
        .order('month', { ascending: true }),
    ])

    if (!ledgerRows || ledgerRows.length === 0) return []

    // Build MRR map: month → total amount_reporting
    const mrrByMonth: Record<string, number> = {}
    const activeByMonth: Record<string, Set<string>> = {}
    for (const row of ledgerRows) {
      const m = row.month
      mrrByMonth[m] = (mrrByMonth[m] || 0) + Number(row.amount_reporting)
      if (!activeByMonth[m]) activeByMonth[m] = new Set()
      if (Number(row.amount_reporting) > 0) activeByMonth[m].add(row.company_id)
    }

    // Build events map: month → event breakdown
    type EventBreakdown = { new: number; expansion: number; contraction: number; churn: number; reactivation: number }
    const eventsByMonth: Record<string, EventBreakdown> = {}
    for (const row of eventRows || []) {
      const m = row.month
      if (!eventsByMonth[m]) eventsByMonth[m] = { new: 0, expansion: 0, contraction: 0, churn: 0, reactivation: 0 }
      const impact = Number(row.mrr_impact)
      switch (row.event_type) {
        case 'NEW': eventsByMonth[m].new += impact; break
        case 'EXPANSION': eventsByMonth[m].expansion += impact; break
        case 'CONTRACTION': eventsByMonth[m].contraction += impact; break
        case 'CHURN': eventsByMonth[m].churn += impact; break
        case 'REACTIVATION': eventsByMonth[m].reactivation += impact; break
      }
    }

    // Sorted unique months from ledger, take last N
    const allMonths = Object.keys(mrrByMonth).sort()
    const monthList = allMonths.slice(-months)

    return monthList.map((month, i) => {
      const mrr = mrrByMonth[month] || 0
      const events = eventsByMonth[month] || { new: 0, expansion: 0, contraction: 0, churn: 0, reactivation: 0 }
      const prevMonth = i > 0 ? monthList[i - 1] : getPrevMonth(month)
      const prevMrr = mrrByMonth[prevMonth] || 0

      const nrr = prevMrr > 0
        ? round(((prevMrr + events.expansion + events.contraction + events.churn) / prevMrr) * 100)
        : 0

      return {
        month,
        mrr: round(mrr),
        arr: round(mrr * 12),
        new_mrr: round(events.new),
        expansion_mrr: round(events.expansion),
        contraction_mrr: round(events.contraction),
        churned_mrr: round(events.churn),
        net_new_mrr: round(events.new + events.expansion + events.reactivation + events.contraction + events.churn),
        nrr,
        active_customers: activeByMonth[month]?.size || 0,
      }
    })
  }

  /** Public accessor for MRR (used by advanced-metrics service) */
  async getMrr12MonthsAgo(tenantId: string, month: string): Promise<number> {
    return this.getMrr(tenantId, month)
  }

  /** MRR Bridge: start → new + expansion + reactivation - contraction - churn → end */
  async getMrrBridge(tenantId: string, month: string): Promise<MrrBridge> {
    const prevMonth = getPrevMonth(month)
    const [startMrr, endMrr, events] = await Promise.all([
      this.getMrr(tenantId, prevMonth),
      this.getMrr(tenantId, month),
      this.getEventBreakdown(tenantId, month),
    ])

    return {
      month,
      start_mrr: round(startMrr),
      new_mrr: round(events.new),
      expansion_mrr: round(events.expansion),
      reactivation_mrr: round(events.reactivation),
      contraction_mrr: round(events.contraction),   // negative
      churn_mrr: round(events.churn),                // negative
      end_mrr: round(endMrr),
    }
  }

  /** ARPA: Total MRR / Active Company Count */
  async getArpa(tenantId: string, month: string): Promise<number> {
    const [mrr, activeCustomers] = await Promise.all([
      this.getMrr(tenantId, month),
      this.getActiveCustomers(tenantId, month),
    ])
    return activeCustomers > 0 ? round(mrr / activeCustomers) : 0
  }

  /** Expansion Rate: Expansion MRR / Start MRR × 100 */
  async getExpansionRate(tenantId: string, month: string): Promise<number> {
    const prevMonth = getPrevMonth(month)
    const [startMrr, events] = await Promise.all([
      this.getMrr(tenantId, prevMonth),
      this.getEventBreakdown(tenantId, month),
    ])
    return startMrr > 0 ? round((events.expansion / startMrr) * 100) : 0
  }

  /** Segment-level MRR/NRR breakdown */
  async getSegmentBreakdown(tenantId: string, month: string): Promise<SegmentBreakdown[]> {
    const prevMonth = getPrevMonth(month)

    // Fetch ledger with segment join (via companies.segment)
    const { data: ledgerRows } = await supabase
      .from('revenue_ledger')
      .select('company_id, amount_reporting, companies!inner(segment)')
      .eq('tenant_id', tenantId)
      .eq('month', month)

    if (!ledgerRows || ledgerRows.length === 0) return []

    // Aggregate MRR per segment
    const segmentMrr: Record<string, number> = {}
    const segmentCustomers: Record<string, Set<string>> = {}
    for (const row of ledgerRows) {
      const seg = (row.companies as any)?.segment || 'unassigned'
      segmentMrr[seg] = (segmentMrr[seg] || 0) + Number(row.amount_reporting)
      if (!segmentCustomers[seg]) segmentCustomers[seg] = new Set()
      segmentCustomers[seg].add(row.company_id)
    }

    // Prev month ledger for NRR
    const { data: prevLedger } = await supabase
      .from('revenue_ledger')
      .select('company_id, amount_reporting, companies!inner(segment)')
      .eq('tenant_id', tenantId)
      .eq('month', prevMonth)

    const prevSegmentMrr: Record<string, number> = {}
    for (const row of prevLedger || []) {
      const seg = (row.companies as any)?.segment || 'unassigned'
      prevSegmentMrr[seg] = (prevSegmentMrr[seg] || 0) + Number(row.amount_reporting)
    }

    // Events per segment
    const { data: eventRows } = await supabase
      .from('revenue_events')
      .select('company_id, event_type, mrr_impact, companies!inner(segment)')
      .eq('tenant_id', tenantId)
      .eq('month', month)

    const segmentEvents: Record<string, { expansion: number; contraction: number; churn: number }> = {}
    for (const row of eventRows || []) {
      const seg = (row.companies as any)?.segment || 'unassigned'
      if (!segmentEvents[seg]) segmentEvents[seg] = { expansion: 0, contraction: 0, churn: 0 }
      const impact = Number(row.mrr_impact)
      if (row.event_type === 'EXPANSION') segmentEvents[seg].expansion += impact
      if (row.event_type === 'CONTRACTION') segmentEvents[seg].contraction += impact
      if (row.event_type === 'CHURN') segmentEvents[seg].churn += impact
    }

    return Object.entries(segmentMrr).map(([seg, mrr]) => {
      const prev = prevSegmentMrr[seg] || 0
      const evts = segmentEvents[seg] || { expansion: 0, contraction: 0, churn: 0 }
      const nrr = prev > 0
        ? round(((prev + evts.expansion + evts.contraction + evts.churn) / prev) * 100)
        : 0
      return {
        segment: seg,
        segment_id: null,
        mrr: round(mrr),
        nrr,
        active_customers: segmentCustomers[seg]?.size || 0,
      }
    })
  }

  /** Metric drill-down: top companies driving a metric */
  async getDrilldown(tenantId: string, metricKey: string, month: string, limit = 20): Promise<{
    metric_key: string
    month: string
    drivers: Array<{ company_id: string; company_name: string; amount: number; event_type?: string }>
    total: number
  }> {
    let eventFilter: string[] = []
    if (metricKey === 'new_mrr') eventFilter = ['NEW']
    else if (metricKey === 'expansion_mrr') eventFilter = ['EXPANSION']
    else if (metricKey === 'churn_mrr') eventFilter = ['CHURN']
    else if (metricKey === 'contraction_mrr') eventFilter = ['CONTRACTION']
    else if (metricKey === 'reactivation_mrr') eventFilter = ['REACTIVATION']
    else if (metricKey === 'net_new_mrr') eventFilter = ['NEW', 'EXPANSION', 'CONTRACTION', 'CHURN', 'REACTIVATION', 'PRICE_INCREASE']

    if (eventFilter.length > 0) {
      // Event-based drill-down
      const { data } = await supabase
        .from('revenue_events')
        .select('company_id, event_type, mrr_impact, companies(name)')
        .eq('tenant_id', tenantId)
        .eq('month', month)
        .in('event_type', eventFilter)
        .order('mrr_impact', { ascending: false })
        .limit(limit)

      const drivers = (data || []).map((row) => ({
        company_id: row.company_id,
        company_name: (row.companies as any)?.name || 'Unknown',
        amount: round(Number(row.mrr_impact)),
        event_type: row.event_type,
      }))
      const total = drivers.reduce((s, d) => s + d.amount, 0)
      return { metric_key: metricKey, month, drivers, total: round(total) }
    }

    // MRR drill-down: top companies by ledger amount
    const { data } = await supabase
      .from('revenue_ledger')
      .select('company_id, amount_reporting, companies(name)')
      .eq('tenant_id', tenantId)
      .eq('month', month)
      .order('amount_reporting', { ascending: false })
      .limit(limit)

    const drivers = (data || []).map((row) => ({
      company_id: row.company_id,
      company_name: (row.companies as any)?.name || 'Unknown',
      amount: round(Number(row.amount_reporting)),
    }))
    const total = drivers.reduce((s, d) => s + d.amount, 0)
    return { metric_key: metricKey, month, drivers, total: round(total) }
  }

  async getNetNewMrrBreakdown(tenantId: string, month: string): Promise<NetNewMrrBreakdown> {
    const events = await this.getEventBreakdown(tenantId, month)
    const netNew = events.new + events.expansion + events.reactivation + events.contraction + events.churn + events.price_increase

    return {
      month,
      new_mrr: round(events.new),
      expansion_mrr: round(events.expansion),
      reactivation_mrr: round(events.reactivation),
      contraction_mrr: round(events.contraction),
      churned_mrr: round(events.churn),
      net_new_mrr: round(netNew),
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async getMrr(tenantId: string, month: string): Promise<number> {
    const { data } = await supabase
      .from('revenue_ledger')
      .select('amount_reporting')
      .eq('tenant_id', tenantId)
      .eq('month', month)

    if (!data || data.length === 0) return 0
    return data.reduce((sum, row) => sum + Number(row.amount_reporting), 0)
  }

  private async getEventBreakdown(tenantId: string, month: string): Promise<{
    new: number; expansion: number; contraction: number; churn: number;
    reactivation: number; price_increase: number
  }> {
    const { data } = await supabase
      .from('revenue_events')
      .select('event_type, mrr_impact')
      .eq('tenant_id', tenantId)
      .eq('month', month)

    const result = { new: 0, expansion: 0, contraction: 0, churn: 0, reactivation: 0, price_increase: 0 }
    for (const row of data || []) {
      const impact = Number(row.mrr_impact)
      switch (row.event_type) {
        case 'NEW': result.new += impact; break
        case 'EXPANSION': result.expansion += impact; break
        case 'CONTRACTION': result.contraction += impact; break
        case 'CHURN': result.churn += impact; break
        case 'REACTIVATION': result.reactivation += impact; break
        case 'PRICE_INCREASE': result.price_increase += impact; break
      }
    }
    return result
  }

  private async getActiveCustomers(tenantId: string, month: string): Promise<number> {
    const { data } = await supabase
      .from('revenue_ledger')
      .select('company_id')
      .eq('tenant_id', tenantId)
      .eq('month', month)
      .gt('amount_reporting', 0)

    if (!data) return 0
    return new Set(data.map((r) => r.company_id)).size
  }

  private async getChurnedCustomers(tenantId: string, month: string): Promise<number> {
    const { data } = await supabase
      .from('revenue_events')
      .select('company_id')
      .eq('tenant_id', tenantId)
      .eq('month', month)
      .eq('event_type', 'CHURN')

    return data?.length || 0
  }

  async getChurnRates(tenantId: string, months: number = 24): Promise<{
    monthly: Array<{
      month: string
      logo_churn_rate: number
      revenue_churn_rate: number
      churned_count: number
      churned_mrr: number
      prev_active_count: number
      prev_mrr: number
      companies: Array<{ id: string; name: string; mrr_lost: number }>
    }>
    annual: Array<{
      year: number
      logo_churn_rate: number
      revenue_churn_rate: number
      churned_count: number
      churned_mrr: number
      avg_churned_mrr: number
      companies: Array<{ id: string; name: string; mrr_lost: number; month: string }>
    }>
  }> {
    const [{ data: churnEvents }, { data: ledgerRows }] = await Promise.all([
      supabase
        .from('revenue_events')
        .select('company_id, month, mrr_impact, companies(id, name)')
        .eq('tenant_id', tenantId)
        .eq('event_type', 'CHURN')
        .order('month', { ascending: true }),
      supabase
        .from('revenue_ledger')
        .select('month, company_id, amount_reporting')
        .eq('tenant_id', tenantId)
        .order('month', { ascending: true }),
    ])

    if (!churnEvents || churnEvents.length === 0) return { monthly: [], annual: [] }

    // Build MRR per month and active customers per month
    const mrrByMonth: Record<string, number> = {}
    const activeByMonth: Record<string, Set<string>> = {}
    for (const row of ledgerRows || []) {
      const m = row.month
      mrrByMonth[m] = (mrrByMonth[m] || 0) + Number(row.amount_reporting)
      if (!activeByMonth[m]) activeByMonth[m] = new Set()
      if (Number(row.amount_reporting) > 0) activeByMonth[m].add(row.company_id)
    }

    // Group churn events by month
    const churnByMonth: Record<string, Array<{ id: string; name: string; mrr_lost: number }>> = {}
    for (const ev of churnEvents) {
      const m = ev.month
      if (!churnByMonth[m]) churnByMonth[m] = []
      const company = ev.companies as any
      churnByMonth[m].push({
        id: company?.id || ev.company_id,
        name: company?.name || 'Unknown',
        mrr_lost: round(Number(ev.mrr_impact)),
      })
    }

    // Get last N months that have churn data
    const allMonths = [...new Set([...Object.keys(mrrByMonth), ...Object.keys(churnByMonth)])].sort()
    const recentMonths = allMonths.slice(-months)

    const monthly = recentMonths.map((month) => {
      const prevMonth = getPrevMonth(month)
      const prevMrr = mrrByMonth[prevMonth] || 0
      const prevActiveCount = activeByMonth[prevMonth]?.size || 0
      const companies = churnByMonth[month] || []
      const churned_mrr = companies.reduce((s, c) => s + c.mrr_lost, 0)
      const churned_count = companies.length
      const logo_churn_rate = prevActiveCount > 0 ? round((churned_count / prevActiveCount) * 100) : 0
      const revenue_churn_rate = prevMrr > 0 ? round((Math.abs(churned_mrr) / prevMrr) * 100) : 0

      return {
        month,
        logo_churn_rate,
        revenue_churn_rate,
        churned_count,
        churned_mrr: round(churned_mrr),
        prev_active_count: prevActiveCount,
        prev_mrr: round(prevMrr),
        companies,
      }
    }).filter(m => m.churned_count > 0 || mrrByMonth[m.month])

    // Aggregate annual
    const annualMap: Record<number, {
      churned_count: number
      churned_mrr: number
      start_active: number
      start_mrr: number
      companies: Array<{ id: string; name: string; mrr_lost: number; month: string }>
    }> = {}

    for (const m of monthly) {
      const year = parseInt(m.month.slice(0, 4))
      if (!annualMap[year]) annualMap[year] = { churned_count: 0, churned_mrr: 0, start_active: 0, start_mrr: 0, companies: [] }
      annualMap[year].churned_count += m.churned_count
      annualMap[year].churned_mrr += m.churned_mrr
      annualMap[year].companies.push(...m.companies.map(c => ({ ...c, month: m.month })))

      // Use Jan of the year as the start baseline for annual churn rate
      if (m.month.slice(5, 7) === '01') {
        annualMap[year].start_active = m.prev_active_count
        annualMap[year].start_mrr = m.prev_mrr
      }
    }

    const annual = Object.entries(annualMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([yearStr, data]) => {
        const year = Number(yearStr)
        const logo_churn_rate = data.start_active > 0
          ? round((data.churned_count / data.start_active) * 100)
          : 0
        const revenue_churn_rate = data.start_mrr > 0
          ? round((Math.abs(data.churned_mrr) / data.start_mrr) * 100)
          : 0
        const avg_churned_mrr = data.churned_count > 0
          ? round(Math.abs(data.churned_mrr) / data.churned_count)
          : 0
        return {
          year,
          logo_churn_rate,
          revenue_churn_rate,
          churned_count: data.churned_count,
          churned_mrr: round(data.churned_mrr),
          avg_churned_mrr,
          companies: data.companies,
        }
      })

    return { monthly: monthly.filter(m => m.churned_count > 0), annual }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPrevMonth(month: string): string {
  const d = new Date(`${month.slice(0, 7)}-01`)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().split('T')[0]
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

export const metricsService = new MetricsService()
