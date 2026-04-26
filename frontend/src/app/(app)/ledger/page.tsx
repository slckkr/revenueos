'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Check, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { api, LedgerEntry } from '@/lib/api'
import { formatCurrency, formatMonth } from '@/lib/formatters'
import { EventBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type SortDir = 'asc' | 'desc'

function SortTh({ label, field, sortBy, sortDir, onSort, className }: {
  label: string; field: string; sortBy: string; sortDir: SortDir
  onSort: (f: string) => void; className?: string
}) {
  const active = sortBy === field
  return (
    <th
      className={`table-header cursor-pointer select-none hover:text-text-primary transition-colors ${className || ''}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
          : <ChevronsUpDown className="w-3 h-3 opacity-40" />}
      </span>
    </th>
  )
}

const EVENT_TYPES = ['NEW', 'EXPANSION', 'CONTRACTION', 'CHURN', 'REACTIVATION', 'PRICE_INCREASE']
const PAGE_SIZES = [25, 50, 100, 200]

type LedgerRow = LedgerEntry & { companies?: { name: string }; products?: { name: string } }

type NewForm = {
  company_id: string; product_id: string; month: string; event_type: string
  amount_original: string; currency: string; fx_rate: string
  amount_reporting: string; recognition_method: string
}

const EMPTY_NEW: NewForm = {
  company_id: '', product_id: '', month: '', event_type: 'NEW',
  amount_original: '', currency: 'USD', fx_rate: '1',
  amount_reporting: '', recognition_method: 'accrual',
}

export default function LedgerPage() {
  const qc = useQueryClient()
  const [month, setMonth] = useState('')
  const [eventType, setEventType] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [sortBy, setSortBy] = useState('month')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(field: string) {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir(field === 'company_name' || field === 'event_type' ? 'asc' : 'desc')
    }
    setPage(1)
  }

  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<LedgerEntry>>({})
  const [newOpen, setNewOpen] = useState(false)
  const [newForm, setNewForm] = useState<NewForm>(EMPTY_NEW)
  const [newError, setNewError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<LedgerRow | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const { data: companiesData } = useQuery({
    queryKey: ['companies-list'],
    queryFn: () => api.getCompanies({ limit: 200, sort: 'name' }),
    staleTime: 60_000,
  })
  const companies = companiesData?.data || []

  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.getProducts(),
    staleTime: 60_000,
  })
  const products = productsData?.data || []

  const { data, isLoading } = useQuery({
    queryKey: ['ledger', month, eventType, companyId, page, limit, sortBy, sortDir],
    queryFn: () => api.getLedger({ month: month || undefined, event_type: eventType || undefined, company_id: companyId || undefined, page, limit, sort: sortBy, order: sortDir }),
    placeholderData: (prev) => prev,
  })

  const entries = (data?.data || []) as LedgerRow[]
  const total = data?.meta?.total || 0

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LedgerEntry> }) => api.updateLedgerEntry(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ledger'] }); setEditId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteLedgerEntry(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ledger'] }); setDeleteTarget(null) },
  })
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.bulkDeleteLedger(ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ledger'] }); setSelectedIds(new Set()); setBulkDeleteOpen(false) },
  })
  function toggleSelect(id: string) { setSelectedIds((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s }) }
  function toggleSelectAll() { setSelectedIds(selectedIds.size === entries.length && entries.length > 0 ? new Set() : new Set(entries.map((e) => e.id))) }

  const createMutation = useMutation({
    mutationFn: (f: NewForm) => api.createLedgerEntry({
      company_id: f.company_id,
      product_id: f.product_id || undefined,
      month: f.month,
      event_type: f.event_type,
      amount_original: parseFloat(f.amount_original),
      currency: f.currency,
      fx_rate: parseFloat(f.fx_rate || '1'),
      amount_reporting: parseFloat(f.amount_reporting || f.amount_original),
      recognition_method: f.recognition_method,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger'] })
      setNewOpen(false); setNewForm(EMPTY_NEW); setNewError('')
    },
    onError: (e: Error) => setNewError(e.message),
  })

  function startEdit(entry: LedgerRow) {
    setEditId(entry.id)
    setEditForm({ event_type: entry.event_type, amount_original: entry.amount_original, currency: entry.currency, fx_rate: entry.fx_rate, amount_reporting: entry.amount_reporting, recognition_method: entry.recognition_method })
  }

  function submitNew(e: React.FormEvent) {
    e.preventDefault()
    if (!newForm.company_id) { setNewError('Company is required'); return }
    if (!newForm.month) { setNewError('Month is required'); return }
    if (!newForm.amount_original) { setNewError('Amount is required'); return }
    createMutation.mutate(newForm)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Revenue Ledger</h1>
          <p className="text-text-secondary text-sm mt-0.5">{total} entries</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button onClick={() => setBulkDeleteOpen(true)} className="flex items-center gap-2 bg-churn-red text-white text-sm font-medium px-3 py-1.5 rounded hover:bg-red-600 transition-colors">
              <Trash2 className="w-4 h-4" /> Delete ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => { setNewOpen(true); setNewForm(EMPTY_NEW); setNewError('') }}
            className="flex items-center gap-2 bg-mrr-green text-black text-sm font-medium px-3 py-1.5 rounded hover:bg-emerald-400 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Entry
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input type="month" className="input" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1) }} />
        <select className="select" value={companyId} onChange={(e) => { setCompanyId(e.target.value); setPage(1) }}>
          <option value="">All companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="select" value={eventType} onChange={(e) => { setEventType(e.target.value); setPage(1) }}>
          <option value="">All events</option>
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-border">
            <tr>
              <th className="table-header w-10"><input type="checkbox" className="rounded" checked={selectedIds.size === entries.length && entries.length > 0} onChange={toggleSelectAll} /></th>
              <SortTh label="Month"     field="month"          sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Company"   field="company_name"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <th className="table-header">Product</th>
              <SortTh label="Event"     field="event_type"     sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Original"  field="amount_original" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <th className="table-header">FX Rate</th>
              <SortTh label="Reporting" field="amount_reporting" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <th className="table-header">Method</th>
              <th className="table-header w-20" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={10} className="table-cell"><div className="h-4 bg-surface rounded animate-pulse w-full" /></td>
                </tr>
              ))
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={10} className="table-cell text-center text-text-secondary py-12">
                  No ledger entries. Import invoices or run a HubSpot sync, then rebuild the ledger.
                </td>
              </tr>
            ) : (
              entries.map((entry) =>
                editId === entry.id ? (
                  <tr key={entry.id} className="border-b border-border bg-surface">
                    <td className="table-cell w-10" />
                    <td className="table-cell text-sm text-text-secondary">{formatMonth(entry.month)}</td>
                    <td className="table-cell text-sm">{entry.companies?.name || '—'}</td>
                    <td className="table-cell text-sm text-text-muted">{entry.products?.name || '—'}</td>
                    <td className="table-cell">
                      <select className="select text-xs py-0.5 px-1 h-7" value={editForm.event_type || ''} onChange={(e) => setEditForm((f) => ({ ...f, event_type: e.target.value }))}>
                        {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="table-cell">
                      <input type="number" className="input text-xs py-0.5 px-1 h-7 w-24 text-right" value={editForm.amount_original ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, amount_original: parseFloat(e.target.value) }))} />
                    </td>
                    <td className="table-cell">
                      <input type="number" step="0.0001" className="input text-xs py-0.5 px-1 h-7 w-20 text-right" value={editForm.fx_rate ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, fx_rate: parseFloat(e.target.value) }))} />
                    </td>
                    <td className="table-cell">
                      <input type="number" className="input text-xs py-0.5 px-1 h-7 w-24 text-right" value={editForm.amount_reporting ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, amount_reporting: parseFloat(e.target.value) }))} />
                    </td>
                    <td className="table-cell">
                      <select className="select text-xs py-0.5 px-1 h-7" value={editForm.recognition_method || ''} onChange={(e) => setEditForm((f) => ({ ...f, recognition_method: e.target.value }))}>
                        <option value="accrual">accrual</option>
                        <option value="cash">cash</option>
                      </select>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateMutation.mutate({ id: entry.id, data: editForm })} disabled={updateMutation.isPending} className="p-1.5 rounded text-mrr-green hover:bg-card transition-colors" title="Save">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditId(null)} className="p-1.5 rounded text-text-muted hover:bg-card transition-colors" title="Cancel">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={entry.id} className={`border-b border-border hover:bg-surface transition-colors group ${selectedIds.has(entry.id) ? 'bg-surface' : ''}`}>
                    <td className="table-cell w-10"><input type="checkbox" className="rounded" checked={selectedIds.has(entry.id)} onChange={() => toggleSelect(entry.id)} /></td>
                    <td className="table-cell text-text-secondary">{formatMonth(entry.month)}</td>
                    <td className="table-cell font-medium">{entry.companies?.name || '—'}</td>
                    <td className="table-cell text-text-secondary">{entry.products?.name || '—'}</td>
                    <td className="table-cell"><EventBadge eventType={entry.event_type} /></td>
                    <td className="table-cell">{formatCurrency(entry.amount_original, entry.currency, true)} {entry.currency}</td>
                    <td className="table-cell text-text-secondary text-xs font-mono">{Number(entry.fx_rate).toFixed(4)}</td>
                    <td className="table-cell font-medium text-mrr-green">{formatCurrency(entry.amount_reporting, 'USD', true)}</td>
                    <td className="table-cell text-text-secondary text-xs">{entry.recognition_method}</td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(entry)} className="p-1.5 rounded hover:bg-card text-text-muted hover:text-text-primary transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(entry)} className="p-1.5 rounded hover:bg-card text-text-muted hover:text-churn-red transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>

        {(() => {
          const totalPages = Math.ceil(total / limit)
          return (
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">{total} entries</span>
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

      {/* New Entry Modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New Ledger Entry">
        <form onSubmit={submitNew} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label text-xs block mb-1">Company <span className="text-churn-red">*</span></label>
              <select className="select w-full" value={newForm.company_id} onChange={(e) => setNewForm((f) => ({ ...f, company_id: e.target.value }))}>
                <option value="">Select company…</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs block mb-1">Product</label>
              <select className="select w-full" value={newForm.product_id} onChange={(e) => setNewForm((f) => ({ ...f, product_id: e.target.value }))}>
                <option value="">None</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs block mb-1">Month <span className="text-churn-red">*</span></label>
              <input type="month" className="input w-full" value={newForm.month.slice(0, 7)} onChange={(e) => setNewForm((f) => ({ ...f, month: e.target.value + '-01' }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Event Type</label>
              <select className="select w-full" value={newForm.event_type} onChange={(e) => setNewForm((f) => ({ ...f, event_type: e.target.value }))}>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs block mb-1">Amount <span className="text-churn-red">*</span></label>
              <input type="number" min="0" step="0.01" className="input w-full" value={newForm.amount_original} onChange={(e) => setNewForm((f) => ({ ...f, amount_original: e.target.value, amount_reporting: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Currency</label>
              <input className="input w-full" maxLength={3} value={newForm.currency} onChange={(e) => setNewForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">FX Rate</label>
              <input type="number" step="0.0001" className="input w-full" value={newForm.fx_rate} onChange={(e) => setNewForm((f) => ({ ...f, fx_rate: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Reporting Amount (USD)</label>
              <input type="number" step="0.01" className="input w-full" value={newForm.amount_reporting} onChange={(e) => setNewForm((f) => ({ ...f, amount_reporting: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Recognition</label>
              <select className="select w-full" value={newForm.recognition_method} onChange={(e) => setNewForm((f) => ({ ...f, recognition_method: e.target.value }))}>
                <option value="accrual">Accrual</option>
                <option value="cash">Cash</option>
              </select>
            </div>
          </div>
          {newError && <p className="text-sm text-churn-red">{newError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setNewOpen(false)} className="btn-secondary text-sm px-4 py-2">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="bg-mrr-green text-black text-sm font-medium px-4 py-2 rounded hover:bg-emerald-400 transition-colors disabled:opacity-50">
              {createMutation.isPending ? 'Creating…' : 'Create Entry'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Ledger Entry"
        message={`Delete this ${deleteTarget?.event_type} entry for ${deleteTarget?.companies?.name || 'this company'} (${formatMonth(deleteTarget?.month || '')})?`}
        loading={deleteMutation.isPending}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate([...selectedIds])}
        title="Delete Selected Ledger Entries"
        message={`Delete ${selectedIds.size} selected entries? This cannot be undone.`}
        loading={bulkDeleteMutation.isPending}
      />
    </div>
  )
}
