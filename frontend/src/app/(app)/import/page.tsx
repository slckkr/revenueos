'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Upload, FileSpreadsheet, FileText, FileCode, FileJson,
  CheckCircle, XCircle, Loader2, Download, RefreshCw, Trash2, AlertTriangle,
  Building2, Receipt,
} from 'lucide-react'
import { api, type ConflictPreview, type ImportResult, type CompanyImportResult } from '@/lib/api'
import { formatCurrency, formatRelativeTime } from '@/lib/formatters'
import { Badge } from '@/components/ui/Badge'
import { MappingWizard } from './MappingWizard'
import { CompanyMappingWizard } from './CompanyMappingWizard'
import clsx from 'clsx'

function defaultRebuildRange() {
  const now = new Date()
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const from = `${now.getFullYear() - 2}-01`
  return { from, to }
}

type Entity = 'invoices' | 'companies'
type ImportType = 'excel' | 'csv' | 'xml' | 'json'

const INVOICE_TYPES: { type: ImportType; label: string; accept: string; icon: React.ComponentType<any>; description: string }[] = [
  { type: 'excel', label: 'Excel', accept: '.xlsx,.xls', icon: FileSpreadsheet, description: 'Invoice data in Excel format (.xlsx, .xls)' },
  { type: 'csv', label: 'CSV', accept: '.csv', icon: FileText, description: 'Invoice data in CSV format' },
  { type: 'xml', label: 'Logo XML', accept: '.xml', icon: FileCode, description: 'Logo e-Fatura / e-Arşiv XML export' },
]

const COMPANY_TYPES: { type: ImportType; label: string; accept: string; icon: React.ComponentType<any>; description: string }[] = [
  { type: 'excel', label: 'Excel', accept: '.xlsx,.xls', icon: FileSpreadsheet, description: 'Company list in Excel format (.xlsx, .xls)' },
  { type: 'csv', label: 'CSV', accept: '.csv', icon: FileText, description: 'Company list in CSV format' },
  { type: 'json', label: 'JSON', accept: '.json', icon: FileJson, description: 'Company list in JSON format' },
]

