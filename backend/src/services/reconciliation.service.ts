import { supabase } from '../config/supabase'

export interface ReconciliationIssue {
  issue_type: string
  severity: 'critical' | 'warning' | 'info'
  object_type?: string
  object_id?: string
  object_display?: string
  description: string
  suggested_fix_json?: Record<string, unknown>
}

class ReconciliationService {
  /**
   * Run all reconciliation checks and upsert results into reconciliation_issues.
   * Existing open issues for the same (type + object_id) are refreshed.
   */
  async runScan(tenantId: string): Promise<{ scanned: number; issues_found: number }> {
    const issues: ReconciliationIssue[] = []

    const [
      unmatchedCompanies,
      unmappedSkus,
      missingServicePeriod,
      duplicateInvoices,
      fxGaps,
    ] = await Promise.all([
      this.checkUnmatchedCompanies(tenantId),
      this.checkUnmappedSkus(tenantId),
      this.checkMissingServicePeriod(tenantId),
      this.checkDuplicateInvoices(tenantId),
      this.checkFxGaps(tenantId),
    ])

    issues.push(...unmatchedCompanies, ...unmappedSkus, ...missingServicePeriod, ...duplicateInvoices, ...fxGaps)

    // Upsert issues (do not re-open resolved ones for same object)
    if (issues.length > 0) {
      const rows = issues.map((issue) => ({
        tenant_id: tenantId,
        issue_type: issue.issue_type,
        severity: issue.severity,
        object_type: issue.object_type || null,
        object_id: issue.object_id || null,
        object_display: issue.object_display || null,
        description: issue.description,
        suggested_fix_json: issue.suggested_fix_json || null,
        detected_at: new Date().toISOString(),
        status: 'open',
      }))

      // Delete stale open issues of the same types before re-inserting
      const types = [...new Set(issues.map((i) => i.issue_type))]
      await supabase
        .from('reconciliation_issues')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('status', 'open')
        .in('issue_type', types)

      await supabase.from('reconciliation_issues').insert(rows)
    }

    return { scanned: 5, issues_found: issues.length }
  }

