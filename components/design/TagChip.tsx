import type { ReactNode } from 'react';

type Variant = 'bold' | 'warn' | 'verified' | 'sealed' | 'neutral';

interface VariantStyle {
  bg: string;
  fg: string;
  border: string;
}

const STYLES: Record<Variant, VariantStyle> = {
  bold:     { bg: 'var(--verified-soft)', fg: 'oklch(0.3 0.12 150)', border: 'var(--verified)' },
  verified: { bg: 'var(--verified-soft)', fg: 'oklch(0.35 0.12 150)', border: 'var(--verified)' },
  warn:     { bg: 'var(--warn-soft)',     fg: 'oklch(0.4 0.14 30)',   border: 'var(--warn)' },
  sealed:   { bg: 'var(--sealed-soft)',   fg: 'oklch(0.4 0.12 70)',   border: 'var(--sealed)' },
  neutral:  { bg: 'var(--paper-2)',       fg: 'var(--ink-3)',         border: 'var(--border)' },
};

interface TagChipProps {
  variant?: Variant;
  children: ReactNode;
  title?: string;
}

export function TagChip({ variant = 'neutral', children, title }: TagChipProps) {
  const s = STYLES[variant];
  return (
    <span
      className="tag-chip mono"
      title={title}
      style={{ background: s.bg, color: s.fg, borderColor: s.border }}
    >
      {children}
    </span>
  );
}
