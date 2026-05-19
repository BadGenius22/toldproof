// DocsShell — the layout chrome wrapping every /docs/* page.
// Sidebar (left) + main (center) + TOC (right) + meta strip + footer.
// Server component; pulls last commit + reading time at build time.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageEyebrow } from '../design';
import {
  DOCS_NAV,
  DOCS_REFERENCE,
  findNavItem,
  getPrevNext,
  type DocsNavItem,
} from '../../lib/docs-nav';
import { pageMeta } from '../../lib/docs-meta';
import { MetaStrip } from './MetaStrip';
import { DocsToc } from './DocsToc';
import { DocsSearch } from './DocsSearch';

const GITHUB_BASE = 'https://github.com/BadGenius22/toldproof/edit/main';

interface Props {
  slug: string;
  /** Optional override of the page title (defaults to nav item title). */
  title?: string;
  /** Optional lede paragraph rendered below the H1. */
  lede?: ReactNode;
  /** Optional override of the visual eyebrow above the H1. */
  eyebrow?: string;
  children: ReactNode;
}

export function DocsShell({ slug, title, lede, eyebrow, children }: Props) {
  const nav = findNavItem(slug);
  if (!nav) {
    throw new Error(
      `DocsShell: unknown slug "${slug}". Add it to lib/docs-nav.ts.`,
    );
  }
  const meta = pageMeta(slug);
  const { prev, next } = getPrevNext(slug);
  const editUrl = `${GITHUB_BASE}/app/docs/${slug}/page.tsx`;

  return (
    <div className="docs-shell">
      <div className="docs-shell-grid">
        <aside className="docs-shell-sidebar" aria-label="Docs navigation">
          <SidebarInner currentSlug={slug} />
        </aside>

        <main className="docs-shell-main">
          <DocsSearch />
          <PageEyebrow>{eyebrow ?? 'Docs'}</PageEyebrow>
          <h1
            className="display docs-h1"
            style={{
              fontSize: 'clamp(32px, 4.5vw, 52px)',
              marginTop: 12,
              marginBottom: 14,
              maxWidth: 780,
              textWrap: 'pretty',
            }}
          >
            {title ?? nav.title}
          </h1>
          {lede ? (
            <div
              style={{
                fontSize: 16,
                color: 'var(--ink-3)',
                lineHeight: 1.55,
                maxWidth: 720,
                marginBottom: 8,
              }}
            >
              {lede}
            </div>
          ) : null}
          <MetaStrip meta={meta} ix={nav.ix} total={DOCS_NAV.length} />
          <div className="docs-shell-body">{children}</div>
          <DocsShellFooter prev={prev} next={next} editUrl={editUrl} />
        </main>

        <aside className="docs-shell-toc" aria-label="On this page">
          <DocsToc
            items={nav.subs.map((s) => ({
              slug: s.slug,
              title: s.title,
              level: 2,
            }))}
            editUrl={editUrl}
          />
        </aside>
      </div>
    </div>
  );
}

function SidebarInner({ currentSlug }: { currentSlug: string }) {
  return (
    <nav style={{ display: 'grid', gap: 24, fontSize: 13 }}>
      <Link
        href="/docs"
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          textDecoration: 'none',
        }}
      >
        Docs
      </Link>
      <SidebarGroup label="Guide" items={DOCS_NAV} currentSlug={currentSlug} />
      <SidebarGroup
        label="Reference"
        items={DOCS_REFERENCE}
        currentSlug={currentSlug}
      />
      <div
        style={{
          borderTop: '1px dashed var(--border)',
          paddingTop: 16,
          display: 'grid',
          gap: 8,
        }}
      >
        <span className="eyebrow">Deeper</span>
        <SidebarExternalLink
          href="https://github.com/BadGenius22/toldproof"
          label="GitHub repo ↗"
        />
        <SidebarExternalLink
          href="https://github.com/BadGenius22/toldproof/blob/main/spec.md"
          label="spec.md ↗"
        />
        <SidebarExternalLink
          href="https://github.com/BadGenius22/toldproof/blob/main/AUDIT_REPORT_V3.md"
          label="v3 audit ↗"
        />
      </div>
    </nav>
  );
}

function SidebarGroup({
  label,
  items,
  currentSlug,
}: {
  label: string;
  items: DocsNavItem[];
  currentSlug: string;
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span className="eyebrow">{label}</span>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 2 }}>
        {items.map((n) => {
          const active = n.slug === currentSlug;
          return (
            <li key={n.slug}>
              <Link
                href={`/docs/${n.slug}`}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 4,
                  background: active ? 'var(--paper-2)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-2)',
                  fontWeight: active ? 600 : 400,
                  textDecoration: 'none',
                  lineHeight: 1.35,
                  borderLeft: active ? '2px solid var(--ink)' : '2px solid transparent',
                  marginLeft: -2,
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: active ? 'var(--sealed-text)' : 'var(--muted)',
                    letterSpacing: '0.06em',
                    flex: '0 0 auto',
                  }}
                >
                  {n.ix}
                </span>
                <span style={{ flex: 1 }}>{n.title}</span>
                {n.badge ? (
                  <span
                    className="mono"
                    style={{
                      fontSize: 9,
                      color: 'var(--muted)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {n.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SidebarExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="mono"
      style={{
        fontSize: 11,
        color: 'var(--ink-2)',
        textDecoration: 'none',
        letterSpacing: '0.04em',
        padding: '4px 0',
      }}
    >
      {label}
    </a>
  );
}

function DocsShellFooter({
  prev,
  next,
  editUrl,
}: {
  prev: DocsNavItem | null;
  next: DocsNavItem | null;
  editUrl: string;
}) {
  return (
    <footer
      className="docs-shell-footer"
      style={{
        borderTop: '1px solid var(--border)',
        paddingTop: 24,
        marginTop: 48,
        display: 'grid',
        gap: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {prev ? (
          <FooterLink to={`/docs/${prev.slug}`} label={`← ${prev.title}`} />
        ) : (
          <span />
        )}
        {next ? (
          <FooterLink to={`/docs/${next.slug}`} label={`${next.title} →`} primary />
        ) : (
          <span />
        )}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: '0.04em',
          color: 'var(--muted)',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <a
          href={editUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--ink-3)', textDecoration: 'none' }}
        >
          Edit this page on GitHub ↗
        </a>
        <a
          href="/docs/feed.xml"
          style={{ color: 'var(--ink-3)', textDecoration: 'none' }}
        >
          Subscribe to RSS ↗
        </a>
      </div>
    </footer>
  );
}

function FooterLink({
  to,
  label,
  primary = false,
}: {
  to: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={to}
      className={primary ? 'btn' : 'btn ghost'}
      style={{ whiteSpace: 'nowrap' }}
    >
      {label}
    </Link>
  );
}
