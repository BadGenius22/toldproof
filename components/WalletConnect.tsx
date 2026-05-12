'use client';

import dynamic from 'next/dynamic';

// ConnectButton is a Lit-based Web Component; load client-only.
const ConnectButton = dynamic(
  () => import('@mysten/dapp-kit-react/ui').then((m) => m.ConnectButton),
  { ssr: false, loading: () => <div className="h-10 w-32 rounded-md bg-neutral-200" /> },
);

export function WalletConnect() {
  return <ConnectButton />;
}
