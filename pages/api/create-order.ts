// pages/api/create-order.ts
import { NextApiRequest, NextApiResponse } from 'next'
import prisma from '@/lib/prisma'

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
) {
	if (req.method !== 'POST') {
		return res.status(405).json({ message: 'Method not allowed' })
	}

	try {
		const { amount, targetPrice, smartWalletAddress, sessionKey } = req.body

		// Store order in database
		const order = await prisma.order.create({
			data: {
				amount: parseFloat(amount),
				targetPrice: parseFloat(targetPrice),
				smartWalletAddress,
				sessionKey,
				status: 'PENDING',
			},
		})

		return res.status(200).json({
			message: 'Order created successfully',
			orderId: order.id,
		})
	} catch (error) {
		console.error('Error creating order:', error)
		return res.status(500).json({ message: 'Internal server error' })
	}
}
