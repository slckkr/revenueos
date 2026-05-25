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
  Building2,
} from 'lucide-react'
import {
  api,
  type AnalyzeResult,
  type FieldSuggestion,
  type CompanyImportResult,
  type CompanyImportPreview,
  type MappingTemplate,
} from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import clsx from 'clsx'

type Step = 'analyzing' | 'mapping' | 'preview' | 'importing' | 'done'

interface Props {
  file: File
  onDone: (result: CompanyImportResult) => void
  onCancel: () => void
}

// Groups for displaying the 37 company fields in an organized way
const FIELD_GROUPS: Array<{ label: string; fields: string[] }> = [
  {
    label: 'Core',
    fields: ['name_col', 'domain_col', 'email_col', 'phone1_col', 'phone2_col', 'external_id_col', 'hubspot_id_col'],
  },
  {
    label: 'Location',
    fields: ['country_col', 'city_col', 'district_col', 'address_col', 'postal_code_col'],
  },
  {
    label: 'Classification',
    fields: ['segment_col', 'status_col', 'lifecycle_stage_col', 'industry_col', 'employee_count_col', 'annual_revenue_col'],
  },
  {
    label: 'Industry Codes',
    fields: ['chamber_of_commerce_col', 'nace_description_col', 'nace_code_col', 'isic_description_col', 'isic_code_col'],
  },
  {
    label: 'Financials',
    fields: [
      'net_sales_col', 'production_sales_net_col', 'gross_value_added_col',
      'equity_col', 'total_assets_col', 'pre_tax_profit_col', 'ebitda_col', 'exports_usd_col',
    ],
  },
  {
    label: 'Capital Structure',
    fields: ['capital_share_public_col', 'capital_share_private_col', 'capital_share_foreign_col', 'capital_share_float_col'],
  },
  {
    label: 'Rankings & Notes',
    fields: ['iso500_rank_col', 'iso500_rank_prev_year_col', 'data_year_col', 'strategic_notes_col'],
  },
]

const FIELD_LABELS: Record<string, string> = {
  name_col: 'Company Name',
  domain_col: 'Website / Domain',
  email_col: 'Email',
  phone1_col: 'Phone 1',
  phone2_col: 'Phone 2',
  country_col: 'Country',
  city_col: 'City (İl)',
  district_col: 'District (İlçe)',
  address_col: 'Address',
  postal_code_col: 'Postal Code',
  segment_col: 'Segment (SMB/MID/ENT)',
  status_col: 'Status',
  lifecycle_stage_col: 'Lifecycle Stage',
  industry_col: 'Industry / Sector',
  employee_count_col: 'Employee Count',
  annual_revenue_col: 'Annual Revenue',
  external_id_col: 'External ID / ERP Code',
  hubspot_id_col: 'HubSpot ID',
  chamber_of_commerce_col: 'Chamber of Commerce',
  nace_description_col: 'NACE Description',
  nace_code_col: 'NACE Code',
  isic_description_col: 'ISIC Description',
  isic_code_col: 'ISIC Code',
  net_sales_col: 'Net Sales (TL)',
  production_sales_net_col: 'Production Sales Net (TL)',
  gross_value_added_col: 'Gross Value Added (TL)',
  equity_col: 'Equity / Özkaynaklar (TL)',
  total_assets_col: 'Total Assets / Aktif (TL)',
  pre_tax_profit_col: 'Pre-tax Profit (TL)',
  ebitda_col: 'EBITDA / FAVÖK (TL)',
  exports_usd_col: 'Exports (Thousand $)',
  capital_share_public_col: 'Capital Public %',
  capital_share_private_col: 'Capital Private %',
  capital_share_foreign_col: 'Capital Foreign %',
  capital_share_float_col: 'Capital Float %',
  iso500_rank_col: 'ISO 500 Rank',
  iso500_rank_prev_year_col: 'ISO 500 Prev Year Rank',
  data_year_col: 'Data Year',
  strategic_notes_col: 'Strategic Notes',
}

const REQUIRED_FIELDS = ['name_col']

function confidenceLabel(score: number): { text: string; color: string } {
  if (score >= 85) return { text: 'High', color: 'text-mrr-green' }
  if (score >= 55) return { text: 'Medium', color: 'text-warning' }
  if (score > 0) return { text: 'Low', color: 'text-churn-red' }
  return { text: 'Manual', color: 'text-text-muted' }
}

