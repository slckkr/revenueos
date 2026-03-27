import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'
import { importExcelService } from '../services/import-excel.service'
import { importXmlService } from '../services/import-xml.service'

const router = Router()

// Memory storage — process file in-memory, don't save to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv', '.xml']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(', ')}`))
    }
  },
})

// POST /import/excel
router.post(
  '/excel',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new AppError('No file uploaded', 400, 'NO_FILE')

    const tenantId = req.user!.tenantId
    const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : undefined

    const conflictMode = (req.body.conflict_mode as 'skip' | 'overwrite') || 'skip'

    const result = await importExcelService.importFile(
      tenantId,
      req.file.buffer,
      req.file.originalname,
      'excel',
      mapping,
      conflictMode
    )

    res.json({ success: true, data: result })
  })
)

// POST /import/csv
router.post(
  '/csv',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new AppError('No file uploaded', 400, 'NO_FILE')

    const tenantId = req.user!.tenantId
    const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : undefined
    const conflictMode = (req.body.conflict_mode as 'skip' | 'overwrite') || 'skip'

    const result = await importExcelService.importFile(
      tenantId,
      req.file.buffer,
      req.file.originalname,
      'csv',
      mapping,
      conflictMode
    )

    res.json({ success: true, data: result })
  })
)

// POST /import/xml — Logo e-fatura XML
router.post(
  '/xml',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new AppError('No file uploaded', 400, 'NO_FILE')

    const tenantId = req.user!.tenantId

    const result = await importXmlService.importFile(
      tenantId,
      req.file.buffer,
      req.file.originalname
    )

    res.json({ success: true, data: result })
  })
)

// GET /import/files — import history
router.get('/files', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('import_files')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data })
}))

// DELETE /import/files/:id — delete import and all associated invoices
router.delete('/files/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { id } = req.params

  // Verify the import file belongs to this tenant
  const { data: file, error: fileErr } = await supabase
    .from('import_files')
    .select('id, filename, records_imported')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (fileErr || !file) throw new AppError('Import file not found', 404, 'NOT_FOUND')

  // Delete invoices created by this import
  const { count: deletedInvoices } = await supabase
    .from('invoices')
    .delete({ count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('import_file_id', id)

  // Delete the import file record
  await supabase.from('import_files').delete().eq('id', id)

  res.json({
    success: true,
    data: {
      message: `Import "${file.filename}" deleted`,
      deleted_invoices: deletedInvoices ?? 0,
    },
  })
}))

// POST /import/preview — parse file and return conflicts without importing
router.post(
  '/preview',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new AppError('No file uploaded', 400, 'NO_FILE')

    const tenantId = req.user!.tenantId
    const source = (req.body.source as 'excel' | 'csv') || 'excel'
    const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : undefined

    const result = await importExcelService.previewConflicts(
      tenantId,
      req.file.buffer,
      req.file.originalname,
      source,
      mapping
    )

    res.json({ success: true, data: result })
  })
)

export default router
