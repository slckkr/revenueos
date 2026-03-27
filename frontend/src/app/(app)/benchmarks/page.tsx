'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BarChart2, TrendingUp, TrendingDown, Minus, Info, CheckCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'

type BenchmarkRow = {
  cohort_key: string
  metric_key: string
  label: string
  unit: string
  higher_is_better: boolean
  p25: number
  p50: number
  p75: number
  n: number
  source: string
  my_value: number | null
  percentile: string | null
  position: 'top' | 'above_median' | 'below_median' | 'bottom' | null
}

type CohortOption = { key: string; label: string }

function PositionBadge({ position }: { position: BenchmarkRow['position'] }) {
  if (!position) return null
  const styles: Record<string, string> = {
    top: 'bg-emerald-950 text-mrr-green',
    above_median: 'bg-blue-950 text-blue-400',
    below_median: 'bg-amber-950 text-amber-400',
    bottom: 'bg-red-950 text-churn-red',
  }
  const labels: Record<string, string> = {
    top: 'Top 25%',
    above_median: 'Above Median',
    below_median: 'Below Median',
    bottom: 'Bottom 25%',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[position]}`}>
      {labels[position]}
    </span>
  )
}

function ValueBar({ value, p25, p50, p75, higherIsBetter }: {
  value: number | null; p25: number; p50: number; p75: number; higherIsBetter: boolean
}) {
  if (value === null) return <div className="text-xs text-text-muted">No data</div>

  // Normalize to 0-100% within range p25*0.5 to p75*1.5
  const min = Math.min(p25 * 0.5, value * 0.8)
  const max = Math.max(p75 * 1.5, value * 1.2)
  const range = max - min || 1

  const toPos = (v: number) => Math.max(0, Math.min(100, ((v - min) / range) * 100))
  const myPos = toPos(value)
  const p25Pos = toPos(p25)
  const p50Pos = toPos(p50)
  const p75Pos = toPos(p75)

  const isGood = higherIsBetter ? value >= p50 : value <= p50
  const barColor = isGood ? '#10b981' : value >= p25 && higherIsBetter ? '#f59e0b' : value <= p75 && !higherIsBetter ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative h-5 bg-surface rounded overflow-hidden">
      {/* Benchmark range band (p25–p75) */}
      <div
        className="absolute top-0 h-full bg-slate-800 rounded"
        style={{ left: `${p25Pos}%`, width: `${p75Pos - p25Pos}%` }}
      />
      {/* Median line */}
      <div className="absolute top-0 h-full w-px bg-slate-500" style={{ left: `${p50Pos}%` }} />
      {/* Your value */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-card z-10"
        style={{ left: `${myPos}%`, transform: `translateX(-50%) translateY(-50%)`, backgroundColor: barColor }}
      />
    </div>
  )
}

function fmtVal(value: number | null, unit: string) {
  if (value === null) return '—'
  if (unit === '$') return formatCurrency(value, 'USD', true)
  if (unit === '%') return `${value.toFixed(1)}%`
  if (unit === 'x') return `${value.toFixed(2)}x`
  if (unit === 'mo') return `${Math.round(value)} mo`
  return value.toFixed(1)
}

export default function BenchmarksPage() {
  const qc = useQueryClient()
  const [cohort, setCohort] = useState('global:saas')

  const { data, isLoading } = useQuery({
    queryKey: ['benchmarks', cohort],
    queryFn: () => api.getBenchmarks(cohort),
  })

  const { data: cohortsData } = useQuery({
    queryKey: ['benchmark-cohorts'],
    queryFn: () => api.getBenchmarkCohorts(),
  })

  const { data: optInData } = useQuery({
    queryKey: ['benchmark-optin'],
    queryFn: () => api.getBenchmarkOptIn(),
  })

  const optInMutation = useMutation({
    mutationFn: (enabled: boolean) => api.setBenchmarkOptIn(enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['benchmark-optin'] }),
  })

  const benchmarks: BenchmarkRow[] = data?.data || []
  const cohorts: CohortOption[] = cohortsData?.data || []
  const isOptedIn = optInData?.data?.enabled || false

  const myMetricsCount = benchmarks.filter(b => b.my_value !== null).length
  const topCount = benchmarks.filter(b => b.position === 'top').length
  const bottomCount = benchmarks.filter(b => b.position === 'bottom').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-400" />
            Benchmark Library
          </h1>
          <p className="text-text-secondary text-sm mt-0.5">
            Compare your SaaS metrics against industry benchmarks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="select text-sm py-1"
            value={cohort}
            onChange={e => setCohort(e.target.value)}
          >
            {cohorts.map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Opt-in banner */}
      <div className={`card p-4 flex items-start gap-3 ${isOptedIn ? 'border-mrr-green/30' : ''}`}>
        <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary">
            {isOptedIn ? 'You are contributing to benchmarks' : 'Contribute to community benchmarks'}
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            {isOptedIn
              ? 'Your anonymized metrics help improve benchmark accuracy for the community. Thank you!'
              : 'Opt in to share anonymized metrics and improve benchmark accuracy. Your data is k-anonymous (never shared if fewer than 10 participants).'}
          </p>
        </div>
        <button
          onClick={() => optInMutation.mutate(!isOptedIn)}
          disabled={optInMutation.isPending}
          className={`text-xs px-3 py-1.5 rounded font-medium transition-colors shrink-0 ${
            isOptedIn
              ? 'bg-surface text-text-muted hover:text-churn-red border border-border'
              : 'bg-mrr-green text-black hover:bg-emerald-400'
          }`}
        >
          {isOptedIn ? 'Opt out' : 'Opt in'}
        </button>
      </div>

      {/* Summary */}
      {myMetricsCount > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4">
            <p className="text-xs text-text-muted">Metrics compared</p>
            <p className="text-2xl font-bold text-text-primary mt-1">{myMetricsCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-text-muted">Top 25% metrics</p>
            <p className="text-2xl font-bold text-mrr-green mt-1">{topCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-text-muted">Bottom 25% metrics</p>
            <p className="text-2xl font-bold text-churn-red mt-1">{bottomCount}</p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span className="font-medium text-text-secondary">Bar legend:</span>
        <span className="flex items-center gap-1.5"><span className="w-8 h-2 bg-slate-800 rounded inline-block" /> p25–p75 range</span>
        <span className="flex items-center gap-1.5"><span className="w-px h-3 bg-slate-500 inline-block" /> Median (p50)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-mrr-green inline-block" /> Your value</span>
        <span className="text-xs">(Source: OpenView 2024, Bessemer 2024, KeyBanc 2024)</span>
      </div>

      {/* Benchmark table */}
      {isLoading ? (
        <div className="card p-8 text-center text-text-muted text-sm">Loading benchmarks…</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-text-muted font-medium w-40">Metric</th>
                <th className="px-4 py-3 text-right text-xs text-text-muted font-medium">Your Value</th>
                <th className="px-4 py-3 text-right text-xs text-text-muted font-medium">p25</th>
                <th className="px-4 py-3 text-right text-xs text-text-muted font-medium">Median</th>
                <th className="px-4 py-3 text-right text-xs text-text-muted font-medium">p75</th>
                <th className="px-4 py-3 text-left text-xs text-text-muted font-medium w-48">Position</th>
                <th className="px-4 py-3 text-left text-xs text-text-muted font-medium w-48">vs. Range</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((b) => (
                <tr key={b.metric_key} className="border-b border-border hover:bg-surface transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-text-primary">{b.label}</p>
                    <p className="text-xs text-text-muted capitalize">{b.higher_is_better ? '↑ higher better' : '↓ lower better'}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {b.my_value !== null ? (
                      <span className={`text-sm font-bold ${
                        b.position === 'top' ? 'text-mrr-green' :
                        b.position === 'bottom' ? 'text-churn-red' :
                        'text-text-primary'
                      }`}>
                        {fmtVal(b.my_value, b.unit)}
                      </span>
                    ) : (
                      <span className="text-text-muted text-xs">No data</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-text-muted">{fmtVal(b.p25, b.unit)}</td>
                  <td className="px-4 py-3 text-right text-xs text-text-secondary font-medium">{fmtVal(b.p50, b.unit)}</td>
                  <td className="px-4 py-3 text-right text-xs text-text-muted">{fmtVal(b.p75, b.unit)}</td>
                  <td className="px-4 py-3">
                    <PositionBadge position={b.position} />
                  </td>
                  <td className="px-4 py-3 w-48">
                    <ValueBar
                      value={b.my_value}
                      p25={b.p25}
                      p50={b.p50}
                      p75={b.p75}
                      higherIsBetter={b.higher_is_better}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
