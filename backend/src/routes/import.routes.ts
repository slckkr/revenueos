import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import * as XLSX from 'xlsx'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'
import { importExcelService } from '../services/import-excel.service'
import { importXmlService } from '../services/import-xml.service'
import { importCompanyService } from '../services/import-company.service'
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

    // Derive events for the rebuild range (avoids Supabase 1000-row cap on ledger scan)
    await revenueEventsService.deriveEventsRange(tenantId, `${fromMonth}-01`, `${toMonth}-01`)

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
    const allowed = ['.xlsx', '.xls', '.csv', '.xml', '.json']
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

// POST /import/companies/preview — dry-run, returns will_create / will_update counts
router.post(
  '/companies/preview',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new AppError('No file uploaded', 400, 'NO_FILE')
    const tenantId = req.user!.tenantId
    const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : undefined
    const result = await importCompanyService.preview(tenantId, req.file.buffer, req.file.originalname, mapping)
    res.json({ success: true, data: result })
  })
)

// POST /import/companies — import company list (Excel / CSV / JSON)
router.post(
  '/companies',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new AppError('No file uploaded', 400, 'NO_FILE')
    const tenantId = req.user!.tenantId
    const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : undefined
    const conflictMode = (req.body.conflict_mode as 'skip' | 'overwrite') || 'skip'
    const ext = path.extname(req.file.originalname).toLowerCase()
    const source = ext === '.json' ? 'json' : ext === '.csv' ? 'csv' : 'excel'
    const result = await importCompanyService.importFile(tenantId, req.file.buffer, req.file.originalname, source, mapping, conflictMode)
    res.json({ success: true, data: result })
  })
)

