import { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware/error.middleware'
import { metricsService } from '../services/metrics.service'
import { anomalyService } from '../services/anomaly.service'

const router = Router()

// GET /metrics/summary?month=YYYY-MM-DD
router.get('/summary', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const month = (req.query.month as string) || getCurrentMonth()

  const [summary, arpa, expansionRate] = await Promise.all([
    metricsService.getSummary(tenantId, month),
    metricsService.getArpa(tenantId, month),
    metricsService.getExpansionRate(tenantId, month),
  ])

  res.json({ success: true, data: { ...summary, arpa, expansion_rate: expansionRate } })
}))

// GET /metrics/mrr-history?months=12
router.get('/mrr-history', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const months = parseInt((req.query.months as string) || '12', 10)

  const data = await metricsService.getMrrHistory(tenantId, months)
  res.json({ success: true, data })
}))

// GET /metrics/net-new-mrr?month=YYYY-MM-DD
router.get('/net-new-mrr', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const month = (req.query.month as string) || getCurrentMonth()

  const data = await metricsService.getNetNewMrrBreakdown(tenantId, month)
  res.json({ success: true, data })
}))

// GET /metrics/mrr-bridge?month=YYYY-MM-DD
router.get('/mrr-bridge', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const month = (req.query.month as string) || getCurrentMonth()

  const data = await metricsService.getMrrBridge(tenantId, month)
  res.json({ success: true, data })
}))

// GET /metrics/segment-breakdown?month=YYYY-MM-DD
router.get('/segment-breakdown', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const month = (req.query.month as string) || getCurrentMonth()

  const data = await metricsService.getSegmentBreakdown(tenantId, month)
  res.json({ success: true, data })
}))

// GET /metrics/:key/drilldown?month=YYYY-MM-DD
router.get('/:key/drilldown', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { key } = req.params
  const month = (req.query.month as string) || getCurrentMonth()

  const data = await metricsService.getDrilldown(tenantId, key, month)
  res.json({ success: true, data })
}))

// GET /metrics/anomalies — rule-based flags
router.get('/anomalies', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const month = (req.query.month as string) || getCurrentMonth()

  const data = await anomalyService.getFlags(tenantId, month)
  res.json({ success: true, data })
}))

function getCurrentMonth(): string {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().split('T')[0]
}

export default router
