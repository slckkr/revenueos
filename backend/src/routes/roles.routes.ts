import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'

const router = Router()

// GET /roles
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId

  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data })
}))

export default router
