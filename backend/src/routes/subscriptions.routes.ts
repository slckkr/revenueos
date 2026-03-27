import { Router, Request, Response } from 'express'
import Joi from 'joi'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

const createSchema = Joi.object({
  company_id: Joi.string().uuid().required(),
  product_id: Joi.string().uuid().optional().allow(null),
  status: Joi.string().valid('active', 'churned', 'paused').default('active'),
  start_date: Joi.string().isoDate().required(),
  end_date: Joi.string().isoDate().optional().allow(null),
  mrr_amount: Joi.number().positive().required(),
  currency: Joi.string().length(3).uppercase().default('USD'),
})

const updateSchema = Joi.object({
  status: Joi.string().valid('active', 'churned', 'paused').optional(),
  end_date: Joi.string().isoDate().optional().allow(null),
  mrr_amount: Joi.number().positive().optional(),
}).min(1)

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { company_id, status, page = '1', limit = '50' } = req.query as Record<string, string>

  let query = supabase
    .from('subscriptions')
    .select('*, companies(name), products(name, billing_period)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('start_date', { ascending: false })

  if (company_id) query = query.eq('company_id', company_id)
  if (status) query = query.eq('status', status)

  const from = (parseInt(page) - 1) * parseInt(limit)
  query = query.range(from, from + parseInt(limit) - 1)

  const { data, error, count } = await query
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data, meta: { total: count, page: parseInt(page), limit: parseInt(limit) } })
}))

router.post('/', validate(createSchema), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({ ...req.body, tenant_id: tenantId })
    .select()
    .single()

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.status(201).json({ success: true, data })
}))

router.patch('/:id', validate(updateSchema), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('subscriptions')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error || !data) throw new AppError('Subscription not found', 404, 'NOT_FOUND')

  res.json({ success: true, data })
}))

export default router
