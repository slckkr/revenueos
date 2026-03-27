import { Router, Request, Response } from 'express'
import Joi from 'joi'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

const lineSchema = Joi.object({
  product_id: Joi.string().uuid().optional().allow(null),
  description: Joi.string().optional().allow('', null),
  quantity: Joi.number().positive().default(1),
  unit_price: Joi.number().required(),
  total_price: Joi.number().required(),
  currency: Joi.string().length(3).uppercase().required(),
})

const createSchema = Joi.object({
  company_id: Joi.string().uuid().required(),
  invoice_number: Joi.string().required(),
  issue_date: Joi.string().isoDate().required(),
  due_date: Joi.string().isoDate().optional().allow(null),
  service_period_start: Joi.string().isoDate().optional().allow(null),
  service_period_end: Joi.string().isoDate().optional().allow(null),
  total_amount: Joi.number().required(),
  currency: Joi.string().length(3).uppercase().required(),
  status: Joi.string().valid('draft', 'issued', 'paid', 'void').default('issued'),
  source_type: Joi.string().valid('hubspot', 'logo_import', 'excel_import', 'manual').required(),
  hubspot_deal_id: Joi.string().optional().allow('', null),
  lines: Joi.array().items(lineSchema).optional(),
})

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { company_id, status, month, page = '1', limit = '50' } = req.query as Record<string, string>

  let query = supabase
    .from('invoices')
    .select('*, companies(name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('issue_date', { ascending: false })

  if (company_id) query = query.eq('company_id', company_id)
  if (status) query = query.eq('status', status)
  if (month) {
    // Filter by service period overlapping the given month
    const monthStart = `${month}-01`
    const nextMonth = new Date(monthStart)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    const monthEnd = nextMonth.toISOString().split('T')[0]
    query = query
      .lte('service_period_start', monthEnd)
      .gte('service_period_end', monthStart)
  }

  const from = (parseInt(page) - 1) * parseInt(limit)
  query = query.range(from, from + parseInt(limit) - 1)

  const { data, error, count } = await query
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data, meta: { total: count, page: parseInt(page), limit: parseInt(limit) } })
}))

router.get('/:id/lines', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  // Verify invoice belongs to tenant
  const { data: invoice, error: invoiceErr } = await supabase
    .from('invoices')
    .select('id')
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .single()

  if (invoiceErr || !invoice) throw new AppError('Invoice not found', 404, 'NOT_FOUND')

  const { data, error } = await supabase
    .from('invoice_lines')
    .select('*, products(name)')
    .eq('invoice_id', req.params.id)

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data })
}))

router.post('/', validate(createSchema), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { lines, ...invoiceData } = req.body

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({ ...invoiceData, tenant_id: tenantId })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new AppError('Invoice number already exists', 409, 'CONFLICT')
    throw new AppError(error.message, 500, 'DB_ERROR')
  }

  if (lines && lines.length > 0) {
    const { error: lineErr } = await supabase
      .from('invoice_lines')
      .insert(lines.map((l: any) => ({ ...l, invoice_id: invoice.id })))

    if (lineErr) throw new AppError(lineErr.message, 500, 'DB_ERROR')
  }

  res.status(201).json({ success: true, data: invoice })
}))

export default router
