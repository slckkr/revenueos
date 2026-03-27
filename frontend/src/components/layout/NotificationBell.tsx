'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Bell, Check, CheckCheck, X, AlertTriangle, Zap, RefreshCw, Clock } from 'lucide-react'
import { api } from '@/lib/api'

type Notification = {
  id: string
  type: string
  title: string
  body?: string
  is_read: boolean
  link?: string
  company_id?: string
  created_at: string
  companies?: { name: string }
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  playbook: <Zap className="w-3.5 h-3.5 text-amber-400" />,
  task_assigned: <Check className="w-3.5 h-3.5 text-blue-400" />,
  renewal: <RefreshCw className="w-3.5 h-3.5 text-violet-400" />,
  anomaly: <AlertTriangle className="w-3.5 h-3.5 text-churn-red" />,
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationBell() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: countData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => api.getNotificationCount(),
    refetchInterval: 60_000, // poll every minute
  })

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.getNotifications({ limit: 20 }),
    enabled: open,
  })

  const readMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-count'] })
    },
  })

  const readAllMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-count'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteNotification(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-count'] })
    },
  })

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const unreadCount = countData?.count || 0
  const notifications: Notification[] = data?.data || []

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center w-8 h-8 rounded hover:bg-card text-text-muted hover:text-text-primary transition-colors"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-churn-red text-white text-[10px] font-bold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-text-primary">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => readAllMutation.mutate()}
                  disabled={readAllMutation.isPending}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-mrr-green transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  All read
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-text-muted text-sm">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-6 h-6 mx-auto mb-2 opacity-30 text-text-muted" />
                <p className="text-text-muted text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`group flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-surface transition-colors ${!n.is_read ? 'bg-emerald-950/20' : ''}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {TYPE_ICONS[n.type] || <Clock className="w-3.5 h-3.5 text-text-muted" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => { if (!n.is_read) readMutation.mutate(n.id); setOpen(false) }}
                        className="text-xs font-medium text-text-primary hover:text-mrr-green line-clamp-2"
                      >
                        {n.title}
                      </Link>
                    ) : (
                      <p className="text-xs font-medium text-text-primary line-clamp-2">{n.title}</p>
                    )}
                    {n.body && (
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{n.body}</p>
                    )}
                    <p className="text-[10px] text-text-muted mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!n.is_read && (
                      <button
                        onClick={() => readMutation.mutate(n.id)}
                        className="p-0.5 rounded text-text-muted hover:text-mrr-green"
                        title="Mark as read"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(n.id)}
                      className="p-0.5 rounded text-text-muted hover:text-churn-red"
                      title="Delete"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
