// Client-side hook to read + manage the X OAuth session.
//
// Wraps GET/DELETE /api/x/session in a React Query, so the UI can show
// "signed in as @handle" or "Sign in with X" reactively. Refetches when the
// user finishes the OAuth round-trip (via window 'focus' event).

'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

export function useXSession() {
  const queryClient = useQueryClient();

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

  return {
    session: query.data ?? null,
    isLoading: query.isLoading,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['x-session'] }),
    signOut: signOut.mutate,
    signingOut: signOut.isPending,
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
