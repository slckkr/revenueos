import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { asyncHandler } from '../middleware/error.middleware'

const router = Router()

const VALID_OBJECT_TYPES = ['company', 'deal', 'proposal', 'contract']

// GET /api/notes?object_type=company&object_id=xxx
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { object_type, object_id } = req.query as Record<string, string>

  if (!object_type || !object_id) {
    return res.status(400).json({ success: false, error: { message: 'object_type and object_id required' } })
  }

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('object_type', object_type)
    .eq('object_id', object_id)
    .order('created_at', { ascending: false })

  if (error) throw error
  res.json({ success: true, data })
}))

// POST /api/notes
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { object_type, object_id, body } = req.body

  if (!object_type || !object_id || !body) {
    return res.status(400).json({ success: false, error: { message: 'object_type, object_id, body required' } })
  }
  if (!VALID_OBJECT_TYPES.includes(object_type)) {
    return res.status(400).json({ success: false, error: { message: `object_type must be one of: ${VALID_OBJECT_TYPES.join(', ')}` } })
  }

  const { data, error } = await supabase
    .from('notes')
    .insert({ tenant_id: tenantId, object_type, object_id, body })
    .select()
    .single()

  if (error) throw error
  res.status(201).json({ success: true, data })
}))

// PATCH /api/notes/:id
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { body } = req.body

  if (!body) {
    return res.status(400).json({ success: false, error: { message: 'body required' } })
  }

  const { data, error } = await supabase
    .from('notes')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) throw error
  res.json({ success: true, data })
}))

// DELETE /api/notes/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
  if (error) throw error
  res.json({ success: true })
}))

export default router
