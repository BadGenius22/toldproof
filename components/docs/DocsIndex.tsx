'use client';

// The /docs index — numbered cards reorderable by audience.
// Pulls page meta (last-commit date + reading time) from a server-prepared
// map keyed by slug. Renders the redesigned hero + featured first card.

import Link from 'next/link';
import { useMemo } from 'react';
import { DOCS_NAV, DOCS_REFERENCE, type DocsNavItem } from '../../lib/docs-nav';
import { AudienceSwitcher, useAudience, type Audience } from './AudienceSwitcher';

type SlugMeta = {
  sha: string;
  date: string;
  readingMin: number;
};

interface Props {
  metas: Record<string, SlugMeta>;
}

const AUDIENCE_ORDER: Record<Audience, string[]> = {
  judge: ['audit', 'architecture', 'move-contract', 'resolution', 'mcp'],
  developer: ['architecture', 'move-contract', 'mcp', 'resolution', 'audit'],
  operator: ['architecture', 'audit', 'resolution', 'mcp', 'move-contract'],
};

export function DocsIndex({ metas }: Props) {
  const [audience, setAudience] = useAudience();

  const orderedNav = useMemo(() => {
    const order = AUDIENCE_ORDER[audience];
    return order
      .map((slug) => DOCS_NAV.find((n) => n.slug === slug))
      .filter((n): n is DocsNavItem => !!n);
  }, [audience]);

  return (
    <>
      <div
        className="row"
        style={{
          gap: 14,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginTop: 24,
          marginBottom: 6,
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Reading order
        </span>
        <AudienceSwitcher value={audience} onChange={setAudience} />
        <span
          style={{
            fontSize: 12,
            color: 'var(--muted)',
          }}
        >
          We reorder cards to put what matters most to{' '}
          <strong style={{ color: 'var(--ink-3)' }}>{audience}s</strong> on top.
        </span>
      </div>

      <ul
        style={{
          margin: '24px 0 0',
          padding: 0,
          listStyle: 'none',
          display: 'grid',
          gap: 16,
        }}
      >
        {orderedNav.map((n, i) => {
          const meta = metas[n.slug] ?? {
            sha: 'local',
            date: '—',
            readingMin: 3,
          };
          const featured = i === 0;
          return (
            <li key={n.slug}>
              <IndexCard nav={n} meta={meta} featured={featured} />
            </li>
          );
        })}
      </ul>

      <div
        style={{
          marginTop: 24,
          padding: 22,
          border: '1px solid var(--border)',
          borderRadius: 4,
          background: 'var(--paper-2)',
          display: 'grid',
          gap: 12,
        }}
      >
        <span className="eyebrow">Reference</span>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
          }}
        >
          Methodology footnotes that aren&apos;t peer pages — separate group so the
          main 5 stay focused.
        </p>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'grid',
            gap: 8,
          }}
        >
          {DOCS_REFERENCE.map((n) => {
            const meta = metas[n.slug] ?? {
              sha: 'local',
              date: '—',
              readingMin: 3,
            };
            return (
              <li key={n.slug}>
                <ReferenceCard nav={n} meta={meta} />
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

function IndexCard({
  nav,
  meta,
  featured,
}: {
  nav: DocsNavItem;
  meta: SlugMeta;
  featured: boolean;
}) {
  return (
    <Link
      href={`/docs/${nav.slug}`}
      style={{
        display: 'grid',
        gridTemplateColumns: '88px 1fr',
        gap: 0,
        textDecoration: 'none',
        color: 'inherit',
        border: featured ? '1px solid var(--ink)' : '1px solid var(--border)',
        borderRadius: 4,
        background: 'var(--paper)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: featured ? 'var(--ink)' : 'var(--paper-2)',
          color: featured ? 'var(--paper)' : 'var(--ink-2)',
          padding: '24px 12px',
          display: 'grid',
          gap: 6,
          alignContent: 'flex-start',
          fontFamily: 'var(--font-mono), monospace',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '0.06em',
            lineHeight: 1,
          }}
        >
          {nav.ix}
        </div>
        {featured ? (
          <div
            style={{
              fontSize: 9,
              letterSpacing: '0.18em',
              opacity: 0.85,
            }}
          >
            START HERE
          </div>
        ) : null}
      </div>
      <div
        style={{
          padding: '22px 24px',
          display: 'grid',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <span
            className="eyebrow"
            style={{ color: featured ? 'var(--sealed-text)' : 'var(--muted)' }}
          >
            {featured ? 'Start here ·' : ''} {nav.title.toUpperCase()}
          </span>
          {nav.badge ? (
            <span
              className="mono"
              style={{
                fontSize: 10,
                color: 'var(--muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              · {nav.badge}
            </span>
          ) : null}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--ink)',
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
          }}
        >
          {nav.title}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
          }}
        >
          {nav.blurb}
        </p>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'grid',
            gap: 3,
          }}
        >
          {nav.subs.slice(0, 3).map((s) => (
            <li
              key={s.slug}
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                letterSpacing: '0.03em',
              }}
            >
              <span style={{ color: 'var(--sealed-text)' }}>§</span> {s.title}
            </li>
          ))}
        </ul>
        <div
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--muted)',
            letterSpacing: '0.06em',
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span>{meta.readingMin} min read</span>
          <span aria-hidden>·</span>
          <span>updated {meta.date}</span>
          {nav.stat ? (
            <>
              <span aria-hidden>·</span>
              <span style={{ color: 'var(--ink-3)' }}>{nav.stat}</span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function ReferenceCard({ nav, meta }: { nav: DocsNavItem; meta: SlugMeta }) {
  return (
    <Link
      href={`/docs/${nav.slug}`}
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        padding: '12px 14px',
        background: 'var(--paper)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.1em',
          color: 'var(--muted)',
          textTransform: 'uppercase',
          minWidth: 24,
        }}
      >
        {nav.ix}
      </span>
      <div style={{ flex: 1, display: 'grid', gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
          {nav.title}
        </span>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          {nav.blurb}
        </span>
      </div>
      <span
        className="mono"
        style={{
          fontSize: 10,
          color: 'var(--muted)',
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
        }}
      >
        {meta.readingMin} min
      </span>
    </Link>
  );
}
