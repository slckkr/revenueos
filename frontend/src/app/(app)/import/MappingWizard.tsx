'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Sparkles,
  BookMarked,
  Save,
  Trash2,
  ChevronDown,
} from 'lucide-react'
import {
  api,
  type AnalyzeResult,
  type FieldSuggestion,
  type ConflictPreview,
  type ImportResult,
  type MappingTemplate,
} from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { Badge } from '@/components/ui/Badge'
import clsx from 'clsx'

type Step = 'analyzing' | 'mapping' | 'preview' | 'importing' | 'done'

interface Props {
  file: File
  type: 'excel' | 'csv'
  onDone: (result: ImportResult) => void
  onCancel: () => void
}

const FIELD_LABELS: Record<string, string> = {
  company_name_col: 'Company Name',
  invoice_number_col: 'Invoice Number',
  issue_date_col: 'Issue Date',
  amount_col: 'Amount',
  currency_col: 'Currency',
  service_start_col: 'Service Start Date',
  service_end_col: 'Service End Date',
  product_col: 'Product / Service',
}

const REQUIRED_FIELDS = ['company_name_col', 'invoice_number_col', 'issue_date_col', 'amount_col']

function confidenceLabel(score: number): { text: string; color: string } {
  if (score >= 85) return { text: 'High', color: 'text-mrr-green' }
  if (score >= 55) return { text: 'Medium', color: 'text-warning' }
  if (score > 0) return { text: 'Low', color: 'text-churn-red' }
  return { text: 'Manual', color: 'text-text-muted' }
}

