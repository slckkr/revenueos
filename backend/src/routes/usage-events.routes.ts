import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { asyncHandler } from '../middleware/error.middleware'

const router = Router()

// GET /api/usage-events?company_id=&product_id=&from=&to=&limit=
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { company_id, product_id, from, to, limit = '200' } = req.query as Record<string, string>

  let q = supabase
    .from('usage_events')
    .select('*, companies(name), products(name)')
    .eq('tenant_id', tenantId)
    .order('event_date', { ascending: false })
    .limit(parseInt(limit))

  if (company_id) q = q.eq('company_id', company_id)
  if (product_id) q = q.eq('product_id', product_id)
  if (from) q = q.gte('event_date', from)
  if (to) q = q.lte('event_date', to)

  const { data, error } = await q
  if (error) throw error
  res.json({ success: true, data })
}))

// GET /api/usage-events/summary?company_id=
router.get('/summary', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { company_id } = req.query as Record<string, string>

  if (!company_id) return res.json({ success: true, data: [] })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString()

  const { data: recent } = await supabase
    .from('usage_events')
    .select('event_name, event_value, event_date')
    .eq('tenant_id', tenantId)
    .eq('company_id', company_id)
    .gte('event_date', thirtyDaysAgo)
    .order('event_date', { ascending: false })

  const { data: prior } = await supabase
    .from('usage_events')
    .select('event_name, event_value')
    .eq('tenant_id', tenantId)
    .eq('company_id', company_id)
    .gte('event_date', ninetyDaysAgo)
    .lt('event_date', thirtyDaysAgo)

  // Group by event_name
  const recentByName: Record<string, number> = {}
  for (const e of (recent || [])) {
    recentByName[e.event_name] = (recentByName[e.event_name] || 0) + 1
  }
  const priorByName: Record<string, number> = {}
  for (const e of (prior || [])) {
    priorByName[e.event_name] = (priorByName[e.event_name] || 0) + 1
  }

  const summary = Object.entries(recentByName).map(([name, count]) => ({
    event_name: name,
    count_30d: count,
    count_prev_30d: priorByName[name] || 0,
    trend: priorByName[name] ? ((count - priorByName[name]) / priorByName[name]) * 100 : null,
  }))

  res.json({ success: true, data: summary, total_30d: recent?.length || 0 })
}))

// POST /api/usage-events (single or batch)
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const body = req.body

  const events = Array.isArray(body) ? body : [body]
  const rows = events.map(e => ({
    tenant_id: tenantId,
    company_id: e.company_id,
    product_id: e.product_id || null,
    event_name: e.event_name,
    event_value: e.event_value ?? null,
    event_date: e.event_date || new Date().toISOString(),
    metadata_json: e.metadata_json || {},
  }))

  const { data, error } = await supabase.from('usage_events').insert(rows).select()
  if (error) throw error
  res.status(201).json({ success: true, data, count: rows.length })
}))

// DELETE /api/usage-events/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { error } = await supabase
    .from('usage_events')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
  if (error) throw error
  res.json({ success: true })
}))

export default router
