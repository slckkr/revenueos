/**
 * Format a number as currency.
 * @param amount - The amount to format
 * @param currency - Currency code (default: USD)
 * @param compact - Whether to use compact notation (1K, 1M)
 */
export function formatCurrency(
  amount: number,
  currency = 'USD',
  compact = false
): string {
  if (compact) {
    const abs = Math.abs(amount)
    const sign = amount < 0 ? '-' : ''
    if (abs >= 1_000_000) {
      return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
    }
    if (abs >= 1_000) {
      return `${sign}$${(abs / 1_000).toFixed(1)}K`
    }
    return `${sign}$${abs.toFixed(0)}`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format a percentage value.
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format a month string (YYYY-MM-DD) to display format.
 */
export function formatMonth(month: string): string {
  const date = new Date(`${month.slice(0, 7)}-01`)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}

/**
 * Format a date string to display format.
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * Format a relative time (e.g. "2 hours ago")
 */
export function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.round(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.round(diffMins / 60)}h ago`
  return `${Math.round(diffMins / 1440)}d ago`
}

/**
 * Format a number with thousand separators.
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

/**
 * Get color class for a metric change (positive = green, negative = red)
 */
export function getChangeColor(value: number, inverse = false): string {
  if (value === 0) return 'text-text-secondary'
  const isPositive = inverse ? value < 0 : value > 0
  return isPositive ? 'text-mrr-green' : 'text-churn-red'
}

/**
 * Get color for event type
 */
export function getEventColor(eventType: string): string {
  const colors: Record<string, string> = {
    NEW: '#10b981',
    EXPANSION: '#8b5cf6',
    REACTIVATION: '#06b6d4',
    CONTRACTION: '#f97316',
    CHURN: '#ef4444',
    PRICE_INCREASE: '#3b82f6',
  }
  return colors[eventType] || '#6b7280'
}

export function getEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    NEW: 'New',
    EXPANSION: 'Expansion',
    REACTIVATION: 'Reactivation',
    CONTRACTION: 'Contraction',
    CHURN: 'Churn',
    PRICE_INCREASE: 'Price Increase',
  }
  return labels[eventType] || eventType
}

export function getNrrColor(nrr: number): string {
  if (nrr >= 120) return '#10b981'  // excellent
  if (nrr >= 100) return '#3b82f6'  // good
  if (nrr >= 80) return '#f59e0b'   // warning
  return '#ef4444'                   // critical
}

export function getSeverityColor(severity: 'critical' | 'warning' | 'info'): string {
  const colors = {
    critical: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  }
  return colors[severity]
}
