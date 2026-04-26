'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  Zap,
  Upload,
  Settings,
  LogOut,
  TrendingUp,
  Sun,
  Moon,
  Package,
  ShieldAlert,
  DollarSign,
  ShieldCheck,
  Briefcase,
  FileText,
  FileSignature,
  Activity,
  Filter,
  Users2,
  Heart,
  Lightbulb,
  BarChart2,
} from 'lucide-react'
import { logout } from '@/lib/auth'
import { useThemeStore } from '@/lib/theme'
import { NotificationBell } from './NotificationBell'
import clsx from 'clsx'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/companies', icon: Building2, label: 'Companies' },
  { href: '/products', icon: Package, label: 'Products' },
  { href: '/ledger', icon: BookOpen, label: 'Ledger' },
  { href: '/events', icon: Zap, label: 'Events' },
  // Sales Intelligence
  { href: '/deals', icon: Briefcase, label: 'Deals' },
  { href: '/proposals', icon: FileText, label: 'Proposals' },
  { href: '/contracts', icon: FileSignature, label: 'Contracts' },
  { href: '/activities', icon: Activity, label: 'Activities' },
  // Analytics
  { href: '/funnel', icon: Filter, label: 'Funnel' },
  { href: '/cohorts', icon: Users2, label: 'Cohorts' },
  // AI Engine
  { href: '/expansion', icon: TrendingUp, label: 'Expansion' },
  { href: '/health', icon: Heart, label: 'Health' },
  { href: '/playbooks', icon: Lightbulb, label: 'Playbooks' },
  // Predictive
  { href: '/forecast', icon: TrendingUp, label: 'Forecast' },
  { href: '/benchmarks', icon: BarChart2, label: 'Benchmarks' },
  { href: '/executive', icon: Briefcase, label: 'Executive' },
  // Data & Settings
  { href: '/import', icon: Upload, label: 'Import' },
  { href: '/financial-inputs', icon: DollarSign, label: 'Fin. Inputs' },
  { href: '/data-health', icon: ShieldCheck, label: 'Data Health' },
  { href: '/ops', icon: ShieldAlert, label: 'Ops Center' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const theme = useThemeStore((s) => s.theme)
  const toggle = useThemeStore((s) => s.toggle)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <aside className="w-56 h-screen bg-surface border-r border-border flex flex-col fixed left-0 top-0 z-20">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-mrr-green" />
          <span className="font-bold text-text-primary">
            Revenue<span className="text-mrr-green">OS</span>
          </span>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = !!pathname && (pathname === item.href || pathname.startsWith(`${item.href}/`))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors',
                isActive
                  ? 'bg-mrr-green bg-opacity-10 text-mrr-green'
                  : 'text-text-secondary hover:text-text-primary hover:bg-card'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="p-2 border-t border-border space-y-0.5">
        {/* Theme toggle — only renders after mount to avoid SSR mismatch */}
        <button
          onClick={toggle}
          suppressHydrationWarning
          className="flex items-center gap-3 px-3 py-2 rounded text-sm font-medium
                     text-text-secondary hover:text-text-primary hover:bg-card w-full transition-colors"
        >
          {mounted ? (
            theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4" />
          )}
          {mounted ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : 'Light mode'}
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded text-sm font-medium
                     text-text-secondary hover:text-churn-red hover:bg-card w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
