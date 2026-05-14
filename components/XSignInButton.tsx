// Reusable "Sign in with X" CTA. Shows three states:
//   1. No wallet connected → prompts "Connect wallet first" (button disabled)
//   2. Wallet connected, no X session → "Sign in with X" (redirects to OAuth)
//   3. Wallet connected, X session active → "@handle ✓" with sign-out option

'use client';

import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { startXOAuth, useXSession } from '../lib/useXSession';

interface Props {
  /** Optional small variant for inline placement. */
  size?: 'sm' | 'md';
  /** Optional callback fired after sign-out completes. */
  onSignOut?: () => void;
}

export function XSignInButton({ size = 'md', onSignOut }: Props) {
  const account = useCurrentAccount();
  const { session, isLoading, signOut, signingOut } = useXSession();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    if (!account) return;
    setStarting(true);
    setError(null);
    try {
      await startXOAuth(account.address);
      // startXOAuth redirects; control doesn't return on success
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
      setStarting(false);
    }
  }

  function handleSignOut() {
    signOut(undefined, {
      onSuccess: () => onSignOut?.(),
    });
  }

  const padding = size === 'sm' ? '6px 12px' : '10px 16px';
  const fontSize = size === 'sm' ? 12 : 14;

  // State 1 — no wallet
  if (!account) {
    return (
      <button
        type="button"
        disabled
        className="btn ghost"
        style={{ padding, fontSize, opacity: 0.5 }}
      >
        Connect wallet first
      </button>
    );
  }

  // Loading initial session check
  if (isLoading) {
    return (
      <button type="button" disabled className="btn ghost" style={{ padding, fontSize }}>
        Loading…
      </button>
    );
  }

  // State 3 — signed in
  if (session) {
    return (
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <span
          className="mono"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            border: '1px solid var(--ink)',
            borderRadius: 999,
            background: 'var(--paper-2)',
            fontSize: fontSize - 1,
            color: 'var(--ink)',
          }}
        >
          <span style={{ color: 'var(--verified)' }}>✓</span>
          @{session.xHandle}
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="btn ghost"
          style={{ padding, fontSize }}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    );
  }

  // State 2 — wallet connected, no X session
  return (
    <div className="col" style={{ gap: 6 }}>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={starting}
        className="btn"
        style={{ padding, fontSize }}
      >
        {starting ? 'Redirecting to X…' : '𝕏  Sign in with X'}
      </button>
      {error && (
        <span style={{ fontSize: 11, color: 'var(--danger, #c00)' }}>{error}</span>
      )}
    </div>
  );
}
