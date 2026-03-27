'use client'

import { useQuery } from '@tanstack/react-query'
import { api, Role } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { ShieldCheck, Shield, Info } from 'lucide-react'

function RoleBadge({ isActive }: { isActive: boolean }) {
  return isActive
    ? <Badge variant="success">Active</Badge>
    : <Badge variant="default">Placeholder</Badge>
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin:     'Full access to all features — import, settings, integrations, all data.',
  sales_rep: 'Read companies, contacts, deals. Write activities and deals.',
  csm:       'Read companies, contacts, invoices. Write activities and notes.',
  finance:   'Read invoices, payments, ledger, metrics. Write payments.',
  ceo:       'Read-only access to all data and metrics.',
}

export default function UsersPage() {
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.getRoles(),
  })
  const roles = rolesData?.data || []
  const activeRoles = roles.filter((r) => r.is_active)
  const placeholderRoles = roles.filter((r) => !r.is_active)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Users & Roles</h1>
        <p className="text-text-secondary text-sm mt-0.5">Manage user access and role permissions</p>
      </div>

      {/* Current user */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-mrr-green" />
          <h2 className="font-semibold text-text-primary">Current Session</h2>
        </div>
        <div className="flex items-center gap-3 p-3 bg-surface rounded border border-border">
          <div className="w-8 h-8 rounded-full bg-emerald-900 flex items-center justify-center">
            <span className="text-mrr-green font-bold text-sm">A</span>
          </div>
          <div>
            <p className="font-medium text-text-primary text-sm">Admin</p>
            <p className="text-text-muted text-xs">Single-tenant mode · Full access</p>
          </div>
          <div className="ml-auto">
            <Badge variant="success">admin</Badge>
          </div>
        </div>
      </div>

      {/* Roles */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-text-secondary" />
          <h2 className="font-semibold text-text-primary">Role Definitions</h2>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-surface rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Active roles first */}
            {activeRoles.map((role) => <RoleRow key={role.id} role={role} />)}
            {/* Placeholder roles */}
            {placeholderRoles.map((role) => <RoleRow key={role.id} role={role} />)}
          </div>
        )}
      </div>

      {/* Multi-user notice */}
      <div className="flex gap-3 p-4 bg-surface rounded border border-border">
        <Info className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-text-primary">Multi-user support coming in Phase 2</p>
          <p className="text-xs text-text-muted mt-1">
            Currently operating in single-tenant admin mode. In Phase 2, you'll be able to invite team members
            (Sales Reps, CSMs, Finance), assign roles, and control which data each role can access.
          </p>
        </div>
      </div>
    </div>
  )
}

function RoleRow({ role }: { role: Role }) {
  const desc = ROLE_DESCRIPTIONS[role.name] || 'Custom role'

  return (
    <div className={`flex items-start gap-3 p-3 rounded border ${role.is_active ? 'border-border bg-card' : 'border-border bg-surface opacity-60'}`}>
      <div className={`w-7 h-7 rounded flex-shrink-0 flex items-center justify-center text-xs font-bold ${role.is_active ? 'bg-emerald-900 text-mrr-green' : 'bg-surface text-text-muted'}`}>
        {role.name[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-primary text-sm capitalize">{role.name.replace('_', ' ')}</span>
          <RoleBadge isActive={role.is_active} />
        </div>
        <p className="text-xs text-text-muted mt-0.5">{desc}</p>
      </div>
    </div>
  )
}
