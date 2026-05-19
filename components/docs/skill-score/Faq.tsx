// FAQ on the skill-score docs page. Uses native <details>/<summary> for
// accessibility — keyboard-navigable, screen-reader friendly, no JS.

import type { ReactNode } from 'react';

const ITEMS: Array<{ q: string; a: ReactNode }> = [
  {
    q: 'Can I see my raw (no-decay) score separately?',
    a: (
      <>
        Yes. Profile pages show both, with a small <em>decayed from X</em>{' '}
        sub-label whenever the delta is more than 3 points. The leaderboard
        ranks on the decayed version.
      </>
    ),
  },
  {
    q: 'Why 180 days specifically?',
    a: (
      <>
        Metaculus default for forecasting tournaments. We adopted it for
        consistency with the broader prediction-market literature. If crypto
        cadence data eventually shows the half-life should be shorter or
        longer, we&apos;ll revise.
      </>
    ),
  },
  {
    q: 'Does adding a new alias help my score?',
    a: (
      <>
        No. The score is wallet-level — misses on alias B drag down alias A.
        This is intentional: it prevents sharded fleets from cherry-picking
        wins.
      </>
    ),
  },
  {
    q: 'What about predictions resolved years ago — do they count?',
    a: (
      <>
        Barely. At 540 days a hit weighs 12.5%; at 720 days, 6%. The score is
        dominated by the last ~360 days of activity.
      </>
    ),
  },
  {
    q: 'Where on the site will I see this score?',
    a: (
      <>
        Profile headline, the &quot;By wallet&quot; tab on the leaderboard, and
        the Reputation API at <code className="mono">/api/wallet/[publisher]/stats</code>.
      </>
    ),
  },
  {
    q: 'How is difficulty assigned?',
    a: (
      <>
        The AI judge classifies difficulty at the same step that decides
        hit/miss. Trivial = already true at lock time (the anti-spam choice).
        Bold = contrarian or surprising. See the Resolution Agent page for
        the full prompt.
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
