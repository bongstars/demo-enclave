import { ZeroXQuoteResponse } from '../types'

export function validateQuote(quote: ZeroXQuoteResponse): void {
	if (!quote.transaction || !quote.buyAmount || !quote.minBuyAmount) {
		throw new Error('Invalid quote response structure')
	}

	if (BigInt(quote.buyAmount) <= BigInt(0)) {
		throw new Error('Invalid buy amount in quote')
	}
}

export function calculatePriceImpact(quote: ZeroXQuoteResponse): number {
	const expectedPrice = parseFloat(quote.price)
	const actualPrice = parseFloat(quote.guaranteedPrice)
	return ((expectedPrice - actualPrice) / expectedPrice) * 100
}

// src/services/orderService.ts
import { getDb } from '../lib/db'
import { Order } from '../types'

export async function getActiveOrders(): Promise<Order[]> {
	const db = await getDb()
	return db.all(`
    SELECT * FROM orders
    WHERE status = 'PENDING'
    ORDER BY createdAt ASC
  `)
}

export async function updateOrderStatus(
	orderId: string,
	update: Partial<Order>,
): Promise<void> {
	const db = await getDb()
	const sets = Object.entries(update)
		.map(([key, value]) => `${key} = ?`)
		.join(', ')

	await db.run(
		`
    UPDATE orders
    SET ${sets}, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
		[...Object.values(update), orderId],
	)
}
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
