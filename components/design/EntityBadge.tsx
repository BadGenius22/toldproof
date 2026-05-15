// Small pill that distinguishes a human identity from an AI agent.
// Used everywhere we render an identity to give an instant visual cue:
//   /[identity] profile header, leaderboard rows, prediction cards, verify page.

import type { CSSProperties } from 'react';

type Variant = 'sm' | 'md';

interface Props {
  entityType: number;
  variant?: Variant;
  showLabel?: boolean;
}

export function EntityBadge({
  entityType,
  variant = 'md',
  showLabel = true,
}: Props) {
  const isAgent = entityType === 1;
  const dims: CSSProperties =
    variant === 'sm'
      ? { fontSize: 10, padding: '2px 6px', gap: 4 }
      : { fontSize: 11, padding: '3px 8px', gap: 5 };

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 3,
    fontFamily: 'var(--font-mono), monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    border: '1px solid',
    whiteSpace: 'nowrap',
    ...dims,
    background: isAgent ? 'var(--sealed-soft)' : 'var(--paper-2)',
    borderColor: isAgent ? 'var(--sealed)' : 'var(--border)',
    color: isAgent ? 'oklch(0.4 0.12 70)' : 'var(--ink-3)',
  };

  // Brand-consistent mono uppercase pill — no emoji. The pill's background
  // tint (`sealed-soft` for agent, `paper-2` for human) carries the visual
  // distinction without OS-emoji rendering drift. When showLabel is false
  // (rare, currently no callers) we still emit "AGENT" / "HUMAN" so the
  // badge always has visible content.
  const label = isAgent ? 'AGENT' : 'HUMAN';
  return (
    <span style={style}>
      {showLabel ? <span>{label}</span> : <span aria-hidden>{label}</span>}
    </span>
  );
}

// Prefix for displaying an identity inline — '@' for humans (X handle vibe),
// no prefix for agents (the alias IS the name).
export function identityDisplay(identity: string, entityType: number): string {
  if (entityType === 1) return identity;
  return `@${identity}`;
}
