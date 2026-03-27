import { supabase } from '../config/supabase'

export interface ProductMetrics {
  product_id: string
  product_name: string
  month: string
  mrr: number
  arr: number
  nrr: number
  grr: number
  churn_rate: number
  active_companies: number
  new_companies: number
  churned_companies: number
}

export interface CrossSellEntry {
  product_a_id: string
  product_a_name: string
  product_b_id: string
  product_b_name: string
  shared_companies: number
  product_a_total: number
  co_adoption_rate: number  // %
}

class ProductMetricsService {
  async getProductMetrics(tenantId: string, productId: string, month: string): Promise<ProductMetrics> {
    const prevMonth = getPrevMonth(month)

    const [currRows, prevRows, eventRows] = await Promise.all([
      supabase.from('revenue_ledger').select('company_id, amount_reporting').eq('tenant_id', tenantId).eq('product_id', productId).eq('month', month),
      supabase.from('revenue_ledger').select('company_id, amount_reporting').eq('tenant_id', tenantId).eq('product_id', productId).eq('month', prevMonth),
      supabase.from('revenue_events').select('company_id, event_type, mrr_impact').eq('tenant_id', tenantId).eq('product_id', productId).eq('month', month),
    ])

    const currMrr = (currRows.data || []).reduce((s, r) => s + Number(r.amount_reporting), 0)
    const prevMrr = (prevRows.data || []).reduce((s, r) => s + Number(r.amount_reporting), 0)
    const activeCompanies = new Set((currRows.data || []).filter((r) => Number(r.amount_reporting) > 0).map((r) => r.company_id)).size

    const events = { expansion: 0, contraction: 0, churn: 0, new_count: 0, churned_count: 0 }
    for (const ev of eventRows.data || []) {
      const impact = Number(ev.mrr_impact)
      if (ev.event_type === 'EXPANSION') events.expansion += impact
      if (ev.event_type === 'CONTRACTION') events.contraction += impact
      if (ev.event_type === 'CHURN') { events.churn += impact; events.churned_count++ }
      if (ev.event_type === 'NEW') events.new_count++
    }

    const nrr = prevMrr > 0
      ? round(((prevMrr + events.expansion + events.contraction + events.churn) / prevMrr) * 100)
      : 0
    const grr = prevMrr > 0
      ? Math.min(100, round(((prevMrr + events.contraction + events.churn) / prevMrr) * 100))
      : 0
    const churnRate = prevMrr > 0
      ? round((Math.abs(events.churn) / prevMrr) * 100)
      : 0

    // Get product name
    const { data: productData } = await supabase.from('products').select('name').eq('id', productId).single()

    return {
      product_id: productId,
      product_name: productData?.name || 'Unknown',
      month,
      mrr: round(currMrr),
      arr: round(currMrr * 12),
      nrr,
      grr,
      churn_rate: churnRate,
      active_companies: activeCompanies,
      new_companies: events.new_count,
      churned_companies: events.churned_count,
    }
  }

  async getAllProductsMetrics(tenantId: string, month: string): Promise<ProductMetrics[]> {
    // Get all products that have ledger entries
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('tenant_id', tenantId)

    if (!products || products.length === 0) return []

    const results = await Promise.all(
      products.map((p) => this.getProductMetrics(tenantId, p.id, month))
    )

    return results.filter((r) => r.mrr > 0).sort((a, b) => b.mrr - a.mrr)
  }

  async getCrossSellMatrix(tenantId: string): Promise<CrossSellEntry[]> {
    // Get all products with their active company sets (any ledger > 0)
    const { data: ledger } = await supabase
      .from('revenue_ledger')
      .select('product_id, company_id, products(name)')
      .eq('tenant_id', tenantId)
      .gt('amount_reporting', 0)

    if (!ledger || ledger.length === 0) return []

    // Build product → Set<company_id> map
    const productCompanies: Record<string, Set<string>> = {}
    const productNames: Record<string, string> = {}

    for (const row of ledger) {
      if (!row.product_id) continue
      if (!productCompanies[row.product_id]) productCompanies[row.product_id] = new Set()
      productCompanies[row.product_id].add(row.company_id)
      if (!productNames[row.product_id]) {
        productNames[row.product_id] = (row.products as any)?.name || row.product_id
      }
    }

    const productIds = Object.keys(productCompanies)
    const matrix: CrossSellEntry[] = []

    for (let i = 0; i < productIds.length; i++) {
      for (let j = 0; j < productIds.length; j++) {
        if (i === j) continue
        const a = productIds[i]
        const b = productIds[j]
        const setA = productCompanies[a]
        const setB = productCompanies[b]
        const shared = [...setA].filter((c) => setB.has(c)).length
        if (shared === 0) continue

        matrix.push({
          product_a_id: a,
          product_a_name: productNames[a],
          product_b_id: b,
          product_b_name: productNames[b],
          shared_companies: shared,
          product_a_total: setA.size,
          co_adoption_rate: round((shared / setA.size) * 100),
        })
      }
    }

    return matrix.sort((a, b) => b.co_adoption_rate - a.co_adoption_rate)
  }

  async getProductCompanies(tenantId: string, productId: string, month: string) {
    const { data } = await supabase
      .from('revenue_ledger')
      .select('company_id, amount_reporting, companies(name, segment)')
      .eq('tenant_id', tenantId)
      .eq('product_id', productId)
      .eq('month', month)
      .gt('amount_reporting', 0)
      .order('amount_reporting', { ascending: false })

    return (data || []).map((r) => ({
      company_id: r.company_id,
      company_name: (r.companies as any)?.name || 'Unknown',
      segment: (r.companies as any)?.segment || null,
      mrr: round(Number(r.amount_reporting)),
    }))
  }
}

function getPrevMonth(month: string): string {
  const d = new Date(`${month.slice(0, 7)}-01`)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().split('T')[0]
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

export const productMetricsService = new ProductMetricsService()
