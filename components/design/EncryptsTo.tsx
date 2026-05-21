'use client';

// EncryptsTo — the connector between the Before and After cards.
// A short downward line + arrow, then a 12-char hex row that shuffles
// every 90ms. Visual shorthand for "this turns into that, scrambled."
// Hidden on mobile (the cards stack there).

import { useEffect, useState } from 'react';

const HEX = '0123456789abcdef';

function randomHex(len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += HEX[Math.floor(Math.random() * 16)];
  return s;
}

export function EncryptsTo() {
  const [hex, setHex] = useState('a3f92b1c7e4d');

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const id = window.setInterval(() => setHex(randomHex(12)), 90);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="encrypts-to"
      aria-hidden
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'center',
      }}
    >
      <span style={{ width: 1, height: 22, background: 'var(--ink-3)' }} />
      <span style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1 }}>▼</span>
      <span
        className="eyebrow"
        style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}
      >
        encrypts to
      </span>
      <code
        style={{
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 11,
          letterSpacing: '0.1em',
          color: 'var(--sealed-text)',
          background: 'var(--sealed-soft)',
          padding: '3px 6px',
          borderRadius: 3,
        }}
      >
        {hex}
      </code>
    </div>
  );
}
