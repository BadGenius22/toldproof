// Self-serve verifier — the "live today on Free tier" alternative to the
// autonomous @toldproof mention bot. Pastes a tweet URL, extracts the
// author handle, runs the same defamation-safe verdict the bot will run
// once Basic tier is enabled.

'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { fmtAbs, TweetCard } from './design';

// Real demo URLs the verifier can lock onto. Pick three that exercise the
// three verdict paths: a verified call, an unproved claim, paste-your-own.
// Replace the placeholders with live demo tweets the day of the demo.
// TODO(ux-followup): swap in real tweets once the demo profile has settled
// predictions on testnet.
const PRESETS: Array<{ label: string; url: string }> = [
  {
    label: 'Try a verified call',
    url: 'https://x.com/dewaxindo/status/1',
  },
  {
    label: 'Try an unproved claim',
    url: 'https://x.com/dewaxindo/status/2',
  },
  {
    label: 'Paste your own',
    url: '',
  },
];

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
  const formRef = useRef<HTMLFormElement | null>(null);

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

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <input
          type="url"
          className="input"
          placeholder="https://x.com/handle/status/1234567890"
          value={tweetUrl}
          onChange={(e) => setTweetUrl(e.target.value)}
          disabled={phase === 'loading'}
          style={{ width: '100%' }}
        />
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="filter-tab"
              disabled={phase === 'loading'}
              onClick={() => {
                setTweetUrl(p.url);
                // Auto-submit so judges see the demo path in one click.
                // Empty URL ("Paste your own") just focuses the field.
                if (p.url) {
                  queueMicrotask(() => formRef.current?.requestSubmit());
                }
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div
          className="row"
          style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <button
            type="submit"
            className="btn"
            disabled={phase === 'loading' || !tweetUrl.trim()}
          >
            Verify →
          </button>
          <span
            className="mono"
            style={{
              padding: '3px 10px',
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--paper-2)',
              fontSize: 10.5,
              color: 'var(--ink-3)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
            title="Verify quota — keeps the bot from being weaponized"
          >
            Free · 5/day per requester
          </span>
        </div>
        {phase === 'loading' && <VerifyMiniPipeline />}
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
          {/* BT-04: render as TweetCard so the verifier preview matches the
              autonomous bot's eventual on-X reply byte-for-byte. */}
          <TweetCard
            bot
            name="toldproof"
            handle="toldproof"
            time="just now"
            body={
              <>
                <span className="l">@{result.xHandle}</span>{' '}
                {result.verdict.kind === 'matched'
                  ? 'verified ✓'
                  : 'no toldproof found for this claim.'}
              </>
            }
            verdict={{
              tone: result.verdict.kind === 'matched' ? 'verified' : 'warn',
              text: result.verdict.text,
            }}
          />

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

function VerifyMiniPipeline() {
  // BT-03: 3-chip mini-pipeline shown during loading. Pure visual — we don't
  // actually emit per-step progress events, so all three chips animate at
  // staggered intervals to communicate "work is happening" without claiming
  // step-level granularity we don't have.
  const steps = ['fetching tweet', 'matching handle', 'reading receipts'];
  return (
    <div
      className="row"
      style={{
        gap: 8,
        flexWrap: 'wrap',
        marginTop: 4,
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 11,
        color: 'var(--ink-3)',
      }}
      aria-live="polite"
    >
      {steps.map((s, i) => (
        <span
          key={s}
          style={{
            padding: '4px 10px',
            border: '1px solid var(--border)',
            borderRadius: 999,
            background: 'var(--paper-2)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            animation: `pulse-led 1.4s ease-in-out ${i * 0.4}s infinite`,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--sealed)',
              display: 'inline-block',
            }}
          />
          {s}
        </span>
      ))}
    </div>
  );
}
