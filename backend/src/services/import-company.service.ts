import * as XLSX from 'xlsx'
import { supabase } from '../config/supabase'
import logger from '../logger'

// ─── Mapping interface — one field per source column ────────────────────────

export interface CompanyImportMapping {
  name_col: string
  domain_col?: string
  email_col?: string
  phone1_col?: string
  phone2_col?: string
  country_col?: string
  city_col?: string
  district_col?: string
  address_col?: string
  postal_code_col?: string
  segment_col?: string
  status_col?: string
  lifecycle_stage_col?: string
  industry_col?: string
  employee_count_col?: string
  annual_revenue_col?: string
  external_id_col?: string
  hubspot_id_col?: string
  chamber_of_commerce_col?: string
  nace_description_col?: string
  nace_code_col?: string
  isic_description_col?: string
  isic_code_col?: string
  net_sales_col?: string
  production_sales_net_col?: string
  gross_value_added_col?: string
  equity_col?: string
  total_assets_col?: string
  pre_tax_profit_col?: string
  ebitda_col?: string
  exports_usd_col?: string
  capital_share_public_col?: string
  capital_share_private_col?: string
  capital_share_foreign_col?: string
  capital_share_float_col?: string
  iso500_rank_col?: string
  iso500_rank_prev_year_col?: string
  data_year_col?: string
  strategic_notes_col?: string
}

