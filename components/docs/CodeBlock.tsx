'use client';

// Shared <CodeBlock> for /docs/* — header strip (filename + language) + body
// + copy-to-clipboard button. No external syntax highlighter (shiki would
// add ~1MB to the bundle); we keep the visual lightweight and rely on
// well-chosen colors + monospace for legibility.

import { useState } from 'react';

interface Props {
  code: string;
  language: string;
  filename?: string;
  /** Optional "open on GitHub" link — useful for source-pulled blocks. */
  href?: string;
  /** Optional caption / line-range hint. */
  caption?: string;
}

export function CodeBlock({ code, language, filename, href, caption }: Props) {
  const [copied, setCopied] = useState(false);

  function onCopy() {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  }

  return (
    <div
      className="docs-codeblock"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        background: 'var(--paper-2)',
        overflow: 'hidden',
        margin: '16px 0',
      }}
    >
      <div
        className="mono"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '7px 12px',
          background: 'var(--paper-3)',
          color: 'var(--muted)',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ color: 'var(--ink-2)', letterSpacing: '0.08em' }}>
          {language}
        </span>
        {filename ? (
          <span aria-hidden style={{ opacity: 0.5 }}>
            ·
          </span>
        ) : null}
        {filename ? <span>{filename}</span> : null}
        <span style={{ flex: 1 }} />
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            style={{
              color: 'var(--ink-3)',
              textDecoration: 'none',
              padding: '3px 6px',
              border: '1px solid var(--border)',
              borderRadius: 3,
              fontSize: 9.5,
              letterSpacing: '0.06em',
            }}
          >
            View on GitHub ↗
          </a>
        ) : null}
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy code to clipboard"
          style={{
            background: copied ? 'var(--verified-soft)' : 'var(--paper)',
            color: copied ? 'var(--verified-text)' : 'var(--ink-2)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            padding: '3px 8px',
            fontSize: 9.5,
            letterSpacing: '0.06em',
            cursor: 'pointer',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-mono), monospace',
          }}
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: 16,
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 12.5,
          lineHeight: 1.65,
          color: 'var(--ink-2)',
          overflowX: 'auto',
          background: 'transparent',
        }}
      >
        <code>{code}</code>
      </pre>
      {caption ? (
        <div
          className="mono"
          style={{
            padding: '8px 12px',
            fontSize: 10,
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            borderTop: '1px dashed var(--border)',
            background: 'var(--paper-2)',
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
}
