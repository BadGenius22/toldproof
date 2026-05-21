'use client';

// FaqItem — collapsible FAQ row (native <details> for a11y + JSON-LD).
// Adds: hover-reveal "#" button that copies a deep-link + toasts; and an
// on-mount check that opens this item if the URL hash points at it.

import { useEffect, useRef, useState } from 'react';

interface Props {
  q: string;
  slug: string;
  children: React.ReactNode;
}

export function FaqItem({ q, slug, children }: Props) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.slice(1);
    if (hash === slug && ref.current) {
      ref.current.open = true;
      ref.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [slug]);

  function copyLink(e: React.MouseEvent) {
    e.preventDefault();
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}#${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
      history.replaceState(null, '', `#${slug}`);
    });
  }

  return (
    <details
      ref={ref}
      id={slug}
      className="faq-item"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        background: 'var(--paper)',
        padding: '14px 18px',
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--ink)',
          listStyle: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {q}
          <button
            type="button"
            onClick={copyLink}
            className="faq-anchor mono"
            aria-label={`Copy link to: ${q}`}
            style={{
              fontSize: 12,
              color: copied ? 'var(--verified-text)' : 'var(--muted)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0 2px',
              opacity: copied ? 1 : 0,
              transition: 'opacity 0.12s',
            }}
          >
            {copied ? 'link copied' : '#'}
          </button>
        </span>
        <span className="mono" style={{ color: 'var(--muted)', fontWeight: 400 }}>
          +
        </span>
      </summary>
      <p
        style={{
          margin: '10px 0 0',
          fontSize: 14,
          color: 'var(--ink-3)',
          lineHeight: 1.6,
          textWrap: 'pretty',
        }}
      >
        {children}
      </p>
    </details>
  );
}
