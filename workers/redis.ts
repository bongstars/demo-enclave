// src/config/redis.ts
import IORedis from 'ioredis'
import { logger } from '../utils/logger'

const redis = new IORedis(process.env.REDIS_URL, {
	maxRetriesPerRequest: null,
	enableReadyCheck: false,
})

redis.on('error', (error) => {
	logger.error('Redis error:', error)
})

export { redis }

// src/constants/index.ts
export const ORDER_STATUS = {
	PENDING: 'PENDING',
	EXECUTED: 'EXECUTED',
	FAILED: 'FAILED',
} as const

export const QUEUE_NAMES = {
	PRICE_CHECK: 'price-check',
	SWAP_EXECUTION: 'swap-execution',
} as const

export const REDIS_PREFIX = 'price-monitor:'

export const DEFAULT_SLIPPAGE_BPS = 100
export const MAX_PRICE_IMPACT = 5

export const CHAIN_IDS = {
	8453: { name: 'base', label: 'Base' },
} as const

// src/utils/logger.ts
import winston from 'winston'

export const logger = winston.createLogger({
	level: process.env.LOG_LEVEL || 'info',
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.json(),
	),
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.simple(),
			),
		}),
	],
})
