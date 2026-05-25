import * as XLSX from 'xlsx'
import { supabase } from '../config/supabase'
import type { ImportMapping } from './import-excel.service'
import { COMPANY_FIELD_ALIASES, resolveCompanyMapping } from './import-company.service'

const TARGET_FIELDS: Array<{
  field: keyof ImportMapping
  label: string
  required: boolean
  aliases: string[]
}> = [
  {
    field: 'company_name_col',
    label: 'Company Name',
    required: true,
    aliases: [
      'company', 'müşteri', 'müşteri adı', 'firma', 'firma adı',
      'customer', 'client', 'şirket', 'şirket adı', 'account',
      'hesap', 'alıcı', 'alici', 'company name', 'customer name',
    ],
  },
  {
    field: 'invoice_number_col',
    label: 'Invoice Number',
    required: true,
    aliases: [
      'invoice no', 'invoice number', 'invoice #', 'fatura no',
      'fatura numarası', 'fatura #', 'inv no', 'invoice', 'fatura',
      'belge no', 'no', 'number', 'document no', 'ref no',
    ],
  },
  {
    field: 'issue_date_col',
    label: 'Issue Date',
    required: true,
    aliases: [
      'date', 'tarih', 'fatura tarihi', 'invoice date', 'issue date',
      'düzenleme tarihi', 'issuedate', 'invoicedate', 'billing date',
      'transaction date', 'işlem tarihi',
    ],
  },
  {
    field: 'amount_col',
    label: 'Amount',
    required: true,
    aliases: [
      'amount', 'tutar', 'toplam', 'total', 'total amount',
      'fatura tutarı', 'price', 'fiyat', 'net tutar', 'net amount',
      'toplam tutar', 'subtotal', 'grand total', 'invoice amount',
    ],
  },
  {
    field: 'currency_col',
    label: 'Currency',
    required: false,
    aliases: [
      'currency', 'para birimi', 'döviz', 'cur', 'doviz',
      'para', 'currency code', 'iso code', 'curr',
    ],
  },
  {
    field: 'service_start_col',
    label: 'Service Start Date',
    required: false,
    aliases: [
      'service start', 'start date', 'hizmet başlangıcı', 'başlangıç',
      'period start', 'servicestart', 'startdate', 'start',
      'from date', 'period from', 'hizmet başlangıç tarihi',
    ],
  },
  {
    field: 'service_end_col',
    label: 'Service End Date',
    required: false,
    aliases: [
      'service end', 'end date', 'hizmet bitişi', 'bitiş',
      'period end', 'serviceend', 'enddate', 'end',
      'to date', 'period to', 'hizmet bitiş tarihi',
    ],
  },
  {
    field: 'product_col',
    label: 'Product / Service',
    required: false,
    aliases: [
      'product', 'ürün', 'hizmet', 'service', 'plan', 'paket',
      'urun', 'product name', 'item', 'description', 'açıklama',
      'aciklama', 'service name', 'item name',
    ],
  },
]

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function scoreColumn(colName: string, aliases: string[]): number {
  const lower = colName.trim().toLowerCase()

  // Exact alias match
  if (aliases.some((a) => a.toLowerCase() === lower)) return 95

  // Alias is contained in column name or vice versa
  for (const alias of aliases) {
    const al = alias.toLowerCase()
    if (lower.includes(al) || al.includes(lower)) return 78
  }

  // Fuzzy match via Levenshtein
  let best = 0
  for (const alias of aliases) {
    const al = alias.toLowerCase()
    const maxLen = Math.max(lower.length, al.length)
    if (maxLen === 0) continue
    const dist = levenshtein(lower, al)
    const sim = (maxLen - dist) / maxLen
    if (sim >= 0.7) best = Math.max(best, Math.round(sim * 70))
  }
  return best
}

function detectType(samples: unknown[]): 'date' | 'number' | 'text' {
  const nonempty = samples.filter((s) => s !== null && s !== undefined && s !== '')
  if (nonempty.length === 0) return 'text'

  let dates = 0
  let nums = 0

  for (const v of nonempty) {
    if (v instanceof Date) { dates++; continue }
    const str = String(v).trim()

    // Date patterns
    if (
      /^\d{1,2}[./\-]\d{1,2}[./\-]\d{4}$/.test(str) ||
      /^\d{4}[./\-]\d{1,2}[./\-]\d{1,2}$/.test(str) ||
      (!isNaN(new Date(str).getTime()) && isNaN(Number(str)))
    ) {
      dates++
      continue
    }

    // Number (handles comma-decimal and dot-decimal)
    const cleaned = str.replace(/[\s]/g, '').replace(/,/g, '.')
    if (!isNaN(parseFloat(cleaned)) && isFinite(Number(cleaned))) {
      nums++
    }
  }

  if (dates >= nonempty.length * 0.5) return 'date'
  if (nums >= nonempty.length * 0.5) return 'number'
  return 'text'
}

export interface ColumnInfo {
  name: string
  sample_values: string[]
  detected_type: 'date' | 'number' | 'text'
}

export interface FieldSuggestion {
  field: string
  label: string
  required: boolean
  suggested_column: string | null
  confidence: number
}

export interface AnalyzeResult {
  columns: ColumnInfo[]
  suggestions: FieldSuggestion[]
  entity: 'invoices' | 'companies'
}

