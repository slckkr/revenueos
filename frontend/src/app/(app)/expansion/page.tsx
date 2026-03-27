'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { TrendingUp, Zap, RefreshCw, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'

type AccountScore = {
  id: string
  company_id: string
  month: string
  score_type: string
  score_value: number
  reasons_json: string[]
  computed_at: string
  companies?: { id: string; name: string; segment?: string }
}

function ScoreBadge({ score }: { score: number }) {
  if (score >= 80) return <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-950 text-mrr-green">{score}</span>
  if (score >= 60) return <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-950 text-amber-400">{score}</span>
  return <span className="px-2 py-0.5 rounded text-xs font-bold bg-surface text-text-muted">{score}</span>
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#6b7280'
  return (
    <div className="flex-1 h-1.5 bg-surface rounded overflow-hidden">
      <div className="h-full rounded transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
    </div>
  )
}

export default function ExpansionPage() {
  const qc = useQueryClient()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [minScore, setMinScore] = useState(0)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['scores-expansion', month],
    queryFn: () => api.getScores({ score_type: 'expansion', month }),
  })

  const computeMutation = useMutation({
    mutationFn: () => api.computeScores({ score_type: 'expansion' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['scores-expansion'] }); refetch() },
  })

  const scores: AccountScore[] = data?.data || []
  const filtered = minScore > 0 ? scores.filter(s => s.score_value >= minScore) : scores

  const highCount = scores.filter(s => s.score_value >= 80).length
  const medCount = scores.filter(s => s.score_value >= 60 && s.score_value < 80).length
  const totalPipeline = scores.filter(s => s.score_value >= 60).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-mrr-green" />
            Expansion Opportunities
          </h1>
          <p className="text-text-secondary text-sm mt-0.5">AI-scored accounts ranked by expansion potential</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            className="input text-sm py-1"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <button
            onClick={() => computeMutation.mutate()}
            disabled={computeMutation.isPending}
            className="flex items-center gap-2 bg-mrr-green text-black text-sm font-medium px-3 py-1.5 rounded hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${computeMutation.isPending ? 'animate-spin' : ''}`} />
            {computeMutation.isPending ? 'Computing…' : 'Compute Scores'}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-text-muted">High Potential (80+)</p>
          <p className="text-2xl font-bold text-mrr-green mt-1">{highCount}</p>
          <p className="text-xs text-text-muted mt-1">accounts ready for outreach</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted">Medium Potential (60–79)</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{medCount}</p>
          <p className="text-xs text-text-muted mt-1">accounts to nurture</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted">Total Scored</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{scores.length}</p>
          <p className="text-xs text-text-muted mt-1">{totalPipeline} with expansion signal</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-text-muted">Min score:</span>
        {[0, 40, 60, 80].map((s) => (
          <button
            key={s}
            onClick={() => setMinScore(s)}
            className={`text-xs px-2.5 py-1 rounded border transition-colors ${minScore === s ? 'border-mrr-green bg-emerald-950 text-mrr-green' : 'border-border text-text-muted hover:text-text-secondary'}`}
          >
            {s === 0 ? 'All' : `${s}+`}
          </button>
        ))}
        <span className="text-xs text-text-muted ml-auto">{filtered.length} accounts</span>
      </div>

      {/* Ranked list */}
      {isLoading ? (
        <div className="card p-8 text-center text-text-muted text-sm">Loading expansion scores…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Zap className="w-8 h-8 mx-auto mb-3 opacity-30 text-text-muted" />
          <p className="text-text-secondary">No expansion scores yet.</p>
          <p className="text-text-muted text-sm mt-1">Click "Compute Scores" to analyze your accounts.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-text-muted font-medium">#</th>
                <th className="px-4 py-3 text-left text-xs text-text-muted font-medium">Account</th>
                <th className="px-4 py-3 text-left text-xs text-text-muted font-medium w-48">Score</th>
                <th className="px-4 py-3 text-left text-xs text-text-muted font-medium">Top Signal</th>
                <th className="px-4 py-3 text-right text-xs text-text-muted font-medium">Reasons</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} className="border-b border-border hover:bg-surface transition-colors">
                  <td className="px-4 py-3 text-sm text-text-muted">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{s.companies?.name || '—'}</p>
                      {s.companies?.segment && (
                        <p className="text-xs text-text-muted capitalize">{s.companies.segment}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ScoreBadge score={Math.round(s.score_value)} />
                      <ScoreBar score={s.score_value} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-text-secondary line-clamp-1">
                      {(s.reasons_json as string[])[0] || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-text-muted">{(s.reasons_json as string[]).length} signals</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/companies/${s.company_id}`} className="text-text-muted hover:text-mrr-green">
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Signals legend */}
      {filtered.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-text-primary mb-3">Scoring Signals</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
            <div className="flex items-start gap-2"><span className="text-mrr-green font-bold">25pts</span> Revenue growth trend (3-month positive MRR)</div>
            <div className="flex items-start gap-2"><span className="text-mrr-green font-bold">25pts</span> MRR increase last month vs. prior</div>
            <div className="flex items-start gap-2"><span className="text-mrr-green font-bold">20pts</span> Single product usage (multi-product opportunity)</div>
            <div className="flex items-start gap-2"><span className="text-mrr-green font-bold">15pts</span> Contract renewal approaching within 60 days</div>
            <div className="flex items-start gap-2"><span className="text-mrr-green font-bold">15pts</span> High-value activities in last 60 days</div>
          </div>
        </div>
      )}
    </div>
  )
}
