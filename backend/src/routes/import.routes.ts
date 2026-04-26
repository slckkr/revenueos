import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'
import { importExcelService } from '../services/import-excel.service'
import { importXmlService } from '../services/import-xml.service'
import { revenueRecognitionService } from '../services/revenue-recognition.service'
import { revenueEventsService } from '../services/revenue-events.service'
import logger from '../logger'

async function autoRebuildAfterImport(tenantId: string, fileId: string): Promise<void> {
  try {
    // Find the date range of the newly imported invoices
    const { data: rows } = await supabase
      .from('invoices')
      .select('issue_date, service_period_start, service_period_end')
      .eq('import_file_id', fileId)
      .not('status', 'eq', 'void')

    if (!rows || rows.length === 0) return

    let minDate = '9999-12-31'
    let maxDate = '0000-01-01'
    for (const row of rows) {
      const start = row.service_period_start || row.issue_date
      const end   = row.service_period_end   || row.issue_date
      if (start < minDate) minDate = start
      if (end   > maxDate) maxDate = end
    }

    const fromMonth = minDate.slice(0, 7) // YYYY-MM
    const toMonth   = maxDate.slice(0, 7)

    // Load tenant settings
    const { data: settings } = await supabase
      .from('settings')
      .select('reporting_currency, recognition_method')
      .eq('tenant_id', tenantId)
      .single()

    const reportingCurrency = settings?.reporting_currency || 'USD'
    const method = (settings?.recognition_method || 'accrual') as 'accrual' | 'cash'

    logger.info(`Auto-rebuild triggered for import ${fileId}: ${fromMonth} → ${toMonth}`)

    await revenueRecognitionService.rebuildLedger(tenantId, fromMonth, toMonth, reportingCurrency, method)

    // Derive events for full ledger range so all months are consistent
    const { data: ledgerMonths } = await supabase
      .from('revenue_ledger')
      .select('month')
      .eq('tenant_id', tenantId)
      .order('month', { ascending: true })

    const uniqueMonths = [...new Set((ledgerMonths || []).map((r: { month: string }) => r.month))]
    if (uniqueMonths.length > 0) {
      await revenueEventsService.deriveEventsRange(tenantId, uniqueMonths[0], uniqueMonths[uniqueMonths.length - 1])
    }

    logger.info(`Auto-rebuild complete for import ${fileId}`)
  } catch (err) {
    logger.error('Auto-rebuild after import failed', err)
  }
}

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

    // Fire-and-forget ledger rebuild so dashboard updates automatically
    if (result.file_id && result.records_imported > 0) {
      autoRebuildAfterImport(tenantId, result.file_id)
    }

    res.json({ success: true, data: { ...result, rebuild_triggered: result.records_imported > 0 } })
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

    if (result.file_id && result.records_imported > 0) {
      autoRebuildAfterImport(tenantId, result.file_id)
    }

    res.json({ success: true, data: { ...result, rebuild_triggered: result.records_imported > 0 } })
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

    if ((result as any).file_id && (result as any).records_imported > 0) {
      autoRebuildAfterImport(tenantId, (result as any).file_id)
    }

    res.json({ success: true, data: { ...(result as any), rebuild_triggered: (result as any).records_imported > 0 } })
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