export interface MappingTemplate {
  id: string
  tenant_id: string
  name: string
  source_system: string | null
  column_map: Partial<Record<keyof ImportMapping, string>>
  created_at: string
  updated_at: string
}

// Company field metadata for AI analysis
const COMPANY_TARGET_FIELDS: Array<{ field: string; label: string; required: boolean; aliases: string[] }> = Object.entries(COMPANY_FIELD_ALIASES).map(([field, aliases]) => {
  const LABELS: Record<string, string> = {
    name_col: 'Company Name', domain_col: 'Website / Domain', email_col: 'Email',
    phone1_col: 'Phone 1', phone2_col: 'Phone 2', country_col: 'Country', city_col: 'City (İl)',
    district_col: 'District (İlçe)', address_col: 'Address', postal_code_col: 'Postal Code',
    segment_col: 'Segment (SMB/MID/ENT)', status_col: 'Status', lifecycle_stage_col: 'Lifecycle Stage',
    industry_col: 'Industry / Sector', employee_count_col: 'Employee Count', annual_revenue_col: 'Annual Revenue',
    external_id_col: 'External ID / ERP Code', hubspot_id_col: 'HubSpot ID',
    chamber_of_commerce_col: 'Chamber of Commerce', nace_description_col: 'NACE Description',
    nace_code_col: 'NACE Code', isic_description_col: 'ISIC Description', isic_code_col: 'ISIC Code',
    net_sales_col: 'Net Sales (TL)', production_sales_net_col: 'Production Sales Net (TL)',
    gross_value_added_col: 'Gross Value Added (TL)', equity_col: 'Equity / Özkaynaklar (TL)',
    total_assets_col: 'Total Assets / Aktif (TL)', pre_tax_profit_col: 'Pre-tax Profit (TL)',
    ebitda_col: 'EBITDA / FAVÖK (TL)', exports_usd_col: 'Exports (Thousand $)',
    capital_share_public_col: 'Capital Public %', capital_share_private_col: 'Capital Private %',
    capital_share_foreign_col: 'Capital Foreign %', capital_share_float_col: 'Capital Float %',
    iso500_rank_col: 'ISO 500 Rank', iso500_rank_prev_year_col: 'ISO 500 Prev Year Rank',
    data_year_col: 'Data Year', strategic_notes_col: 'Strategic Notes',
  }
  return { field, label: LABELS[field] ?? field, required: field === 'name_col', aliases }
})

class MappingService {
  analyzeBuffer(buffer: Buffer, _filename: string, entity: 'invoices' | 'companies' = 'invoices'): AnalyzeResult {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    if (rows.length === 0) return { columns: [], suggestions: [], entity }

    const headers = Object.keys(rows[0])
    const sampleRows = rows.slice(0, 5)

    const columns: ColumnInfo[] = headers.map((h) => {
      const rawSamples = sampleRows.map((r) => r[h])
      const textSamples = rawSamples
        .filter((v) => v !== null && v !== undefined && v !== '')
        .slice(0, 3)
        .map((v) => v instanceof Date ? v.toISOString().split('T')[0] : String(v).trim())
      return { name: h, sample_values: textSamples, detected_type: detectType(rawSamples) }
    })

    const targetFields = entity === 'companies' ? COMPANY_TARGET_FIELDS : TARGET_FIELDS

    const suggestions: FieldSuggestion[] = targetFields.map((tf) => {
      let bestCol: string | null = null
      let bestScore = 0

      for (const col of headers) {
        const score = scoreColumn(col, tf.aliases)
        if (score > bestScore) { bestScore = score; bestCol = col }
      }

      if (bestCol && bestScore > 0) {
        const info = columns.find((c) => c.name === bestCol)
        if (info) {
          const isDateField = tf.field === 'issue_date_col' || tf.field === 'service_start_col' || tf.field === 'service_end_col'
          if (isDateField && info.detected_type === 'date') bestScore = Math.min(100, bestScore + 5)
          if ((tf.field === 'amount_col' || tf.field.includes('sales') || tf.field.includes('equity') || tf.field.includes('assets') || tf.field.includes('ebitda') || tf.field.includes('profit') || tf.field.includes('exports') || tf.field.includes('capital') || tf.field.includes('count') || tf.field.includes('revenue') || tf.field.includes('rank') || tf.field.includes('year')) && info.detected_type === 'number')
            bestScore = Math.min(100, bestScore + 5)
        }
      }

      return { field: tf.field, label: tf.label, required: tf.required, suggested_column: bestScore >= 30 ? bestCol : null, confidence: bestScore }
    })

    return { columns, suggestions, entity }
  }

  async getTemplates(tenantId: string): Promise<MappingTemplate[]> {
    const { data, error } = await supabase
      .from('mapping_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  }

  async saveTemplate(
    tenantId: string,
    name: string,
    sourceSystem: string | null,
    columnMap: Partial<Record<keyof ImportMapping, string>>
  ): Promise<MappingTemplate> {
    const { data, error } = await supabase
      .from('mapping_templates')
      .insert({ tenant_id: tenantId, name, source_system: sourceSystem, column_map: columnMap })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async deleteTemplate(tenantId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('mapping_templates')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) throw error
  }
}

export const mappingService = new MappingService()
