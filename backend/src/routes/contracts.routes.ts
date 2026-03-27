import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'

const router = Router()

// GET /contracts?company_id=&status=&page=
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { company_id, status, page = '1', limit = '50' } = req.query as Record<string, string>

  let query = supabase
    .from('contracts')
    .select('*, companies(name, segment)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('end_date', { ascending: true })

  if (company_id) query = query.eq('company_id', company_id)
  if (status) query = query.eq('status', status)

  const from = (parseInt(page) - 1) * parseInt(limit)
  query = query.range(from, from + parseInt(limit) - 1)

  const { data, error, count } = await query
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data, meta: { total: count, page: parseInt(page), limit: parseInt(limit) } })
}))

// GET /contracts/upcoming?days=30
router.get('/upcoming', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const days = parseInt((req.query.days as string) || '30')

  const today = new Date()
  const future = new Date(today)
  future.setDate(future.getDate() + days)

  const { data, error } = await supabase
    .from('contracts')
    .select('*, companies(name, segment)')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .gte('end_date', today.toISOString().split('T')[0])
    .lte('end_date', future.toISOString().split('T')[0])
    .order('end_date', { ascending: true })

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.json({ success: true, data })
}))

// GET /contracts/:id
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('contracts')
    .select('*, companies(name, segment)')
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) throw new AppError('Contract not found', 404, 'NOT_FOUND')
  res.json({ success: true, data })
}))

// POST /contracts
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { company_id, contract_number, title, start_date, end_date, total_value, currency,
    auto_renewal, renewal_term_months, signed_date, notes } = req.body

  if (!company_id || !start_date || !end_date) {
    throw new AppError('company_id, start_date, end_date are required', 400, 'VALIDATION_ERROR')
  }

  const { data, error } = await supabase
    .from('contracts')
    .insert({
      tenant_id: tenantId,
      company_id,
      contract_number: contract_number || null,
      title: title || null,
      start_date, end_date,
      total_value: total_value ? Number(total_value) : null,
      currency: currency || 'USD',
      auto_renewal: Boolean(auto_renewal),
      renewal_term_months: renewal_term_months ? Number(renewal_term_months) : null,
      signed_date: signed_date || null,
      notes: notes || null,
      status: 'active',
    })
    .select('*, companies(name, segment)')
    .single()

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.status(201).json({ success: true, data })
}))

// PATCH /contracts/:id
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const allowed = ['contract_number', 'title', 'start_date', 'end_date', 'total_value', 'currency',
    'auto_renewal', 'renewal_term_months', 'status', 'signed_date', 'notes']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in req.body) update[key] = req.body[key]
  }
  if (Object.keys(update).length === 0) throw new AppError('No valid fields', 400, 'VALIDATION_ERROR')
  update.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('contracts')
    .update(update)
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select('*, companies(name, segment)')
    .single()

  if (error || !data) throw new AppError('Contract not found', 404, 'NOT_FOUND')
  res.json({ success: true, data })
}))

// DELETE /contracts/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { error } = await supabase
    .from('contracts')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.json({ success: true })
}))

export default router
