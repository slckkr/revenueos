import { Router, Request, Response } from 'express'
import Joi from 'joi'
import axios from 'axios'
import { supabase } from '../config/supabase'
import { env } from '../config/env'
import { AppError, asyncHandler } from '../middleware/error.middleware'
import { validate } from '../middleware/validate.middleware'
import { cryptoService } from '../services/crypto.service'

const router = Router()

const updateSchema = Joi.object({
  reporting_currency: Joi.string().length(3).uppercase().optional(),
  recognition_method: Joi.string().valid('accrual', 'cash').optional(),
  hubspot_token: Joi.string().optional().allow('', null),
}).min(1)

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  let { data, error } = await supabase
    .from('settings')
    .select('id, tenant_id, reporting_currency, recognition_method, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .single()

  if (error && error.code === 'PGRST116') {
    // Settings not found — create defaults
    const { data: created, error: createErr } = await supabase
      .from('settings')
      .insert({ tenant_id: tenantId, reporting_currency: 'USD', recognition_method: 'accrual' })
      .select('id, tenant_id, reporting_currency, recognition_method, created_at, updated_at')
      .single()

    if (createErr) throw new AppError(createErr.message, 500, 'DB_ERROR')
    data = created
  } else if (error) {
    throw new AppError(error.message, 500, 'DB_ERROR')
  }

  // Include whether HubSpot is configured (not the token itself)
  const { data: withToken } = await supabase
    .from('settings')
    .select('hubspot_token_encrypted')
    .eq('tenant_id', tenantId)
    .single()

  res.json({
    success: true,
    data: {
      ...data,
      hubspot_connected: !!(withToken?.hubspot_token_encrypted),
    },
  })
}))

router.patch('/', validate(updateSchema), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId
  const { hubspot_token, ...rest } = req.body

  const updateData: Record<string, unknown> = { ...rest }

  if (hubspot_token !== undefined) {
    updateData.hubspot_token_encrypted = hubspot_token
      ? cryptoService.encrypt(hubspot_token)
      : null
  }

  const { data, error } = await supabase
    .from('settings')
    .update(updateData)
    .eq('tenant_id', tenantId)
    .select('id, tenant_id, reporting_currency, recognition_method, updated_at')
    .single()

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data })
}))

// POST /settings/hubspot/test — test HubSpot token
router.post('/hubspot/test', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data: settings } = await supabase
    .from('settings')
    .select('hubspot_token_encrypted')
    .eq('tenant_id', tenantId)
    .single()

  if (!settings?.hubspot_token_encrypted) {
    throw new AppError('HubSpot token not configured', 400, 'NOT_CONFIGURED')
  }

  const token = cryptoService.decrypt(settings.hubspot_token_encrypted)

  try {
    const response = await axios.get('https://api.hubapi.com/crm/v3/objects/companies?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    })

    res.json({
      success: true,
      data: { valid: true, message: 'HubSpot token is valid' },
    })
  } catch (err: any) {
    if (err.response?.status === 401) {
      throw new AppError('HubSpot token is invalid or expired', 400, 'INVALID_TOKEN')
    }
    throw new AppError('Could not connect to HubSpot', 502, 'HUBSPOT_UNREACHABLE')
  }
}))

export default router
