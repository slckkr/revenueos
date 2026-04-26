'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronLeft, ChevronRight, Users2, Lock, ExternalLink, TrendingDown, ShieldAlert, X, TrendingUp as ChurnIcon } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { formatCurrency, formatPercent, getNrrColor } from '@/lib/formatters'
import { KPICard } from '@/components/dashboard/KPICard'
import { MRRChart } from '@/components/dashboard/MRRChart'
import { NetNewMRRChart } from '@/components/dashboard/NetNewMRRChart'
import { MRRBridgeChart } from '@/components/dashboard/MRRBridgeChart'

type ChurnPeriod = { label: string; logo_churn_rate: number; revenue_churn_rate: number; churned_count: number; churned_mrr: number; avg_churned_mrr?: number; companies: Array<{ id: string; name: string; mrr_lost: number; month?: string }> }

export default function DashboardPage() {
  const [selectedMonth, setSelectedMonth] = useState(getPrevMonth(getCurrentMonth()))
  const [drilldownMetric, setDrilldownMetric] = useState<string | null>(null)
  const [churnPeriod, setChurnPeriod] = useState<ChurnPeriod | null>(null)

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['metrics-summary', selectedMonth],
    queryFn: () => api.getMetricsSummary(selectedMonth),
    staleTime: 0,
  })

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['mrr-history'],
    queryFn: () => api.getMrrHistory(24),
    staleTime: 0,
  })

  const { data: anomaliesData } = useQuery({
    queryKey: ['anomalies', selectedMonth],
    queryFn: () => api.getAnomalies(selectedMonth),
    staleTime: 0,
  })

  const { data: bridgeData } = useQuery({
    queryKey: ['mrr-bridge', selectedMonth],
    queryFn: () => api.getMrrBridge(selectedMonth),
    staleTime: 0,
  })

  const { data: segmentData } = useQuery({
    queryKey: ['segment-breakdown', selectedMonth],
    queryFn: () => api.getSegmentBreakdown(selectedMonth),
    staleTime: 60_000,
  })

  const { data: drilldownData } = useQuery({
    queryKey: ['metric-drilldown', drilldownMetric, selectedMonth],
    queryFn: () => api.getMetricDrilldown(drilldownMetric!, selectedMonth),
    enabled: !!drilldownMetric,
    staleTime: 0,
  })

  const { data: advancedData } = useQuery({
    queryKey: ['advanced-metrics', selectedMonth],
    queryFn: () => api.getAdvancedMetrics(selectedMonth),
    staleTime: 60_000,
  })

  const { data: churnRiskData } = useQuery({
    queryKey: ['churn-risk-dashboard', selectedMonth],
    queryFn: () => api.getChurnRisk({ month: selectedMonth, min_score: 60, limit: 5 }),
    staleTime: 300_000,
  })

  const { data: churnRatesData } = useQuery({
    queryKey: ['churn-rates'],
    queryFn: () => api.getChurnRates(24),
    staleTime: 300_000,
  })

  const { data: churnedCompaniesData } = useQuery({
    queryKey: ['churned-companies', selectedMonth],
    queryFn: () => api.getMetricDrilldown('churn_mrr', selectedMonth),
    staleTime: 0,
  })

  const summary = summaryData?.data
  const churnedCompanies = churnedCompaniesData?.data?.drivers || []
  const churnRates = churnRatesData?.data
  const history = historyData?.data || []
  const anomalies = anomaliesData?.data || []
  const churnRisks = churnRiskData?.data || []
  const highRisk = churnRisks.filter(r => r.score_value >= 70)
  const mediumRisk = churnRisks.filter(r => r.score_value >= 60 && r.score_value < 70)
  const bridge = bridgeData?.data
  const segments = segmentData?.data || []
  const advanced = advancedData?.data
  const criticalAnomalies = anomalies.filter((a) => a.severity === 'critical')
  const warningAnomalies = anomalies.filter((a) => a.severity === 'warning')

  const prevMonthData = history.find((h) => h.month === getPrevMonth(selectedMonth))
  const mrrTrend = prevMonthData && summary && prevMonthData.mrr > 0
    ? ((summary.mrr - prevMonthData.mrr) / prevMonthData.mrr) * 100
    : undefined

  const canGoForward = selectedMonth < getCurrentMonth()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-text-secondary text-sm mt-0.5">Revenue overview for {formatMonthLabel(selectedMonth)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setSelectedMonth(getPrevMonth(selectedMonth))} className="p-1.5 rounded hover:bg-card text-text-secondary hover:text-text-primary transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input type="month" className="input text-sm py-1.5 px-2" value={selectedMonth.slice(0, 7)} max={getCurrentMonth().slice(0, 7)} onChange={(e) => setSelectedMonth(e.target.value + '-01')} />
          <button onClick={() => setSelectedMonth(getNextMonth(selectedMonth))} disabled={!canGoForward} className="p-1.5 rounded hover:bg-card text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {criticalAnomalies.length > 0 && (
        <div className="space-y-2">
          {criticalAnomalies.map((flag) => (
            <div key={flag.type} className="flex items-start gap-3 bg-churn-red bg-opacity-10 border border-churn-red border-opacity-30 rounded-lg p-4">
              <AlertTriangle className="w-4 h-4 text-churn-red flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-churn-red">{flag.message}</p>
                <p className="text-xs text-text-secondary mt-1">{flag.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {warningAnomalies.length > 0 && (
        <div className="space-y-2">
          {warningAnomalies.map((flag) => (
            <div key={flag.type} className="flex items-start gap-3 bg-warning bg-opacity-10 border border-warning border-opacity-30 rounded-lg p-4">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning">{flag.message}</p>
                <p className="text-xs text-text-secondary mt-1">{flag.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {summaryLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-24 bg-surface" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <KPICard label="MRR" value={formatCurrency(summary?.mrr || 0, 'USD', true)} subValue={'ARR ' + formatCurrency((summary?.mrr || 0) * 12, 'USD', true)} trend={mrrTrend} color="#10b981" onClick={() => setDrilldownMetric(drilldownMetric === 'mrr' ? null : 'mrr')} />
          <KPICard label="NRR" value={formatPercent(summary?.nrr || 0, 1)} subValue="Net Revenue Retention" color={getNrrColor(summary?.nrr || 0)} />
          <KPICard label="GRR" value={formatPercent(summary?.grr || 0, 1)} subValue="Gross Revenue Retention" />
          <KPICard label="ARPA" value={formatCurrency(summary?.arpa || 0, 'USD', true)} subValue="Avg Revenue / Account" color="#8b5cf6" />
          <KPICard label="Quick Ratio" value={(summary?.quick_ratio || 0).toFixed(2)} subValue="Growth efficiency" color={(summary?.quick_ratio || 0) >= 4 ? '#10b981' : (summary?.quick_ratio || 0) >= 1 ? '#f59e0b' : '#ef4444'} />
          <KPICard label="Net New MRR" value={formatCurrency(summary?.net_new_mrr || 0, 'USD', true)} subValue={summary?.net_new_mrr && summary.net_new_mrr >= 0 ? 'Growing' : 'Declining'} color={(summary?.net_new_mrr || 0) >= 0 ? '#10b981' : '#ef4444'} onClick={() => setDrilldownMetric(drilldownMetric === 'net_new_mrr' ? null : 'net_new_mrr')} />
          <KPICard label="New MRR" value={formatCurrency(summary?.new_mrr || 0, 'USD', true)} subValue="From new customers" color="#10b981" onClick={() => setDrilldownMetric(drilldownMetric === 'new_mrr' ? null : 'new_mrr')} />
          <KPICard label="Expansion Rate" value={formatPercent(summary?.expansion_rate || 0, 1)} subValue="MRR from expansion" color="#34d399" onClick={() => setDrilldownMetric(drilldownMetric === 'expansion_mrr' ? null : 'expansion_mrr')} />
          <KPICard label="Churned MRR" value={formatCurrency(Math.abs(summary?.churned_mrr || 0), 'USD', true)} subValue={(summary?.churned_customers || 0) + ' customer(s)'} color="#ef4444" onClick={() => setDrilldownMetric(drilldownMetric === 'churn_mrr' ? null : 'churn_mrr')} />
          <KPICard label="Active Customers" value={String(summary?.active_customers || 0)} subValue={'Rev churn ' + formatPercent(summary?.revenue_churn_rate || 0, 1)} />
        </div>
      )}

      {/* Churned This Month Panel */}
      {churnedCompanies.length > 0 && (
        <div className="card p-0 overflow-hidden border border-churn-red border-opacity-30">
          <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-red-950 bg-opacity-20">
            <TrendingDown className="w-4 h-4 text-churn-red flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-text-primary">
                Churned — {formatMonthLabel(selectedMonth)}
              </span>
              <span className="ml-3 text-xs text-text-muted">
                {churnedCompanies.length} company · {formatCurrency(Math.abs(churnedCompaniesData?.data?.total || 0), 'USD', true)} MRR lost
              </span>
            </div>
            <span className="text-xs text-text-muted hidden sm:block">
              Previous month invoiced, this month no invoice
            </span>
          </div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  <th className="table-header text-left">#</th>
                  <th className="table-header text-left">Company</th>
                  <th className="table-header text-right">MRR Lost</th>
                </tr>
              </thead>
              <tbody>
                {[...churnedCompanies]
                  .sort((a, b) => a.amount - b.amount)
                  .map((c, i) => (
                    <tr key={i} className="border-b border-border hover:bg-surface transition-colors">
                      <td className="table-cell text-text-muted text-xs w-8">{i + 1}</td>
                      <td className="table-cell">
                        <Link href={`/companies/${c.company_id}`} className="text-sm text-text-secondary hover:text-mrr-green transition-colors">
                          {c.company_name}
                        </Link>
                      </td>
                      <td className="table-cell text-right text-sm font-medium text-churn-red">
                        {formatCurrency(Math.abs(c.amount), 'USD', true)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Metric Drill-Down panel */}
      {drilldownMetric && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-text-primary capitalize">
              {drilldownMetric.replace(/_/g, ' ')} — Top Drivers
            </h2>
            <button className="text-xs text-text-muted hover:text-text-secondary transition-colors" onClick={() => setDrilldownMetric(null)}>
              Close ×
            </button>
          </div>
          {!drilldownData ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 bg-surface rounded animate-pulse" />
              ))}
            </div>
          ) : drilldownData.data.drivers.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-4">No data for this metric in this month.</p>
          ) : (
            <>
              <p className="text-xs text-text-muted">
                Total: <span className="font-medium text-text-secondary">{formatCurrency(drilldownData.data.total, 'USD')}</span>
              </p>
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {drilldownData.data.drivers.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                    <span className="text-text-secondary truncate max-w-[60%]">{d.company_name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {d.event_type && (
                        <span className="text-xs text-text-muted px-1.5 py-0.5 bg-surface rounded">{d.event_type}</span>
                      )}
                      <span className={`font-medium ${d.amount >= 0 ? 'text-mrr-green' : 'text-churn-red'}`}>
                        {d.amount >= 0 ? '+' : ''}{formatCurrency(d.amount, 'USD', true)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {historyLoading ? (
          <>
            <div className="card animate-pulse h-72 bg-surface" />
            <div className="card animate-pulse h-72 bg-surface" />
          </>
        ) : (
          <>
            <MRRChart data={history} selectedMonth={selectedMonth} />
            <NetNewMRRChart data={history} />
          </>
        )}
      </div>

      {/* MRR Bridge */}
      {bridge ? (
        bridge.start_mrr > 0 ? (
          <MRRBridgeChart data={bridge} />
        ) : (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-text-primary">MRR Bridge</h2>
            </div>
            <p className="text-text-muted text-sm text-center py-8">
              No revenue data for this month. Import invoices and rebuild the ledger to see the bridge.
            </p>
          </div>
        )
      ) : (
        <div className="card animate-pulse h-40 bg-surface" />
      )}

      {/* Segment breakdown */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <Users2 className="w-4 h-4 text-text-secondary" />
          <h2 className="font-semibold text-text-primary">Segment Breakdown</h2>
        </div>
        {segments.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-6">
            No segment data yet. Assign segments to companies and rebuild the ledger.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="table-header text-left">Segment</th>
                  <th className="table-header text-right">MRR</th>
                  <th className="table-header text-right">NRR</th>
                  <th className="table-header text-right">Customers</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((seg) => (
                  <tr key={seg.segment || 'unassigned'} className="border-b border-border hover:bg-surface transition-colors">
                    <td className="table-cell font-medium text-sm capitalize">{seg.segment || 'Unassigned'}</td>
                    <td className="table-cell text-right text-sm">{formatCurrency(seg.mrr, 'USD', true)}</td>
                    <td className={`table-cell text-right text-sm font-medium ${seg.nrr >= 100 ? 'text-mrr-green' : seg.nrr >= 80 ? 'text-warning' : seg.nrr > 0 ? 'text-churn-red' : 'text-text-muted'}`}>
                      {seg.nrr > 0 ? formatPercent(seg.nrr, 1) : '—'}
                    </td>
                    <td className="table-cell text-right text-sm text-text-secondary">{seg.active_customers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Insights — Churn Risk */}
      {churnRisks.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-churn-red" />
            <h2 className="font-semibold text-text-primary">AI Insights — Churn Risk</h2>
            {highRisk.length > 0 && (
              <span className="ml-1 text-xs font-medium text-churn-red bg-red-950 px-2 py-0.5 rounded">
                {highRisk.length} high risk
              </span>
            )}
            {mediumRisk.length > 0 && (
              <span className="text-xs font-medium text-amber-400 bg-amber-950 px-2 py-0.5 rounded">
                {mediumRisk.length} medium
              </span>
            )}
            <Link href="/health" className="ml-auto text-xs text-text-muted hover:text-mrr-green transition-colors flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> View all
            </Link>
          </div>
          <div className="divide-y divide-border">
            {churnRisks.slice(0, 5).map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-center gap-3 hover:bg-surface transition-colors">
                <TrendingDown className={`w-4 h-4 shrink-0 ${r.score_value >= 70 ? 'text-churn-red' : 'text-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{r.companies?.name || '—'}</p>
                  <p className="text-xs text-text-muted truncate">{(r.reasons_json as string[])[0] || ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-sm font-bold ${r.score_value >= 70 ? 'text-churn-red' : 'text-amber-400'}`}>
                    {Math.round(r.score_value)}
                  </span>
                  <p className="text-xs text-text-muted">{r.score_value >= 70 ? 'High' : 'Medium'}</p>
                </div>
                {r.companies?.id && (
                  <Link href={`/companies/${r.companies.id}`} className="text-text-muted hover:text-mrr-green">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Churn Analysis */}
      {churnRates && (churnRates.monthly.length > 0 || churnRates.annual.length > 0) && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <ChurnIcon className="w-4 h-4 text-churn-red" />
            <h2 className="font-semibold text-text-primary">Churn Analysis</h2>
            <span className="text-xs text-text-muted ml-auto">Click a row to see churned companies</span>
          </div>

          {/* Annual */}
          {churnRates.annual.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Annual</p>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="table-header text-left">Year</th>
                    <th className="table-header text-right">Logo Churn</th>
                    <th className="table-header text-right">Revenue Churn</th>
                    <th className="table-header text-right">Churned</th>
                    <th className="table-header text-right">MRR Lost</th>
                    <th className="table-header text-right">Avg MRR/Customer</th>
                  </tr>
                </thead>
                <tbody>
                  {churnRates.annual.map((a) => (
                    <tr
                      key={a.year}
                      onClick={() => setChurnPeriod(churnPeriod?.label === String(a.year) ? null : { label: String(a.year), logo_churn_rate: a.logo_churn_rate, revenue_churn_rate: a.revenue_churn_rate, churned_count: a.churned_count, churned_mrr: a.churned_mrr, avg_churned_mrr: a.avg_churned_mrr, companies: a.companies })}
                      className={`border-b border-border cursor-pointer transition-colors ${churnPeriod?.label === String(a.year) ? 'bg-red-950/30' : 'hover:bg-surface'}`}
                    >
                      <td className="table-cell font-medium text-sm">{a.year}</td>
                      <td className="table-cell text-right">
                        <span className={`text-sm font-semibold ${a.logo_churn_rate > 5 ? 'text-churn-red' : a.logo_churn_rate > 2 ? 'text-amber-400' : 'text-mrr-green'}`}>
                          {a.logo_churn_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        <span className={`text-sm font-semibold ${a.revenue_churn_rate > 5 ? 'text-churn-red' : a.revenue_churn_rate > 2 ? 'text-amber-400' : 'text-mrr-green'}`}>
                          {a.revenue_churn_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="table-cell text-right text-sm text-text-secondary">{a.churned_count}</td>
                      <td className="table-cell text-right text-sm text-churn-red font-medium">{formatCurrency(Math.abs(a.churned_mrr), 'USD', true)}</td>
                      <td className="table-cell text-right text-sm text-text-secondary">{formatCurrency(a.avg_churned_mrr, 'USD', true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Monthly */}
          {churnRates.monthly.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Monthly (last 24 months)</p>
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border">
                      <th className="table-header text-left">Month</th>
                      <th className="table-header text-right">Logo Churn</th>
                      <th className="table-header text-right">Revenue Churn</th>
                      <th className="table-header text-right">Churned</th>
                      <th className="table-header text-right">MRR Lost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...churnRates.monthly].reverse().map((m) => (
                      <tr
                        key={m.month}
                        onClick={() => setChurnPeriod(churnPeriod?.label === m.month ? null : { label: m.month, logo_churn_rate: m.logo_churn_rate, revenue_churn_rate: m.revenue_churn_rate, churned_count: m.churned_count, churned_mrr: m.churned_mrr, companies: m.companies })}
                        className={`border-b border-border cursor-pointer transition-colors ${churnPeriod?.label === m.month ? 'bg-red-950/30' : 'hover:bg-surface'}`}
                      >
                        <td className="table-cell text-sm font-medium">{formatMonthLabel(m.month)}</td>
                        <td className="table-cell text-right">
                          <span className={`text-sm font-semibold ${m.logo_churn_rate > 5 ? 'text-churn-red' : m.logo_churn_rate > 2 ? 'text-amber-400' : 'text-mrr-green'}`}>
                            {m.logo_churn_rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="table-cell text-right">
                          <span className={`text-sm font-semibold ${m.revenue_churn_rate > 5 ? 'text-churn-red' : m.revenue_churn_rate > 2 ? 'text-amber-400' : 'text-mrr-green'}`}>
                            {m.revenue_churn_rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="table-cell text-right text-sm text-text-secondary">{m.churned_count}</td>
                        <td className="table-cell text-right text-sm text-churn-red font-medium">{formatCurrency(Math.abs(m.churned_mrr), 'USD', true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Drill-down panel */}
          {churnPeriod && (
            <div className="border border-border rounded-lg p-4 space-y-3 bg-surface">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Churned Companies — {churnPeriod.label}
                  </p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-text-muted">Logo Churn: <span className="text-churn-red font-medium">{churnPeriod.logo_churn_rate.toFixed(1)}%</span></span>
                    <span className="text-xs text-text-muted">Revenue Churn: <span className="text-churn-red font-medium">{churnPeriod.revenue_churn_rate.toFixed(1)}%</span></span>
                    <span className="text-xs text-text-muted">Total Lost: <span className="text-churn-red font-medium">{formatCurrency(Math.abs(churnPeriod.churned_mrr), 'USD', true)}</span></span>
                    {churnPeriod.avg_churned_mrr && (
                      <span className="text-xs text-text-muted">Avg / Customer: <span className="text-text-secondary font-medium">{formatCurrency(churnPeriod.avg_churned_mrr, 'USD', true)}</span></span>
                    )}
                  </div>
                </div>
                <button onClick={() => setChurnPeriod(null)} className="text-text-muted hover:text-text-primary p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {churnPeriod.companies.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-4">No churned companies found.</p>
              ) : (
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {churnPeriod.companies
                    .sort((a, b) => a.mrr_lost - b.mrr_lost)
                    .map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <Link href={`/companies/${c.id}`} className="text-text-secondary hover:text-mrr-green truncate transition-colors">
                            {c.name}
                          </Link>
                          {c.month && (
                            <span className="text-xs text-text-muted flex-shrink-0">({formatMonthLabel(c.month)})</span>
                          )}
                        </div>
                        <span className="text-churn-red font-medium flex-shrink-0 ml-4">
                          {formatCurrency(c.mrr_lost, 'USD', true)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CEO / Advanced Metrics */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">Advanced Metrics</h2>
          <Link href="/financial-inputs" className="flex items-center gap-1 text-xs text-text-muted hover:text-mrr-green transition-colors">
            <ExternalLink className="w-3 h-3" /> Financial Inputs
          </Link>
        </div>
        {!advanced || !advanced.has_financial_inputs ? (
          <div className="flex items-start gap-3 bg-blue-950 border border-blue-900 rounded p-4">
            <Lock className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-300">Financial Inputs Required</p>
              <p className="text-xs text-blue-400 mt-1">
                CAC, LTV, Burn Multiple, Rule of 40, Magic Number and Revenue/Employee require monthly COGS, OpEx, and S&M Spend.{' '}
                <Link href="/financial-inputs" className="text-blue-300 hover:text-white underline">
                  Add financial inputs →
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <AdvancedKPI
              label="CAC"
              value={advanced.cac !== null ? formatCurrency(advanced.cac, 'USD', true) : '—'}
              sub="Cost to Acquire Customer"
            />
            <AdvancedKPI
              label="LTV"
              value={advanced.ltv !== null ? formatCurrency(advanced.ltv, 'USD', true) : '—'}
              sub="Customer Lifetime Value"
              color="#8b5cf6"
            />
            <AdvancedKPI
              label="LTV / CAC"
              value={advanced.ltv_cac_ratio !== null ? advanced.ltv_cac_ratio.toFixed(1) + 'x' : '—'}
              sub={advanced.ltv_cac_ratio !== null ? (advanced.ltv_cac_ratio >= 3 ? 'Healthy ≥3x' : 'Below target') : undefined}
              color={advanced.ltv_cac_ratio !== null ? (advanced.ltv_cac_ratio >= 3 ? '#10b981' : '#f59e0b') : undefined}
            />
            <AdvancedKPI
              label="CAC Payback"
              value={advanced.cac_payback_months !== null ? `${Math.round(advanced.cac_payback_months)}mo` : '—'}
              sub={advanced.cac_payback_months !== null ? (advanced.cac_payback_months <= 12 ? 'Efficient' : 'Long payback') : undefined}
              color={advanced.cac_payback_months !== null ? (advanced.cac_payback_months <= 12 ? '#10b981' : '#f97316') : undefined}
            />
            <AdvancedKPI
              label="Rule of 40"
              value={advanced.rule_of_40 !== null ? `${advanced.rule_of_40.toFixed(0)}%` : '—'}
              sub={advanced.rule_of_40 !== null ? (advanced.rule_of_40 >= 40 ? '≥40 — excellent' : 'Below 40') : undefined}
              color={advanced.rule_of_40 !== null ? (advanced.rule_of_40 >= 40 ? '#10b981' : advanced.rule_of_40 >= 20 ? '#f59e0b' : '#ef4444') : undefined}
            />
            <AdvancedKPI
              label="Burn Multiple"
              value={advanced.burn_multiple !== null ? advanced.burn_multiple.toFixed(2) + 'x' : '—'}
              sub={advanced.burn_multiple !== null ? (advanced.burn_multiple <= 1 ? 'Efficient' : advanced.burn_multiple <= 2 ? 'Acceptable' : 'Burning fast') : undefined}
              color={advanced.burn_multiple !== null ? (advanced.burn_multiple <= 1 ? '#10b981' : advanced.burn_multiple <= 2 ? '#f59e0b' : '#ef4444') : undefined}
            />
            <AdvancedKPI
              label="Magic Number"
              value={advanced.magic_number !== null ? advanced.magic_number.toFixed(2) : '—'}
              sub={advanced.magic_number !== null ? (advanced.magic_number >= 0.75 ? 'Invest in S&M' : 'Optimize first') : undefined}
              color={advanced.magic_number !== null ? (advanced.magic_number >= 0.75 ? '#10b981' : '#f59e0b') : undefined}
            />
            <AdvancedKPI
              label="Rev / Employee"
              value={advanced.revenue_per_employee !== null ? formatCurrency(advanced.revenue_per_employee, 'USD', true) : '—'}
              sub={advanced.headcount !== null ? `${advanced.headcount} employees` : undefined}
              color="#3b82f6"
            />
          </div>
        )}
      </div>
    </div>
  )
}

function AdvancedKPI({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card">
      <p className="label text-xs mb-1">{label}</p>
      <p className="text-xl font-bold" style={color ? { color } : {}}>{value}</p>
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function getCurrentMonth(): string {
  const now = new Date()
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01'
}

function getPrevMonth(month: string): string {
  const parts = month.split('-').map(Number)
  const d = new Date(parts[0], parts[1] - 2, 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'
}

function getNextMonth(month: string): string {
  const parts = month.split('-').map(Number)
  const d = new Date(parts[0], parts[1], 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'
}

function formatMonthLabel(month: string): string {
  return new Date(month).toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' })
}
