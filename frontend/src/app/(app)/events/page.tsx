'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Check, X, TrendingUp } from 'lucide-react'
import { api, RevenueEvent } from '@/lib/api'
import { formatCurrency, formatMonth } from '@/lib/formatters'
import { EventBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

const EVENT_TYPES = ['NEW', 'EXPANSION', 'CONTRACTION', 'CHURN', 'REACTIVATION', 'PRICE_INCREASE']

type FormState = {
  company_id: string
  product_id: string
  month: string
  event_type: string
  mrr_impact: string
  prev_mrr: string
}

const EMPTY_FORM: FormState = {
  company_id: '', product_id: '', month: '', event_type: 'NEW', mrr_impact: '', prev_mrr: '0',
}

type EditState = {
  event_type: string
  mrr_impact: string
  prev_mrr: string
}

export default function EventsPage() {
  const qc = useQueryClient()
  const [monthFilter, setMonthFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState('')

  const [editId, setEditId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ event_type: '', mrr_impact: '', prev_mrr: '' })

  const [deleteTarget, setDeleteTarget] = useState<RevenueEvent | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['revenue-events', monthFilter, companyFilter, typeFilter, page],
    queryFn: () => api.getRevenueEvents({
      month: monthFilter || undefined,
      company_id: companyFilter || undefined,
      event_type: typeFilter || undefined,
      page,
    }),
    placeholderData: (prev) => prev,
  })

  const { data: companiesData } = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => api.getCompanies({ limit: 500 }),
  })

  const events = data?.data || []
  const total = data?.meta?.total || 0
  const totalPages = Math.ceil(total / 100)
  const companies = companiesData?.data || []

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof api.createRevenueEvent>[0]) => api.createRevenueEvent(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['revenue-events'] }); closeForm() },
    onError: (e: Error) => setFormError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateRevenueEvent>[1] }) =>
      api.updateRevenueEvent(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['revenue-events'] }); setEditId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteRevenueEvent(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['revenue-events'] }); setDeleteTarget(null) },
  })
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.bulkDeleteRevenueEvents(ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['revenue-events'] }); setSelectedIds(new Set()); setBulkDeleteOpen(false) },
  })
  function toggleSelect(id: string) { setSelectedIds((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s }) }
  function toggleSelectAll() { setSelectedIds(selectedIds.size === events.length && events.length > 0 ? new Set() : new Set(events.map((e) => e.id))) }

  function openCreate() {
    setForm(EMPTY_FORM); setFormError(''); setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false); setForm(EMPTY_FORM); setFormError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_id) { setFormError('Company is required'); return }
    if (!form.month) { setFormError('Month is required'); return }
    if (!form.mrr_impact) { setFormError('MRR Impact is required'); return }
    createMutation.mutate({
      company_id: form.company_id,
      product_id: form.product_id || undefined,
      month: form.month.length === 7 ? `${form.month}-01` : form.month,
      event_type: form.event_type,
      mrr_impact: parseFloat(form.mrr_impact),
      prev_mrr: parseFloat(form.prev_mrr || '0'),
    })
  }

  function startEdit(ev: RevenueEvent) {
    setEditId(ev.id)
    setEditState({
      event_type: ev.event_type,
      mrr_impact: String(ev.mrr_impact),
      prev_mrr: String(ev.prev_mrr),
    })
  }

  function saveEdit(id: string) {
    updateMutation.mutate({
      id,
      data: {
        event_type: editState.event_type,
        mrr_impact: parseFloat(editState.mrr_impact),
        prev_mrr: parseFloat(editState.prev_mrr),
      },
    })
  }

  const impactColor = (v: number) =>
    v > 0 ? 'text-mrr-green' : v < 0 ? 'text-churn-red' : 'text-text-muted'

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Revenue Events</h1>
          <p className="text-text-secondary text-sm mt-0.5">{total} events</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-mrr-green text-black text-sm font-medium px-3 py-1.5 rounded hover:bg-emerald-400 transition-colors">
          <Plus className="w-4 h-4" /> New Event
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="month"
          className="input"
          value={monthFilter}
          onChange={(e) => { setMonthFilter(e.target.value); setPage(1) }}
          placeholder="Filter by month"
        />
        <select
          className="select flex-1 max-w-xs"
          value={companyFilter}
          onChange={(e) => { setCompanyFilter(e.target.value); setPage(1) }}
        >
          <option value="">All companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="select" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}>
          <option value="">All event types</option>
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {(monthFilter || companyFilter || typeFilter) && (
          <button
            className="btn-secondary text-xs px-3"
            onClick={() => { setMonthFilter(''); setCompanyFilter(''); setTypeFilter(''); setPage(1) }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-border">
            <tr>
              <th className="table-header w-10"><input type="checkbox" className="rounded" checked={selectedIds.size === events.length && events.length > 0} onChange={toggleSelectAll} /></th>
              <th className="table-header">Month</th>
              <th className="table-header">Company</th>
              <th className="table-header">Product</th>
              <th className="table-header">Event</th>
              <th className="table-header text-right">MRR Impact</th>
              <th className="table-header text-right">Prev MRR</th>
              <th className="table-header text-right">New MRR</th>
              <th className="table-header w-24" />
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={9} className="table-cell">
                    <div className="h-4 bg-surface rounded animate-pulse w-full" />
                  </td>
                </tr>
              ))
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={9} className="table-cell text-center text-text-secondary py-12">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No events found. Import data and rebuild the ledger, or add events manually.
                </td>
              </tr>
            ) : (
              events.map((ev) => {
                const isEditing = editId === ev.id
                return (
                  <tr key={ev.id} className={`border-b border-border hover:bg-surface transition-colors group ${selectedIds.has(ev.id) ? 'bg-surface' : ''}`}>
                    <td className="table-cell w-10"><input type="checkbox" className="rounded" checked={selectedIds.has(ev.id)} onChange={() => toggleSelect(ev.id)} /></td>
                    <td className="table-cell font-medium text-sm">{formatMonth(ev.month)}</td>
                    <td className="table-cell text-sm">{ev.companies?.name || ev.company_id}</td>
                    <td className="table-cell text-text-secondary text-sm">{ev.products?.name || '—'}</td>
                    <td className="table-cell">
                      {isEditing ? (
                        <select
                          className="select text-xs py-0.5 px-1.5"
                          value={editState.event_type}
                          onChange={(e) => setEditState((s) => ({ ...s, event_type: e.target.value }))}
                        >
                          {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      ) : (
                        <EventBadge eventType={ev.event_type} />
                      )}
                    </td>
                    <td className="table-cell text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          className="input text-xs py-0.5 w-28 text-right"
                          value={editState.mrr_impact}
                          onChange={(e) => setEditState((s) => ({ ...s, mrr_impact: e.target.value }))}
                        />
                      ) : (
                        <span className={`font-medium text-sm ${impactColor(ev.mrr_impact)}`}>
                          {ev.mrr_impact >= 0 ? '+' : ''}{formatCurrency(ev.mrr_impact, 'USD', true)}
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          className="input text-xs py-0.5 w-28 text-right"
                          value={editState.prev_mrr}
                          onChange={(e) => setEditState((s) => ({ ...s, prev_mrr: e.target.value }))}
                        />
                      ) : (
                        <span className="text-text-secondary text-sm">{formatCurrency(ev.prev_mrr, 'USD', true)}</span>
                      )}
                    </td>
                    <td className="table-cell text-right text-sm">{formatCurrency(ev.new_mrr, 'USD', true)}</td>
                    <td className="table-cell">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => saveEdit(ev.id)}
                            disabled={updateMutation.isPending}
                            className="p-1.5 rounded hover:bg-card text-mrr-green transition-colors"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="p-1.5 rounded hover:bg-card text-text-muted hover:text-text-primary transition-colors"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(ev)}
                            className="p-1.5 rounded hover:bg-card text-text-muted hover:text-text-primary transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(ev)}
                            className="p-1.5 rounded hover:bg-card text-text-muted hover:text-churn-red transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <span className="text-sm text-text-secondary">Page {page} of {totalPages} · {total} events</span>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs px-3 py-1" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                Previous
              </button>
              <button className="btn-secondary text-xs px-3 py-1" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Event Modal */}
      <Modal open={formOpen} onClose={closeForm} title="New Revenue Event">
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
              <label className="label text-xs block mb-1">Month <span className="text-churn-red">*</span></label>
              <input type="month" className="input w-full" value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Event Type</label>
              <select className="select w-full" value={form.event_type} onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))}>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs block mb-1">MRR Impact ($) <span className="text-churn-red">*</span></label>
              <input type="number" className="input w-full" placeholder="e.g. 500 or -200" value={form.mrr_impact} onChange={(e) => setForm((f) => ({ ...f, mrr_impact: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Prev MRR ($)</label>
              <input type="number" min="0" className="input w-full" value={form.prev_mrr} onChange={(e) => setForm((f) => ({ ...f, prev_mrr: e.target.value }))} />
            </div>
          </div>
          {formError && <p className="text-sm text-churn-red">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeForm} className="btn-secondary text-sm px-4 py-2">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="bg-mrr-green text-black text-sm font-medium px-4 py-2 rounded hover:bg-emerald-400 transition-colors disabled:opacity-50">
              {createMutation.isPending ? 'Saving…' : 'Create Event'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Event"
        message={`Delete this ${deleteTarget?.event_type} event for ${deleteTarget?.companies?.name || 'this company'}? This action cannot be undone. You can re-derive events by rebuilding the ledger.`}
        loading={deleteMutation.isPending}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate([...selectedIds])}
        title="Delete Selected Events"
        message={`Delete ${selectedIds.size} selected events? This cannot be undone.`}
        loading={bulkDeleteMutation.isPending}
      />
    </div>
  )
}
