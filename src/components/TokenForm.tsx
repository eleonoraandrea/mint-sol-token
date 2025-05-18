"use client";

import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  Transaction,
  // sendAndConfirmTransaction // sendTransaction from useWallet is used
} from '@solana/web3.js';
import { 
  MINT_SIZE, 
  TOKEN_PROGRAM_ID, 
  createInitializeMintInstruction, 
  getMinimumBalanceForRentExemptMint, 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction
} from '@solana/spl-token';
import {
  createCreateMetadataAccountV3Instruction, // Using V3 now that the library is updated
  DataV2,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
} from '@metaplex-foundation/mpl-token-metadata';

export default function TokenForm() {
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenSupply, setTokenSupply] = useState('');
  const [tokenDescription, setTokenDescription] = useState(''); // New state for description
  const [tokenImage, setTokenImage] = useState<File | null>(null);
  const [tokenImageUrl, setTokenImageUrl] = useState(''); // To store IPFS image URL
  const [tokenMetadataUrl, setTokenMetadataUrl] = useState(''); // To store IPFS metadata URL
  const [isProcessing, setIsProcessing] = useState<string | null>(null); // 'image', 'metadata', 'minting'
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [mintingSuccessMessage, setMintingSuccessMessage] = useState<string | null>(null);
  const [websiteLink, setWebsiteLink] = useState('');
  const [xLink, setXLink] = useState('');
  const [telegramLink, setTelegramLink] = useState('');
  const [discordLink, setDiscordLink] = useState('');

  // Token Settings States
  const [revokeUpdateAuth, setRevokeUpdateAuth] = useState(false);
  const [revokeFreezeAuth, setRevokeFreezeAuth] = useState(false);
  const [revokeMintAuth, setRevokeMintAuth] = useState(false);
  const [showFakeCreator, setShowFakeCreator] = useState(false);
  const [fakeCreatorName, setFakeCreatorName] = useState('');
  const [fakeCreatorAddress, setFakeCreatorAddress] = useState('');


  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTokenImage(e.target.files[0]);
    }
  };

  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProcessingError(null);
    setMintingSuccessMessage(null);
    setTokenImageUrl(''); 
    setTokenMetadataUrl(''); 
    let currentTokenImageUrl = '';
    let currentTokenMetadataUrl = '';

    if (!publicKey) {
      setProcessingError("Wallet not connected. Please connect your wallet.");
      return;
    }

    // 1. Upload Image if provided
    if (tokenImage) {
      setIsProcessing('image');
      const imageFormData = new FormData();
      imageFormData.append('file', tokenImage);

      try {
        const response = await fetch('/api/pinata', { 
          method: 'POST',
          body: imageFormData,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.details || data.error || 'Failed to upload image.');
        }
        currentTokenImageUrl = `https://gateway.pinata.cloud/ipfs/${data.ipfsHash}`;
        setTokenImageUrl(currentTokenImageUrl);
        console.log('Image uploaded to IPFS:', currentTokenImageUrl);
      } catch (error) {
        console.error('Image upload error:', error);
        setProcessingError(error instanceof Error ? error.message : 'An unknown error occurred during image upload.');
        setIsProcessing(null);
        return;
      }
    } else {
      console.log("No token image provided. Metadata will not include an image.");
    }

    // 2. Construct and Upload Metadata JSON
    setIsProcessing('metadata');
    const metadata = {
      name: tokenName,
      symbol: tokenSymbol,
      description: tokenDescription || `Token ${tokenName} (${tokenSymbol})`, // Use provided or generate basic
      image: currentTokenImageUrl, // Use the IPFS URL of the uploaded image
      seller_fee_basis_points: 0, // Standard for most fungible tokens
      external_url: websiteLink || "", // Optional: A URL to an external website
      attributes: [ 
        // For fungible tokens, attributes are less common but can be used.
        // Example: { trait_type: "Category", value: "Utility Token" }
      ],
      properties: {
        files: currentTokenImageUrl ? [{ uri: currentTokenImageUrl, type: tokenImage?.type || 'image/png' }] : [],
        category: "image", // Or 'video', 'audio', 'vr', etc.
        creators: showFakeCreator && fakeCreatorAddress && fakeCreatorName ? 
                  [{ address: fakeCreatorAddress, verified: false, share: 100 }] : 
                  [] // Wallet's public key should be added here as the primary creator
      },
      // Collection details would go here if part of a collection (more for NFTs)
      // collection: { name: "My Collection", family: "My Collection Family" }, 
      extensions: { // Using extensions for social links
        website: websiteLink || undefined,
        twitter: xLink ? (xLink.startsWith('@') ? `https://twitter.com/${xLink.substring(1)}` : xLink) : undefined,
        telegram: telegramLink || undefined,
        discord: discordLink || undefined,
      }
    };

    // Remove undefined extension properties
    Object.keys(metadata.extensions).forEach(key => {
      if (metadata.extensions[key as keyof typeof metadata.extensions] === undefined) {
        delete metadata.extensions[key as keyof typeof metadata.extensions];
      }
    });
    if (Object.keys(metadata.extensions).length === 0) {
        // @ts-ignore
        delete metadata.extensions; // Delete extensions object if empty
    }


    try {
      const response = await fetch('/api/pinata/pinJSON', { // New endpoint for pinning JSON
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to upload metadata JSON.');
      }
      currentTokenMetadataUrl = `https://gateway.pinata.cloud/ipfs/${data.ipfsHash}`;
      setTokenMetadataUrl(currentTokenMetadataUrl);
      console.log('Metadata JSON uploaded to IPFS:', currentTokenMetadataUrl);
    } catch (error) {
      console.error('Metadata upload error:', error);
      setProcessingError(error instanceof Error ? error.message : 'An unknown error occurred during metadata upload.');
      setIsProcessing(null);
      return;
    }
    
    setIsProcessing('minting');
    // 3. Mint Token
    try {
      if (!publicKey) { // This check ensures publicKey is not null
        throw new Error("Wallet not connected.");
      }
      const verifiedPublicKey: PublicKey = publicKey; // Use this for instruction params

      const lamports = await getMinimumBalanceForRentExemptMint(connection);
      const mintKeypair = Keypair.generate();
      const tokenDecimals = 9; // Standard for many SPL tokens

      const createMintAccountInstruction = SystemProgram.createAccount({
        fromPubkey: publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports: lamports,
        programId: TOKEN_PROGRAM_ID,
      });

      const initializeMintInstruction = createInitializeMintInstruction(
        mintKeypair.publicKey,
        tokenDecimals,
        verifiedPublicKey, // Mint Authority
        revokeFreezeAuth ? null : verifiedPublicKey // Freeze Authority (optional)
      );

      const associatedTokenAccount = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        publicKey
      );

      const createATAInstruction = createAssociatedTokenAccountInstruction(
        publicKey, // Payer
        associatedTokenAccount,
        publicKey, // Owner
        mintKeypair.publicKey // Mint
      );

      const mintToInstruction = createMintToInstruction(
        mintKeypair.publicKey,
        associatedTokenAccount,
        verifiedPublicKey, // Mint Authority
        BigInt(tokenSupply) * BigInt(10 ** tokenDecimals) // Amount, considering decimals
      );
      
      // Metadata Account
      const metadataAccount = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mintKeypair.publicKey.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      )[0];

      // Arguments for createCreateMetadataAccountInstruction (V1/V2 style for mpl-token-metadata@2.x)
      const dataV2: DataV2 = {
        name: tokenName,
        symbol: tokenSymbol,
        uri: currentTokenMetadataUrl,
        sellerFeeBasisPoints: 0,
        creators: verifiedPublicKey ? [{ address: verifiedPublicKey, verified: true, share: 100 }] : null,
        collection: null,
        uses: null,
      };

      // Using createCreateMetadataAccountV3Instruction
      const createMetadataInstruction = createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataAccount,
          mint: mintKeypair.publicKey,
          mintAuthority: verifiedPublicKey,
          payer: verifiedPublicKey,
          updateAuthority: verifiedPublicKey,
        },
        {
          createMetadataAccountArgsV3: {
            data: dataV2,
            isMutable: !revokeUpdateAuth,
            collectionDetails: null, // Required for V3, set to null if not part of a collection
          }
        }
      );
      
      const { blockhash } = await connection.getLatestBlockhash();
      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: publicKey,
      }).add(
        createMintAccountInstruction,
        initializeMintInstruction,
        createATAInstruction,
        mintToInstruction,
        createMetadataInstruction
      );

      // Simulate the transaction
      console.log("Simulating transaction...");
      try {
        // Remove [mintKeypair] from simulateTransaction call
        const simulationResult = await connection.simulateTransaction(transaction); 
        console.log("Transaction simulation result:", simulationResult);
        if (simulationResult.value.err) {
          console.error("Transaction simulation failed:", simulationResult.value.err);
          console.error("Simulation logs:", simulationResult.value.logs);
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simulationResult.value.err)}. Logs: ${simulationResult.value.logs?.join('\\n')}`);
        }
        console.log("Transaction simulation successful. Logs:", simulationResult.value.logs);
      } catch (simError: any) {
        console.error("Error during simulation:", simError);
        setProcessingError(`Simulation error: ${simError.message || JSON.stringify(simError)}`);
        setIsProcessing(null);
        return;
      }
      
      console.log("Sending transaction via wallet adapter...");
      const signature = await sendTransaction(transaction, connection, {
        signers: [mintKeypair], // Mint keypair needs to sign for its creation and minting
      });
      
      await connection.confirmTransaction(signature, 'confirmed');
      
      setMintingSuccessMessage(`Token minted successfully! Signature: ${signature}. Mint Address: ${mintKeypair.publicKey.toBase58()}`);
      console.log('Token minted:', mintKeypair.publicKey.toBase58());

    } catch (error: any) { // Changed error type to any for easier property access
      console.error('Full minting error object:', error);
      console.error('Error Name:', error?.name);
      console.error('Error Message:', error?.message);
      const errorLogs = (error && typeof error === 'object' && 'logs' in error && Array.isArray(error.logs)) ? error.logs : null;
      console.error('Error Logs:', errorLogs);
      
      let detailedMessage = 'An unknown error occurred during minting.';
      if (error instanceof Error) {
        detailedMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        detailedMessage = String((error as {message: string}).message);
      }

      if (errorLogs && errorLogs.length > 0) {
        detailedMessage += ` | Logs: ${errorLogs.join('\\n')}`;
      }
      
      setProcessingError(detailedMessage);
    } finally {
      setIsProcessing(null);
    }

    console.log({ 
      tokenName, 
      tokenSymbol, 
      tokenSupply, 
      imageUrl: currentTokenImageUrl,
      metadataUrl: currentTokenMetadataUrl, 
      websiteLink,
      xLink,
      telegramLink,
      discordLink,
      revokeUpdateAuth,
      revokeFreezeAuth,
      revokeMintAuth,
      showFakeCreator,
      fakeCreatorName,
      fakeCreatorAddress
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 w-full max-w-2xl p-8 border rounded-lg shadow-xl bg-card">
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card p-4 rounded-lg shadow-xl">
            {isProcessing === 'image' && 'Uploading image to IPFS...'}
            {isProcessing === 'metadata' && 'Uploading metadata to IPFS...'}
            {isProcessing === 'minting' && 'Minting token on Solana...'}
          </div>
        </div>
      )}
      {processingError && (
        <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
          <span className="font-medium">Error!</span> {processingError}
        </div>
      )}
      {mintingSuccessMessage && !processingError && (
         <div className="p-4 mb-4 text-sm text-green-800 rounded-lg bg-green-50 dark:bg-gray-800 dark:text-green-400" role="alert">
          <span className="font-medium">Success!</span> {mintingSuccessMessage}
        </div>
      )}
      {!isProcessing && tokenImageUrl && !tokenMetadataUrl && !processingError && (
        <div className="p-4 mb-4 text-sm text-blue-800 rounded-lg bg-blue-50 dark:bg-gray-800 dark:text-blue-400" role="alert">
          Image uploaded: <a href={tokenImageUrl} target="_blank" rel="noopener noreferrer" className="underline">{tokenImageUrl}</a>. Now uploading metadata...
        </div>
      )}
      {!isProcessing && tokenMetadataUrl && !mintingSuccessMessage && !processingError && (
        <div className="p-4 mb-4 text-sm text-blue-800 rounded-lg bg-blue-50 dark:bg-gray-800 dark:text-blue-400" role="alert">
          Metadata uploaded: <a href={tokenMetadataUrl} target="_blank" rel="noopener noreferrer" className="underline">{tokenMetadataUrl}</a>. Ready to mint.
        </div>
      )}
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold text-center text-card-foreground">Create Your Solana Token</h2>
        <p className="text-sm text-muted-foreground text-center">
          Fill in the details below to mint your new SPL token.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tokenName">Token Name</Label>
          <Input 
            id="tokenName" 
            placeholder="e.g. My Awesome Token" 
            value={tokenName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTokenName(e.target.value)}
            required 
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tokenSymbol">Token Symbol</Label>
          <Input 
            id="tokenSymbol" 
            placeholder="e.g. MAT" 
            value={tokenSymbol}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTokenSymbol(e.target.value)}
            required 
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="tokenDescription">Token Description (Optional)</Label>
          <Input 
            id="tokenDescription" 
            placeholder="e.g. A utility token for our awesome platform." 
            value={tokenDescription}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTokenDescription(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tokenSupply">Token Supply</Label>
          <Input 
            id="tokenSupply" 
            type="number"
            placeholder="e.g. 1000000" 
            value={tokenSupply}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTokenSupply(e.target.value)}
            required 
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tokenImage">Token Image (Logo)</Label>
          <Input 
            id="tokenImage" 
            type="file"
            accept="image/png, image/jpeg, image/gif"
            onChange={handleImageChange}
            disabled={!!isProcessing}
          />
          {tokenImage && !tokenImageUrl && <p className="text-sm text-muted-foreground">Selected: {tokenImage.name}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-card-foreground">Social Links (Optional)</h3>
        <div className="space-y-2">
          <Label htmlFor="websiteLink">Website URL</Label>
          <Input 
            id="websiteLink" 
            type="url"
            placeholder="https://yourtoken.com" 
            value={websiteLink}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWebsiteLink(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="xLink">X (Twitter) Handle</Label>
          <Input 
            id="xLink" 
            placeholder="@YourToken" 
            value={xLink}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setXLink(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telegramLink">Telegram Group Link</Label>
          <Input 
            id="telegramLink" 
            type="url"
            placeholder="https://t.me/yourtokengroup" 
            value={telegramLink}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTelegramLink(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="discordLink">Discord Server Invite</Label>
          <Input 
            id="discordLink" 
            type="url"
            placeholder="https://discord.gg/yourserver" 
            value={discordLink}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDiscordLink(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-card-foreground">Token Settings</h3>
        <div className="items-top flex space-x-2">
          <Checkbox id="revokeUpdateAuth" checked={revokeUpdateAuth} onCheckedChange={(checked) => setRevokeUpdateAuth(!!checked)} />
          <div className="grid gap-1.5 leading-none">
            <label
              htmlFor="revokeUpdateAuth"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Revoke Update Authority (Make token immutable)
            </label>
            <p className="text-xs text-muted-foreground">
              Once revoked, token metadata (name, symbol, image) cannot be changed.
            </p>
          </div>
        </div>
        <div className="items-top flex space-x-2">
          <Checkbox id="revokeFreezeAuth" checked={revokeFreezeAuth} onCheckedChange={(checked) => setRevokeFreezeAuth(!!checked)} />
          <div className="grid gap-1.5 leading-none">
            <label
              htmlFor="revokeFreezeAuth"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Revoke Freeze Authority
            </label>
            <p className="text-xs text-muted-foreground">
              Once revoked, the token cannot be frozen in user wallets.
            </p>
          </div>
        </div>
        <div className="items-top flex space-x-2">
          <Checkbox id="revokeMintAuth" checked={revokeMintAuth} onCheckedChange={(checked) => setRevokeMintAuth(!!checked)} />
          <div className="grid gap-1.5 leading-none">
            <label
              htmlFor="revokeMintAuth"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Revoke Mint Authority (Fixed supply)
            </label>
            <p className="text-xs text-muted-foreground">
              Once revoked, no new tokens can be minted.
            </p>
          </div>
        </div>
        <div className="items-top flex space-x-2">
          <Checkbox id="showFakeCreator" checked={showFakeCreator} onCheckedChange={(checked) => setShowFakeCreator(!!checked)} />
          <div className="grid gap-1.5 leading-none">
            <label
              htmlFor="showFakeCreator"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Show Fake Creator (UI Only)
            </label>
            <p className="text-xs text-muted-foreground">
              Display a custom creator name/address in the UI. This is not verified on Solana.
            </p>
          </div>
        </div>
        {showFakeCreator && (
          <div className="space-y-4 pl-6 pt-2">
            <div className="space-y-2">
              <Label htmlFor="fakeCreatorName">Fake Creator Name</Label>
              <Input 
                id="fakeCreatorName" 
                placeholder="e.g. Satoshi Nakamoto" 
                value={fakeCreatorName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFakeCreatorName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fakeCreatorAddress">Fake Creator Address</Label>
              <Input 
                id="fakeCreatorAddress" 
                placeholder="e.g. 1BitcoinEaterAddressDontSendf59kuE" 
                value={fakeCreatorAddress}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFakeCreatorAddress(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={!!isProcessing || !publicKey}>
        {isProcessing === 'image' ? 'Uploading Image...' : 
         isProcessing === 'metadata' ? 'Uploading Metadata...' : 
         isProcessing === 'minting' ? 'Minting Token...' : 
         !publicKey ? 'Connect Wallet to Mint' :
         'Create Token'}
      </Button>
    </form>
  );
}
