'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Mail, Phone, MapPin, Building2, Users, CreditCard, Briefcase, FileText, FileSignature, Activity, StickyNote, CheckSquare, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, formatMonth } from '@/lib/formatters'
import { EventBadge, SegmentBadge, Badge } from '@/components/ui/Badge'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

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
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) => api.updateTask(taskId, { status }),
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
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {company.domain && (
              <a
                href={`https://${company.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-secondary text-sm flex items-center gap-1 hover:text-mrr-green transition-colors"
              >
                {company.domain} <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {company.country && (
              <span className="text-xs text-text-muted flex items-center gap-1">
                <MapPin className="w-3 h-3" />{company.city ? `${company.city}, ` : ''}{company.country}
              </span>
            )}
            {company.industry && (
              <span className="text-xs text-text-muted flex items-center gap-1">
                <Building2 className="w-3 h-3" />{company.industry}
              </span>
            )}
            {company.hubspot_id && (
              <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded border border-border">
                HubSpot: {company.hubspot_id}
              </span>
            )}
          </div>
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
