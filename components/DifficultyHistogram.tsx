// Difficulty mix bar — the visible anti-spam signal on every leaderboard
// row and profile page. The math (Skill Score with Wilson lower bound) is
// the invisible defense; this histogram is the social/visible one. A row
// that's 80% trivial calls reads as low-quality even before the reader
// computes anything.
//
// Used by /leaderboard and /[handle] profile.

import type { DifficultyMix } from '../lib/leaderboard';

interface Props {
  mix: DifficultyMix;
  // When compact, render as a single inline bar; otherwise stacked rows.
  compact?: boolean;
}

const LABELS: Record<keyof DifficultyMix, string> = {
  trivial: 'Already true',
  easy: 'Likely',
  medium: 'Real call',
  hard: 'Bold call',
  unknown: 'Not judged yet',
};

// Color tokens mapped to design palette. Trivial = warning. Hard = verified.
const COLORS: Record<keyof DifficultyMix, string> = {
  trivial: 'var(--warn)',
  easy: 'var(--ink-3)',
  medium: 'var(--ink)',
  hard: 'var(--verified)',
  unknown: 'var(--border)',
};

export function DifficultyHistogram({ mix, compact = false }: Props) {
  const total =
    mix.trivial + mix.easy + mix.medium + mix.hard + mix.unknown;

  if (total === 0) {
    return (
      <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
        No judged calls yet
      </span>
    );
  }

  // Order in the bar: hard first (best), then medium, easy, trivial, unknown.
  const order: Array<keyof DifficultyMix> = [
    'hard',
    'medium',
    'easy',
    'trivial',
    'unknown',
  ];

  if (compact) {
    return (
      <div
        className="row"
        style={{
          gap: 1,
          width: '100%',
          minWidth: 120,
          height: 8,
          border: '1px solid var(--border)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
        aria-label={describeMix(mix, total)}
        title={describeMix(mix, total)}
      >
        {order.map((k) => {
          const count = mix[k];
          if (count === 0) return null;
          return (
            <div
              key={k}
              style={{
                flex: count,
                background: COLORS[k],
                minWidth: 2,
              }}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 6 }}>
      {order.map((k) => {
        const count = mix[k];
        if (count === 0) return null;
        const pct = (count / total) * 100;
        return (
          <div key={k} className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span
              className="mono"
              style={{
                fontSize: 11,
                minWidth: 110,
                color: 'var(--ink-2)',
              }}
            >
              {LABELS[k]}
            </span>
            <div
              style={{
                flex: 1,
                height: 8,
                border: '1px solid var(--border)',
                borderRadius: 2,
                background: 'var(--paper-2)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: COLORS[k],
                }}
              />
            </div>
            <span
              className="mono"
              style={{
                fontSize: 11,
                minWidth: 32,
                textAlign: 'right',
                color: 'var(--muted)',
              }}
            >
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function describeMix(mix: DifficultyMix, total: number): string {
  // Used as title + aria-label on the compact bar so a hover/screen-reader
  // gets the breakdown without expanding.
  const parts: string[] = [];
  if (mix.hard) parts.push(`${mix.hard} bold`);
  if (mix.medium) parts.push(`${mix.medium} real call`);
  if (mix.easy) parts.push(`${mix.easy} likely`);
  if (mix.trivial) parts.push(`${mix.trivial} already-true`);
  if (mix.unknown) parts.push(`${mix.unknown} pending judgment`);
  return `${total} judged calls: ${parts.join(', ')}`;
}

// Helper for badges. Bold-caller: a profile where bold calls dominate AND
// hit rate on those bold calls is solid. Mostly-easy-caller: profile is
// dominated by trivial+easy, flag for honest disclosure.
export function deriveProfileTag(
  mix: DifficultyMix,
  hitRateOnBold: number,
): { kind: 'bold' | 'easy-heavy' | 'neutral'; label: string } | null {
  const total =
    mix.trivial + mix.easy + mix.medium + mix.hard;
  if (total < 3) return null;

  const boldShare = (mix.medium + mix.hard) / total;
  const easyShare = (mix.trivial + mix.easy) / total;

  if (boldShare >= 0.5 && hitRateOnBold >= 0.6) {
    return { kind: 'bold', label: '★ Bold caller' };
  }
  if (easyShare >= 0.7 && mix.trivial > 0) {
    return { kind: 'easy-heavy', label: '⚠ Mostly easy calls' };
  }
  return null;
}
