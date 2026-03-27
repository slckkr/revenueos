import { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware/error.middleware'
import { dataHealthService } from '../services/data-health.service'

const router = Router()

// GET /data-health — get current snapshot (today's or compute fresh)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const data = await dataHealthService.getCurrent(tenantId)
  res.json({ success: true, data })
}))

// POST /data-health/compute — force recompute and save
router.post('/compute', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const data = await dataHealthService.computeAndSave(tenantId)
  res.json({ success: true, data })
}))

// GET /data-health/history?days=30
router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const days = parseInt((req.query.days as string) || '30', 10)

  const data = await dataHealthService.getHistory(tenantId, days)
  res.json({ success: true, data })
}))

export default router
