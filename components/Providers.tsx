'use client';

import { DAppKitProvider, createDAppKit } from '@mysten/dapp-kit-react';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';

// NEXT_PUBLIC_* values are inlined at build time for client components, so
// these literals come from .env.local without runtime process.env access.
// Fallbacks are testnet defaults so the bundle remains buildable even if a
// var is briefly missing during a Turbopack hot-reload.
const RPC_URL = process.env.NEXT_PUBLIC_SUI_RPC ?? 'https://fullnode.testnet.sui.io:443';
const NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  const [dAppKit] = useState(() =>
    createDAppKit({
      networks: ['testnet', 'mainnet'],
      defaultNetwork: NETWORK,
      createClient: (network) =>
        new SuiJsonRpcClient({
          url:
            network === 'mainnet'
              ? 'https://fullnode.mainnet.sui.io:443'
              : RPC_URL,
          network,
        }),
      autoConnect: true,
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>{children}</DAppKitProvider>
    </QueryClientProvider>
  );
}