export interface CompanyImportResult {
  file_id: string
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

export interface CompanyImportPreview {
  total_rows: number
  will_create: number
  will_update: number
  sample_rows: Array<Record<string, unknown>>
  detected_columns: Record<string, string>
  parse_errors: Array<{ row: number; message: string }>
}

// ─── Field aliases for auto-detection ───────────────────────────────────────

export const COMPANY_FIELD_ALIASES: Record<keyof CompanyImportMapping, string[]> = {
  name_col:                 ['name', 'company', 'company name', 'kuruluş adı', 'firma adı', 'şirket adı', 'firma', 'şirket', 'kuruluş', 'müşteri adı', 'ad'],
  domain_col:               ['domain', 'website', 'web', 'url', 'web adresi', 'site', 'web sitesi'],
  email_col:                ['email', 'e-posta', 'eposta', 'mail', 'e-mail', 'posta'],
  phone1_col:               ['phone', 'phone1', 'tel', 'telefon', 'telefon 1', 'phone 1', 'gsm', 'telefon1'],
  phone2_col:               ['phone2', 'telefon 2', 'phone 2', 'tel2', 'fax', 'faks', 'telefon2'],
  country_col:              ['country', 'ülke', 'ulke'],
  city_col:                 ['city', 'il', 'şehir', 'sehir', 'province', 'il adı'],
  district_col:             ['district', 'ilçe', 'ilce', 'county', 'semt'],
  address_col:              ['address', 'adres', 'street', 'sokak', 'adres bilgisi'],
  postal_code_col:          ['postal', 'postal code', 'zip', 'zip code', 'posta kodu', 'postalcode'],
  segment_col:              ['segment', 'tier', 'büyüklük', 'customer type', 'müşteri segmenti'],
  status_col:               ['status', 'durum', 'customer status', 'aktif'],
  lifecycle_stage_col:      ['lifecycle', 'stage', 'aşama', 'asama', 'lifecycle stage', 'müşteri tipi', 'müşteri durumu', 'kategori'],
  industry_col:             ['industry', 'sektör', 'sektor', 'sector', 'faaliyet', 'alan', 'faaliyet alanı'],
  employee_count_col:       ['employees', 'employee count', 'çalışan', 'calisan', 'headcount', 'staff', 'ücretle çalışanlar', 'personel'],
  annual_revenue_col:       ['annual revenue', 'revenue', 'ciro', 'yıllık ciro', 'yillik ciro', 'yıllık gelir'],
  external_id_col:          ['external id', 'kod', 'code', 'customer code', 'müşteri kodu', 'erp id', 'logo id', 'ext id'],
  hubspot_id_col:           ['hubspot id', 'hubspot', 'crm id', 'hs id'],
  chamber_of_commerce_col:  ['chamber', 'oda', 'bağlı oda', 'bagli oda', 'bağlı olduğu oda'],
  nace_description_col:     ['nace', 'nace description', 'nace tanımı', 'nace tanimi', 'nace açıklaması'],
  nace_code_col:            ['nace code', 'nace kodu', 'nace kod'],
  isic_description_col:     ['isic', 'isic description', 'isic tanımı', 'isic sektör tanımı', 'isic sektor'],
  isic_code_col:            ['isic code', 'isic kodu', 'isic kod'],
  net_sales_col:            ['net sales', 'net satışlar', 'net satislar', 'net satış', 'net satis'],
  production_sales_net_col: ['production sales', 'üretimden satışlar', 'uretimden satislar', 'üretimden satış'],
  gross_value_added_col:    ['gross value added', 'brüt katma değer', 'brut katma deger', 'katma değer'],
  equity_col:               ['equity', 'özkaynaklar', 'ozkaynak', 'özkaynak', 'öz sermaye'],
  total_assets_col:         ['total assets', 'aktif toplamı', 'aktif toplami', 'aktif', 'assets', 'toplam aktif'],
  pre_tax_profit_col:       ['pre tax profit', 'vergi öncesi kar', 'dönem karı', 'donem kari', 'kar zarar', 'dönem kar/zarar'],
  ebitda_col:               ['ebitda', 'favök', 'favok', 'ebit'],
  exports_usd_col:          ['exports', 'ihracat', 'export', 'ihracat (bin $)', 'export value'],
  capital_share_public_col: ['public capital', 'kamu payı', 'kamu payi', 'kamu', 'sermaye payı / kamu'],
  capital_share_private_col:['private capital', 'özel sermaye', 'ozel', 'özel payı', 'sermaye payı / özel'],
  capital_share_foreign_col:['foreign capital', 'yabancı', 'yabanci', 'yabancı payı', 'sermaye payı / yabancı'],
  capital_share_float_col:  ['float', 'halka açık', 'halka acik', 'public float', 'sermaye payı / halka açık'],
  iso500_rank_col:          ['iso500 rank', 'rank', 'sıra no', 'sira no', 'genel sıra no', 'iso 500', 'sıralama'],
  iso500_rank_prev_year_col:['prev rank', 'previous rank', 'önceki yıl sıra', 'onceki yil', 'genel sıra no (önceki yıl)'],
  data_year_col:            ['year', 'yıl', 'yil', 'data year', 'veri yılı', 'yıl'],
  strategic_notes_col:      ['notes', 'notlar', 'strategic notes', 'not', 'açıklama', 'aciklama'],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCol(row: Record<string, unknown>, colName: string | undefined): unknown {
  if (!colName) return ''
  if (colName in row) return row[colName]
  const lower = colName.toLowerCase()
  const key = Object.keys(row).find((k) => k.toLowerCase() === lower)
  return key ? row[key] : ''
}

function parseStr(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  return String(v).trim() || null
}

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return isFinite(v) ? v : null
  const s = String(v).replace(/\s/g, '')
  // Turkish: 1.234.567,89
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  }
  const n = parseFloat(s.replace(/,/g, ''))
  return isNaN(n) ? null : n
}

function parseSegment(v: unknown): 'SMB' | 'MID' | 'ENT' | null {
  const s = String(v ?? '').trim().toUpperCase()
  if (['SMB', 'MID', 'ENT'].includes(s)) return s as 'SMB' | 'MID' | 'ENT'
  return null
}

function parseStatus(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase()
  const valid = ['active', 'churned', 'at-risk', 'prospect']
  if (valid.includes(s)) return s
  const map: Record<string, string> = { aktif: 'active', kaybedildi: 'churned', 'risk': 'at-risk', potansiyel: 'prospect' }
  return map[s] ?? null
}

