// pages/api/create-order.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
) {
	if (req.method !== 'POST') {
		return res.status(405).json({ message: 'Method not allowed' })
	}

	try {
		const {
			amount,
			targetPrice,
			smartWalletAddress,
			sessionKey,
			tokenAddress,
			chainId,
		} = req.body

		const db = await getDb()

		const orderId = uuidv4()

		await db.run(
			`INSERT INTO orders (
        id, amount, targetPrice, smartWalletAddress,
        sessionKey, tokenAddress, chainId, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				orderId,
				amount,
				targetPrice,
				smartWalletAddress,
				sessionKey,
				tokenAddress,
				chainId,
				'PENDING',
			]
		)

		return res.status(200).json({
			message: 'Order created successfully',
			orderId,
		})
	} catch (error) {
		console.error('Error creating order:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}
