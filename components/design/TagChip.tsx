import type { ReactNode } from 'react';

type Variant = 'bold' | 'warn' | 'verified' | 'sealed' | 'neutral';

interface VariantStyle {
  bg: string;
  fg: string;
  border: string;
}

const STYLES: Record<Variant, VariantStyle> = {
  bold:     { bg: 'var(--verified-soft)', fg: 'var(--verified-text)', border: 'var(--verified)' },
  verified: { bg: 'var(--verified-soft)', fg: 'var(--verified-text)', border: 'var(--verified)' },
  warn:     { bg: 'var(--warn-soft)',     fg: 'var(--warn-text)',     border: 'var(--warn)' },
  sealed:   { bg: 'var(--sealed-soft)',   fg: 'var(--sealed-text)',   border: 'var(--sealed)' },
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