function parseLifecycle(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase().replace(/[\s-]/g, '_')
  const valid = ['target', 'prospect', 'qualified', 'hot_lead', 'proposal', 'customer', 'at_risk', 'churned']
  if (valid.includes(s)) return s
  const tr: Record<string, string> = {
    hedef: 'target', potansiyel: 'prospect', nitelikli: 'qualified',
    sicak: 'hot_lead', hot: 'hot_lead', teklif: 'proposal',
    musteri: 'customer', mevcut: 'customer', risk: 'at_risk', kaybedildi: 'churned',
  }
  return tr[s] ?? null
}

// ─── Column resolution ───────────────────────────────────────────────────────

export function resolveCompanyMapping(
  headers: string[],
  provided?: Partial<CompanyImportMapping>
): CompanyImportMapping & { _detected: Record<string, string> } {
  const normalized = headers.map((h) => ({ original: h, lower: h.trim().toLowerCase() }))
  const detected: Record<string, string> = {}

  const findCol = (aliases: string[]): string | undefined => {
    for (const alias of aliases) {
      const found = normalized.find((h) => h.lower === alias.toLowerCase())
      if (found) return found.original
    }
    for (const alias of aliases) {
      const al = alias.toLowerCase()
      const found = normalized.find((h) => h.lower.includes(al) || al.includes(h.lower))
      if (found) return found.original
    }
    return undefined
  }

  const resolve = (field: keyof CompanyImportMapping, pv?: string): string | undefined => {
    if (pv) return pv
    const col = findCol(COMPANY_FIELD_ALIASES[field])
    if (col) detected[field] = col
    return col
  }

  const m: CompanyImportMapping & { _detected: Record<string, string> } = {
    name_col: resolve('name_col', provided?.name_col) ?? '',
    _detected: detected,
  }

  const optionalFields = Object.keys(COMPANY_FIELD_ALIASES).filter((f) => f !== 'name_col') as (keyof CompanyImportMapping)[]
  for (const f of optionalFields) {
    const val = resolve(f, (provided as Record<string, string>)?.[f])
    if (val) (m as unknown as Record<string, string>)[f] = val
  }

  return m
}

// ─── Row → company record ────────────────────────────────────────────────────

