import * as XLSX from 'xlsx'
import { supabase } from '../config/supabase'
import logger from '../logger'

export interface ImportMapping {
  company_name_col: string
  invoice_number_col: string
  issue_date_col: string
  amount_col: string
  currency_col?: string
  service_start_col?: string
  service_end_col?: string
  product_col?: string
}

// Known aliases for each field (case-insensitive)
const FIELD_ALIASES: Record<keyof ImportMapping, string[]> = {
  company_name_col:   ['company', 'müşteri', 'müşteri adı', 'firma', 'firma adı', 'customer', 'client', 'şirket', 'şirket adı'],
  invoice_number_col: ['invoice no', 'invoice number', 'invoice #', 'fatura no', 'fatura numarası', 'fatura #', 'no', 'number', 'inv no'],
  issue_date_col:     ['date', 'tarih', 'fatura tarihi', 'invoice date', 'issue date', 'düzenleme tarihi'],
  amount_col:         ['amount', 'tutar', 'toplam', 'total', 'total amount', 'fatura tutarı', 'price', 'fiyat'],
  currency_col:       ['currency', 'para birimi', 'döviz', 'cur'],
  service_start_col:  ['service start', 'start date', 'hizmet başlangıcı', 'başlangıç', 'period start'],
  service_end_col:    ['service end', 'end date', 'hizmet bitişi', 'bitiş', 'period end'],
  product_col:        ['product', 'ürün', 'hizmet', 'service', 'plan', 'paket'],
}

interface ImportResult {
  file_id: string
  records_imported: number
  skipped_duplicates: number
  overwritten_duplicates: number
  errors: Array<{ row: number; message: string }>
  detected_columns?: Record<string, string>
}

export interface ConflictPreview {
  total_rows: number
  new_rows: number
  conflicts: Array<{
    invoice_number: string
    company: string
    existing_date: string
    existing_amount: number
    new_date: string
    new_amount: number
  }>
  detected_columns: Record<string, string>
  parse_errors: Array<{ row: number; message: string }>
}

/**
 * Given actual Excel header keys, builds a resolved mapping
 * by doing case-insensitive alias lookup.
 */
function resolveMapping(headers: string[], providedMapping?: Partial<ImportMapping>): ImportMapping & { _detected: Record<string, string> } {
  const normalized = headers.map((h) => ({ original: h, lower: h.trim().toLowerCase() }))

  const findCol = (aliases: string[]): string | undefined => {
    for (const alias of aliases) {
      const found = normalized.find((h) => h.lower === alias.toLowerCase())
      if (found) return found.original
    }
    return undefined
  }

  const detected: Record<string, string> = {}
  const resolve = (field: keyof ImportMapping, provided?: string): string | undefined => {
    if (provided) return provided
    const col = findCol(FIELD_ALIASES[field])
    if (col) detected[field] = col
    return col
  }

  return {
    company_name_col:   resolve('company_name_col',   providedMapping?.company_name_col)   ?? '',
    invoice_number_col: resolve('invoice_number_col', providedMapping?.invoice_number_col) ?? '',
    issue_date_col:     resolve('issue_date_col',     providedMapping?.issue_date_col)     ?? '',
    amount_col:         resolve('amount_col',          providedMapping?.amount_col)          ?? '',
    currency_col:       resolve('currency_col',        providedMapping?.currency_col),
    service_start_col:  resolve('service_start_col',   providedMapping?.service_start_col),
    service_end_col:    resolve('service_end_col',     providedMapping?.service_end_col),
    product_col:        resolve('product_col',          providedMapping?.product_col),
    _detected: detected,
  }
}

/** Case-insensitive column value lookup */
function getCol(row: Record<string, unknown>, colName: string | undefined): unknown {
  if (!colName) return ''
  // Direct match first (faster)
  if (colName in row) return row[colName]
  // Case-insensitive fallback
  const lower = colName.toLowerCase()
  const key = Object.keys(row).find((k) => k.toLowerCase() === lower)
  return key ? row[key] : ''
}

