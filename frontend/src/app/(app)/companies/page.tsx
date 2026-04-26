'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Search, Building2, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, ChevronsUpDown, Plus, Pencil, Trash2 } from 'lucide-react'
import { api, Company, ChurnRiskScore } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { SegmentBadge, Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

const SEGMENTS = ['', 'ENT', 'MID', 'SMB']
const STATUSES = ['', 'active', 'churned', 'at-risk', 'prospect']
const PAGE_SIZES = [25, 50, 100, 200]

type FormState = {
  name: string; domain: string; segment: string; status: string
  country: string; city: string; industry: string
  employee_count: string; annual_revenue: string; hubspot_id: string
}

const EMPTY_FORM: FormState = {
  name: '', domain: '', segment: '', status: 'active',
  country: '', city: '', industry: '', employee_count: '', annual_revenue: '', hubspot_id: '',
}

function toFormState(c: Company): FormState {
  return {
    name: c.name || '', domain: c.domain || '', segment: c.segment || '',
    status: c.status || 'active', country: c.country || '', city: c.city || '',
    industry: c.industry || '',
    employee_count: c.employee_count != null ? String(c.employee_count) : '',
    annual_revenue: c.annual_revenue != null ? String(c.annual_revenue) : '',
    hubspot_id: c.hubspot_id || '',
  }
}

function formToPayload(f: FormState) {
  return {
    name: f.name.trim(),
    domain: f.domain.trim() || null,
    segment: (f.segment || null) as 'SMB' | 'MID' | 'ENT' | null,
    status: (f.status || 'active') as 'active' | 'churned' | 'at-risk' | 'prospect',
    country: f.country.trim() || null,
    city: f.city.trim() || null,
    industry: f.industry.trim() || null,
    employee_count: f.employee_count ? parseInt(f.employee_count) : null,
    annual_revenue: f.annual_revenue ? parseFloat(f.annual_revenue) : null,
    hubspot_id: f.hubspot_id.trim() || null,
  }
}

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

function ChurnRiskBadge({ score }: { score?: number }) {
  if (score === undefined || score === null) return <span className="text-text-muted text-xs">—</span>
  if (score >= 70) return <span className="text-xs font-medium text-churn-red bg-red-950 px-2 py-0.5 rounded">{Math.round(score)}</span>
  if (score >= 50) return <span className="text-xs font-medium text-amber-400 bg-amber-950 px-2 py-0.5 rounded">{Math.round(score)}</span>
  return <span className="text-xs font-medium text-mrr-green bg-emerald-950 px-2 py-0.5 rounded">{Math.round(score)}</span>
}

function CompanyStatusBadge({ status }: { status?: string }) {
  const map: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
    active: 'success', 'at-risk': 'warning', churned: 'error', prospect: 'default',
  }
  if (!status || status === 'active') return null
  return <Badge variant={map[status] || 'default'}>{status}</Badge>
}

