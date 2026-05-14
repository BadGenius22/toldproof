// Renders above the prediction form on /lock. Three jobs:
//   1. Show the X OAuth state (sign-in CTA when not linked, "@handle ✓" when linked)
//   2. Handle the redirect-back states from /api/x/auth/callback (?verified=1, ?error=...)
//   3. Surface the squatted-handle case (?error=handle_taken) with a release placeholder
//
// This is intentionally a separate component (not part of PredictionForm) so
// the existing 690-line form stays untouched while we wire OAuth.

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { XSignInButton } from './XSignInButton';
import { useXSession } from '../lib/useXSession';

function BannerInner() {
  // The server doesn't know whether a wallet is connected (it's in
  // localStorage) or whether the X session cookie exists (we render this
  // banner above the form which is below the fold). To avoid hydration
  // mismatch between server-rendered "Connect wallet" and client-rendered
  // "Signed in as @handle", we wait until mount, then render the real state.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const account = useCurrentAccount();
  const { session } = useXSession();
  const params = useSearchParams();

  const verified = params.get('verified') === '1';
  const verifiedHandle = params.get('handle');
  const error = params.get('error');
  const heldBy = params.get('heldBy');
  const errorHandle = params.get('handle');

  // Before mount, render a stable skeleton matching the dimensions of the
  // real banner — same on server and client, so no hydration mismatch.
  if (!mounted) {
    return (
      <div
        style={{
          border: '1px solid var(--ink)',
          borderRadius: 4,
          padding: '18px 22px',
          background: 'var(--paper)',
          marginBottom: 24,
          minHeight: 92,
        }}
        aria-busy="true"
      />
    );
  }

  // Build the headline + sublabel based on combined wallet + session state.
  const walletConnected = !!account;
  const xLinked = !!session;
  const ready = walletConnected && xLinked;

  let headline: string;
  let sub: string;
  let tone: 'neutral' | 'verified' | 'warning' = 'neutral';

  if (error === 'handle_taken' && errorHandle) {
    headline = `@${errorHandle} is claimed by another wallet`;
    sub = heldBy
      ? `Currently bound to ${heldBy.slice(0, 10)}…${heldBy.slice(-4)}. If this is your X handle, you can prove it via tweet — release flow coming next.`
      : 'Release flow coming next — you will prove ownership via a single tweet.';
    tone = 'warning';
  } else if (error === 'x_oauth_cancelled') {
    headline = 'X sign-in cancelled';
    sub = 'No worries. Click "Sign in with X" again whenever you are ready.';
    tone = 'warning';
  } else if (error) {
    headline = 'Something went wrong';
    sub = `X sign-in failed (${error}). Please try again.`;
    tone = 'warning';
  } else if (ready) {
    headline = `Signed in as @${session.xHandle}`;
    sub = 'You can lock a prediction below. Your handle is cryptographically bound to your wallet.';
    tone = 'verified';
  } else if (verified && verifiedHandle) {
    headline = `Welcome, @${verifiedHandle}`;
    sub = 'Your X account is now bound to your wallet. Lock your first prediction below.';
    tone = 'verified';
  } else if (walletConnected && !xLinked) {
    headline = 'One more step: sign in with X';
    sub = 'We use it once to bind your X handle to your wallet, so nobody else can claim it on your leaderboard.';
    tone = 'neutral';
  } else {
    headline = 'Connect your wallet to lock a prediction';
    sub = 'Sui wallet (Slush, Phantom, etc.) → then sign in with X to claim your handle.';
    tone = 'neutral';
  }

  const borderColor =
    tone === 'verified'
      ? 'var(--verified, #1aa260)'
      : tone === 'warning'
      ? 'var(--danger, #c25400)'
      : 'var(--ink)';

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: 4,
        padding: '18px 22px',
        background: 'var(--paper)',
        marginBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div className="col" style={{ gap: 4 }}>
        <h2
          className="section"
          style={{ fontSize: 17, margin: 0 }}
        >
          {headline}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--ink-3)',
            lineHeight: 1.5,
          }}
        >
          {sub}
        </p>
      </div>

      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <XSignInButton size="sm" />
      </div>
    </div>
  );
}

export function SealAuthBanner() {
  return (
    <Suspense fallback={null}>
      <BannerInner />
    </Suspense>
  );
}
