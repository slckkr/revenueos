import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { asyncHandler } from '../middleware/error.middleware'

const router = Router()

const VALID_STATUSES = ['open', 'in_progress', 'done', 'cancelled']
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent']

// GET /api/tasks?object_type=company&object_id=&status=open
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { object_type, object_id, status, priority } = req.query as Record<string, string>

  let q = supabase
    .from('tasks')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('priority', { ascending: false })

  if (object_type) q = q.eq('object_type', object_type)
  if (object_id) q = q.eq('object_id', object_id)
  if (status) q = q.eq('status', status)
  if (priority) q = q.eq('priority', priority)

  const { data, error } = await q
  if (error) throw error
  res.json({ success: true, data })
}))

// POST /api/tasks
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { object_type, object_id, title, description, due_date, priority } = req.body

  if (!title) {
    return res.status(400).json({ success: false, error: { message: 'title required' } })
  }
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ success: false, error: { message: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` } })
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      tenant_id: tenantId,
      object_type: object_type || null,
      object_id: object_id || null,
      title,
      description: description || null,
      due_date: due_date || null,
      priority: priority || 'medium',
      status: 'open',
    })
    .select()
    .single()

  if (error) throw error
  res.status(201).json({ success: true, data })
}))

// PATCH /api/tasks/:id
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const allowed = ['title', 'description', 'due_date', 'status', 'priority', 'object_type', 'object_id']
  const updates: Record<string, any> = {}
  for (const k of allowed) {
    if (k in req.body) updates[k] = req.body[k]
  }
  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
    return res.status(400).json({ success: false, error: { message: `status must be one of: ${VALID_STATUSES.join(', ')}` } })
  }
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) throw error
  res.json({ success: true, data })
}))

// DELETE /api/tasks/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
  if (error) throw error
  res.json({ success: true })
}))

export default router
