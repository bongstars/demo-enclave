import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import {
	useLogout,
	usePrivy,
	useExperimentalFarcasterSigner,
	FarcasterWithMetadata,
	UseWalletsInterface,
	useWallets,
} from '@privy-io/react-auth'
import Head from 'next/head'
import useSWRMutation from 'swr/mutation'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import {
	ExternalEd25519Signer,
	HubRestAPIClient,
} from '@standard-crypto/farcaster-js'
import axios from 'axios'
import { ethers } from 'ethers'
export default function FarcasterPage() {
	const router = useRouter()

	const [castInput, setCastInput] = useState('')

	const { user } = usePrivy()
	const { wallets, ready } = useWallets() as UseWalletsInterface
	const wallet = wallets[0]
	const [walletBalance, setWalletBalance] = useState<string>('0')
	const [recipientAddress, setRecipientAddress] = useState<string>('')
	useEffect(() => {
		const fetchBalance = async () => {
				console.log(process.env.NEXT_ALCHEMY_BASE_URL)
				const provider = new ethers.providers.JsonRpcProvider(
					'https://base.mainnet.org'
				)
				const balance = await provider.getBalance(wallet.address)
				setWalletBalance(ethers.utils.formatEther(balance))
			}
		}

		if (ready && wallet) {
			fetchBalance()
		}
	}, [ready, wallet])

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text)
		toast('Wallet address copied to clipboard!')
	}
	const sendEth = async () => {
		if (!wallet || !recipientAddress) return

		try {
			const provider = await wallet.getEthereumProvider()
			console.log(provider)
			const transactionRequest = {
				to: recipientAddress,
				value: ethers.utils.parseEther('0.0001').toHexString(),
			}

			const transactionHash = await provider.request({
				method: 'eth_sendTransaction',
				params: [transactionRequest],
			})

			toast(`Transaction sent! Hash: ${transactionHash}`)
			setRecipientAddress('')
		} catch (error) {
			console.error('Error sending transaction:', error)
			toast.error('Failed to send transaction')
		}
	}

	const {
		getFarcasterSignerPublicKey,
		signFarcasterMessage,
		requestFarcasterSignerFromWarpcast,
	} = useExperimentalFarcasterSigner()

	const privySigner = new ExternalEd25519Signer(
		signFarcasterMessage,
		getFarcasterSignerPublicKey
	)
	const hubClient = new HubRestAPIClient({
		hubUrl: 'https://hub-api.neynar.com',
		axiosInstance: axios.create({
			headers: { api_key: 'NEYNAR_PRIVY_DEMO' },
		}),
	})

	const { logout } = useLogout({
		onSuccess: () => {
			console.log('🫥 ✅ logOut onSuccess')
			router.push('/')
		},
	})

	const farcasterAccount = user?.linkedAccounts.find(
		(a) => a.type === 'farcaster'
	) as FarcasterWithMetadata
	const signerPublicKey = farcasterAccount?.signerPublicKey

	const getUserCasts = async (
		url: string
	): Promise<{
		result: any
		next: string
	}> => {
		return (await (
			await fetch(url, {
				headers: {
					api_key: 'NEYNAR_PRIVY_DEMO',
					accept: 'application/json',
				},
			})
		).json()) as {
			result: any
			next: string
		}
	}

	const { data, isMutating, trigger } = useSWRMutation<{
		result: any
		next: string
	}>(
		farcasterAccount
			? `https://api.neynar.com/v1/farcaster/casts?fid=${farcasterAccount.fid}&viewerFid=3&limit=25`
			: undefined,
		getUserCasts
	)

	useEffect(() => {
		if (farcasterAccount) setTimeout(() => trigger(), 2000)
	}, [!!farcasterAccount])

	// return (
	// 	<>
	// 		<Head>
	// 			<title>Privy Farcaster Demo</title>
	// 		</Head>

	// 		<main className='flex min-h-screen flex-col bg-privy-light-blue px-4 py-6 sm:px-20 sm:py-10'>
	// 			<ToastContainer />
	// 			{ready && wallet && (
	// 				<div className='mt-6 rounded-md border bg-slate-100 p-4'>
	// 					<p className='mb-2 text-sm font-bold uppercase text-gray-600'>
	// 						Wallet Information
	// 					</p>
	// 					<p className='my-2 text-sm text-gray-600'>
	// 						Address: {wallet.address}
	// 						<button
	// 							className='ml-2 rounded-md bg-violet-600 px-2 py-1 text-xs text-white hover:bg-violet-700'
	// 							onClick={() => copyToClipboard(wallet.address)}
	// 						>
	// 							Copy
	// 						</button>
	// 					</p>
	// 					<p className='my-2 text-sm text-gray-600'>
	// 						Balance: {walletBalance} ETH
	// 					</p>
	// 					<div className='mt-4'>
	// 						<input
	// 							type='text'
	// 							placeholder='Enter recipient address'
	// 							value={recipientAddress}
	// 							onChange={(e) => setRecipientAddress(e.target.value)}
	// 							className='w-full rounded-md p-2'
	// 						/>
	// 						<button
	// 							onClick={sendEth}
	// 							disabled={!recipientAddress}
	// 							className='mt-2 rounded-md bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-700 disabled:bg-gray-400'
	// 						>
	// 							Send 0.0001 ETH
	// 						</button>
	// 					</div>
	// 				</div>
	// 			)}
	// 			<div className='flex flex-row justify-between'>
	// 				<h1 className='text-2xl font-semibold'>Farcaster Demo</h1>
	// 				<div className='flex flex-row gap-4'>
	// 					<button
	// 						onClick={logout}
	// 						className='rounded-md bg-violet-200 px-4 py-2 text-sm text-violet-700 hover:text-violet-900'
	// 					>
	// 						Logout
	// 					</button>
	// 				</div>
	// 			</div>
	// 			<p className='mb-2 mt-6 text-sm font-bold uppercase text-gray-600'>
	// 				Farcaster User
	// 			</p>
	// 			<div className='rounded-md border bg-slate-100 p-4'>
	// 				<p className='my-2 text-sm text-gray-600'>
	// 					Display Name: {farcasterAccount?.displayName}
	// 				</p>
	// 				<p className='my-2 text-sm text-gray-600'>
	// 					Username: {farcasterAccount?.username}
	// 				</p>
	// 				<p className='my-2 text-sm text-gray-600'>
	// 					Farcaster Signer: {signerPublicKey ?? 'NONE'}
	// 				</p>
	// 			</div>
	// 			<div className='flex flex-wrap gap-4'>
	// 				{!signerPublicKey && (
	// 					<button
	// 						className='mt-4 rounded-md bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-700'
	// 						onClick={requestFarcasterSignerFromWarpcast}
	// 						disabled={!!signerPublicKey}
	// 					>
	// 						Request Farcaster Signer from Warpcast
	// 					</button>
	// 				)}
	// 			</div>
	// 			<p className='mb-2 mt-6 text-sm font-bold uppercase text-gray-600'>
	// 				Submit a cast
	// 			</p>
	// 			<div className='flex flex-wrap gap-4'>
	// 				<input
	// 					placeholder='My cast text!'
	// 					className='w-full rounded-md'
	// 					type='text'
	// 					value={castInput}
	// 					onChange={(e) => setCastInput(e.target.value)}
	// 				></input>
	// 				<button
	// 					className='rounded-md bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-700'
	// 					onClick={async () => {
	// 						const { hash } = await hubClient.submitCast(
	// 							{
	// 								text: castInput,
	// 							},
	// 							farcasterAccount.fid!,
	// 							privySigner
	// 						)
	// 						setCastInput('')
	// 						toast(`Submitted cast. Message hash: ${hash}`)
	// 						setTimeout(() => trigger(), 2000)
	// 					}}
	// 					disabled={!castInput}
	// 				>
	// 					Submit
	// 				</button>
	// 			</div>
	// 		</main>
	// 	</>
	// )
	return (
		<>
			<Head>
				<title>Privy Farcaster Demo</title>
			</Head>

			<main className='min-h-screen bg-gray-900 p-6 text-white sm:p-10'>
				<ToastContainer theme='dark' />

				<div className='mb-8 flex items-center justify-between'>
					<h1 className='text-3xl font-bold'>Farcaster Demo</h1>
					<button
						onClick={logout}
						className='rounded bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-700'
					>
						Logout
					</button>
				</div>

				{ready && wallet && (
					<div className='mb-8 rounded-lg bg-gray-800 p-6'>
						<h2 className='mb-4 text-xl font-bold'>Wallet Information</h2>
						<p className='mb-2'>
							Address: {wallet.address}
							<button
								className='ml-2 rounded bg-indigo-600 px-2 py-1 text-xs hover:bg-indigo-700'
								onClick={() => copyToClipboard(wallet.address)}
							>
								Copy
							</button>
						</p>
						<p className='mb-4'>Balance: {walletBalance} ETH</p>
						<input
							type='text'
							placeholder='Enter recipient address'
							value={recipientAddress}
							onChange={(e) => setRecipientAddress(e.target.value)}
							className='mb-2 w-full rounded bg-gray-700 p-2'
						/>
						<button
							onClick={sendEth}
							disabled={!recipientAddress}
							className='w-full rounded bg-indigo-600 py-2 text-sm hover:bg-indigo-700 disabled:bg-gray-600'
						>
							Send 0.0001 ETH
						</button>
					</div>
				)}
				<div className='mb-8 rounded-lg bg-gray-800 p-6'>
					<h2 className='mb-4 text-xl font-bold'>Farcaster User</h2>
					<p className='mb-2'>Display Name: {farcasterAccount?.displayName}</p>
					<p className='mb-2'>Username: {farcasterAccount?.username}</p>
					<p className='mb-2'>Farcaster Signer: {signerPublicKey ?? 'NONE'}</p>
					{!signerPublicKey && (
						<button
							className='mt-4 rounded bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-700'
							onClick={requestFarcasterSignerFromWarpcast}
						>
							Request Farcaster Signer from Warpcast
						</button>
					)}
				</div>

				<div className='rounded-lg bg-gray-800 p-6'>
					<h2 className='mb-4 text-xl font-bold'>Submit a Cast</h2>
					<input
						placeholder='My cast text!'
						className='mb-4 w-full rounded bg-gray-700 p-2'
						type='text'
						value={castInput}
						onChange={(e) => setCastInput(e.target.value)}
					/>
					<button
						className='w-full rounded bg-indigo-600 py-2 text-sm hover:bg-indigo-700 disabled:bg-gray-600'
						onClick={async () => {
							const { hash } = await hubClient.submitCast(
								{ text: castInput },
								farcasterAccount.fid!,
								privySigner
							)
							setCastInput('')
							toast(`Submitted cast. Message hash: ${hash}`)
							setTimeout(() => trigger(), 2000)
						}}
						disabled={!castInput}
					>
						Submit
					</button>
				</div>
			</main>
		</>
	)
}
