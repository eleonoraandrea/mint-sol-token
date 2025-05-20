import { NextResponse } from 'next/server';
import PinataSDK from '@pinata/sdk'; // Import the default export

// Ensure your Pinata API Key and Secret are in .env.local for server-side use
// OR Pinata JWT. Prefer JWT if available.
const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY; // Corrected variable name if it was different
const pinataJwt = process.env.PINATA_JWT;

// This function initializes and returns a Pinata SDK client instance
async function getPinataClient() {
  if (pinataJwt) {
    // Initialize with JWT using a configuration object
    // Assuming 'pinataJWTKey' is the correct property for the SDK's config object for JWT
    return new PinataSDK({ pinataJWTKey: pinataJwt }); 
  } else if (pinataApiKey && pinataSecretApiKey) {
    // Initialize with API Key and Secret as separate arguments
    return new PinataSDK(pinataApiKey, pinataSecretApiKey);
  }
  throw new Error('Pinata API credentials not configured on server.');
}

export async function POST(request: Request) {
  // Initial check for credentials remains important
  if (!pinataJwt && (!pinataApiKey || !pinataSecretApiKey)) {
    console.error("Pinata API Key/Secret or JWT not found in environment variables.");
    return NextResponse.json({ error: 'Pinata API credentials not configured on server.' }, { status: 500 });
  }

  try {
    const clientFormData = await request.formData();
    const file = clientFormData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    const pinata = await getPinataClient(); // Type of pinata will be inferred

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const { Readable } = await import('stream');
    const stream = Readable.from(buffer);
    
    // Removed: stream.path = file.name; // Filename is in options.pinataMetadata.name

    const options = {
      pinataMetadata: {
        name: file.name,
        // keyvalues: { customKey: 'customValue' } // Example
      },
      pinataOptions: {
        cidVersion: 0, // Or 1
      }
    };

    // @ts-expect-error pinata.pinFileToIPFS might expect a specific stream type or options structure
    // that differs slightly, but this is the general usage pattern.
    const result = await pinata.pinFileToIPFS(stream, options);

    return NextResponse.json({ ipfsHash: result.IpfsHash }, { status: 200 });

  } catch (error: unknown) { // Explicitly type error as unknown
    console.error('Error uploading to Pinata with SDK:', error);
    
    const initialMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    let details: string | unknown = initialMessage; // details can be unknown, matching original behavior

    if (error && typeof error === 'object') {
        // Check for properties safely. The 'in' operator narrows the type of 'error'.
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
    return NextResponse.json({ error: 'Failed to upload image to IPFS using SDK.', details: details }, { status: 500 });
  }
}
