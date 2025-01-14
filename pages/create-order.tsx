import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import { Enclave, SignMode } from 'enclavemoney'
import { ethers } from 'ethers'
import { toast } from 'react-hot-toast'

const ENCLAVE_API_KEY = process.env.NEXT_PUBLIC_ENCLAVE_API_KEY
const enclave = new Enclave(ENCLAVE_API_KEY)

const SUPPORTED_CHAINS = [
	{ id: 1, name: 'Ethereum' },
	{ id: 10, name: 'Optimism' },
	{ id: 42161, name: 'Arbitrum' },
] as const

const COMMON_TOKENS = {
	1: [
		// Ethereum
		{ address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC' },
		{ address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT' },
	],
	10: [
		// Optimism
		{ address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC' },
		{ address: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', symbol: 'USDT' },
	],
	42161: [
		// Arbitrum
		{ address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC' },
		{ address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT' },
	],
} as const

interface FormData {
	amount: string
	targetPrice: string
	chainId: number
	tokenAddress: string
}

export default function CreateOrder() {
	const { user, login, authenticated, signMessage } = usePrivy()
	const [isLoading, setIsLoading] = useState(false)
	const [smartWalletAddress, setSmartWalletAddress] = useState('')
	const [sessionKey, setSessionKey] = useState('')

	const [formData, setFormData] = useState<FormData>({
		amount: '',
		targetPrice: '',
		chainId: SUPPORTED_CHAINS[0].id,
		tokenAddress: COMMON_TOKENS[SUPPORTED_CHAINS[0].id][0].address,
	})

	useEffect(() => {
		if (authenticated && user?.wallet?.address) {
			initializeSmartWallet()
		}
	}, [authenticated, user])

	async function initializeSmartWallet() {
		try {
			setIsLoading(true)
			// Create smart account if doesn't exist
			const account = await enclave.createSmartAccount(user.wallet.address)
			setSmartWalletAddress(account.wallet.scw_address)

			// Generate session key
			const sessionKeyPair = ethers.Wallet.createRandom()
			setSessionKey(sessionKeyPair.privateKey)

			// Enable session key
			const validAfter = Math.floor(Date.now() / 1000)
			const validUntil = validAfter + 24 * 60 * 60 // 24 hours

			const builtTxn = await enclave.enableSessionKey(
				account.wallet.scw_address,
				sessionKeyPair.address,
				validAfter,
				validUntil,
				formData.chainId
			)

			// Sign with Privy wallet
			const signature = await signMessage(
				ethers.getBytes(builtTxn.messageToSign)
			)

			// Submit transaction to enable session key
			await enclave.submitTransaction(
				signature,
				builtTxn.userOp,
				formData.chainId,
				account.wallet.scw_address,
				builtTxn.signMode
			)

			toast.success('Smart wallet initialized successfully')
		} catch (error) {
			console.error('Error initializing smart wallet:', error)
			toast.error('Failed to initialize smart wallet')
		} finally {
			setIsLoading(false)
		}
	}

	async function createOrder(e: React.FormEvent) {
		e.preventDefault()
		if (!authenticated) {
			await login()
			return
		}

		if (!smartWalletAddress || !sessionKey) {
			toast.error('Smart wallet not initialized')
			return
		}

		try {
			setIsLoading(true)
			const response = await fetch('/api/create-order', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...formData,
					smartWalletAddress,
					sessionKey,
				}),
			})

			if (!response.ok) {
				const error = await response.json()
				throw new Error(error.message || 'Failed to create order')
			}

			const data = await response.json()
			toast.success('Order created successfully!')

			// Reset form
			setFormData({
				amount: '',
				targetPrice: '',
				chainId: formData.chainId,
				tokenAddress: formData.tokenAddress,
			})
		} catch (error) {
			console.error('Error creating order:', error)
			toast.error(
				error instanceof Error ? error.message : 'Failed to create order'
			)
		} finally {
			setIsLoading(false)
		}
	}

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		const { name, value } = e.target
		setFormData((prev) => ({
			...prev,
			[name]: value,
			// Reset token address when chain changes
			...(name === 'chainId' && {
				tokenAddress:
					COMMON_TOKENS[Number(value) as keyof typeof COMMON_TOKENS][0].address,
			}),
		}))
	}

	return (
		<div className='mx-auto mt-10 max-w-md rounded-lg bg-white p-6 shadow'>
			<h1 className='mb-6 text-2xl font-bold'>Create Token Purchase Order</h1>

			{!authenticated ? (
				<button
					onClick={login}
					className='w-full rounded bg-blue-500 p-2 text-white transition-colors hover:bg-blue-600'
					disabled={isLoading}
				>
					Connect Wallet
				</button>
			) : (
				<form onSubmit={createOrder} className='space-y-4'>
					<div>
						<label className='mb-2 block'>Network</label>
						<select
							name='chainId'
							value={formData.chainId}
							onChange={handleInputChange}
							className='w-full rounded border p-2'
							disabled={isLoading}
						>
							{SUPPORTED_CHAINS.map((chain) => (
								<option key={chain.id} value={chain.id}>
									{chain.name}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className='mb-2 block'>Token</label>
						<select
							name='tokenAddress'
							value={formData.tokenAddress}
							onChange={handleInputChange}
							className='w-full rounded border p-2'
							disabled={isLoading}
						>
							{COMMON_TOKENS[
								formData.chainId as keyof typeof COMMON_TOKENS
							].map((token) => (
								<option key={token.address} value={token.address}>
									{token.symbol}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className='mb-2 block'>Amount</label>
						<input
							type='number'
							name='amount'
							value={formData.amount}
							onChange={handleInputChange}
							className='w-full rounded border p-2'
							placeholder='Enter amount'
							required
							min='0'
							step='any'
							disabled={isLoading}
						/>
					</div>

					<div>
						<label className='mb-2 block'>Target Price (USD)</label>
						<input
							type='number'
							name='targetPrice'
							value={formData.targetPrice}
							onChange={handleInputChange}
							className='w-full rounded border p-2'
							placeholder='Enter target price'
							required
							min='0'
							step='any'
							disabled={isLoading}
						/>
					</div>

					{smartWalletAddress && (
						<div className='text-sm text-gray-600'>
							Smart Wallet: {smartWalletAddress.slice(0, 6)}...
							{smartWalletAddress.slice(-4)}
						</div>
					)}

					<button
						type='submit'
						className='w-full rounded bg-green-500 p-2 text-white transition-colors hover:bg-green-600 disabled:bg-gray-400'
						disabled={isLoading || !smartWalletAddress}
					>
						{isLoading ? 'Processing...' : 'Create Order'}
					</button>
				</form>
			)}
		</div>
	)
}
