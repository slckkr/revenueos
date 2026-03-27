'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, setToken } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await api.login(username, password)
      setToken(res.data.token)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary">
            Revenue<span className="text-mrr-green">OS</span>
          </h1>
          <p className="text-text-secondary text-sm mt-1">Revenue Operations Platform</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-text-primary mb-6">Sign in</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label block mb-1">Username</label>
              <input
                type="text"
                className="input w-full"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="label block mb-1">Password</label>
              <input
                type="password"
                className="input w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <p className="text-churn-red text-sm">{error}</p>
            )}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
