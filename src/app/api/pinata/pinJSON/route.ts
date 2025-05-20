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

  } catch (error: unknown) { // Explicitly type error as unknown
    console.error('Error pinning JSON to Pinata with SDK:', error);
    
    const initialMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    let details: string | unknown = initialMessage; // details can be unknown, matching original behavior

    if (error && typeof error === 'object') {
        // Check for properties safely. The 'in' operator narrows the type of 'error'.
        // The original code `(error as any).details` in the `if` condition also implied a truthiness check.
        // Replicating that by checking against undefined/null.
        if ('details' in error && error.details !== undefined && error.details !== null) {
            details = error.details;
        } else if ('reason' in error && error.reason !== undefined && error.reason !== null) {
            details = error.reason;
        } else if ('message' in error && error.message !== undefined && error.message !== null && !(error instanceof Error)) {
            // If 'error' is not an Error instance but has a 'message' property that's not already captured
            details = error.message;
        }
        // If none of the specific properties are found, 'details' remains 'initialMessage'
    }
    // 'details' will be stringified by NextResponse.json if it's not already a string
    return NextResponse.json({ error: 'Failed to pin JSON to IPFS using SDK.', details: details }, { status: 500 });
  }
}
