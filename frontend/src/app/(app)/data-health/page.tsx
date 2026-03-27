'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, ShieldCheck, ShieldAlert, Shield, TrendingUp, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { api, DataHealthDimension, DataHealthSnapshot } from '@/lib/api'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts'

function ScoreGauge({ score, confidence }: { score: number; confidence: 'high' | 'medium' | 'low' }) {
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const Icon = score >= 80 ? ShieldCheck : score >= 50 ? Shield : ShieldAlert
  const label = score >= 80 ? 'Healthy' : score >= 50 ? 'Needs Attention' : 'Critical'

  // SVG arc gauge
  const radius = 60
  const cx = 80
  const cy = 80
  const startAngle = 210
  const endAngle = 330
  const totalAngle = endAngle - startAngle + 360 // 300 degrees arc
  const filledAngle = (score / 100) * 300
  const circumference = 2 * Math.PI * radius
  const arcLength = (300 / 360) * circumference
  const filledLength = (filledAngle / 360) * circumference

  const polarToCartesian = (angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    }
  }

  const describeArc = (start: number, end: number) => {
    const s = polarToCartesian(start)
    const e = polarToCartesian(end)
    const large = end - start > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`
  }

  return (
    <div className="flex flex-col items-center">
      <svg width={160} height={120} viewBox="0 0 160 120">
        {/* Background arc */}
        <path
          d={describeArc(120, 420)}
          fill="none"
          stroke="#2a2a2a"
          strokeWidth={12}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        {score > 0 && (
          <path
            d={describeArc(120, 120 + (score / 100) * 300)}
            fill="none"
            stroke={color}
            strokeWidth={12}
            strokeLinecap="round"
          />
        )}
        {/* Score text */}
        <text x={cx} y={cy + 8} textAnchor="middle" fill="white" fontSize={24} fontWeight="bold">
          {score}
        </text>
        <text x={cx} y={cy + 24} textAnchor="middle" fill="#666" fontSize={11}>
          / 100
        </text>
      </svg>
      <div className="flex items-center gap-2 -mt-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-sm font-medium" style={{ color }}>{label}</span>
        <span className="text-xs text-text-muted">({confidence} confidence)</span>
      </div>
    </div>
  )
}

function DimensionBar({ dim }: { dim: DataHealthDimension }) {
  const color = dim.score >= 80 ? '#10b981' : dim.score >= 50 ? '#f59e0b' : '#ef4444'
  const Icon = dim.score >= 80 ? CheckCircle : dim.score >= 50 ? AlertTriangle : XCircle

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color }} />
          <div>
            <span className="text-sm font-medium text-text-primary">{dim.name}</span>
            <span className="text-xs text-text-muted ml-2">({dim.weight}% weight)</span>
          </div>
        </div>
        <span className="text-sm font-bold" style={{ color }}>{dim.score}</span>
      </div>
      <div className="h-2 bg-surface rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${dim.score}%`, background: color }}
        />
      </div>
      <p className="text-xs text-text-muted">{dim.detail}</p>
    </div>
  )
}

