import { Connection } from '@solana/web3.js';

const solanaRpcUrl = process.env.SOLANA_RPC_URL;

if (!solanaRpcUrl) {
  throw new Error('Solana RPC URL is not set in environment variables.');
}

const connection = new Connection(solanaRpcUrl, 'confirmed');

export default connection;

export async function getSolanaVersion() {
  try {
    const version = await connection.getVersion();
    console.log('Connected to Solana node. Version:', version);
    return version;
  } catch (error) {
    console.error('Failed to connect to Solana node:', error);
    throw error;
  }
}

// You can add other Solana-related utility functions here
// e.g., createSPLToken, setTokenMetadata
