'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Pencil, Trash2, FileText, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type Proposal = {
  id: string; company_id: string; deal_id?: string | null; proposal_number?: string | null; title?: string | null
  amount?: number | null; currency: string; status: string; sent_date?: string | null; expiry_date?: string | null
  accepted_date?: string | null; notes?: string | null; created_at?: string
  companies?: { name: string }; deals?: { name: string } | null
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  accepted: 'success', sent: 'info', viewed: 'info', draft: 'default', rejected: 'error', expired: 'warning',
}

const STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired']

type FormState = {
  company_id: string; deal_id: string; title: string; amount: string; currency: string
  expiry_date: string; notes: string
}
const EMPTY_FORM: FormState = { company_id: '', deal_id: '', title: '', amount: '', currency: 'USD', expiry_date: '', notes: '' }

export default function ProposalsPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Proposal | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Proposal | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [statusEdit, setStatusEdit] = useState<{ id: string; status: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['proposals', statusFilter],
    queryFn: () => api.getProposals({ status: statusFilter || undefined }),
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

  const proposals = data?.data || []
  const total = data?.meta?.total || 0
  const companies = companiesData?.data || []
  const deals = dealsData?.data || []

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof api.createProposal>[0]) => api.createProposal(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proposals'] }); closeForm() },
    onError: (e: Error) => setFormError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateProposal>[1] }) => api.updateProposal(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proposals'] }); setStatusEdit(null); closeForm() },
    onError: (e: Error) => setFormError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProposal(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proposals'] }); setDeleteTarget(null) },
  })
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.bulkDeleteProposals(ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proposals'] }); setSelectedIds(new Set()); setBulkDeleteOpen(false) },
  })
  function toggleSelect(id: string) { setSelectedIds((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s }) }
  function toggleSelectAll() { setSelectedIds(selectedIds.size === proposals.length && proposals.length > 0 ? new Set() : new Set(proposals.map((p) => p.id))) }

  function openCreate() { setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setFormOpen(true) }
  function openEdit(p: Proposal) {
    setEditTarget(p)
    setForm({
      company_id: p.company_id, deal_id: p.deal_id || '', title: p.title || '',
      amount: p.amount != null ? String(p.amount) : '', currency: p.currency,
      expiry_date: p.expiry_date || '', notes: p.notes || '',
    })
    setFormError(''); setFormOpen(true)
  }
  function closeForm() { setFormOpen(false); setEditTarget(null); setForm(EMPTY_FORM); setFormError('') }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_id) { setFormError('Company is required'); return }
    const payload = {
      company_id: form.company_id, deal_id: form.deal_id || null, title: form.title || null,
      amount: form.amount ? parseFloat(form.amount) : null, currency: form.currency,
      expiry_date: form.expiry_date || null, notes: form.notes || null,
    }
    if (editTarget) updateMutation.mutate({ id: editTarget.id, data: payload })
    else createMutation.mutate(payload)
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Proposals</h1>
          <p className="text-text-secondary text-sm mt-0.5">{total} proposals</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button onClick={() => setBulkDeleteOpen(true)} className="flex items-center gap-2 bg-churn-red text-white text-sm font-medium px-3 py-1.5 rounded hover:bg-red-600 transition-colors">
              <Trash2 className="w-4 h-4" /> Delete ({selectedIds.size})
            </button>
          )}
          <button onClick={openCreate} className="flex items-center gap-2 bg-mrr-green text-black text-sm font-medium px-3 py-1.5 rounded hover:bg-emerald-400 transition-colors">
            <Plus className="w-4 h-4" /> New Proposal
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex gap-1 flex-wrap">
          {['', ...STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${statusFilter === s ? 'border-mrr-green bg-emerald-950 text-mrr-green' : 'border-border text-text-muted hover:text-text-secondary'}`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-border">
            <tr>
              <th className="table-header w-10"><input type="checkbox" className="rounded" checked={selectedIds.size === proposals.length && proposals.length > 0} onChange={toggleSelectAll} /></th>
              <th className="table-header">Proposal #</th>
              <th className="table-header">Company</th>
              <th className="table-header">Deal</th>
              <th className="table-header">Status</th>
              <th className="table-header text-right">Amount</th>
              <th className="table-header">Expiry</th>
              <th className="table-header w-24" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={8} className="table-cell"><div className="h-4 bg-surface rounded animate-pulse w-full" /></td>
                </tr>
              ))
            ) : proposals.length === 0 ? (
              <tr>
                <td colSpan={8} className="table-cell text-center text-text-secondary py-12">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No proposals yet
                </td>
              </tr>
            ) : (
              proposals.map((p) => (
                <tr key={p.id} className={`border-b border-border hover:bg-surface transition-colors group ${selectedIds.has(p.id) ? 'bg-surface' : ''}`}>
                  <td className="table-cell w-10"><input type="checkbox" className="rounded" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                  <td className="table-cell font-medium text-sm">{p.proposal_number || '—'}</td>
                  <td className="table-cell">
                    <Link href={`/companies/${p.company_id}`} className="text-sm hover:text-mrr-green transition-colors">
                      {p.companies?.name}
                    </Link>
                  </td>
                  <td className="table-cell text-text-secondary text-sm">{p.deals?.name || '—'}</td>
                  <td className="table-cell">
                    {statusEdit?.id === p.id ? (
                      <div className="flex items-center gap-1">
                        <select
                          className="select text-xs py-0.5"
                          value={statusEdit.status}
                          onChange={(e) => setStatusEdit({ id: p.id, status: e.target.value })}
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button
                          onClick={() => updateMutation.mutate({ id: p.id, data: { status: statusEdit.status } })}
                          className="text-xs text-mrr-green hover:underline"
                        >Save</button>
                        <button onClick={() => setStatusEdit(null)} className="text-xs text-text-muted hover:underline">×</button>
                      </div>
                    ) : (
                      <button onClick={() => setStatusEdit({ id: p.id, status: p.status })} className="hover:opacity-80">
                        <Badge variant={STATUS_VARIANT[p.status] || 'default'}>{p.status}</Badge>
                      </button>
                    )}
                  </td>
                  <td className="table-cell text-right">
                    {p.amount != null ? <span className="font-semibold text-mrr-green">{formatCurrency(p.amount, p.currency, true)}</span> : '—'}
                  </td>
                  <td className="table-cell text-text-secondary text-sm">{p.expiry_date || '—'}</td>
                  <td className="table-cell">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-card text-text-muted hover:text-text-primary transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded hover:bg-card text-text-muted hover:text-churn-red transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={formOpen} onClose={closeForm} title={editTarget ? `Edit Proposal` : 'New Proposal'} width="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label text-xs block mb-1">Company <span className="text-churn-red">*</span></label>
              <select className="select w-full" value={form.company_id} onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value }))}>
                <option value="">Select company…</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label text-xs block mb-1">Title</label>
              <input className="input w-full" placeholder="e.g. Enterprise Plan Proposal" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Linked Deal</label>
              <select className="select w-full" value={form.deal_id} onChange={(e) => setForm((f) => ({ ...f, deal_id: e.target.value }))}>
                <option value="">—</option>
                {deals.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.companies?.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs block mb-1">Amount</label>
              <input type="number" min="0" className="input w-full" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Expiry Date</label>
              <input type="date" className="input w-full" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Currency</label>
              <input className="input w-full" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
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
              {isSaving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Proposal'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Proposal"
        message={`Delete proposal ${deleteTarget?.proposal_number || ''}? This cannot be undone.`}
        loading={deleteMutation.isPending}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate([...selectedIds])}
        title="Delete Selected Proposals"
        message={`Delete ${selectedIds.size} selected proposals? This cannot be undone.`}
        loading={bulkDeleteMutation.isPending}
      />
    </div>
  )
}
