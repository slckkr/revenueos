import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { asyncHandler } from '../middleware/error.middleware'

const router = Router()

// ─── Churn Risk Scoring Engine ───────────────────────────────────────────────
// 6 signals, max 100 points

async function computeChurnRiskScore(
  tenantId: string,
  companyId: string
): Promise<{ score: number; reasons: string[]; mrr: number }> {
  let score = 0
  const reasons: string[] = []

  const now = new Date()
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  // Signal 1: MRR contraction last 2 months (+25 pts)
  const { data: ledger } = await supabase
    .from('revenue_ledger')
    .select('month, amount_reporting')
    .eq('tenant_id', tenantId)
    .eq('company_id', companyId)
    .order('month', { ascending: false })
    .limit(3)

  let currentMrr = 0
  if (ledger && ledger.length >= 2) {
    const byMonth: Record<string, number> = {}
    for (const r of ledger) {
      const m = r.month.slice(0, 7)
      byMonth[m] = (byMonth[m] || 0) + Number(r.amount_reporting)
    }
    const months = Object.keys(byMonth).sort().reverse()
    currentMrr = byMonth[months[0]] || 0

    if (months.length >= 3) {
      const m0 = byMonth[months[0]] || 0
      const m1 = byMonth[months[1]] || 0
      const m2 = byMonth[months[2]] || 0
      if (m0 < m1 && m1 < m2) {
        score += 25
        reasons.push('MRR contraction for 2 consecutive months')
      } else if (m0 < m1) {
        score += 10
        reasons.push('MRR contraction last month')
      }
    } else if (months.length === 2) {
      currentMrr = byMonth[months[0]] || 0
      if (byMonth[months[0]] < byMonth[months[1]]) {
        score += 10
        reasons.push('MRR contraction last month')
      }
    }
  }

  // Signal 2: Payment delay > 30 days (+20 pts)
  const { data: overdueInvoices } = await supabase
    .from('invoices')
    .select('id, issue_date, status')
    .eq('tenant_id', tenantId)
    .eq('company_id', companyId)
    .eq('status', 'overdue')
    .order('issue_date', { ascending: false })
    .limit(5)

  if (overdueInvoices && overdueInvoices.length > 0) {
    const oldest = overdueInvoices[overdueInvoices.length - 1]
    const daysDue = Math.floor((Date.now() - new Date(oldest.issue_date).getTime()) / 86400000)
    if (daysDue > 30) {
      score += 20
      reasons.push(`Overdue invoice(s) — ${daysDue} days past due`)
    } else {
      score += 8
      reasons.push('Invoice(s) overdue')
    }
  }

  // Signal 3: Activity drop — no meetings/calls/demos in 60 days (+15 pts)
  const { data: recentActivities } = await supabase
    .from('activities')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('company_id', companyId)
    .in('type', ['meeting', 'call', 'demo'])
    .gte('activity_date', sixtyDaysAgo)

  if (!recentActivities || recentActivities.length === 0) {
    score += 15
    reasons.push('No meetings, calls, or demos in the last 60 days')
  }

  // Signal 4: Usage drop > 30% month-over-month (+15 pts)
  const { data: recentUsage } = await supabase
    .from('usage_events')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('company_id', companyId)
    .gte('event_date', thirtyDaysAgo)

  const { data: priorUsage } = await supabase
    .from('usage_events')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('company_id', companyId)
    .gte('event_date', new Date(Date.now() - 60 * 86400000).toISOString())
    .lt('event_date', thirtyDaysAgo)

  const recentCount = recentUsage?.length || 0
  const priorCount = priorUsage?.length || 0

  if (priorCount > 0 && recentCount < priorCount * 0.7) {
    score += 15
    const drop = Math.round(((priorCount - recentCount) / priorCount) * 100)
    reasons.push(`Product usage dropped ${drop}% month-over-month`)
  }

  // Signal 5: Contract expiring within 30 days with no renewal signed (+10 pts)
  const { data: expiringContracts } = await supabase
    .from('contracts')
    .select('id, end_date, auto_renewal')
    .eq('tenant_id', tenantId)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .lte('end_date', in30Days)
    .gte('end_date', now.toISOString().slice(0, 10))

  if (expiringContracts && expiringContracts.length > 0) {
    const noAutoRenewal = expiringContracts.some(c => !c.auto_renewal)
    if (noAutoRenewal) {
      score += 10
      reasons.push('Contract expiring within 30 days — no auto-renewal')
    }
  }

  // Signal 6: No notes written in last 60 days (+15 pts — indicates neglect)
  const { data: recentNotes } = await supabase
    .from('notes')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('object_type', 'company')
    .eq('object_id', companyId)
    .gte('created_at', sixtyDaysAgo)

  if (!recentNotes || recentNotes.length === 0) {
    // Only add if we already have some other risk signals (avoid penalizing new accounts)
    if (score > 0) {
      score += 15
      reasons.push('No notes or internal communication logged in last 60 days')
    }
  }

  return { score: Math.min(100, score), reasons, mrr: currentMrr }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/churn-risk?month=2025-03&min_score=0&limit=50
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { month, min_score = '0', limit = '100', company_id } = req.query as Record<string, string>

  const targetMonth = month || new Date().toISOString().slice(0, 7)

  let q = supabase
    .from('account_scores_monthly')
    .select('*, companies(id, name, segment, health_score, expansion_score)')
    .eq('tenant_id', tenantId)
    .eq('score_type', 'churn_risk')
    .eq('month', targetMonth)
    .gte('score_value', parseFloat(min_score))
    .order('score_value', { ascending: false })
    .limit(parseInt(limit))

  if (company_id) q = q.eq('company_id', company_id)

  const { data, error } = await q
  if (error) throw error

  // Calculate revenue at risk
  const enriched = (data || []).map((row: any) => ({
    ...row,
    risk_category: row.score_value >= 70 ? 'high' : row.score_value >= 40 ? 'medium' : 'low',
  }))

  const totalAtRisk = enriched.filter((r: any) => r.score_value >= 70).length
  res.json({ success: true, data: enriched, meta: { month: targetMonth, total_at_risk: totalAtRisk } })
}))

