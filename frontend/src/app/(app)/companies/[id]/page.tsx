'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Mail, Phone, MapPin, Building2, Users, CreditCard, Briefcase, FileText, FileSignature, Activity, StickyNote, CheckSquare, Plus, Trash2, CheckCircle2, Circle, Pencil, X, Check } from 'lucide-react'
import { api, Company } from '@/lib/api'
import { formatCurrency, formatMonth } from '@/lib/formatters'
import { EventBadge, SegmentBadge, Badge } from '@/components/ui/Badge'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

type LifecycleStage = 'target' | 'prospect' | 'qualified' | 'hot_lead' | 'proposal' | 'customer' | 'at_risk' | 'churned'
const LIFECYCLE_STAGES: LifecycleStage[] = ['target', 'prospect', 'qualified', 'hot_lead', 'proposal', 'customer', 'at_risk', 'churned']
const LIFECYCLE_META: Record<LifecycleStage, { label: string; color: string; bg: string }> = {
  target:    { label: 'Target',    color: 'text-text-muted',  bg: 'bg-surface' },
  prospect:  { label: 'Prospect',  color: 'text-blue-400',    bg: 'bg-blue-950' },
  qualified: { label: 'Qualified', color: 'text-violet-400',  bg: 'bg-violet-950' },
  hot_lead:  { label: 'Hot Lead',  color: 'text-orange-400',  bg: 'bg-orange-950' },
  proposal:  { label: 'Proposal',  color: 'text-yellow-400',  bg: 'bg-yellow-950' },
  customer:  { label: 'Customer',  color: 'text-mrr-green',   bg: 'bg-emerald-950' },
  at_risk:   { label: 'At Risk',   color: 'text-amber-400',   bg: 'bg-amber-950' },
  churned:   { label: 'Churned',   color: 'text-churn-red',   bg: 'bg-red-950' },
}

