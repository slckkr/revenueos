import { Router, Request, Response } from 'express'
import Joi from 'joi'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

const createSchema = Joi.object({
  name: Joi.string().required(),
  domain: Joi.string().optional().allow('', null),
  external_id: Joi.string().optional().allow('', null),
  segment: Joi.string().valid('SMB', 'MID', 'ENT').optional().allow(null),
  hubspot_id: Joi.string().optional().allow('', null),
  employee_count: Joi.number().integer().positive().optional().allow(null),
  country: Joi.string().optional().allow('', null),
  city: Joi.string().optional().allow('', null),
  industry: Joi.string().optional().allow('', null),
  status: Joi.string().valid('active', 'churned', 'at-risk', 'prospect').default('active'),
  annual_revenue: Joi.number().optional().allow(null),
  source: Joi.string().optional().allow('', null),
  owner_id: Joi.string().uuid().optional().allow(null),
})

const updateSchema = Joi.object({
  name: Joi.string().optional(),
  domain: Joi.string().optional().allow('', null),
  external_id: Joi.string().optional().allow('', null),
  segment: Joi.string().valid('SMB', 'MID', 'ENT').optional().allow(null),
  employee_count: Joi.number().integer().positive().optional().allow(null),
  country: Joi.string().optional().allow('', null),
  city: Joi.string().optional().allow('', null),
  industry: Joi.string().optional().allow('', null),
  status: Joi.string().valid('active', 'churned', 'at-risk', 'prospect').optional(),
  annual_revenue: Joi.number().optional().allow(null),
  source: Joi.string().optional().allow('', null),
  owner_id: Joi.string().uuid().optional().allow(null),
}).min(1)

// GET /companies
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { search, segment, page = '1', limit = '50', sort = 'mrr' } = req.query as Record<string, string>

  let query = supabase
    .from('companies')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)

  if (search) query = query.ilike('name', `%${search}%`)
  if (segment) query = query.eq('segment', segment)

  // Fetch all matching companies (for MRR merge) but apply limit only if not sorting by MRR
  // When sorting by MRR we need all companies to sort before paginating
  const { data: allData, error, count } = await query.order('name')
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  // Get the most recent ledger month for this tenant
  const { data: latestMonthRow } = await supabase
    .from('revenue_ledger')
    .select('month')
    .eq('tenant_id', tenantId)
    .order('month', { ascending: false })
    .limit(1)
    .single()

  let mrrMap: Record<string, number> = {}
  if (latestMonthRow?.month) {
    const { data: mrrRows } = await supabase
      .from('revenue_ledger')
      .select('company_id, amount_reporting')
      .eq('tenant_id', tenantId)
      .eq('month', latestMonthRow.month)

    for (const row of mrrRows || []) {
      mrrMap[row.company_id] = (mrrMap[row.company_id] || 0) + Number(row.amount_reporting)
    }
  }

  let companies = (allData || []).map((c) => ({
    ...c,
    current_mrr: mrrMap[c.id] || 0,
    current_mrr_month: latestMonthRow?.month || null,
  }))

  // Sort by MRR descending (default) or by name
  if (sort === 'mrr') {
    companies.sort((a, b) => b.current_mrr - a.current_mrr)
  }

  const pageNum = parseInt(page, 10)
  const limitNum = parseInt(limit, 10)
  const paginated = companies.slice((pageNum - 1) * limitNum, pageNum * limitNum)

  res.json({
    success: true,
    data: paginated,
    meta: { total: count, page: pageNum, limit: limitNum },
  })
}))

// GET /companies/:id
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) throw new AppError('Company not found', 404, 'NOT_FOUND')

  // Fetch company's MRR history from ledger
  const { data: mrrHistory } = await supabase
    .from('revenue_ledger')
    .select('month, amount_reporting, event_type')
    .eq('company_id', req.params.id)
    .eq('tenant_id', tenantId)
    .order('month')

  // Fetch recent events
  const { data: events } = await supabase
    .from('revenue_events')
    .select('*')
    .eq('company_id', req.params.id)
    .eq('tenant_id', tenantId)
    .order('month', { ascending: false })
    .limit(24)

  // Fetch invoices
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, issue_date, service_period_start, service_period_end, total_amount, currency, status')
    .eq('company_id', req.params.id)
    .eq('tenant_id', tenantId)
    .order('issue_date', { ascending: false })
    .limit(50)

  res.json({
    success: true,
    data: { ...data, mrr_history: mrrHistory || [], recent_events: events || [], invoices: invoices || [] },
  })
}))

// POST /companies
router.post('/', validate(createSchema), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('companies')
    .insert({ ...req.body, tenant_id: tenantId })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new AppError('Company with this hubspot_id already exists', 409, 'CONFLICT')
    throw new AppError(error.message, 500, 'DB_ERROR')
  }

  res.status(201).json({ success: true, data })
}))

// PATCH /companies/:id
router.patch('/:id', validate(updateSchema), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('companies')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error || !data) throw new AppError('Company not found', 404, 'NOT_FOUND')

  res.json({ success: true, data })
}))

// DELETE /companies/bulk
router.delete('/bulk', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0) throw new AppError('ids array required', 400, 'VALIDATION_ERROR')
  const { error } = await supabase.from('companies').delete().in('id', ids).eq('tenant_id', tenantId)
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.json({ success: true, deleted: ids.length })
}))

// DELETE /companies/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true })
}))

export default router
