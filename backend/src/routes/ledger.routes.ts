import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'
import { revenueRecognitionService } from '../services/revenue-recognition.service'
import { revenueEventsService } from '../services/revenue-events.service'
import logger from '../logger'

const router = Router()

// GET /ledger — filtered ledger entries
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { month, company_id, event_type, page = '1', limit = '100', sort = 'month', order = 'desc' } = req.query as Record<string, string>
  const ascending = order === 'asc'
  const DIRECT_SORTS: Record<string, true> = { month: true, event_type: true, amount_original: true, amount_reporting: true }

  let query = supabase
    .from('revenue_ledger')
    .select('*, companies(name), products(name)', { count: 'exact' })
    .eq('tenant_id', tenantId)

  if (DIRECT_SORTS[sort]) {
    query = query.order(sort, { ascending })
    if (sort !== 'amount_reporting') query = query.order('amount_reporting', { ascending: false })
  } else if (sort === 'company_name') {
    query = query.order('name', { referencedTable: 'companies', ascending })
  } else {
    query = query.order('month', { ascending: false }).order('amount_reporting', { ascending: false })
  }

  if (month) query = query.eq('month', `${month}-01`.replace(/(-01)+$/, '-01'))
  if (company_id) query = query.eq('company_id', company_id)
  if (event_type) query = query.eq('event_type', event_type)

  const from = (parseInt(page) - 1) * parseInt(limit)
  query = query.range(from, from + parseInt(limit) - 1)

  const { data, error, count } = await query
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data, meta: { total: count, page: parseInt(page), limit: parseInt(limit) } })
}))

// POST /ledger — manual ledger entry
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { company_id, product_id, month, event_type, amount_original, currency, fx_rate, amount_reporting, recognition_method } = req.body

  if (!company_id || !month || !event_type || amount_original === undefined) {
    throw new AppError('company_id, month, event_type, amount_original are required', 400, 'VALIDATION_ERROR')
  }

  const { data, error } = await supabase
    .from('revenue_ledger')
    .insert({
      tenant_id: tenantId,
      company_id,
      product_id: product_id || null,
      month,
      event_type,
      amount_original: Number(amount_original),
      currency: currency || 'USD',
      fx_rate: Number(fx_rate || 1),
      amount_reporting: Number(amount_reporting ?? amount_original),
      recognition_method: recognition_method || 'accrual',
      source_type: 'manual',
    })
    .select('*, companies(name), products(name)')
    .single()

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.status(201).json({ success: true, data })
}))

// PATCH /ledger/:id — update individual ledger entry
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const allowed = ['event_type', 'amount_original', 'currency', 'fx_rate', 'amount_reporting', 'recognition_method', 'product_id']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in req.body) update[key] = req.body[key]
  }

  if (Object.keys(update).length === 0) throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR')

  const { data, error } = await supabase
    .from('revenue_ledger')
    .update(update)
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select('*, companies(name), products(name)')
    .single()

  if (error || !data) throw new AppError('Ledger entry not found', 404, 'NOT_FOUND')
  res.json({ success: true, data })
}))

// DELETE /ledger/bulk
router.delete('/bulk', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0) throw new AppError('ids array required', 400, 'VALIDATION_ERROR')
  const { error } = await supabase.from('revenue_ledger').delete().in('id', ids).eq('tenant_id', tenantId)
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.json({ success: true, deleted: ids.length })
}))

// DELETE /ledger/:id — delete individual ledger entry
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { error } = await supabase
    .from('revenue_ledger')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.json({ success: true })
}))

// POST /ledger/rebuild — re-run revenue engine for a month range
router.post('/rebuild', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { from_month, to_month } = req.body

  if (!from_month || !to_month) {
    throw new AppError('from_month and to_month are required (YYYY-MM format)', 400, 'VALIDATION_ERROR')
  }

  // Get tenant settings for reporting currency and recognition method
  const { data: settings } = await supabase
    .from('settings')
    .select('reporting_currency, recognition_method')
    .eq('tenant_id', tenantId)
    .single()

  const reportingCurrency = settings?.reporting_currency || 'USD'
  const method = (settings?.recognition_method || 'accrual') as 'accrual' | 'cash'

  // Run sync: ledger rebuild then event derivation
  const result = await revenueRecognitionService.rebuildLedger(
    tenantId, from_month, to_month, reportingCurrency, method
  )

  // Derive events for the full range — use the rebuild range as the authoritative span
  // (paginating the ledger for distinct months is expensive; the rebuild range covers it)
  const firstMonth = `${from_month}-01`
  const lastMonth  = lastDayOfMonthAsFirst(to_month)
  logger.info(`Deriving events for full ledger range: ${firstMonth} → ${lastMonth}`)
  await revenueEventsService.deriveEventsRange(tenantId, firstMonth, lastMonth)

  res.json({
    success: true,
    data: {
      message: `Ledger rebuilt for ${from_month} → ${to_month}`,
      ...result,
    },
  })
}))

function lastDayOfMonthAsFirst(month: string): string {
  // Returns the first day of the given YYYY-MM month (already the month start)
  return `${month}-01`
}

export default router
