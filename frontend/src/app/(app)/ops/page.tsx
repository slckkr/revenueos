'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, EyeOff, RefreshCw, Loader2, ShieldAlert, Info } from 'lucide-react'
import { api, ReconciliationIssue } from '@/lib/api'
import { formatRelativeTime } from '@/lib/formatters'

const SEVERITY_CONFIG = {
  critical: { color: 'text-red-400',    bg: 'bg-red-950 border-red-800',     icon: AlertTriangle },
  warning:  { color: 'text-yellow-400', bg: 'bg-yellow-950 border-yellow-800', icon: AlertTriangle },
  info:     { color: 'text-blue-400',   bg: 'bg-blue-950 border-blue-800',   icon: Info          },
}

const ISSUE_TYPE_LABELS: Record<string, string> = {
  missing_service_period: 'Missing Service Period',
  unmapped_sku:           'Unmapped SKU',
  duplicate_invoice:      'Duplicate Invoice',
  unmatched_company:      'Unmatched Company',
  fx_gap:                 'Missing FX Rate',
}

function SeverityBadge({ severity }: { severity: ReconciliationIssue['severity'] }) {
  const cfg = SEVERITY_CONFIG[severity]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
      <cfg.icon className="w-3 h-3" />
      {severity}
    </span>
  )
}

export default function OpsPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'open' | 'resolved' | 'ignored' | ''>('open')
  const [scanResult, setScanResult] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reconciliation-issues', filter],
    queryFn: () => api.getReconciliationIssues(filter || undefined),
    staleTime: 0,
  })

  const { mutate: runScan, isPending: scanning } = useMutation({
    mutationFn: () => api.runReconciliationScan(),
    onSuccess: (res) => {
      setScanResult(`Scan complete — ${(res as any).data?.issues_found ?? 0} issue(s) found`)
      qc.invalidateQueries({ queryKey: ['reconciliation-issues'] })
    },
    onError: (err: any) => setScanResult(`Error: ${err.message}`),
  })

  const { mutate: resolve } = useMutation({
    mutationFn: (id: string) => api.resolveReconciliationIssue(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconciliation-issues'] }),
  })

  const { mutate: ignore } = useMutation({
    mutationFn: (id: string) => api.ignoreReconciliationIssue(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconciliation-issues'] }),
  })

  const issues: ReconciliationIssue[] = (data as any)?.data || []
  const openCount = issues.filter((i) => i.status === 'open').length
  const criticalCount = issues.filter((i) => i.severity === 'critical' && i.status === 'open').length

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Ops Center</h1>
          <p className="text-text-secondary text-sm mt-0.5">Data quality & reconciliation issues</p>
        </div>
        <button
          className="btn-secondary flex items-center gap-2 text-sm"
          onClick={() => runScan()}
          disabled={scanning}
        >
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Run Scan
        </button>
      </div>

      {scanResult && (
        <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface border border-border rounded px-3 py-2">
          <CheckCircle className="w-4 h-4 text-mrr-green flex-shrink-0" />
          {scanResult}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-text-primary">{openCount}</p>
          <p className="text-xs text-text-muted mt-1">Open Issues</p>
        </div>
        <div className="card text-center">
          <p className={`text-2xl font-bold ${criticalCount > 0 ? 'text-churn-red' : 'text-text-primary'}`}>{criticalCount}</p>
          <p className="text-xs text-text-muted mt-1">Critical</p>
        </div>
        <div className="card text-center">
          <ShieldAlert className="w-5 h-5 mx-auto text-text-muted mb-1" />
          <p className="text-xs text-text-muted">5 checks run</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['open', '', 'resolved', 'ignored'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === f
                ? 'border-mrr-green text-mrr-green'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {f === '' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Issue list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-20 bg-surface" />
          ))}
        </div>
      ) : issues.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle className="w-8 h-8 text-mrr-green mx-auto mb-3" />
          <p className="text-text-primary font-medium">No issues found</p>
          <p className="text-text-muted text-sm mt-1">Run a scan to detect data quality problems</p>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => {
            const cfg = SEVERITY_CONFIG[issue.severity]
            return (
              <div key={issue.id} className={`border rounded-lg p-4 ${cfg.bg}`}>
                <div className="flex items-start gap-3">
                  <cfg.icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-text-primary text-sm">
                        {ISSUE_TYPE_LABELS[issue.issue_type] || issue.issue_type}
                      </span>
                      <SeverityBadge severity={issue.severity} />
                      {issue.status !== 'open' && (
                        <span className="text-xs text-text-muted bg-surface px-1.5 py-0.5 rounded border border-border capitalize">
                          {issue.status}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary mt-1">{issue.description}</p>
                    {issue.object_display && (
                      <p className="text-xs text-text-muted mt-1">
                        {issue.object_type}: <span className="font-mono">{issue.object_display}</span>
                      </p>
                    )}
                    {issue.suggested_fix_json?.action && (
                      <p className="text-xs text-blue-400 mt-1.5 bg-blue-950 border border-blue-900 px-2 py-1 rounded inline-block">
                        Suggested: {issue.suggested_fix_json.action as string}
                      </p>
                    )}
                    <p className="text-xs text-text-muted mt-2">{formatRelativeTime(issue.detected_at)}</p>
                  </div>
                  {issue.status === 'open' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        className="text-xs btn-secondary py-1 px-2 flex items-center gap-1"
                        onClick={() => resolve(issue.id)}
                      >
                        <CheckCircle className="w-3 h-3" />Resolve
                      </button>
                      <button
                        className="text-xs text-text-muted hover:text-text-secondary transition-colors p-1"
                        title="Ignore this issue"
                        onClick={() => ignore(issue.id)}
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {issue.status === 'resolved' && issue.resolved_at && (
                    <p className="text-xs text-text-muted flex-shrink-0">
                      Resolved {formatRelativeTime(issue.resolved_at)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
