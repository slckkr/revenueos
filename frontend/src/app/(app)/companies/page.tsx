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
  // Basic
  name: string; domain: string; segment: string; status: string; hubspot_id: string
  // Location
  country: string; city: string; district: string; address: string; postal_code: string
  // Business
  industry: string; employee_count: string; annual_revenue: string
  chamber_of_commerce: string; nace_description: string; nace_code: string
  isic_description: string; isic_code: string
  // Financial
  net_sales: string; production_sales_net: string; gross_value_added: string
  equity: string; total_assets: string; pre_tax_profit: string; ebitda: string; exports_usd: string
  // Capital
  capital_share_public: string; capital_share_private: string
  capital_share_foreign: string; capital_share_float: string
  // Contact
  phone1: string; phone2: string; email: string
  // Rankings
  iso500_rank: string; iso500_rank_prev_year: string; data_year: string
}

const EMPTY_FORM: FormState = {
  name: '', domain: '', segment: '', status: 'active', hubspot_id: '',
  country: '', city: '', district: '', address: '', postal_code: '',
  industry: '', employee_count: '', annual_revenue: '',
  chamber_of_commerce: '', nace_description: '', nace_code: '',
  isic_description: '', isic_code: '',
  net_sales: '', production_sales_net: '', gross_value_added: '',
  equity: '', total_assets: '', pre_tax_profit: '', ebitda: '', exports_usd: '',
  capital_share_public: '', capital_share_private: '', capital_share_foreign: '', capital_share_float: '',
  phone1: '', phone2: '', email: '',
  iso500_rank: '', iso500_rank_prev_year: '', data_year: '',
}

function toFormState(c: Company): FormState {
  const n = (v: number | null | undefined) => v != null ? String(v) : ''
  const s = (v: string | null | undefined) => v || ''
  return {
    name: s(c.name), domain: s(c.domain), segment: s(c.segment),
    status: s(c.status) || 'active', hubspot_id: s(c.hubspot_id),
    country: s(c.country), city: s(c.city), district: s(c.district),
    address: s(c.address), postal_code: s(c.postal_code),
    industry: s(c.industry), employee_count: n(c.employee_count), annual_revenue: n(c.annual_revenue),
    chamber_of_commerce: s(c.chamber_of_commerce), nace_description: s(c.nace_description),
    nace_code: s(c.nace_code), isic_description: s(c.isic_description), isic_code: s(c.isic_code),
    net_sales: n(c.net_sales), production_sales_net: n(c.production_sales_net),
    gross_value_added: n(c.gross_value_added), equity: n(c.equity), total_assets: n(c.total_assets),
    pre_tax_profit: n(c.pre_tax_profit), ebitda: n(c.ebitda), exports_usd: n(c.exports_usd),
    capital_share_public: n(c.capital_share_public), capital_share_private: n(c.capital_share_private),
    capital_share_foreign: n(c.capital_share_foreign), capital_share_float: n(c.capital_share_float),
    phone1: s(c.phone1), phone2: s(c.phone2), email: s(c.email),
    iso500_rank: n(c.iso500_rank), iso500_rank_prev_year: n(c.iso500_rank_prev_year), data_year: n(c.data_year),
  }
}

