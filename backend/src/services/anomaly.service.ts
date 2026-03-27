import { metricsService } from './metrics.service'
import type { AnomalyFlag, MetricsSummary } from '../types'

/**
 * Rule-based anomaly detection engine.
 * Analyzes current month metrics and generates actionable flags with explanations.
 *
 * Rule catalog:
 * - NRR critical: NRR < 80%
 * - NRR warning: NRR < 100%
 * - MRR decline: MoM MRR drop > 10%
 * - MRR severe decline: MoM MRR drop > 20%
 * - Churn warning: revenue churn rate > 3%
 * - Churn critical: revenue churn rate > 7%
 * - Quick ratio: < 1 (losing more than gaining)
 * - Quick ratio danger: < 0.5
 * - GRR warning: GRR < 85%
 * - No new revenue: new_mrr = 0 for 2+ months
 */

class AnomalyService {
  async getFlags(tenantId: string, month: string): Promise<AnomalyFlag[]> {
    const current = await metricsService.getSummary(tenantId, month)
    const prevMonth = getPrevMonth(month)
    const prev = await metricsService.getSummary(tenantId, prevMonth)

    const flags: AnomalyFlag[] = []

    // ─── NRR Rules ────────────────────────────────────────────────────────────

    if (current.nrr > 0 && current.nrr < 80) {
      flags.push({
        type: 'nrr_critical',
        severity: 'critical',
        metric: 'NRR',
        value: current.nrr,
        threshold: 80,
        message: `NRR is critically low at ${current.nrr.toFixed(1)}%`,
        explanation: `Net Revenue Retention of ${current.nrr.toFixed(1)}% means you are losing revenue from existing customers faster than you are expanding. ` +
          `For every $100 from last month's customers, you are retaining only $${current.nrr.toFixed(0)}. ` +
          `This indicates significant churn and/or contraction. Investigate churn reasons and prioritize customer success interventions immediately.`,
      })
    } else if (current.nrr > 0 && current.nrr < 100) {
      flags.push({
        type: 'nrr_below_100',
        severity: 'warning',
        metric: 'NRR',
        value: current.nrr,
        threshold: 100,
        message: `NRR is ${current.nrr.toFixed(1)}% — below break-even`,
        explanation: `NRR below 100% means existing customers are generating less revenue than the previous period. ` +
          `Churn and contraction (${formatCurrency(Math.abs(current.churned_mrr) + Math.abs(current.contraction_mrr))}) ` +
          `exceeds expansion (${formatCurrency(current.expansion_mrr)}). ` +
          `Focus on expansion motions and reducing contraction to reach NRR > 100%.`,
      })
    }

    // ─── MRR Decline Rules ────────────────────────────────────────────────────

    if (prev.mrr > 0 && current.mrr < prev.mrr) {
      const declinePercent = ((prev.mrr - current.mrr) / prev.mrr) * 100

      if (declinePercent > 20) {
        flags.push({
          type: 'mrr_severe_decline',
          severity: 'critical',
          metric: 'MRR',
          value: current.mrr,
          threshold: prev.mrr * 0.8,
          message: `MRR dropped ${declinePercent.toFixed(1)}% month-over-month`,
          explanation: `MRR fell from ${formatCurrency(prev.mrr)} to ${formatCurrency(current.mrr)}, ` +
            `a drop of ${formatCurrency(prev.mrr - current.mrr)} (${declinePercent.toFixed(1)}%). ` +
            `This is a severe decline that requires immediate investigation. ` +
            `Key drivers: Churn ${formatCurrency(Math.abs(current.churned_mrr))}, ` +
            `Contraction ${formatCurrency(Math.abs(current.contraction_mrr))}.`,
        })
      } else if (declinePercent > 10) {
        flags.push({
          type: 'mrr_decline',
          severity: 'warning',
          metric: 'MRR',
          value: current.mrr,
          threshold: prev.mrr * 0.9,
          message: `MRR declined ${declinePercent.toFixed(1)}% month-over-month`,
          explanation: `MRR decreased by ${formatCurrency(prev.mrr - current.mrr)} (${declinePercent.toFixed(1)}%) this month. ` +
            `Review customer health scores and check for at-risk accounts before next month.`,
        })
      }
    }

    // ─── Revenue Churn Rules ──────────────────────────────────────────────────

    if (current.revenue_churn_rate > 7) {
      flags.push({
        type: 'revenue_churn_critical',
        severity: 'critical',
        metric: 'Revenue Churn Rate',
        value: current.revenue_churn_rate,
        threshold: 7,
        message: `Revenue churn rate is critically high at ${current.revenue_churn_rate.toFixed(1)}%`,
        explanation: `You lost ${current.revenue_churn_rate.toFixed(1)}% of your MRR base this month to churn and contraction. ` +
          `At this rate, you would lose ~${(current.revenue_churn_rate * 12).toFixed(0)}% of revenue annually. ` +
          `Churn: ${formatCurrency(Math.abs(current.churned_mrr))}, Contraction: ${formatCurrency(Math.abs(current.contraction_mrr))}. ` +
          `Initiate emergency customer success reviews for all at-risk accounts.`,
      })
    } else if (current.revenue_churn_rate > 3) {
      flags.push({
        type: 'revenue_churn_warning',
        severity: 'warning',
        metric: 'Revenue Churn Rate',
        value: current.revenue_churn_rate,
        threshold: 3,
        message: `Revenue churn rate at ${current.revenue_churn_rate.toFixed(1)}% — above healthy threshold`,
        explanation: `Revenue churn of ${current.revenue_churn_rate.toFixed(1)}% exceeds the healthy 3% monthly threshold (36% annually). ` +
          `${current.churned_customers} customer(s) churned this month. ` +
          `Review exit survey data and schedule QBRs with top-revenue accounts.`,
      })
    }

    // ─── Quick Ratio Rules ────────────────────────────────────────────────────

    if (current.quick_ratio > 0 && current.quick_ratio < 0.5) {
      flags.push({
        type: 'quick_ratio_danger',
        severity: 'critical',
        metric: 'Quick Ratio',
        value: current.quick_ratio,
        threshold: 1,
        message: `Quick Ratio is ${current.quick_ratio.toFixed(2)} — growth engine is losing badly`,
        explanation: `Quick Ratio measures new+expansion revenue vs. churn+contraction. ` +
          `A ratio of ${current.quick_ratio.toFixed(2)} means for every $1 gained, $${(1 / current.quick_ratio).toFixed(2)} is lost. ` +
          `New + Expansion: ${formatCurrency(current.new_mrr + current.expansion_mrr)}, ` +
          `Churn + Contraction: ${formatCurrency(Math.abs(current.churned_mrr) + Math.abs(current.contraction_mrr))}. ` +
          `The growth engine is in reverse — urgent intervention needed.`,
      })
    } else if (current.quick_ratio > 0 && current.quick_ratio < 1) {
      flags.push({
        type: 'quick_ratio_low',
        severity: 'warning',
        metric: 'Quick Ratio',
        value: current.quick_ratio,
        threshold: 1,
        message: `Quick Ratio below 1 (${current.quick_ratio.toFixed(2)}) — losing more than gaining`,
        explanation: `With a Quick Ratio of ${current.quick_ratio.toFixed(2)}, revenue lost to churn and contraction exceeds new and expansion revenue. ` +
          `Healthy SaaS companies maintain a Quick Ratio > 4. Focus on reducing churn while growing new bookings.`,
      })
    }

    // ─── GRR Rules ────────────────────────────────────────────────────────────

    if (current.grr > 0 && current.grr < 85) {
      flags.push({
        type: 'grr_low',
        severity: 'warning',
        metric: 'GRR',
        value: current.grr,
        threshold: 85,
        message: `Gross Revenue Retention at ${current.grr.toFixed(1)}% — below industry standard`,
        explanation: `GRR of ${current.grr.toFixed(1)}% (excludes expansion, max 100%) indicates that you are retaining less than 85% of your base revenue. ` +
          `Industry benchmarks: SMB 80–85%, Mid-market 85–90%, Enterprise 90–95%. ` +
          `Revenue lost to pure churn this month: ${formatCurrency(Math.abs(current.churned_mrr))}.`,
      })
    }

    // ─── No New Revenue Rule ──────────────────────────────────────────────────

    if (current.new_mrr === 0 && prev.new_mrr === 0 && current.mrr > 0) {
      flags.push({
        type: 'no_new_revenue',
        severity: 'warning',
        metric: 'New MRR',
        value: 0,
        threshold: 1,
        message: 'No new customer revenue for 2+ consecutive months',
        explanation: `There has been no new customer MRR in this month or last month. ` +
          `Without new customer acquisition, growth can only come from expansion — and churn will eventually outpace it. ` +
          `Review top-of-funnel metrics and sales pipeline health.`,
      })
    }

    // Sort by severity
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
    flags.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    return flags
  }
}

function getPrevMonth(month: string): string {
  const d = new Date(`${month.slice(0, 7)}-01`)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().split('T')[0]
}

function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export const anomalyService = new AnomalyService()
