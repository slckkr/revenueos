'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, RefreshCw, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

export default function SettingsPage() {
  const qc = useQueryClient()
  const [rebuildFrom, setRebuildFrom] = useState('')
  const [rebuildTo, setRebuildTo] = useState('')
  const [rebuildResult, setRebuildResult] = useState<string | null>(null)
  const [rebuildLoading, setRebuildLoading] = useState(false)

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.getSettings(),
  })

  const { mutate: updateSettings } = useMutation({
    mutationFn: (data: any) => api.updateSettings(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  const settings = settingsData?.data

  const handleRebuild = async () => {
    if (!rebuildFrom || !rebuildTo) return
    setRebuildLoading(true)
    setRebuildResult(null)
    try {
      const res = await api.rebuildLedger(rebuildFrom, rebuildTo) as any
      setRebuildResult(res?.data?.message || 'Done')
    } catch (err: any) {
      setRebuildResult(`Error: ${err.message}`)
    } finally {
      setRebuildLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary text-sm mt-0.5">Configure RevenueOS</p>
      </div>

      {/* Revenue Settings */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-text-primary">Revenue Settings</h2>

        <div>
          <label className="label block mb-1">Reporting Currency</label>
          <select
            className="select w-full"
            value={settings?.reporting_currency || 'USD'}
            onChange={(e) => updateSettings({ reporting_currency: e.target.value })}
          >
            {['USD', 'EUR', 'GBP', 'TRY', 'CHF'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <p className="text-xs text-text-muted mt-1">All metrics will be shown in this currency</p>
        </div>

        <div>
          <label className="label block mb-1">Recognition Method</label>
          <select
            className="select w-full"
            value={settings?.recognition_method || 'accrual'}
            onChange={(e) => updateSettings({ recognition_method: e.target.value })}
          >
            <option value="accrual">Accrual (spread over service period)</option>
            <option value="cash">Cash (recognize on invoice date)</option>
          </select>
        </div>
      </div>

      {/* Rebuild Ledger */}
      <div className="card space-y-4">
        <div>
          <h2 className="font-semibold text-text-primary">Rebuild Revenue Ledger</h2>
          <p className="text-text-secondary text-sm mt-0.5">
            Re-processes all invoices and recalculates metrics for the selected date range.
            Run this after importing new data.
          </p>
        </div>

        <div className="flex gap-3 items-end">
          <div>
            <label className="label block mb-1">From Month</label>
            <input
              type="month"
              className="input"
              value={rebuildFrom}
              onChange={(e) => setRebuildFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="label block mb-1">To Month</label>
            <input
              type="month"
              className="input"
              value={rebuildTo}
              onChange={(e) => setRebuildTo(e.target.value)}
            />
          </div>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={handleRebuild}
            disabled={!rebuildFrom || !rebuildTo || rebuildLoading}
          >
            {rebuildLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Rebuild
          </button>
        </div>

        {rebuildResult && (
          <p className={`text-sm ${rebuildResult.startsWith('Error') ? 'text-churn-red' : 'text-mrr-green'}`}>
            {rebuildResult}
          </p>
        )}
      </div>

      {/* HubSpot is on integrations page */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-text-primary">HubSpot Integration</h2>
            <p className="text-text-secondary text-sm mt-0.5">
              {settings?.hubspot_connected ? 'Connected' : 'Not configured'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {settings?.hubspot_connected ? (
              <CheckCircle className="w-5 h-5 text-mrr-green" />
            ) : (
              <XCircle className="w-5 h-5 text-churn-red" />
            )}
            <a href="/settings/integrations" className="btn-secondary text-xs">
              Configure
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
