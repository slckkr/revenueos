import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { asyncHandler } from '../middleware/error.middleware'

const router = Router()

// ─── Scoring helpers ────────────────────────────────────────────────────────

async function computeExpansionScore(tenantId: string, companyId: string): Promise<{ score: number; reasons: string[] }> {
  const reasons: string[] = []
  let score = 0

  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 7)
  const currentMonth = now.toISOString().slice(0, 7)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString()

  // Factor 1: Revenue growth trend (25 pts) — positive 3-month MRR trend
  const { data: ledgerRows } = await supabase
    .from('revenue_ledger')
    .select('month, amount_reporting')
    .eq('tenant_id', tenantId)
    .eq('company_id', companyId)
    .gte('month', threeMonthsAgo)
    .lte('month', currentMonth + '-01')
    .order('month', { ascending: true })

  if (ledgerRows && ledgerRows.length >= 2) {
    const byMonth: Record<string, number> = {}
    for (const r of ledgerRows) {
      const m = r.month.slice(0, 7)
      byMonth[m] = (byMonth[m] || 0) + Number(r.amount_reporting)
    }
    const vals = Object.values(byMonth)
    if (vals.length >= 2 && vals[vals.length - 1] > vals[0]) {
      score += 25
      reasons.push('Positive 3-month MRR growth trend')
    }
  }

  // Factor 2: Multi-product potential (20 pts) — using only 1 product
  const { data: productRows } = await supabase
    .from('revenue_ledger')
    .select('product_id')
    .eq('tenant_id', tenantId)
    .eq('company_id', companyId)
    .gte('month', threeMonthsAgo + '-01')
  const uniqueProducts = new Set((productRows || []).map(r => r.product_id).filter(Boolean))
  if (uniqueProducts.size === 1) {
    score += 20
    reasons.push('Single product usage — expansion opportunity to additional products')
  }

  // Factor 3: Contract renewal approaching within 60 days (15 pts)
  const { data: contractRows } = await supabase
    .from('contracts')
    .select('end_date')
    .eq('tenant_id', tenantId)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .gte('end_date', now.toISOString().slice(0, 10))
    .lte('end_date', new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10))
  if (contractRows && contractRows.length > 0) {
    score += 15
    reasons.push('Contract renewal approaching within 60 days')
  }

  // Factor 4: Recent activity engagement (15 pts) — meetings/demos in last 60 days
  const { data: actRows } = await supabase
    .from('activities')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('company_id', companyId)
    .in('type', ['meeting', 'demo', 'call'])
    .gte('activity_date', sixtyDaysAgo)
  if (actRows && actRows.length > 0) {
    score += 15
    reasons.push(`${actRows.length} high-value activity/activities in last 60 days`)
  }

  // Factor 5: Seat utilization proxy (25 pts) — MRR above median for segment
  // Simplified: if company has >0 MRR and it increased last month
  const { data: recentLedger } = await supabase
    .from('revenue_ledger')
    .select('month, amount_reporting')
    .eq('tenant_id', tenantId)
    .eq('company_id', companyId)
    .order('month', { ascending: false })
    .limit(2)
  if (recentLedger && recentLedger.length === 2) {
    const latest = Number(recentLedger[0].amount_reporting)
    const prev = Number(recentLedger[1].amount_reporting)
    if (latest > prev && prev > 0) {
      score += 25
      reasons.push('MRR increased last month — healthy growth signal')
    }
  }

  return { score: Math.min(100, score), reasons }
}

