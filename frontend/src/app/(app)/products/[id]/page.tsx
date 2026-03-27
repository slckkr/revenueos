'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Users, TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, formatMonth } from '@/lib/formatters'
import { SegmentBadge, EventBadge } from '@/components/ui/Badge'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

function MetricBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card">
      <p className="label text-xs mb-1">{label}</p>
      <p className="text-xl font-bold" style={color ? { color } : {}}>{value}</p>
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.getProducts(),
    staleTime: 60_000,
  })

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['product-metrics', id],
    queryFn: () => api.getProductMetrics(id),
    staleTime: 30_000,
  })

  const { data: companiesData } = useQuery({
    queryKey: ['product-companies', id],
    queryFn: () => api.getProductCompanies(id),
    staleTime: 30_000,
  })

  const { data: crossSellData } = useQuery({
    queryKey: ['cross-sell'],
    queryFn: () => api.getCrossSellMatrix(),
    staleTime: 60_000,
  })

  const product = products?.data?.find((p) => p.id === id)
  const metrics = metricsData?.data
  const companies = companiesData?.data || []
  const crossSell = (crossSellData?.data || []).filter(
    (e) => e.product_a_id === id || e.product_b_id === id
  )

  const isLoading = productsLoading || metricsLoading

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-6 w-48 bg-surface rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-20 bg-surface" />
          ))}
        </div>
      </div>
    )
  }

  if (!product) {
    return <div className="p-6"><p className="text-text-secondary">Product not found.</p></div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/products" className="text-text-secondary hover:text-text-primary mt-1.5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <Package className="w-5 h-5 text-mrr-green" />
            <h1 className="text-xl font-bold text-text-primary">{product.name}</h1>
            <span className="text-xs bg-surface border border-border px-2 py-0.5 rounded text-text-muted capitalize">
              {product.billing_period?.replace('_', ' ')}
            </span>
            {product.status && (
              <span className={`text-xs px-2 py-0.5 rounded border ${
                product.status === 'active' ? 'bg-emerald-900 border-emerald-700 text-mrr-green' :
                product.status === 'deprecated' ? 'bg-red-950 border-red-800 text-red-400' :
                'bg-yellow-950 border-yellow-800 text-yellow-400'
              }`}>
                {product.status}
              </span>
            )}
          </div>
          {product.description && (
            <p className="text-sm text-text-secondary mt-1">{product.description}</p>
          )}
        </div>
      </div>

      {/* KPIs */}
      {metrics ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricBox
            label="MRR"
            value={formatCurrency(metrics.mrr, 'USD', true)}
            sub={`ARR ${formatCurrency(metrics.arr, 'USD', true)}`}
            color="#10b981"
          />
          <MetricBox
            label="Active Customers"
            value={String(metrics.active_customers)}
            sub={`ARPA ${formatCurrency(metrics.arpa, 'USD', true)}`}
          />
          <MetricBox
            label="NRR"
            value={`${metrics.nrr.toFixed(1)}%`}
            sub={`GRR ${metrics.grr.toFixed(1)}%`}
            color={metrics.nrr >= 100 ? '#10b981' : metrics.nrr >= 80 ? '#f59e0b' : '#ef4444'}
          />
          <MetricBox
            label="Logo Churn"
            value={`${metrics.logo_churn_rate.toFixed(1)}%`}
            sub={`${metrics.churned_customers} churned this month`}
            color={metrics.logo_churn_rate <= 2 ? '#10b981' : metrics.logo_churn_rate <= 5 ? '#f59e0b' : '#ef4444'}
          />
        </div>
      ) : (
        <div className="card text-center py-8 text-text-secondary text-sm">
          No metrics yet — rebuild the ledger after importing invoices.
        </div>
      )}

      {/* New / Churned this month */}
      {metrics && (metrics.new_customers > 0 || metrics.churned_customers > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-900 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-mrr-green" />
            </div>
            <div>
              <p className="text-xs text-text-muted">New Customers</p>
              <p className="text-xl font-bold text-mrr-green">+{metrics.new_customers}</p>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-950 flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-4 h-4 text-churn-red" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Churned Customers</p>
              <p className="text-xl font-bold text-churn-red">-{metrics.churned_customers}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Companies */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Users className="w-4 h-4 text-text-secondary" />
            <h2 className="font-semibold text-text-primary">Active Companies</h2>
            <span className="ml-auto text-xs text-text-muted">{companies.length}</span>
          </div>
          {companies.length === 0 ? (
            <p className="text-text-secondary text-sm p-4 text-center">No active companies this month</p>
          ) : (
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="table-header">Company</th>
                  <th className="table-header">Segment</th>
                  <th className="table-header text-right">MRR</th>
                  <th className="table-header">Event</th>
                </tr>
              </thead>
              <tbody>
                {companies.slice(0, 10).map((c) => (
                  <tr key={c.company_id} className="border-b border-border hover:bg-surface transition-colors">
                    <td className="table-cell">
                      <Link href={`/companies/${c.company_id}`} className="text-sm text-text-primary hover:text-mrr-green transition-colors">
                        {c.company_name}
                      </Link>
                    </td>
                    <td className="table-cell">
                      <SegmentBadge segment={c.segment as 'SMB' | 'MID' | 'ENT' | null} />
                    </td>
                    <td className="table-cell text-right text-sm font-medium text-mrr-green">
                      {formatCurrency(c.mrr, 'USD', true)}
                    </td>
                    <td className="table-cell">
                      <EventBadge eventType={c.event_type} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Cross-sell opportunities */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-text-primary">Cross-sell Overlap</h2>
            <p className="text-xs text-text-muted mt-0.5">% of this product's customers who also buy another product</p>
          </div>
          {crossSell.length === 0 ? (
            <p className="text-text-secondary text-sm p-4 text-center">
              No cross-sell data — requires multiple products with active customers.
            </p>
          ) : (
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="table-header">Other Product</th>
                  <th className="table-header text-right">Shared</th>
                  <th className="table-header text-right">Overlap %</th>
                </tr>
              </thead>
              <tbody>
                {crossSell.map((e) => {
                  const otherName = e.product_a_id === id ? e.product_b_name : e.product_a_name
                  const otherId = e.product_a_id === id ? e.product_b_id : e.product_a_id
                  return (
                    <tr key={otherId} className="border-b border-border hover:bg-surface transition-colors">
                      <td className="table-cell">
                        <Link href={`/products/${otherId}`} className="text-sm text-text-primary hover:text-mrr-green transition-colors">
                          {otherName}
                        </Link>
                      </td>
                      <td className="table-cell text-right text-sm text-text-secondary">
                        {e.shared_companies}
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-surface rounded-full overflow-hidden">
                            <div
                              className="h-full bg-expansion-purple rounded-full"
                              style={{ width: `${Math.min(e.cross_sell_rate, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-expansion-purple w-10 text-right">
                            {e.cross_sell_rate.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
