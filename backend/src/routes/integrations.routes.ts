import { Router, Request, Response } from 'express'
import Joi from 'joi'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

const updateSchema = Joi.object({
  status: Joi.string().valid('connected', 'disconnected', 'file_import', 'coming_soon', 'error').optional(),
  config_json: Joi.object().optional(),
  last_sync_at: Joi.string().isoDate().optional().allow(null),
}).min(1)

// GET /integrations
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('provider')

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  // If no integrations found, seed defaults on-the-fly
  if (!data || data.length === 0) {
    const defaults = [
      { tenant_id: tenantId, provider: 'hubspot',     status: 'disconnected' },
      { tenant_id: tenantId, provider: 'logo',        status: 'file_import'  },
      { tenant_id: tenantId, provider: 'trendyol',    status: 'coming_soon'  },
      { tenant_id: tenantId, provider: 'woocommerce', status: 'coming_soon'  },
      { tenant_id: tenantId, provider: 'stripe',      status: 'coming_soon'  },
      { tenant_id: tenantId, provider: 'salesforce',  status: 'coming_soon'  },
    ]
    const { data: seeded } = await supabase.from('integrations').insert(defaults).select()
    return res.json({ success: true, data: seeded || defaults })
  }

  res.json({ success: true, data })
}))

// PATCH /integrations/:provider
router.patch('/:provider', validate(updateSchema), asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('integrations')
    .update(req.body)
    .eq('tenant_id', tenantId)
    .eq('provider', req.params.provider)
    .select()
    .single()

  if (error || !data) throw new AppError('Integration not found', 404, 'NOT_FOUND')

  res.json({ success: true, data })
}))

export default router
