'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Pencil, Trash2, FileSignature, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type Contract = {
  id: string; company_id: string; contract_number?: string | null; title?: string | null
  start_date: string; end_date: string; total_value?: number | null; currency: string
  auto_renewal: boolean; renewal_term_months?: number | null; status: string
  signed_date?: string | null; notes?: string | null; created_at?: string
  companies?: { name: string; segment?: string | null }
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  active: 'success', expired: 'error', cancelled: 'error', draft: 'default', renewed: 'warning',
}

type FormState = {
  company_id: string; contract_number: string; title: string
  start_date: string; end_date: string; total_value: string; currency: string
  auto_renewal: boolean; renewal_term_months: string; signed_date: string; notes: string
}
const EMPTY_FORM: FormState = {
  company_id: '', contract_number: '', title: '', start_date: '', end_date: '',
  total_value: '', currency: 'USD', auto_renewal: false, renewal_term_months: '', signed_date: '', notes: '',
}

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

export default function ContractsPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('active')
  const [tab, setTab] = useState<'all' | 'upcoming'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Contract | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', statusFilter],
    queryFn: () => api.getContracts({ status: statusFilter || undefined }),
    placeholderData: (prev) => prev,
    enabled: tab === 'all',
  })

  const { data: upcomingData } = useQuery({
    queryKey: ['contracts-upcoming'],
    queryFn: () => api.getUpcomingRenewals(60),
    enabled: tab === 'upcoming',
  })

  const { data: companiesData } = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => api.getCompanies({ limit: 500 }),
  })

  const contracts = data?.data || []
  const upcoming = upcomingData?.data || []
  const total = data?.meta?.total || 0
  const companies = companiesData?.data || []

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof api.createContract>[0]) => api.createContract(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }); closeForm() },
    onError: (e: Error) => setFormError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateContract>[1] }) => api.updateContract(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }); closeForm() },
    onError: (e: Error) => setFormError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteContract(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }); setDeleteTarget(null) },
  })

  function openCreate() { setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setFormOpen(true) }
  function openEdit(c: Contract) {
    setEditTarget(c)
    setForm({
      company_id: c.company_id, contract_number: c.contract_number || '',
      title: c.title || '', start_date: c.start_date, end_date: c.end_date,
      total_value: c.total_value != null ? String(c.total_value) : '',
      currency: c.currency, auto_renewal: c.auto_renewal,
      renewal_term_months: c.renewal_term_months ? String(c.renewal_term_months) : '',
      signed_date: c.signed_date || '', notes: c.notes || '',
    })
    setFormError(''); setFormOpen(true)
  }
  function closeForm() { setFormOpen(false); setEditTarget(null); setForm(EMPTY_FORM); setFormError('') }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_id) { setFormError('Company is required'); return }
    if (!form.start_date || !form.end_date) { setFormError('Start and end dates are required'); return }
    const payload = {
      company_id: form.company_id, contract_number: form.contract_number || null,
      title: form.title || null, start_date: form.start_date, end_date: form.end_date,
      total_value: form.total_value ? parseFloat(form.total_value) : null,
      currency: form.currency, auto_renewal: form.auto_renewal,
      renewal_term_months: form.renewal_term_months ? parseInt(form.renewal_term_months) : null,
      signed_date: form.signed_date || null, notes: form.notes || null,
    }
    if (editTarget) updateMutation.mutate({ id: editTarget.id, data: payload })
    else createMutation.mutate(payload)
  }

  const isSaving = createMutation.isPending || updateMutation.isPending
  const displayList = tab === 'upcoming' ? upcoming : contracts

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Contracts & Renewals</h1>
          <p className="text-text-secondary text-sm mt-0.5">{tab === 'upcoming' ? `${upcoming.length} renewing within 60 days` : `${total} contracts`}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-mrr-green text-black text-sm font-medium px-3 py-1.5 rounded hover:bg-emerald-400 transition-colors">
          <Plus className="w-4 h-4" /> New Contract
        </button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="flex rounded border border-border overflow-hidden">
          {[{ key: 'all', label: 'All Contracts' }, { key: 'upcoming', label: 'Upcoming Renewals' }].map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key as 'all' | 'upcoming')} className={`px-3 py-1.5 text-xs transition-colors ${tab === key ? 'bg-surface text-text-primary' : 'text-text-muted hover:text-text-secondary'} ${key !== 'all' ? 'border-l border-border' : ''}`}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'all' && (
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {['active', 'draft', 'expired', 'cancelled', 'renewed'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-border">
            <tr>
              <th className="table-header">Contract</th>
              <th className="table-header">Company</th>
              <th className="table-header">Status</th>
              <th className="table-header">Start</th>
              <th className="table-header">End</th>
              {tab === 'upcoming' && <th className="table-header">Days Left</th>}
              <th className="table-header text-right">Value</th>
              <th className="table-header">Renewal</th>
              <th className="table-header w-20" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={9} className="table-cell"><div className="h-4 bg-surface rounded animate-pulse w-full" /></td>
                </tr>
              ))
            ) : displayList.length === 0 ? (
              <tr>
                <td colSpan={9} className="table-cell text-center text-text-secondary py-12">
                  <FileSignature className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  {tab === 'upcoming' ? 'No renewals in the next 60 days' : 'No contracts found'}
                </td>
              </tr>
            ) : (
              displayList.map((c) => {
                const days = daysUntil(c.end_date)
                const isExpiringSoon = days <= 30
                return (
                  <tr key={c.id} className="border-b border-border hover:bg-surface transition-colors group">
                    <td className="table-cell">
                      <div>
                        <p className="text-sm font-medium">{c.contract_number || 'Unnamed'}</p>
                        {c.title && <p className="text-xs text-text-muted">{c.title}</p>}
                      </div>
                    </td>
                    <td className="table-cell">
                      <Link href={`/companies/${c.company_id}`} className="text-sm hover:text-mrr-green">
                        {c.companies?.name}
                      </Link>
                    </td>
                    <td className="table-cell">
                      <Badge variant={STATUS_VARIANT[c.status] || 'default'}>{c.status}</Badge>
                    </td>
                    <td className="table-cell text-text-secondary text-sm">{c.start_date}</td>
                    <td className="table-cell text-sm">
                      <span className={isExpiringSoon && c.status === 'active' ? 'text-amber-400 font-medium' : 'text-text-secondary'}>
                        {c.end_date}
                      </span>
                    </td>
                    {tab === 'upcoming' && (
                      <td className="table-cell">
                        <span className={`flex items-center gap-1 text-sm font-medium ${days <= 14 ? 'text-churn-red' : 'text-amber-400'}`}>
                          {days <= 14 && <AlertTriangle className="w-3.5 h-3.5" />}
                          {days}d
                        </span>
                      </td>
                    )}
                    <td className="table-cell text-right">
                      {c.total_value != null ? <span className="font-semibold text-mrr-green">{formatCurrency(c.total_value, c.currency, true)}</span> : '—'}
                    </td>
                    <td className="table-cell text-text-secondary text-xs">
                      {c.auto_renewal ? `Auto (${c.renewal_term_months || '?'}mo)` : 'Manual'}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-card text-text-muted hover:text-text-primary transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded hover:bg-card text-text-muted hover:text-churn-red transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal open={formOpen} onClose={closeForm} title={editTarget ? 'Edit Contract' : 'New Contract'} width="md">
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
              <label className="label text-xs block mb-1">Contract #</label>
              <input className="input w-full" value={form.contract_number} onChange={(e) => setForm((f) => ({ ...f, contract_number: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Title</label>
              <input className="input w-full" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Start Date <span className="text-churn-red">*</span></label>
              <input type="date" className="input w-full" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">End Date <span className="text-churn-red">*</span></label>
              <input type="date" className="input w-full" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Total Value</label>
              <input type="number" min="0" className="input w-full" value={form.total_value} onChange={(e) => setForm((f) => ({ ...f, total_value: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Currency</label>
              <input className="input w-full" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Signed Date</label>
              <input type="date" className="input w-full" value={form.signed_date} onChange={(e) => setForm((f) => ({ ...f, signed_date: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Renewal Term (months)</label>
              <input type="number" min="1" className="input w-full" value={form.renewal_term_months} onChange={(e) => setForm((f) => ({ ...f, renewal_term_months: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="auto_renewal" checked={form.auto_renewal} onChange={(e) => setForm((f) => ({ ...f, auto_renewal: e.target.checked }))} className="w-4 h-4" />
              <label htmlFor="auto_renewal" className="label text-xs">Auto Renewal</label>
            </div>
            <div className="col-span-2">
              <label className="label text-xs block mb-1">Notes</label>
              <textarea className="input w-full h-16 resize-none" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          {formError && <p className="text-sm text-churn-red">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeForm} className="btn-secondary text-sm px-4 py-2">Cancel</button>
            <button type="submit" disabled={isSaving} className="bg-mrr-green text-black text-sm font-medium px-4 py-2 rounded hover:bg-emerald-400 disabled:opacity-50">
              {isSaving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Contract'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Contract"
        message={`Delete contract "${deleteTarget?.contract_number || deleteTarget?.title || ''}"? This cannot be undone.`}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
