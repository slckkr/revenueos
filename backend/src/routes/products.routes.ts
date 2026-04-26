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
  const { page = '1', limit = '50', sort = 'name', order = 'asc', search = '' } = req.query as Record<string, string>
  const VALID_SORTS = ['name', 'sku', 'billing_period', 'pricing_model', 'category', 'default_price', 'status']
  const sortField = VALID_SORTS.includes(sort) ? sort : 'name'
  const ascending = order === 'asc'
  const from = (parseInt(page) - 1) * parseInt(limit)

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order(sortField, { ascending })
    .range(from, from + parseInt(limit) - 1)

  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error, count } = await query

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data, meta: { total: count ?? 0, page: parseInt(page), limit: parseInt(limit) } })
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

// DELETE /products/bulk
router.delete('/bulk', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0) throw new AppError('ids array required', 400, 'VALIDATION_ERROR')
  const { error } = await supabase.from('products').delete().in('id', ids).eq('tenant_id', tenantId)
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.json({ success: true, deleted: ids.length })
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
