"use client"; // Keep this as a client component, or it could be a server component if it *only* renders WalletContextProviders

import React from 'react';
import { WalletContextProviders } from './WalletContextProviders'; // Import the new component

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletContextProviders>
      {children}
    </WalletContextProviders>
  );
}
