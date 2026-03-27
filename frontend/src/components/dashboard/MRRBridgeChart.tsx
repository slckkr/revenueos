'use client'

import {
  ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, CartesianGrid,
} from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import type { MrrBridge } from '@/lib/api'

interface Props {
  data: MrrBridge
}

interface BridgeBar {
  name: string
  value: number
  base: number     // stacked invisible bar to float the real bar
  fill: string
  isTotal?: boolean
}

const COLORS = {
  start:       '#6b7280',
  new:         '#10b981',
  expansion:   '#34d399',
  reactivation:'#6ee7b7',
  contraction: '#f59e0b',
  churn:       '#ef4444',
  end:         '#6b7280',
}

function buildBridgeData(d: MrrBridge): BridgeBar[] {
  let running = d.start_mrr

  const bars: BridgeBar[] = [
    { name: 'Start MRR', value: d.start_mrr, base: 0, fill: COLORS.start, isTotal: true },
  ]

  const addBar = (label: string, amount: number, fill: string) => {
    if (amount === 0) return
    if (amount > 0) {
      bars.push({ name: label, value: amount, base: running, fill })
      running += amount
    } else {
      running += amount // reduce first so the bar sits correctly
      bars.push({ name: label, value: Math.abs(amount), base: running, fill })
    }
  }

  addBar('New', d.new_mrr, COLORS.new)
  addBar('Expansion', d.expansion_mrr, COLORS.expansion)
  addBar('Reactivation', d.reactivation_mrr, COLORS.reactivation)
  addBar('Contraction', d.contraction_mrr, COLORS.contraction)
  addBar('Churn', d.churn_mrr, COLORS.churn)

  bars.push({ name: 'End MRR', value: d.end_mrr, base: 0, fill: COLORS.end, isTotal: true })

  return bars
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null
  const valueBar = payload.find((p: any) => p.dataKey === 'value')
  if (!valueBar) return null

  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-text-primary">{label}</p>
      <p className="text-text-secondary">{formatCurrency(valueBar.value, 'USD')}</p>
    </div>
  )
}

export function MRRBridgeChart({ data }: Props) {
  const bars = buildBridgeData(data)
  const maxVal = Math.max(data.start_mrr, data.end_mrr) * 1.15

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-text-primary">MRR Bridge</h2>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: COLORS.new }} />
            New
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: COLORS.expansion }} />
            Expansion
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: COLORS.contraction }} />
            Contraction
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: COLORS.churn }} />
            Churn
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={bars} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#666', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v, 'USD', true)}
            tick={{ fill: '#666', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
            domain={[0, maxVal]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          {/* Invisible base bar to float the real bar */}
          <Bar dataKey="base" stackId="bridge" fill="transparent" isAnimationActive={false} />
          {/* Actual visible bar */}
          <Bar dataKey="value" stackId="bridge" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {bars.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={entry.isTotal ? 0.6 : 0.9} />
            ))}
          </Bar>
          <ReferenceLine y={0} stroke="#2a2a2a" />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Summary row */}
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
        <div className="text-text-muted">
          Start: <span className="text-text-secondary font-medium">{formatCurrency(data.start_mrr, 'USD', true)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-text-muted">Net change:</span>
          <span className={`font-medium ${data.end_mrr >= data.start_mrr ? 'text-mrr-green' : 'text-churn-red'}`}>
            {data.end_mrr >= data.start_mrr ? '+' : ''}{formatCurrency(data.end_mrr - data.start_mrr, 'USD', true)}
          </span>
        </div>
        <div className="text-text-muted">
          End: <span className="text-text-secondary font-medium">{formatCurrency(data.end_mrr, 'USD', true)}</span>
        </div>
      </div>
    </div>
  )
}
