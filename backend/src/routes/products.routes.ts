import { Router, Request, Response } from 'express'
import Joi from 'joi'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

const createSchema = Joi.object({
  name: Joi.string().required(),
  sku: Joi.string().optional().allow('', null),
  billing_period: Joi.string().valid('monthly', 'annual', 'one_time').default('monthly'),
  description: Joi.string().optional().allow('', null),
  pricing_model: Joi.string().valid('flat', 'tiered', 'usage', 'per-seat').default('flat'),
  category: Joi.string().optional().allow('', null),
  status: Joi.string().valid('active', 'deprecated', 'beta').default('active'),
  launched_at: Joi.string().isoDate().optional().allow(null),
  default_price: Joi.number().optional().allow(null),
  currency: Joi.string().length(3).default('USD'),
})

const updateSchema = Joi.object({
  name: Joi.string().optional(),
  sku: Joi.string().optional().allow('', null),
  billing_period: Joi.string().valid('monthly', 'annual', 'one_time').optional(),
  description: Joi.string().optional().allow('', null),
  pricing_model: Joi.string().valid('flat', 'tiered', 'usage', 'per-seat').optional(),
  category: Joi.string().optional().allow('', null),
  status: Joi.string().valid('active', 'deprecated', 'beta').optional(),
  launched_at: Joi.string().isoDate().optional().allow(null),
  default_price: Joi.number().optional().allow(null),
  currency: Joi.string().length(3).optional(),
}).min(1)

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data })
}))

router.post('/', validate(createSchema), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('products')
    .insert({ ...req.body, tenant_id: tenantId })
    .select()
    .single()

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.status(201).json({ success: true, data })
}))

router.patch('/:id', validate(updateSchema), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('products')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error || !data) throw new AppError('Product not found', 404, 'NOT_FOUND')

  res.json({ success: true, data })
}))

// DELETE /products/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true })
}))

export default router
