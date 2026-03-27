import axios, { AxiosInstance } from 'axios'
import { supabase } from '../config/supabase'
import { cryptoService } from './crypto.service'
import logger from '../logger'
import type { HubSpotCompany, HubSpotContact, HubSpotDeal } from '../types'

const HS_BASE = 'https://api.hubapi.com'
const PAGE_SIZE = 100

interface SyncResult {
  companies_synced: number
  contacts_synced: number
  deals_synced: number
}

class HubSpotService {
  private async getToken(tenantId: string): Promise<string> {
    const { data, error } = await supabase
      .from('settings')
      .select('hubspot_token_encrypted')
      .eq('tenant_id', tenantId)
      .single()

    if (error || !data?.hubspot_token_encrypted) {
      throw new Error('HubSpot token not configured')
    }
    return cryptoService.decrypt(data.hubspot_token_encrypted)
  }

  private createClient(token: string): AxiosInstance {
    return axios.create({
      baseURL: HS_BASE,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000,
    })
  }

  async syncAll(tenantId: string): Promise<SyncResult> {
    const token = await this.getToken(tenantId)
    const client = this.createClient(token)

    // Create sync log
    const { data: log } = await supabase
      .from('hubspot_sync_logs')
      .insert({ tenant_id: tenantId, status: 'running' })
      .select()
      .single()

    const logId = log?.id

    try {
      const [companies, contacts, deals] = await Promise.all([
        this.syncCompanies(tenantId, client),
        this.syncContacts(tenantId, client),
        this.syncDeals(tenantId, client),
      ])

      if (logId) {
        await supabase
          .from('hubspot_sync_logs')
          .update({
            status: 'done',
            companies_synced: companies,
            contacts_synced: contacts,
            deals_synced: deals,
          })
          .eq('id', logId)
      }

      return { companies_synced: companies, contacts_synced: contacts, deals_synced: deals }
    } catch (err: any) {
      logger.error('HubSpot sync failed', err)
      if (logId) {
        await supabase
          .from('hubspot_sync_logs')
          .update({ status: 'error', error_message: err.message })
          .eq('id', logId)
      }
      throw err
    }
  }

  private async syncCompanies(tenantId: string, client: AxiosInstance): Promise<number> {
    let after: string | undefined
    let count = 0
    const properties = ['name', 'domain', 'hs_object_id']

    do {
      const params: Record<string, unknown> = { limit: PAGE_SIZE, properties: properties.join(',') }
      if (after) params.after = after

      const { data } = await client.get('/crm/v3/objects/companies', { params })
      const companies: HubSpotCompany[] = data.results || []

      if (companies.length > 0) {
        const rows = companies.map((c) => ({
          tenant_id: tenantId,
          name: c.properties.name || `Company ${c.id}`,
          domain: c.properties.domain || null,
          hubspot_id: c.id,
          external_id: null,
        }))

        const { error } = await supabase
          .from('companies')
          .upsert(rows, { onConflict: 'hubspot_id', ignoreDuplicates: false })

        if (error) logger.warn('Company upsert error', error)
        count += companies.length
      }

      after = data.paging?.next?.after
    } while (after)

    logger.info(`HubSpot sync: ${count} companies`)
    return count
  }

