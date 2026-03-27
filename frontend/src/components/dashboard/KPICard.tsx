import clsx from 'clsx'

interface KPICardProps {
  label: string
  value: string
  subValue?: string
  trend?: number        // percentage change vs prev month
  color?: string
  className?: string
  onClick?: () => void
}

export function KPICard({ label, value, subValue, trend, color, className, onClick }: KPICardProps) {
  const trendPositive = trend !== undefined && trend > 0
  const trendNegative = trend !== undefined && trend < 0

  return (
    <div className={clsx('card', onClick && 'cursor-pointer hover:brightness-110 transition-all', className)} onClick={onClick}>
      <p className="label mb-2">{label}</p>
      <p className="text-2xl font-bold" style={color ? { color } : {}}>
        {value}
      </p>
      {subValue && (
        <p className="text-sm text-text-secondary mt-0.5">{subValue}</p>
      )}
      {trend !== undefined && (
        <p className={clsx(
          'text-xs mt-2 font-medium',
          trendPositive && 'text-mrr-green',
          trendNegative && 'text-churn-red',
          !trendPositive && !trendNegative && 'text-text-secondary'
        )}>
          {trendPositive ? '+' : ''}{trend.toFixed(1)}% vs last month
        </p>
      )}
    </div>
  )
}
