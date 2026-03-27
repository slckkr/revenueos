import clsx from 'clsx'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'
  className?: string
}

const variants = {
  default: 'bg-surface text-text-secondary border border-border',
  success: 'bg-mrr-green bg-opacity-15 text-mrr-green',
  warning: 'bg-warning bg-opacity-15 text-warning',
  error: 'bg-churn-red bg-opacity-15 text-churn-red',
  info: 'bg-mrr-blue bg-opacity-15 text-mrr-blue',
  purple: 'bg-expansion-purple bg-opacity-15 text-expansion-purple',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={clsx('badge', variants[variant], className)}>
      {children}
    </span>
  )
}

export function EventBadge({ eventType }: { eventType: string }) {
  const config: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    NEW: { label: 'New', variant: 'success' },
    EXPANSION: { label: 'Expansion', variant: 'purple' },
    REACTIVATION: { label: 'Reactivation', variant: 'info' },
    CONTRACTION: { label: 'Contraction', variant: 'warning' },
    CHURN: { label: 'Churn', variant: 'error' },
    PRICE_INCREASE: { label: 'Price ↑', variant: 'info' },
  }

  const { label, variant } = config[eventType] || { label: eventType, variant: 'default' as const }
  return <Badge variant={variant}>{label}</Badge>
}

export function SegmentBadge({ segment }: { segment: string | null }) {
  if (!segment) return null
  const variants2: Record<string, BadgeProps['variant']> = {
    ENT: 'purple',
    MID: 'info',
    SMB: 'default',
  }
  return <Badge variant={variants2[segment] || 'default'}>{segment}</Badge>
}

export function SyncStatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: BadgeProps['variant'] }> = {
    done: { variant: 'success' },
    running: { variant: 'info' },
    error: { variant: 'error' },
  }
  const { variant } = config[status] || { variant: 'default' as const }
  return <Badge variant={variant}>{status}</Badge>
}
