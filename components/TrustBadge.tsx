// V4 T1.4 — trust badge pill. Computed from on-chain alias history, shown
// on profile headers, leaderboard rows, and the wallet provenance footer.
// Pure presentational — input is a BehaviorBadge variant + optional title.
//
// Spec: docs/design/V4_BUILD_SPEC_T1.md §T1.4.

import {
  BEHAVIOR_BADGE_RULES,
  type BehaviorBadge,
} from '../lib/wallet-provenance';

interface Props {
  variant: BehaviorBadge;
  /** Override the default `title` text. Optional. */
  title?: string;
}

interface PillStyle {
  bg: string;
  fg: string;
  border: string;
}

const STYLE_BY_VARIANT: Record<NonNullable<BehaviorBadge>, PillStyle> = {
  single: {
    bg: 'var(--verified-soft, oklch(0.94 0.06 150))',
    fg: 'oklch(0.3 0.12 150)',
    border: 'var(--verified)',
  },
  multi: {
    bg: 'oklch(0.94 0.05 240)',
    fg: 'oklch(0.4 0.12 240)',
    border: 'oklch(0.55 0.12 240)',
  },
  churn: {
    bg: 'var(--warn-soft, oklch(0.94 0.06 30))',
    fg: 'oklch(0.4 0.16 30)',
    border: 'var(--warn)',
  },
  spam: {
    bg: 'oklch(0.93 0.07 25)',
    fg: 'oklch(0.4 0.20 25)',
    border: 'oklch(0.52 0.20 25)',
  },
};

export function TrustBadge({ variant, title }: Props) {
  if (variant === null) return null;
  const style = STYLE_BY_VARIANT[variant];
  const rule = BEHAVIOR_BADGE_RULES.find((r) => r.variant === variant);
  if (!rule) return null;

  // Default title spells out the rule in plain English so hover / screen
  // readers get the criterion without leaving the page.
  const titleText = title ?? `${rule.label} · ${rule.signal}`;

  return (
    <span
      title={titleText}
      aria-label={titleText}
      className="mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 9px',
        borderRadius: 999,
        fontSize: 11,
        letterSpacing: '0.04em',
        background: style.bg,
        color: style.fg,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {rule.label}
    </span>
  );
}
