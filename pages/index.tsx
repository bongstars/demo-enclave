import Blobby from '@/components/svg/blobby'
import { useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import Head from 'next/head'
import { useRouter } from 'next/router'

const Index = () => {
	const router = useRouter()
	const { ready, authenticated, logout } = usePrivy()
	const { login } = useLogin({
		onComplete(user, isNewUser, wasPreviouslyAuthenticated) {
			console.log('🔑 ✅ Login success', {
				user,
				isNewUser,
				wasPreviouslyAuthenticated,
			})
			router.push('/farcaster')
		},
		onError(error) {
			console.log('🔑 🚨 Login error', { error })
		},
	})

	return (
		<>
			<Head>
				<title>Privy Farcaster Demo</title>
			</Head>
			<main className='bg-gray-900 text-white'>
				<div className='flex h-screen w-screen flex-col items-center justify-center px-4'>
					<Blobby className='text-indigo-500' />{' '}
					{/* Adjust SVG color if needed */}
					<h1 className='my-4 text-3xl font-bold'>Privy Farcaster Demo</h1>
					<p className='mb-8 text-center text-lg text-gray-300'>
						You can login with and write to Farcaster using Privy.
					</p>
					<div className='w-full max-w-md'>
						<button
							className='w-full rounded-lg bg-indigo-600 px-4 py-3 text-lg font-semibold shadow-lg transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-600'
							onClick={login}
							disabled={!ready || authenticated}
						>
							Login
						</button>
					</div>
				</div>
			</main>
		</>
	)
}

export default Index