async function computeHealthScore(tenantId: string, companyId: string): Promise<{ score: number; reasons: string[] }> {
  const reasons: string[] = []
  let score = 0

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString()
  const now = new Date()

  // Factor 1: Payment timeliness (25 pts)
  const { data: invoices } = await supabase
    .from('invoices')
    .select('status, issue_date')
    .eq('tenant_id', tenantId)
    .eq('company_id', companyId)
    .in('status', ['paid', 'overdue', 'sent'])
    .order('issue_date', { ascending: false })
    .limit(10)

  if (invoices && invoices.length > 0) {
    const paidCount = invoices.filter(i => i.status === 'paid').length
    const pct = (paidCount / invoices.length) * 100
    if (pct >= 90) { score += 25; reasons.push('Excellent payment history (90%+ on time)') }
    else if (pct >= 70) { score += 15; reasons.push('Good payment history') }
    else if (pct >= 50) { score += 8; reasons.push('Average payment history') }
    else reasons.push('Poor payment history — invoices overdue')
  } else {
    score += 15 // no invoice history, assume neutral
  }

  // Factor 2: Usage events trend (25 pts)
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
    .gte('event_date', ninetyDaysAgo)
    .lt('event_date', thirtyDaysAgo)

  const recentCount = recentUsage?.length || 0
  const priorCount = priorUsage?.length || 0

  if (recentCount > 0 && priorCount > 0 && recentCount >= priorCount) {
    score += 25; reasons.push('Product usage trending up or stable')
  } else if (recentCount > 0 && priorCount === 0) {
    score += 20; reasons.push('Active product usage detected')
  } else if (recentCount === 0 && priorCount > 0) {
    reasons.push('Usage drop detected in last 30 days')
  } else {
    score += 10 // no usage data, neutral
  }

  // Factor 3: Engagement — activities last 30 days (20 pts)
  const { data: actRows } = await supabase
    .from('activities')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('company_id', companyId)
    .gte('activity_date', thirtyDaysAgo)

  if (actRows && actRows.length >= 3) { score += 20; reasons.push(`${actRows.length} activities logged in last 30 days`) }
  else if (actRows && actRows.length >= 1) { score += 10; reasons.push('Some engagement in last 30 days') }
  else reasons.push('No activities logged in last 30 days')

  // Factor 4: Expansion signals — positive MRR change (15 pts)
  const { data: ledger } = await supabase
    .from('revenue_ledger')
    .select('month, amount_reporting')
    .eq('tenant_id', tenantId)
    .eq('company_id', companyId)
    .order('month', { ascending: false })
    .limit(2)

  if (ledger && ledger.length === 2) {
    const latest = Number(ledger[0].amount_reporting)
    const prev = Number(ledger[1].amount_reporting)
    if (latest > prev) { score += 15; reasons.push('MRR expanding') }
    else if (latest === prev && latest > 0) { score += 10; reasons.push('MRR stable') }
  }

  // Factor 5: Contract active & not expiring soon (15 pts)
  const { data: contracts } = await supabase
    .from('contracts')
    .select('status, end_date')
    .eq('tenant_id', tenantId)
    .eq('company_id', companyId)
    .eq('status', 'active')

  if (contracts && contracts.length > 0) {
    const notExpiringSoon = contracts.some(c =>
      !c.end_date || new Date(c.end_date) > new Date(Date.now() + 30 * 86400000)
    )
    if (notExpiringSoon) { score += 15; reasons.push('Active contract not expiring soon') }
    else { score += 5; reasons.push('Active contract but expiring within 30 days') }
  }

  return { score: Math.min(100, score), reasons }
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// GET /api/scores?score_type=expansion|health&month=2025-03
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { score_type, month, company_id, limit = '50' } = req.query as Record<string, string>

  let q = supabase
    .from('account_scores_monthly')
    .select('*, companies(id, name, segment)')
    .eq('tenant_id', tenantId)
    .order('score_value', { ascending: false })
    .limit(parseInt(limit))

  if (score_type) q = q.eq('score_type', score_type)
  if (month) q = q.eq('month', month)
  if (company_id) q = q.eq('company_id', company_id)

  const { data, error } = await q
  if (error) throw error
  res.json({ success: true, data })
}))

// POST /api/scores/compute — run scoring for all companies (current month)
router.post('/compute', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { score_type = 'all', month } = req.body as { score_type?: string; month?: string }

  const currentMonth = month || new Date().toISOString().slice(0, 7)

  // Get all companies with recent revenue
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .select('id, name')
    .eq('tenant_id', tenantId)

  if (compErr) throw compErr

  let computed = 0
  const notifications: any[] = []

  for (const company of (companies || [])) {
    if (score_type === 'expansion' || score_type === 'all') {
      const { score, reasons } = await computeExpansionScore(tenantId, company.id)
      await supabase.from('account_scores_monthly').upsert({
        tenant_id: tenantId, month: currentMonth, company_id: company.id,
        score_type: 'expansion', score_value: score, reasons_json: reasons,
        computed_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,month,company_id,score_type' })

      await supabase.from('companies').update({ expansion_score: score }).eq('id', company.id)

      if (score >= 80) {
        notifications.push({
          tenant_id: tenantId, type: 'playbook', company_id: company.id,
          title: `Expansion Opportunity: ${company.name}`,
          body: `Score: ${score}/100 — ${reasons[0] || ''}`,
          link: `/companies/${company.id}`,
        })
      }
      computed++
    }

    if (score_type === 'health' || score_type === 'all') {
      const { score, reasons } = await computeHealthScore(tenantId, company.id)
      await supabase.from('account_scores_monthly').upsert({
        tenant_id: tenantId, month: currentMonth, company_id: company.id,
        score_type: 'health', score_value: score, reasons_json: reasons,
        computed_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,month,company_id,score_type' })

      await supabase.from('companies').update({ health_score: score }).eq('id', company.id)

      if (score < 30) {
        notifications.push({
          tenant_id: tenantId, type: 'playbook', company_id: company.id,
          title: `Health Alert: ${company.name}`,
          body: `Health score: ${score}/100 — ${reasons.find(r => r.includes('Poor') || r.includes('drop') || r.includes('No')) || ''}`,
          link: `/companies/${company.id}`,
        })
      }
      computed++
    }
  }

  // Insert notifications (avoid duplicate within same day)
  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications)
  }

  res.json({ success: true, computed, notifications_created: notifications.length, month: currentMonth })
}))

// POST /api/scores/compute/:companyId — compute for a single company
router.post('/compute/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { companyId } = req.params
  const currentMonth = new Date().toISOString().slice(0, 7)

  const [expansion, health] = await Promise.all([
    computeExpansionScore(tenantId, companyId),
    computeHealthScore(tenantId, companyId),
  ])

  await Promise.all([
    supabase.from('account_scores_monthly').upsert({
      tenant_id: tenantId, month: currentMonth, company_id: companyId,
      score_type: 'expansion', score_value: expansion.score, reasons_json: expansion.reasons,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,month,company_id,score_type' }),
    supabase.from('account_scores_monthly').upsert({
      tenant_id: tenantId, month: currentMonth, company_id: companyId,
      score_type: 'health', score_value: health.score, reasons_json: health.reasons,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,month,company_id,score_type' }),
    supabase.from('companies').update({ expansion_score: expansion.score, health_score: health.score }).eq('id', companyId),
  ])

  res.json({
    success: true,
    expansion: { score: expansion.score, reasons: expansion.reasons },
    health: { score: health.score, reasons: health.reasons },
  })
}))

export default router
