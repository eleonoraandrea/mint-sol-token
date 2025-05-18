import { NextResponse } from 'next/server';
import PinataSDK from '@pinata/sdk';

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
const pinataJwt = process.env.PINATA_JWT;

async function getPinataClient() {
  if (pinataJwt) {
    return new PinataSDK({ pinataJWTKey: pinataJwt });
  } else if (pinataApiKey && pinataSecretApiKey) {
    return new PinataSDK(pinataApiKey, pinataSecretApiKey);
  }
  throw new Error('Pinata API credentials not configured on server.');
}

export async function POST(request: Request) {
  if (!pinataJwt && (!pinataApiKey || !pinataSecretApiKey)) {
    console.error("Pinata API Key/Secret or JWT not found in environment variables for pinning JSON.");
    return NextResponse.json({ error: 'Pinata API credentials not configured on server for pinning JSON.' }, { status: 500 });
  }

  try {
    const body = await request.json(); // The metadata JSON from the client

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body provided.' }, { status: 400 });
    }

    const pinata = await getPinataClient();

    // Define options for pinning JSON, if any (e.g., custom name for the pin)
    const options = {
      pinataMetadata: {
        name: `${body.name || 'Token'}-Metadata.json`, // Name for the pinned JSON file
        // keyvalues: { type: 'TokenMetadata' } // Example custom key-values
      },
      pinataOptions: {
        cidVersion: 0 as 0 | 1, // Or 1, explicitly typed
      }
    };

    const result = await pinata.pinJSONToIPFS(body, options);

    return NextResponse.json({ ipfsHash: result.IpfsHash }, { status: 200 });

  } catch (error) {
    console.error('Error pinning JSON to Pinata with SDK:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    let details = errorMessage;
    if (error && typeof error === 'object') {
        if ('details' in error && (error as any).details) {
            details = (error as any).details;
        } else if ('reason' in error && (error as any).reason) {
            details = (error as any).reason;
        } else if ('message' in error && (error as any).message) {
            details = (error as any).message;
        }
    }
    return NextResponse.json({ error: 'Failed to pin JSON to IPFS using SDK.', details: details }, { status: 500 });
  }
}
