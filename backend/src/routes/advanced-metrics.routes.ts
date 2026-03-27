import { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware/error.middleware'
import { advancedMetricsService } from '../services/advanced-metrics.service'

const router = Router()

// GET /advanced-metrics?month=YYYY-MM-01
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { month } = req.query as Record<string, string>

  const data = await advancedMetricsService.getAdvancedMetrics(tenantId, month)
  res.json({ success: true, data })
}))

export default router
