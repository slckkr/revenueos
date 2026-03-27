import { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware/error.middleware'
import { productMetricsService } from '../services/product-metrics.service'

const router = Router()

// GET /product-metrics?month=YYYY-MM-01
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { month } = req.query as Record<string, string>

  const data = await productMetricsService.getAllProductsMetrics(tenantId, month)
  res.json({ success: true, data })
}))

// GET /product-metrics/cross-sell
router.get('/cross-sell', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const data = await productMetricsService.getCrossSellMatrix(tenantId)
  res.json({ success: true, data })
}))

// GET /product-metrics/:productId?month=YYYY-MM-01
router.get('/:productId', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { productId } = req.params
  const { month } = req.query as Record<string, string>

  const data = await productMetricsService.getProductMetrics(tenantId, productId, month)
  res.json({ success: true, data })
}))

// GET /product-metrics/:productId/companies?month=YYYY-MM-01
router.get('/:productId/companies', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { productId } = req.params
  const { month } = req.query as Record<string, string>

  const data = await productMetricsService.getProductCompanies(tenantId, productId, month)
  res.json({ success: true, data })
}))

export default router
