import { supabase } from '../config/supabase'
import * as XLSX from 'xlsx'

export interface FinancialInput {
  id: string
  tenant_id: string
  month: string
  total_revenue_override: number | null
  cogs: number | null
  opex: number | null
  sales_marketing_spend: number | null
  headcount: number | null
  profit_margin_override: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

class FinancialInputsService {
  async getRange(tenantId: string, from?: string, to?: string): Promise<FinancialInput[]> {
    let query = supabase
      .from('financial_inputs_monthly')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('month', { ascending: false })

    if (from) query = query.gte('month', from)
    if (to) query = query.lte('month', to)

    const { data } = await query
    return (data || []) as FinancialInput[]
  }

  async getForMonth(tenantId: string, month: string): Promise<FinancialInput | null> {
    const { data } = await supabase
      .from('financial_inputs_monthly')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('month', month)
      .single()

    return (data as FinancialInput) || null
  }

  async upsert(tenantId: string, month: string, input: Partial<FinancialInput>): Promise<FinancialInput> {
    const row = {
      tenant_id: tenantId,
      month,
      total_revenue_override: input.total_revenue_override ?? null,
      cogs: input.cogs ?? null,
      opex: input.opex ?? null,
      sales_marketing_spend: input.sales_marketing_spend ?? null,
      headcount: input.headcount ?? null,
      profit_margin_override: input.profit_margin_override ?? null,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('financial_inputs_monthly')
      .upsert(row, { onConflict: 'tenant_id,month' })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as FinancialInput
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await supabase
      .from('financial_inputs_monthly')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
  }

  // ─── Excel template (empty, last 10 years of months) ─────────────────────

  generateTemplate(): Buffer {
    const months = this.generateMonthRange(120) // 10 years = 120 months
    const rows = months.map((m) => ({
      Month: m,
      COGS: '',
      OpEx: '',
      'S&M Spend': '',
      Headcount: '',
      'Profit Margin %': '',
      'Revenue Override': '',
      Notes: '',
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)

    // Column widths
    ws['!cols'] = [
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 30 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Financial Inputs')

    // Instructions sheet
    const instructions = [
      ['RevenueOS — Financial Inputs Import Template'],
      [''],
      ['Fill in the "Financial Inputs" sheet. Leave cells blank to skip a month.'],
      [''],
      ['Column', 'Description', 'Unit'],
      ['Month', 'Month in YYYY-MM-01 format', 'Required'],
      ['COGS', 'Cost of Goods Sold', 'Currency (reporting currency)'],
      ['OpEx', 'Operating Expenses', 'Currency'],
      ['S&M Spend', 'Sales & Marketing Spend (for CAC / Magic Number)', 'Currency'],
      ['Headcount', 'Total employee count at end of month', 'Integer'],
      ['Profit Margin %', 'Profit margin if you want to override computation (e.g. 22.5)', 'Percent'],
      ['Revenue Override', 'Override computed MRR (rarely needed)', 'Currency'],
      ['Notes', 'Free-form notes', 'Text'],
    ]
    const wsInstr = XLSX.utils.aoa_to_sheet(instructions)
    wsInstr['!cols'] = [{ wch: 22 }, { wch: 50 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions')

    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
  }

  // ─── Export existing data as Excel ────────────────────────────────────────

  async exportToExcel(tenantId: string): Promise<Buffer> {
    const data = await this.getRange(tenantId)
    const rows = data.map((r) => ({
      Month: r.month,
      COGS: r.cogs ?? '',
      OpEx: r.opex ?? '',
      'S&M Spend': r.sales_marketing_spend ?? '',
      Headcount: r.headcount ?? '',
      'Profit Margin %': r.profit_margin_override ?? '',
      'Revenue Override': r.total_revenue_override ?? '',
      Notes: r.notes ?? '',
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [
      { Month: '', COGS: '', OpEx: '', 'S&M Spend': '', Headcount: '', 'Profit Margin %': '', 'Revenue Override': '', Notes: '' }
    ])
    ws['!cols'] = [
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 30 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Financial Inputs')
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
  }

  // ─── Import from Excel buffer ─────────────────────────────────────────────

  async importFromExcel(
    tenantId: string,
    buffer: Buffer
  ): Promise<{ imported: number; skipped: number; errors: Array<{ row: number; message: string }> }> {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets['Financial Inputs'] || wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

    let imported = 0
    let skipped = 0
    const errors: Array<{ row: number; message: string }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // 1-indexed + header
      const rawMonth = String(row['Month'] || '').trim()

      if (!rawMonth) { skipped++; continue }

      // Normalize month: accept YYYY-MM or YYYY-MM-01 or YYYY-MM-DD
      let month = rawMonth
      if (/^\d{4}-\d{2}$/.test(month)) month = month + '-01'
      if (!/^\d{4}-\d{2}-01$/.test(month)) {
        errors.push({ row: rowNum, message: `Invalid month format: "${rawMonth}" — expected YYYY-MM-01` })
        continue
      }

      const parseNum = (val: unknown): number | null => {
        if (val === '' || val === null || val === undefined) return null
        const n = Number(val)
        return isNaN(n) ? null : n
      }
      const parseInt2 = (val: unknown): number | null => {
        if (val === '' || val === null || val === undefined) return null
        const n = parseInt(String(val), 10)
        return isNaN(n) ? null : n
      }

      const input: Partial<FinancialInput> = {
        cogs: parseNum(row['COGS']),
        opex: parseNum(row['OpEx']),
        sales_marketing_spend: parseNum(row['S&M Spend']),
        headcount: parseInt2(row['Headcount']),
        profit_margin_override: parseNum(row['Profit Margin %']),
        total_revenue_override: parseNum(row['Revenue Override']),
        notes: row['Notes'] ? String(row['Notes']).trim() || null : null,
      }

      // Skip rows with no data
      const hasData = Object.values(input).some((v) => v !== null && v !== undefined)
      if (!hasData) { skipped++; continue }

      try {
        await this.upsert(tenantId, month, input)
        imported++
      } catch (err: any) {
        errors.push({ row: rowNum, message: err.message || 'Unknown error' })
      }
    }

    return { imported, skipped, errors }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private generateMonthRange(count: number): string[] {
    const months: string[] = []
    const now = new Date()
    // Start from 'count' months ago
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(
        d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'
      )
    }
    return months
  }
}

export const financialInputsService = new FinancialInputsService()