export default function DataHealthPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['data-health'],
    queryFn: () => api.getDataHealth(),
    staleTime: 300_000,
  })

  const { data: historyData } = useQuery({
    queryKey: ['data-health-history'],
    queryFn: () => api.getDataHealthHistory(30),
    staleTime: 300_000,
  })

  const computeMutation = useMutation({
    mutationFn: () => api.computeDataHealth(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-health'] })
      qc.invalidateQueries({ queryKey: ['data-health-history'] })
    },
  })

  const snapshot = data?.data
  const history = historyData?.data || []

  const chartData = [...history].reverse().map((h) => ({
    date: h.date,
    score: h.score,
    label: new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Data Health</h1>
          <p className="text-sm text-text-secondary mt-1">
            Quality score across 5 dimensions — mapping coverage, completeness, CRM consistency, freshness, and uniqueness.
          </p>
        </div>
        <button
          onClick={() => computeMutation.mutate()}
          disabled={computeMutation.isPending}
          className="flex items-center gap-2 text-sm bg-surface border border-border px-3 py-1.5 rounded hover:border-mrr-green hover:text-mrr-green transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${computeMutation.isPending ? 'animate-spin' : ''}`} />
          Recompute
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card animate-pulse h-52 bg-surface" />
          <div className="card animate-pulse h-52 bg-surface col-span-2" />
        </div>
      ) : snapshot ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score gauge */}
            <div className="card flex flex-col items-center justify-center gap-2">
              <h2 className="font-semibold text-text-primary self-start w-full">Overall Score</h2>
              <ScoreGauge score={snapshot.score} confidence={snapshot.confidence} />
              <p className="text-xs text-text-muted">Last computed: {snapshot.snapshot_date}</p>
            </div>

            {/* Dimensions */}
            <div className="card col-span-2 space-y-5">
              <h2 className="font-semibold text-text-primary">Dimension Breakdown</h2>
              {snapshot.dimensions.map((dim) => (
                <DimensionBar key={dim.name} dim={dim} />
              ))}
            </div>
          </div>

          {/* History chart */}
          {chartData.length > 1 && (
            <div className="card">
              <h2 className="font-semibold text-text-primary mb-4">Score History (30 days)</h2>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                  <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.4} />
                  <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.4} />
                  <Tooltip
                    formatter={(v: number) => [`${v}`, 'Score']}
                    contentStyle={{ background: 'var(--color-card, #1a1a1a)', border: '1px solid var(--color-border, #2a2a2a)', borderRadius: '8px' }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-6 mt-2 text-xs text-text-muted">
                <span className="flex items-center gap-1">
                  <span className="w-4 h-0.5 bg-mrr-green inline-block opacity-40" /> ≥80 Healthy
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-0.5 bg-warning inline-block opacity-40" /> ≥50 Needs attention
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-0.5 bg-churn-red inline-block opacity-40" /> &lt;50 Critical
                </span>
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="card">
            <h2 className="font-semibold text-text-primary mb-4">Recommendations</h2>
            <div className="space-y-3">
              {snapshot.dimensions
                .filter((d) => d.score < 80)
                .sort((a, b) => a.score - b.score)
                .map((d) => (
                  <div key={d.name} className={`flex items-start gap-3 p-3 rounded border ${
                    d.score < 50 ? 'bg-red-950 border-red-800' : 'bg-yellow-950 border-yellow-800'
                  }`}>
                    {d.score < 50
                      ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    }
                    <div>
                      <p className="text-sm font-medium text-text-primary">{d.name} — {d.score}/100</p>
                      <p className="text-xs text-text-muted mt-0.5">{d.detail}</p>
                      <p className="text-xs text-text-secondary mt-1">
                        {d.name === 'Mapping Coverage' && 'Map invoice lines to products in the Products page to improve this score.'}
                        {d.name === 'Completeness' && 'Ensure invoices have service_period_start/end set — re-import or manually edit missing periods.'}
                        {d.name === 'CRM Consistency' && 'Sync HubSpot to link companies. Go to Settings → Integrations → HubSpot Sync.'}
                        {d.name === 'Data Freshness' && 'Import new data — the last import is more than 7 days old.'}
                        {d.name === 'Uniqueness' && 'Review and void duplicate invoices. Check Import history for overlapping records.'}
                      </p>
                    </div>
                  </div>
                ))}
              {snapshot.dimensions.every((d) => d.score >= 80) && (
                <div className="flex items-center gap-3 p-3 bg-emerald-900 border border-emerald-700 rounded">
                  <CheckCircle className="w-4 h-4 text-mrr-green" />
                  <p className="text-sm text-mrr-green">All dimensions are healthy. Keep up the great data hygiene!</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="card text-center py-16">
          <ShieldAlert className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary font-medium">No health snapshot yet</p>
          <p className="text-text-muted text-sm mt-1">Click Recompute to generate the first score.</p>
        </div>
      )}
    </div>
  )
}
