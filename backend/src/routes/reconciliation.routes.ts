import { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware/error.middleware'
import { reconciliationService } from '../services/reconciliation.service'

const router = Router()

// GET /reconciliation/issues?status=open
router.get('/issues', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const status = req.query.status as string | undefined

  const data = await reconciliationService.getIssues(tenantId, status)
  res.json({ success: true, data })
}))

// POST /reconciliation/scan — trigger a scan manually
router.post('/scan', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const result = await reconciliationService.runScan(tenantId)
  res.json({ success: true, data: result })
}))

// PUT /reconciliation/issues/:id/resolve
router.put('/issues/:id/resolve', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { id } = req.params

  await reconciliationService.resolveIssue(tenantId, id)
  res.json({ success: true })
}))

// PUT /reconciliation/issues/:id/ignore
router.put('/issues/:id/ignore', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { id } = req.params

  await reconciliationService.ignoreIssue(tenantId, id)
  res.json({ success: true })
}))

export default router
