import type { AppProps } from 'next/app'
import '@/styles/globals.css'
import { PrivyProvider } from '@privy-io/react-auth'
import {
	base,
	baseGoerli,
	mainnet,
	sepolia,
	polygon,
	polygonMumbai,
} from 'viem/chains'

const App = ({ Component, pageProps }: AppProps) => {
	return (
		<PrivyProvider
			appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
			config={{
				loginMethods: ['farcaster'],
				defaultChain: base,
				embeddedWallets: {
					createOnLogin: 'all-users',
				},
			}}
		>
			<Component {...pageProps} />
		</PrivyProvider>
	)
}

export default App
