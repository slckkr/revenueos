import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        card: 'var(--color-card)',
        border: 'var(--color-border)',
        'border-light': 'var(--color-border-light)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        // Revenue colors (same in both themes)
        'mrr-green': '#10b981',
        'mrr-blue': '#3b82f6',
        'churn-red': '#ef4444',
        'expansion-purple': '#8b5cf6',
        'contraction-orange': '#f97316',
        'reactivation-cyan': '#06b6d4',
        // Status colors
        profit: '#10b981',
        loss: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6',
        neutral: '#6b7280',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '6px',
        md: '10px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.1)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.2)',
        glow: '0 0 20px rgba(16,185,129,0.15)',
      },
    },
  },
  plugins: [],
}

export default config
