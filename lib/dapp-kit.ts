// dApp Kit v2 singleton instance — browser-only.
// Imported from a 'use client' boundary (components/Providers.tsx).

import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { env } from './env';

export const dAppKit = createDAppKit({
  networks: ['testnet', 'mainnet'],
  defaultNetwork: env.suiNetwork === 'mainnet' ? 'mainnet' : 'testnet',
  createClient: (network) =>
    new SuiJsonRpcClient({
      url:
        network === 'mainnet'
          ? 'https://fullnode.mainnet.sui.io:443'
          : env.suiRpc,
      network,
    }),
  autoConnect: true,
});
