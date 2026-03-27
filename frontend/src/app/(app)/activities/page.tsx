'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Trash2, Phone, Mail, Users, FileText, CheckSquare, Monitor, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type Activity = {
  id: string; company_id: string; contact_id?: string; deal_id?: string
  type: string; subject?: string; description?: string; activity_date: string
  companies?: { name: string }; contacts?: { name: string; email: string }; deals?: { name: string }
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  call: <Phone className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  meeting: <Users className="w-3.5 h-3.5" />,
  note: <FileText className="w-3.5 h-3.5" />,
  task: <CheckSquare className="w-3.5 h-3.5" />,
  demo: <Monitor className="w-3.5 h-3.5" />,
  follow_up: <ArrowRight className="w-3.5 h-3.5" />,
}

const TYPE_COLORS: Record<string, string> = {
  call: 'text-blue-400 bg-blue-950', email: 'text-violet-400 bg-violet-950',
  meeting: 'text-amber-400 bg-amber-950', note: 'text-text-muted bg-surface',
  task: 'text-mrr-green bg-emerald-950', demo: 'text-orange-400 bg-orange-950',
  follow_up: 'text-cyan-400 bg-cyan-950',
}

const TYPES = ['call', 'email', 'meeting', 'note', 'task', 'demo', 'follow_up']

type FormState = {
  company_id: string; contact_id: string; deal_id: string
  type: string; subject: string; description: string; activity_date: string
}
const EMPTY_FORM: FormState = {
  company_id: '', contact_id: '', deal_id: '', type: 'call',
  subject: '', description: '', activity_date: new Date().toISOString().slice(0, 16),
}

function formatActivityDate(d: string) {
  const date = new Date(d)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function ActivitiesPage() {
  const qc = useQueryClient()
  const [typeFilter, setTypeFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['activities', typeFilter, companyFilter],
    queryFn: () => api.getActivities({ type: typeFilter || undefined, company_id: companyFilter || undefined }),
    placeholderData: (prev) => prev,
  })

  const { data: companiesData } = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => api.getCompanies({ limit: 500 }),
  })

  const { data: dealsData } = useQuery({
    queryKey: ['deals-list-open'],
    queryFn: () => api.getDeals({ status: 'open' }),
  })

  const activities = data?.data || []
  const total = data?.meta?.total || 0
  const companies = companiesData?.data || []
  const deals = dealsData?.data || []

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof api.createActivity>[0]) => api.createActivity(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['activities'] }); closeForm() },
    onError: (e: Error) => setFormError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteActivity(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['activities'] }); setDeleteTarget(null) },
  })

  function openCreate() { setForm(EMPTY_FORM); setFormError(''); setFormOpen(true) }
  function closeForm() { setFormOpen(false); setForm(EMPTY_FORM); setFormError('') }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_id) { setFormError('Company is required'); return }
    createMutation.mutate({
      company_id: form.company_id,
      contact_id: form.contact_id || undefined,
      deal_id: form.deal_id || undefined,
      type: form.type,
      subject: form.subject || undefined,
      description: form.description || undefined,
      activity_date: form.activity_date ? new Date(form.activity_date).toISOString() : undefined,
    })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Activities</h1>
          <p className="text-text-secondary text-sm mt-0.5">{total} activities</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-mrr-green text-black text-sm font-medium px-3 py-1.5 rounded hover:bg-emerald-400 transition-colors">
          <Plus className="w-4 h-4" /> Log Activity
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select className="select flex-1 max-w-xs" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
          <option value="">All companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-1 flex-wrap">
          {['', ...TYPES].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${typeFilter === t ? 'border-mrr-green bg-emerald-950 text-mrr-green' : 'border-border text-text-muted hover:text-text-secondary'}`}
            >
              {t && TYPE_ICONS[t]}
              {t ? t.replace('_', ' ') : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-4"><div className="h-4 bg-surface rounded animate-pulse w-3/4" /></div>
          ))
        ) : activities.length === 0 ? (
          <div className="card p-12 text-center">
            <Phone className="w-8 h-8 mx-auto mb-2 opacity-30 text-text-muted" />
            <p className="text-text-secondary">No activities logged yet</p>
          </div>
        ) : (
          activities.map((act) => {
            const colorClass = TYPE_COLORS[act.type] || 'text-text-muted bg-surface'
            return (
              <div key={act.id} className="card p-4 group hover:border-border transition-all">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${colorClass} shrink-0 mt-0.5`}>
                    {TYPE_ICONS[act.type] || <FileText className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {act.subject || act.type.replace('_', ' ')}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Link href={`/companies/${act.company_id}`} className="text-xs text-text-muted hover:text-mrr-green">
                            {act.companies?.name}
                          </Link>
                          {act.contacts?.name && (
                            <span className="text-xs text-text-muted">· {act.contacts.name}</span>
                          )}
                          {act.deals?.name && (
                            <span className="text-xs text-text-muted">· {act.deals.name}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-text-muted">{formatActivityDate(act.activity_date)}</span>
                        <button
                          onClick={() => setDeleteTarget(act)}
                          className="p-1 rounded hover:bg-card text-text-muted hover:text-churn-red transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {act.description && (
                      <p className="text-xs text-text-secondary mt-1 line-clamp-2">{act.description}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <Modal open={formOpen} onClose={closeForm} title="Log Activity" width="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label text-xs block mb-1">Company <span className="text-churn-red">*</span></label>
              <select className="select w-full" value={form.company_id} onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value }))}>
                <option value="">Select company…</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs block mb-1">Type</label>
              <select className="select w-full" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs block mb-1">Date & Time</label>
              <input type="datetime-local" className="input w-full" value={form.activity_date} onChange={(e) => setForm((f) => ({ ...f, activity_date: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label text-xs block mb-1">Subject</label>
              <input className="input w-full" placeholder="e.g. Discovery call with VP Sales" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Linked Deal</label>
              <select className="select w-full" value={form.deal_id} onChange={(e) => setForm((f) => ({ ...f, deal_id: e.target.value }))}>
                <option value="">—</option>
                {deals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label text-xs block mb-1">Description / Notes</label>
              <textarea className="input w-full h-20 resize-none" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          {formError && <p className="text-sm text-churn-red">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeForm} className="btn-secondary text-sm px-4 py-2">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="bg-mrr-green text-black text-sm font-medium px-4 py-2 rounded hover:bg-emerald-400 disabled:opacity-50">
              {createMutation.isPending ? 'Saving…' : 'Log Activity'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Activity"
        message="Delete this activity? This cannot be undone."
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
