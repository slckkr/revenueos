import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'

const router = Router()

// GET /deals?stage=&status=&company_id=&page=&limit=
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { stage, status, company_id, page = '1', limit = '50' } = req.query as Record<string, string>

  let query = supabase
    .from('deals')
    .select('*, companies(name, segment), products(name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (stage) query = query.eq('stage', stage)
  if (status) query = query.eq('status', status)
  if (company_id) query = query.eq('company_id', company_id)

  const from = (parseInt(page) - 1) * parseInt(limit)
  query = query.range(from, from + parseInt(limit) - 1)

  const { data, error, count } = await query
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data, meta: { total: count, page: parseInt(page), limit: parseInt(limit) } })
}))

// GET /deals/pipeline — grouped by stage
router.get('/pipeline', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('deals')
    .select('*, companies(name, segment), products(name)')
    .eq('tenant_id', tenantId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  const stages = ['lead', 'mql', 'sql', 'opportunity', 'negotiation']
  const pipeline: Record<string, { deals: typeof data; total_value: number; count: number }> = {}

  for (const stage of stages) {
    const stageDeals = (data || []).filter((d) => d.stage === stage)
    pipeline[stage] = {
      deals: stageDeals,
      total_value: stageDeals.reduce((sum, d) => sum + (d.amount || 0), 0),
      count: stageDeals.length,
    }
  }

  // Metrics
  const allDeals = data || []
  const wonDeals = await supabase
    .from('deals')
    .select('amount, created_at, actual_close_date')
    .eq('tenant_id', tenantId)
    .eq('status', 'won')

  const lostDeals = await supabase
    .from('deals')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'lost')

  const wonCount = wonDeals.data?.length || 0
  const lostCount = lostDeals.data?.length || 0
  const winRate = wonCount + lostCount > 0 ? (wonCount / (wonCount + lostCount)) * 100 : 0

  const avgDealSize = wonDeals.data?.length
    ? wonDeals.data.reduce((s, d) => s + (d.amount || 0), 0) / wonDeals.data.length
    : 0

  const totalPipelineValue = allDeals.reduce((s, d) => s + (d.amount || 0) * ((d.probability || 50) / 100), 0)

  res.json({
    success: true,
    data: pipeline,
    metrics: {
      win_rate: Math.round(winRate * 10) / 10,
      avg_deal_size: Math.round(avgDealSize),
      total_pipeline_value: Math.round(totalPipelineValue),
      open_deals: allDeals.length,
    },
  })
}))

// GET /deals/metrics
router.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const [openRes, wonRes, lostRes] = await Promise.all([
    supabase.from('deals').select('amount, probability').eq('tenant_id', tenantId).eq('status', 'open'),
    supabase.from('deals').select('amount, actual_close_date, created_at').eq('tenant_id', tenantId).eq('status', 'won'),
    supabase.from('deals').select('id').eq('tenant_id', tenantId).eq('status', 'lost'),
  ])

  const wonDeals = wonRes.data || []
  const lostCount = lostRes.data?.length || 0
  const winRate = wonDeals.length + lostCount > 0
    ? (wonDeals.length / (wonDeals.length + lostCount)) * 100 : 0

  const avgDealSize = wonDeals.length
    ? wonDeals.reduce((s, d) => s + (d.amount || 0), 0) / wonDeals.length : 0

  const salesCycles = wonDeals
    .filter((d) => d.actual_close_date && d.created_at)
    .map((d) => {
      const days = (new Date(d.actual_close_date!).getTime() - new Date(d.created_at).getTime()) / 86400000
      return days
    })
    .filter((d) => d > 0)

  const avgSalesCycle = salesCycles.length
    ? salesCycles.reduce((a, b) => a + b, 0) / salesCycles.length : 0

  const weightedPipeline = (openRes.data || [])
    .reduce((s, d) => s + (d.amount || 0) * ((d.probability || 50) / 100), 0)

  res.json({
    success: true,
    data: {
      win_rate: Math.round(winRate * 10) / 10,
      avg_deal_size: Math.round(avgDealSize),
      avg_sales_cycle_days: Math.round(avgSalesCycle),
      weighted_pipeline: Math.round(weightedPipeline),
      open_count: openRes.data?.length || 0,
      won_count: wonDeals.length,
      lost_count: lostCount,
    },
  })
}))

// GET /deals/:id
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('deals')
    .select('*, companies(name, segment), products(name)')
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) throw new AppError('Deal not found', 404, 'NOT_FOUND')
  res.json({ success: true, data })
}))

// POST /deals
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { company_id, name, stage, amount, currency, probability, expected_close_date, deal_type, product_id, notes } = req.body

  if (!company_id || !name) throw new AppError('company_id and name are required', 400, 'VALIDATION_ERROR')

  const { data, error } = await supabase
    .from('deals')
    .insert({
      tenant_id: tenantId,
      company_id, name,
      stage: stage || 'lead',
      amount: amount ? Number(amount) : null,
      currency: currency || 'USD',
      probability: probability != null ? Number(probability) : null,
      expected_close_date: expected_close_date || null,
      deal_type: deal_type || null,
      product_id: product_id || null,
      notes: notes || null,
    })
    .select('*, companies(name, segment), products(name)')
    .single()

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.status(201).json({ success: true, data })
}))

// PATCH /deals/:id
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const allowed = ['name', 'stage', 'amount', 'currency', 'probability', 'expected_close_date',
    'actual_close_date', 'deal_type', 'status', 'product_id', 'notes', 'hubspot_deal_id']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in req.body) update[key] = req.body[key]
  }
  if (Object.keys(update).length === 0) throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR')
  update.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('deals')
    .update(update)
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
    .select('*, companies(name, segment), products(name)')
    .single()

  if (error || !data) throw new AppError('Deal not found', 404, 'NOT_FOUND')
  res.json({ success: true, data })
}))

// DELETE /deals/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', req.params.id)
    .eq('tenant_id', tenantId)
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')
  res.json({ success: true })
}))

export default router
