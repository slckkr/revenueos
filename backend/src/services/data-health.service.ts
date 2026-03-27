import { supabase } from '../config/supabase'

export interface DataHealthDimension {
  name: string
  score: number        // 0-100
  weight: number       // % weight in overall score
  description: string
  detail: string
}

export interface DataHealthSnapshot {
  score: number
  confidence: 'high' | 'medium' | 'low'
  dimensions: DataHealthDimension[]
  snapshot_date: string
}

class DataHealthService {
  async computeAndSave(tenantId: string): Promise<DataHealthSnapshot> {
    const snapshot = await this.compute(tenantId)

    // Upsert into data_health_snapshots
    const today = new Date().toISOString().split('T')[0]
    await supabase
      .from('data_health_snapshots')
      .upsert({
        tenant_id: tenantId,
        snapshot_date: today,
        score: snapshot.score,
        breakdown_json: { dimensions: snapshot.dimensions },
      }, { onConflict: 'tenant_id,snapshot_date' })

    return snapshot
  }

  async getCurrent(tenantId: string): Promise<DataHealthSnapshot> {
    // Try to load from DB first (today's snapshot)
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('data_health_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('snapshot_date', today)
      .single()

    if (data) {
      const dimensions = (data.breakdown_json as any)?.dimensions || []
      return {
        score: data.score,
        confidence: scoreToConfidence(data.score),
        dimensions,
        snapshot_date: data.snapshot_date,
      }
    }

    // Compute fresh if no snapshot today
    return this.computeAndSave(tenantId)
  }

  async getHistory(tenantId: string, days = 30): Promise<Array<{ date: string; score: number }>> {
    const { data } = await supabase
      .from('data_health_snapshots')
      .select('snapshot_date, score')
      .eq('tenant_id', tenantId)
      .order('snapshot_date', { ascending: false })
      .limit(days)

    return (data || []).map((r) => ({ date: r.snapshot_date, score: r.score }))
  }

  // ─── Private computation ──────────────────────────────────────────────────

  private async compute(tenantId: string): Promise<DataHealthSnapshot> {
    const [
      mappingDim,
      completenessDim,
      consistencyDim,
      freshnessDim,
      uniquenessDim,
    ] = await Promise.all([
      this.mappingCoverage(tenantId),
      this.completeness(tenantId),
      this.consistency(tenantId),
      this.freshness(tenantId),
      this.uniqueness(tenantId),
    ])

    const dimensions = [mappingDim, completenessDim, consistencyDim, freshnessDim, uniquenessDim]
    const score = Math.round(
      dimensions.reduce((sum, d) => sum + d.score * (d.weight / 100), 0)
    )

    return {
      score,
      confidence: scoreToConfidence(score),
      dimensions,
      snapshot_date: new Date().toISOString().split('T')[0],
    }
  }

  /** Mapping Coverage (30%): What % of invoice_lines have product_id? */
  private async mappingCoverage(tenantId: string): Promise<DataHealthDimension> {
    const { count: total } = await supabase
      .from('invoice_lines')
      .select('id', { count: 'exact', head: true })

    const { count: mapped } = await supabase
      .from('invoice_lines')
      .select('id', { count: 'exact', head: true })
      .not('product_id', 'is', null)

    const pct = total && total > 0 ? Math.round(((mapped || 0) / total) * 100) : 100

    return {
      name: 'Mapping Coverage',
      score: pct,
      weight: 30,
      description: 'Invoice lines mapped to products',
      detail: `${mapped || 0} of ${total || 0} lines have product mapping`,
    }
  }

  /** Completeness (25%): What % of invoices have service_period_start/end? */
  private async completeness(tenantId: string): Promise<DataHealthDimension> {
    const { count: total } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .neq('status', 'void')

    const { count: complete } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .neq('status', 'void')
      .not('service_period_start', 'is', null)

    const pct = total && total > 0 ? Math.round(((complete || 0) / total) * 100) : 100

    return {
      name: 'Completeness',
      score: pct,
      weight: 25,
      description: 'Invoices with service period set',
      detail: `${complete || 0} of ${total || 0} invoices have service_period_start/end`,
    }
  }

  /** Consistency (25%): CRM company count vs billing company count */
  private async consistency(tenantId: string): Promise<DataHealthDimension> {
    const { count: allCompanies } = await supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    const { count: withHubspot } = await supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('hubspot_id', 'is', null)

    const pct = allCompanies && allCompanies > 0
      ? Math.round(((withHubspot || 0) / allCompanies) * 100)
      : 100

    return {
      name: 'CRM Consistency',
      score: pct,
      weight: 25,
      description: 'Companies linked to CRM (HubSpot)',
      detail: `${withHubspot || 0} of ${allCompanies || 0} companies have HubSpot ID`,
    }
  }

  /** Freshness (10%): How recent is the last import? */
  private async freshness(tenantId: string): Promise<DataHealthDimension> {
    const { data } = await supabase
      .from('import_files')
      .select('created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(1)

    let score = 0
    let detail = 'No imports found'

    if (data && data.length > 0) {
      const daysSinceImport = Math.floor(
        (Date.now() - new Date(data[0].created_at).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSinceImport <= 7) { score = 100; detail = `Last import ${daysSinceImport}d ago` }
      else if (daysSinceImport <= 30) { score = 75; detail = `Last import ${daysSinceImport}d ago` }
      else if (daysSinceImport <= 90) { score = 40; detail = `Last import ${daysSinceImport}d ago — stale` }
      else { score = 10; detail = `Last import ${daysSinceImport}d ago — very stale` }
    }

    return {
      name: 'Data Freshness',
      score,
      weight: 10,
      description: 'How recently was data imported',
      detail,
    }
  }

  /** Uniqueness (10%): What % of invoices are duplicates? */
  private async uniqueness(tenantId: string): Promise<DataHealthDimension> {
    const { data } = await supabase
      .from('invoices')
      .select('invoice_number, company_id')
      .eq('tenant_id', tenantId)
      .neq('status', 'void')

    if (!data || data.length === 0) {
      return {
        name: 'Uniqueness',
        score: 100,
        weight: 10,
        description: 'Duplicate invoice rate',
        detail: 'No invoices found',
      }
    }

    const seen = new Set<string>()
    let duplicates = 0
    for (const inv of data) {
      const key = `${inv.invoice_number}::${inv.company_id}`
      if (seen.has(key)) duplicates++
      else seen.add(key)
    }

    const pct = Math.round((1 - duplicates / data.length) * 100)
    return {
      name: 'Uniqueness',
      score: pct,
      weight: 10,
      description: 'Duplicate invoice rate',
      detail: duplicates === 0 ? 'No duplicates found' : `${duplicates} duplicate invoice(s) detected`,
    }
  }
}

function scoreToConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}

export const dataHealthService = new DataHealthService()