// GET /import/sample/:entity — download a sample Excel file with all mappable columns
router.get(
  '/sample/:entity',
  asyncHandler(async (req: Request, res: Response) => {
    const entity = req.params.entity as 'invoices' | 'companies'

    if (entity === 'companies') {
      const headers = [
        'Company Name', 'Website / Domain', 'Email', 'Phone 1', 'Phone 2',
        'Country', 'City (İl)', 'District (İlçe)', 'Address', 'Postal Code',
        'Segment (SMB/MID/ENT)', 'Status', 'Lifecycle Stage', 'Industry / Sector',
        'Employee Count', 'Annual Revenue', 'External ID / ERP Code', 'HubSpot ID',
        'Chamber of Commerce', 'NACE Description', 'NACE Code',
        'ISIC Description', 'ISIC Code',
        'Net Sales (TL)', 'Production Sales Net (TL)', 'Gross Value Added (TL)',
        'Equity / Özkaynaklar (TL)', 'Total Assets / Aktif (TL)',
        'Pre-tax Profit (TL)', 'EBITDA / FAVÖK (TL)', 'Exports (Thousand $)',
        'Capital Public %', 'Capital Private %', 'Capital Foreign %', 'Capital Float %',
        'ISO 500 Rank', 'ISO 500 Prev Year Rank', 'Data Year', 'Strategic Notes',
      ]
      const sample1: Record<string, unknown> = {
        'Company Name': 'Acme Teknoloji A.Ş.',
        'Website / Domain': 'acme.com.tr',
        'Email': 'info@acme.com.tr',
        'Phone 1': '+90 212 555 0100',
        'Phone 2': '',
        'Country': 'TR',
        'City (İl)': 'İstanbul',
        'District (İlçe)': 'Şişli',
        'Address': 'Büyükdere Cad. No:123',
        'Postal Code': '34394',
        'Segment (SMB/MID/ENT)': 'MID',
        'Status': 'active',
        'Lifecycle Stage': 'customer',
        'Industry / Sector': 'Yazılım',
        'Employee Count': 250,
        'Annual Revenue': 15000000,
        'External ID / ERP Code': 'ERP-001',
        'HubSpot ID': '',
        'Chamber of Commerce': 'İstanbul Ticaret Odası',
        'NACE Description': 'Yazılım geliştirme faaliyetleri',
        'NACE Code': '62.01',
        'ISIC Description': 'Computer programming activities',
        'ISIC Code': '6201',
        'Net Sales (TL)': 14500000,
        'Production Sales Net (TL)': 12000000,
        'Gross Value Added (TL)': 8000000,
        'Equity / Özkaynaklar (TL)': 5000000,
        'Total Assets / Aktif (TL)': 9000000,
        'Pre-tax Profit (TL)': 2500000,
        'EBITDA / FAVÖK (TL)': 3200000,
        'Exports (Thousand $)': 450,
        'Capital Public %': 0,
        'Capital Private %': 100,
        'Capital Foreign %': 0,
        'Capital Float %': 0,
        'ISO 500 Rank': 342,
        'ISO 500 Prev Year Rank': 387,
        'Data Year': 2023,
        'Strategic Notes': 'Key enterprise account',
      }
      const sample2: Record<string, unknown> = {
        'Company Name': 'Beta Lojistik Ltd. Şti.',
        'Website / Domain': 'betaloj.com',
        'Email': 'info@betaloj.com',
        'Phone 1': '+90 312 444 0200',
        'Phone 2': '',
        'Country': 'TR',
        'City (İl)': 'Ankara',
        'District (İlçe)': 'Çankaya',
        'Address': 'Atatürk Bulvarı No:45',
        'Postal Code': '06420',
        'Segment (SMB/MID/ENT)': 'SMB',
        'Status': 'active',
        'Lifecycle Stage': 'prospect',
        'Industry / Sector': 'Lojistik',
        'Employee Count': 85,
        'Annual Revenue': 4200000,
        'External ID / ERP Code': 'ERP-002',
        'HubSpot ID': '',
        'Chamber of Commerce': '',
        'NACE Description': 'Kara yolu yük taşımacılığı',
        'NACE Code': '49.41',
        'ISIC Description': 'Freight transport by road',
        'ISIC Code': '4941',
        'Net Sales (TL)': 4000000,
        'Production Sales Net (TL)': 3800000,
        'Gross Value Added (TL)': 1500000,
        'Equity / Özkaynaklar (TL)': 1200000,
        'Total Assets / Aktif (TL)': 2800000,
        'Pre-tax Profit (TL)': 380000,
        'EBITDA / FAVÖK (TL)': 620000,
        'Exports (Thousand $)': 0,
        'Capital Public %': 0,
        'Capital Private %': 100,
        'Capital Foreign %': 0,
        'Capital Float %': 0,
        'ISO 500 Rank': null,
        'ISO 500 Prev Year Rank': null,
        'Data Year': 2023,
        'Strategic Notes': '',
      }

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet([sample1, sample2], { header: headers })
      ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 18) }))
      XLSX.utils.book_append_sheet(wb, ws, 'Companies')

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename="sample_companies.xlsx"')
      res.send(buf)
      return
    }

    // Invoices sample
    const headers = [
      'Company Name', 'Invoice Number', 'Invoice Date', 'Amount', 'Currency',
      'Service Start Date', 'Service End Date', 'Product / Service',
    ]
    const sample1: Record<string, unknown> = {
      'Company Name': 'Acme Teknoloji A.Ş.',
      'Invoice Number': 'INV-2024-001',
      'Invoice Date': '2024-01-15',
      'Amount': 12000,
      'Currency': 'TRY',
      'Service Start Date': '2024-01-01',
      'Service End Date': '2024-01-31',
      'Product / Service': 'SaaS Subscription - Enterprise',
    }
    const sample2: Record<string, unknown> = {
      'Company Name': 'Beta Lojistik Ltd. Şti.',
      'Invoice Number': 'INV-2024-002',
      'Invoice Date': '2024-01-20',
      'Amount': 5000,
      'Currency': 'USD',
      'Service Start Date': '2024-01-01',
      'Service End Date': '2024-03-31',
      'Product / Service': 'SaaS Subscription - SMB',
    }

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet([sample1, sample2], { header: headers })
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 18) }))
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="sample_invoices.xlsx"')
    res.send(buf)
  })
)

export default router
