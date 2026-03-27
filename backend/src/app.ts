import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { env } from './config/env'
import logger from './logger'
import router from './routes'
import { errorHandler, notFoundHandler } from './middleware/error.middleware'

const app = express()

// Security
app.use(helmet())
app.use(cors({
  origin: env.ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
}))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Request logging
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`)
  next()
})

// Routes
app.use('/api', router)

// 404 + Error handling
app.use(notFoundHandler)
app.use(errorHandler)

export default app
