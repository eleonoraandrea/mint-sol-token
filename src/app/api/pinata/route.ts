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

    // @ts-ignore pinata.pinFileToIPFS might expect a specific stream type or options structure
    // that differs slightly, but this is the general usage pattern.
    const result = await pinata.pinFileToIPFS(stream, options);

    return NextResponse.json({ ipfsHash: result.IpfsHash }, { status: 200 });

  } catch (error) {
    console.error('Error uploading to Pinata with SDK:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    let details = errorMessage;
    // Attempt to extract more specific error details if available from the SDK error
    if (error && typeof error === 'object') {
        if ('details' in error && (error as any).details) {
            details = (error as any).details;
        } else if ('reason' in error && (error as any).reason) {
            details = (error as any).reason;
        } else if ('message' in error && (error as any).message) {
            details = (error as any).message; // Fallback to message if other fields are not present
        }
    }
    return NextResponse.json({ error: 'Failed to upload image to IPFS using SDK.', details: details }, { status: 500 });
  }
}
