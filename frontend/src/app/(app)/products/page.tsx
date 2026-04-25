'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Product } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Plus, X, Check, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

const PRICING_MODELS = ['flat', 'tiered', 'usage', 'per-seat'] as const
const PAGE_SIZES = [25, 50, 100, 200]
const BILLING_PERIODS = ['monthly', 'annual', 'one_time'] as const
const STATUSES = ['active', 'deprecated', 'beta'] as const

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
    active: 'success',
    beta: 'warning',
    deprecated: 'error',
  }
  return <Badge variant={map[status || ''] || 'default'}>{status || '—'}</Badge>
}

export default function ProductsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [form, setForm] = useState<Partial<Product>>({
    name: '',
    sku: '',
    billing_period: 'monthly',
    pricing_model: 'flat',
    status: 'active',
    currency: 'USD',
    category: '',
    description: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, limit],
    queryFn: () => api.getProducts({ page, limit }),
  })
  const products = data?.data || []
  const total = data?.meta?.total || 0

  const createMutation = useMutation({
    mutationFn: (d: Partial<Product>) => api.createProduct(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); resetForm() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) => api.updateProduct(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setEditId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setDeleteTarget(null) },
  })
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.bulkDeleteProducts(ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setSelectedIds(new Set()); setBulkDeleteOpen(false) },
  })
  function toggleSelect(id: string) { setSelectedIds((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s }) }
  function toggleSelectAll() { setSelectedIds(selectedIds.size === products.length && products.length > 0 ? new Set() : new Set(products.map((p) => p.id))) }

  function resetForm() {
    setShowCreate(false)
    setEditId(null)
    setForm({ name: '', sku: '', billing_period: 'monthly', pricing_model: 'flat', status: 'active', currency: 'USD', category: '', description: '' })
  }

  function startEdit(p: Product) {
    setEditId(p.id)
    setForm({ name: p.name, sku: p.sku || '', billing_period: p.billing_period, pricing_model: p.pricing_model || 'flat', status: p.status || 'active', currency: p.currency || 'USD', category: p.category || '', description: p.description || '', default_price: p.default_price || undefined })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Products</h1>
          <p className="text-text-secondary text-sm mt-0.5">{total} products</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button onClick={() => setBulkDeleteOpen(true)} className="flex items-center gap-2 bg-churn-red text-white text-sm font-medium px-3 py-1.5 rounded hover:bg-red-600 transition-colors">
              <Trash2 className="w-4 h-4" /> Delete ({selectedIds.size})
            </button>
          )}
          <button
            className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5"
            onClick={() => { setShowCreate(true); setEditId(null) }}
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card border border-mrr-green space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-text-primary text-sm">New Product</h2>
            <button onClick={resetForm} className="text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>
          <ProductForm form={form} setForm={setForm} />
          <div className="flex gap-2 pt-1">
            <button
              className="btn-primary text-sm px-3 py-1.5"
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
            <button className="btn-secondary text-sm px-3 py-1.5" onClick={resetForm}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-border">
            <tr>
              <th className="table-header w-10"><input type="checkbox" className="rounded" checked={selectedIds.size === products.length && products.length > 0} onChange={toggleSelectAll} /></th>
              <th className="table-header">Product</th>
              <th className="table-header">SKU</th>
              <th className="table-header">Billing</th>
              <th className="table-header">Pricing</th>
              <th className="table-header">Category</th>
              <th className="table-header text-right">Default Price</th>
              <th className="table-header">Status</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={9} className="table-cell">
                    <div className="h-4 bg-surface rounded animate-pulse w-full" />
                  </td>
                </tr>
              ))
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={9} className="table-cell text-center text-text-secondary py-12">
                  No products yet. Add your first product or import from Excel.
                </td>
              </tr>
            ) : (
              products.map((p) =>
                editId === p.id ? (
                  <tr key={p.id} className="border-b border-border bg-surface">
                    <td colSpan={9} className="p-3">
                      <div className="space-y-3">
                        <ProductForm form={form} setForm={setForm} />
                        <div className="flex gap-2">
                          <button
                            className="btn-primary text-xs px-2.5 py-1 flex items-center gap-1"
                            onClick={() => updateMutation.mutate({ id: p.id, data: form })}
                            disabled={updateMutation.isPending}
                          >
                            <Check className="w-3.5 h-3.5" />
                            {updateMutation.isPending ? 'Saving…' : 'Save'}
                          </button>
                          <button className="btn-secondary text-xs px-2.5 py-1" onClick={() => setEditId(null)}>Cancel</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className={`border-b border-border hover:bg-surface transition-colors ${selectedIds.has(p.id) ? 'bg-surface' : ''}`}>
                    <td className="table-cell w-10"><input type="checkbox" className="rounded" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                    <td className="table-cell font-medium">
                      {p.name}
                      {p.description && (
                        <p className="text-xs text-text-muted mt-0.5 truncate max-w-[200px]">{p.description}</p>
                      )}
                    </td>
                    <td className="table-cell font-mono text-xs text-text-secondary">{p.sku || '—'}</td>
                    <td className="table-cell text-sm text-text-secondary">{p.billing_period}</td>
                    <td className="table-cell text-sm text-text-secondary">{p.pricing_model || 'flat'}</td>
                    <td className="table-cell text-sm text-text-secondary">{p.category || '—'}</td>
                    <td className="table-cell text-right text-sm">
                      {p.default_price ? formatCurrency(p.default_price, p.currency || 'USD', true) : '—'}
                    </td>
                    <td className="table-cell"><StatusBadge status={p.status} /></td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="text-xs text-text-muted hover:text-text-primary transition-colors px-2 py-1" onClick={() => startEdit(p)}>
                          Edit
                        </button>
                        <button
                          className="p-1.5 rounded hover:bg-card text-text-muted hover:text-churn-red transition-colors"
                          onClick={() => setDeleteTarget(p)}
                          title="Delete"
                        >
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
                <span className="text-sm text-text-secondary">{total} products</span>
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

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Product"
        message={`Delete "${deleteTarget?.name}"? This will NOT remove related ledger entries or invoices.`}
        loading={deleteMutation.isPending}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate([...selectedIds])}
        title="Delete Selected Products"
        message={`Delete ${selectedIds.size} selected products? This cannot be undone.`}
        loading={bulkDeleteMutation.isPending}
      />
    </div>
  )
}

