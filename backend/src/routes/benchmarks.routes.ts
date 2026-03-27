import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { asyncHandler } from '../middleware/error.middleware'

const router = Router()

const METRIC_LABELS: Record<string, string> = {
  nrr: 'Net Revenue Retention',
  grr: 'Gross Revenue Retention',
  logo_churn_rate: 'Logo Churn Rate',
  quick_ratio: 'Quick Ratio',
  arpa: 'ARPA ($/mo)',
  ltv_cac_ratio: 'LTV/CAC Ratio',
  cac_payback_months: 'CAC Payback (months)',
  rule_of_40: 'Rule of 40',
  revenue_per_employee: 'Revenue per Employee',
  magic_number: 'Magic Number',
}

const METRIC_UNITS: Record<string, string> = {
  nrr: '%', grr: '%', logo_churn_rate: '%', quick_ratio: 'x',
  arpa: '$', ltv_cac_ratio: 'x', cac_payback_months: 'mo',
  rule_of_40: '%', revenue_per_employee: '$', magic_number: 'x',
}

const METRIC_HIGHER_IS_BETTER: Record<string, boolean> = {
  nrr: true, grr: true, quick_ratio: true, arpa: true,
  ltv_cac_ratio: true, rule_of_40: true, revenue_per_employee: true, magic_number: true,
  logo_churn_rate: false, cac_payback_months: false,
}

// GET /api/benchmarks?cohort=global:saas
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const cohort = (req.query.cohort as string) || 'global:saas'

  const { data: benchmarks, error } = await supabase
    .from('benchmark_aggregates')
    .select('*')
    .eq('cohort_key', cohort)
    .order('metric_key')

  if (error) throw error

  // Fetch tenant's own current metrics for comparison
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01'
  const prevMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 7) + '-01'

  const { data: snapshots } = await supabase
    .from('metric_snapshots')
    .select('metric_key, value')
    .eq('tenant_id', tenantId)
    .in('month', [currentMonth, prevMonth])
    .is('segment_id', null)
    .is('product_id', null)
    .is('company_id', null)
    .order('month', { ascending: false })

  // Use latest available value per metric_key
  const myMetrics: Record<string, number> = {}
  for (const snap of (snapshots || [])) {
    if (!(snap.metric_key in myMetrics)) {
      myMetrics[snap.metric_key] = Number(snap.value)
    }
  }

  // Enrich benchmarks with your own value and percentile position
  const enriched = (benchmarks || []).map((b: any) => {
    const myVal = myMetrics[b.metric_key]
    let percentile: string | null = null
    let position: 'top' | 'above_median' | 'below_median' | 'bottom' | null = null
    const higherBetter = METRIC_HIGHER_IS_BETTER[b.metric_key] ?? true

    if (myVal !== undefined && b.p25 != null && b.p50 != null && b.p75 != null) {
      if (higherBetter) {
        if (myVal >= b.p75) { percentile = 'Top 25%'; position = 'top' }
        else if (myVal >= b.p50) { percentile = 'Above median'; position = 'above_median' }
        else if (myVal >= b.p25) { percentile = 'Below median'; position = 'below_median' }
        else { percentile = 'Bottom 25%'; position = 'bottom' }
      } else {
        if (myVal <= b.p25) { percentile = 'Top 25%'; position = 'top' }
        else if (myVal <= b.p50) { percentile = 'Above median'; position = 'above_median' }
        else if (myVal <= b.p75) { percentile = 'Below median'; position = 'below_median' }
        else { percentile = 'Bottom 25%'; position = 'bottom' }
      }
    }

    return {
      ...b,
      label: METRIC_LABELS[b.metric_key] || b.metric_key,
      unit: METRIC_UNITS[b.metric_key] || '',
      higher_is_better: higherBetter,
      my_value: myVal ?? null,
      percentile,
      position,
    }
  })

  // Available cohorts for UI dropdown
  const { data: cohortRows } = await supabase
    .from('benchmark_aggregates')
    .select('cohort_key')
    .order('cohort_key')

  const cohorts = [...new Set((cohortRows || []).map((r: any) => r.cohort_key))]

  res.json({ success: true, data: enriched, cohort, available_cohorts: cohorts })
}))

// GET /api/benchmarks/opt-in
router.get('/opt-in', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { data } = await supabase
    .from('benchmark_optins')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  res.json({ success: true, data: data || { tenant_id: tenantId, enabled: false, enabled_at: null } })
}))

// POST /api/benchmarks/opt-in
router.post('/opt-in', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { enabled } = req.body as { enabled: boolean }

  const { data, error } = await supabase
    .from('benchmark_optins')
    .upsert({
      tenant_id: tenantId,
      enabled: enabled ?? true,
      enabled_at: enabled ? new Date().toISOString() : null,
    }, { onConflict: 'tenant_id' })
    .select()
    .single()

  if (error) throw error
  res.json({ success: true, data })
}))

// GET /api/benchmarks/cohorts — list all available cohort keys
router.get('/cohorts', asyncHandler(async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('benchmark_aggregates')
    .select('cohort_key')
    .order('cohort_key')

  if (error) throw error
  const cohorts = [...new Set((data || []).map((r: any) => r.cohort_key))]

  const labeled = cohorts.map(k => ({
    key: k,
    label: k
      .replace('global:saas', 'All SaaS')
      .replace('arr_range:sub_1m', 'ARR < $1M')
      .replace('arr_range:1m_10m', 'ARR $1M–$10M')
      .replace('arr_range:10m_50m', 'ARR $10M–$50M')
      .replace('arr_range:50m_plus', 'ARR $50M+')
      .replace('segment:smb', 'SMB Segment')
      .replace('segment:mid', 'Mid-Market Segment')
      .replace('segment:ent', 'Enterprise Segment'),
  }))

  res.json({ success: true, data: labeled })
}))

export default router
