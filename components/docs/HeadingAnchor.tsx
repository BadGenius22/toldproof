'use client';

// Renders the ¶ glyph after a heading; copies the anchor URL on click.
// Pure client. Toast on copy.

import { useState } from 'react';

export function HeadingAnchor({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  function onClick() {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}#${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
      // Also push the anchor into the URL bar without scroll-jumping.
      history.replaceState(null, '', `#${slug}`);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Copy link to ${slug}`}
      title={copied ? 'Link copied' : 'Copy link to section'}
      className="docs-heading-anchor"
      style={{
        marginLeft: 8,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: 14,
        color: copied ? 'var(--verified-text)' : 'var(--muted)',
        padding: '2px 4px',
        borderRadius: 3,
        opacity: copied ? 1 : 0,
        transition: 'opacity 120ms ease, color 120ms ease',
      }}
    >
      {copied ? '✓' : '¶'}
    </button>
  );
}

// Wrapper that combines an H2/H3 with its anchor + slug id. Used by sub-pages
// that opt into the shell's auto-anchor behaviour.
export function H2({ slug, children }: { slug: string; children: React.ReactNode }) {
  return (
    <h2
      id={slug}
      className="docs-heading docs-h2"
      style={{
        scrollMarginTop: 96,
        display: 'flex',
        alignItems: 'baseline',
        gap: 0,
        fontSize: 'clamp(22px, 2.4vw, 28px)',
        fontWeight: 600,
        letterSpacing: '-0.01em',
        marginTop: 48,
        marginBottom: 16,
        color: 'var(--ink)',
        lineHeight: 1.25,
      }}
    >
      <span>{children}</span>
      <HeadingAnchor slug={slug} />
    </h2>
  );
}

export function H3({ slug, children }: { slug: string; children: React.ReactNode }) {
  return (
    <h3
      id={slug}
      className="docs-heading docs-h3"
      style={{
        scrollMarginTop: 96,
        display: 'flex',
        alignItems: 'baseline',
        gap: 0,
        fontSize: 'clamp(16px, 1.6vw, 18px)',
        fontWeight: 600,
        marginTop: 28,
        marginBottom: 10,
        color: 'var(--ink)',
        lineHeight: 1.35,
      }}
    >
      <span>{children}</span>
      <HeadingAnchor slug={slug} />
    </h3>
  );
}
