// Read the user's current free-seal quota for display.
// Fetches via /api/seal/preflight (which doubles as the quota endpoint when
// passed valid identity matching the session). Returns null when no session
// is active, the wallet doesn't match, or the request just hasn't run yet.

'use client';

import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { useXSession } from './useXSession';

export interface QuotaInfo {
  freeUsed: number;
  freeLimit: number;
  freeRemaining: number;
  mode: 'free' | 'overage';
  overagePriceUsd: number;
}

export function useQuota(): {
  quota: QuotaInfo | null;
  isLoading: boolean;
  refetch: () => void;
} {
  const account = useCurrentAccount();
  const { session } = useXSession();

  const query = useQuery({
    queryKey: ['seal-quota', account?.address, session?.xHandle],
    queryFn: async (): Promise<QuotaInfo | null> => {
      if (!account || !session) return null;
      const res = await fetch('/api/seal/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: account.address,
          identity: session.xHandle,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as QuotaInfo & { ok: boolean };
      return {
        freeUsed: data.freeUsed,
        freeLimit: data.freeLimit,
        freeRemaining: data.freeRemaining,
        mode: data.mode,
        overagePriceUsd: data.overagePriceUsd,
      };
    },
    enabled: !!account && !!session,
    staleTime: 30_000,
  });

  return {
    quota: query.data ?? null,
    isLoading: query.isLoading,
    refetch: () => query.refetch(),
  };
}
