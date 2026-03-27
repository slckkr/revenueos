import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { asyncHandler } from '../middleware/error.middleware'

const router = Router()

// GET /api/reports/board-snapshot?month=2025-03
router.get('/board-snapshot', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7)
  const monthDate = month + '-01'
  const prevMonthDate = new Date(new Date(monthDate).getFullYear(), new Date(monthDate).getMonth() - 1, 1)
    .toISOString().slice(0, 10)

  // ── Core Metrics ──────────────────────────────────────────────────────────
  const { data: snapshots } = await supabase
    .from('metric_snapshots')
    .select('metric_key, value')
    .eq('tenant_id', tenantId)
    .in('month', [monthDate, prevMonthDate])
    .is('segment_id', null)
    .is('product_id', null)
    .is('company_id', null)
    .order('month', { ascending: false })

  const current: Record<string, number> = {}
  const prior: Record<string, number> = {}
  for (const s of (snapshots || [])) {
    const m = (s as any).month || ''
    if (m.startsWith(month)) current[s.metric_key] = Number(s.value)
    else prior[s.metric_key] = Number(s.value)
  }

  // Fallback: compute from ledger
  const { data: ledger } = await supabase
    .from('revenue_ledger')
    .select('month, amount_reporting, event_type')
    .eq('tenant_id', tenantId)
    .gte('month', prevMonthDate)
    .lte('month', monthDate)

  let currentMrr = current['mrr'] || 0
  let prevMrr = prior['mrr'] || 0
  if (!currentMrr && ledger) {
    const byMonth: Record<string, number> = {}
    for (const r of ledger) {
      const m = (r.month as string).slice(0, 7)
      byMonth[m] = (byMonth[m] || 0) + Number(r.amount_reporting)
    }
    currentMrr = byMonth[month] || 0
    prevMrr = byMonth[prevMonthDate.slice(0, 7)] || 0
  }

  const arr = currentMrr * 12
  const mrrGrowth = prevMrr > 0 ? ((currentMrr - prevMrr) / prevMrr) * 100 : 0

  // ── Churn Risk Summary ────────────────────────────────────────────────────
  const { data: churnScores } = await supabase
    .from('account_scores_monthly')
    .select('score_value, company_id')
    .eq('tenant_id', tenantId)
    .eq('score_type', 'churn_risk')
    .eq('month', month)
    .gte('score_value', 70)

  const highRiskCount = churnScores?.length || 0

  // ── Expansion Opportunities ───────────────────────────────────────────────
  const { data: expansionScores } = await supabase
    .from('account_scores_monthly')
    .select('score_value, company_id')
    .eq('tenant_id', tenantId)
    .eq('score_type', 'expansion')
    .eq('month', month)
    .gte('score_value', 80)

  const expansionCount = expansionScores?.length || 0

  // ── MRR Trend (6 months) ──────────────────────────────────────────────────
  const { data: trendLedger } = await supabase
    .from('revenue_ledger')
    .select('month, amount_reporting')
    .eq('tenant_id', tenantId)
    .order('month', { ascending: true })
    .limit(500)

  const trendByMonth: Record<string, number> = {}
  for (const r of (trendLedger || [])) {
    const m = (r.month as string).slice(0, 7)
    trendByMonth[m] = (trendByMonth[m] || 0) + Number(r.amount_reporting)
  }
  const trendMonths = Object.keys(trendByMonth).sort().slice(-6)
  const mrrTrend = trendMonths.map(m => ({ month: m, mrr: Math.round(trendByMonth[m]) }))

  // ── Open Pipeline ─────────────────────────────────────────────────────────
  const { data: openDeals } = await supabase
    .from('deals')
    .select('amount, probability')
    .eq('tenant_id', tenantId)
    .eq('status', 'open')

  const weightedPipeline = (openDeals || []).reduce((sum, d) => {
    return sum + (Number(d.amount) || 0) * ((Number(d.probability) || 50) / 100)
  }, 0)

  // ── Upcoming Renewals ─────────────────────────────────────────────────────
  const in60Days = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)
  const { data: renewals } = await supabase
    .from('contracts')
    .select('end_date, total_value, companies(name)')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .gte('end_date', new Date().toISOString().slice(0, 10))
    .lte('end_date', in60Days)
    .order('end_date', { ascending: true })
    .limit(5)

  // ── Top At-Risk Accounts ──────────────────────────────────────────────────
  const { data: topRisk } = await supabase
    .from('account_scores_monthly')
    .select('score_value, reasons_json, companies(id, name)')
    .eq('tenant_id', tenantId)
    .eq('score_type', 'churn_risk')
    .eq('month', month)
    .order('score_value', { ascending: false })
    .limit(5)

  // ── Top Expansion Opportunities ───────────────────────────────────────────
  const { data: topExpansion } = await supabase
    .from('account_scores_monthly')
    .select('score_value, reasons_json, companies(id, name)')
    .eq('tenant_id', tenantId)
    .eq('score_type', 'expansion')
    .eq('month', month)
    .order('score_value', { ascending: false })
    .limit(5)

  const snapshot = {
    month,
    generated_at: new Date().toISOString(),
    // ARR Summary
    mrr: Math.round(currentMrr),
    arr: Math.round(arr),
    mrr_growth_pct: Math.round(mrrGrowth * 10) / 10,
    // Retention
    nrr: current['nrr'] || null,
    grr: current['grr'] || null,
    logo_churn_rate: current['logo_churn_rate'] || null,
    // Efficiency
    quick_ratio: current['quick_ratio'] || null,
    rule_of_40: current['rule_of_40'] || null,
    // AI Signals
    high_risk_accounts: highRiskCount,
    expansion_ready_accounts: expansionCount,
    // Pipeline
    weighted_pipeline: Math.round(weightedPipeline),
    open_deals_count: openDeals?.length || 0,
    // Trends
    mrr_trend: mrrTrend,
    // Details
    top_at_risk: topRisk || [],
    top_expansion: topExpansion || [],
    upcoming_renewals: renewals || [],
  }

  res.json({ success: true, data: snapshot })
}))

// GET /api/reports/scheduled
router.get('/scheduled', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { data, error } = await supabase
    .from('scheduled_reports')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  res.json({ success: true, data })
}))

// POST /api/reports/scheduled
router.post('/scheduled', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { name, report_type, cron_expr, recipients_json } = req.body

  if (!name || !report_type) {
    return res.status(400).json({ success: false, error: { message: 'name and report_type required' } })
  }

  const { data, error } = await supabase
    .from('scheduled_reports')
    .insert({
      tenant_id: tenantId, name, report_type,
      cron_expr: cron_expr || null,
      recipients_json: recipients_json || [],
      is_active: false, // placeholder — enable when cron impl done
    })
    .select()
    .single()

  if (error) throw error
  res.status(201).json({ success: true, data, note: 'Scheduled reports are a placeholder — cron execution coming in Phase 7' })
}))

// DELETE /api/reports/scheduled/:id
router.delete('/scheduled/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { error } = await supabase
    .from('scheduled_reports')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
  if (error) throw error
  res.json({ success: true })
}))

export default router
