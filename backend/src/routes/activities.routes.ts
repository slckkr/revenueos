import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'

const router = Router()

// GET /activities?company_id=&deal_id=&type=&page=
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { company_id, deal_id, type, page = '1', limit = '50' } = req.query as Record<string, string>

  let query = supabase
    .from('activities')
    .select('*, companies(name), contacts(name, email), deals(name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('activity_date', { ascending: false })

  if (company_id) query = query.eq('company_id', company_id)
  if (deal_id) query = query.eq('deal_id', deal_id)
  if (type) query = query.eq('type', type)

  const from = (parseInt(page) - 1) * parseInt(limit)
  query = query.range(from, from + parseInt(limit) - 1)

  const { data, error, count } = await query
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data, meta: { total: count, page: parseInt(page), limit: parseInt(limit) } })
}))

// POST /activities
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { company_id, contact_id, deal_id, type, subject, description, activity_date } = req.body

  if (!company_id || !type) {
    throw new AppError('company_id and type are required', 400, 'VALIDATION_ERROR')
  }

  const validTypes = ['call', 'email', 'meeting', 'note', 'task', 'demo', 'follow_up']
  if (!validTypes.includes(type)) {
    throw new AppError(`type must be one of: ${validTypes.join(', ')}`, 400, 'VALIDATION_ERROR')
  }

  const { data, error } = await supabase
    .from('activities')
    .insert({
      tenant_id: tenantId,
      company_id,
      contact_id: contact_id || null,
      deal_id: deal_id || null,
      type,
      subject: subject || null,
      description: description || null,
      activity_date: activity_date || new Date().toISOString(),
    })
    .select('*, companies(name), contacts(name, email), deals(name)')
    .single()

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.status(201).json({ success: true, data })
}))

// PATCH /activities/:id
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const allowed = ['type', 'subject', 'description', 'activity_date', 'contact_id', 'deal_id']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in req.body) update[key] = req.body[key]
  }
  if (Object.keys(update).length === 0) throw new AppError('No valid fields', 400, 'VALIDATION_ERROR')

  const { data, error } = await supabase
    .from('activities')
    .update(update)
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select('*, companies(name), contacts(name, email), deals(name)')
    .single()

  if (error || !data) throw new AppError('Activity not found', 404, 'NOT_FOUND')
  res.json({ success: true, data })
}))

// DELETE /activities/bulk
router.delete('/bulk', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0) throw new AppError('ids array required', 400, 'VALIDATION_ERROR')
  const { error } = await supabase.from('activities').delete().in('id', ids).eq('tenant_id', tenantId)
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.json({ success: true, deleted: ids.length })
}))

// DELETE /activities/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.json({ success: true })
}))

export default router
