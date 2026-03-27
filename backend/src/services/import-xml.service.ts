import xml2js from 'xml2js'
import { supabase } from '../config/supabase'
import logger from '../logger'

/**
 * Logo e-Fatura / e-Arşiv XML import service.
 *
 * Supports:
 * 1. Logo Tiger e-Fatura export (UBL-TR standard)
 * 2. Logo Go e-Arşiv export
 * 3. Generic Turkish e-Fatura UBL-TR 2.1
 *
 * Key XML paths (UBL-TR):
 * - /Invoice/ID → invoice number
 * - /Invoice/IssueDate → issue date
 * - /Invoice/AccountingSupplierParty/Party/PartyName/Name → supplier
 * - /Invoice/AccountingCustomerParty/Party/PartyName/Name → customer name
 * - /Invoice/LegalMonetaryTotal/TaxInclusiveAmount → total with tax
 * - /Invoice/LegalMonetaryTotal/PayableAmount → net payable
 * - /Invoice/InvoiceLine → line items
 */

interface ImportResult {
  file_id: string
  records_imported: number
  errors: Array<{ invoice?: string; message: string }>
}

class ImportXmlService {
  async importFile(
    tenantId: string,
    buffer: Buffer,
    filename: string
  ): Promise<ImportResult> {
    const { data: importFile } = await supabase
      .from('import_files')
      .insert({ tenant_id: tenantId, source: 'xml_logo', filename, status: 'processing' })
      .select()
      .single()

    const fileId = importFile!.id
    const errors: Array<{ invoice?: string; message: string }> = []
    let imported = 0

    try {
      const xmlStr = buffer.toString('utf-8')
      const invoices = await this.parseXml(xmlStr)

      for (const inv of invoices) {
        try {
          await this.processInvoice(tenantId, inv, fileId)
          imported++
        } catch (err: any) {
          errors.push({ invoice: inv.invoiceNumber, message: err.message })
        }
      }
    } catch (parseErr: any) {
      logger.error('XML parse error', parseErr)
      await supabase
        .from('import_files')
        .update({ status: 'error', errors_json: [{ message: parseErr.message }] })
        .eq('id', fileId)
      throw parseErr
    }

    await supabase
      .from('import_files')
      .update({
        status: 'done',
        records_imported: imported,
        errors_json: errors.length > 0 ? errors : null,
      })
      .eq('id', fileId)

    return { file_id: fileId, records_imported: imported, errors }
  }

