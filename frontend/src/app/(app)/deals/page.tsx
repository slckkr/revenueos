'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Pencil, Trash2, LayoutGrid, List, TrendingUp, Target, Clock, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { SegmentBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type Deal = {
  id: string; company_id: string; name: string; stage: string; amount?: number | null
  currency: string; probability?: number | null; expected_close_date?: string | null
  actual_close_date?: string | null; deal_type?: string | null; status: string; notes?: string | null
  product_id?: string | null; companies?: { name: string; segment?: string | null }; products?: { name: string } | null
}

type FormState = {
  company_id: string; name: string; stage: string; amount: string; currency: string
  probability: string; expected_close_date: string; deal_type: string; product_id: string; notes: string
}

const EMPTY_FORM: FormState = {
  company_id: '', name: '', stage: 'lead', amount: '', currency: 'USD',
  probability: '', expected_close_date: '', deal_type: '', product_id: '', notes: '',
}

const PAGE_SIZES = [25, 50, 100, 200]

const STAGES = [
  { key: 'lead', label: 'Lead', color: 'bg-slate-500' },
  { key: 'mql', label: 'MQL', color: 'bg-blue-500' },
  { key: 'sql', label: 'SQL', color: 'bg-violet-500' },
  { key: 'opportunity', label: 'Opportunity', color: 'bg-amber-500' },
  { key: 'negotiation', label: 'Negotiation', color: 'bg-orange-500' },
]

const STAGE_TEXT: Record<string, string> = {
  lead: 'text-slate-400', mql: 'text-blue-400', sql: 'text-violet-400',
  opportunity: 'text-amber-400', negotiation: 'text-orange-400', won: 'text-mrr-green', lost: 'text-churn-red',
}

