import { Router, Request, Response } from 'express'
import Joi from 'joi'
import { supabase } from '../config/supabase'
import { AppError, asyncHandler } from '../middleware/error.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

const createSchema = Joi.object({
  date: Joi.string().isoDate().required(),
  from_currency: Joi.string().length(3).uppercase().required(),
  to_currency: Joi.string().length(3).uppercase().required(),
  rate: Joi.number().positive().required(),
  source: Joi.string().default('manual'),
})

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { date, from, to } = req.query as Record<string, string>

  let query = supabase
    .from('fx_rates')
    .select('*')
    .order('date', { ascending: false })
    .limit(200)

  if (date) query = query.eq('date', date)
  if (from) query = query.eq('from_currency', from.toUpperCase())
  if (to) query = query.eq('to_currency', to.toUpperCase())

  const { data, error } = await query
  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.json({ success: true, data })
}))

router.post('/', validate(createSchema), asyncHandler(async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('fx_rates')
    .upsert(req.body, { onConflict: 'date,from_currency,to_currency' })
    .select()
    .single()

  if (error) throw new AppError(error.message, 500, 'DB_ERROR')

  res.status(201).json({ success: true, data })
}))

export default router
