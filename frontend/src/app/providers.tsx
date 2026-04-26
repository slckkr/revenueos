'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useThemeStore, applyTheme } from '@/lib/theme'

function ThemeInitializer() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Rehydrate once, then apply the resolved theme
    useThemeStore.persist.rehydrate()
    const theme = useThemeStore.getState().theme
    applyTheme(theme)
    setMounted(true)
  }, [])

  // Subscribe to future theme changes after mount
  const theme = useThemeStore((s) => s.theme)
  useEffect(() => {
    if (mounted) applyTheme(theme)
  }, [theme, mounted])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeInitializer />
      {children}
    </QueryClientProvider>
  )
}
