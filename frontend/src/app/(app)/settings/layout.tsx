'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { Settings, Plug, Users } from 'lucide-react'

const tabs = [
  { href: '/settings',              label: 'General',      icon: Settings },
  { href: '/settings/integrations', label: 'Integrations', icon: Plug    },
  { href: '/settings/users',        label: 'Users & Roles', icon: Users  },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="p-6 space-y-6">
      {/* Sub-nav tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-mrr-green text-mrr-green'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* Page content */}
      <div>{children}</div>
    </div>
  )
}
