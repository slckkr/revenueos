'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'

type AcquisitionCohort = {
  cohort_month: string
  size: number
  periods: { period: number; month: string; retention: number; mrr: number; active: number }[]
}

type RevenueCohort = {
  band: string
  size: number
  trend: { month: string; mrr: number; active: number }[]
}

function retentionColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-900 text-emerald-300'
  if (pct >= 60) return 'bg-emerald-950 text-emerald-400'
  if (pct >= 40) return 'bg-amber-950 text-amber-400'
  if (pct >= 20) return 'bg-orange-950 text-orange-400'
  if (pct > 0) return 'bg-red-950 text-red-400'
  return 'bg-surface text-text-muted'
}

export default function CohortsPage() {
  const [tab, setTab] = useState<'acquisition' | 'revenue'>('acquisition')
  const [months, setMonths] = useState(12)

  const { data: acqData, isLoading: acqLoading } = useQuery({
    queryKey: ['cohorts-acquisition', months],
    queryFn: () => api.getAcquisitionCohorts(months),
    enabled: tab === 'acquisition',
  })

  const { data: revData, isLoading: revLoading } = useQuery({
    queryKey: ['cohorts-revenue', months],
    queryFn: () => api.getRevenueCohorts(months),
    enabled: tab === 'revenue',
  })

  const cohorts: AcquisitionCohort[] = acqData?.data || []
  const revCohorts: RevenueCohort[] = revData?.data || []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Cohort Analysis</h1>
        <p className="text-text-secondary text-sm mt-0.5">Retention and revenue trends by cohort</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex rounded border border-border overflow-hidden">
          {[{ key: 'acquisition', label: 'Acquisition Cohorts' }, { key: 'revenue', label: 'Revenue Cohorts' }].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key as 'acquisition' | 'revenue')}
              className={`px-4 py-2 text-sm transition-colors ${tab === key ? 'bg-surface text-text-primary' : 'text-text-muted hover:text-text-secondary'} ${key !== 'acquisition' ? 'border-l border-border' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted">Cohorts</label>
          <select className="select text-sm py-1" value={months} onChange={(e) => setMonths(parseInt(e.target.value))}>
            {[6, 12, 18, 24].map((m) => <option key={m} value={m}>{m} months</option>)}
          </select>
        </div>
      </div>

      {/* Acquisition Cohorts — Retention Heatmap */}
      {tab === 'acquisition' && (
        <div>
          {acqLoading ? (
            <div className="card p-8 text-center text-text-muted text-sm">Loading cohort data…</div>
          ) : cohorts.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-text-secondary">No cohort data. Companies need a created_at date and revenue history.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card p-0 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border bg-surface">
                    <tr>
                      <th className="px-4 py-3 text-left text-text-muted font-medium whitespace-nowrap">Cohort</th>
                      <th className="px-3 py-3 text-right text-text-muted font-medium">Size</th>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <th key={i} className="px-2 py-3 text-center text-text-muted font-medium min-w-[52px]">M{i}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohorts.map((cohort) => (
                      <tr key={cohort.cohort_month} className="border-b border-border">
                        <td className="px-4 py-2 font-medium text-text-primary whitespace-nowrap">{cohort.cohort_month}</td>
                        <td className="px-3 py-2 text-right text-text-secondary">{cohort.size}</td>
                        {cohort.periods.map((p) => (
                          <td key={p.period} className="px-1 py-1 text-center">
                            {cohort.size > 0 && p.active >= 0 ? (
                              <div className={`rounded px-1 py-1 text-xs font-medium ${retentionColor(p.retention)}`}>
                                {p.retention > 0 ? `${p.retention}%` : '—'}
                              </div>
                            ) : (
                              <div className="text-text-muted">—</div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span>Retention:</span>
                {[
                  { label: '80%+', cls: 'bg-emerald-900 text-emerald-300' },
                  { label: '60–80%', cls: 'bg-emerald-950 text-emerald-400' },
                  { label: '40–60%', cls: 'bg-amber-950 text-amber-400' },
                  { label: '20–40%', cls: 'bg-orange-950 text-orange-400' },
                  { label: '<20%', cls: 'bg-red-950 text-red-400' },
                ].map(({ label, cls }) => (
                  <span key={label} className={`px-2 py-0.5 rounded ${cls}`}>{label}</span>
                ))}
              </div>

              {/* MRR by cohort */}
              <div className="card p-0 overflow-auto">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold text-text-primary">MRR by Cohort (Month 0)</p>
                </div>
                <table className="w-full text-xs">
                  <thead className="border-b border-border bg-surface">
                    <tr>
                      <th className="px-4 py-3 text-left text-text-muted font-medium">Cohort</th>
                      <th className="px-3 py-3 text-right text-text-muted font-medium">Size</th>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <th key={i} className="px-2 py-3 text-center text-text-muted font-medium min-w-[64px]">M{i}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohorts.map((cohort) => (
                      <tr key={cohort.cohort_month} className="border-b border-border">
                        <td className="px-4 py-2 font-medium text-text-primary">{cohort.cohort_month}</td>
                        <td className="px-3 py-2 text-right text-text-secondary">{cohort.size}</td>
                        {cohort.periods.map((p) => (
                          <td key={p.period} className="px-1 py-2 text-center text-text-secondary">
                            {p.mrr > 0 ? formatCurrency(p.mrr, 'USD', true) : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revenue Cohorts — Band Analysis */}
      {tab === 'revenue' && (
        <div>
          {revLoading ? (
            <div className="card p-8 text-center text-text-muted text-sm">Loading cohort data…</div>
          ) : revCohorts.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-text-secondary">No revenue cohort data available.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {revCohorts.map((cohort) => (
                <div key={cohort.band} className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{cohort.band}</p>
                      <p className="text-xs text-text-muted">{cohort.size} companies in this band</p>
                    </div>
                  </div>
                  {cohort.size === 0 ? (
                    <p className="text-xs text-text-muted">No companies</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="flex gap-2">
                        {cohort.trend.map((point) => (
                          <div key={point.month} className="flex-shrink-0 text-center">
                            <div className="text-xs font-medium text-text-primary">{point.mrr > 0 ? formatCurrency(point.mrr, 'USD', true) : '—'}</div>
                            <div className="text-xs text-text-muted">{point.active} co.</div>
                            <div className="text-xs text-text-muted">{point.month.substring(5)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
