'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Briefcase, TrendingUp, TrendingDown, AlertTriangle, ChevronRight,
  Download, RefreshCw, BarChart2, Target
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'

function MetricCard({
  label, value, unit = '', change, info,
}: {
  label: string; value: number | null; unit?: string; change?: number; info?: string
}) {
  const display = value === null ? '—'
    : unit === '%' ? `${value.toFixed(1)}%`
    : unit === 'x' ? `${value.toFixed(2)}x`
    : unit === '$' ? formatCurrency(value, 'USD', true)
    : value.toFixed(1)

  const isGood = change === undefined || change >= 0
  return (
    <div className="card p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-2xl font-bold text-text-primary mt-1">{display}</p>
      {change !== undefined && (
        <p className={`text-xs mt-1 flex items-center gap-1 ${isGood ? 'text-mrr-green' : 'text-churn-red'}`}>
          {isGood ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {change > 0 ? '+' : ''}{change.toFixed(1)}% MoM
        </p>
      )}
      {info && <p className="text-xs text-text-muted mt-1">{info}</p>}
    </div>
  )
}

export default function ExecutivePage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['board-snapshot', month],
    queryFn: () => api.getBoardSnapshot(month),
  })

  const snap = data?.data

  const mrrTrend = snap?.mrr_trend || []
  const prevMonthMrr = mrrTrend.length >= 2 ? mrrTrend[mrrTrend.length - 2]?.mrr : null
  const mrrChange = prevMonthMrr && snap?.mrr
    ? ((snap.mrr - prevMonthMrr) / prevMonthMrr) * 100
    : undefined

  function handleExport() {
    if (!snap) return
    const json = JSON.stringify(snap, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `board-snapshot-${month}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-violet-400" />
            Executive Pack
          </h1>
          <p className="text-text-secondary text-sm mt-0.5">Board-ready snapshot of all key metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            className="input text-sm py-1"
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
          <button
            onClick={() => refetch()}
            className="p-2 rounded hover:bg-card text-text-muted hover:text-text-primary transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            disabled={!snap}
            className="flex items-center gap-2 bg-mrr-green text-black text-sm font-medium px-3 py-1.5 rounded hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export JSON
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-text-muted text-sm">Loading board snapshot…</div>
      ) : !snap ? (
        <div className="card p-12 text-center">
          <Briefcase className="w-8 h-8 mx-auto mb-3 opacity-30 text-text-muted" />
          <p className="text-text-secondary">No data available for {month}.</p>
        </div>
      ) : (
        <>
          {/* ARR Summary */}
          <div>
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">ARR Summary</h2>
            <div className="grid grid-cols-4 gap-4">
              <MetricCard label="MRR" value={snap.mrr} unit="$" change={mrrChange} />
              <MetricCard label="ARR" value={snap.arr} unit="$" />
              <MetricCard label="MRR Growth (MoM)" value={snap.mrr_growth_pct} unit="%" />
              <MetricCard label="Weighted Pipeline" value={snap.weighted_pipeline} unit="$" info={`${snap.open_deals_count} open deals`} />
            </div>
          </div>

          {/* Retention */}
          <div>
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Retention & Efficiency</h2>
            <div className="grid grid-cols-4 gap-4">
              <MetricCard label="NRR" value={snap.nrr} unit="%" info={snap.nrr !== null ? (snap.nrr >= 100 ? 'Expanding' : 'Contracting') : undefined} />
              <MetricCard label="GRR" value={snap.grr} unit="%" />
              <MetricCard label="Logo Churn Rate" value={snap.logo_churn_rate} unit="%" />
              <MetricCard label="Quick Ratio" value={snap.quick_ratio} unit="x" />
            </div>
          </div>

          {/* Rule of 40 */}
          {snap.rule_of_40 !== null && (
            <div className="card p-4 flex items-center gap-4">
              <Target className="w-6 h-6 text-violet-400 shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-text-muted">Rule of 40</p>
                <div className="flex items-center gap-3 mt-1">
                  <p className={`text-2xl font-bold ${snap.rule_of_40 >= 40 ? 'text-mrr-green' : snap.rule_of_40 >= 20 ? 'text-amber-400' : 'text-churn-red'}`}>
                    {snap.rule_of_40.toFixed(1)}%
                  </p>
                  <span className={`text-sm px-2 py-0.5 rounded ${snap.rule_of_40 >= 40 ? 'bg-emerald-950 text-mrr-green' : snap.rule_of_40 >= 20 ? 'bg-amber-950 text-amber-400' : 'bg-red-950 text-churn-red'}`}>
                    {snap.rule_of_40 >= 40 ? 'Healthy' : snap.rule_of_40 >= 20 ? 'Needs attention' : 'Below target'}
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-1">ARR growth rate + profit margin (target: ≥ 40%)</p>
              </div>
            </div>
          )}

          {/* MRR Trend Chart */}
          {mrrTrend.length > 1 && (
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-mrr-green" />
                MRR Trend (6 months)
              </h2>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={mrrTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="execGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 6 }}
                    formatter={(v: any) => [formatCurrency(v, 'USD'), 'MRR']}
                  />
                  <Area type="monotone" dataKey="mrr" stroke="#10b981" fill="url(#execGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* AI Signals */}
          <div className="grid grid-cols-2 gap-6">
            {/* Top at-risk */}
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-churn-red" />
                <h2 className="font-semibold text-text-primary">At-Risk Accounts</h2>
                <span className="ml-auto text-xs text-churn-red font-medium">{snap.high_risk_accounts} high risk</span>
                <Link href="/health" className="text-xs text-text-muted hover:text-mrr-green ml-1">View all</Link>
              </div>
              {(snap.top_at_risk || []).length === 0 ? (
                <p className="text-text-muted text-sm p-4 text-center">No high-risk accounts</p>
              ) : (
                <div className="divide-y divide-border">
                  {(snap.top_at_risk as any[]).map((r, i) => (
                    <div key={i} className="px-4 py-3 flex items-center gap-3 hover:bg-surface transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">{r.companies?.name || '—'}</p>
                        <p className="text-xs text-text-muted truncate">{(r.reasons_json as string[])[0] || ''}</p>
                      </div>
                      <span className="text-sm font-bold text-churn-red shrink-0">{Math.round(r.score_value)}</span>
                      {r.companies?.id && (
                        <Link href={`/companies/${r.companies.id}`} className="text-text-muted hover:text-mrr-green">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top expansion */}
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-mrr-green" />
                <h2 className="font-semibold text-text-primary">Expansion Opportunities</h2>
                <span className="ml-auto text-xs text-mrr-green font-medium">{snap.expansion_ready_accounts} ready</span>
                <Link href="/expansion" className="text-xs text-text-muted hover:text-mrr-green ml-1">View all</Link>
              </div>
              {(snap.top_expansion || []).length === 0 ? (
                <p className="text-text-muted text-sm p-4 text-center">No expansion signals yet</p>
              ) : (
                <div className="divide-y divide-border">
                  {(snap.top_expansion as any[]).map((r, i) => (
                    <div key={i} className="px-4 py-3 flex items-center gap-3 hover:bg-surface transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">{r.companies?.name || '—'}</p>
                        <p className="text-xs text-text-muted truncate">{(r.reasons_json as string[])[0] || ''}</p>
                      </div>
                      <span className="text-sm font-bold text-mrr-green shrink-0">{Math.round(r.score_value)}</span>
                      {r.companies?.id && (
                        <Link href={`/companies/${r.companies.id}`} className="text-text-muted hover:text-mrr-green">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming renewals */}
          {(snap.upcoming_renewals || []).length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-400" />
                <h2 className="font-semibold text-text-primary">Upcoming Renewals (60 days)</h2>
              </div>
              <div className="divide-y divide-border">
                {(snap.upcoming_renewals as any[]).map((r, i) => {
                  const days = Math.ceil((new Date(r.end_date).getTime() - Date.now()) / 86400000)
                  return (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{r.companies?.name || '—'}</p>
                        <p className="text-xs text-text-muted">Expires {r.end_date}</p>
                      </div>
                      <div className="text-right">
                        {r.total_value && (
                          <p className="text-sm font-semibold text-mrr-green">{formatCurrency(r.total_value, 'USD', true)}</p>
                        )}
                        <p className={`text-xs ${days <= 14 ? 'text-churn-red' : days <= 30 ? 'text-amber-400' : 'text-text-muted'}`}>
                          {days} days left
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