// POST /api/churn-risk/compute — compute for all companies
router.post('/compute', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { month } = req.body as { month?: string }
  const currentMonth = month || new Date().toISOString().slice(0, 7)

  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .select('id, name')
    .eq('tenant_id', tenantId)

  if (compErr) throw compErr

  let computed = 0
  const highRiskNotifications: any[] = []

  for (const company of (companies || [])) {
    const { score, reasons, mrr } = await computeChurnRiskScore(tenantId, company.id)

    await supabase.from('account_scores_monthly').upsert({
      tenant_id: tenantId, month: currentMonth, company_id: company.id,
      score_type: 'churn_risk', score_value: score, reasons_json: reasons,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,month,company_id,score_type' })

    if (score >= 70) {
      const mrrAtRisk = Math.round(mrr * (score / 100))
      highRiskNotifications.push({
        tenant_id: tenantId, type: 'anomaly', company_id: company.id,
        title: `High Churn Risk: ${company.name}`,
        body: `Score ${score}/100 — Est. $${mrrAtRisk.toLocaleString()} MRR at risk. ${reasons[0] || ''}`,
        link: `/companies/${company.id}`,
      })
    }
    computed++
  }

  if (highRiskNotifications.length > 0) {
    await supabase.from('notifications').insert(highRiskNotifications)
  }

  res.json({ success: true, computed, high_risk: highRiskNotifications.length, month: currentMonth })
}))

// POST /api/churn-risk/compute/:companyId
router.post('/compute/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { companyId } = req.params
  const currentMonth = new Date().toISOString().slice(0, 7)

  const { score, reasons, mrr } = await computeChurnRiskScore(tenantId, companyId)

  await supabase.from('account_scores_monthly').upsert({
    tenant_id: tenantId, month: currentMonth, company_id: companyId,
    score_type: 'churn_risk', score_value: score, reasons_json: reasons,
    computed_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id,month,company_id,score_type' })

  const mrrAtRisk = Math.round(mrr * (score / 100))
  res.json({ success: true, score, reasons, mrr, mrr_at_risk: mrrAtRisk, month: currentMonth })
}))

export default router
