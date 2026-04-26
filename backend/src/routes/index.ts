import { Router, Request, Response } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import authRoutes from './auth.routes'
import companiesRoutes from './companies.routes'
import contactsRoutes from './contacts.routes'
import productsRoutes from './products.routes'
import subscriptionsRoutes from './subscriptions.routes'
import invoicesRoutes from './invoices.routes'
import ledgerRoutes from './ledger.routes'
import metricsRoutes from './metrics.routes'
import hubspotRoutes from './hubspot.routes'
import importRoutes from './import.routes'
import fxRoutes from './fx.routes'
import settingsRoutes from './settings.routes'
import exportRoutes from './export.routes'
import paymentsRoutes from './payments.routes'
import rolesRoutes from './roles.routes'
import integrationsRoutes from './integrations.routes'
import segmentsRoutes from './segments.routes'
import reconciliationRoutes from './reconciliation.routes'
import financialInputsRoutes from './financial-inputs.routes'
import advancedMetricsRoutes from './advanced-metrics.routes'
import productMetricsRoutes from './product-metrics.routes'
import dataHealthRoutes from './data-health.routes'
import revenueEventsRoutes from './revenue-events.routes'
import dealsRoutes from './deals.routes'
import proposalsRoutes from './proposals.routes'
import contractsRoutes from './contracts.routes'
import activitiesRoutes from './activities.routes'
import funnelRoutes from './funnel.routes'
import cohortsRoutes from './cohorts.routes'
import usageEventsRoutes from './usage-events.routes'
import scoresRoutes from './scores.routes'
import playbooksRoutes from './playbooks.routes'
import notificationsRoutes from './notifications.routes'
import notesRoutes from './notes.routes'
import tasksRoutes from './tasks.routes'
import slackRoutes from './slack.routes'
import churnRiskRoutes from './churn-risk.routes'
import forecastRoutes from './forecast.routes'
import benchmarksRoutes from './benchmarks.routes'
import reportsRoutes from './reports.routes'
import mappingRoutes from './mapping.routes'

const router = Router()

// Public routes
router.use('/auth', authRoutes)

// Health check (public)
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'revenueos-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
})

// All routes below require authentication
router.use(authenticate)

router.use('/companies',     companiesRoutes)
router.use('/contacts',      contactsRoutes)
router.use('/products',      productsRoutes)
router.use('/subscriptions', subscriptionsRoutes)
router.use('/invoices',      invoicesRoutes)
router.use('/ledger',        ledgerRoutes)
router.use('/metrics',       metricsRoutes)
router.use('/hubspot',       hubspotRoutes)
router.use('/import',        importRoutes)
router.use('/fx',            fxRoutes)
router.use('/settings',      settingsRoutes)
router.use('/export',        exportRoutes)
router.use('/payments',      paymentsRoutes)
router.use('/roles',         rolesRoutes)
router.use('/integrations',  integrationsRoutes)
router.use('/segments',          segmentsRoutes)
router.use('/reconciliation',    reconciliationRoutes)
router.use('/financial-inputs',  financialInputsRoutes)
router.use('/advanced-metrics',  advancedMetricsRoutes)
router.use('/product-metrics',   productMetricsRoutes)
router.use('/data-health',       dataHealthRoutes)
router.use('/revenue-events',    revenueEventsRoutes)
router.use('/deals',             dealsRoutes)
router.use('/proposals',         proposalsRoutes)
router.use('/contracts',         contractsRoutes)
router.use('/activities',        activitiesRoutes)
router.use('/funnel',            funnelRoutes)
router.use('/cohorts',           cohortsRoutes)
router.use('/usage-events',      usageEventsRoutes)
router.use('/scores',            scoresRoutes)
router.use('/playbooks',         playbooksRoutes)
router.use('/notifications',     notificationsRoutes)
router.use('/notes',             notesRoutes)
router.use('/tasks',             tasksRoutes)
router.use('/slack',             slackRoutes)
router.use('/churn-risk',        churnRiskRoutes)
router.use('/forecast',          forecastRoutes)
router.use('/benchmarks',        benchmarksRoutes)
router.use('/reports',           reportsRoutes)
router.use('/mapping',           mappingRoutes)

export default router