class ImportExcelService {
  /** Parse file and check for conflicts without importing anything */
  async previewConflicts(
    tenantId: string,
    buffer: Buffer,
    filename: string,
    source: 'excel' | 'csv',
    providedMapping?: Partial<ImportMapping>
  ): Promise<ConflictPreview> {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    if (rows.length === 0) {
      return { total_rows: 0, new_rows: 0, conflicts: [], detected_columns: {}, parse_errors: [] }
    }

    const headers = Object.keys(rows[0])
    const mapping = resolveMapping(headers, providedMapping)
    const parseErrors: Array<{ row: number; message: string }> = []

    // Collect all invoice numbers from the file
    const fileInvoiceNumbers: Array<{ rowNum: number; invoiceNumber: string; company: string; date: string; amount: number }> = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2
      const invoiceNumber = String(getCol(row, mapping.invoice_number_col) || '').trim()
      const company = String(getCol(row, mapping.company_name_col) || '').trim()
      const date = parseDate(getCol(row, mapping.issue_date_col)) || ''
      const amount = parseAmount(getCol(row, mapping.amount_col))

      if (!invoiceNumber || !company || !date) {
        if (!invoiceNumber) parseErrors.push({ row: rowNum, message: `Row ${rowNum}: Invoice number is empty` })
        continue
      }
      fileInvoiceNumbers.push({ rowNum, invoiceNumber, company, date, amount })
    }

    if (fileInvoiceNumbers.length === 0) {
      return { total_rows: rows.length, new_rows: 0, conflicts: [], detected_columns: mapping._detected, parse_errors: parseErrors }
    }

    // Batch-check which invoice numbers already exist in DB
    const invNumbers = fileInvoiceNumbers.map((r) => r.invoiceNumber)
    const { data: existing } = await supabase
      .from('invoices')
      .select('invoice_number, issue_date, total_amount')
      .eq('tenant_id', tenantId)
      .in('invoice_number', invNumbers)

    const existingMap: Record<string, { issue_date: string; total_amount: number }> = {}
    for (const e of existing || []) existingMap[e.invoice_number] = e

    const conflicts: ConflictPreview['conflicts'] = []
    let newRows = 0

    for (const item of fileInvoiceNumbers) {
      if (existingMap[item.invoiceNumber]) {
        const ex = existingMap[item.invoiceNumber]
        conflicts.push({
          invoice_number: item.invoiceNumber,
          company: item.company,
          existing_date: ex.issue_date,
          existing_amount: ex.total_amount,
          new_date: item.date,
          new_amount: item.amount,
        })
      } else {
        newRows++
      }
    }