export default function ImportPage() {
  const [entity, setEntity] = useState<Entity>('invoices')
  const [selectedType, setSelectedType] = useState<ImportType>('excel')
  const [dragging, setDragging] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [rebuildResult, setRebuildResult] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const [wizardFile, setWizardFile] = useState<File | null>(null)
  const [companyWizardFile, setCompanyWizardFile] = useState<File | null>(null)

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [conflictData, setConflictData] = useState<ConflictPreview | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [companyResult, setCompanyResult] = useState<CompanyImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)

  const { from: defaultFrom, to: defaultTo } = defaultRebuildRange()
  const [rebuildFrom, setRebuildFrom] = useState(defaultFrom)
  const [rebuildTo, setRebuildTo] = useState(defaultTo)
  const fileRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const { mutate: triggerRebuild, isPending: rebuilding } = useMutation({
    mutationFn: () => api.rebuildLedger(rebuildFrom, rebuildTo),
    onSuccess: (res: any) => {
      setRebuildResult(res?.data?.message || 'Ledger rebuilt successfully')
      qc.invalidateQueries({ queryKey: ['metrics-summary'] })
      qc.invalidateQueries({ queryKey: ['mrr-history'] })
      qc.invalidateQueries({ queryKey: ['anomalies'] })
    },
    onError: (err: any) => setRebuildResult(`Error: ${err.message}`),
  })

  const { mutate: doDeleteImport } = useMutation({
    mutationFn: (id: string) => api.deleteImport(id),
    onSuccess: (res: any) => {
      setDeleteConfirm(null)
      qc.invalidateQueries({ queryKey: ['import-files'] })
      const deleted = res?.data?.deleted_invoices ?? 0
      if (deleted > 0) setRebuildResult(`Import deleted. ${deleted} invoice(s) removed. Rebuild ledger to update metrics.`)
    },
    onError: (err: any) => { setDeleteConfirm(null); alert(err.message) },
  })

  const { data: filesData } = useQuery({
    queryKey: ['import-files'],
    queryFn: () => api.getImportFiles(),
    refetchInterval: 5000,
  })

  const files = filesData?.data || []

  const handleDownload = async (key: string, fn: () => Promise<void>) => {
    setDownloading(key)
    try { await fn() } catch (e) { console.error(e) } finally { setDownloading(null) }
  }

  function resetState() {
    setImportResult(null)
    setCompanyResult(null)
    setImportError(null)
    setConflictData(null)
    setPendingFile(null)
    setWizardFile(null)
    setCompanyWizardFile(null)
  }

  const handleFile = async (file: File) => {
    resetState()

    if (entity === 'companies') {
      setCompanyWizardFile(file)
      return
    }

    if (selectedType === 'xml') {
      setIsImporting(true)
      try {
        const res = await api.importXml(file) as any
        setImportResult(res?.data)
        qc.invalidateQueries({ queryKey: ['import-files'] })
      } catch (e: any) {
        setImportError(e.message)
      } finally {
        setIsImporting(false)
      }
      return
    }

    setWizardFile(file)
  }

  const runImport = async (file: File, conflictMode: 'skip' | 'overwrite') => {
    setIsImporting(true)
    setConflictData(null)
    setPendingFile(null)
    try {
      const fn = selectedType === 'csv' ? api.importCsv : api.importExcel
      const res = await fn(file, conflictMode) as any
      setImportResult(res?.data)
      qc.invalidateQueries({ queryKey: ['import-files'] })
    } catch (e: any) {
      setImportError(e.message)
    } finally {
      setIsImporting(false)
    }
  }

  function switchEntity(e: Entity) {
    resetState()
    setEntity(e)
    setSelectedType('excel')
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const importTypes = entity === 'companies' ? COMPANY_TYPES : INVOICE_TYPES
  const currentType = importTypes.find((t) => t.type === selectedType) ?? importTypes[0]
  const busy = isPreviewing || isImporting || !!wizardFile || !!companyWizardFile

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Import Center</h1>
          <p className="text-text-secondary text-sm mt-0.5">Import invoices, companies, and other data</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary flex items-center gap-2 text-sm"
            onClick={() => handleDownload('sample-invoices', () => api.downloadSample('invoices'))}
            disabled={!!downloading}
          >
            {downloading === 'sample-invoices' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Invoice Template
          </button>
          <button
            className="btn-secondary flex items-center gap-2 text-sm"
            onClick={() => handleDownload('sample-companies', () => api.downloadSample('companies'))}
            disabled={!!downloading}
          >
            {downloading === 'sample-companies' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Company Template
          </button>
        </div>
      </div>

      {/* Entity tabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        <button
          onClick={() => switchEntity('invoices')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            entity === 'invoices'
              ? 'border-mrr-green text-mrr-green'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          )}
        >
          <Receipt className="w-4 h-4" />
          Invoices
        </button>
        <button
          onClick={() => switchEntity('companies')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            entity === 'companies'
              ? 'border-mrr-green text-mrr-green'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          )}
        >
          <Building2 className="w-4 h-4" />
          Companies
        </button>
      </div>

      {/* Format selector */}
      <div className="flex gap-3">
        {importTypes.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => { setSelectedType(type); resetState() }}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded border text-sm font-medium transition-colors',
              selectedType === type
                ? 'border-mrr-green text-mrr-green bg-mrr-green bg-opacity-10'
                : 'border-border text-text-secondary hover:text-text-primary hover:border-border-light'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        className={clsx(
          'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors',
          dragging ? 'border-mrr-green bg-mrr-green bg-opacity-5' : 'border-border hover:border-border-light',
          busy && 'pointer-events-none opacity-60'
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !busy && fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept={currentType.accept}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {isPreviewing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-mrr-green animate-spin" />
            <p className="text-text-primary font-medium">Checking for conflicts…</p>
          </div>
        ) : isImporting ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-mrr-green animate-spin" />
            <p className="text-text-primary font-medium">Importing…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-text-muted" />
            <div>
              <p className="text-text-primary font-medium">
                Drop your {currentType.label} file here
              </p>
              <p className="text-text-secondary text-sm mt-1">{currentType.description}</p>
            </div>
            <span className="btn-secondary text-xs">Browse files</span>
          </div>
        )}
      </div>

      {/* Invoice mapping wizard */}
      {wizardFile && (
        <MappingWizard
          file={wizardFile}
          type={selectedType as 'excel' | 'csv'}
          onDone={(result) => {
            setImportResult(result)
            setWizardFile(null)
            qc.invalidateQueries({ queryKey: ['import-files'] })
          }}
          onCancel={() => setWizardFile(null)}
        />
      )}

      {/* Company mapping wizard */}
      {companyWizardFile && (
        <CompanyMappingWizard
          file={companyWizardFile}
          onDone={(result) => {
            setCompanyResult(result)
            setCompanyWizardFile(null)
            qc.invalidateQueries({ queryKey: ['import-files'] })
          }}
          onCancel={() => setCompanyWizardFile(null)}
        />
      )}

      {/* Conflict dialog (XML-only legacy path) */}
      {conflictData && pendingFile && (
        <div className="bg-warning bg-opacity-10 border border-warning border-opacity-40 rounded-lg p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-text-primary">
                {conflictData.conflicts.length} duplicate invoice{conflictData.conflicts.length !== 1 ? 's' : ''} found
              </p>
              <p className="text-sm text-text-secondary mt-0.5">
                {conflictData.new_rows} new invoice{conflictData.new_rows !== 1 ? 's' : ''} will be added regardless.
              </p>
            </div>
          </div>
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
                    <td className="table-cell py-1.5 font-mono text-xs">{c.invoice_number}</td>
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
          <div className="flex gap-3">
            <button className="btn-secondary text-sm" onClick={() => runImport(pendingFile, 'skip')} disabled={isImporting}>
              Skip duplicates
            </button>
            <button className="btn-primary text-sm" onClick={() => runImport(pendingFile, 'overwrite')} disabled={isImporting}>
              Overwrite with new data
            </button>
            <button className="text-sm text-text-secondary hover:text-text-primary ml-auto" onClick={() => { setConflictData(null); setPendingFile(null) }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Invoice import result */}
      {importResult && !isImporting && (() => {
        const errCount = importResult.errors?.length ?? 0
        const imported = importResult.records_imported ?? 0
        const skipped = importResult.skipped_duplicates ?? 0
        const overwritten = importResult.overwritten_duplicates ?? 0
        const allFailed = imported === 0 && overwritten === 0 && errCount > 0
        return (
          <div className={clsx(
            'rounded-lg p-4 space-y-2',
            allFailed
              ? 'bg-churn-red bg-opacity-10 border border-churn-red border-opacity-30'
              : errCount > 0
                ? 'bg-warning bg-opacity-10 border border-warning border-opacity-30'
                : 'bg-mrr-green bg-opacity-10 border border-mrr-green border-opacity-30'
          )}>
            <div className="flex items-center gap-2">
              {allFailed ? <XCircle className="w-5 h-5 text-churn-red flex-shrink-0" /> : <CheckCircle className="w-5 h-5 text-mrr-green flex-shrink-0" />}
              <p className="font-medium text-text-primary">
                {imported > 0 && `${imported} imported`}
                {overwritten > 0 && `${imported > 0 ? ', ' : ''}${overwritten} overwritten`}
                {skipped > 0 && ` · ${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped`}
                {errCount > 0 && ` · ${errCount} row${errCount !== 1 ? 's' : ''} failed`}
              </p>
            </div>
            {errCount > 0 && (
              <div className="ml-7 space-y-1">
                {(importResult.errors as Array<{ row: number; message: string }>).slice(0, 8).map((e, i) => (
                  <p key={i} className="text-xs text-text-secondary font-mono">{e.message}</p>
                ))}
                {errCount > 8 && <p className="text-xs text-text-muted">…and {errCount - 8} more errors</p>}
              </div>
            )}
            {(imported > 0 || overwritten > 0) && (
              <p className="text-xs text-text-muted ml-7">
                Next step: use the "Rebuild Ledger" section below to update dashboard metrics.
              </p>
            )}
          </div>
        )
      })()}

      {/* Company import result */}
      {companyResult && !isImporting && (() => {
        const errCount = companyResult.errors?.length ?? 0
        const allFailed = companyResult.created === 0 && companyResult.updated === 0 && errCount > 0
        return (
          <div className={clsx(
            'rounded-lg p-4 space-y-2',
            allFailed
              ? 'bg-churn-red bg-opacity-10 border border-churn-red border-opacity-30'
              : errCount > 0
                ? 'bg-warning bg-opacity-10 border border-warning border-opacity-30'
                : 'bg-mrr-green bg-opacity-10 border border-mrr-green border-opacity-30'
          )}>
            <div className="flex items-center gap-2">
              {allFailed ? <XCircle className="w-5 h-5 text-churn-red flex-shrink-0" /> : <CheckCircle className="w-5 h-5 text-mrr-green flex-shrink-0" />}
              <p className="font-medium text-text-primary">
                {companyResult.created > 0 && `${companyResult.created} companies created`}
                {companyResult.updated > 0 && `${companyResult.created > 0 ? ' · ' : ''}${companyResult.updated} updated`}
                {companyResult.skipped > 0 && ` · ${companyResult.skipped} skipped`}
                {errCount > 0 && ` · ${errCount} failed`}
              </p>
            </div>
            {errCount > 0 && (
              <div className="ml-7 space-y-1">
                {companyResult.errors.slice(0, 8).map((e, i) => (
                  <p key={i} className="text-xs text-text-secondary font-mono">{e.message}</p>
                ))}
                {errCount > 8 && <p className="text-xs text-text-muted">…and {errCount - 8} more errors</p>}
              </div>
            )}
          </div>
        )
      })()}

      {importError && !isImporting && (
        <div className="flex items-start gap-3 bg-churn-red bg-opacity-10 border border-churn-red border-opacity-30 rounded-lg p-4">
          <XCircle className="w-5 h-5 text-churn-red flex-shrink-0 mt-0.5" />
          <p className="text-sm text-text-primary">{importError}</p>
        </div>
      )}

      {/* Rebuild Ledger (invoices only) */}
      {entity === 'invoices' && (
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-text-primary flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-mrr-green" />
              Rebuild Revenue Ledger
            </h2>
            <p className="text-text-secondary text-sm mt-0.5">
              Run this after every import to update MRR, ARR, NRR and all dashboard metrics.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label block mb-1">From Month</label>
              <input type="month" className="input" value={rebuildFrom} onChange={(e) => setRebuildFrom(e.target.value)} />
            </div>
            <div>
              <label className="label block mb-1">To Month</label>
              <input type="month" className="input" value={rebuildTo} onChange={(e) => setRebuildTo(e.target.value)} />
            </div>
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => { setRebuildResult(null); triggerRebuild() }}
              disabled={rebuilding || !rebuildFrom || !rebuildTo}
            >
              {rebuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {rebuilding ? 'Rebuilding…' : 'Rebuild Ledger'}
            </button>
          </div>
          {rebuildResult && (
            <p className={`text-sm font-medium ${rebuildResult.startsWith('Error') ? 'text-churn-red' : 'text-mrr-green'}`}>
              {rebuildResult.startsWith('Error') ? '✕ ' : '✓ '}{rebuildResult}
            </p>
          )}
        </div>
      )}

      {/* Export section */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-text-primary">Export Data</h2>
        <p className="text-text-secondary text-sm">Download your data as Excel files.</p>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary flex items-center gap-2 text-sm"
            onClick={() => handleDownload('companies', () => api.exportCompanies())}
            disabled={!!downloading}
          >
            {downloading === 'companies' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Companies
          </button>
          <button
            className="btn-secondary flex items-center gap-2 text-sm"
            onClick={() => handleDownload('invoices', () => api.exportInvoices())}
            disabled={!!downloading}
          >
            {downloading === 'invoices' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Invoices
          </button>
          <button
            className="btn-secondary flex items-center gap-2 text-sm"
            onClick={() => handleDownload('ledger', () => api.exportLedger())}
            disabled={!!downloading}
          >
            {downloading === 'ledger' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Ledger
          </button>
        </div>
      </div>

      {/* Import history */}
      <div>
        <h2 className="font-semibold text-text-primary mb-3">Import History</h2>
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="table-header">File</th>
                <th className="table-header">Type</th>
                <th className="table-header">Status</th>
                <th className="table-header">Records</th>
                <th className="table-header">When</th>
                <th className="table-header w-12"></th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center text-text-secondary py-8">No imports yet</td>
                </tr>
              ) : (
                files.map((f) => (
                  <tr key={f.id} className="border-b border-border">
                    <td className="table-cell font-medium">{f.filename}</td>
                    <td className="table-cell"><Badge variant="default">{f.source}</Badge></td>
                    <td className="table-cell">
                      <Badge variant={f.status === 'done' ? 'success' : f.status === 'error' ? 'error' : f.status === 'processing' ? 'info' : 'default'}>
                        {f.status}
                      </Badge>
                    </td>
                    <td className="table-cell text-text-secondary">{f.records_imported}</td>
                    <td className="table-cell text-text-secondary">{formatRelativeTime(f.created_at)}</td>
                    <td className="table-cell">
                      {deleteConfirm === f.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => doDeleteImport(f.id)} className="text-xs text-churn-red hover:underline font-medium">
                            Confirm
                          </button>
                          <span className="text-text-muted text-xs">·</span>
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs text-text-secondary hover:text-text-primary">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(f.id)}
                          className="p-1 rounded text-text-muted hover:text-churn-red hover:bg-churn-red hover:bg-opacity-10 transition-colors"
                          title="Delete import and associated invoices"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
