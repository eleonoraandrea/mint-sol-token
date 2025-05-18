import TokenForm from "@/components/TokenForm"; // Import TokenForm
import ClientWalletConnect from "@/components/ClientWalletConnect"; // Import the new client component

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-24">
      <ClientWalletConnect />
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex flex-col mt-8">
        {/* <h1 className="text-4xl font-bold my-8">Solana Token Generator</h1> // Title is now inside TokenForm */}
        <TokenForm />
      </div>
    </main>
  );
}