export default function DealsPage() {
  const qc = useQueryClient()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [statusFilter, setStatusFilter] = useState('open')
  const [stageFilter, setStageFilter] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Deal | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Deal | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const { data: pipelineData } = useQuery({
    queryKey: ['deals-pipeline'],
    queryFn: () => api.getDealsPipeline(),
    enabled: view === 'kanban',
  })

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['deals-list', statusFilter, stageFilter, page, limit],
    queryFn: () => api.getDeals({ status: statusFilter || undefined, stage: stageFilter || undefined, page, limit }),
    enabled: view === 'list',
  })

  const { data: companiesData } = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => api.getCompanies({ limit: 500 }),
  })

  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.getProducts(),
  })

  const pipeline = pipelineData?.data || {}
  const pipelineMetrics = pipelineData?.metrics
  const listDeals = listData?.data || []
  const listTotal = listData?.meta?.total || 0
  const companies = companiesData?.data || []
  const products = productsData?.data || []

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof api.createDeal>[0]) => api.createDeal(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals'] }); closeForm() },
    onError: (e: Error) => setFormError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateDeal>[1] }) => api.updateDeal(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals'] }); closeForm() },
    onError: (e: Error) => setFormError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDeal(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals'] }); setDeleteTarget(null) },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.bulkDeleteDeals(ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals'] }); setSelectedIds(new Set()); setBulkDeleteOpen(false) },
  })
  function toggleSelect(id: string) { setSelectedIds((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s }) }
  function toggleSelectAll() { setSelectedIds(selectedIds.size === listDeals.length && listDeals.length > 0 ? new Set() : new Set(listDeals.map((d) => d.id))) }

  function openCreate() { setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setFormOpen(true) }
  function openEdit(d: Deal) {
    setEditTarget(d)
    setForm({
      company_id: d.company_id, name: d.name, stage: d.stage,
      amount: d.amount != null ? String(d.amount) : '', currency: d.currency,
      probability: d.probability != null ? String(d.probability) : '',
      expected_close_date: d.expected_close_date || '', deal_type: d.deal_type || '',
      product_id: d.product_id || '', notes: d.notes || '',
    })
    setFormError('')
    setFormOpen(true)
  }
  function closeForm() { setFormOpen(false); setEditTarget(null); setForm(EMPTY_FORM); setFormError('') }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_id) { setFormError('Company is required'); return }
    if (!form.name.trim()) { setFormError('Deal name is required'); return }
    const payload = {
      company_id: form.company_id, name: form.name.trim(), stage: form.stage,
      amount: form.amount ? parseFloat(form.amount) : null,
      currency: form.currency, probability: form.probability ? parseFloat(form.probability) : null,
      expected_close_date: form.expected_close_date || null,
      deal_type: form.deal_type || null, product_id: form.product_id || null, notes: form.notes || null,
    }
    if (editTarget) updateMutation.mutate({ id: editTarget.id, data: payload })
    else createMutation.mutate(payload)
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Deals & Pipeline</h1>
          {pipelineMetrics && (
            <p className="text-text-secondary text-sm mt-0.5">
              {pipelineMetrics.open_deals} open · {pipelineMetrics.win_rate}% win rate
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-border overflow-hidden">
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors ${view === 'kanban' ? 'bg-surface text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}>
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban
            </button>
            <button onClick={() => setView('list')} className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors border-l border-border ${view === 'list' ? 'bg-surface text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}>
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
          {selectedIds.size > 0 && view === 'list' && (
            <button onClick={() => setBulkDeleteOpen(true)} className="flex items-center gap-2 bg-churn-red text-white text-sm font-medium px-3 py-1.5 rounded hover:bg-red-600 transition-colors">
              <Trash2 className="w-4 h-4" /> Delete ({selectedIds.size})
            </button>
          )}
          <button onClick={openCreate} className="flex items-center gap-2 bg-mrr-green text-black text-sm font-medium px-3 py-1.5 rounded hover:bg-emerald-400 transition-colors">
            <Plus className="w-4 h-4" /> New Deal
          </button>
        </div>
      </div>

      {/* Pipeline Metrics */}
      {pipelineMetrics && view === 'kanban' && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: DollarSign, label: 'Weighted Pipeline', value: formatCurrency(pipelineMetrics.weighted_pipeline, 'USD', true), color: 'text-mrr-green' },
            { icon: Target, label: 'Win Rate', value: `${pipelineMetrics.win_rate}%`, color: 'text-blue-400' },
            { icon: TrendingUp, label: 'Avg Deal Size', value: formatCurrency(pipelineMetrics.avg_deal_size, 'USD', true), color: 'text-violet-400' },
            { icon: Clock, label: 'Open Deals', value: String(pipelineMetrics.open_deals), color: 'text-amber-400' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color} shrink-0`} />
              <div>
                <p className="text-xs text-text-muted">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const col = pipeline[stage.key] || { deals: [], total_value: 0, count: 0 }
            return (
              <div key={stage.key} className="flex-shrink-0 w-72">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                    <span className="text-sm font-medium text-text-primary">{stage.label}</span>
                    <span className="text-xs text-text-muted bg-surface px-1.5 py-0.5 rounded">{col.count}</span>
                  </div>
                  <span className="text-xs text-text-muted">{formatCurrency(col.total_value, 'USD', true)}</span>
                </div>
                <div className="space-y-2">
                  {(col.deals as Deal[]).map((deal) => (
                    <div key={deal.id} className="card p-3 group hover:border-border transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{deal.name}</p>
                          <Link href={`/companies/${deal.company_id}`} className="text-xs text-text-muted hover:text-mrr-green">
                            {deal.companies?.name}
                          </Link>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => openEdit(deal)} className="p-1 rounded hover:bg-card text-text-muted hover:text-text-primary transition-colors">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => setDeleteTarget(deal)} className="p-1 rounded hover:bg-card text-text-muted hover:text-churn-red transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {deal.amount != null && (
                        <p className="text-sm font-semibold text-mrr-green mt-1">{formatCurrency(deal.amount, deal.currency, true)}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        {deal.probability != null && (
                          <span className="text-xs text-text-muted">{deal.probability}%</span>
                        )}
                        {deal.expected_close_date && (
                          <span className="text-xs text-text-muted">{deal.expected_close_date}</span>
                        )}
                        {deal.companies?.segment && <SegmentBadge segment={deal.companies.segment} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <>
          <div className="flex gap-3">
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
            <select className="select" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
              <option value="">All stages</option>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="table-header w-10"><input type="checkbox" className="rounded" checked={selectedIds.size === listDeals.length && listDeals.length > 0} onChange={toggleSelectAll} /></th>
                  <th className="table-header">Deal</th>
                  <th className="table-header">Company</th>
                  <th className="table-header">Stage</th>
                  <th className="table-header text-right">Amount</th>
                  <th className="table-header text-right">Prob.</th>
                  <th className="table-header">Close Date</th>
                  <th className="table-header w-20" />
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td colSpan={8} className="table-cell"><div className="h-4 bg-surface rounded animate-pulse w-full" /></td>
                    </tr>
                  ))
                ) : listDeals.length === 0 ? (
                  <tr><td colSpan={8} className="table-cell text-center text-text-secondary py-10">No deals found</td></tr>
                ) : (
                  listDeals.map((deal) => (
                    <tr key={deal.id} className={`border-b border-border hover:bg-surface transition-colors group ${selectedIds.has(deal.id) ? 'bg-surface' : ''}`}>
                      <td className="table-cell w-10"><input type="checkbox" className="rounded" checked={selectedIds.has(deal.id)} onChange={() => toggleSelect(deal.id)} /></td>
                      <td className="table-cell font-medium">{deal.name}</td>
                      <td className="table-cell">
                        <Link href={`/companies/${deal.company_id}`} className="text-text-secondary hover:text-mrr-green text-sm">
                          {deal.companies?.name}
                        </Link>
                      </td>
                      <td className="table-cell">
                        <span className={`text-xs font-medium uppercase ${STAGE_TEXT[deal.stage] || 'text-text-muted'}`}>{deal.stage}</span>
                      </td>
                      <td className="table-cell text-right">
                        {deal.amount != null ? <span className="font-semibold text-mrr-green">{formatCurrency(deal.amount, deal.currency, true)}</span> : '—'}
                      </td>
                      <td className="table-cell text-right text-text-secondary text-sm">{deal.probability != null ? `${deal.probability}%` : '—'}</td>
                      <td className="table-cell text-text-secondary text-sm">{deal.expected_close_date || '—'}</td>
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(deal)} className="p-1.5 rounded hover:bg-card text-text-muted hover:text-text-primary transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setDeleteTarget(deal)} className="p-1.5 rounded hover:bg-card text-text-muted hover:text-churn-red transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {(() => {
              const totalPages = Math.ceil(listTotal / limit)
              return (
                <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-text-secondary">{listTotal} deals</span>
                    <select className="select text-xs py-0.5 px-2 h-7" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>
                      {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
                    </select>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">Page {page} of {totalPages}</span>
                      <button className="btn-secondary text-xs px-3 py-1 flex items-center gap-1" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                        <ChevronLeft className="w-3 h-3" /> Prev
                      </button>
                      <button className="btn-secondary text-xs px-3 py-1 flex items-center gap-1" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                        Next <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </>
      )}

      {/* Create / Edit Modal */}
      <Modal open={formOpen} onClose={closeForm} title={editTarget ? `Edit — ${editTarget.name}` : 'New Deal'} width="md">
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
              <label className="label text-xs block mb-1">Deal Name <span className="text-churn-red">*</span></label>
              <input className="input w-full" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Stage</label>
              <select className="select w-full" value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}>
                {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <div>
              <label className="label text-xs block mb-1">Deal Type</label>
              <input className="input w-full" placeholder="new_business, renewal…" value={form.deal_type} onChange={(e) => setForm((f) => ({ ...f, deal_type: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Amount</label>
              <input type="number" min="0" className="input w-full" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Probability (%)</label>
              <input type="number" min="0" max="100" className="input w-full" value={form.probability} onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Expected Close</label>
              <input type="date" className="input w-full" value={form.expected_close_date} onChange={(e) => setForm((f) => ({ ...f, expected_close_date: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Product</label>
              <select className="select w-full" value={form.product_id} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}>
                <option value="">—</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label text-xs block mb-1">Notes</label>
              <textarea className="input w-full h-20 resize-none" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          {formError && <p className="text-sm text-churn-red">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeForm} className="btn-secondary text-sm px-4 py-2">Cancel</button>
            <button type="submit" disabled={isSaving} className="bg-mrr-green text-black text-sm font-medium px-4 py-2 rounded hover:bg-emerald-400 transition-colors disabled:opacity-50">
              {isSaving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Deal'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Deal"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        loading={deleteMutation.isPending}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
        title="Delete Selected Deals"
        message={`Delete ${selectedIds.size} selected deals? This cannot be undone.`}
        loading={bulkDeleteMutation.isPending}
      />
    </div>
  )
}
