'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

type FunnelStage = {
  id: string; name: string; sort_order: number; color: string
  conversion_target?: number; count: number; conversion_from_prev: number | null
}

export default function FunnelPage() {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['funnel-analysis', fromDate, toDate],
    queryFn: () => api.getFunnelAnalysis({ from: fromDate || undefined, to: toDate || undefined }),
    placeholderData: (prev) => prev,
  })

  const stages: FunnelStage[] = data?.data || []
  const maxCount = Math.max(...stages.map((s) => s.count), 1)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Funnel Analysis</h1>
        <p className="text-text-secondary text-sm mt-0.5">Stage-by-stage conversion rates</p>
      </div>

      {/* Date range filter */}
      <div className="flex gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted">From</label>
          <input type="date" className="input text-sm py-1" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted">To</label>
          <input type="date" className="input text-sm py-1" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        {(fromDate || toDate) && (
          <button className="btn-secondary text-xs px-3" onClick={() => { setFromDate(''); setToDate('') }}>Clear</button>
        )}
      </div>

      {isLoading ? (
        <div className="card p-8 flex items-center justify-center">
          <div className="text-text-muted text-sm">Loading funnel data…</div>
        </div>
      ) : stages.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-secondary">No funnel data yet. Add funnel entries to see conversion rates.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Visual funnel */}
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-6">Conversion Funnel</h2>
            <div className="space-y-3">
              {stages.filter((s) => s.name !== 'Won' && s.name !== 'Lost').map((stage, idx) => {
                const widthPct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0
                return (
                  <div key={stage.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">{stage.name}</span>
                        {stage.conversion_from_prev != null && idx > 0 && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${stage.conversion_from_prev >= (stage.conversion_target || 50) ? 'text-mrr-green bg-emerald-950' : 'text-amber-400 bg-amber-950'}`}>
                            {stage.conversion_from_prev}% from prev
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-text-primary">{stage.count}</span>
                    </div>
                    <div className="h-8 bg-surface rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-500 flex items-center px-3"
                        style={{ width: `${Math.max(widthPct, 2)}%`, backgroundColor: stage.color || '#10b981' }}
                      >
                        {widthPct > 15 && (
                          <span className="text-xs text-white font-medium">{stage.count} entries</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Stage table */}
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="table-header">Stage</th>
                  <th className="table-header text-right">Entries</th>
                  <th className="table-header text-right">Conv. from Prev</th>
                  <th className="table-header text-right">Target</th>
                  <th className="table-header text-right">vs. Target</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage, idx) => {
                  const diff = stage.conversion_from_prev != null && stage.conversion_target != null
                    ? stage.conversion_from_prev - stage.conversion_target : null
                  return (
                    <tr key={stage.id} className="border-b border-border hover:bg-surface transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color || '#10b981' }} />
                          <span className="text-sm font-medium">{stage.name}</span>
                        </div>
                      </td>
                      <td className="table-cell text-right font-semibold">{stage.count}</td>
                      <td className="table-cell text-right">
                        {idx === 0 || stage.conversion_from_prev == null ? (
                          <span className="text-text-muted">—</span>
                        ) : (
                          <span className={stage.conversion_from_prev >= (stage.conversion_target || 50) ? 'text-mrr-green font-medium' : 'text-amber-400 font-medium'}>
                            {stage.conversion_from_prev}%
                          </span>
                        )}
                      </td>
                      <td className="table-cell text-right text-text-muted text-sm">
                        {stage.conversion_target != null ? `${stage.conversion_target}%` : '—'}
                      </td>
                      <td className="table-cell text-right text-sm">
                        {diff != null ? (
                          <span className={diff >= 0 ? 'text-mrr-green' : 'text-churn-red'}>
                            {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Won/Lost summary */}
          {stages.some((s) => s.name === 'Won' || s.name === 'Lost') && (
            <div className="grid grid-cols-2 gap-4">
              {stages.filter((s) => s.name === 'Won' || s.name === 'Lost').map((stage) => (
                <div key={stage.id} className="card p-4">
                  <p className="text-xs text-text-muted">{stage.name}</p>
                  <p className={`text-2xl font-bold ${stage.name === 'Won' ? 'text-mrr-green' : 'text-churn-red'}`}>
                    {stage.count}
                  </p>
                  {stage.conversion_from_prev != null && (
                    <p className="text-xs text-text-muted mt-1">{stage.conversion_from_prev}% close rate</p>
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
