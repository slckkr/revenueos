import { Router, Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import Joi from 'joi'
import { env } from '../config/env'
import { AppError, asyncHandler } from '../middleware/error.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
})

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body

    if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
    }

    const token = jwt.sign(
      {
        sub: env.TENANT_ID,
        username,
        tenantId: env.TENANT_ID,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    )

    res.json({
      success: true,
      data: {
        token,
        user: { username, tenantId: env.TENANT_ID },
      },
    })
  })
)

export default router
