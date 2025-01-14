// workers/price-monitor.ts
import { getDb } from '../lib/db'
import { Enclave } from 'enclavemoney'
import { ethers } from 'ethers'

const enclave = new Enclave(process.env.ENCLAVE_API_KEY!)

interface Order {
	id: string
	amount: number
	targetPrice: number
	smartWalletAddress: string
	sessionKey: string
	tokenAddress: string
	chainId: number
	status: string
}

async function getCurrentPrice(
	tokenAddress: string,
	chainId: number
): Promise<number> {
	try {
		// You might want to use different price feeds based on the chain
		const response = await fetch(
			`${COINGECKO_API}/simple/token_price/${getChainName(
				chainId
			)}?contract_addresses=${tokenAddress}&vs_currencies=usd`
		)
		const data = await response.json()
		return data[tokenAddress.toLowerCase()].usd
	} catch (error) {
		console.error('Error fetching price:', error)
		throw error
	}
}

async function executeOrder(order: Order) {
	const db = await getDb()

	try {
		// Build the transaction for token purchase
		const amount = ethers.parseUnits(order.amount.toString(), 6) // Adjust decimals based on token

		// Create the swap data
		const swapData = {
			encodedData: '0x', // Implement your swap encoding logic
			targetContractAddress: order.tokenAddress,
			value: 0,
		}

		// Execute the transaction using the session key
		const response = await enclave.delegateAction(
			[swapData],
			order.chainId,
			order.smartWalletAddress
		)

		// Update order status
		await db.run(
			`UPDATE orders
       SET status = ?, executedAt = CURRENT_TIMESTAMP, transactionHash = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
			['EXECUTED', response.hash, order.id]
		)
	} catch (error) {
		console.error(`Error executing order ${order.id}:`, error)

		await db.run(
			`UPDATE orders
       SET status = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
			['FAILED', order.id]
		)
	}
}

async function checkPendingOrders() {
	const db = await getDb()

	try {
		// Get all pending orders
		const pendingOrders: Order[] = await db.all(
			`SELECT * FROM orders WHERE status = 'PENDING'`
		)

		// Group orders by token address and chain ID to minimize API calls
		const groupedOrders = groupOrdersByToken(pendingOrders)

		for (const [key, orders] of Object.entries(groupedOrders)) {
			const [tokenAddress, chainId] = key.split(':')
			const currentPrice = await getCurrentPrice(
				tokenAddress,
				parseInt(chainId)
			)

			for (const order of orders) {
				if (currentPrice <= order.targetPrice) {
					console.log(`Executing order ${order.id} at price $${currentPrice}`)
					await executeOrder(order)
				}
			}
		}
	} catch (error) {
		console.error('Error checking pending orders:', error)
	}
}

function groupOrdersByToken(orders: Order[]): Record<string, Order[]> {
	return orders.reduce((acc, order) => {
		const key = `${order.tokenAddress}:${order.chainId}`
		if (!acc[key]) {
			acc[key] = []
		}
		acc[key].push(order)
		return acc
	}, {} as Record<string, Order[]>)
}

function getChainName(chainId: number): string {
	const chains: Record<number, string> = {
		1: 'ethereum',
		10: 'optimism',
		42161: 'arbitrum',
		// Add more chains as needed
	}
	return chains[chainId] || 'ethereum'
}

// Run the monitor
async function startMonitor() {
	console.log('Starting price monitor...')

	while (true) {
		await checkPendingOrders()
		// Wait for 1 minute
		await new Promise((resolve) => setTimeout(resolve, 60000))
	}
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
	console.log('Shutting down price monitor...')
	const db = await getDb()
	await db.close()
	process.exit(0)
})

// Start the monitor
startMonitor().catch(console.error)
