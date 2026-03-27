import { Router, Request, Response } from 'express'
import Joi from 'joi'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

const createSchema = Joi.object({
  company_id: Joi.string().uuid().required(),
  invoice_id: Joi.string().uuid().optional().allow(null),
  payment_date: Joi.string().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().length(3).default('USD'),
  method: Joi.string().valid('bank_transfer', 'credit_card', 'other').optional().allow(null),
  status: Joi.string().valid('completed', 'pending', 'failed', 'refunded').default('completed'),
  external_id: Joi.string().optional().allow('', null),
  notes: Joi.string().optional().allow('', null),
})

const updateSchema = Joi.object({
  payment_date: Joi.string().optional(),
  amount: Joi.number().positive().optional(),
  currency: Joi.string().length(3).optional(),
  method: Joi.string().valid('bank_transfer', 'credit_card', 'other').optional().allow(null),
  status: Joi.string().valid('completed', 'pending', 'failed', 'refunded').optional(),
  external_id: Joi.string().optional().allow('', null),
  notes: Joi.string().optional().allow('', null),
}).min(1)

// GET /payments?company_id=&page=&limit=
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { company_id, page = '1', limit = '50' } = req.query as Record<string, string>

  let query = supabase
    .from('payments')
    .select('*, companies(name), invoices(invoice_number)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('payment_date', { ascending: false })

  if (company_id) query = query.eq('company_id', company_id)

  const from = (parseInt(page) - 1) * parseInt(limit)
  query = query.range(from, from + parseInt(limit) - 1)

  const { data, error, count } = await query
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data, meta: { total: count, page: parseInt(page), limit: parseInt(limit) } })
}))

// GET /payments/:id
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('payments')
    .select('*, companies(name), invoices(invoice_number)')
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) throw new AppError('Payment not found', 404, 'NOT_FOUND')

  res.json({ success: true, data })
}))

// POST /payments
router.post('/', validate(createSchema), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('payments')
    .insert({ ...req.body, tenant_id: tenantId })
    .select()
    .single()

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.status(201).json({ success: true, data })
}))

// PATCH /payments/:id
router.patch('/:id', validate(updateSchema), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('payments')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error || !data) throw new AppError('Payment not found', 404, 'NOT_FOUND')

  res.json({ success: true, data })
}))

// DELETE /payments/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('payments')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error || !data) throw new AppError('Payment not found', 404, 'NOT_FOUND')

  res.json({ success: true, data: { message: 'Payment deleted' } })
}))

export default router