  private async syncContacts(tenantId: string, client: AxiosInstance): Promise<number> {
    let after: string | undefined
    let count = 0
    const properties = ['firstname', 'lastname', 'email', 'associatedcompanyid']

    do {
      const params: Record<string, unknown> = {
        limit: PAGE_SIZE,
        properties: properties.join(','),
        associations: 'companies',
      }
      if (after) params.after = after

      const { data } = await client.get('/crm/v3/objects/contacts', { params })
      const contacts: HubSpotContact[] = data.results || []

      if (contacts.length > 0) {
        // Resolve company IDs from hubspot_id
        const companyHsIds = contacts
          .map((c) => c.properties.associatedcompanyid)
          .filter(Boolean)

        let companyMap: Record<string, string> = {}
        if (companyHsIds.length > 0) {
          const { data: companies } = await supabase
            .from('companies')
            .select('id, hubspot_id')
            .in('hubspot_id', companyHsIds)
            .eq('tenant_id', tenantId)

          companies?.forEach((c) => {
            if (c.hubspot_id) companyMap[c.hubspot_id] = c.id
          })
        }

        const rows = contacts.map((c) => {
          const firstName = c.properties.firstname || ''
          const lastName = c.properties.lastname || ''
          const name = `${firstName} ${lastName}`.trim() || `Contact ${c.id}`
          const hsCompanyId = c.properties.associatedcompanyid

          return {
            tenant_id: tenantId,
            name,
            email: c.properties.email || null,
            hubspot_id: c.id,
            company_id: hsCompanyId ? (companyMap[hsCompanyId] || null) : null,
          }
        })

        const { error } = await supabase
          .from('contacts')
          .upsert(rows, { onConflict: 'hubspot_id', ignoreDuplicates: false })

        if (error) logger.warn('Contact upsert error', error)
        count += contacts.length
      }

      after = data.paging?.next?.after
    } while (after)

    logger.info(`HubSpot sync: ${count} contacts`)
    return count
  }

  private async syncDeals(tenantId: string, client: AxiosInstance): Promise<number> {
    let after: string | undefined
    let count = 0
    const properties = ['dealname', 'amount', 'closedate', 'dealstage', 'pipeline', 'hs_object_id']

    do {
      const params: Record<string, unknown> = {
        limit: PAGE_SIZE,
        properties: properties.join(','),
        associations: 'companies',
      }
      if (after) params.after = after

      const { data } = await client.get('/crm/v3/objects/deals', { params })
      const deals: HubSpotDeal[] = data.results || []

      if (deals.length > 0) {
        // Only sync closed-won deals with an amount
        const closedWon = deals.filter(
          (d) =>
            d.properties.dealstage === 'closedwon' &&
            d.properties.amount &&
            parseFloat(d.properties.amount) > 0 &&
            d.properties.closedate
        )

        for (const deal of closedWon) {
          const amount = parseFloat(deal.properties.amount!)
          const closeDate = deal.properties.closedate!.split('T')[0]

          // Find associated company
          const hsCompanyId = deal.associations?.companies?.results?.[0]?.id
          let companyId: string | null = null

          if (hsCompanyId) {
            const { data: company } = await supabase
              .from('companies')
              .select('id')
              .eq('hubspot_id', hsCompanyId)
              .eq('tenant_id', tenantId)
              .single()
            companyId = company?.id || null
          }

          if (!companyId) continue

          // Create invoice from deal
          const invoiceNumber = `HS-${deal.id}`
          const { error } = await supabase.from('invoices').upsert(
            {
              tenant_id: tenantId,
              company_id: companyId,
              invoice_number: invoiceNumber,
              issue_date: closeDate,
              service_period_start: closeDate,
              service_period_end: new Date(
                new Date(closeDate).setMonth(new Date(closeDate).getMonth() + 1)
              )
                .toISOString()
                .split('T')[0],
              total_amount: amount,
              currency: 'USD',
              status: 'paid',
              source_type: 'hubspot',
              hubspot_deal_id: deal.id,
            },
            { onConflict: 'tenant_id,invoice_number', ignoreDuplicates: true }
          )

          if (error) logger.warn('Deal invoice upsert error', error)
        }

        count += deals.length
      }

      after = data.paging?.next?.after
    } while (after)

    logger.info(`HubSpot sync: ${count} deals processed`)
    return count
  }

  async getLastSyncLog(tenantId: string) {
    const { data } = await supabase
      .from('hubspot_sync_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('synced_at', { ascending: false })
      .limit(1)
      .single()

    return data
  }

  async getSyncLogs(tenantId: string, limit = 20) {
    const { data } = await supabase
      .from('hubspot_sync_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('synced_at', { ascending: false })
      .limit(limit)

    return data || []
  }
}

export const hubspotService = new HubSpotService()
