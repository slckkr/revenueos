import { supabase } from '../config/supabase'
import { metricsService } from './metrics.service'
import { financialInputsService } from './financial-inputs.service'

export interface AdvancedMetrics {
  month: string
  // Financial inputs available
  has_financial_inputs: boolean
  cogs: number | null
  opex: number | null
  sales_marketing_spend: number | null
  headcount: number | null
  // Derived
  gross_margin: number | null         // %
  profit_margin: number | null        // %
  // Advanced
  cac: number | null
  ltv: number | null
  ltv_cac_ratio: number | null
  cac_payback_months: number | null
  burn_multiple: number | null
  rule_of_40: number | null
  revenue_per_employee: number | null
  magic_number: number | null         // net new ARR Q / SM spend Q-1
  bessemer_efficiency: number | null  // net new ARR / net burn
}

class AdvancedMetricsService {
  async getAdvancedMetrics(tenantId: string, month: string): Promise<AdvancedMetrics> {
    const [fi, summary] = await Promise.all([
      financialInputsService.getForMonth(tenantId, month),
      metricsService.getSummary(tenantId, month),
    ])

    const mrr = summary.mrr
    const arr = mrr * 12
    const arpa = await metricsService.getArpa(tenantId, month)
    const newCustomers = summary.active_customers  // approx — new events
    const churnRate = summary.revenue_churn_rate / 100

    if (!fi) {
      return {
        month,
        has_financial_inputs: false,
        cogs: null, opex: null, sales_marketing_spend: null, headcount: null,
        gross_margin: null, profit_margin: null,
        cac: null, ltv: null, ltv_cac_ratio: null, cac_payback_months: null,
        burn_multiple: null, rule_of_40: null, revenue_per_employee: null,
        magic_number: null, bessemer_efficiency: null,
      }
    }

    const revenue = Number(fi.total_revenue_override ?? mrr)
    const cogs = Number(fi.cogs ?? 0)
    const opex = Number(fi.opex ?? 0)
    const smSpend = Number(fi.sales_marketing_spend ?? 0)
    const headcount = Number(fi.headcount ?? 0)

    // Gross margin
    const grossMargin = revenue > 0 ? round(((revenue - cogs) / revenue) * 100) : null

    // Profit margin
    let profitMargin: number | null = null
    if (fi.profit_margin_override != null) {
      profitMargin = round(Number(fi.profit_margin_override))
    } else if (revenue > 0) {
      profitMargin = round(((revenue - cogs - opex) / revenue) * 100)
    }

    // Count new customers this month
    const { data: newEvt } = await supabase
      .from('revenue_events')
      .select('company_id')
      .eq('tenant_id', tenantId)
      .eq('month', month)
      .eq('event_type', 'NEW')

    const newCustomerCount = new Set((newEvt || []).map((r) => r.company_id)).size

    // CAC
    const cac = newCustomerCount > 0 && smSpend > 0
      ? round(smSpend / newCustomerCount)
      : null

    // LTV = ARPA × (1/monthly_churn) × gross_margin_factor
    const grossMarginFactor = grossMargin != null ? grossMargin / 100 : 1
    const ltv = arpa > 0
      ? churnRate > 0
        ? round(arpa * (1 / churnRate) * grossMarginFactor)
        : round(arpa * 120 * grossMarginFactor) // cap at 10 year if no churn
      : null

    // LTV/CAC
    const ltvCacRatio = ltv != null && cac != null && cac > 0
      ? round(ltv / cac)
      : null

    // CAC Payback months
    const cacPayback = cac != null && arpa > 0 && grossMarginFactor > 0
      ? round(cac / (arpa * grossMarginFactor))
      : null

    // Net burn
    const netBurn = cogs + opex - revenue

    // Burn Multiple: net_burn / (net_new_mrr × 12)
    const netNewArr = summary.net_new_mrr * 12
    const burnMultiple = netNewArr !== 0
      ? round(Math.abs(netBurn) / Math.abs(netNewArr))
      : null

    // Rule of 40: ARR growth rate + profit margin
    const prevYearMonth = getPrevYearMonth(month)
    const arrPrevYear = (await metricsService.getMrr12MonthsAgo(tenantId, prevYearMonth)) * 12
    const arrGrowthRate = arrPrevYear > 0
      ? round(((arr - arrPrevYear) / arrPrevYear) * 100)
      : null

    const ruleOf40 = arrGrowthRate != null && profitMargin != null
      ? round(arrGrowthRate + profitMargin)
      : null

    // Revenue per Employee
    const revPerEmp = headcount > 0 ? round(arr / headcount) : null

    // Magic Number: net new ARR this quarter / SM spend last quarter
    // Simplified: use current net_new_arr × 3 / smSpend × 3
    const magicNumber = smSpend > 0 && netNewArr > 0
      ? round((netNewArr * 3) / (smSpend * 3))
      : null

    // Bessemer Efficiency: net new ARR / net burn
    const bessemer = netBurn > 0 && netNewArr > 0
      ? round(netNewArr / netBurn)
      : null

    return {
      month,
      has_financial_inputs: true,
      cogs, opex, sales_marketing_spend: smSpend, headcount: fi.headcount,
      gross_margin: grossMargin,
      profit_margin: profitMargin,
      cac, ltv, ltv_cac_ratio: ltvCacRatio,
      cac_payback_months: cacPayback,
      burn_multiple: burnMultiple,
      rule_of_40: ruleOf40,
      revenue_per_employee: revPerEmp,
      magic_number: magicNumber,
      bessemer_efficiency: bessemer,
    }
  }
}

function getPrevYearMonth(month: string): string {
  const d = new Date(`${month.slice(0, 7)}-01`)
  d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().split('T')[0]
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

export const advancedMetricsService = new AdvancedMetricsService()