function rowToCompanyData(row: Record<string, unknown>, m: CompanyImportMapping): Record<string, unknown> {
  const d: Record<string, unknown> = {}

  d.name             = parseStr(getCol(row, m.name_col))
  d.domain           = parseStr(getCol(row, m.domain_col))
  d.email            = parseStr(getCol(row, m.email_col))
  d.phone1           = parseStr(getCol(row, m.phone1_col))
  d.phone2           = parseStr(getCol(row, m.phone2_col))
  d.country          = parseStr(getCol(row, m.country_col))
  d.city             = parseStr(getCol(row, m.city_col))
  d.district         = parseStr(getCol(row, m.district_col))
  d.address          = parseStr(getCol(row, m.address_col))
  d.postal_code      = parseStr(getCol(row, m.postal_code_col))
  d.segment          = parseSegment(getCol(row, m.segment_col))
  d.status           = parseStatus(getCol(row, m.status_col)) ?? 'active'
  d.lifecycle_stage  = parseLifecycle(getCol(row, m.lifecycle_stage_col))
  d.industry         = parseStr(getCol(row, m.industry_col))
  d.employee_count   = parseNum(getCol(row, m.employee_count_col))
  d.annual_revenue   = parseNum(getCol(row, m.annual_revenue_col))
  d.external_id      = parseStr(getCol(row, m.external_id_col))
  d.hubspot_id       = parseStr(getCol(row, m.hubspot_id_col))
  d.chamber_of_commerce = parseStr(getCol(row, m.chamber_of_commerce_col))
  d.nace_description = parseStr(getCol(row, m.nace_description_col))
  d.nace_code        = parseStr(getCol(row, m.nace_code_col))
  d.isic_description = parseStr(getCol(row, m.isic_description_col))
  d.isic_code        = parseStr(getCol(row, m.isic_code_col))
  d.net_sales              = parseNum(getCol(row, m.net_sales_col))
  d.production_sales_net   = parseNum(getCol(row, m.production_sales_net_col))
  d.gross_value_added      = parseNum(getCol(row, m.gross_value_added_col))
  d.equity                 = parseNum(getCol(row, m.equity_col))
  d.total_assets           = parseNum(getCol(row, m.total_assets_col))
  d.pre_tax_profit         = parseNum(getCol(row, m.pre_tax_profit_col))
  d.ebitda                 = parseNum(getCol(row, m.ebitda_col))
  d.exports_usd            = parseNum(getCol(row, m.exports_usd_col))
  d.capital_share_public   = parseNum(getCol(row, m.capital_share_public_col))
  d.capital_share_private  = parseNum(getCol(row, m.capital_share_private_col))
  d.capital_share_foreign  = parseNum(getCol(row, m.capital_share_foreign_col))
  d.capital_share_float    = parseNum(getCol(row, m.capital_share_float_col))
  d.iso500_rank            = parseNum(getCol(row, m.iso500_rank_col)) != null ? Math.round(parseNum(getCol(row, m.iso500_rank_col))!) : null
  d.iso500_rank_prev_year  = parseNum(getCol(row, m.iso500_rank_prev_year_col)) != null ? Math.round(parseNum(getCol(row, m.iso500_rank_prev_year_col))!) : null
  d.data_year              = parseNum(getCol(row, m.data_year_col)) != null ? Math.round(parseNum(getCol(row, m.data_year_col))!) : null
  d.strategic_notes        = parseStr(getCol(row, m.strategic_notes_col))

  // Strip null values to avoid unnecessary DB overwrites
  return Object.fromEntries(Object.entries(d).filter(([, v]) => v !== null && v !== undefined))
}

// ─── Parse rows from buffer (Excel / CSV / JSON) ────────────────────────────

function parseRows(buffer: Buffer, filename: string): Record<string, unknown>[] {
  const ext = filename.split('.').pop()?.toLowerCase()

  if (ext === 'json') {
    const parsed = JSON.parse(buffer.toString('utf8'))
    return Array.isArray(parsed) ? parsed : []
  }

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
}

// ─── Service ─────────────────────────────────────────────────────────────────

class ImportCompanyService {
  /** Preview: detect mappings + count creates vs updates without writing */
  async preview(
    tenantId: string,
    buffer: Buffer,
    filename: string,
    providedMapping?: Partial<CompanyImportMapping>
  ): Promise<CompanyImportPreview> {
    const rows = parseRows(buffer, filename)
    if (rows.length === 0) return { total_rows: 0, will_create: 0, will_update: 0, sample_rows: [], detected_columns: {}, parse_errors: [] }

    const headers = Object.keys(rows[0])
    const mapping = resolveCompanyMapping(headers, providedMapping)
    const errors: Array<{ row: number; message: string }> = []

    const names: string[] = []
    for (let i = 0; i < rows.length; i++) {
      const name = parseStr(getCol(rows[i], mapping.name_col))
      if (!name) { errors.push({ row: i + 2, message: `Row ${i + 2}: Company name is empty` }); continue }
      names.push(name.toLowerCase())
    }

    const { data: existing } = await supabase
      .from('companies')
      .select('name')
      .eq('tenant_id', tenantId)
      .in('name', names.map((n) => n))

    const existingNames = new Set((existing || []).map((c) => c.name.toLowerCase()))
    let willCreate = 0; let willUpdate = 0
    for (const n of names) {
      if (existingNames.has(n)) willUpdate++
      else willCreate++
    }

    return {
      total_rows: rows.length,
      will_create: willCreate,
      will_update: willUpdate,
      sample_rows: rows.slice(0, 5),
      detected_columns: mapping._detected,
      parse_errors: errors,
    }
  }

