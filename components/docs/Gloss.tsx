'use client';

// <Gloss term="MCP">MCP</Gloss> — dotted-underlined term with hover/click
// popover. Term must exist in lib/glossary.ts. Popover flips to stay in
// viewport. Tap toggles on mobile; hover shows on desktop.

import { useEffect, useRef, useState } from 'react';
import { GLOSSARY, isGlossaryTerm, type GlossaryEntry } from '../../lib/glossary';

interface Props {
  term: string;
  children: React.ReactNode;
}

export function Gloss({ term, children }: Props) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'below' | 'above'>('below');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (!triggerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    // Flip above if there isn't room below.
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setPlacement(spaceBelow < 160 ? 'above' : 'below');
  }, [open]);

  if (!isGlossaryTerm(term)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`<Gloss term="${term}">: not in lib/glossary.ts`);
    }
    return <>{children}</>;
  }

  const entry: GlossaryEntry = GLOSSARY[term];

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        ref={triggerRef}
        className="docs-gloss"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-describedby={open ? `gloss-${slug(term)}` : undefined}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          font: 'inherit',
          color: 'inherit',
          cursor: 'help',
          lineHeight: 'inherit',
        }}
      >
        {children}
      </button>
      {open ? (
        <span
          ref={popoverRef}
          id={`gloss-${slug(term)}`}
          role="tooltip"
          className="docs-gloss-popover"
          style={{
            position: 'absolute',
            left: 0,
            [placement === 'below' ? 'top' : 'bottom']: 'calc(100% + 6px)',
          }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <span className="term">{term}</span>
          <span className="def">{entry.definition}</span>
          {entry.href ? (
            <a
              className="readmore"
              href={entry.href}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--ink-2)' }}
            >
              Read more ↗
            </a>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

function slug(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
