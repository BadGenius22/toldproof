'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Chip,
  HexDump,
  PageEyebrow,
  PixelMark,
  BRAND_MARK,
  fakeHexBlock,
  fmtAbs,
  fmtCountdown,
} from '../../components/design';

type Phase = 'sealed' | 'unlocking' | 'decrypting' | 'revealed';

const TARGET = 'Sui Overflow 2026 will be won by a Walrus-track project.';

export function RevealDemo() {
  const [phase, setPhase] = useState<Phase>('sealed');
  const [unlockAt, setUnlockAt] = useState<number>(() => Date.now() + 8_000);
  const [now, setNow] = useState<number>(() => Date.now());
  const [revealedBytes, setRevealedBytes] = useState(0);
  const [tweetTyped, setTweetTyped] = useState(0);

  const cipher = useMemo(() => fakeHexBlock('cipher:' + TARGET, 96), []);
  const plain = useMemo(() => {
    const enc = new TextEncoder().encode(TARGET.padEnd(96, ' '));
    let h = '';
    for (let i = 0; i < 96; i += 1) h += (enc[i] ?? 0x20).toString(16).padStart(2, '0');
    return h;
  }, []);

  const tweet =
    `OPENED ✓\n"${TARGET}"\nLocked 2026-05-04. You can check it on Sui.\n` +
    `toldproof.xyz/verify/0xa1b2c3d4…`;

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (phase === 'sealed' && now >= unlockAt) {
      setPhase('unlocking');
      const t = setTimeout(() => setPhase('decrypting'), 800);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [phase, now, unlockAt]);

  useEffect(() => {
    if (phase !== 'decrypting') return undefined;
    if (revealedBytes >= 96) {
      setPhase('revealed');
      return undefined;
    }
    const t = setTimeout(() => setRevealedBytes((b) => Math.min(96, b + 3)), 35);
    return () => clearTimeout(t);
  }, [phase, revealedBytes]);

  useEffect(() => {
    if (phase !== 'revealed') return undefined;
    if (tweetTyped >= tweet.length) return undefined;
    const t = setTimeout(() => setTweetTyped((c) => c + 1), 18);
    return () => clearTimeout(t);
  }, [phase, tweetTyped, tweet.length]);

  function reset() {
    setPhase('sealed');
    setUnlockAt(Date.now() + 8_000);
    setRevealedBytes(0);
    setTweetTyped(0);
  }

  const displayHex =
    phase === 'sealed' || phase === 'unlocking'
      ? cipher
      : phase === 'revealed'
        ? plain
        : plain.slice(0, revealedBytes * 2) + cipher.slice(revealedBytes * 2);

  const countdownColor =
    phase === 'sealed' ? 'var(--sealed)' : phase === 'revealed' ? 'var(--verified)' : 'var(--warn)';

  return (
    <div className="page">
      <div className="container narrow">
        <PageEyebrow>Opening · live demo</PageEyebrow>
        <h1
          className="display"
          style={{ fontSize: 'clamp(34px, 5vw, 56px)', marginTop: 12 }}
        >
          Watch a prediction open.
        </h1>
        <p
          style={{
            marginTop: 18,
            fontSize: 16,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
            maxWidth: 600,
          }}
        >
          A prediction locked 9 days ago is about to hit its open date. The moment
          it does, Seal releases the key, we read the text out, and our bot replies
          to the first tweet with the actual prediction.
        </p>

        <div
          className="mt-32"
          style={{
            border: '1px solid var(--ink)',
            borderRadius: 4,
            padding: 28,
            background: 'var(--paper)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div className="row" style={{ justifyContent: 'center', gap: 14 }}>
            {phase === 'sealed' && <Chip status="sealed">Still locked</Chip>}
            {phase === 'unlocking' && (
              <Chip status="warn">Opening · Seal is sending the key</Chip>
            )}
            {phase === 'decrypting' && <Chip status="warn">Unscrambling the text</Chip>}
            {phase === 'revealed' && <Chip status="verified">Open ✓</Chip>}
          </div>
          <div
            className="mono"
            style={{
              marginTop: 20,
              fontSize: 64,
              letterSpacing: '-0.02em',
              fontWeight: 500,
              color: countdownColor,
              fontVariantNumeric: 'tabular-nums',
            }}
            suppressHydrationWarning
          >
            {phase === 'sealed'
              ? fmtCountdown(unlockAt, now).slice(-12)
              : phase === 'revealed'
                ? '00d 00h 00m'
                : 'UNLOCK'}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginTop: 4,
            }}
          >
            opens at {fmtAbs(unlockAt)}
          </div>
        </div>

        <div
          className="mt-24"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: 18,
            background: 'var(--paper)',
          }}
        >
          <div
            className="row"
            style={{ justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}
          >
            <span className="eyebrow">
              {phase === 'revealed'
                ? 'The actual text (saved on Sui)'
                : phase === 'sealed'
                  ? 'Scrambled text on Walrus'
                  : 'Unscrambling…'}
            </span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
              {phase === 'decrypting'
                ? `${revealedBytes}/96 bytes`
                : phase === 'revealed'
                  ? '256 bytes'
                  : 'still scrambled'}
            </span>
          </div>
          <HexDump
            hex={displayHex}
            rows={6}
            highlightFirst={phase === 'revealed' ? 96 : revealedBytes}
          />
          {phase === 'revealed' && (
            <div
              className="mt-12"
              style={{
                padding: '12px 14px',
                border: '1px solid var(--verified)',
                background: 'var(--verified-soft)',
                borderRadius: 4,
                fontFamily: 'var(--font-mono), monospace',
                fontSize: 14,
                color: 'oklch(0.3 0.12 150)',
                lineHeight: 1.45,
              }}
            >
              ✓ The text matches the fingerprint we saved on Sui at lock time.
              <br />
              &quot;{TARGET}&quot;
            </div>
          )}
        </div>

        {phase === 'revealed' && (
          <div className="mt-24">
            <PageEyebrow>The reply tweet · posted for you</PageEyebrow>
            <div
              className="mt-12"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '14px 16px',
                background: 'var(--paper)',
                display: 'flex',
                gap: 12,
              }}
            >
              <div
                className="avatar bot"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--sealed)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <PixelMark bitmap={BRAND_MARK} size={22} color="var(--ink)" />
              </div>
              <div className="grow">
                <div className="tweet-head">
                  <span className="name">toldproof</span>
                  <span className="handle">@toldproof</span>
                  <span className="time">· now</span>
                </div>
                <pre
                  className="mono"
                  style={{
                    margin: '6px 0 0',
                    fontSize: 14,
                    lineHeight: 1.45,
                    color: 'var(--ink-2)',
                    fontFamily: 'var(--font-mono), monospace',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {tweet.slice(0, tweetTyped)}
                  {tweetTyped < tweet.length && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 7,
                        height: 14,
                        background: 'var(--ink)',
                        verticalAlign: 'text-bottom',
                        animation: 'blink 0.8s steps(2) infinite',
                      }}
                    />
                  )}
                </pre>
              </div>
            </div>
          </div>
        )}

        <div className="mt-32 row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn ghost" onClick={reset}>
            ↻ Replay
          </button>
          {phase === 'sealed' && (
            <button
              type="button"
              className="btn"
              onClick={() => setUnlockAt(Date.now() + 1000)}
            >
              Skip to opening →
            </button>
          )}
          {phase === 'revealed' && (
            <Link href="/dewaxindo" className="btn">
              See profile →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