function LifecycleBadge({ stage }: { stage?: LifecycleStage | null }) {
  if (!stage) return <span className="text-xs text-text-muted px-2 py-0.5 rounded bg-surface border border-border">No Stage</span>
  const m = LIFECYCLE_META[stage]
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded ${m.color} ${m.bg}`}>{m.label}</span>
}

type SectionKey = 'basic' | 'location' | 'contact' | 'business' | 'financial' | 'capital' | 'rankings'

function SectionHeader({ title, sectionKey, editing, onEdit, onCancel, onSave, saving }: {
  title: string; sectionKey: SectionKey; editing: SectionKey | null
  onEdit: () => void; onCancel: () => void; onSave: () => void; saving: boolean
}) {
  const isEditing = editing === sectionKey
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{title}</h3>
      {isEditing ? (
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"><X className="w-3 h-3" /> Cancel</button>
          <button onClick={onSave} disabled={saving} className="flex items-center gap-1 text-xs bg-mrr-green text-black px-2 py-0.5 rounded font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50">
            {saving ? '…' : <><Check className="w-3 h-3" /> Save</>}
          </button>
        </div>
      ) : (
        editing === null && <button onClick={onEdit} className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
      )}
    </div>
  )
}

function Field({ label, value, link }: { label: string; value?: string | null; link?: string }) {
  return (
    <div>
      <p className="text-xs text-text-muted mb-0.5">{label}</p>
      {value
        ? link
          ? <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-mrr-green hover:underline">{value}</a>
          : <p className="text-sm font-medium text-text-primary">{value}</p>
        : <p className="text-sm text-text-muted">—</p>}
    </div>
  )
}

function FinField({ label, value, colored }: { label: string; value?: number | null; colored?: boolean }) {
  if (value == null) return <div><p className="text-xs text-text-muted mb-0.5">{label}</p><p className="text-sm text-text-muted">—</p></div>
  const color = colored ? (value >= 0 ? 'text-mrr-green' : 'text-churn-red') : 'text-text-primary'
  return <div><p className="text-xs text-text-muted mb-0.5">{label}</p><p className={`text-sm font-medium ${color}`}>{value.toLocaleString('tr-TR')} TL</p></div>
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => api.getCompany(id),
    staleTime: 0,
  })

  const { data: contactsData } = useQuery({
    queryKey: ['company-contacts', id],
    queryFn: () => api.getContacts({ company_id: id, limit: 20 }),
    staleTime: 30_000,
  })

  const { data: paymentsData } = useQuery({
    queryKey: ['company-payments', id],
    queryFn: () => api.getPayments({ company_id: id }),
    staleTime: 30_000,
  })

  const { data: dealsData } = useQuery({
    queryKey: ['company-deals', id],
    queryFn: () => api.getDeals({ company_id: id }),
    staleTime: 30_000,
  })

  const { data: proposalsData } = useQuery({
    queryKey: ['company-proposals', id],
    queryFn: () => api.getProposals({ company_id: id }),
    staleTime: 30_000,
  })

  const { data: contractsData } = useQuery({
    queryKey: ['company-contracts', id],
    queryFn: () => api.getContracts({ company_id: id }),
    staleTime: 30_000,
  })

  const { data: activitiesData } = useQuery({
    queryKey: ['company-activities', id],
    queryFn: () => api.getActivities({ company_id: id }),
    staleTime: 30_000,
  })

  const qc = useQueryClient()

  const { data: notesData, refetch: refetchNotes } = useQuery({
    queryKey: ['company-notes', id],
    queryFn: () => api.getNotes({ object_type: 'company', object_id: id }),
    staleTime: 30_000,
  })

  const { data: tasksData, refetch: refetchTasks } = useQuery({
    queryKey: ['company-tasks', id],
    queryFn: () => api.getTasks({ object_type: 'company', object_id: id }),
    staleTime: 30_000,
  })

  const [newNote, setNewNote] = useState('')
  const [newTask, setNewTask] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')

  // Section-by-section edit
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null)
  const [sectionDraft, setSectionDraft] = useState<Partial<Company>>({})
  const [lifecycleDropdownOpen, setLifecycleDropdownOpen] = useState(false)

  const updateMutation = useMutation({
    mutationFn: (patch: Partial<Company>) => api.updateCompany(id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company', id] }); setEditingSection(null); setSectionDraft({}) },
  })

  function startEdit(section: SectionKey, fields: Partial<Company>) {
    setSectionDraft(fields)
    setEditingSection(section)
  }
  function cancelEdit() { setEditingSection(null); setSectionDraft({}) }
  function saveEdit() { updateMutation.mutate(sectionDraft) }
  function patchDraft(patch: Partial<Company>) { setSectionDraft((d) => ({ ...d, ...patch })) }

  const createNoteMutation = useMutation({
    mutationFn: () => api.createNote({ object_type: 'company', object_id: id, body: newNote }),
    onSuccess: () => { setNewNote(''); refetchNotes() },
  })

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => api.deleteNote(noteId),
    onSuccess: () => refetchNotes(),
  })

  const createTaskMutation = useMutation({
    mutationFn: () => api.createTask({ object_type: 'company', object_id: id, title: newTask, due_date: newTaskDue || undefined }),
    onSuccess: () => { setNewTask(''); setNewTaskDue(''); refetchTasks() },
  })

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) => api.updateTask(taskId, { status: status as 'open' | 'in_progress' | 'done' | 'cancelled' }),
    onSuccess: () => refetchTasks(),
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.deleteTask(taskId),
    onSuccess: () => refetchTasks(),
  })

  const company = data?.data
  const mrrHistory = company?.mrr_history || []
  const events = company?.recent_events || []
  const invoices = company?.invoices || []
  const contacts = contactsData?.data || []
  const payments = paymentsData?.data || []
  const deals = dealsData?.data || []
  const proposals = proposalsData?.data || []
  const contracts = contractsData?.data || []
  const activities = activitiesData?.data || []

  // Aggregate MRR by month for chart
  const mrrByMonth = mrrHistory.reduce<Record<string, number>>((acc, row) => {
    acc[row.month] = (acc[row.month] || 0) + Number(row.amount_reporting)
    return acc
  }, {})
  const chartData = Object.entries(mrrByMonth)
    .map(([month, mrr]) => ({ month, mrr }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const currentMrr = chartData[chartData.length - 1]?.mrr || 0
  const prevMrr = chartData[chartData.length - 2]?.mrr || 0
  const mrrChange = prevMrr > 0 ? ((currentMrr - prevMrr) / prevMrr) * 100 : 0
  const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0)
  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const latestEvent = events[0]

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-6 w-48 bg-surface rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-20 bg-surface" />
          ))}
        </div>
        <div className="card animate-pulse h-52" />
      </div>
    )
  }

  if (!company) {
    return <div className="p-6"><p className="text-text-secondary">Company not found.</p></div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/companies" className="text-text-secondary hover:text-text-primary mt-1.5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-text-primary">{company.name}</h1>
            <SegmentBadge segment={company.segment} />
            {company.status && company.status !== 'active' && (
              <Badge variant={company.status === 'churned' ? 'error' : company.status === 'at-risk' ? 'warning' : 'default'}>
                {company.status}
              </Badge>
            )}
            {/* Lifecycle stage changer */}
            <div className="relative">
              <button
                onClick={() => setLifecycleDropdownOpen((v) => !v)}
                className="flex items-center gap-1"
              >
                <LifecycleBadge stage={company.lifecycle_stage as LifecycleStage | null} />
              </button>
              {lifecycleDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded shadow-lg z-20 py-1 min-w-[140px]">
                  {LIFECYCLE_STAGES.map((s) => {
                    const m = LIFECYCLE_META[s]
                    return (
                      <button
                        key={s}
                        onClick={() => { api.updateCompany(id, { lifecycle_stage: s }); qc.invalidateQueries({ queryKey: ['company', id] }); setLifecycleDropdownOpen(false) }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface transition-colors ${m.color}`}
                      >
                        {m.label}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => { api.updateCompany(id, { lifecycle_stage: null }); qc.invalidateQueries({ queryKey: ['company', id] }); setLifecycleDropdownOpen(false) }}
                    className="w-full text-left px-3 py-1.5 text-xs text-text-muted hover:bg-surface transition-colors border-t border-border mt-1"
                  >
                    Clear stage
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {company.domain && (
              <a href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer"
                className="text-text-secondary text-sm flex items-center gap-1 hover:text-mrr-green transition-colors">
                {company.domain} <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {(company.country || company.city) && (
              <span className="text-xs text-text-muted flex items-center gap-1">
                <MapPin className="w-3 h-3" />{[company.city, company.district, company.country].filter(Boolean).join(', ')}
              </span>
            )}
            {company.industry && <span className="text-xs text-text-muted flex items-center gap-1"><Building2 className="w-3 h-3" />{company.industry}</span>}
            {company.phone1 && <span className="text-xs text-text-muted flex items-center gap-1"><Phone className="w-3 h-3" />{company.phone1}</span>}
            {company.email && <a href={`mailto:${company.email}`} className="text-xs text-text-muted flex items-center gap-1 hover:text-mrr-green transition-colors"><Mail className="w-3 h-3" />{company.email}</a>}
            {company.hubspot_id && <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded border border-border">HubSpot: {company.hubspot_id}</span>}
            {company.iso500_rank && <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded border border-border">ISO 500 #{company.iso500_rank}{company.data_year ? ` (${company.data_year})` : ''}</span>}
          </div>
          {company.strategic_notes && (
            <p className="text-xs text-text-secondary mt-1.5 italic border-l-2 border-border pl-2">{company.strategic_notes}</p>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="label text-xs mb-1">Current MRR</p>
          <p className="text-xl font-bold text-mrr-green">{formatCurrency(currentMrr, 'USD', true)}</p>
          {mrrChange !== 0 && (
            <p className={`text-xs mt-0.5 ${mrrChange > 0 ? 'text-mrr-green' : 'text-churn-red'}`}>
              {mrrChange > 0 ? '+' : ''}{mrrChange.toFixed(1)}% vs prev
            </p>
          )}
        </div>
        <div className="card">
          <p className="label text-xs mb-1">ARR</p>
          <p className="text-xl font-bold text-text-primary">{formatCurrency(currentMrr * 12, 'USD', true)}</p>
          <p className="text-xs text-text-muted mt-0.5">Annualized</p>
        </div>
        <div className="card">
          <p className="label text-xs mb-1">Total Billed</p>
          <p className="text-xl font-bold text-text-primary">{formatCurrency(totalInvoiceAmount, 'USD', true)}</p>
          <p className="text-xs text-text-muted mt-0.5">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="card">
          <p className="label text-xs mb-1">Latest Event</p>
          {latestEvent ? (
            <>
              <div className="mt-1"><EventBadge eventType={latestEvent.event_type} /></div>
              <p className="text-xs text-text-muted mt-1">{formatMonth(latestEvent.month)}</p>
            </>
          ) : (
            <p className="text-text-muted text-sm mt-1">—</p>
          )}
        </div>
      </div>

      {/* MRR Chart */}
      {chartData.length > 1 && (
        <div className="card">
          <h2 className="font-semibold text-text-primary mb-4">MRR History</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="companyMrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
              <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => formatCurrency(v, 'USD', true)} tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v, 'USD'), 'MRR']}
                labelFormatter={formatMonth}
                contentStyle={{ background: 'var(--color-card, #1a1a1a)', border: '1px solid var(--color-border, #2a2a2a)', borderRadius: '8px' }}
              />
              <Area type="monotone" dataKey="mrr" stroke="#10b981" strokeWidth={2} fill="url(#companyMrrGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Company Profile — section-by-section editable cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Basic Info */}
        <div className="card">
          <SectionHeader title="Basic Info" sectionKey="basic" editing={editingSection}
            onEdit={() => startEdit('basic', { name: company.name, domain: company.domain, segment: company.segment, status: company.status, hubspot_id: company.hubspot_id, strategic_notes: company.strategic_notes })}
            onCancel={cancelEdit} onSave={saveEdit} saving={updateMutation.isPending} />
          {editingSection === 'basic' ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2"><label className="label text-xs block mb-1">Name</label><input className="input w-full" value={sectionDraft.name || ''} onChange={(e) => patchDraft({ name: e.target.value })} /></div>
              <div><label className="label text-xs block mb-1">Domain</label><input className="input w-full" value={sectionDraft.domain || ''} onChange={(e) => patchDraft({ domain: e.target.value })} /></div>
              <div><label className="label text-xs block mb-1">HubSpot ID</label><input className="input w-full" value={sectionDraft.hubspot_id || ''} onChange={(e) => patchDraft({ hubspot_id: e.target.value })} /></div>
              <div><label className="label text-xs block mb-1">Segment</label>
                <select className="select w-full" value={sectionDraft.segment || ''} onChange={(e) => patchDraft({ segment: e.target.value as Company['segment'] })}>
                  <option value="">—</option>{['SMB', 'MID', 'ENT'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="label text-xs block mb-1">Status</label>
                <select className="select w-full" value={sectionDraft.status || 'active'} onChange={(e) => patchDraft({ status: e.target.value as Company['status'] })}>
                  {['active', 'churned', 'at-risk', 'prospect'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className="label text-xs block mb-1">Strategic Notes</label><textarea className="input w-full resize-none" rows={2} value={sectionDraft.strategic_notes || ''} onChange={(e) => patchDraft({ strategic_notes: e.target.value })} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Domain" value={company.domain} link={company.domain ? `https://${company.domain}` : undefined} />
              <Field label="Segment" value={company.segment} />
              <Field label="Status" value={company.status} />
              <Field label="HubSpot ID" value={company.hubspot_id} />
              {company.strategic_notes && <div className="col-span-2"><p className="text-xs text-text-muted mb-0.5">Strategic Notes</p><p className="text-sm text-text-secondary italic">{company.strategic_notes}</p></div>}
            </div>
          )}
        </div>

        {/* Location */}
        <div className="card">
          <SectionHeader title="Location" sectionKey="location" editing={editingSection}
            onEdit={() => startEdit('location', { country: company.country, city: company.city, district: company.district, address: company.address, postal_code: company.postal_code })}
            onCancel={cancelEdit} onSave={saveEdit} saving={updateMutation.isPending} />
          {editingSection === 'location' ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><label className="label text-xs block mb-1">Country</label><input className="input w-full" value={sectionDraft.country || ''} onChange={(e) => patchDraft({ country: e.target.value })} /></div>
              <div><label className="label text-xs block mb-1">City (İl)</label><input className="input w-full" value={sectionDraft.city || ''} onChange={(e) => patchDraft({ city: e.target.value })} /></div>
              <div><label className="label text-xs block mb-1">District (İlçe)</label><input className="input w-full" value={sectionDraft.district || ''} onChange={(e) => patchDraft({ district: e.target.value })} /></div>
              <div><label className="label text-xs block mb-1">Postal Code</label><input className="input w-full" value={sectionDraft.postal_code || ''} onChange={(e) => patchDraft({ postal_code: e.target.value })} /></div>
              <div className="col-span-2"><label className="label text-xs block mb-1">Address</label><input className="input w-full" value={sectionDraft.address || ''} onChange={(e) => patchDraft({ address: e.target.value })} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Country" value={company.country} />
              <Field label="City" value={company.city} />
              <Field label="District" value={company.district} />
              <Field label="Postal Code" value={company.postal_code} />
              {company.address && <div className="col-span-2"><p className="text-xs text-text-muted mb-0.5">Address</p><p className="text-sm text-text-primary">{company.address}</p></div>}
            </div>
          )}
        </div>

        {/* Contact */}
        <div className="card">
          <SectionHeader title="Contact" sectionKey="contact" editing={editingSection}
            onEdit={() => startEdit('contact', { phone1: company.phone1, phone2: company.phone2, email: company.email })}
            onCancel={cancelEdit} onSave={saveEdit} saving={updateMutation.isPending} />
          {editingSection === 'contact' ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><label className="label text-xs block mb-1">Phone 1</label><input className="input w-full" value={sectionDraft.phone1 || ''} onChange={(e) => patchDraft({ phone1: e.target.value })} /></div>
              <div><label className="label text-xs block mb-1">Phone 2</label><input className="input w-full" value={sectionDraft.phone2 || ''} onChange={(e) => patchDraft({ phone2: e.target.value })} /></div>
              <div className="col-span-2"><label className="label text-xs block mb-1">Email</label><input type="email" className="input w-full" value={sectionDraft.email || ''} onChange={(e) => patchDraft({ email: e.target.value })} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Phone 1" value={company.phone1} />
              <Field label="Phone 2" value={company.phone2} />
              <Field label="Email" value={company.email} link={company.email ? `mailto:${company.email}` : undefined} />
            </div>
          )}
        </div>

        {/* Business */}
        <div className="card">
          <SectionHeader title="Business" sectionKey="business" editing={editingSection}
            onEdit={() => startEdit('business', { industry: company.industry, employee_count: company.employee_count, annual_revenue: company.annual_revenue, chamber_of_commerce: company.chamber_of_commerce, nace_description: company.nace_description, nace_code: company.nace_code, isic_description: company.isic_description, isic_code: company.isic_code })}
            onCancel={cancelEdit} onSave={saveEdit} saving={updateMutation.isPending} />
          {editingSection === 'business' ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><label className="label text-xs block mb-1">Industry</label><input className="input w-full" value={sectionDraft.industry || ''} onChange={(e) => patchDraft({ industry: e.target.value })} /></div>
              <div><label className="label text-xs block mb-1">Employees</label><input type="number" className="input w-full" value={sectionDraft.employee_count ?? ''} onChange={(e) => patchDraft({ employee_count: e.target.value ? parseInt(e.target.value) : null })} /></div>
              <div><label className="label text-xs block mb-1">Annual Revenue</label><input type="number" className="input w-full" value={sectionDraft.annual_revenue ?? ''} onChange={(e) => patchDraft({ annual_revenue: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              <div className="col-span-2"><label className="label text-xs block mb-1">Chamber of Commerce</label><input className="input w-full" value={sectionDraft.chamber_of_commerce || ''} onChange={(e) => patchDraft({ chamber_of_commerce: e.target.value })} /></div>
              <div><label className="label text-xs block mb-1">NACE Description</label><input className="input w-full" value={sectionDraft.nace_description || ''} onChange={(e) => patchDraft({ nace_description: e.target.value })} /></div>
              <div><label className="label text-xs block mb-1">NACE Code</label><input className="input w-full" value={sectionDraft.nace_code || ''} onChange={(e) => patchDraft({ nace_code: e.target.value })} /></div>
              <div><label className="label text-xs block mb-1">ISIC Description</label><input className="input w-full" value={sectionDraft.isic_description || ''} onChange={(e) => patchDraft({ isic_description: e.target.value })} /></div>
              <div><label className="label text-xs block mb-1">ISIC Code</label><input className="input w-full" value={sectionDraft.isic_code || ''} onChange={(e) => patchDraft({ isic_code: e.target.value })} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Industry" value={company.industry} />
              <Field label="Employees" value={company.employee_count != null ? company.employee_count.toLocaleString() : null} />
              <Field label="Annual Revenue" value={company.annual_revenue != null ? `${company.annual_revenue.toLocaleString('tr-TR')} TL` : null} />
              <Field label="Chamber" value={company.chamber_of_commerce} />
              <Field label="NACE" value={[company.nace_description, company.nace_code].filter(Boolean).join(' · ') || null} />
              <Field label="ISIC" value={[company.isic_description, company.isic_code].filter(Boolean).join(' · ') || null} />
            </div>
          )}
        </div>

        {/* Financial Metrics */}
        <div className="card lg:col-span-2">
          <SectionHeader title="Financial Metrics (TL)" sectionKey="financial" editing={editingSection}
            onEdit={() => startEdit('financial', { net_sales: company.net_sales, production_sales_net: company.production_sales_net, gross_value_added: company.gross_value_added, equity: company.equity, total_assets: company.total_assets, pre_tax_profit: company.pre_tax_profit, ebitda: company.ebitda, exports_usd: company.exports_usd })}
            onCancel={cancelEdit} onSave={saveEdit} saving={updateMutation.isPending} />
          {editingSection === 'financial' ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {([['net_sales','Net Sales'],['production_sales_net','Production Sales Net'],['gross_value_added','Gross Value Added'],['equity','Equity'],['total_assets','Total Assets'],['pre_tax_profit','Pre-tax Profit'],['ebitda','EBITDA'],['exports_usd','Exports (K$)']] as [keyof Company, string][]).map(([k, lbl]) => (
                <div key={k}><label className="label text-xs block mb-1">{lbl}</label><input type="number" className="input w-full" value={(sectionDraft as Record<string, unknown>)[k] as number ?? ''} onChange={(e) => patchDraft({ [k]: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
              <FinField label="Net Sales" value={company.net_sales} />
              <FinField label="Production Sales" value={company.production_sales_net} />
              <FinField label="Gross Value Added" value={company.gross_value_added} />
              <FinField label="EBITDA" value={company.ebitda} />
              <FinField label="Pre-tax Profit" value={company.pre_tax_profit} colored />
              <FinField label="Equity" value={company.equity} />
              <FinField label="Total Assets" value={company.total_assets} />
              {company.exports_usd != null && <div><p className="text-xs text-text-muted mb-0.5">Exports</p><p className="font-medium text-text-primary">${company.exports_usd.toLocaleString('tr-TR')}K</p></div>}
            </div>
          )}
        </div>

        {/* Capital Structure + Rankings */}
        <div className="card">
          <SectionHeader title="Capital Structure (%)" sectionKey="capital" editing={editingSection}
            onEdit={() => startEdit('capital', { capital_share_public: company.capital_share_public, capital_share_private: company.capital_share_private, capital_share_foreign: company.capital_share_foreign, capital_share_float: company.capital_share_float })}
            onCancel={cancelEdit} onSave={saveEdit} saving={updateMutation.isPending} />
          {editingSection === 'capital' ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {([['capital_share_public','Public (Kamu)'],['capital_share_private','Private (Özel)'],['capital_share_foreign','Foreign (Yabancı)'],['capital_share_float','Float (Halka Açık)']] as [keyof Company, string][]).map(([k, lbl]) => (
                <div key={k}><label className="label text-xs block mb-1">{lbl}</label><input type="number" min="0" max="100" step="0.01" className="input w-full" value={(sectionDraft as Record<string, unknown>)[k] as number ?? ''} onChange={(e) => patchDraft({ [k]: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {company.capital_share_public != null && <span className="text-xs bg-surface px-2 py-1 rounded border border-border">Public {company.capital_share_public}%</span>}
              {company.capital_share_private != null && <span className="text-xs bg-surface px-2 py-1 rounded border border-border">Private {company.capital_share_private}%</span>}
              {company.capital_share_foreign != null && <span className="text-xs bg-surface px-2 py-1 rounded border border-border">Foreign {company.capital_share_foreign}%</span>}
              {company.capital_share_float != null && <span className="text-xs bg-surface px-2 py-1 rounded border border-border">Float {company.capital_share_float}%</span>}
              {company.capital_share_public == null && company.capital_share_private == null && company.capital_share_foreign == null && company.capital_share_float == null && <p className="text-text-muted text-xs">No data</p>}
            </div>
          )}
        </div>

        <div className="card">
          <SectionHeader title="Rankings" sectionKey="rankings" editing={editingSection}
            onEdit={() => startEdit('rankings', { iso500_rank: company.iso500_rank, iso500_rank_prev_year: company.iso500_rank_prev_year, data_year: company.data_year })}
            onCancel={cancelEdit} onSave={saveEdit} saving={updateMutation.isPending} />
          {editingSection === 'rankings' ? (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><label className="label text-xs block mb-1">ISO 500 Rank</label><input type="number" min="1" className="input w-full" value={sectionDraft.iso500_rank ?? ''} onChange={(e) => patchDraft({ iso500_rank: e.target.value ? parseInt(e.target.value) : null })} /></div>
              <div><label className="label text-xs block mb-1">Prev Year Rank</label><input type="number" min="1" className="input w-full" value={sectionDraft.iso500_rank_prev_year ?? ''} onChange={(e) => patchDraft({ iso500_rank_prev_year: e.target.value ? parseInt(e.target.value) : null })} /></div>
              <div><label className="label text-xs block mb-1">Data Year</label><input type="number" min="2000" max="2100" className="input w-full" value={sectionDraft.data_year ?? ''} onChange={(e) => patchDraft({ data_year: e.target.value ? parseInt(e.target.value) : null })} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <Field label="ISO 500 Rank" value={company.iso500_rank != null ? `#${company.iso500_rank}` : null} />
              <Field label="Prev Year" value={company.iso500_rank_prev_year != null ? `#${company.iso500_rank_prev_year}` : null} />
              <Field label="Data Year" value={company.data_year != null ? String(company.data_year) : null} />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Events */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-text-primary">Revenue Events</h2>
          </div>
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="table-header">Month</th>
                <th className="table-header">Event</th>
                <th className="table-header text-right">Prev MRR</th>
                <th className="table-header text-right">Impact</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-cell text-center text-text-secondary py-8">
                    No events yet. Rebuild ledger after import.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id} className="border-b border-border hover:bg-surface transition-colors">
                    <td className="table-cell text-text-secondary text-sm">{formatMonth(ev.month)}</td>
                    <td className="table-cell"><EventBadge eventType={ev.event_type} /></td>
                    <td className="table-cell text-right text-text-secondary text-sm">
                      {formatCurrency(ev.prev_mrr, 'USD', true)}
                    </td>
                    <td className={`table-cell text-right font-medium text-sm ${ev.mrr_impact >= 0 ? 'text-mrr-green' : 'text-churn-red'}`}>
                      {ev.mrr_impact >= 0 ? '+' : ''}{formatCurrency(ev.mrr_impact, 'USD', true)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Invoices */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-text-primary">Invoices</h2>
          </div>
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="table-header">Invoice #</th>
                <th className="table-header">Date</th>
                <th className="table-header text-right">Amount</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-cell text-center text-text-secondary py-8">
                    No invoices yet
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border hover:bg-surface transition-colors">
                    <td className="table-cell font-mono text-xs text-text-secondary">{inv.invoice_number}</td>
                    <td className="table-cell text-sm text-text-secondary">{inv.issue_date}</td>
                    <td className="table-cell text-right font-medium text-sm">
                      {formatCurrency(inv.total_amount, inv.currency, true)}
                      {inv.currency !== 'USD' && (
                        <span className="text-xs text-text-muted ml-1">{inv.currency}</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <Badge variant={inv.status === 'issued' ? 'success' : inv.status === 'void' ? 'error' : 'default'}>
                        {inv.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 360° v2 — Deals, Proposals, Contracts, Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deals */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-text-secondary" />
            <h2 className="font-semibold text-text-primary">Deals</h2>
            <span className="ml-auto text-xs text-text-muted">{deals.length}</span>
            <Link href={`/deals`} className="text-xs text-text-muted hover:text-mrr-green ml-1">View all</Link>
          </div>
          {deals.length === 0 ? (
            <p className="text-text-secondary text-sm p-4 text-center">No deals</p>
          ) : (
            <div className="divide-y divide-border">
              {deals.slice(0, 5).map((d) => (
                <div key={d.id} className="px-4 py-3 hover:bg-surface transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{d.name}</p>
                      <p className="text-xs text-text-muted capitalize">{d.stage} · {d.status}</p>
                    </div>
                    {d.amount != null && (
                      <span className="text-sm font-semibold text-mrr-green shrink-0">
                        {formatCurrency(d.amount, d.currency, true)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activities */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Activity className="w-4 h-4 text-text-secondary" />
            <h2 className="font-semibold text-text-primary">Activities</h2>
            <span className="ml-auto text-xs text-text-muted">{activities.length}</span>
            <Link href={`/activities`} className="text-xs text-text-muted hover:text-mrr-green ml-1">View all</Link>
          </div>
          {activities.length === 0 ? (
            <p className="text-text-secondary text-sm p-4 text-center">No activities logged</p>
          ) : (
            <div className="divide-y divide-border">
              {activities.slice(0, 5).map((a) => (
                <div key={a.id} className="px-4 py-3 hover:bg-surface transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{a.subject || a.type.replace('_', ' ')}</p>
                      <p className="text-xs text-text-muted capitalize">{a.type.replace('_', ' ')} · {new Date(a.activity_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Proposals */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <FileText className="w-4 h-4 text-text-secondary" />
            <h2 className="font-semibold text-text-primary">Proposals</h2>
            <span className="ml-auto text-xs text-text-muted">{proposals.length}</span>
            <Link href={`/proposals`} className="text-xs text-text-muted hover:text-mrr-green ml-1">View all</Link>
          </div>
          {proposals.length === 0 ? (
            <p className="text-text-secondary text-sm p-4 text-center">No proposals</p>
          ) : (
            <div className="divide-y divide-border">
              {proposals.slice(0, 5).map((p) => (
                <div key={p.id} className="px-4 py-3 hover:bg-surface transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{p.proposal_number || p.title || 'Proposal'}</p>
                      <p className="text-xs text-text-muted capitalize">{p.status} {p.expiry_date ? `· exp. ${p.expiry_date}` : ''}</p>
                    </div>
                    {p.amount != null && (
                      <span className="text-sm font-semibold text-mrr-green shrink-0">
                        {formatCurrency(p.amount, p.currency, true)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contracts */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-text-secondary" />
            <h2 className="font-semibold text-text-primary">Contracts</h2>
            <span className="ml-auto text-xs text-text-muted">{contracts.length}</span>
            <Link href={`/contracts`} className="text-xs text-text-muted hover:text-mrr-green ml-1">View all</Link>
          </div>
          {contracts.length === 0 ? (
            <p className="text-text-secondary text-sm p-4 text-center">No contracts</p>
          ) : (
            <div className="divide-y divide-border">
              {contracts.slice(0, 5).map((c) => (
                <div key={c.id} className="px-4 py-3 hover:bg-surface transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{c.contract_number || c.title || 'Contract'}</p>
                      <p className="text-xs text-text-muted">{c.status} · {c.start_date} → {c.end_date}</p>
                    </div>
                    {c.total_value != null && (
                      <span className="text-sm font-semibold text-mrr-green shrink-0">
                        {formatCurrency(c.total_value, c.currency, true)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 360° v1 — Contacts & Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contacts */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Users className="w-4 h-4 text-text-secondary" />
            <h2 className="font-semibold text-text-primary">Contacts</h2>
            <span className="ml-auto text-xs text-text-muted">{contacts.length}</span>
          </div>
          {contacts.length === 0 ? (
            <p className="text-text-secondary text-sm p-4 text-center">No contacts</p>
          ) : (
            <div className="divide-y divide-border">
              {contacts.map((c) => (
                <div key={c.id} className="px-4 py-3 hover:bg-surface transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                        {c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                        {c.is_primary && (
                          <span className="text-xs text-mrr-green bg-emerald-900 px-1.5 py-0.5 rounded">Primary</span>
                        )}
                      </p>
                      {c.title && <p className="text-xs text-text-muted mt-0.5">{c.title}</p>}
                    </div>
                    <div className="text-right space-y-0.5 flex-shrink-0">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-xs text-text-secondary hover:text-mrr-green flex items-center gap-1 justify-end transition-colors">
                          <Mail className="w-3 h-3" /><span className="truncate max-w-[140px]">{c.email}</span>
                        </a>
                      )}
                      {c.phone && (
                        <p className="text-xs text-text-muted flex items-center gap-1 justify-end">
                          <Phone className="w-3 h-3" />{c.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payments */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-text-secondary" />
            <h2 className="font-semibold text-text-primary">Payments</h2>
            {payments.length > 0 && (
              <span className="ml-auto text-xs text-text-muted">{formatCurrency(totalPayments, 'USD', true)} total</span>
            )}
          </div>
          {payments.length === 0 ? (
            <p className="text-text-secondary text-sm p-4 text-center">No payments recorded</p>
          ) : (
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="table-header">Date</th>
                  <th className="table-header text-right">Amount</th>
                  <th className="table-header">Method</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 8).map((p) => (
                  <tr key={p.id} className="border-b border-border hover:bg-surface transition-colors">
                    <td className="table-cell text-sm text-text-secondary">{p.payment_date}</td>
                    <td className="table-cell text-right font-medium text-sm text-mrr-green">
                      {formatCurrency(p.amount, p.currency, true)}
                    </td>
                    <td className="table-cell text-sm text-text-muted capitalize">{p.method || '—'}</td>
                    <td className="table-cell">
                      <Badge variant={p.status === 'completed' ? 'success' : p.status === 'failed' ? 'error' : 'default'}>
                        {p.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Notes & Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notes */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-text-secondary" />
            <h2 className="font-semibold text-text-primary">Notes</h2>
            <span className="ml-auto text-xs text-text-muted">{notesData?.data?.length || 0}</span>
          </div>
          <div className="p-3 border-b border-border">
            <div className="flex gap-2">
              <textarea
                className="input flex-1 text-sm h-16 resize-none"
                placeholder="Add a note…"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
              />
              <button
                onClick={() => newNote.trim() && createNoteMutation.mutate()}
                disabled={!newNote.trim() || createNoteMutation.isPending}
                className="bg-mrr-green text-black text-xs font-medium px-3 rounded hover:bg-emerald-400 disabled:opacity-40 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {(notesData?.data || []).length === 0 ? (
              <p className="text-text-muted text-sm p-4 text-center">No notes yet</p>
            ) : (
              (notesData?.data || []).map((note: any) => (
                <div key={note.id} className="group px-4 py-3 hover:bg-surface transition-colors">
                  <div className="flex items-start gap-2">
                    <p className="text-sm text-text-secondary flex-1">{note.body}</p>
                    <button
                      onClick={() => deleteNoteMutation.mutate(note.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-text-muted hover:text-churn-red transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-text-muted mt-1">{new Date(note.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tasks */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-text-secondary" />
            <h2 className="font-semibold text-text-primary">Tasks</h2>
            <span className="ml-auto text-xs text-text-muted">
              {(tasksData?.data || []).filter((t: any) => t.status === 'open').length} open
            </span>
          </div>
          <div className="p-3 border-b border-border">
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="Add a task…"
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && newTask.trim() && createTaskMutation.mutate()}
              />
              <input
                type="date"
                className="input text-sm w-32"
                value={newTaskDue}
                onChange={e => setNewTaskDue(e.target.value)}
                title="Due date"
              />
              <button
                onClick={() => newTask.trim() && createTaskMutation.mutate()}
                disabled={!newTask.trim() || createTaskMutation.isPending}
                className="bg-mrr-green text-black text-xs font-medium px-3 rounded hover:bg-emerald-400 disabled:opacity-40 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {(tasksData?.data || []).length === 0 ? (
              <p className="text-text-muted text-sm p-4 text-center">No tasks yet</p>
            ) : (
              (tasksData?.data || []).map((task: any) => (
                <div key={task.id} className="group px-4 py-3 hover:bg-surface transition-colors">
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => updateTaskMutation.mutate({
                        taskId: task.id,
                        status: task.status === 'done' ? 'open' : 'done',
                      })}
                      className="mt-0.5 shrink-0 text-text-muted hover:text-mrr-green transition-colors"
                    >
                      {task.status === 'done'
                        ? <CheckCircle2 className="w-4 h-4 text-mrr-green" />
                        : <Circle className="w-4 h-4" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${task.status === 'done' ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                        {task.title}
                      </p>
                      {task.due_date && (
                        <p className={`text-xs mt-0.5 ${new Date(task.due_date) < new Date() && task.status !== 'done' ? 'text-churn-red' : 'text-text-muted'}`}>
                          Due {task.due_date}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteTaskMutation.mutate(task.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-text-muted hover:text-churn-red transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
