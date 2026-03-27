import { Request, Response, NextFunction } from 'express'
import Joi from 'joi'
import { AppError } from './error.middleware'

export const validate = (schema: Joi.ObjectSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true })
    if (error) {
      const details = error.details.map((d) => d.message).join('; ')
      return next(new AppError(details, 400, 'VALIDATION_ERROR'))
    }
    next()
  }

export const validateQuery = (schema: Joi.ObjectSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, { abortEarly: false, stripUnknown: true })
    if (error) {
      const details = error.details.map((d) => d.message).join('; ')
      return next(new AppError(details, 400, 'VALIDATION_ERROR'))
    }
    req.query = value
    next()
  }
