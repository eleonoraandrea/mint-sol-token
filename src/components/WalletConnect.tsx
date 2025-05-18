"use client";

import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css'; // Default styles

export default function WalletConnect() {
  return (
    <div className="flex justify-end p-4">
      <WalletMultiButton />
    </div>
  );
}
