// Self-serve verifier — the "live today on Free tier" alternative to the
// autonomous @toldproof mention bot. Pastes a tweet URL, extracts the
// author handle, runs the same defamation-safe verdict the bot will run
// once Basic tier is enabled.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fmtAbs } from './design';

interface VerifyResponse {
  xHandle: string;
  verdict: {
    kind: 'matched' | 'no_proof';
    text: string;
  };
  predictions: Array<{
    id: string;
    unlockAtMs: number;
    revealed: boolean;
    resolved: boolean;
    hit: boolean | null | undefined;
  }>;
}

export function SelfServeVerify() {
  const [tweetUrl, setTweetUrl] = useState('');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tweetUrl.trim()) return;
    setPhase('loading');
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/bot/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetUrl: tweetUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail ?? data?.error ?? 'Verify failed');
        setPhase('error');
        return;
      }
      setResult(data as VerifyResponse);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setPhase('error');
    }
  }

  async function copyVerdict() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.verdict.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const tweetIntent = result
    ? `https://x.com/intent/post?text=${encodeURIComponent(result.verdict.text)}${
        // Threading: if the user wants the reply to attach to the parent
        // tweet, they paste the URL — X compose pre-populates without an
        // explicit in-reply-to, so they post normally. Good enough.
        ''
      }`
    : '';

  return (
    <div
      style={{
        border: '1px solid var(--ink)',
        borderRadius: 4,
        padding: '24px 26px',
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <div className="col" style={{ gap: 6 }}>
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Verify any tweet · live on testnet
        </span>
        <h2 className="section" style={{ margin: 0, fontSize: 22 }}>
          Paste a tweet URL. We&apos;ll check the receipts.
        </h2>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 13.5,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
          }}
        >
          Saw an &quot;I called it&quot; tweet you want to fact-check? Drop
          the URL here. We look up the author&apos;s sealed predictions on
          Sui and compose a defamation-safe verdict.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="url"
          className="input"
          placeholder="https://x.com/handle/status/1234567890"
          value={tweetUrl}
          onChange={(e) => setTweetUrl(e.target.value)}
          disabled={phase === 'loading'}
          style={{ width: '100%' }}
        />
        <button
          type="submit"
          className="btn"
          disabled={phase === 'loading' || !tweetUrl.trim()}
          style={{ alignSelf: 'flex-start' }}
        >
          {phase === 'loading' ? 'Checking the receipts…' : 'Verify →'}
        </button>
      </form>

      {phase === 'error' && error && (
        <div
          style={{
            padding: '10px 14px',
            border: '1px solid var(--danger, #c25400)',
            background: 'var(--paper-2)',
            borderRadius: 4,
            fontSize: 13,
            color: 'var(--danger, #c25400)',
          }}
        >
          {error}
        </div>
      )}

      {phase === 'done' && result && (
        <div className="col" style={{ gap: 14 }}>
          <div
            style={{
              border: `1px solid ${
                result.verdict.kind === 'matched'
                  ? 'var(--verified, #1aa260)'
                  : 'var(--ink)'
              }`,
              borderRadius: 4,
              padding: '14px 16px',
              background:
                result.verdict.kind === 'matched'
                  ? 'var(--verified-soft, #e8f7ee)'
                  : 'var(--paper-2)',
            }}
          >
            <div
              className="row"
              style={{
                gap: 8,
                marginBottom: 6,
                fontSize: 11,
                color:
                  result.verdict.kind === 'matched'
                    ? 'var(--verified, #1aa260)'
                    : 'var(--muted)',
                fontFamily: 'var(--font-mono), monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              <span>
                {result.verdict.kind === 'matched'
                  ? '✓ Match'
                  : 'No proof found'}
              </span>
              <span>· @{result.xHandle}</span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.5,
                color: 'var(--ink)',
              }}
            >
              {result.verdict.text}
            </p>
          </div>

          {result.predictions.length > 0 && (
            <div className="col" style={{ gap: 6 }}>
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  color: 'var(--muted)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {result.predictions.length} sealed prediction
                {result.predictions.length === 1 ? '' : 's'} on file
              </span>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono), monospace',
                }}
              >
                {result.predictions.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/verify/${p.id}`}
                      style={{
                        color: 'var(--ink-2)',
                        textDecoration: 'underline',
                      }}
                    >
                      {p.id.slice(0, 10)}…{p.id.slice(-6)}
                    </Link>
                    {' · '}
                    <span style={{ color: 'var(--muted)' }}>
                      {p.revealed
                        ? p.resolved
                          ? p.hit
                            ? 'hit ✓'
                            : 'miss ✗'
                          : 'opened, awaiting verdict'
                        : `locked, opens ${fmtAbs(p.unlockAtMs)}`}
                    </span>
                  </li>
                ))}
                {result.predictions.length > 5 && (
                  <li style={{ color: 'var(--muted)' }}>
                    + {result.predictions.length - 5} more — see{' '}
                    <Link
                      href={`/${result.xHandle}`}
                      style={{ textDecoration: 'underline' }}
                    >
                      @{result.xHandle}&apos;s profile
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={copyVerdict}
              className="btn ghost"
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              {copied ? '✓ Copied' : 'Copy verdict'}
            </button>
            <a
              href={tweetIntent}
              target="_blank"
              rel="noreferrer"
              className="btn"
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              Reply with this verdict on X →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
