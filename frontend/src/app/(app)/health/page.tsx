'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Heart, RefreshCw, ChevronRight, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'

type AccountScore = {
  id: string
  company_id: string
  month: string
  score_type: string
  score_value: number
  reasons_json: string[]
  computed_at: string
  companies?: { id: string; name: string; segment?: string }
}

function HealthBadge({ score }: { score: number }) {
  if (score >= 70) return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950 text-mrr-green">
      <CheckCircle className="w-3 h-3" /> Healthy
    </span>
  )
  if (score >= 40) return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-950 text-amber-400">
      <AlertCircle className="w-3 h-3" /> At Risk
    </span>
  )
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-950 text-churn-red">
      <AlertTriangle className="w-3 h-3" /> Critical
    </span>
  )
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex-1 h-1.5 bg-surface rounded overflow-hidden">
      <div className="h-full rounded transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
    </div>
  )
}

export default function HealthPage() {
  const qc = useQueryClient()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [filter, setFilter] = useState<'all' | 'critical' | 'at_risk' | 'healthy'>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['scores-health', month],
    queryFn: () => api.getScores({ score_type: 'health', month }),
  })

  const computeMutation = useMutation({
    mutationFn: () => api.computeScores({ score_type: 'health' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scores-health'] }),
  })

  const scores: AccountScore[] = data?.data || []

  const healthy = scores.filter(s => s.score_value >= 70)
  const atRisk = scores.filter(s => s.score_value >= 40 && s.score_value < 70)
  const critical = scores.filter(s => s.score_value < 40)

  const filtered = filter === 'critical' ? critical
    : filter === 'at_risk' ? atRisk
    : filter === 'healthy' ? healthy
    : scores

  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b.score_value, 0) / scores.length)
    : 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Heart className="w-5 h-5 text-churn-red" />
            Customer Health
          </h1>
          <p className="text-text-secondary text-sm mt-0.5">Health score for all accounts — identify at-risk customers early</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            className="input text-sm py-1"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <button
            onClick={() => computeMutation.mutate()}
            disabled={computeMutation.isPending}
            className="flex items-center gap-2 bg-mrr-green text-black text-sm font-medium px-3 py-1.5 rounded hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${computeMutation.isPending ? 'animate-spin' : ''}`} />
            {computeMutation.isPending ? 'Computing…' : 'Compute Scores'}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-text-muted">Avg. Health Score</p>
          <p className={`text-2xl font-bold mt-1 ${avgScore >= 70 ? 'text-mrr-green' : avgScore >= 40 ? 'text-amber-400' : 'text-churn-red'}`}>
            {avgScore}
          </p>
          <p className="text-xs text-text-muted mt-1">out of 100</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted">Healthy (70+)</p>
          <p className="text-2xl font-bold text-mrr-green mt-1">{healthy.length}</p>
          <p className="text-xs text-text-muted mt-1">accounts</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted">At Risk (40–69)</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{atRisk.length}</p>
          <p className="text-xs text-text-muted mt-1">needs attention</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted">Critical (&lt;40)</p>
          <p className="text-2xl font-bold text-churn-red mt-1">{critical.length}</p>
          <p className="text-xs text-text-muted mt-1">at churn risk</p>
        </div>
      </div>

      {/* Distribution bar */}
      {scores.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-text-primary mb-3">Health Distribution</p>
          <div className="flex h-4 rounded overflow-hidden gap-px">
            {healthy.length > 0 && (
              <div
                className="bg-emerald-600 transition-all"
                style={{ width: `${(healthy.length / scores.length) * 100}%` }}
                title={`Healthy: ${healthy.length}`}
              />
            )}
            {atRisk.length > 0 && (
              <div
                className="bg-amber-500 transition-all"
                style={{ width: `${(atRisk.length / scores.length) * 100}%` }}
                title={`At Risk: ${atRisk.length}`}
              />
            )}
            {critical.length > 0 && (
              <div
                className="bg-red-600 transition-all"
                style={{ width: `${(critical.length / scores.length) * 100}%` }}
                title={`Critical: ${critical.length}`}
              />
            )}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-text-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" /> Healthy ({healthy.length})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> At Risk ({atRisk.length})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600 inline-block" /> Critical ({critical.length})</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'critical', label: 'Critical' },
          { key: 'at_risk', label: 'At Risk' },
          { key: 'healthy', label: 'Healthy' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key as typeof filter)}
            className={`text-xs px-3 py-1 rounded border transition-colors ${filter === key ? 'border-mrr-green bg-emerald-950 text-mrr-green' : 'border-border text-text-muted hover:text-text-secondary'}`}
          >
            {label}
          </button>
        ))}
        <span className="text-xs text-text-muted ml-auto">{filtered.length} accounts</span>
      </div>

      {/* Account list */}
      {isLoading ? (
        <div className="card p-8 text-center text-text-muted text-sm">Loading health scores…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Heart className="w-8 h-8 mx-auto mb-3 opacity-30 text-text-muted" />
          <p className="text-text-secondary">No health scores yet.</p>
          <p className="text-text-muted text-sm mt-1">Click "Compute Scores" to analyze your accounts.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div key={s.id} className="card p-4 hover:border-border transition-colors">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="text-sm font-medium text-text-primary">{s.companies?.name || '—'}</p>
                    {s.companies?.segment && (
                      <span className="text-xs text-text-muted capitalize">{s.companies.segment}</span>
                    )}
                    <HealthBadge score={Math.round(s.score_value)} />
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-sm font-bold text-text-primary">{Math.round(s.score_value)}</span>
                      <div className="w-32">
                        <HealthBar score={s.score_value} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(s.reasons_json as string[]).map((r, i) => (
                      <span
                        key={i}
                        className={`text-xs px-2 py-0.5 rounded ${
                          r.toLowerCase().includes('poor') || r.toLowerCase().includes('drop') || r.toLowerCase().includes('no ')
                            ? 'bg-red-950 text-churn-red'
                            : r.toLowerCase().includes('good') || r.toLowerCase().includes('excellent') || r.toLowerCase().includes('expand') || r.toLowerCase().includes('stable') || r.toLowerCase().includes('active') || r.toLowerCase().includes('up')
                            ? 'bg-emerald-950 text-mrr-green'
                            : 'bg-surface text-text-muted'
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <Link href={`/companies/${s.company_id}`} className="text-text-muted hover:text-mrr-green mt-1 shrink-0">
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
