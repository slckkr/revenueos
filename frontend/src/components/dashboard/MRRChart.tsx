'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { formatCurrency, formatMonth } from '@/lib/formatters'
import type { MrrHistoryPoint } from '@/lib/api'

interface MRRChartProps {
  data: MrrHistoryPoint[]
  selectedMonth?: string
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-card text-sm">
      <p className="text-text-secondary mb-2">{formatMonth(label)}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex justify-between gap-4">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-medium text-text-primary">
            {formatCurrency(entry.value, 'USD', true)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function MRRChart({ data, selectedMonth }: MRRChartProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-text-primary">MRR Trend</h2>
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-mrr-green inline-block rounded" />
            MRR
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-mrr-blue inline-block rounded" />
            NRR %
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
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
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="mrr"
            name="MRR"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#mrrGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
