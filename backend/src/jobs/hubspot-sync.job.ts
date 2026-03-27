import cron from 'node-cron'
import { env } from '../config/env'
import { hubspotService } from '../services/hubspot.service'
import logger from '../logger'

// Run daily at 02:00 UTC
export const startHubSpotSyncJob = () => {
  cron.schedule('0 2 * * *', async () => {
    logger.info('HubSpot daily sync job starting')
    try {
      const result = await hubspotService.syncAll(env.TENANT_ID)
      logger.info('HubSpot daily sync completed', result)
    } catch (err) {
      logger.error('HubSpot daily sync failed', err)
    }
  })

  logger.info('HubSpot sync job scheduled (daily at 02:00 UTC)')
}