function formToPayload(f: FormState) {
  const num = (v: string) => v.trim() ? parseFloat(v) : null
  const int = (v: string) => v.trim() ? parseInt(v) : null
  const str = (v: string) => v.trim() || null
  return {
    name: f.name.trim(),
    domain: str(f.domain), segment: (f.segment || null) as 'SMB' | 'MID' | 'ENT' | null,
    status: (f.status || 'active') as 'active' | 'churned' | 'at-risk' | 'prospect',
    hubspot_id: str(f.hubspot_id),
    country: str(f.country), city: str(f.city), district: str(f.district),
    address: str(f.address), postal_code: str(f.postal_code),
    industry: str(f.industry), employee_count: int(f.employee_count), annual_revenue: num(f.annual_revenue),
    chamber_of_commerce: str(f.chamber_of_commerce), nace_description: str(f.nace_description),
    nace_code: str(f.nace_code), isic_description: str(f.isic_description), isic_code: str(f.isic_code),
    net_sales: num(f.net_sales), production_sales_net: num(f.production_sales_net),
    gross_value_added: num(f.gross_value_added), equity: num(f.equity), total_assets: num(f.total_assets),
    pre_tax_profit: num(f.pre_tax_profit), ebitda: num(f.ebitda), exports_usd: num(f.exports_usd),
    capital_share_public: num(f.capital_share_public), capital_share_private: num(f.capital_share_private),
    capital_share_foreign: num(f.capital_share_foreign), capital_share_float: num(f.capital_share_float),
    phone1: str(f.phone1), phone2: str(f.phone2), email: str(f.email),
    iso500_rank: int(f.iso500_rank), iso500_rank_prev_year: int(f.iso500_rank_prev_year),
    data_year: int(f.data_year),
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
        <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">

          {/* Basic */}
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Basic</p>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
          </div>

          {/* Location */}
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Location</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs block mb-1">Country</label>
                <input className="input w-full" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">City (İl)</label>
                <input className="input w-full" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">District (İlçe)</label>
                <input className="input w-full" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">Postal Code</label>
                <input className="input w-full" value={form.postal_code} onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label text-xs block mb-1">Address</label>
                <input className="input w-full" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs block mb-1">Phone 1</label>
                <input className="input w-full" value={form.phone1} onChange={(e) => setForm((f) => ({ ...f, phone1: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">Phone 2</label>
                <input className="input w-full" value={form.phone2} onChange={(e) => setForm((f) => ({ ...f, phone2: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label text-xs block mb-1">Email</label>
                <input type="email" className="input w-full" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Business */}
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Business</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs block mb-1">Industry</label>
                <input className="input w-full" value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">Employees</label>
                <input type="number" min="0" className="input w-full" value={form.employee_count} onChange={(e) => setForm((f) => ({ ...f, employee_count: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label text-xs block mb-1">Chamber of Commerce</label>
                <input className="input w-full" value={form.chamber_of_commerce} onChange={(e) => setForm((f) => ({ ...f, chamber_of_commerce: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">NACE Description</label>
                <input className="input w-full" value={form.nace_description} onChange={(e) => setForm((f) => ({ ...f, nace_description: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">NACE Code</label>
                <input className="input w-full" value={form.nace_code} onChange={(e) => setForm((f) => ({ ...f, nace_code: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">ISIC Description</label>
                <input className="input w-full" value={form.isic_description} onChange={(e) => setForm((f) => ({ ...f, isic_description: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">ISIC Code</label>
                <input className="input w-full" value={form.isic_code} onChange={(e) => setForm((f) => ({ ...f, isic_code: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Financial Metrics */}
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Financial Metrics (TL)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs block mb-1">Annual Revenue</label>
                <input type="number" min="0" className="input w-full" value={form.annual_revenue} onChange={(e) => setForm((f) => ({ ...f, annual_revenue: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">Net Sales</label>
                <input type="number" className="input w-full" value={form.net_sales} onChange={(e) => setForm((f) => ({ ...f, net_sales: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">Production Sales (Net)</label>
                <input type="number" className="input w-full" value={form.production_sales_net} onChange={(e) => setForm((f) => ({ ...f, production_sales_net: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">Gross Value Added</label>
                <input type="number" className="input w-full" value={form.gross_value_added} onChange={(e) => setForm((f) => ({ ...f, gross_value_added: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">Equity (Özkaynaklar)</label>
                <input type="number" className="input w-full" value={form.equity} onChange={(e) => setForm((f) => ({ ...f, equity: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">Total Assets (Aktif)</label>
                <input type="number" className="input w-full" value={form.total_assets} onChange={(e) => setForm((f) => ({ ...f, total_assets: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">Pre-tax Profit/Loss</label>
                <input type="number" className="input w-full" value={form.pre_tax_profit} onChange={(e) => setForm((f) => ({ ...f, pre_tax_profit: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">EBITDA (FAVÖK)</label>
                <input type="number" className="input w-full" value={form.ebitda} onChange={(e) => setForm((f) => ({ ...f, ebitda: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">Exports (Thousand $)</label>
                <input type="number" min="0" className="input w-full" value={form.exports_usd} onChange={(e) => setForm((f) => ({ ...f, exports_usd: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Capital Structure */}
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Capital Structure (%)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs block mb-1">Public (Kamu)</label>
                <input type="number" min="0" max="100" step="0.01" className="input w-full" value={form.capital_share_public} onChange={(e) => setForm((f) => ({ ...f, capital_share_public: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">Private (Özel)</label>
                <input type="number" min="0" max="100" step="0.01" className="input w-full" value={form.capital_share_private} onChange={(e) => setForm((f) => ({ ...f, capital_share_private: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">Foreign (Yabancı)</label>
                <input type="number" min="0" max="100" step="0.01" className="input w-full" value={form.capital_share_foreign} onChange={(e) => setForm((f) => ({ ...f, capital_share_foreign: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">Float (Halka Açık)</label>
                <input type="number" min="0" max="100" step="0.01" className="input w-full" value={form.capital_share_float} onChange={(e) => setForm((f) => ({ ...f, capital_share_float: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Rankings */}
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Rankings</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label text-xs block mb-1">ISO 500 Rank</label>
                <input type="number" min="1" className="input w-full" value={form.iso500_rank} onChange={(e) => setForm((f) => ({ ...f, iso500_rank: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">Prev Year Rank</label>
                <input type="number" min="1" className="input w-full" value={form.iso500_rank_prev_year} onChange={(e) => setForm((f) => ({ ...f, iso500_rank_prev_year: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs block mb-1">Data Year</label>
                <input type="number" min="2000" max="2100" className="input w-full" value={form.data_year} onChange={(e) => setForm((f) => ({ ...f, data_year: e.target.value }))} />
              </div>
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
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
        title="Delete Selected Companies"
        message={`Delete ${selectedIds.size} selected companies? This cannot be undone.`}
        loading={bulkDeleteMutation.isPending}
      />
    </div>
  )
}
