import { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware/error.middleware'
import { exportExcelService } from '../services/export-excel.service'

const router = Router()

// GET /api/export/template — blank import template
router.get('/template', asyncHandler(async (req: Request, res: Response) => {
  const buffer = exportExcelService.generateTemplate()
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="revenueos-import-template.xlsx"')
  res.send(buffer)
}))

// GET /api/export/companies
router.get('/companies', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const buffer = await exportExcelService.exportCompanies(tenantId)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="companies.xlsx"')
  res.send(buffer)
}))

// GET /api/export/invoices?month=YYYY-MM
router.get('/invoices', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const month = typeof req.query.month === 'string' ? req.query.month : undefined
  const buffer = await exportExcelService.exportInvoices(tenantId, month)
  const filename = month ? `invoices-${month}.xlsx` : 'invoices.xlsx'
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(buffer)
}))

// GET /api/export/ledger?month=YYYY-MM
router.get('/ledger', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const month = typeof req.query.month === 'string' ? req.query.month : undefined
  const buffer = await exportExcelService.exportLedger(tenantId, month)
  const filename = month ? `ledger-${month}.xlsx` : 'ledger.xlsx'
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(buffer)
}))

export default router
