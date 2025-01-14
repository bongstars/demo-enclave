import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { Enclave, SignMode } from 'enclavemoney';
import { ethers } from 'ethers';

const ENCLAVE_API_KEY = process.env.NEXT_PUBLIC_ENCLAVE_API_KEY;
const enclave = new Enclave(ENCLAVE_API_KEY);

export default function CreateOrder() {
  const { user, login, authenticated, signMessage } = usePrivy();
  const [amount, setAmount] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [smartWalletAddress, setSmartWalletAddress] = useState('');
  const [sessionKey, setSessionKey] = useState('');

  useEffect(() => {
    if (authenticated && user?.wallet?.address) {
      initializeSmartWallet();
    }
  }, [authenticated, user]);

  async function initializeSmartWallet() {
    try {
      // Create smart account if doesn't exist
      const account = await enclave.createSmartAccount(user.wallet.address);
      setSmartWalletAddress(account.wallet.scw_address);

      // Generate session key (you might want to store this securely)
      const sessionKeyPair = ethers.Wallet.createRandom();
      setSessionKey(sessionKeyPair.privateKey);

      // Enable session key
      const validAfter = Math.floor(Date.now() / 1000);
      const validUntil = validAfter + (24 * 60 * 60); // 24 hours

      const builtTxn = await enclave.enableSessionKey(
        account.wallet.scw_address,
        sessionKeyPair.address,
        validAfter,
        validUntil,
        10 // Optimism network
      );

      // Sign with Privy wallet
      const signature = await signMessage(ethers.getBytes(builtTxn.messageToSign));

      // Submit transaction to enable session key
      await enclave.submitTransaction(
        signature,
        builtTxn.userOp,
        10,
        account.wallet.scw_address,
        builtTxn.signMode
      );
    } catch (error) {
      console.error('Error initializing smart wallet:', error);
    }
  }

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!authenticated) {
      await login();
      return;
    }

    try {
      // Create order on your backend
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          targetPrice,
          smartWalletAddress,
          sessionKey
        }),
      });

      if (!response.ok) throw new Error('Failed to create order');

      alert('Order created successfully!');
    } catch (error) {
      console.error('Error creating order:', error);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6">Create Token Purchase Order</h1>

      {!authenticated ? (
        <button
          onClick={login}
          className="w-full bg-blue-500 text-white p-2 rounded"
        >
          Connect Wallet
        </button>
      ) : (
        <form onSubmit={createOrder} className="space-y-4">
          <div>
            <label className="block mb-2">Amount (USDC)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block mb-2">Target Price (USD)</label>
            <input
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-green-500 text-white p-2 rounded"
          >
            Create Order
          </button>
        </form>
      )}
    </div>
  );