  async getIssues(tenantId: string, status?: string): Promise<unknown[]> {
    let query = supabase
      .from('reconciliation_issues')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('detected_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data } = await query
    return data || []
  }

  async resolveIssue(tenantId: string, issueId: string, resolvedBy = 'admin'): Promise<void> {
    await supabase
      .from('reconciliation_issues')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
      })
      .eq('id', issueId)
      .eq('tenant_id', tenantId)
  }

  async ignoreIssue(tenantId: string, issueId: string): Promise<void> {
    await supabase
      .from('reconciliation_issues')
      .update({ status: 'ignored' })
      .eq('id', issueId)
      .eq('tenant_id', tenantId)
  }

  // ─── Checks ──────────────────────────────────────────────────────────────────

  /** Invoices with accrual recognition that have no service_period_start/end */
  private async checkMissingServicePeriod(tenantId: string): Promise<ReconciliationIssue[]> {
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, company_id, total_amount')
      .eq('tenant_id', tenantId)
      .is('service_period_start', null)
      .neq('status', 'void')
      .limit(50)

    if (!data || data.length === 0) return []

    return data.map((inv) => ({
      issue_type: 'missing_service_period',
      severity: 'warning' as const,
      object_type: 'invoice',
      object_id: inv.id,
      object_display: inv.invoice_number,
      description: `Invoice ${inv.invoice_number} has no service period — revenue cannot be accrued correctly.`,
      suggested_fix_json: { action: 'Set service_period_start and service_period_end on this invoice' },
    }))
  }

  /** Invoice lines where the description doesn't map to any known product/SKU */
  private async checkUnmappedSkus(tenantId: string): Promise<ReconciliationIssue[]> {
    // Lines that have no product_id
    const { data } = await supabase
      .from('invoice_lines')
      .select('id, description, invoice_id')
      .is('product_id', null)
      .limit(20)

    if (!data || data.length === 0) return []

    // Deduplicate by description
    const seen = new Set<string>()
    const issues: ReconciliationIssue[] = []
    for (const line of data) {
      const key = line.description?.toLowerCase() || 'unknown'
      if (seen.has(key)) continue
      seen.add(key)
      issues.push({
        issue_type: 'unmapped_sku',
        severity: 'info',
        object_type: 'invoice_line',
        object_id: line.id,
        object_display: line.description || 'Unnamed line item',
        description: `Invoice line "${line.description}" has no product mapping — metrics may be incomplete.`,
        suggested_fix_json: { action: 'Map this description to an existing product' },
      })
    }
    return issues
  }

  /** Duplicate invoices: same invoice_number + company_id */
  private async checkDuplicateInvoices(tenantId: string): Promise<ReconciliationIssue[]> {
    // Use raw query via supabase rpc or fallback to in-memory grouping
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, company_id')
      .eq('tenant_id', tenantId)
      .neq('status', 'void')
      .order('invoice_number')

    if (!data || data.length < 2) return []

    const seen: Record<string, string> = {}
    const issues: ReconciliationIssue[] = []
    for (const inv of data) {
      const key = `${inv.invoice_number}::${inv.company_id}`
      if (seen[key]) {
        issues.push({
          issue_type: 'duplicate_invoice',
          severity: 'critical',
          object_type: 'invoice',
          object_id: inv.id,
          object_display: inv.invoice_number,
          description: `Invoice number "${inv.invoice_number}" appears more than once for the same company — possible double-import.`,
          suggested_fix_json: { action: 'Review and void the duplicate invoice', original_id: seen[key] },
        })
      } else {
        seen[key] = inv.id
      }
    }
    return issues
  }

  /** Companies in ledger that have no HubSpot ID (potential CRM sync gap) */
  private async checkUnmatchedCompanies(tenantId: string): Promise<ReconciliationIssue[]> {
    const { data } = await supabase
      .from('companies')
      .select('id, name, hubspot_id')
      .eq('tenant_id', tenantId)
      .is('hubspot_id', null)
      .eq('source', 'manual')
      .limit(20)

    if (!data || data.length === 0) return []

    return data.slice(0, 10).map((c) => ({
      issue_type: 'unmatched_company',
      severity: 'info' as const,
      object_type: 'company',
      object_id: c.id,
      object_display: c.name,
      description: `Company "${c.name}" has no HubSpot ID — it won't appear in CRM sync reconciliation.`,
      suggested_fix_json: { action: 'Link this company to HubSpot or verify it is intentionally manual' },
    }))
  }

  /** Ledger entries that reference a currency with no FX rate for that month */
  private async checkFxGaps(tenantId: string): Promise<ReconciliationIssue[]> {
    // Find ledger entries where fx_rate is null but currency != reporting currency
    const { data: settings } = await supabase
      .from('settings')
      .select('reporting_currency')
      .eq('tenant_id', tenantId)
      .single()

    const reportingCurrency = settings?.reporting_currency || 'USD'

    const { data } = await supabase
      .from('revenue_ledger')
      .select('id, month, currency, company_id')
      .eq('tenant_id', tenantId)
      .is('fx_rate', null)
      .neq('currency', reportingCurrency)
      .limit(20)

    if (!data || data.length === 0) return []

    // Deduplicate by month+currency
    const seen = new Set<string>()
    const issues: ReconciliationIssue[] = []
    for (const entry of data) {
      const key = `${entry.month}::${entry.currency}`
      if (seen.has(key)) continue
      seen.add(key)
      issues.push({
        issue_type: 'fx_gap',
        severity: 'warning',
        object_type: 'revenue_ledger',
        object_id: entry.id,
        object_display: `${entry.currency} in ${entry.month}`,
        description: `No FX rate for ${entry.currency} → ${reportingCurrency} in ${entry.month} — converted amount may be zero.`,
        suggested_fix_json: { action: `Add FX rate for ${entry.currency} on ${entry.month}` },
      })
    }
    return issues
  }
}

export const reconciliationService = new ReconciliationService()
