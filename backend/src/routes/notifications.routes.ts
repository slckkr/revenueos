import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { asyncHandler } from '../middleware/error.middleware'

const router = Router()

// GET /api/notifications?unread_only=true&limit=50
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { unread_only, limit = '50' } = req.query as Record<string, string>

  let q = supabase
    .from('notifications')
    .select('*, companies(name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit))

  if (unread_only === 'true') q = q.eq('is_read', false)

  const { data, error } = await q
  if (error) throw error

  const unreadCount = (data || []).filter(n => !n.is_read).length
  res.json({ success: true, data, unread_count: unreadCount })
}))

// GET /api/notifications/count — unread count for bell
router.get('/count', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_read', false)

  if (error) throw error
  res.json({ success: true, count: count || 0 })
}))

// PUT /api/notifications/:id/read
router.put('/:id/read', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
  if (error) throw error
  res.json({ success: true })
}))

// PUT /api/notifications/read-all
router.put('/read-all', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('tenant_id', tenantId)
    .eq('is_read', false)
  if (error) throw error
  res.json({ success: true })
}))

// DELETE /api/notifications/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
  if (error) throw error
  res.json({ success: true })
}))

// POST /api/notifications — create manual notification
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { type, title, body, link, company_id } = req.body

  if (!type || !title) {
    return res.status(400).json({ success: false, error: { message: 'type and title required' } })
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert({ tenant_id: tenantId, type, title, body, link, company_id: company_id || null })
    .select()
    .single()

  if (error) throw error
  res.status(201).json({ success: true, data })
}))

export default router
