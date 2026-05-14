// Reclaim-via-tweet UI. Two-step:
//   1. Show the verification code + tweet text + an "Open Twitter compose" link.
//   2. User pastes the resulting tweet URL → we hit /api/release/verify.
//
// On success (auto-verified): user re-clicks "Sign in with X" and the binding
// is now free for their wallet.
// On pending_admin_review (X API can't verify on Free tier): user sees a
// confirmation that the tweet URL was logged for human review.

'use client';

import { useEffect, useState } from 'react';

interface Props {
  walletAddress: string;
  xHandle: string;
  /** Called when the user closes the modal. */
  onClose: () => void;
  /** Called when verification succeeds — parent should trigger a fresh OAuth. */
  onReleased: () => void;
}

interface StartResponse {
  code?: string;
  tweetText?: string;
  tweetIntent?: string;
  expiresAt?: string;
  alreadyAvailable?: boolean;
  alreadyYours?: boolean;
  error?: string;
}

interface VerifyResponse {
  ok?: boolean;
  status?: string;
  detail?: string;
  error?: string;
  xHandle?: string;
}

export function ReleaseFlow({ walletAddress, xHandle, onClose, onReleased }: Props) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'verifying' | 'done' | 'pending_review' | 'error'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [tweetText, setTweetText] = useState('');
  const [tweetIntent, setTweetIntent] = useState('');
  const [tweetUrl, setTweetUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // 1. Hit /api/release/start to get the verification code.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/release/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress, xHandle }),
        });
        const data = (await res.json()) as StartResponse;
        if (cancelled) return;
        if (data.alreadyAvailable || data.alreadyYours) {
          onReleased();
          return;
        }
        if (!res.ok || !data.code) {
          setPhase('error');
          setError(data.error ?? 'Could not start the release flow.');
          return;
        }
        setCode(data.code);
        setTweetText(data.tweetText ?? '');
        setTweetIntent(data.tweetIntent ?? '');
        setPhase('ready');
      } catch (e) {
        if (cancelled) return;
        setPhase('error');
        setError(e instanceof Error ? e.message : 'Network error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletAddress, xHandle, onReleased]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(tweetText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — some browsers block; user can select manually
    }
  }

  async function handleVerify() {
    if (!tweetUrl.trim()) {
      setError('Paste the tweet URL first.');
      return;
    }
    setPhase('verifying');
    setError(null);
    try {
      const res = await fetch('/api/release/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, tweetUrl: tweetUrl.trim() }),
      });
      const data = (await res.json()) as VerifyResponse;
      if (data.ok) {
        setPhase('done');
        return;
      }
      if (data.status === 'pending_admin_review') {
        setPhase('pending_review');
        return;
      }
      setPhase('ready');
      setError(data.detail ?? data.error ?? 'Verification failed.');
    } catch (e) {
      setPhase('ready');
      setError(e instanceof Error ? e.message : 'Network error');
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--paper)',
          border: '2px solid var(--ink)',
          borderRadius: 4,
          maxWidth: 560,
          width: '100%',
          padding: '24px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="section" style={{ margin: 0, fontSize: 20 }}>
            Prove @{xHandle} is yours
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn ghost"
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            Close
          </button>
        </div>

        {phase === 'loading' && (
          <p style={{ fontSize: 14, color: 'var(--ink-3)' }}>Setting up your verification code…</p>
        )}

        {phase === 'error' && (
          <p style={{ fontSize: 14, color: 'var(--danger, #c00)' }}>{error}</p>
        )}

        {(phase === 'ready' || phase === 'verifying') && (
          <>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              Post this exact tweet from <strong>@{xHandle}</strong>. Once we
              see it, we&apos;ll release the handle to your wallet.
            </p>

            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--paper-2)',
                padding: '14px 16px',
                fontFamily: 'var(--font-mono), monospace',
                fontSize: 12.5,
                color: 'var(--ink)',
                lineHeight: 1.5,
                wordBreak: 'break-all',
              }}
            >
              {tweetText}
            </div>

            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleCopy}
                className="btn ghost"
                style={{ padding: '8px 14px', fontSize: 13 }}
              >
                {copied ? '✓ Copied' : 'Copy text'}
              </button>
              {tweetIntent && (
                <a
                  href={tweetIntent}
                  target="_blank"
                  rel="noreferrer"
                  className="btn"
                  style={{ padding: '8px 14px', fontSize: 13 }}
                >
                  Open Twitter compose →
                </a>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <label
                htmlFor="tweet-url"
                style={{
                  display: 'block',
                  fontSize: 13,
                  color: 'var(--ink-2)',
                  marginBottom: 6,
                }}
              >
                Paste the tweet URL here:
              </label>
              <input
                id="tweet-url"
                type="url"
                className="input"
                placeholder={`https://x.com/${xHandle}/status/...`}
                value={tweetUrl}
                onChange={(e) => setTweetUrl(e.target.value)}
                disabled={phase === 'verifying'}
                style={{ width: '100%' }}
              />
              {error && (
                <p style={{ marginTop: 8, fontSize: 12, color: 'var(--danger, #c00)' }}>
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={handleVerify}
                disabled={phase === 'verifying' || !tweetUrl.trim()}
                className="btn"
                style={{ marginTop: 12, padding: '10px 16px', fontSize: 13 }}
              >
                {phase === 'verifying' ? 'Verifying…' : 'Verify ownership'}
              </button>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            <p style={{ fontSize: 15, color: 'var(--verified, #1aa260)', fontWeight: 600 }}>
              ✓ Verified! @{xHandle} is now free.
            </p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-3)' }}>
              One more step: click <strong>Sign in with X</strong> to bind it to your wallet.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onReleased();
              }}
              className="btn"
            >
              Sign in with X →
            </button>
          </>
        )}

        {phase === 'pending_review' && (
          <>
            <p style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 600 }}>
              Got it. Tweet URL logged.
            </p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              Our X API auto-verifier is on a free tier and couldn&apos;t
              check the tweet automatically. A human will review and release
              the handle within 24 hours. You can close this dialog — we&apos;ll
              email you when it&apos;s done.
            </p>
            <button type="button" onClick={onClose} className="btn ghost">
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
