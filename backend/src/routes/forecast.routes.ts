import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { asyncHandler } from '../middleware/error.middleware'

const router = Router()

// ─── Forecasting helpers ──────────────────────────────────────────────────────

function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.y || 0 }
  const sumX = points.reduce((a, p) => a + p.x, 0)
  const sumY = points.reduce((a, p) => a + p.y, 0)
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0)
  const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + '-01')
  d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 7)
}

// GET /api/forecast/revenue?months=3
router.get('/revenue', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const forecastMonths = Math.min(parseInt((req.query.months as string) || '3'), 12)

  // ── Method 1: Linear trend from last 6 months MRR ──────────────────────────
  const { data: ledgerRaw } = await supabase
    .from('revenue_ledger')
    .select('month, amount_reporting')
    .eq('tenant_id', tenantId)
    .order('month', { ascending: true })
    .limit(500)

  const mrrByMonth: Record<string, number> = {}
  for (const r of (ledgerRaw || [])) {
    const m = (r.month as string).slice(0, 7)
    mrrByMonth[m] = (mrrByMonth[m] || 0) + Number(r.amount_reporting)
  }

  const sortedMonths = Object.keys(mrrByMonth).sort()
  const last6 = sortedMonths.slice(-6)
  const historicalPoints = last6.map((m, i) => ({ x: i, y: mrrByMonth[m] }))
  const { slope: trendSlope, intercept: trendIntercept } = linearRegression(historicalPoints)
  const lastActualMrr = mrrByMonth[last6[last6.length - 1]] || 0
  const lastMonthKey = last6[last6.length - 1] || new Date().toISOString().slice(0, 7)

  // ── Method 2: Pipeline-weighted (open deals × probability) ─────────────────
  const { data: openDeals } = await supabase
    .from('deals')
    .select('amount, currency, probability, expected_close_date')
    .eq('tenant_id', tenantId)
    .eq('status', 'open')
    .not('expected_close_date', 'is', null)

  const pipelineMrr: Record<string, number> = {}
  for (let i = 1; i <= forecastMonths; i++) {
    pipelineMrr[addMonths(lastMonthKey, i)] = 0
  }
  for (const deal of (openDeals || [])) {
    if (!deal.expected_close_date || !deal.amount) continue
    const closeMonth = (deal.expected_close_date as string).slice(0, 7)
    const prob = (deal.probability ?? 50) / 100
    const annualValue = Number(deal.amount) * prob
    const monthlyImpact = annualValue / 12
    if (pipelineMrr[closeMonth] !== undefined) {
      pipelineMrr[closeMonth] += monthlyImpact
    }
  }

  // ── Method 3: Renewal-based ─────────────────────────────────────────────────
  const cutoff = addMonths(lastMonthKey, forecastMonths)
  const { data: expiringContracts } = await supabase
    .from('contracts')
    .select('end_date, total_value, auto_renewal, renewal_term_months, currency')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .gt('end_date', lastMonthKey + '-01')
    .lte('end_date', cutoff + '-31')

  const renewalMrr: Record<string, number> = {}
  for (let i = 1; i <= forecastMonths; i++) {
    renewalMrr[addMonths(lastMonthKey, i)] = 0
  }
  for (const c of (expiringContracts || [])) {
    if (!c.end_date || !c.total_value) continue
    const endMonth = (c.end_date as string).slice(0, 7)
    const renewalProb = c.auto_renewal ? 0.95 : 0.70
    const termMonths = (c.renewal_term_months as number) || 12
    const monthlyValue = (Number(c.total_value) * renewalProb) / termMonths
    if (renewalMrr[endMonth] !== undefined) {
      renewalMrr[endMonth] = (renewalMrr[endMonth] || 0) + monthlyValue
    }
  }

  // ── Combine: weighted average (50% trend, 30% pipeline, 20% renewal) ────────
  const forecasted = []
  for (let i = 1; i <= forecastMonths; i++) {
    const month = addMonths(lastMonthKey, i)
    const trendVal = Math.max(0, trendIntercept + trendSlope * (historicalPoints.length - 1 + i))
    const pipeVal = (pipelineMrr[month] || 0) + lastActualMrr  // additive
    const renewVal = (renewalMrr[month] || 0) + lastActualMrr  // additive

    const combined = trendVal * 0.50 + pipeVal * 0.30 + renewVal * 0.20
    forecasted.push({
      month,
      forecast_mrr: Math.round(combined),
      trend_mrr: Math.round(trendVal),
      pipeline_mrr: Math.round(pipeVal),
      renewal_mrr: Math.round(renewVal),
      is_forecast: true,
    })
  }

  // ── Build response: actual + projected ──────────────────────────────────────
  const actual = sortedMonths.map(m => ({
    month: m,
    mrr: Math.round(mrrByMonth[m]),
    is_forecast: false,
  }))

  // Growth rate
  const firstMrr = mrrByMonth[sortedMonths[0]] || 1
  const cagr = sortedMonths.length > 1
    ? ((lastActualMrr / firstMrr) ** (1 / Math.max(sortedMonths.length - 1, 1)) - 1) * 100
    : 0

  const endForecast = forecasted[forecasted.length - 1]?.forecast_mrr || lastActualMrr
  const expectedGrowth = lastActualMrr > 0
    ? ((endForecast - lastActualMrr) / lastActualMrr) * 100
    : 0

  res.json({
    success: true,
    actual,
    forecasted,
    summary: {
      last_actual_mrr: Math.round(lastActualMrr),
      forecast_end_mrr: Math.round(endForecast),
      expected_growth_pct: Math.round(expectedGrowth * 10) / 10,
      historical_cagr_pct: Math.round(cagr * 10) / 10,
      methods: {
        trend_weight: '50%',
        pipeline_weight: '30%',
        renewal_weight: '20%',
      },
    },
  })
}))

export default router
