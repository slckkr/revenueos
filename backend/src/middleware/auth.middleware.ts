import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { AppError } from './error.middleware'

export interface JwtPayload {
  sub: string
  username: string
  tenantId: string
  iat: number
  exp: number
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('No token provided', 401, 'UNAUTHORIZED'))
  }

  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload
    req.user = decoded
    next()
  } catch {
    next(new AppError('Invalid or expired token', 401, 'INVALID_TOKEN'))
  }
}
