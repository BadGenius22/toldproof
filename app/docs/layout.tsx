// Docs section layout — breadcrumb back to /docs renders on every sub-page.
// Index page suppresses the breadcrumb visually by rendering its own header.

import Link from 'next/link';
import type { ReactNode } from 'react';

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function DocsFooterNav({
  prev,
  next,
}: {
  prev: { href: string; label: string } | null;
  next: { href: string; label: string } | null;
}) {
  return (
    <div
      className="mt-48"
      style={{
        borderTop: '1px solid var(--border)',
        paddingTop: 24,
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      {prev ? (
        <Link href={prev.href} className="btn ghost">
          ← {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} className="btn">
          {next.label} →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

// Sub-pages use this directly instead of consuming via layout, so the index
// page stays clean (no double-eyebrow).
export function DocsBreadcrumb({ here }: { here: string }) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 11,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
      }}
    >
      <Link
        href="/docs"
        style={{ color: 'var(--ink-3)', textDecoration: 'none' }}
      >
        Docs
      </Link>
      <span aria-hidden>›</span>
      <span>{here}</span>
    </div>
  );
}
