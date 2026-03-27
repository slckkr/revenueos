import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { asyncHandler } from '../middleware/error.middleware'

const router = Router()

// GET /api/playbooks
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { active } = req.query as Record<string, string>

  let q = supabase
    .from('playbooks')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (active === 'true') q = q.eq('is_active', true)

  const { data, error } = await q
  if (error) throw error

  // Attach recent trigger count
  const ids = (data || []).map(p => p.id)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const { data: triggers } = await supabase
    .from('playbook_triggers')
    .select('playbook_id')
    .eq('tenant_id', tenantId)
    .gte('fired_at', thirtyDaysAgo)
    .in('playbook_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])

  const triggerCount: Record<string, number> = {}
  for (const t of (triggers || [])) {
    triggerCount[t.playbook_id] = (triggerCount[t.playbook_id] || 0) + 1
  }

  const enriched = (data || []).map(p => ({ ...p, triggers_30d: triggerCount[p.id] || 0 }))
  res.json({ success: true, data: enriched })
}))

// GET /api/playbooks/triggers
router.get('/triggers', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { playbook_id, limit = '50' } = req.query as Record<string, string>

  let q = supabase
    .from('playbook_triggers')
    .select('*, playbooks(name, trigger_key), companies(name)')
    .eq('tenant_id', tenantId)
    .order('fired_at', { ascending: false })
    .limit(parseInt(limit))

  if (playbook_id) q = q.eq('playbook_id', playbook_id)

  const { data, error } = await q
  if (error) throw error
  res.json({ success: true, data })
}))

// POST /api/playbooks
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { name, trigger_type, trigger_key, trigger_threshold, recommended_actions_json } = req.body

  if (!name || !trigger_type || !trigger_key) {
    return res.status(400).json({ success: false, error: { message: 'name, trigger_type, trigger_key required' } })
  }

  const { data, error } = await supabase
    .from('playbooks')
    .insert({
      tenant_id: tenantId, name, trigger_type, trigger_key,
      trigger_threshold: trigger_threshold ?? null,
      recommended_actions_json: recommended_actions_json || [],
    })
    .select()
    .single()

  if (error) throw error
  res.status(201).json({ success: true, data })
}))

// PATCH /api/playbooks/:id
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const allowed = ['name', 'trigger_type', 'trigger_key', 'trigger_threshold', 'recommended_actions_json', 'is_active']
  const updates: Record<string, any> = {}
  for (const k of allowed) {
    if (k in req.body) updates[k] = req.body[k]
  }
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('playbooks')
    .update(updates)
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) throw error
  res.json({ success: true, data })
}))

// DELETE /api/playbooks/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { error } = await supabase
    .from('playbooks')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
  if (error) throw error
  res.json({ success: true })
}))

// POST /api/playbooks/:id/trigger — manually fire a playbook for a company
router.post('/:id/trigger', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).user.tenantId
  const { company_id, trigger_value } = req.body

  const { data: playbook, error: pbErr } = await supabase
    .from('playbooks')
    .select('*')
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .single()

  if (pbErr || !playbook) return res.status(404).json({ success: false, error: { message: 'Playbook not found' } })

  // Log trigger
  await supabase.from('playbook_triggers').insert({
    tenant_id: tenantId, playbook_id: req.params.id,
    company_id: company_id || null,
    trigger_value: trigger_value ?? null,
  })

  // Create notification
  const { data: company } = company_id
    ? await supabase.from('companies').select('name').eq('id', company_id).single()
    : { data: null }

  await supabase.from('notifications').insert({
    tenant_id: tenantId, type: 'playbook',
    title: playbook.name + (company ? ` — ${(company as any).name}` : ''),
    body: (playbook.recommended_actions_json as string[])[0] || '',
    link: company_id ? `/companies/${company_id}` : '/playbooks',
    company_id: company_id || null,
  })

  res.json({ success: true, playbook_name: playbook.name, actions: playbook.recommended_actions_json })
}))

export default router
