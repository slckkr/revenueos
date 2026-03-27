import { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware/error.middleware'
import { hubspotService } from '../services/hubspot.service'

const router = Router()

// POST /hubspot/sync — trigger a full sync (async, returns immediately)
router.post('/sync', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  // Fire and forget — sync runs in background
  hubspotService.syncAll(tenantId).catch(() => {
    // Error is already logged inside syncAll
  })

  res.json({
    success: true,
    data: { message: 'Sync started. Check /hubspot/sync/status for progress.' },
  })
}))

// GET /hubspot/sync/status — latest sync log
router.get('/sync/status', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const log = await hubspotService.getLastSyncLog(tenantId)

  res.json({ success: true, data: log || null })
}))

// GET /hubspot/sync/logs — sync history
router.get('/sync/logs', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { limit = '20' } = req.query as Record<string, string>
  const logs = await hubspotService.getSyncLogs(tenantId, parseInt(limit))

  res.json({ success: true, data: logs })
}))

export default router
