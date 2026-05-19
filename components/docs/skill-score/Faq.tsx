// FAQ on the skill-score docs page. Uses native <details>/<summary> for
// accessibility — keyboard-navigable, screen-reader friendly, no JS.

import type { ReactNode } from 'react';

const ITEMS: Array<{ q: string; a: ReactNode }> = [
  {
    q: 'Can I see my raw (no-fade) score separately?',
    a: (
      <>
        Yes. Profile pages show both, with a small <em>was X before fading</em>{' '}
        sub-label whenever the gap is more than 3 points. The leaderboard ranks
        on the fading version.
      </>
    ),
  },
  {
    q: 'Why 180 days specifically?',
    a: (
      <>
        That&apos;s what Metaculus uses for its own forecasting tournaments.
        We picked it for consistency with the broader prediction-market
        research. If crypto-pace data later suggests it should be shorter or
        longer, we&apos;ll change it.
      </>
    ),
  },
  {
    q: 'Does making a new alias help my score?',
    a: (
      <>
        No. The score lives at the wallet level — misses on alias B drag
        alias A down. This is on purpose: it stops anyone from cherry-picking
        wins across many fake accounts.
      </>
    ),
  },
  {
    q: 'What about predictions decided years ago — do they count?',
    a: (
      <>
        Barely. At 540 days a hit weighs 12.5%; at 720 days, 6%. The score is
        dominated by what you called right in the last ~360 days.
      </>
    ),
  },
  {
    q: 'Where on the site will I see this score?',
    a: (
      <>
        Profile headline, the &quot;By wallet&quot; tab on the leaderboard, and
        the reputation API at{' '}
        <code className="mono">/api/wallet/[publisher]/stats</code>.
      </>
    ),
  },
  {
    q: 'How is difficulty decided?',
    a: (
      <>
        The AI judge picks a difficulty at the same moment it decides hit or
        miss. <em>Obvious</em> = already true on the day it was locked (the
        anti-spam choice). <em>Bold</em> = going against the consensus. See the
        Resolution Agent page for the full prompt the AI uses.
      </>
    ),
  },
];

export function Faq() {
  return (
    <div className="docs-faq" style={{ display: 'grid', gap: 8, marginTop: 8 }}>
      {ITEMS.map((it, i) => (
        <details
          key={i}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 4,
            background: 'var(--paper)',
            padding: '12px 14px',
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              fontWeight: 600,
              color: 'var(--ink)',
              fontSize: 14,
              listStyle: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              aria-hidden
              className="mono"
              style={{
                width: 22,
                color: 'var(--muted)',
                fontSize: 11,
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <span>{it.q}</span>
          </summary>
          <div
            style={{
              marginTop: 10,
              paddingLeft: 32,
              fontSize: 13,
              color: 'var(--ink-3)',
              lineHeight: 1.65,
            }}
          >
            {it.a}
          </div>
        </details>
      ))}
    </div>
  );
}
