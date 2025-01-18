// src/workers/price-monitor.ts
import { getDb } from '../lib/db'
import { Enclave } from 'enclavemoney'
import { ethers } from 'ethers'
import { Queue, Worker, Job, QueueEvents } from 'bullmq'
import { redis } from './redis'
import {
	logger,
	validateQuote,
	calculatePriceImpact,
	updateOrderStatus,
	getActiveOrders,
} from './utils'
import {
	ORDER_STATUS,
	CHAIN_IDS,
	QUEUE_NAMES,
	DEFAULT_SLIPPAGE_BPS,
	MAX_PRICE_IMPACT,
	REDIS_PREFIX,
} from './redis'

// Initialize queues
const priceCheckQueue = new Queue(QUEUE_NAMES.PRICE_CHECK, {
	connection: redis,
	prefix: REDIS_PREFIX,
})

const swapQueue = new Queue(QUEUE_NAMES.SWAP_EXECUTION, {
	connection: redis,
	prefix: REDIS_PREFIX,
})

// Initialize Enclave
const enclave = new Enclave(process.env.ENCLAVE_API_KEY!)

// Interfaces
interface Order {
	id: string
	amount: number
	targetPrice: number
	smartWalletAddress: string
	sessionKey: string
	sellToken: string
	buyToken: string
	chainId: number
	status: string
	createdAt: Date
	updatedAt: Date
	executedAt?: Date
	transactionHash?: string
	error?: string
}

interface ZeroXQuoteResponse {
	buyAmount: string
	transaction: {
		to: string
		data: string
		value: string
		gas: string
		gasPrice: string
	}
	minBuyAmount: string
	price: string
	guaranteedPrice: string
	estimatedGas: string
	allowanceTarget: string
}

// Price checking functions
async function getCurrentPrice(
	tokenAddress: string,
	chainId: number,
): Promise<number> {
	const url = new URL(
		`${process.env.COINGECKO_API}/simple/token_price/${getChainName(chainId)}`,
	)
	url.searchParams.append('contract_addresses', tokenAddress)
	url.searchParams.append('vs_currencies', 'usd')

	try {
		const response = await fetch(url.toString(), {
			headers: {
				Accept: 'application/json',
				'X-CoinGecko-API-Key': process.env.COINGECKO_API_KEY!,
			},
		})

		if (!response.ok) {
			throw new Error(`CoinGecko API error: ${await response.text()}`)
		}

		const data = await response.json()
		return data[tokenAddress.toLowerCase()].usd
	} catch (error) {
		logger.error('Price fetch error:', { error, tokenAddress, chainId })
		throw error
	}
}

// Swap quote functions
async function getSwapQuote(
	sellToken: string,
	buyToken: string,
	sellAmount: string,
	chainId: number,
	takerAddress: string,
): Promise<ZeroXQuoteResponse> {
	const params = new URLSearchParams({
		chainId: chainId.toString(),
		sellToken,
		buyToken,
		sellAmount,
		taker: takerAddress,
		slippageBps: DEFAULT_SLIPPAGE_BPS.toString(),
	})

	try {
		const response = await fetch(
			`${process.env.ZERO_X_API_URL}/swap/permit2/quote?${params.toString()}`,
			{
				headers: {
					'0x-api-key': process.env.ZERO_X_API_KEY!,
					'0x-version': 'v2',
				},
			},
		)

		if (!response.ok) {
			throw new Error(`0x API error: ${await response.text()}`)
		}

		const quote = await response.json()
		validateQuote(quote)
		return quote
	} catch (error) {
		logger.error('Swap quote error:', { error, sellToken, buyToken, chainId })
		throw error
	}
}