  /** Import: upsert companies and return result */
  async importFile(
    tenantId: string,
    buffer: Buffer,
    filename: string,
    source: 'excel' | 'csv' | 'json',
    providedMapping?: Partial<CompanyImportMapping>,
    conflictMode: 'skip' | 'overwrite' = 'skip'
  ): Promise<CompanyImportResult> {
    const rows = parseRows(buffer, filename)
    if (rows.length === 0) {
      return { file_id: '', created: 0, updated: 0, skipped: 0, errors: [{ row: 0, message: 'File is empty' }] }
    }

    const headers = Object.keys(rows[0])
    const mapping = resolveCompanyMapping(headers, providedMapping)
    const errors: Array<{ row: number; message: string }> = []

    // Log import file record
    const { data: fileRecord } = await supabase
      .from('import_files')
      .insert({ tenant_id: tenantId, source, filename, status: 'processing', records_imported: 0, record_count: rows.length })
      .select('id')
      .single()
    const fileId = fileRecord?.id ?? ''

    // Build batch of valid records
    const validRows: Array<{ rowNum: number; name: string; data: Record<string, unknown> }> = []
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2
      const data = rowToCompanyData(rows[i], mapping)
      const name = data.name as string | undefined
      if (!name) { errors.push({ row: rowNum, message: `Row ${rowNum}: Company name is empty` }); continue }
      validRows.push({ rowNum, name, data })
    }

    // Batch-fetch existing companies by name (case-insensitive)
    const names = validRows.map((r) => r.name.toLowerCase())
    const { data: existing } = await supabase
      .from('companies')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .in('name', names)

    const existingMap = new Map<string, string>((existing || []).map((c) => [c.name.toLowerCase(), c.id]))

    let created = 0; let updated = 0; let skipped = 0

    // Process in chunks of 200
    const CHUNK = 200
    for (let i = 0; i < validRows.length; i += CHUNK) {
      const chunk = validRows.slice(i, i + CHUNK)
      const toCreate: Array<Record<string, unknown>> = []
      const toUpdate: Array<{ id: string; data: Record<string, unknown> }> = []

      for (const row of chunk) {
        const existingId = existingMap.get(row.name.toLowerCase())
        if (existingId) {
          if (conflictMode === 'overwrite') {
            toUpdate.push({ id: existingId, data: { ...row.data, updated_at: new Date().toISOString() } })
          } else {
            skipped++
          }
        } else {
          toCreate.push({ ...row.data, tenant_id: tenantId, source: 'import', status: (row.data.status as string) || 'active' })
        }
      }

      if (toCreate.length > 0) {
        const { error } = await supabase.from('companies').insert(toCreate)
        if (error) {
          logger.error('Company import batch insert error', error)
          errors.push({ row: i + 2, message: `Batch insert error: ${error.message}` })
        } else {
          created += toCreate.length
        }
      }

      for (const upd of toUpdate) {
        const { error } = await supabase.from('companies').update(upd.data).eq('id', upd.id).eq('tenant_id', tenantId)
        if (error) {
          errors.push({ row: 0, message: `Update error for company: ${error.message}` })
        } else {
          updated++
        }
      }
    }

    // Update import file record
    await supabase
      .from('import_files')
      .update({ status: errors.length > 0 ? 'error' : 'done', records_imported: created + updated, errors_json: errors })
      .eq('id', fileId)

    logger.info(`Company import complete: created=${created} updated=${updated} skipped=${skipped} errors=${errors.length}`)
    return { file_id: fileId, created, updated, skipped, errors }
  }
}

export const importCompanyService = new ImportCompanyService()
