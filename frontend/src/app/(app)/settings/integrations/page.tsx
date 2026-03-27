'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, RefreshCw, Loader2, Eye, EyeOff, FileSpreadsheet, Clock } from 'lucide-react'
import { api, Integration } from '@/lib/api'
import { formatRelativeTime } from '@/lib/formatters'
import { SyncStatusBadge } from '@/components/ui/Badge'

const INTEGRATION_META: Record<string, { label: string; description: string; color: string; letter: string }> = {
  hubspot:     { label: 'HubSpot CRM',       description: 'Sync companies, contacts & deals', color: '#ff7a59', letter: 'H' },
  logo:        { label: 'Logo ERP',           description: 'Import e-fatura XML exports',       color: '#1a56db', letter: 'L' },
  trendyol:    { label: 'Trendyol',           description: 'E-commerce revenue sync',           color: '#f27a1a', letter: 'T' },
  woocommerce: { label: 'WooCommerce',        description: 'WordPress store sync',              color: '#96588a', letter: 'W' },
  stripe:      { label: 'Stripe',             description: 'Payment & subscription sync',       color: '#635bff', letter: 'S' },
  salesforce:  { label: 'Salesforce',         description: 'CRM & pipeline sync',               color: '#00a1e0', letter: 'SF'},
}

function StatusPill({ status }: { status: Integration['status'] }) {
  if (status === 'connected')    return <span className="text-xs font-medium text-mrr-green flex items-center gap-1"><CheckCircle className="w-3 h-3" />Connected</span>
  if (status === 'file_import')  return <span className="text-xs font-medium text-blue-400 flex items-center gap-1"><FileSpreadsheet className="w-3 h-3" />File Import</span>
  if (status === 'coming_soon')  return <span className="text-xs font-medium text-text-muted flex items-center gap-1"><Clock className="w-3 h-3" />Coming Soon</span>
  if (status === 'error')        return <span className="text-xs font-medium text-churn-red flex items-center gap-1"><XCircle className="w-3 h-3" />Error</span>
  return <span className="text-xs font-medium text-text-secondary flex items-center gap-1"><XCircle className="w-3 h-3" />Disconnected</span>
}

function IntegrationGrid() {
  const { data } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.getIntegrations(),
    staleTime: 30_000,
  })
  const integrations = data?.data || []

  return (
    <div>
      <h2 className="text-sm font-semibold text-text-primary mb-3">All Integrations</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {integrations.map((int) => {
          const meta = INTEGRATION_META[int.provider] || { label: int.provider, description: '', color: '#666', letter: int.provider[0].toUpperCase() }
          return (
            <div key={int.id} className={`card flex items-start gap-3 ${int.status === 'coming_soon' ? 'opacity-60' : ''}`}>
              <div
                className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: meta.color }}
              >
                {meta.letter}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary text-sm">{meta.label}</p>
                <p className="text-text-muted text-xs mt-0.5 truncate">{meta.description}</p>
                <div className="mt-1.5">
                  <StatusPill status={int.status} />
                </div>
                {int.last_sync_at && (
                  <p className="text-xs text-text-muted mt-0.5">
                    Last sync {formatRelativeTime(int.last_sync_at)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  const qc = useQueryClient()
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.getSettings(),
  })

  const { data: logsData, refetch: refetchLogs } = useQuery({
    queryKey: ['hubspot-logs'],
    queryFn: () => api.getHubSpotLogs(),
    refetchInterval: 10000,
  })

  const { mutate: saveToken, isPending: saving } = useMutation({
    mutationFn: () => api.updateSettings({ hubspot_token: token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setToken('')
    },
  })

  const { mutate: triggerSync, isPending: syncing } = useMutation({
    mutationFn: () => api.syncHubSpot(),
    onSuccess: () => {
      setTimeout(() => refetchLogs(), 2000)
    },
  })

  const settings = settingsData?.data
  const logs = (logsData as any)?.data || []
  const lastLog = logs[0]

  const handleTest = async () => {
    setTestLoading(true)
    setTestResult(null)
    try {
      await api.testHubSpotToken()
      setTestResult({ ok: true, message: 'Token is valid and working.' })
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message })
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Integrations</h1>
        <p className="text-text-secondary text-sm mt-0.5">Connect external data sources</p>
      </div>

      {/* Integration Overview Grid */}
      <IntegrationGrid />

      {/* HubSpot */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#ff7a59] flex items-center justify-center text-white text-sm font-bold">H</div>
          <div>
            <h2 className="font-semibold text-text-primary">HubSpot CRM</h2>
            <div className="flex items-center gap-1.5 text-sm">
              {settings?.hubspot_connected ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-mrr-green" />
                  <span className="text-mrr-green">Connected</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 text-churn-red" />
                  <span className="text-text-secondary">Not connected</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Token input */}
        <div>
          <label className="label block mb-1">Private App Token</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showToken ? 'text' : 'password'}
                className="input w-full pr-10"
                placeholder={settings?.hubspot_connected ? '••••••••• (token saved)' : 'pat-na1-...'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              className="btn-primary"
              onClick={() => saveToken()}
              disabled={!token || saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Create a Private App in HubSpot → Settings → Integrations → Private Apps
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            className="btn-secondary flex items-center gap-2 text-sm"
            onClick={handleTest}
            disabled={!settings?.hubspot_connected || testLoading}
          >
            {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Test Connection
          </button>
          <button
            className="btn-primary flex items-center gap-2 text-sm"
            onClick={() => triggerSync()}
            disabled={!settings?.hubspot_connected || syncing}
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Now
          </button>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 text-sm ${testResult.ok ? 'text-mrr-green' : 'text-churn-red'}`}>
            {testResult.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {testResult.message}
          </div>
        )}

        {/* Sync logs */}
        {logs.length > 0 && (
          <div>
            <p className="label mb-2">Recent syncs</p>
            <div className="space-y-1.5">
              {logs.slice(0, 5).map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <SyncStatusBadge status={log.status} />
                    <span className="text-text-secondary">{formatRelativeTime(log.synced_at)}</span>
                  </div>
                  {log.status === 'done' && (
                    <span className="text-text-muted text-xs">
                      {log.companies_synced} co · {log.contacts_synced} ct · {log.deals_synced} deals
                    </span>
                  )}
                  {log.status === 'error' && (
                    <span className="text-churn-red text-xs">{log.error_message}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