// Order execution
async function executeOrder(order: Order): Promise<void> {
	logger.info('Executing order:', { orderId: order.id })

	try {
		const amount = ethers.parseUnits(order.amount.toString(), 6)

		const swapQuote = await getSwapQuote(
			order.sellToken,
			order.buyToken,
			amount.toString(),
			order.chainId,
			order.smartWalletAddress,
		)

		const priceImpact = calculatePriceImpact(swapQuote)
		if (priceImpact > MAX_PRICE_IMPACT) {
			throw new Error(`Price impact too high: ${priceImpact}%`)
		}

		const swapData = {
			encodedData: swapQuote.transaction.data,
			targetContractAddress: swapQuote.transaction.to,
			value: swapQuote.transaction.value,
		}

		const response = await enclave.delegateAction(
			[swapData],
			order.chainId,
			order.smartWalletAddress,
		)

		await updateOrderStatus(order.id, {
			status: ORDER_STATUS.EXECUTED,
			transactionHash: response.hash,
			executedPrice: swapQuote.guaranteedPrice,
		})

		logger.info('Order executed:', {
			orderId: order.id,
			transactionHash: response.hash,
		})
	} catch (error) {
		logger.error('Order execution failed:', {
			orderId: order.id,
			error,
		})

		await updateOrderStatus(order.id, {
			status: ORDER_STATUS.FAILED,
			error: error.message,
		})

		throw error
	}
}

// Queue workers
const priceCheckWorker = new Worker(
	QUEUE_NAMES.PRICE_CHECK,
	async (job: Job) => {
		logger.info('Starting price check job:', { jobId: job.id })

		const pendingOrders = await getActiveOrders()
		const groupedOrders = groupOrdersByToken(pendingOrders)

		for (const [key, orders] of Object.entries(groupedOrders)) {
			const [tokenAddress, chainId] = key.split(':')
			const currentPrice = await getCurrentPrice(
				tokenAddress,
				parseInt(chainId),
			)

			for (const order of orders) {
				if (currentPrice <= order.targetPrice) {
					await swapQueue.add(
						`swap-${order.id}`,
						{ order },
						{
							attempts: 3,
							backoff: {
								type: 'exponential',
								delay: 5000,
							},
							removeOnComplete: true,
							removeOnFail: false,
						},
					)
				}
			}
		}
	},
	{
		connection: redis,
		concurrency: 1,
		limiter: {
			max: 5,
			duration: 1000,
		},
	},
)

const swapWorker = new Worker(
	QUEUE_NAMES.SWAP_EXECUTION,
	async (job: Job) => {
		const { order } = job.data
		await executeOrder(order)
	},
	{
		connection: redis,
		concurrency: 1,
		limiter: {
			max: 1,
			duration: 1000,
		},
	},
)

// Queue event handlers
const queueEvents = new QueueEvents(QUEUE_NAMES.SWAP_EXECUTION, {
	connection: redis,
})

queueEvents.on('completed', ({ jobId }) => {
	logger.info('Swap job completed:', { jobId })
})

queueEvents.on('failed', ({ jobId, failedReason }) => {
	logger.error('Swap job failed:', { jobId, error: failedReason })
})

// Helper functions
function groupOrdersByToken(orders: Order[]): Record<string, Order[]> {
	return orders.reduce(
		(acc, order) => {
			const key = `${order.buyToken}:${order.chainId}`
			if (!acc[key]) {
				acc[key] = []
			}
			acc[key].push(order)
			return acc
		},
		{} as Record<string, Order[]>,
	)
}

function getChainName(chainId: number): string {
	return CHAIN_IDS[chainId]?.name || 'ethereum'
}

// Monitor startup
async function startMonitor() {
	logger.info('Starting price monitor...')

	await priceCheckQueue.add(
		'check-prices',
		{},
		{
			repeat: {
				every: 60000,
				limit: 1,
			},
			removeOnComplete: true,
		},
	)

	// Graceful shutdown
	process.on('SIGTERM', async () => {
		logger.info('Shutting down price monitor...')

		await Promise.all([
			priceCheckQueue.close(),
			swapQueue.close(),
			priceCheckWorker.close(),
			swapWorker.close(),
			queueEvents.close(),
			redis.quit(),
		])

		process.exit(0)
	})
}

// Start monitor if running directly
if (require.main === module) {
	startMonitor().catch((error) => {
		logger.error('Monitor startup failed:', error)
		process.exit(1)
	})
}

export {
	startMonitor,
	priceCheckQueue,
	swapQueue,
	priceCheckWorker,
	swapWorker,
}
