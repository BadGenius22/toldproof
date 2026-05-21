'use client';

// RecognizeReceipt — teaches a visitor how to read a real toldproof
// receipt. A receipt on the left with 5 numbered chips on specific rows;
// a legend of 5 callout cards on the right. Hovering a row highlights its
// callout and vice versa. Keyboard: focus the receipt, arrow-cycle 1–5.

import { useState } from 'react';
import { PageEyebrow } from './Receipt';

type Accent = 'verified' | 'sealed' | 'warn';

interface Callout {
  n: number;
  label: string;
  rowKey: string;
  why: string;
  accent: Accent;
}

const CALLOUTS: Callout[] = [
  {
    n: 1,
    label: 'Block timestamp',
    rowKey: 'sealed',
    accent: 'verified',
    why: "Written by Sui at the moment of lock. Not your clock, not our clock — the chain's. It can't be edited after the fact.",
  },
  {
    n: 2,
    label: 'SHA-256 fingerprint',
    rowKey: 'sha256',
    accent: 'sealed',
    why: 'A fingerprint of your exact text. Change one letter before the open step and Sui rejects it. The words were fixed before the answer was known.',
  },
  {
    n: 3,
    label: 'Walrus blob id',
    rowKey: 'walrus',
    accent: 'sealed',
    why: "The scrambled text lives on Walrus, a storage network we don't run. If we vanish tomorrow, your prediction still opens on schedule.",
  },
  {
    n: 4,
    label: 'Wallet ↔ X handle',
    rowKey: 'handle',
    accent: 'verified',
    why: "Linked on Sui. The handle in the tweet is the handle that signed the lock. Nobody can claim someone else's receipt.",
  },
  {
    n: 5,
    label: 'Open moment',
    rowKey: 'unlock',
    accent: 'warn',
    why: "Time-locked by Seal's 2-of-3 key-server threshold. No early opens — the key can't be rebuilt before this moment.",
  },
];

const ROWS: Array<{ key: string; field: string; value: string }> = [
  { key: 'sealed', field: 'sealed-at', value: '2026-02-14 09:23:01 UTC' },
  { key: 'sha256', field: 'sha256', value: '4f8e2a7d1c9b5e3f6a8d2c4b…' },
  { key: 'walrus', field: 'walrus', value: 'K9pM2nL5tY7wB1eS6jH4uA…' },
  { key: 'handle', field: 'x-handle', value: '@dewaxindo · 0x3f9a…2a1f' },
  { key: 'unlock', field: 'unlock-at', value: '2026-05-20 00:00:00 UTC' },
];

function accentColor(a: Accent): string {
  return a === 'verified'
    ? 'var(--verified)'
    : a === 'warn'
      ? 'var(--warn)'
      : 'var(--sealed)';
}
function accentSoft(a: Accent): string {
  return a === 'verified'
    ? 'var(--verified-soft)'
    : a === 'warn'
      ? 'var(--warn-soft)'
      : 'var(--sealed-soft)';
}

export function RecognizeReceipt() {
  const [active, setActive] = useState<number | null>(null);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      setActive((n) => (n == null ? 1 : (n % 5) + 1));
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive((n) => (n == null ? 5 : ((n + 3) % 5) + 1));
    } else if (e.key === 'Escape') {
      setActive(null);
    }
  }

  return (
    <div className="mt-48">
      <PageEyebrow>How to read a real receipt</PageEyebrow>
      <h2 className="section" style={{ marginTop: 12, maxWidth: 760 }}>
        Five fields. Every one of them checkable by anyone.
      </h2>
      <p
        style={{
          marginTop: 14,
          fontSize: 15,
          color: 'var(--ink-3)',
          lineHeight: 1.55,
          maxWidth: 720,
        }}
      >
        Every toldproof URL exposes the same five fields. Hover a row to see
        what it proves — or arrow-key through them.
      </p>

      <div className="recognize-grid mt-24">
        {/* Receipt */}
        <div
          tabIndex={0}
          role="group"
          aria-label="Annotated receipt — arrow keys cycle the five callouts"
          onKeyDown={onKeyDown}
          onMouseLeave={() => setActive(null)}
          style={{
            border: '2px solid var(--ink)',
            borderRadius: 6,
            background: 'var(--paper)',
            boxShadow: '5px 5px 0 var(--ink)',
            overflow: 'hidden',
            outline: 'none',
          }}
        >
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
            <span>· toldproof receipt</span>
            <span>verify/0x7f3a…8c2e</span>
          </div>
          <div style={{ padding: '6px 0' }}>
            {ROWS.map((row) => {
              const callout = CALLOUTS.find((c) => c.rowKey === row.key)!;
              const isActive = active === callout.n;
              return (
                <div
                  key={row.key}
                  onMouseEnter={() => setActive(callout.n)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 84px 1fr',
                    gap: 10,
                    alignItems: 'center',
                    padding: '9px 12px',
                    background: isActive ? 'var(--paper-2)' : 'transparent',
                    borderLeft: isActive
                      ? `3px solid ${accentColor(callout.accent)}`
                      : '3px solid transparent',
                    cursor: 'default',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      fontFamily: 'var(--font-mono), monospace',
                      fontSize: 11,
                      fontWeight: 700,
                      background: isActive
                        ? accentColor(callout.accent)
                        : accentSoft(callout.accent),
                      color: isActive ? 'var(--paper)' : accentColor(callout.accent),
                      border: `1px solid ${accentColor(callout.accent)}`,
                    }}
                  >
                    {callout.n}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                    }}
                  >
                    {row.field}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 12,
                      color: 'var(--ink-2)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {row.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          {CALLOUTS.map((c) => {
            const isActive = active === c.n;
            return (
              <div
                key={c.n}
                onMouseEnter={() => setActive(c.n)}
                onMouseLeave={() => setActive(null)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '24px 1fr',
                  gap: 12,
                  padding: '12px 14px',
                  border: `1px solid ${isActive ? 'var(--ink)' : 'var(--border)'}`,
                  borderRadius: 4,
                  background: 'var(--paper)',
                  boxShadow: isActive ? '4px 4px 0 var(--ink)' : 'none',
                  transition: 'box-shadow 80ms ease',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--font-mono), monospace',
                    fontSize: 12,
                    fontWeight: 700,
                    background: isActive
                      ? accentColor(c.accent)
                      : accentSoft(c.accent),
                    color: isActive ? 'var(--paper)' : accentColor(c.accent),
                    border: `1px solid ${accentColor(c.accent)}`,
                  }}
                >
                  {c.n}
                </span>
                <div style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                    {c.label}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                    {c.why}
                  </span>
                </div>
              </div>
            );
          })}
          <p
            className="mono"
            style={{
              margin: '4px 0 0',
              padding: '10px 12px',
              borderTop: '1px dashed var(--border)',
              fontSize: 11,
              color: 'var(--muted)',
              lineHeight: 1.6,
              letterSpacing: '0.02em',
            }}
          >
            Any toldproof URL exposes these five fields raw. Paste one into a
            verifier and check them yourself.
          </p>
        </div>
      </div>
    </div>
  );
}