export function CompanyMappingWizard({ file, onDone, onCancel }: Props) {
  const [step, setStep] = useState<Step>('analyzing')
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [previewData, setPreviewData] = useState<CompanyImportPreview | null>(null)
  const [importResult, setImportResult] = useState<CompanyImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

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

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const res = await api.analyzeFile(file, 'companies') as any
        if (cancelled) return
        const result: AnalyzeResult = res.data
        setAnalyzeResult(result)
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
    if (mapping[field] === orig.suggested_column) return orig.confidence
    return 0
  }

  function cleanMapping(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(mapping)) {
      if (v) out[k] = v
    }
    return out
  }

  async function handleConfirm() {
    setStep('preview')
    try {
      const res = await api.previewCompanyImport(file, cleanMapping()) as any
      setPreviewData(res.data)
    } catch (err: any) {
      setImportError(err.message)
    }
  }

  async function handleImport(conflictMode: 'skip' | 'overwrite') {
    setStep('importing')
    try {
      const res = await api.importCompanies(file, conflictMode, cleanMapping()) as any
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
      await api.saveMappingTemplate(templateName.trim(), sourceSystem.trim() || null, cleanMapping())
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

  // ── Render ──────────────────────────────────────────────────────────────────

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
        <p className="text-text-primary font-medium">Importing companies…</p>
      </div>
    )
  }

  if (step === 'done') {
    return null
  }

  // ── Mapping step ─────────────────────────────────────────────────────────────
  if (step === 'mapping') {
    const mappedCount = Object.values(mapping).filter(Boolean).length

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-mrr-green" />
          <h2 className="font-semibold text-text-primary">AI Column Mapping — Companies</h2>
          <span className="text-text-muted text-xs ml-auto">{file.name}</span>
          <Badge variant="default">{mappedCount} / {Object.keys(FIELD_LABELS).length} mapped</Badge>
        </div>

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
                  {t.name}{t.source_system ? ` (${t.source_system})` : ''}
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

        {/* Field groups */}
        {FIELD_GROUPS.map((group) => (
          <div key={group.label} className="card p-0 overflow-hidden">
            <div className="px-4 py-2 bg-surface border-b border-border">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">{group.label}</span>
            </div>
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="table-header w-44">Target Field</th>
                  <th className="table-header">Source Column</th>
                  <th className="table-header w-24">Confidence</th>
                  <th className="table-header">Sample Values</th>
                </tr>
              </thead>
              <tbody>
                {group.fields.map((field) => {
                  const isRequired = REQUIRED_FIELDS.includes(field)
                  const selectedCol = mapping[field] ?? ''
                  const samples = getSamples(selectedCol)
                  const confidence = getConfidenceForMapping(field)
                  const conf = confidenceLabel(confidence)
                  const orig = getOriginalSuggestion(field)
                  const isManual = selectedCol && selectedCol !== orig?.suggested_column

                  return (
                    <tr key={field} className="border-b border-border last:border-0">
                      <td className="table-cell py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-text-primary font-medium text-xs">{FIELD_LABELS[field]}</span>
                          {isRequired && (
                            <Badge variant="error" className="text-[10px] w-fit">required</Badge>
                          )}
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
                            <span className={conf.color}>{conf.text}{confidence > 0 ? ` (${confidence}%)` : ''}</span>
                          )
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="table-cell py-2.5">
                        {samples.length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {samples.slice(0, 3).map((s, i) => (
                              <code key={i} className="text-[10px] bg-surface px-1 py-0.5 rounded border border-border text-text-secondary truncate max-w-[120px]">
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
        ))}

        {/* Save template */}
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

  // ── Preview step ─────────────────────────────────────────────────────────────
  if (step === 'preview') {
    if (!previewData && !importError) {
      return (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="w-10 h-10 text-mrr-green animate-spin" />
          <p className="text-text-primary font-medium">Analyzing file…</p>
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

    const pd = previewData!
    const hasUpdates = pd.will_update > 0

    return (
      <div className="space-y-4">
        <div className={clsx(
          'rounded-lg p-4 flex items-start gap-3',
          hasUpdates
            ? 'bg-warning bg-opacity-10 border border-warning border-opacity-40'
            : 'bg-mrr-green bg-opacity-10 border border-mrr-green border-opacity-30'
        )}>
          <Building2 className={clsx('w-5 h-5 flex-shrink-0 mt-0.5', hasUpdates ? 'text-warning' : 'text-mrr-green')} />
          <div>
            <p className="font-semibold text-text-primary">
              {pd.total_rows} companies ready to import
            </p>
            <p className="text-sm text-text-secondary mt-0.5">
              {pd.will_create} new · {pd.will_update} will be updated
            </p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button className="btn-secondary text-sm" onClick={() => setStep('mapping')}>
            Back to Mapping
          </button>
          {hasUpdates ? (
            <>
              <button className="btn-secondary text-sm" onClick={() => handleImport('skip')}>
                Skip existing companies
              </button>
              <button className="btn-primary text-sm" onClick={() => handleImport('overwrite')}>
                Update existing companies
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
