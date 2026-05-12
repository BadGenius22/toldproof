import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { Providers } from '../components/Providers';
import { WalletConnect } from '../components/WalletConnect';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TOLDPROOF — cryptographic receipts for crypto Twitter',
  description:
    'Sealed predictions on Sui + Walrus + Seal. Verifiable proof — or stop pretending you called it.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-black dark:bg-black dark:text-white">
        <Providers>
          <header className="flex w-full items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
            <Link href="/" className="font-mono text-sm font-bold tracking-tight">
              TOLDPROOF
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/seal" className="text-sm hover:underline">
                Seal a prediction
              </Link>
              <WalletConnect />
            </nav>
          </header>
          <main className="flex flex-1 w-full flex-col items-center">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