function ProductForm({ form, setForm }: { form: Partial<Product>; setForm: (f: Partial<Product>) => void }) {
  const set = (key: keyof Product) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value })

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="col-span-2">
        <label className="label text-xs mb-1 block">Name *</label>
        <input className="input w-full" value={form.name || ''} onChange={set('name')} placeholder="Product name" />
      </div>
      <div>
        <label className="label text-xs mb-1 block">SKU</label>
        <input className="input w-full" value={form.sku || ''} onChange={set('sku')} placeholder="SKU" />
      </div>
      <div>
        <label className="label text-xs mb-1 block">Status</label>
        <select className="select w-full" value={form.status || 'active'} onChange={set('status')}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="label text-xs mb-1 block">Billing Period</label>
        <select className="select w-full" value={form.billing_period || 'monthly'} onChange={set('billing_period')}>
          {BILLING_PERIODS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <div>
        <label className="label text-xs mb-1 block">Pricing Model</label>
        <select className="select w-full" value={form.pricing_model || 'flat'} onChange={set('pricing_model')}>
          {PRICING_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div>
        <label className="label text-xs mb-1 block">Default Price</label>
        <input className="input w-full" type="number" value={form.default_price ?? ''} onChange={(e) => setForm({ ...form, default_price: e.target.value ? Number(e.target.value) : undefined })} placeholder="0.00" />
      </div>
      <div>
        <label className="label text-xs mb-1 block">Currency</label>
        <input className="input w-full" value={form.currency || 'USD'} onChange={set('currency')} placeholder="USD" maxLength={3} />
      </div>
      <div>
        <label className="label text-xs mb-1 block">Category</label>
        <input className="input w-full" value={form.category || ''} onChange={set('category')} placeholder="e.g. Analytics" />
      </div>
      <div className="col-span-2 sm:col-span-4">
        <label className="label text-xs mb-1 block">Description</label>
        <textarea className="input w-full" rows={2} value={form.description || ''} onChange={set('description')} placeholder="Optional description" />
      </div>
    </div>
  )
}