export default function CompaniesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [sortBy, setSortBy] = useState('mrr')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(field: string) {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir(['name', 'segment', 'country', 'industry'].includes(field) ? 'asc' : 'desc')
    }
    setPage(1)
  }

  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Company | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['companies', search, segment, status, page, limit, sortBy, sortDir],
    queryFn: () => api.getCompanies({ search: search || undefined, segment: segment || undefined, status: status || undefined, page, limit, sort: sortBy, order: sortDir }),
    placeholderData: (prev) => prev,
  })

  const { data: churnData } = useQuery({
    queryKey: ['churn-risk-companies'],
    queryFn: () => api.getChurnRisk({ limit: 500 }),
    staleTime: 300_000,
  })

  const churnScoreMap = (churnData?.data || []).reduce<Record<string, number>>((acc, r) => {
    acc[r.company_id] = r.score_value
    return acc
  }, {})

  const companies = data?.data || []
  const total = data?.meta?.total || 0
  const totalPages = Math.ceil(total / limit)

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof formToPayload>) => api.createCompany(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); closeForm() },
    onError: (e: Error) => setFormError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReturnType<typeof formToPayload> }) => api.updateCompany(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); closeForm() },
    onError: (e: Error) => setFormError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCompany(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); setDeleteTarget(null) },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.bulkDeleteCompanies(ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); setSelectedIds(new Set()); setBulkDeleteOpen(false) },
  })

  function toggleSelect(id: string) {
    setSelectedIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === companies.length && companies.length > 0 ? new Set() : new Set(companies.map((c) => c.id)))
  }

  function openCreate() {
    setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setFormOpen(true)
  }

  function openEdit(c: Company) {
    setEditTarget(c); setForm(toFormState(c)); setFormError(''); setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false); setEditTarget(null); setForm(EMPTY_FORM); setFormError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Company name is required'); return }
    const payload = formToPayload(form)
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Companies</h1>
          <p className="text-text-secondary text-sm mt-0.5">{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button onClick={() => setBulkDeleteOpen(true)} className="flex items-center gap-2 bg-churn-red text-white text-sm font-medium px-3 py-1.5 rounded hover:bg-red-600 transition-colors">
              <Trash2 className="w-4 h-4" /> Delete Selected ({selectedIds.size})
            </button>
          )}
          <button onClick={openCreate} className="flex items-center gap-2 bg-mrr-green text-black text-sm font-medium px-3 py-1.5 rounded hover:bg-emerald-400 transition-colors">
            <Plus className="w-4 h-4" /> New Company
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input className="input w-full pl-9" placeholder="Search companies..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="select" value={segment} onChange={(e) => { setSegment(e.target.value); setPage(1) }}>
          <option value="">All segments</option>
          {SEGMENTS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All statuses</option>
          {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-border">
            <tr>
              <th className="table-header w-10">
                <input type="checkbox" className="rounded" checked={selectedIds.size === companies.length && companies.length > 0} onChange={toggleSelectAll} />
              </th>
              <SortTh label="Company"    field="name"        sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Segment"    field="segment"     sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Country"    field="country"     sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Industry"   field="industry"    sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="Churn Risk" field="churn_risk"  sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <SortTh label="MRR"        field="mrr"         sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <SortTh label="ARR"        field="arr"         sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <th className="table-header w-20" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={8} className="table-cell"><div className="h-4 bg-surface rounded animate-pulse w-full" /></td>
                </tr>
              ))
            ) : companies.length === 0 ? (
              <tr>
                <td colSpan={9} className="table-cell text-center text-text-secondary py-12">
                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No companies found
                </td>
              </tr>
            ) : (
              companies.map((company) => {
                const mrr = company.current_mrr ?? 0
                return (
                  <tr key={company.id} className={`border-b border-border hover:bg-surface transition-colors group ${selectedIds.has(company.id) ? 'bg-surface' : ''}`}>
                    <td className="table-cell w-10">
                      <input type="checkbox" className="rounded" checked={selectedIds.has(company.id)} onChange={() => toggleSelect(company.id)} />
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Link href={`/companies/${company.id}`} className="font-medium hover:text-mrr-green transition-colors">{company.name}</Link>
                        <CompanyStatusBadge status={company.status} />
                      </div>
                    </td>
                    <td className="table-cell"><SegmentBadge segment={company.segment} /></td>
                    <td className="table-cell text-text-secondary text-sm">{company.country || '—'}</td>
                    <td className="table-cell text-text-secondary text-sm">{company.industry || '—'}</td>
                    <td className="table-cell text-right">
                      <ChurnRiskBadge score={churnScoreMap[company.id]} />
                    </td>
                    <td className="table-cell text-right">
                      {mrr > 0 ? <span className="font-semibold text-mrr-green">{formatCurrency(mrr, 'USD', true)}</span> : <span className="text-text-muted">—</span>}
                    </td>
                    <td className="table-cell text-right text-text-secondary text-sm">
                      {mrr > 0 ? formatCurrency(mrr * 12, 'USD', true) : '—'}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(company)} className="p-1.5 rounded hover:bg-card text-text-muted hover:text-text-primary transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(company)} className="p-1.5 rounded hover:bg-card text-text-muted hover:text-churn-red transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <Link href={`/companies/${company.id}`} className="p-1.5 rounded hover:bg-card text-text-muted hover:text-text-primary transition-colors">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">{total} companies</span>
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
      </div>

      {/* Create / Edit Modal */}
      <Modal open={formOpen} onClose={closeForm} title={editTarget ? `Edit — ${editTarget.name}` : 'New Company'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label text-xs block mb-1">Company Name <span className="text-churn-red">*</span></label>
              <input className="input w-full" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Domain</label>
              <input className="input w-full" placeholder="acme.com" value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">HubSpot ID</label>
              <input className="input w-full" value={form.hubspot_id} onChange={(e) => setForm((f) => ({ ...f, hubspot_id: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Segment</label>
              <select className="select w-full" value={form.segment} onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))}>
                <option value="">—</option>
                {['SMB', 'MID', 'ENT'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs block mb-1">Status</label>
              <select className="select w-full" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {['active', 'churned', 'at-risk', 'prospect'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs block mb-1">Country</label>
              <input className="input w-full" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">City</label>
              <input className="input w-full" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Industry</label>
              <input className="input w-full" value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Employees</label>
              <input type="number" min="0" className="input w-full" value={form.employee_count} onChange={(e) => setForm((f) => ({ ...f, employee_count: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs block mb-1">Annual Revenue ($)</label>
              <input type="number" min="0" className="input w-full" value={form.annual_revenue} onChange={(e) => setForm((f) => ({ ...f, annual_revenue: e.target.value }))} />
            </div>
          </div>
          {formError && <p className="text-sm text-churn-red">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeForm} className="btn-secondary text-sm px-4 py-2">Cancel</button>
            <button type="submit" disabled={isSaving} className="bg-mrr-green text-black text-sm font-medium px-4 py-2 rounded hover:bg-emerald-400 transition-colors disabled:opacity-50">
              {isSaving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Company"
        message={`Delete "${deleteTarget?.name}"? This removes the company record but NOT related invoices or ledger entries.`}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate([...selectedIds])}
        title="Delete Selected Companies"
        message={`Delete ${selectedIds.size} selected companies? This cannot be undone.`}
        loading={bulkDeleteMutation.isPending}
      />
    </div>
  )
}
