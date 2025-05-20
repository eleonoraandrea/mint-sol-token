import pinataSDK from '@pinata/sdk';

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;

if (!pinataApiKey || !pinataSecretApiKey) {
  throw new Error('Pinata API Key or Secret API Key is not set in environment variables.');
}

const pinata = new pinataSDK(pinataApiKey, pinataSecretApiKey);

export default pinata;

export async function testPinataAuthentication() {
  try {
    const result = await pinata.testAuthentication();
    console.log('Pinata authentication successful:', result);
    return result;
  } catch (error) {
    console.error('Pinata authentication failed:', error);
    throw error;
  }
}
