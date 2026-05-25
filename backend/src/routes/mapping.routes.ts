import { Router, Request, Response } from 'express'
import multer from 'multer'
import { mappingService } from '../services/mapping.service'
import { asyncHandler, AppError } from '../middleware/error.middleware'
import logger from '../logger'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
})

// POST /mapping/analyze — parse file headers and return AI column suggestions
router.post(
  '/analyze',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new AppError('No file uploaded', 400, 'NO_FILE')

    try {
      const entity = (req.body.entity as 'invoices' | 'companies') || 'invoices'
      const result = mappingService.analyzeBuffer(req.file.buffer, req.file.originalname, entity)
      res.json({ success: true, data: result })
    } catch (err: any) {
      logger.error('Mapping analyze error', err)
      throw new AppError(err.message, 500, 'ANALYZE_ERROR')
    }
  })
)

// GET /mapping/templates
router.get(
  '/templates',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId
    const templates = await mappingService.getTemplates(tenantId)
    res.json({ success: true, data: templates })
  })
)

// POST /mapping/templates
router.post(
  '/templates',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId
    const { name, source_system, column_map } = req.body

    if (!name) throw new AppError('name is required', 400, 'VALIDATION_ERROR')
    if (!column_map || typeof column_map !== 'object')
      throw new AppError('column_map is required', 400, 'VALIDATION_ERROR')

    const template = await mappingService.saveTemplate(
      tenantId,
      name,
      source_system || null,
      column_map
    )
    res.json({ success: true, data: template })
  })
)

// DELETE /mapping/templates/:id
router.delete(
  '/templates/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId
    await mappingService.deleteTemplate(tenantId, req.params.id)
    res.json({ success: true })
  })
)

export default router
