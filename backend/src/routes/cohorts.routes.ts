import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'

const router = Router()

// GET /cohorts/acquisition?months=12
// Groups companies by their creation month (acquisition cohort)
// Returns retention % and MRR over time for each cohort
router.get('/acquisition', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const months = Math.min(parseInt((req.query.months as string) || '12'), 24)

  // Get companies with created_at
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .select('id, created_at')
    .eq('tenant_id', tenantId)
    .not('created_at', 'is', null)
    .order('created_at')

  if (compErr) throw new AppError(compErr.message, 500, 'DB_ERROR')

  // Get all ledger data
  const { data: ledger } = await supabase
    .from('revenue_ledger')
    .select('company_id, month, amount_reporting')
    .eq('tenant_id', tenantId)
    .order('month')

  // Group companies by acquisition month
  const cohortMap: Record<string, string[]> = {}
  for (const c of companies || []) {
    const month = c.created_at.substring(0, 7) // YYYY-MM
    if (!cohortMap[month]) cohortMap[month] = []
    cohortMap[month].push(c.id)
  }

  // For each cohort, compute retention % per subsequent month
  const cohorts = Object.entries(cohortMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-months) // last N months
    .map(([cohortMonth, companyIds]) => {
      const ledgerByCompany: Record<string, Record<string, number>> = {}
      for (const row of ledger || []) {
        if (!companyIds.includes(row.company_id)) continue
        const m = row.month.substring(0, 7)
        if (!ledgerByCompany[row.company_id]) ledgerByCompany[row.company_id] = {}
        ledgerByCompany[row.company_id][m] = (ledgerByCompany[row.company_id][m] || 0) + Number(row.amount_reporting)
      }

      // Generate month sequence from cohort month
      const periods: { period: number; month: string; retention: number; mrr: number; active: number }[] = []
      for (let i = 0; i < 12; i++) {
        const d = new Date(cohortMonth + '-01')
        d.setMonth(d.getMonth() + i)
        const m = d.toISOString().substring(0, 7)

        const activeCompanies = companyIds.filter((id) => (ledgerByCompany[id]?.[m] || 0) > 0)
        const mrr = activeCompanies.reduce((s, id) => s + (ledgerByCompany[id]?.[m] || 0), 0)

        periods.push({
          period: i,
          month: m,
          active: activeCompanies.length,
          retention: companyIds.length > 0 ? Math.round((activeCompanies.length / companyIds.length) * 1000) / 10 : 0,
          mrr: Math.round(mrr),
        })
      }

      return {
        cohort_month: cohortMonth,
        size: companyIds.length,
        periods,
      }
    })

  res.json({ success: true, data: cohorts })
}))

// GET /cohorts/revenue?months=12
// Groups companies by their initial MRR band
router.get('/revenue', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const months = Math.min(parseInt((req.query.months as string) || '12'), 24)

  // Get ledger data
  const { data: ledger, error } = await supabase
    .from('revenue_ledger')
    .select('company_id, month, amount_reporting')
    .eq('tenant_id', tenantId)
    .order('month')

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  // Find first month MRR per company
  const firstMrrMap: Record<string, { month: string; mrr: number }> = {}
  const mrrByCompanyMonth: Record<string, Record<string, number>> = {}

  for (const row of ledger || []) {
    const m = row.month.substring(0, 7)
    if (!mrrByCompanyMonth[row.company_id]) mrrByCompanyMonth[row.company_id] = {}
    mrrByCompanyMonth[row.company_id][m] = (mrrByCompanyMonth[row.company_id][m] || 0) + Number(row.amount_reporting)
  }

  for (const [cid, monthMap] of Object.entries(mrrByCompanyMonth)) {
    const sortedMonths = Object.keys(monthMap).sort()
    const firstMonth = sortedMonths[0]
    const firstMrr = monthMap[firstMonth]
    if (firstMrr > 0) firstMrrMap[cid] = { month: firstMonth, mrr: firstMrr }
  }

  // Bands: $0-500, $500-2K, $2K-10K, $10K+
  const bands = [
    { label: '$0–$500', min: 0, max: 500 },
    { label: '$500–$2K', min: 500, max: 2000 },
    { label: '$2K–$10K', min: 2000, max: 10000 },
    { label: '$10K+', min: 10000, max: Infinity },
  ]

  // Get all months in range
  const allMonths = [...new Set((ledger || []).map((r) => r.month.substring(0, 7)))].sort().slice(-months)

  const result = bands.map((band) => {
    const bandCompanies = Object.entries(firstMrrMap)
      .filter(([, { mrr }]) => mrr >= band.min && mrr < band.max)
      .map(([id]) => id)

    const trend = allMonths.map((m) => {
      const activeMrr = bandCompanies.reduce((s, id) => s + (mrrByCompanyMonth[id]?.[m] || 0), 0)
      return { month: m, mrr: Math.round(activeMrr), active: bandCompanies.filter((id) => (mrrByCompanyMonth[id]?.[m] || 0) > 0).length }
    })

    return { band: band.label, size: bandCompanies.length, trend }
  })

  res.json({ success: true, data: result })
}))

export default router
