'use client';

// Right-rail TOC. Uses IntersectionObserver on H2/H3 inside the main column
// to highlight the active section as the reader scrolls.

import { useEffect, useState } from 'react';

interface TocItem {
  slug: string;
  title: string;
  level: 2 | 3;
}

interface Props {
  items: TocItem[];
  editUrl: string;
}

export function DocsToc({ items, editUrl }: Props) {
  const [activeSlug, setActiveSlug] = useState<string | null>(items[0]?.slug ?? null);

  useEffect(() => {
    if (typeof window === 'undefined' || items.length === 0) return;
    const headings = items
      .map((i) => document.getElementById(i.slug))
      .filter((el): el is HTMLElement => !!el);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting heading.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        if (visible[0]) setActiveSlug(visible[0].id);
      },
      // Pull the activation zone down a bit so a heading "lights up" when it
      // hits ~20% from top, not at the very top of the viewport.
      { rootMargin: '-20% 0px -70% 0px', threshold: [0, 1] },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="On this page"
      className="docs-toc"
      style={{ display: 'grid', gap: 16, fontSize: 12 }}
    >
      <div className="eyebrow">On this page</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
        {items.map((i) => {
          const active = i.slug === activeSlug;
          return (
            <li key={i.slug}>
              <a
                href={`#${i.slug}`}
                style={{
                  display: 'block',
                  paddingLeft: i.level === 3 ? 14 : 0,
                  paddingTop: 3,
                  paddingBottom: 3,
                  borderLeft: active ? '2px solid var(--ink)' : '2px solid transparent',
                  marginLeft: -2,
                  paddingInlineStart: i.level === 3 ? 16 : 8,
                  fontSize: i.level === 3 ? 11 : 12,
                  color: active ? 'var(--ink)' : 'var(--ink-3)',
                  fontWeight: active ? 600 : 400,
                  textDecoration: 'none',
                  letterSpacing: '0.01em',
                  lineHeight: 1.45,
                  transition: 'color 120ms ease, border-color 120ms ease',
                }}
              >
                {i.title}
              </a>
            </li>
          );
        })}
      </ul>
      <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Actions
        </div>
        <a
          href={editUrl}
          target="_blank"
          rel="noreferrer"
          className="mono"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            letterSpacing: '0.04em',
            color: 'var(--ink-2)',
            textDecoration: 'none',
            padding: '6px 8px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            background: 'var(--paper)',
          }}
        >
          Edit on GitHub ↗
        </a>
      </div>
    </nav>
  );
}