    return {
      total_rows: rows.length,
      new_rows: newRows,
      conflicts,
      detected_columns: mapping._detected,
      parse_errors: parseErrors,
    }
  }

  async importFile(
    tenantId: string,
    buffer: Buffer,
    filename: string,
    source: 'excel' | 'csv',
    providedMapping?: Partial<ImportMapping>,
    conflictMode: 'skip' | 'overwrite' = 'skip'
  ): Promise<ImportResult> {
    const { data: importFile, error: insertErr } = await supabase
      .from('import_files')
      .insert({ tenant_id: tenantId, source, filename, status: 'processing' })
      .select()
      .single()

    if (insertErr || !importFile) throw new Error('Failed to create import record')

    const fileId = importFile.id
    const errors: Array<{ row: number; message: string }> = []
    let imported = 0
    let skippedDuplicates = 0
    let overwrittenDuplicates = 0
    let detectedColumns: Record<string, string> = {}

    try {
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

      if (rows.length === 0) {
        await supabase
          .from('import_files')
          .update({ status: 'error', errors_json: [{ message: 'File is empty or has no data rows' }] })
          .eq('id', fileId)
        return { file_id: fileId, records_imported: 0, skipped_duplicates: 0, overwritten_duplicates: 0, errors: [{ row: 0, message: 'File is empty or has no data rows' }] }
      }

      // Detect column mapping from actual headers
      const headers = Object.keys(rows[0])
      const mapping = resolveMapping(headers, providedMapping)
      detectedColumns = mapping._detected

      logger.info('Excel import column detection', {
        filename,
        headers,
        resolved: {
          company: mapping.company_name_col,
          invoice: mapping.invoice_number_col,
          date: mapping.issue_date_col,
          amount: mapping.amount_col,
          currency: mapping.currency_col,
        },
      })

      // If required columns not found, fail early with helpful message
      const missing: string[] = []
      if (!mapping.company_name_col) missing.push('Company name column')
      if (!mapping.invoice_number_col) missing.push('Invoice number column')
      if (!mapping.issue_date_col) missing.push('Date column')
      if (!mapping.amount_col) missing.push('Amount column')

      if (missing.length > 0) {
        const msg = `Could not find required columns: ${missing.join(', ')}. Detected headers: [${headers.join(', ')}]. Expected names like: Company, Invoice No, Date, Amount (or Turkish equivalents)`
        await supabase
          .from('import_files')
          .update({ status: 'error', errors_json: [{ message: msg }] })
          .eq('id', fileId)
        return { file_id: fileId, records_imported: 0, skipped_duplicates: 0, overwritten_duplicates: 0, errors: [{ row: 0, message: msg }] }
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2

        try {
          const companyName   = String(getCol(row, mapping.company_name_col)   || '').trim()
          const invoiceNumber = String(getCol(row, mapping.invoice_number_col) || '').trim()
          const issueDate     = parseDate(getCol(row, mapping.issue_date_col))
          const amount        = parseAmount(getCol(row, mapping.amount_col))
          const currency      = String(getCol(row, mapping.currency_col) || 'USD').trim().toUpperCase() || 'USD'
          const serviceStart  = parseDate(getCol(row, mapping.service_start_col))
          const serviceEnd    = parseDate(getCol(row, mapping.service_end_col))
          const productName   = String(getCol(row, mapping.product_col) || '').trim() || null

          if (!companyName)                { errors.push({ row: rowNum, message: `Row ${rowNum}: Company name is empty` }); continue }
          if (!invoiceNumber)              { errors.push({ row: rowNum, message: `Row ${rowNum}: Invoice number is empty` }); continue }
          if (!issueDate)                  { errors.push({ row: rowNum, message: `Row ${rowNum}: Invalid date "${getCol(row, mapping.issue_date_col)}"` }); continue }
          if (isNaN(amount) || amount <= 0){ errors.push({ row: rowNum, message: `Row ${rowNum}: Invalid amount "${getCol(row, mapping.amount_col)}"` }); continue }

          const companyId = await this.upsertCompany(tenantId, companyName)

          let productId: string | null = null
          if (productName) {
            productId = await this.upsertProduct(tenantId, productName)
          }

          const invoicePayload = {
            tenant_id: tenantId,
            company_id: companyId,
            invoice_number: invoiceNumber,
            issue_date: issueDate,
            service_period_start: serviceStart,
            service_period_end: serviceEnd || serviceStart,
            total_amount: amount,
            currency,
            status: 'issued',
            source_type: 'excel_import',
            import_file_id: fileId,
          }

          if (conflictMode === 'overwrite') {
            // Check if it exists first to track the count
            const { data: existing } = await supabase
              .from('invoices')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('invoice_number', invoiceNumber)
              .single()

            const { error: invErr } = await supabase.from('invoices').upsert(
              invoicePayload,
              { onConflict: 'tenant_id,invoice_number' }
            )
            if (invErr) {
              errors.push({ row: rowNum, message: `Row ${rowNum}: DB error — ${invErr.message}` })
              continue
            }
            if (existing?.id) overwrittenDuplicates++
            else imported++
          } else {
            // 'skip' mode — check first, skip if exists
            const { data: existing } = await supabase
              .from('invoices')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('invoice_number', invoiceNumber)
              .single()

            if (existing?.id) {
              skippedDuplicates++
              continue
            }

            const { error: invErr } = await supabase.from('invoices').insert(invoicePayload)
            if (invErr) {
              errors.push({ row: rowNum, message: `Row ${rowNum}: DB error — ${invErr.message}` })
              continue
            }
            imported++
          }
        } catch (rowErr: any) {
          errors.push({ row: rowNum, message: `Row ${rowNum}: ${rowErr.message}` })
        }
      }
    } catch (parseErr: any) {
      logger.error('Excel parse error', parseErr)
      await supabase
        .from('import_files')
        .update({ status: 'error', errors_json: [{ message: parseErr.message }] })
        .eq('id', fileId)
      throw parseErr
    }

    const finalStatus = imported === 0 && errors.length > 0 ? 'error'
      : errors.length > 0 ? 'partial'
      : 'done'

    await supabase
      .from('import_files')
      .update({
        status: finalStatus,
        records_imported: imported,
        errors_json: errors.length > 0 ? errors : null,
      })
      .eq('id', fileId)

    return { file_id: fileId, records_imported: imported, skipped_duplicates: skippedDuplicates, overwritten_duplicates: overwrittenDuplicates, errors, detected_columns: detectedColumns }
  }

  private async upsertCompany(tenantId: string, name: string): Promise<string> {
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('name', name)
      .single()

    if (existing?.id) return existing.id

    const { data: created } = await supabase
      .from('companies')
      .insert({ tenant_id: tenantId, name })
      .select('id')
      .single()

    return created!.id
  }

  private async upsertProduct(tenantId: string, name: string): Promise<string> {
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('name', name)
      .single()

    if (existing?.id) return existing.id

    const { data: created } = await supabase
      .from('products')
      .insert({ tenant_id: tenantId, name, billing_period: 'monthly' })
      .select('id')
      .single()

    return created!.id
  }
}

