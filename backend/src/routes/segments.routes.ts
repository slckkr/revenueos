import { Router, Request, Response } from 'express'
import Joi from 'joi'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

const createSchema = Joi.object({
  name: Joi.string().required(),
  criteria_json: Joi.object().optional().default({}),
})

const updateSchema = Joi.object({
  name: Joi.string().optional(),
  criteria_json: Joi.object().optional(),
}).min(1)

// GET /segments
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('segments')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data })
}))

// POST /segments
router.post('/', validate(createSchema), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('segments')
    .insert({ ...req.body, tenant_id: tenantId })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new AppError('Segment with this name already exists', 409, 'CONFLICT')
    throw new AppError(error.message, 500, 'DB_ERROR')
  }

  res.status(201).json({ success: true, data })
}))

// PATCH /segments/:id
router.patch('/:id', validate(updateSchema), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('segments')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error || !data) throw new AppError('Segment not found', 404, 'NOT_FOUND')

  res.json({ success: true, data })
}))

// DELETE /segments/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('segments')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error || !data) throw new AppError('Segment not found', 404, 'NOT_FOUND')

  res.json({ success: true, data: { message: 'Segment deleted' } })
}))

export default router
