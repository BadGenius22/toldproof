// Client-side hook to read + manage the X OAuth session.
//
// Wraps GET/DELETE /api/x/session in a React Query, so the UI can show
// "signed in as @handle" or "Sign in with X" reactively. Refetches when the
// user finishes the OAuth round-trip (via window 'focus' event).
//
// Wallet-mismatch handling: when the connected wallet doesn't match the
// cookie's bound wallet, we HIDE the session from the UI but keep the
// cookie. Switching back to the original wallet restores the session
// instantly without re-OAuth. The seal-gate API still verifies wallet match
// on every operation, so this is a UX-only relaxation, not a security one.

'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentAccount } from '@mysten/dapp-kit-react';

export interface XSession {
  walletAddress: string;
  xHandle: string;
  xUserId: string;
  verifiedAt: string;
}

interface SessionResponse {
  session: XSession | null;
}

async function fetchSession(): Promise<XSession | null> {
  const res = await fetch('/api/x/session', { cache: 'no-store' });
  if (!res.ok) return null;
  const data = (await res.json()) as SessionResponse;
  return data.session;
}

async function fetchWalletBinding(wallet: string): Promise<{ xHandle: string } | null> {
  const res = await fetch(`/api/x/wallet-binding?wallet=${encodeURIComponent(wallet)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { binding: { xHandle: string } | null };
  return data.binding;
}

export function useXSession() {
  const queryClient = useQueryClient();
  const account = useCurrentAccount();

  const query = useQuery({
    queryKey: ['x-session'],
    queryFn: fetchSession,
    staleTime: 60_000,
  });

  // Refetch when the tab regains focus — covers the OAuth round-trip case
  // (user redirected to X, signed in, came back). Without this the UI would
  // need a manual refresh to see the new session.
  useEffect(() => {
    const onFocus = () => queryClient.invalidateQueries({ queryKey: ['x-session'] });
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [queryClient]);

  const signOut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/x/session', { method: 'DELETE' });
      if (!res.ok) throw new Error('Sign out failed');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['x-session'] }),
  });

  // Wallet-match check. The cookie persists across wallet switches, but the
  // UI should only show "signed in" when the currently-connected wallet is
  // the one the session was bound to. Mismatched → UI behaves as if there's
  // no session. Switching back → instant restore (no re-OAuth needed).
  const rawSession = query.data ?? null;
  const session = (() => {
    if (!rawSession) return null;
    if (!account) return null;
    const norm = (a: string) => a.trim().toLowerCase().replace(/^0x/, '');
    return norm(account.address) === norm(rawSession.walletAddress)
      ? rawSession
      : null;
  })();

  // "Welcome back" detection: when the user has a connected wallet but no
  // current session, check if THIS wallet has a previous OAuth binding in
  // the DB. If yes, the UI can show a one-click re-sign-in CTA with the
  // bound handle pre-filled, instead of a generic "Sign in with X" prompt.
  // Only runs when there's no active session — saves a fetch in the happy
  // path.
  const knownBindingQuery = useQuery({
    queryKey: ['x-wallet-binding', account?.address],
    queryFn: () =>
      account?.address ? fetchWalletBinding(account.address) : Promise.resolve(null),
    enabled: !!account && !session && !query.isLoading,
    staleTime: 5 * 60_000,
  });

  return {
    session,
    isLoading: query.isLoading,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['x-session'] }),
    signOut: signOut.mutate,
    signingOut: signOut.isPending,
    /** Set when wallet is connected, no active session, but this wallet has
     *  previously bound an X handle. The frontend should show a "Sign in as
     *  @handle" recovery CTA. */
    knownBinding: knownBindingQuery.data ?? null,
  };
}

/**
 * Trigger the OAuth round-trip. Pass the connected Sui wallet address; we POST
 * /api/x/auth/start to get the X authorize URL, then redirect window.location.
 */
export async function startXOAuth(walletAddress: string): Promise<void> {
  const res = await fetch('/api/x/auth/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth start failed: ${text}`);
  }
  const { authorizeUrl } = (await res.json()) as { authorizeUrl: string };
  window.location.href = authorizeUrl;
}