  private async parseXml(xmlStr: string): Promise<ParsedInvoice[]> {
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true,
      tagNameProcessors: [xml2js.processors.stripPrefix],
    })

    const result = await parser.parseStringPromise(xmlStr)

    // Handle both single invoice and wrapped list
    let invoiceNodes: unknown[] = []

    if (result.Invoice) {
      // Single UBL invoice file
      invoiceNodes = [result.Invoice]
    } else if (result.Invoices?.Invoice) {
      // Logo batch export wrapper
      const inv = result.Invoices.Invoice
      invoiceNodes = Array.isArray(inv) ? inv : [inv]
    } else if (result.EArchiveReport?.Invoice) {
      // e-Archive report format
      const inv = result.EArchiveReport.Invoice
      invoiceNodes = Array.isArray(inv) ? inv : [inv]
    }

    return invoiceNodes.map((node: any) => this.extractInvoice(node)).filter(Boolean) as ParsedInvoice[]
  }

  private extractInvoice(node: any): ParsedInvoice | null {
    try {
      const invoiceNumber = extractText(node, ['ID', 'InvoiceNumber', 'FaturaNo'])
      const issueDate = extractText(node, ['IssueDate', 'IssueDateTime', 'FaturaTarihi'])
      const customerName = extractPath(node, [
        ['AccountingCustomerParty', 'Party', 'PartyName', 'Name'],
        ['BuyerCustomerParty', 'Party', 'PartyName', 'Name'],
        ['CustomerName'],
        ['MusteriAdi'],
      ])

      const totalWithTax = parseAmount(extractPath(node, [
        ['LegalMonetaryTotal', 'TaxInclusiveAmount'],
        ['LegalMonetaryTotal', 'PayableAmount'],
        ['TotalAmount'],
        ['ToplamTutar'],
      ]))

      const currency = extractText(node['LegalMonetaryTotal']?.TaxInclusiveAmount, ['currencyID']) ||
        extractText(node, ['DocumentCurrencyCode']) || 'TRY'

      const servicePeriodStart = extractPath(node, [
        ['InvoicePeriod', 'StartDate'],
        ['ServicePeriodStart'],
      ])
      const servicePeriodEnd = extractPath(node, [
        ['InvoicePeriod', 'EndDate'],
        ['ServicePeriodEnd'],
      ])

      // Extract line items
      const lineNodes = node.InvoiceLine
      const lines: ParsedLine[] = []
      if (lineNodes) {
        const lineArr = Array.isArray(lineNodes) ? lineNodes : [lineNodes]
        for (const line of lineArr) {
          lines.push({
            description: extractPath(line, [['Item', 'Name'], ['Description']]) || '',
            quantity: parseFloat(extractText(line, ['InvoicedQuantity']) || '1'),
            unitPrice: parseAmount(extractPath(line, [['Price', 'PriceAmount'], ['UnitPrice']])),
            totalPrice: parseAmount(extractPath(line, [['LineExtensionAmount'], ['TotalPrice']])),
            currency,
          })
        }
      }

      if (!invoiceNumber || !issueDate || !customerName) return null

      return {
        invoiceNumber,
        issueDate: formatDate(issueDate),
        customerName,
        totalAmount: totalWithTax || 0,
        currency,
        servicePeriodStart: servicePeriodStart ? formatDate(servicePeriodStart) : null,
        servicePeriodEnd: servicePeriodEnd ? formatDate(servicePeriodEnd) : null,
        lines,
      }
    } catch (err) {
      logger.warn('Failed to extract invoice from XML node', err)
      return null
    }
  }

  private async processInvoice(tenantId: string, inv: ParsedInvoice, fileId: string): Promise<void> {
    // Upsert company
    let companyId: string
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('name', inv.customerName)
      .single()

    if (existing?.id) {
      companyId = existing.id
    } else {
      const { data: created } = await supabase
        .from('companies')
        .insert({ tenant_id: tenantId, name: inv.customerName })
        .select('id')
        .single()
      companyId = created!.id
    }

    // Upsert invoice
    const { data: invoice, error } = await supabase
      .from('invoices')
      .upsert(
        {
          tenant_id: tenantId,
          company_id: companyId,
          invoice_number: inv.invoiceNumber,
          issue_date: inv.issueDate,
          service_period_start: inv.servicePeriodStart,
          service_period_end: inv.servicePeriodEnd || inv.servicePeriodStart,
          total_amount: inv.totalAmount,
          currency: inv.currency,
          status: 'issued',
          source_type: 'logo_import',
          import_file_id: fileId,
        },
        { onConflict: 'tenant_id,invoice_number', ignoreDuplicates: true }
      )
      .select()
      .single()

    if (error) throw new Error(error.message)

    // Insert lines if they don't exist
    if (invoice && inv.lines.length > 0) {
      await supabase.from('invoice_lines').upsert(
        inv.lines.map((l) => ({
          invoice_id: invoice.id,
          description: l.description,
          quantity: l.quantity || 1,
          unit_price: l.unitPrice || 0,
          total_price: l.totalPrice || 0,
          currency: l.currency,
        }))
      )
    }
  }
}

// ─── XML extraction helpers ───────────────────────────────────────────────────

interface ParsedInvoice {
  invoiceNumber: string
  issueDate: string
  customerName: string
  totalAmount: number
  currency: string
  servicePeriodStart: string | null
  servicePeriodEnd: string | null
  lines: ParsedLine[]
}

interface ParsedLine {
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  currency: string
}

function extractText(node: any, keys: string[]): string | null {
  if (!node) return null
  for (const key of keys) {
    if (node[key] !== undefined) {
      const val = node[key]
      if (typeof val === 'string') return val
      if (typeof val === 'object' && val._) return val._
      if (typeof val === 'object' && val['#text']) return val['#text']
    }
  }
  return null
}

function extractPath(node: any, paths: string[][]): string | null {
  if (!node) return null
  for (const path of paths) {
    let current = node
    let found = true
    for (const key of path) {
      if (current?.[key] === undefined) { found = false; break }
      current = current[key]
    }
    if (found && current !== undefined) {
      if (typeof current === 'string') return current
      if (typeof current === 'object' && current._) return current._
      if (typeof current === 'object' && current['#text']) return current['#text']
    }
  }
  return null
}

function parseAmount(value: string | null): number {
  if (!value) return 0
  return parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0
}

function formatDate(dateStr: string): string {
  // Handle various date formats
  if (!dateStr) return ''

  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10)

  // Turkish format: DD.MM.YYYY
  const dotMatch = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})/)
  if (dotMatch) return `${dotMatch[3]}-${dotMatch[2]}-${dotMatch[1]}`

  const d = new Date(dateStr)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]

  return dateStr
}

export const importXmlService = new ImportXmlService()
