"use client";

import dynamic from 'next/dynamic';

const WalletConnect = dynamic(() => import('@/components/WalletConnect'), { ssr: false });

export default function ClientWalletConnect() {
  return <WalletConnect />;
}
