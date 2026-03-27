'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from 'recharts'
import { formatCurrency, formatMonth } from '@/lib/formatters'
import type { MrrHistoryPoint } from '@/lib/api'

interface NetNewMRRChartProps {
  data: MrrHistoryPoint[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-card text-sm min-w-[160px]">
      <p className="text-text-secondary mb-2">{formatMonth(label)}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-mrr-green">New</span>
          <span>{formatCurrency(payload[0]?.payload?.new_mrr || 0, 'USD', true)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-expansion-purple">Expansion</span>
          <span>{formatCurrency(payload[0]?.payload?.expansion_mrr || 0, 'USD', true)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-contraction-orange">Contraction</span>
          <span>{formatCurrency(payload[0]?.payload?.contraction_mrr || 0, 'USD', true)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-churn-red">Churn</span>
          <span>{formatCurrency(payload[0]?.payload?.churned_mrr || 0, 'USD', true)}</span>
        </div>
        <div className="border-t border-border mt-1 pt-1 flex justify-between gap-4 font-medium">
          <span className="text-text-primary">Net New</span>
          <span className={payload[0]?.payload?.net_new_mrr >= 0 ? 'text-mrr-green' : 'text-churn-red'}>
            {formatCurrency(payload[0]?.payload?.net_new_mrr || 0, 'USD', true)}
          </span>
        </div>
      </div>
    </div>
  )
}

export function NetNewMRRChart({ data }: NetNewMRRChartProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-text-primary">Net New MRR</h2>
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          {[
            { color: '#10b981', label: 'New' },
            { color: '#8b5cf6', label: 'Exp' },
            { color: '#f97316', label: 'Con' },
            { color: '#ef4444', label: 'Churn' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm inline-block" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            tick={{ fill: '#666', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v, 'USD', true)}
            tick={{ fill: '#666', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <ReferenceLine y={0} stroke="#333" />
          <Bar dataKey="new_mrr" name="New" stackId="pos" fill="#10b981" radius={[2, 2, 0, 0]} />
          <Bar dataKey="expansion_mrr" name="Expansion" stackId="pos" fill="#8b5cf6" />
          <Bar dataKey="contraction_mrr" name="Contraction" stackId="neg" fill="#f97316" />
          <Bar dataKey="churned_mrr" name="Churn" stackId="neg" fill="#ef4444" radius={[0, 0, 2, 2]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
