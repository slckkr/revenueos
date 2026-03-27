'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useThemeStore, applyTheme } from '@/lib/theme'

function ThemeInitializer() {
  const theme = useThemeStore((s) => s.theme)
  useEffect(() => {
    applyTheme(theme)
  }, [theme])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
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
