'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Zap, ToggleLeft, ToggleRight, Trash2, Clock, Play } from 'lucide-react'
import { api } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type Playbook = {
  id: string
  name: string
  trigger_type: string
  trigger_key: string
  trigger_threshold?: number | null
  recommended_actions_json: string[]
  is_active: boolean
  triggers_30d?: number
  created_at?: string
}

type TriggerLog = {
  id: string
  playbook_id: string
  company_id?: string | null
  trigger_value?: number | null
  fired_at: string
  playbooks?: { name: string; trigger_key: string }
  companies?: { name: string }
}

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  metric_threshold: 'Metric Threshold',
  expansion_signal: 'Expansion Signal',
  health_alert: 'Health Alert',
  renewal_approaching: 'Renewal Approaching',
}

const TRIGGER_TYPE_COLORS: Record<string, string> = {
  metric_threshold: 'text-amber-400 bg-amber-950',
  expansion_signal: 'text-mrr-green bg-emerald-950',
  health_alert: 'text-churn-red bg-red-950',
  renewal_approaching: 'text-blue-400 bg-blue-950',
}

type FormState = {
  name: string
  trigger_type: string
  trigger_key: string
  trigger_threshold: string
  actions: string[]
}

const EMPTY_FORM: FormState = {
  name: '', trigger_type: 'metric_threshold', trigger_key: '',
  trigger_threshold: '', actions: [''],
}

