import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'

const router = Router()

// GET /proposals?company_id=&status=&page=
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { company_id, status, page = '1', limit = '50' } = req.query as Record<string, string>

  let query = supabase
    .from('proposals')
    .select('*, companies(name), deals(name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (company_id) query = query.eq('company_id', company_id)
  if (status) query = query.eq('status', status)

  const from = (parseInt(page) - 1) * parseInt(limit)
  query = query.range(from, from + parseInt(limit) - 1)

  const { data, error, count } = await query
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data, meta: { total: count, page: parseInt(page), limit: parseInt(limit) } })
}))

// GET /proposals/:id (with items)
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('proposals')
    .select('*, companies(name), deals(name)')
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) throw new AppError('Proposal not found', 404, 'NOT_FOUND')

  const { data: items } = await supabase
    .from('proposal_items')
    .select('*, products(name)')
    .eq('proposal_id', req.params.id)
    .order('sort_order')

  res.json({ success: true, data: { ...data, items: items || [] } })
}))

// POST /proposals
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { company_id, deal_id, title, amount, currency, expiry_date, notes, items } = req.body

  if (!company_id) throw new AppError('company_id is required', 400, 'VALIDATION_ERROR')

  // Generate proposal number
  const { count } = await supabase
    .from('proposals')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  const proposalNumber = `PROP-${String((count || 0) + 1).padStart(4, '0')}`

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      tenant_id: tenantId,
      company_id,
      deal_id: deal_id || null,
      proposal_number: proposalNumber,
      title: title || null,
      amount: amount ? Number(amount) : null,
      currency: currency || 'USD',
      expiry_date: expiry_date || null,
      notes: notes || null,
      status: 'draft',
    })
    .select('*, companies(name)')
    .single()

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  // Insert items if provided
  if (items && Array.isArray(items) && items.length > 0) {
    const rows = items.map((item: Record<string, unknown>, idx: number) => ({
      proposal_id: data.id,
      product_id: item.product_id || null,
      description: item.description || null,
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price || 0),
      total_price: Number(item.total_price || (Number(item.unit_price || 0) * Number(item.quantity || 1))),
      sort_order: idx,
    }))
    await supabase.from('proposal_items').insert(rows)
  }

  res.status(201).json({ success: true, data })
}))

// PATCH /proposals/:id
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const allowed = ['title', 'amount', 'currency', 'status', 'sent_date', 'expiry_date', 'accepted_date', 'deal_id', 'notes']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in req.body) update[key] = req.body[key]
  }
  if (Object.keys(update).length === 0) throw new AppError('No valid fields', 400, 'VALIDATION_ERROR')
  update.updated_at = new Date().toISOString()

  // Auto-set dates based on status
  if (update.status === 'sent' && !update.sent_date) update.sent_date = new Date().toISOString().split('T')[0]
  if (update.status === 'accepted' && !update.accepted_date) update.accepted_date = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('proposals')
    .update(update)
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select('*, companies(name), deals(name)')
    .single()

  if (error || !data) throw new AppError('Proposal not found', 404, 'NOT_FOUND')
  res.json({ success: true, data })
}))

// DELETE /proposals/bulk
router.delete('/bulk', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0) throw new AppError('ids array required', 400, 'VALIDATION_ERROR')
  const { error } = await supabase.from('proposals').delete().in('id', ids).eq('tenant_id', tenantId)
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.json({ success: true, deleted: ids.length })
}))

// DELETE /proposals/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { error } = await supabase
    .from('proposals')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.json({ success: true })
}))

export default router
