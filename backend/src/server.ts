import 'dotenv/config'
import app from './app'
import { env } from './config/env'
import logger from './logger'
import { startHubSpotSyncJob } from './jobs/hubspot-sync.job'
import { startFxRatesJob } from './jobs/fx-rates.job'

const server = app.listen(env.PORT, () => {
  logger.info(`RevenueOS backend running on port ${env.PORT} [${env.NODE_ENV}]`)

  // Start background jobs
  if (env.NODE_ENV !== 'test') {
    startHubSpotSyncJob()
    startFxRatesJob()
  }
})

const shutdown = (signal: string) => {
  logger.info(`${signal} received — shutting down gracefully`)
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err)
  process.exit(1)
})
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason as Error)
  process.exit(1)
})
