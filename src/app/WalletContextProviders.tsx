"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react'; // Added useCallback
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork, WalletError, type WalletAdapter } from '@solana/wallet-adapter-base'; // Added WalletError, WalletAdapter
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

export function WalletContextProviders({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleWalletError = useCallback((error: WalletError, adapter?: WalletAdapter) => {
    console.error("Wallet Adapter Error:", error);
    if (adapter) {
        console.error("Adapter Name:", adapter.name);
        console.error("Adapter ReadyState:", adapter.readyState);
    }
    // You can add a user-facing notification here if desired
    // e.g., toast.error(`Wallet error: ${error.message}`);
  }, []);

  const network = WalletAdapterNetwork.Mainnet; // Changed to Mainnet
  const endpoint = useMemo(() => {
    // Use environment variable for RPC endpoint if available, otherwise default to clusterApiUrl
    const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || clusterApiUrl(network);
    console.log("Using RPC Endpoint:", rpcEndpoint); // For debugging
    return rpcEndpoint;
  }, [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(), // Restored
      new SolflareWalletAdapter({ network }),
    ],
    [network]
  );

  if (!isMounted) {
    // Render nothing or a fallback loader on the server and during initial client mount
    // This ensures wallet adapters which might contain non-serializable objects
    // are not processed during server-side rendering or initial hydration before full client mount.
    return null; 
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false} onError={handleWalletError}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
