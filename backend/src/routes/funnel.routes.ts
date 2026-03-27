import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'

const router = Router()

// GET /funnel/stages
router.get('/stages', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('funnel_stages')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order')

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.json({ success: true, data })
}))

// POST /funnel/stages
router.post('/stages', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { name, sort_order, conversion_target, color } = req.body

  if (!name) throw new AppError('name is required', 400, 'VALIDATION_ERROR')

  const { data, error } = await supabase
    .from('funnel_stages')
    .insert({ tenant_id: tenantId, name, sort_order: sort_order || 0, conversion_target, color: color || '#10b981' })
    .select()
    .single()

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.status(201).json({ success: true, data })
}))

// GET /funnel/analysis?from=YYYY-MM-DD&to=YYYY-MM-DD&product_id=
router.get('/analysis', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { from, to, product_id } = req.query as Record<string, string>

  // Get all stages ordered
  const { data: stages } = await supabase
    .from('funnel_stages')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order')

  if (!stages || stages.length === 0) {
    return res.json({ success: true, data: [] })
  }

  // Get funnel entries in range
  let query = supabase
    .from('funnel_entries')
    .select('stage_id, company_id, deal_id, entered_at, exited_at, exit_reason')
    .eq('tenant_id', tenantId)

  if (from) query = query.gte('entered_at', from)
  if (to) query = query.lte('entered_at', to)
  if (product_id) query = query.eq('product_id', product_id)

  const { data: entries } = await query

  const entryMap: Record<string, number> = {}
  for (const e of entries || []) {
    entryMap[e.stage_id] = (entryMap[e.stage_id] || 0) + 1
  }

  const result = stages.map((stage, idx) => {
    const count = entryMap[stage.id] || 0
    const prevCount = idx > 0 ? (entryMap[stages[idx - 1].id] || 0) : null
    const conversionFromPrev = prevCount && prevCount > 0 ? (count / prevCount) * 100 : null

    return {
      id: stage.id,
      name: stage.name,
      sort_order: stage.sort_order,
      color: stage.color,
      conversion_target: stage.conversion_target,
      count,
      conversion_from_prev: conversionFromPrev ? Math.round(conversionFromPrev * 10) / 10 : null,
    }
  })

  res.json({ success: true, data: result })
}))

// GET /funnel/entries?stage_id=&company_id=
router.get('/entries', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { stage_id, company_id } = req.query as Record<string, string>

  let query = supabase
    .from('funnel_entries')
    .select('*, funnel_stages(name), companies(name), deals(name, amount)')
    .eq('tenant_id', tenantId)
    .order('entered_at', { ascending: false })

  if (stage_id) query = query.eq('stage_id', stage_id)
  if (company_id) query = query.eq('company_id', company_id)

  const { data, error } = await query.limit(200)
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data })
}))

// POST /funnel/entries
router.post('/entries', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { company_id, deal_id, stage_id, product_id, entered_at } = req.body

  if (!stage_id) throw new AppError('stage_id is required', 400, 'VALIDATION_ERROR')

  const { data, error } = await supabase
    .from('funnel_entries')
    .insert({
      tenant_id: tenantId,
      company_id: company_id || null,
      deal_id: deal_id || null,
      stage_id,
      product_id: product_id || null,
      entered_at: entered_at || new Date().toISOString(),
    })
    .select('*, funnel_stages(name), companies(name)')
    .single()

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.status(201).json({ success: true, data })
}))

export default router
