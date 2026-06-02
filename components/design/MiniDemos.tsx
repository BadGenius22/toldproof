'use client';

// MiniDemos — small looping animations that sit at the bottom of each
// "How it works" step card. Each visualizes one step. All four pause when
// prefers-reduced-motion is set.

import { useEffect, useRef, useState } from 'react';

const HEX = '0123456789abcdef';
const LOCK_TEXT = 'BTC > $150k in 2026';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function randHex(): string {
  return HEX[Math.floor(Math.random() * 16)]!;
}

// ─── MiniBox — shared dashed-border frame ──────────────────────────────

export function MiniBox({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: '1px dashed var(--border)',
        borderRadius: 4,
        background: 'var(--paper-2)',
        padding: '8px 10px',
        display: 'grid',
        gap: 5,
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 8.5,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        }}
      >
        {label}
      </span>
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--ink-2)',
          minHeight: 16,
          lineHeight: 1.4,
          wordBreak: 'break-all',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── 01 · MiniLockDemo — plaintext encrypts char-by-char ───────────────

export function MiniLockDemo() {
  // Start at 0 (all plaintext) so the server and first client render are
  // identical — randHex() (Math.random) only runs once revealed > 0, which
  // happens client-side in the effect below. Starting full-length would
  // scramble every char on the SSR render and mismatch on hydration.
  const [revealed, setRevealed] = useState(0);
  const step = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = window.setInterval(() => {
      step.current = (step.current + 1) % (LOCK_TEXT.length + 8);
      setRevealed(Math.min(LOCK_TEXT.length, step.current));
    }, 70);
    return () => window.clearInterval(id);
  }, []);

  const out = LOCK_TEXT.split('').map((ch, i) =>
    i < revealed ? (ch === ' ' ? ' ' : randHex()) : ch,
  );

  return (
    <MiniBox label="Encrypting">
      <span style={{ color: revealed >= LOCK_TEXT.length ? 'var(--sealed-text)' : 'var(--ink-2)' }}>
        {out.join('')}
      </span>
    </MiniBox>
  );
}

// ─── 02 · MiniWaitDemo — countdown with blinking colons ────────────────

export function MiniWaitDemo() {
  const [secs, setSecs] = useState(0);
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const tick = window.setInterval(() => {
      setSecs((s) => (s + 1) % 60);
      setBlink((b) => !b);
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  const colon = (
    <span style={{ opacity: blink ? 1 : 0.25 }}>:</span>
  );
  const ss = String(secs).padStart(2, '0');

  return (
    <MiniBox label="Time-locked">
      <span style={{ letterSpacing: '0.08em' }}>
        26d 14{colon}32{colon}
        {ss}
      </span>
    </MiniBox>
  );
}

// ─── 03 · MiniRevealDemo — ciphertext unscrambles to plaintext ─────────

export function MiniRevealDemo() {
  const [revealed, setRevealed] = useState(LOCK_TEXT.length);
  const step = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    // Reset to the animation start (SSR rendered the finished state).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRevealed(0);
    const id = window.setInterval(() => {
      step.current = (step.current + 1) % (LOCK_TEXT.length + 8);
      setRevealed(Math.min(LOCK_TEXT.length, step.current));
    }, 70);
    return () => window.clearInterval(id);
  }, []);

  const out = LOCK_TEXT.split('').map((ch, i) =>
    i < revealed ? ch : ch === ' ' ? ' ' : randHex(),
  );

  return (
    <MiniBox label="Revealed">
      <span style={{ color: revealed >= LOCK_TEXT.length ? 'var(--verified-text)' : 'var(--ink-2)' }}>
        {out.join('')}
      </span>
    </MiniBox>
  );
}

// ─── 04 · MiniScoreDemo — progress bar fills + "+1 hit" toast ──────────

export function MiniScoreDemo() {
  const [pct, setPct] = useState(71);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let raf = 0;
    let toastTimer = 0;
    function runCycle() {
      const start = performance.now();
      const DURATION = 1400;
      function frame(now: number) {
        const t = Math.min(1, (now - start) / DURATION);
        const eased = 1 - Math.pow(1 - t, 3);
        setPct(Math.round(eased * 71));
        if (t < 1) {
          raf = requestAnimationFrame(frame);
        } else {
          setShowToast(true);
          toastTimer = window.setTimeout(() => {
            setShowToast(false);
            toastTimer = window.setTimeout(runCycle, 600);
          }, 1400);
        }
      }
      setPct(0);
      setShowToast(false);
      raf = requestAnimationFrame(frame);
    }
    runCycle();
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(toastTimer);
    };
  }, []);

  return (
    <MiniBox label="Score builds">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            flex: 1,
            height: 8,
            background: 'var(--paper-3)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: 'var(--verified)',
            }}
          />
        </div>
        <span style={{ color: 'var(--verified-text)', fontWeight: 600 }}>
          {pct}%
        </span>
        {showToast ? (
          <span
            style={{
              fontSize: 9,
              color: 'var(--verified-text)',
              background: 'var(--verified-soft)',
              padding: '2px 5px',
              borderRadius: 3,
              whiteSpace: 'nowrap',
            }}
          >
            +1 hit
          </span>
        ) : null}
      </div>
    </MiniBox>
  );
}