export function MappingWizard({ file, type, onDone, onCancel }: Props) {
  const [step, setStep] = useState<Step>('analyzing')
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  // field → column name (empty string = not mapped)
  const [mapping, setMapping] = useState<Record<string, string>>({})

  const [conflictData, setConflictData] = useState<ConflictPreview | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // Template UI
  const [showSave, setShowSave] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [sourceSystem, setSourceSystem] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const { data: templatesData, refetch: refetchTemplates } = useQuery({
    queryKey: ['mapping-templates'],
    queryFn: () => api.getMappingTemplates(),
  })
  const templates: MappingTemplate[] = (templatesData as any)?.data ?? []

  // Step 1: Analyze on mount
  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const res = await api.analyzeMapping(file)
        if (cancelled) return
        const result = res.data
        setAnalyzeResult(result)

        // Initialize mapping from suggestions
        const initial: Record<string, string> = {}
        for (const s of result.suggestions) {
          initial[s.field] = s.suggested_column ?? ''
        }
        setMapping(initial)
        setStep('mapping')
      } catch (err: any) {
        if (!cancelled) setAnalyzeError(err.message)
      }
    }
    run()
    return () => { cancelled = true }
  }, [file])

  const allColumns = analyzeResult?.columns.map((c) => c.name) ?? []

  const missingRequired = REQUIRED_FIELDS.filter((f) => !mapping[f])

  function getSamples(colName: string): string[] {
    if (!colName || !analyzeResult) return []
    return analyzeResult.columns.find((c) => c.name === colName)?.sample_values ?? []
  }

  function getOriginalSuggestion(field: string): FieldSuggestion | undefined {
    return analyzeResult?.suggestions.find((s) => s.field === field)
  }

  function getConfidenceForMapping(field: string): number {
    const orig = getOriginalSuggestion(field)
    if (!orig) return 0
    // If user kept the suggested column → show AI confidence
    if (mapping[field] === orig.suggested_column) return orig.confidence
    // If user picked a different column → mark as manual (0)
    return mapping[field] ? 0 : 0
  }

  // Step 2 → 3: run conflict preview
  async function handleConfirm() {
    setStep('preview')
    try {
      const cleanMapping: Record<string, string> = {}
      for (const [k, v] of Object.entries(mapping)) {
        if (v) cleanMapping[k] = v
      }
      const res = await api.previewImport(file, type, cleanMapping) as any
      const preview: ConflictPreview = res.data
      setConflictData(preview)
    } catch (err: any) {
      setImportError(err.message)
    }
  }

  // Step 3 → 4: run import
  async function handleImport(conflictMode: 'skip' | 'overwrite') {
    setStep('importing')
    try {
      const cleanMapping: Record<string, string> = {}
      for (const [k, v] of Object.entries(mapping)) {
        if (v) cleanMapping[k] = v
      }
      const fn = type === 'csv' ? api.importCsv : api.importExcel
      const res = await fn(file, conflictMode, cleanMapping) as any
      setImportResult(res.data)
      setStep('done')
      onDone(res.data)
    } catch (err: any) {
      setImportError(err.message)
      setStep('done')
    }
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return
    setSavingTemplate(true)
    try {
      const cleanMapping: Record<string, string> = {}
      for (const [k, v] of Object.entries(mapping)) {
        if (v) cleanMapping[k] = v
      }
      await api.saveMappingTemplate(templateName.trim(), sourceSystem.trim() || null, cleanMapping)
      setSavedMsg(`Saved "${templateName.trim()}"`)
      setTemplateName('')
      setSourceSystem('')
      setShowSave(false)
      refetchTemplates()
    } catch (err: any) {
      setSavedMsg(`Error: ${err.message}`)
    } finally {
      setSavingTemplate(false)
    }
  }

  function applyTemplate(t: MappingTemplate) {
    setMapping((prev) => ({ ...prev, ...t.column_map }))
  }

  async function deleteTemplate(id: string) {
    await api.deleteMappingTemplate(id)
    refetchTemplates()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (analyzeError) {
    return (
      <div className="bg-churn-red bg-opacity-10 border border-churn-red border-opacity-30 rounded-lg p-5 flex items-start gap-3">
        <XCircle className="w-5 h-5 text-churn-red flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-text-primary">Could not analyze file</p>
          <p className="text-sm text-text-secondary mt-1">{analyzeError}</p>
          <button className="btn-secondary text-sm mt-3" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    )
  }

  if (step === 'analyzing') {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Loader2 className="w-10 h-10 text-mrr-green animate-spin" />
        <p className="text-text-primary font-medium">Analyzing columns…</p>
        <p className="text-text-secondary text-sm">Detecting column types and suggesting mappings</p>
      </div>
    )
  }

  if (step === 'importing') {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Loader2 className="w-10 h-10 text-mrr-green animate-spin" />
        <p className="text-text-primary font-medium">Importing…</p>
      </div>
    )
  }

  if (step === 'done') {
    return null // parent page handles result display
  }

  // ── Mapping step ──────────────────────────────────────────────────────────
  if (step === 'mapping') {
    const fieldOrder = [
      'company_name_col', 'invoice_number_col', 'issue_date_col', 'amount_col',
      'currency_col', 'service_start_col', 'service_end_col', 'product_col',
    ]

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-mrr-green" />
          <h2 className="font-semibold text-text-primary">AI Column Mapping</h2>
          <span className="text-text-muted text-xs ml-auto">{file.name}</span>
        </div>

        {/* Templates bar */}
        {templates.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-secondary flex items-center gap-1">
              <BookMarked className="w-3 h-3" />Saved templates:
            </span>
            {templates.map((t) => (
              <div key={t.id} className="flex items-center gap-0.5">
                <button
                  onClick={() => applyTemplate(t)}
                  className="text-xs px-2 py-1 rounded bg-card border border-border hover:border-mrr-green hover:text-mrr-green transition-colors"
                >
                  {t.name}
                  {t.source_system ? ` (${t.source_system})` : ''}
                </button>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="p-1 text-text-muted hover:text-churn-red transition-colors"
                  title="Delete template"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Mapping table */}
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="table-header w-40">Target Field</th>
                <th className="table-header">Source Column</th>
                <th className="table-header w-24">Confidence</th>
                <th className="table-header">Sample Values</th>
              </tr>
            </thead>
            <tbody>
              {fieldOrder.map((field) => {
                const isRequired = REQUIRED_FIELDS.includes(field)
                const selectedCol = mapping[field] ?? ''
                const samples = getSamples(selectedCol)
                const confidence = getConfidenceForMapping(field)
                const conf = confidenceLabel(confidence)
                const orig = getOriginalSuggestion(field)
                const isManual = selectedCol && selectedCol !== orig?.suggested_column

                return (
                  <tr key={field} className="border-b border-border">
                    <td className="table-cell py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-text-primary font-medium text-xs">
                          {FIELD_LABELS[field]}
                        </span>
                        <Badge variant={isRequired ? 'error' : 'default'} className="text-[10px] w-fit">
                          {isRequired ? 'required' : 'optional'}
                        </Badge>
                      </div>
                    </td>
                    <td className="table-cell py-2.5">
                      <div className="relative">
                        <select
                          value={selectedCol}
                          onChange={(e) => setMapping((prev) => ({ ...prev, [field]: e.target.value }))}
                          className="input text-sm pr-8 appearance-none w-full"
                        >
                          <option value="">— not mapped —</option>
                          {allColumns.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </td>
                    <td className="table-cell py-2.5 text-xs">
                      {selectedCol ? (
                        isManual ? (
                          <span className="text-text-muted">Manual</span>
                        ) : (
                          <span className={conf.color}>{conf.text} {confidence > 0 ? `(${confidence}%)` : ''}</span>
                        )
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="table-cell py-2.5">
                      {samples.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {samples.slice(0, 3).map((s, i) => (
                            <code key={i} className="text-[10px] bg-surface px-1 py-0.5 rounded border border-border text-text-secondary truncate max-w-[100px]">
                              {s}
                            </code>
                          ))}
                        </div>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Save template section */}
        <div>
          {!showSave ? (
            <button
              onClick={() => setShowSave(true)}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save as template
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="input text-sm w-40"
              />
              <input
                type="text"
                placeholder="Source system (optional)"
                value={sourceSystem}
                onChange={(e) => setSourceSystem(e.target.value)}
                className="input text-sm w-44"
              />
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || savingTemplate}
                className="btn-secondary text-xs flex items-center gap-1"
              >
                {savingTemplate ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </button>
              <button onClick={() => setShowSave(false)} className="text-xs text-text-secondary hover:text-text-primary">
                Cancel
              </button>
            </div>
          )}
          {savedMsg && (
            <p className={`text-xs mt-1 ${savedMsg.startsWith('Error') ? 'text-churn-red' : 'text-mrr-green'}`}>
              {savedMsg}
            </p>
          )}
        </div>

        {/* Footer */}
        {missingRequired.length > 0 && (
          <p className="text-xs text-warning flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Required: {missingRequired.map((f) => FIELD_LABELS[f]).join(', ')}
          </p>
        )}
        <div className="flex gap-3">
          <button className="btn-secondary text-sm" onClick={onCancel}>Cancel</button>
          <button
            className="btn-primary text-sm flex items-center gap-2"
            onClick={handleConfirm}
            disabled={missingRequired.length > 0}
          >
            <CheckCircle className="w-4 h-4" />
            Confirm Mapping
          </button>
        </div>
      </div>
    )
  }

  // ── Preview / conflict step ───────────────────────────────────────────────
  if (step === 'preview') {
    if (!conflictData) {
      return (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="w-10 h-10 text-mrr-green animate-spin" />
          <p className="text-text-primary font-medium">Checking for conflicts…</p>
        </div>
      )
    }

    if (importError) {
      return (
        <div className="bg-churn-red bg-opacity-10 border border-churn-red border-opacity-30 rounded-lg p-5 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-churn-red flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-text-primary">{importError}</p>
            <button className="btn-secondary text-sm mt-3" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      )
    }

    const hasConflicts = conflictData.conflicts.length > 0

    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className={clsx(
          'rounded-lg p-4 flex items-start gap-3',
          hasConflicts
            ? 'bg-warning bg-opacity-10 border border-warning border-opacity-40'
            : 'bg-mrr-green bg-opacity-10 border border-mrr-green border-opacity-30'
        )}>
          {hasConflicts
            ? <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            : <CheckCircle className="w-5 h-5 text-mrr-green flex-shrink-0 mt-0.5" />
          }
          <div>
            <p className="font-semibold text-text-primary">
              {hasConflicts
                ? `${conflictData.conflicts.length} duplicate invoice${conflictData.conflicts.length !== 1 ? 's' : ''} found`
                : `Ready to import ${conflictData.new_rows} invoice${conflictData.new_rows !== 1 ? 's' : ''}`}
            </p>
            <p className="text-sm text-text-secondary mt-0.5">
              {conflictData.new_rows} new · {conflictData.conflicts.length} duplicate{conflictData.conflicts.length !== 1 ? 's' : ''} · {conflictData.total_rows} total rows
            </p>
          </div>
        </div>

        {/* Conflict table */}
        {hasConflicts && (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th className="table-header py-2">Invoice No</th>
                  <th className="table-header py-2">Company</th>
                  <th className="table-header py-2">Existing Date</th>
                  <th className="table-header py-2">Existing Amount</th>
                  <th className="table-header py-2">New Date</th>
                  <th className="table-header py-2">New Amount</th>
                </tr>
              </thead>
              <tbody>
                {conflictData.conflicts.slice(0, 8).map((c) => (
                  <tr key={c.invoice_number} className="border-b border-border">
                    <td className="table-cell py-1.5 font-mono">{c.invoice_number}</td>
                    <td className="table-cell py-1.5">{c.company}</td>
                    <td className="table-cell py-1.5 text-text-secondary">{c.existing_date}</td>
                    <td className="table-cell py-1.5 text-text-secondary">{formatCurrency(c.existing_amount, 'USD', true)}</td>
                    <td className="table-cell py-1.5 text-mrr-green">{c.new_date}</td>
                    <td className="table-cell py-1.5 text-mrr-green">{formatCurrency(c.new_amount, 'USD', true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {conflictData.conflicts.length > 8 && (
              <p className="text-xs text-text-muted px-3 py-2">…and {conflictData.conflicts.length - 8} more</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <button className="btn-secondary text-sm" onClick={() => setStep('mapping')}>
            Back to Mapping
          </button>
          {hasConflicts ? (
            <>
              <button className="btn-secondary text-sm" onClick={() => handleImport('skip')}>
                Skip duplicates
              </button>
              <button className="btn-primary text-sm" onClick={() => handleImport('overwrite')}>
                Overwrite with new data
              </button>
            </>
          ) : (
            <button className="btn-primary text-sm flex items-center gap-2" onClick={() => handleImport('skip')}>
              <CheckCircle className="w-4 h-4" />
              Import Now
            </button>
          )}
          <button className="text-sm text-text-secondary hover:text-text-primary ml-auto" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return null
}
