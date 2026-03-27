import { Router, Request, Response } from 'express'
import multer from 'multer'
import { asyncHandler } from '../middleware/error.middleware'
import { financialInputsService } from '../services/financial-inputs.service'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// GET /financial-inputs/template — download blank Excel template (10 years)
router.get('/template', asyncHandler(async (req: Request, res: Response) => {
  const buffer = financialInputsService.generateTemplate()
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="financial-inputs-template.xlsx"')
  res.send(buffer)
}))

// GET /financial-inputs/export — export existing data as Excel
router.get('/export', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const buffer = await financialInputsService.exportToExcel(tenantId)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="financial-inputs-export.xlsx"')
  res.send(buffer)
}))

// POST /financial-inputs/import — import from Excel file
router.post('/import', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  if (!req.file) {
    res.status(400).json({ success: false, error: { message: 'No file uploaded' } })
    return
  }
  const result = await financialInputsService.importFromExcel(tenantId, req.file.buffer)
  res.json({ success: true, data: result })
}))

// GET /financial-inputs?from=YYYY-MM-01&to=YYYY-MM-01
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { from, to } = req.query as Record<string, string>

  const data = await financialInputsService.getRange(tenantId, from, to)
  res.json({ success: true, data })
}))

// GET /financial-inputs/:month
router.get('/:month', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { month } = req.params

  const data = await financialInputsService.getForMonth(tenantId, month)
  res.json({ success: true, data })
}))

// POST /financial-inputs — upsert for a month
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { month, ...input } = req.body

  if (!month) {
    res.status(400).json({ success: false, error: { message: 'month is required' } })
    return
  }

  const data = await financialInputsService.upsert(tenantId, month, input)
  res.json({ success: true, data })
}))

// PUT /financial-inputs/:month — update existing
router.put('/:month', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { month } = req.params

  const data = await financialInputsService.upsert(tenantId, month, req.body)
  res.json({ success: true, data })
}))

// DELETE /financial-inputs/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { id } = req.params

  await financialInputsService.delete(tenantId, id)
  res.json({ success: true })
}))

export default router
