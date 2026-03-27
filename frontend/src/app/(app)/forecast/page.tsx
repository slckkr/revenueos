'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'

export default function ForecastPage() {
  const [months, setMonths] = useState(3)

  const { data, isLoading } = useQuery({
    queryKey: ['forecast-revenue', months],
    queryFn: () => api.getForecast(months),
  })

  const actual = data?.actual || []
  const forecasted = data?.forecasted || []
  const summary = data?.summary

  // Merge for chart: actual points + forecast points
  // The last actual point is shared as "bridge"
  const lastActual = actual[actual.length - 1]
  const chartData = [
    ...actual.map((p: any) => ({
      month: p.month,
      actual_mrr: p.mrr,
      forecast_mrr: undefined as number | undefined,
    })),
    ...(lastActual
      ? [{ month: lastActual.month, actual_mrr: lastActual.mrr, forecast_mrr: lastActual.mrr }]
      : []),
    ...forecasted.map((p: any) => ({
      month: p.month,
      actual_mrr: undefined as number | undefined,
      forecast_mrr: p.forecast_mrr,
    })),
  ]

  // Deduplicate by month
  const seen = new Set<string>()
  const deduped = chartData.filter(p => {
    if (seen.has(p.month)) return false
    seen.add(p.month)
    return true
  })

  const dividerMonth = lastActual?.month

  const growthPct = summary?.expected_growth_pct || 0
  const GrowthIcon = growthPct > 0 ? TrendingUp : growthPct < 0 ? TrendingDown : Minus
  const growthColor = growthPct > 0 ? 'text-mrr-green' : growthPct < 0 ? 'text-churn-red' : 'text-text-muted'

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-mrr-green" />
            Revenue Forecast
          </h1>
          <p className="text-text-secondary text-sm mt-0.5">
            AI-powered revenue projection using linear trend, pipeline, and renewal data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted">Forecast</label>
          <select
            className="select text-sm py-1"
            value={months}
            onChange={e => setMonths(parseInt(e.target.value))}
          >
            {[1, 2, 3, 6, 12].map(m => (
              <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-xs text-text-muted">Current MRR</p>
            <p className="text-xl font-bold text-text-primary mt-1">
              {formatCurrency(summary.last_actual_mrr, 'USD', true)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-text-muted">Forecast MRR (+{months}mo)</p>
            <p className="text-xl font-bold text-mrr-green mt-1">
              {formatCurrency(summary.forecast_end_mrr, 'USD', true)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-text-muted">Expected Growth</p>
            <p className={`text-xl font-bold mt-1 flex items-center gap-1 ${growthColor}`}>
              <GrowthIcon className="w-4 h-4" />
              {growthPct > 0 ? '+' : ''}{summary.expected_growth_pct}%
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-text-muted">Historical CAGR</p>
            <p className="text-xl font-bold text-text-primary mt-1">
              {summary.historical_cagr_pct > 0 ? '+' : ''}{summary.historical_cagr_pct}%
            </p>
            <p className="text-xs text-text-muted mt-0.5">per month (avg)</p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">MRR Actual vs. Forecast</h2>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-text-muted text-sm">
            Loading forecast data…
          </div>
        ) : deduped.length < 2 ? (
          <div className="h-64 flex items-center justify-center text-text-muted text-sm">
            Not enough revenue data to generate forecast.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={deduped} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb', fontSize: 12 }}
                formatter={(value: any, name: string) => [
                  formatCurrency(value, 'USD'),
                  name === 'actual_mrr' ? 'Actual MRR' : 'Forecast MRR',
                ]}
              />
              <Legend
                formatter={(value) => value === 'actual_mrr' ? 'Actual MRR' : 'Forecast MRR'}
              />
              {dividerMonth && (
                <ReferenceLine x={dividerMonth} stroke="#374151" strokeDasharray="4 4" label={{ value: 'Today', fill: '#6b7280', fontSize: 10 }} />
              )}
              <Area type="monotone" dataKey="actual_mrr" stroke="#10b981" fill="url(#actualGrad)" strokeWidth={2} dot={false} connectNulls={false} />
              <Area type="monotone" dataKey="forecast_mrr" stroke="#6366f1" fill="url(#forecastGrad)" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Forecast breakdown table */}
      {forecasted.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-text-primary">Forecast Breakdown by Method</p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-text-muted font-medium">Month</th>
                <th className="px-4 py-2 text-right text-xs text-text-muted font-medium">Trend (50%)</th>
                <th className="px-4 py-2 text-right text-xs text-text-muted font-medium">Pipeline (30%)</th>
                <th className="px-4 py-2 text-right text-xs text-text-muted font-medium">Renewal (20%)</th>
                <th className="px-4 py-2 text-right text-xs text-text-muted font-medium font-semibold">Combined</th>
              </tr>
            </thead>
            <tbody>
              {forecasted.map((f: any) => (
                <tr key={f.month} className="border-b border-border hover:bg-surface transition-colors">
                  <td className="px-4 py-2 font-medium text-text-primary">{f.month}</td>
                  <td className="px-4 py-2 text-right text-text-secondary">{formatCurrency(f.trend_mrr, 'USD', true)}</td>
                  <td className="px-4 py-2 text-right text-text-secondary">{formatCurrency(f.pipeline_mrr, 'USD', true)}</td>
                  <td className="px-4 py-2 text-right text-text-secondary">{formatCurrency(f.renewal_mrr, 'USD', true)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-mrr-green">{formatCurrency(f.forecast_mrr, 'USD', true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Methodology */}
      <div className="card p-4 text-xs text-text-muted space-y-1">
        <p className="font-semibold text-text-secondary">Methodology</p>
        <p><span className="text-indigo-400">Trend (50%)</span> — Linear regression on last 6 months of MRR</p>
        <p><span className="text-blue-400">Pipeline (30%)</span> — Open deals × probability, distributed by expected close date, added to current MRR baseline</p>
        <p><span className="text-violet-400">Renewal (20%)</span> — Expiring contracts × renewal probability (auto-renewal: 95%, manual: 70%), added to current MRR baseline</p>
      </div>
    </div>
  )
}
