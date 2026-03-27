import { Router, Request, Response } from 'express'
import Joi from 'joi'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

const createSchema = Joi.object({
  company_id: Joi.string().uuid().optional().allow(null),
  name: Joi.string().optional().allow('', null),
  first_name: Joi.string().optional().allow('', null),
  last_name: Joi.string().optional().allow('', null),
  email: Joi.string().email().optional().allow('', null),
  phone: Joi.string().optional().allow('', null),
  title: Joi.string().optional().allow('', null),
  role_type: Joi.string().valid('champion', 'decision-maker', 'user', 'billing').optional().allow(null),
  is_primary: Joi.boolean().optional(),
  hubspot_id: Joi.string().optional().allow('', null),
}).or('name', 'first_name')

const updateSchema = Joi.object({
  company_id: Joi.string().uuid().optional().allow(null),
  name: Joi.string().optional().allow('', null),
  first_name: Joi.string().optional().allow('', null),
  last_name: Joi.string().optional().allow('', null),
  email: Joi.string().email().optional().allow('', null),
  phone: Joi.string().optional().allow('', null),
  title: Joi.string().optional().allow('', null),
  role_type: Joi.string().valid('champion', 'decision-maker', 'user', 'billing').optional().allow(null),
  is_primary: Joi.boolean().optional(),
}).min(1)

// GET /contacts?company_id=&page=&limit=
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { company_id, page = '1', limit = '50' } = req.query as Record<string, string>

  let query = supabase
    .from('contacts')
    .select('*, companies(name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('name')

  if (company_id) query = query.eq('company_id', company_id)

  const from = (parseInt(page) - 1) * parseInt(limit)
  query = query.range(from, from + parseInt(limit) - 1)

  const { data, error, count } = await query
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data, meta: { total: count, page: parseInt(page), limit: parseInt(limit) } })
}))

// GET /contacts/:id
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('contacts')
    .select('*, companies(name)')
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) throw new AppError('Contact not found', 404, 'NOT_FOUND')

  res.json({ success: true, data })
}))

// POST /contacts
router.post('/', validate(createSchema), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('contacts')
    .insert({ ...req.body, tenant_id: tenantId })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new AppError('Contact with this hubspot_id already exists', 409, 'CONFLICT')
    throw new AppError(error.message, 500, 'DB_ERROR')
  }

  res.status(201).json({ success: true, data })
}))

// PATCH /contacts/:id
router.patch('/:id', validate(updateSchema), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('contacts')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error || !data) throw new AppError('Contact not found', 404, 'NOT_FOUND')

  res.json({ success: true, data })
}))

// DELETE /contacts/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error || !data) throw new AppError('Contact not found', 404, 'NOT_FOUND')

  res.json({ success: true, data: { message: 'Contact deleted' } })
}))

export default router