export default function PlaybooksPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'playbooks' | 'history'>('playbooks')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Playbook | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['playbooks'],
    queryFn: () => api.getPlaybooks(),
  })

  const { data: triggersData } = useQuery({
    queryKey: ['playbook-triggers'],
    queryFn: () => api.getPlaybookTriggers(),
    enabled: tab === 'history',
  })

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.createPlaybook(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['playbooks'] }); closeForm() },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => api.updatePlaybook(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['playbooks'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePlaybook(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['playbooks'] }); setDeleteTarget(null) },
  })

  const playbooks: Playbook[] = data?.data || []
  const triggers: TriggerLog[] = triggersData?.data || []

  function closeForm() { setFormOpen(false); setForm(EMPTY_FORM) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const actions = form.actions.filter(a => a.trim())
    if (!form.name || !form.trigger_key || actions.length === 0) return

    createMutation.mutate({
      name: form.name,
      trigger_type: form.trigger_type,
      trigger_key: form.trigger_key,
      trigger_threshold: form.trigger_threshold ? parseFloat(form.trigger_threshold) : null,
      recommended_actions_json: actions,
    })
  }

  function addAction() { setForm(f => ({ ...f, actions: [...f.actions, ''] })) }
  function updateAction(idx: number, val: string) {
    setForm(f => { const a = [...f.actions]; a[idx] = val; return { ...f, actions: a } })
  }
  function removeAction(idx: number) {
    setForm(f => ({ ...f, actions: f.actions.filter((_, i) => i !== idx) }))
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            AI Playbooks
          </h1>
          <p className="text-text-secondary text-sm mt-0.5">Rule-based playbooks that trigger actions when conditions are met</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 bg-mrr-green text-black text-sm font-medium px-3 py-1.5 rounded hover:bg-emerald-400 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Playbook
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded border border-border overflow-hidden w-fit">
        {[{ key: 'playbooks', label: 'Playbooks' }, { key: 'history', label: 'Trigger History' }].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`px-4 py-2 text-sm transition-colors ${tab === key ? 'bg-surface text-text-primary' : 'text-text-muted hover:text-text-secondary'} ${key === 'history' ? 'border-l border-border' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'playbooks' && (
        <>
          {isLoading ? (
            <div className="card p-8 text-center text-text-muted text-sm">Loading playbooks…</div>
          ) : playbooks.length === 0 ? (
            <div className="card p-12 text-center">
              <Zap className="w-8 h-8 mx-auto mb-3 opacity-30 text-text-muted" />
              <p className="text-text-secondary">No playbooks yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {playbooks.map((pb) => (
                <div key={pb.id} className={`card p-4 ${!pb.is_active ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <p className="text-sm font-semibold text-text-primary">{pb.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${TRIGGER_TYPE_COLORS[pb.trigger_type] || 'bg-surface text-text-muted'}`}>
                          {TRIGGER_TYPE_LABELS[pb.trigger_type] || pb.trigger_type}
                        </span>
                        {(pb.triggers_30d ?? 0) > 0 && (
                          <span className="text-xs text-text-muted flex items-center gap-1">
                            <Play className="w-3 h-3" /> {pb.triggers_30d}× this month
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted mb-2">
                        Trigger: <span className="font-mono text-text-secondary">{pb.trigger_key}</span>
                        {pb.trigger_threshold != null && ` (threshold: ${pb.trigger_threshold})`}
                      </p>
                      <div className="space-y-1">
                        {pb.recommended_actions_json.map((action, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-xs text-mrr-green font-bold mt-0.5">{i + 1}.</span>
                            <span className="text-xs text-text-secondary">{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleMutation.mutate({ id: pb.id, is_active: !pb.is_active })}
                        className="text-text-muted hover:text-text-primary transition-colors"
                        title={pb.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {pb.is_active
                          ? <ToggleRight className="w-5 h-5 text-mrr-green" />
                          : <ToggleLeft className="w-5 h-5" />
                        }
                      </button>
                      <button
                        onClick={() => setDeleteTarget(pb)}
                        className="p-1 rounded text-text-muted hover:text-churn-red hover:bg-card transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          {triggers.length === 0 ? (
            <div className="card p-12 text-center">
              <Clock className="w-8 h-8 mx-auto mb-3 opacity-30 text-text-muted" />
              <p className="text-text-secondary">No playbook triggers yet.</p>
            </div>
          ) : (
            triggers.map((t) => (
              <div key={t.id} className="card p-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{t.playbooks?.name || '—'}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
                    <span className="font-mono">{t.playbooks?.trigger_key}</span>
                    {t.companies?.name && <span>· {t.companies.name}</span>}
                    {t.trigger_value != null && <span>· value: {t.trigger_value}</span>}
                  </div>
                </div>
                <span className="text-xs text-text-muted shrink-0">
                  {new Date(t.fired_at).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create form */}
      <Modal open={formOpen} onClose={closeForm} title="New Playbook" width="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label text-xs block mb-1">Name</label>
            <input className="input w-full" placeholder="e.g. Low NRR Alert" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label text-xs block mb-1">Trigger Type</label>
              <select className="select w-full" value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))}>
                {Object.entries(TRIGGER_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs block mb-1">Threshold</label>
              <input type="number" className="input w-full" placeholder="e.g. 100" value={form.trigger_threshold} onChange={e => setForm(f => ({ ...f, trigger_threshold: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label text-xs block mb-1">Trigger Key</label>
            <input className="input w-full font-mono text-sm" placeholder="e.g. nrr_below_100" value={form.trigger_key} onChange={e => setForm(f => ({ ...f, trigger_key: e.target.value }))} required />
          </div>
          <div>
            <label className="label text-xs block mb-1">Recommended Actions</label>
            <div className="space-y-2">
              {form.actions.map((action, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-xs text-mrr-green font-bold mt-2.5">{i + 1}.</span>
                  <input
                    className="input flex-1 text-sm"
                    placeholder="e.g. Schedule QBR with account"
                    value={action}
                    onChange={e => updateAction(i, e.target.value)}
                  />
                  {form.actions.length > 1 && (
                    <button type="button" onClick={() => removeAction(i)} className="text-text-muted hover:text-churn-red mt-0.5">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addAction} className="text-xs text-mrr-green hover:underline">+ Add action</button>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeForm} className="btn-secondary text-sm px-4 py-2">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="bg-mrr-green text-black text-sm font-medium px-4 py-2 rounded hover:bg-emerald-400 disabled:opacity-50">
              {createMutation.isPending ? 'Saving…' : 'Create Playbook'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Playbook"
        message={`Delete "${deleteTarget?.name}"? This will also remove all trigger history.`}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