/** Parse amount handling both US (1,500.00) and European/Turkish (1.500,00) formats */
function parseAmount(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return value
  const str = String(value).trim().replace(/[^0-9.,-]/g, '').trim()
  if (!str) return 0
  const lastDot = str.lastIndexOf('.')
  const lastComma = str.lastIndexOf(',')
  if (lastComma > lastDot) {
    // European/Turkish: 1.500,00 → dot is thousands, comma is decimal
    return parseFloat(str.replace(/\./g, '').replace(',', '.'))
  } else if (lastDot > lastComma) {
    // US: 1,500.00 → comma is thousands, dot is decimal
    return parseFloat(str.replace(/,/g, ''))
  }
  return parseFloat(str)
}

function parseDate(value: unknown): string | null {
  if (!value) return null

  // Date object (xlsx cellDates: true)
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    return value.toISOString().split('T')[0]
  }

  const str = String(value).trim()
  if (!str) return null

  // Excel serial number (number stored as string)
  const serial = Number(str)
  if (!isNaN(serial) && serial > 1000 && serial < 100000) {
    const d = XLSX.SSF.parse_date_code(serial)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }

  // DD.MM.YYYY (Turkish format)
  const dotMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dotMatch) return `${dotMatch[3]}-${dotMatch[2].padStart(2, '0')}-${dotMatch[1].padStart(2, '0')}`

  // DD/MM/YYYY
  const slashDMY = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashDMY) return `${slashDMY[3]}-${slashDMY[2].padStart(2, '0')}-${slashDMY[1].padStart(2, '0')}`

  // Native Date parse (handles YYYY-MM-DD, MM/DD/YYYY, etc.)
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]

  return null
}

export const importExcelService = new ImportExcelService()
