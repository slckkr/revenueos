import cron from 'node-cron'
import { supabase } from '../config/supabase'
import { env } from '../config/env'
import { fxService } from '../services/fx.service'
import logger from '../logger'

// Run nightly at 01:00 UTC
export const startFxRatesJob = () => {
  cron.schedule('0 1 * * *', async () => {
    logger.info('FX rates nightly fetch starting')
    try {
      // Get reporting currency from settings
      const { data: settings } = await supabase
        .from('settings')
        .select('reporting_currency')
        .eq('tenant_id', env.TENANT_ID)
        .single()

      const reportingCurrency = settings?.reporting_currency || 'USD'
      await fxService.fetchAndStoreLatestRates(reportingCurrency)
    } catch (err) {
      logger.error('FX rates fetch failed', err)
    }
  })

  logger.info('FX rates job scheduled (nightly at 01:00 UTC)')
}
