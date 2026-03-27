'use client'

import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Trash2, DollarSign, AlertCircle, Info, Download, Upload, FileSpreadsheet, CheckCircle, X } from 'lucide-react'
import { api, FinancialInput } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'

// How many months to show in the inline table
const MONTHS_TO_SHOW = 24  // 2 years default; import covers 10 years

function generateMonths(count = MONTHS_TO_SHOW): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }
  return months
}

function formatMonthLabel(m: string): string {
  const d = new Date(m + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

type EditMap = Record<string, Partial<FinancialInput> & { dirty?: boolean }>

interface ImportResult {
  imported: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

export default function FinancialInputsPage() {
  const qc = useQueryClient()
  const months = generateMonths()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['financial-inputs'],
    queryFn: () => api.getFinancialInputs(),
    staleTime: 60_000,
  })

  const [edits, setEdits] = useState<EditMap>({})
  const [saving, setSaving] = useState<string | null>(null)

  const inputs = data?.data || []
  const inputsByMonth = Object.fromEntries(inputs.map((i) => [i.month, i]))

  const upsertMutation = useMutation({
    mutationFn: ({ month, values }: { month: string; values: Partial<FinancialInput> }) =>
      api.upsertFinancialInput(month, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-inputs'] })
      qc.invalidateQueries({ queryKey: ['advanced-metrics'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteFinancialInput(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-inputs'] })
      qc.invalidateQueries({ queryKey: ['advanced-metrics'] })
    },
  })

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    setImportResult(null)
    setImportError(null)
    try {
      const res = await api.importFinancialInputs(file)
      setImportResult(res.data)
      qc.invalidateQueries({ queryKey: ['financial-inputs'] })
      qc.invalidateQueries({ queryKey: ['advanced-metrics'] })
    } catch (err: any) {
      setImportError(err.message || 'Import failed')
    } finally {
      setIsImporting(false)
      // Reset file input so same file can be re-imported
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function getVal(month: string, field: keyof FinancialInput): string {
    if (edits[month] && field in edits[month]) {
      const v = edits[month][field as keyof Partial<FinancialInput>]
      return v === null || v === undefined ? '' : String(v)
    }
    const existing = inputsByMonth[month]
    if (existing && existing[field] !== null && existing[field] !== undefined) {
      return String(existing[field])
    }
    return ''
  }

  function setVal(month: string, field: keyof FinancialInput, raw: string) {
    setEdits((prev) => ({
      ...prev,
      [month]: {
        ...prev[month],
        [field]: raw === '' ? null : field === 'headcount' ? parseInt(raw, 10) : parseFloat(raw),
        dirty: true,
      },
    }))
  }

  async function handleSave(month: string) {
    const edit = edits[month]
    if (!edit?.dirty) return
    setSaving(month)
    const { dirty, ...values } = edit
    await upsertMutation.mutateAsync({ month, values })
    setEdits((prev) => {
      const next = { ...prev }
      delete next[month]
      return next
    })
    setSaving(null)
  }

  async function handleDelete(month: string) {
    const existing = inputsByMonth[month]
    if (!existing) return
    await deleteMutation.mutateAsync(existing.id)
    setEdits((prev) => {
      const next = { ...prev }
      delete next[month]
      return next
    })
  }

  const FIELDS: Array<{ key: keyof FinancialInput; label: string; placeholder: string; prefix?: string }> = [
    { key: 'cogs', label: 'COGS', placeholder: '0', prefix: '$' },
    { key: 'opex', label: 'OpEx', placeholder: '0', prefix: '$' },
    { key: 'sales_marketing_spend', label: 'S&M Spend', placeholder: '0', prefix: '$' },
    { key: 'headcount', label: 'Headcount', placeholder: '0' },
    { key: 'profit_margin_override', label: 'Profit Margin %', placeholder: '0' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-mrr-green" />
            Financial Inputs
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Monthly cost data required to compute CAC, LTV, Burn Multiple, Rule of 40 and other advanced metrics.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={() => api.downloadFinancialInputsTemplate()}
            className="flex items-center gap-1.5 text-sm border border-border bg-surface px-3 py-1.5 rounded hover:border-text-secondary hover:text-text-primary text-text-secondary transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Template
          </button>
          <button
            onClick={() => api.exportFinancialInputs()}
            className="flex items-center gap-1.5 text-sm border border-border bg-surface px-3 py-1.5 rounded hover:border-text-secondary hover:text-text-primary text-text-secondary transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-1.5 text-sm bg-mrr-green text-black font-medium px-3 py-1.5 rounded hover:bg-emerald-400 transition-colors disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {isImporting ? 'Importing…' : 'Import Excel'}
          </button>
        </div>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className={`flex items-start gap-3 p-4 rounded border ${
          importResult.errors.length === 0
            ? 'bg-emerald-900 border-emerald-700'
            : 'bg-yellow-950 border-yellow-800'
        }`}>
          {importResult.errors.length === 0
            ? <CheckCircle className="w-4 h-4 text-mrr-green flex-shrink-0 mt-0.5" />
            : <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          }
          <div className="flex-1 text-sm">
            <p className={importResult.errors.length === 0 ? 'text-mrr-green font-medium' : 'text-yellow-300 font-medium'}>
              Import complete — {importResult.imported} rows imported, {importResult.skipped} skipped
            </p>
            {importResult.errors.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {importResult.errors.map((e, i) => (
                  <li key={i} className="text-yellow-400 text-xs">Row {e.row}: {e.message}</li>
                ))}
              </ul>
            )}
          </div>
          <button onClick={() => setImportResult(null)} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {importError && (
        <div className="flex items-center gap-3 p-4 rounded border bg-red-950 border-red-800">
          <AlertCircle className="w-4 h-4 text-churn-red flex-shrink-0" />
          <p className="text-sm text-red-400 flex-1">{importError}</p>
          <button onClick={() => setImportError(null)} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-950 border border-blue-900 rounded p-4">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-300">
          <strong>How this works:</strong> Enter your monthly COGS, OpEx, S&amp;M Spend, and headcount.
          The Advanced Metrics engine uses these values together with your MRR/ARR data to compute CAC, LTV/CAC, Burn Multiple, Rule of 40, Magic Number and Revenue/Employee.
          You only need to fill in months you want modeled — empty months are excluded.
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 bg-surface rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="card p-0 overflow-auto">
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-border">
              <tr>
                <th className="table-header w-28">Month</th>
                {FIELDS.map((f) => (
                  <th key={f.key} className="table-header text-right">{f.label}</th>
                ))}
                <th className="table-header text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => {
                const existing = inputsByMonth[month]
                const isDirty = !!edits[month]?.dirty
                const isSavingRow = saving === month

                return (
                  <tr key={month} className={`border-b border-border transition-colors ${isDirty ? 'bg-blue-950/30' : 'hover:bg-surface'}`}>
                    <td className="table-cell">
                      <span className="text-sm font-medium text-text-primary">{formatMonthLabel(month)}</span>
                      {existing && !isDirty && (
                        <span className="ml-2 text-xs text-mrr-green">•</span>
                      )}
                    </td>
                    {FIELDS.map((f) => (
                      <td key={f.key} className="table-cell">
                        <div className="flex items-center justify-end gap-1">
                          {f.prefix && <span className="text-text-muted text-xs">{f.prefix}</span>}
                          <input
                            type="number"
                            min="0"
                            step={f.key === 'headcount' ? '1' : '0.01'}
                            value={getVal(month, f.key)}
                            placeholder={f.placeholder}
                            onChange={(e) => setVal(month, f.key, e.target.value)}
                            className="w-28 text-right bg-transparent border-0 border-b border-border focus:border-mrr-green focus:outline-none text-sm text-text-primary placeholder-text-muted py-0.5 transition-colors"
                          />
                        </div>
                      </td>
                    ))}
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-2">
                        {isDirty && (
                          <button
                            onClick={() => handleSave(month)}
                            disabled={isSavingRow}
                            className="flex items-center gap-1 text-xs text-mrr-green hover:text-emerald-300 transition-colors disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {isSavingRow ? 'Saving…' : 'Save'}
                          </button>
                        )}
                        {existing && !isDirty && (
                          <button
                            onClick={() => handleDelete(month)}
                            className="flex items-center gap-1 text-xs text-text-muted hover:text-churn-red transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!existing && !isDirty && (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary of filled months */}
      {inputs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="label text-xs mb-1">Months with Data</p>
            <p className="text-2xl font-bold text-text-primary">{inputs.length}</p>
          </div>
          <div className="card">
            <p className="label text-xs mb-1">Avg Monthly COGS</p>
            <p className="text-2xl font-bold text-text-primary">
              {formatCurrency(
                inputs.filter((i) => i.cogs).reduce((s, i) => s + Number(i.cogs), 0) /
                  (inputs.filter((i) => i.cogs).length || 1),
                'USD', true
              )}
            </p>
          </div>
          <div className="card">
            <p className="label text-xs mb-1">Avg S&M Spend</p>
            <p className="text-2xl font-bold text-text-primary">
              {formatCurrency(
                inputs.filter((i) => i.sales_marketing_spend).reduce((s, i) => s + Number(i.sales_marketing_spend), 0) /
                  (inputs.filter((i) => i.sales_marketing_spend).length || 1),
                'USD', true
              )}
            </p>
          </div>
          <div className="card">
            <p className="label text-xs mb-1">Latest Headcount</p>
            <p className="text-2xl font-bold text-text-primary">
              {inputs.sort((a, b) => b.month.localeCompare(a.month)).find((i) => i.headcount)?.headcount ?? '—'}
            </p>
          </div>
        </div>
      )}

      {inputs.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-10 h-10 text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No financial inputs yet</p>
          <p className="text-text-muted text-sm mt-1 max-w-sm">
            Enter at least one month of COGS, OpEx, and S&M Spend above to unlock the Advanced Metrics dashboard.
          </p>
        </div>
      )}
    </div>
  )
}
