'use client';

// LiveLockHero — the hero's working micro-version of the Lock form.
// Type a prediction, pick a date, watch the fingerprint + cipher update
// live. "Lock it" carries the typed values to /lock via query string so
// the full PredictionForm opens prefilled.
//
// The "Lock it" control is a real <Link> with a server-computed href, so
// it works even with JS disabled (it just won't update as you type).

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

const HEX = '0123456789abcdef';
const CIPHER_LEN = 36;
const INITIAL_TEXT = 'BTC > $150k at least once in 2026';

function isoDatePlusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Deterministic display-only hash. NOT cryptographic — the server runs a
// real sha256 on submit. This just needs to look like a fingerprint and
// change visibly as the input changes.
function pseudoHash(input: string): string {
  let h = 0x811c9dc5;
  const out: string[] = [];
  const src = input.length > 0 ? input : '·';
  for (let i = 0; i < 64; i++) {
    const c = src.charCodeAt(i % src.length) || i + 7;
    h ^= c + i * 131;
    h = Math.imul(h, 0x01000193) >>> 0;
    out.push(HEX[(h >>> (i % 5)) & 0xf]);
  }
  return out.join('');
}

function daysUntil(isoDate: string): number {
  const target = new Date(isoDate + 'T00:00:00Z').getTime();
  const now = Date.now();
  return Math.max(0, Math.round((target - now) / 86_400_000));
}

export function LiveLockHero() {
  const [text, setText] = useState(INITIAL_TEXT);
  const [date, setDate] = useState(() => isoDatePlusDays(90));
  // Shimmer overlay — three positions of the cipher row that flicker.
  const [shimmer, setShimmer] = useState<[number, number, number]>([0, 12, 24]);
  // Tick advances each shimmer cycle; drives the flicker char purely (no
  // impure Date.now() call during render).
  const [tick, setTick] = useState(0);
  const reducedMotion = useRef(false);

  const hash = useMemo(() => pseudoHash(text + '|' + date), [text, date]);
  const cipherBase = useMemo(() => hash.slice(0, CIPHER_LEN), [hash]);
  const days = useMemo(() => daysUntil(date), [date]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    reducedMotion.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reducedMotion.current) return;
    const id = window.setInterval(() => {
      setShimmer([
        Math.floor(Math.random() * CIPHER_LEN),
        Math.floor(Math.random() * CIPHER_LEN),
        Math.floor(Math.random() * CIPHER_LEN),
      ]);
      setTick((t) => t + 1);
    }, 220);
    return () => window.clearInterval(id);
  }, []);

  const lockHref = `/lock?text=${encodeURIComponent(text)}&unlock=${date}`;

  // Build the cipher row, swapping the shimmer positions for fresh hex.
  const cipherChars = cipherBase.split('').map((ch, i) => {
    const shimmering = shimmer.includes(i);
    const display = shimmering
      ? HEX[(hash.charCodeAt(i) + tick + i) & 0xf]
      : ch;
    return { display, shimmering };
  });

  return (
    <div
      className="live-lock-hero"
      style={{
        border: '2px solid var(--ink)',
        borderRadius: 6,
        background: 'var(--paper)',
        boxShadow: '5px 5px 0 var(--ink)',
        display: 'grid',
        gap: 0,
        width: '100%',
        maxWidth: 360,
        overflow: 'hidden',
      }}
    >
      {/* perforation header */}
      <div
        className="mono"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'var(--ink)',
          color: 'var(--paper)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        <span>· lock a prediction</span>
        <span>live</span>
      </div>

      <div style={{ padding: 16, display: 'grid', gap: 14 }}>
        {/* prediction text */}
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="eyebrow">Your prediction</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={140}
            spellCheck={false}
            style={{
              resize: 'none',
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: 'var(--paper-2)',
              padding: '8px 10px',
              fontFamily: 'var(--font-sans), sans-serif',
              fontSize: 14,
              lineHeight: 1.4,
              color: 'var(--ink)',
            }}
          />
        </label>

        {/* unlock date */}
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="eyebrow">Opens on</span>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <input
              type="date"
              value={date}
              min={isoDatePlusDays(1)}
              onChange={(e) => setDate(e.target.value || isoDatePlusDays(90))}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--paper-2)',
                padding: '6px 8px',
                fontFamily: 'var(--font-mono), monospace',
                fontSize: 12,
                color: 'var(--ink)',
              }}
            />
            <span
              className="mono"
              style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.04em' }}
            >
              opens in {days} {days === 1 ? 'day' : 'days'}
            </span>
          </div>
        </label>

        {/* fingerprint */}
        <div style={{ display: 'grid', gap: 4 }}>
          <span className="eyebrow">SHA-256 fingerprint</span>
          <code
            style={{
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 10.5,
              color: 'var(--ink-3)',
              wordBreak: 'break-all',
              lineHeight: 1.5,
            }}
          >
            {hash}
          </code>
        </div>

        {/* cipher preview */}
        <div style={{ display: 'grid', gap: 4 }}>
          <span className="eyebrow">Scrambled preview</span>
          <div
            aria-hidden
            style={{
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 12,
              letterSpacing: '0.12em',
              color: 'var(--sealed-text)',
              wordBreak: 'break-all',
              lineHeight: 1.6,
            }}
          >
            {cipherChars.map((c, i) => (
              <span
                key={i}
                style={{
                  color: c.shimmering ? 'var(--ink)' : 'var(--sealed-text)',
                  background: c.shimmering ? 'var(--sealed-soft)' : 'transparent',
                }}
              >
                {c.display}
              </span>
            ))}
          </div>
        </div>

        <Link
          href={lockHref}
          className="btn"
          style={{ justifyContent: 'center', width: '100%' }}
        >
          Lock it →
        </Link>
        <p
          className="mono"
          style={{
            margin: 0,
            fontSize: 10,
            color: 'var(--muted)',
            letterSpacing: '0.04em',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          This is a preview. The real lock happens on the next screen.
        </p>
      </div>
    </div>
  );
}
