'use client';

import { useState } from 'react';

interface CopyableHashProps {
  value: string;
  display: string;
  href?: string;
  label?: string;
}

// Inline hash + copy button + optional external link. Used wherever a Sui
// address or object ID is rendered next to an explorer link (profile header,
// receipts, etc.). One-click copy with a 1.5s flash, falls back silently if
// the clipboard API is blocked.
export function CopyableHash({ value, display, href, label }: CopyableHashProps) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — silent no-op */
    }
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mono"
          style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}
        >
          {display}
        </a>
      ) : (
        <span className="mono" style={{ color: 'var(--ink-2)' }}>
          {display}
        </span>
      )}
      <button
        type="button"
        onClick={onCopy}
        aria-label={label ? `Copy ${label}` : 'Copy value'}
        title={copied ? 'Copied!' : 'Copy'}
        style={{
          all: 'unset',
          cursor: 'pointer',
          fontSize: 11,
          color: copied ? 'var(--verified)' : 'var(--muted)',
          padding: '0 4px',
          lineHeight: 1,
        }}
      >
        {copied ? '✓' : '⧉'}
      </button>
    </span>
  );
}
