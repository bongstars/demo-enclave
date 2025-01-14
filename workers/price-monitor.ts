// workers/price-monitor.ts
import { PrismaClient } from '@prisma/client'
import { Enclave } from 'enclavemoney'
import { ethers } from 'ethers'

const prisma = new PrismaClient()
const enclave = new Enclave(process.env.ENCLAVE_API_KEY!)

// Configure price feed (example using CoinGecko)
const COINGECKO_API = 'https://api.coingecko.com/api/v3'
const TOKEN_ID = 'ethereum' // replace with your token

async function getCurrentPrice(): Promise<number> {
	try {
		const response = await fetch(
			`${COINGECKO_API}/simple/price?ids=${TOKEN_ID}&vs_currencies=usd`
		)
		const data = await response.json()
		return data[TOKEN_ID].usd
	} catch (error) {
		console.error('Error fetching price:', error)
		throw error
	}
}

async function executeOrder(order: any) {
	try {
		// Build the transaction for token purchase
		const usdcContractAddress = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' // USDC on Optimism

		const amount = ethers.parseUnits(order.amount.toString(), 6) // USDC has 6 decimals

		// Create the call data for the swap
		// This is a simplified example - you'll need to implement the actual swap logic
		const swapData = {
			encodedData: '0x', // Implement your swap encoding logic
			targetContractAddress: usdcContractAddress,
			value: 0,
		}

		// Execute the transaction using the session key
		const response = await enclave.delegateAction(
			[swapData],
			10, // Optimism network
			order.smartWalletAddress
		)

		// Update order status
		await prisma.order.update({
			where: { id: order.id },
			data: {
				status: 'EXECUTED',
				executedAt: new Date(),
				transactionHash: response.hash,
			},
		})
	} catch (error) {
		console.error(`Error executing order ${order.id}:`, error)

		await prisma.order.update({
			where: { id: order.id },
			data: {
				status: 'FAILED',
			},
		})
	}
}

async function checkPendingOrders() {
	try {
		// Get current price
		const currentPrice = await getCurrentPrice()

		// Get all pending orders
		const pendingOrders = await prisma.order.findMany({
			where: {
				status: 'PENDING',
			},
		})

		// Check each order
		for (const order of pendingOrders) {
			if (currentPrice <= order.targetPrice) {
				console.log(`Executing order ${order.id} at price $${currentPrice}`)
				await executeOrder(order)
			}
		}
	} catch (error) {
		console.error('Error checking pending orders:', error)
	}
}
