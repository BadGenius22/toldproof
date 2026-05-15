import type { ReactNode } from 'react';

type Hue = 'verified' | 'sealed' | 'warn' | 'neutral';
type Size = 'sm' | 'md' | 'lg';

interface StatProps {
  label: string;
  value: string | number;
  sub?: string;
  hue?: Hue;
  size?: Size;
}

const HUE_VAR: Record<Hue, string> = {
  verified: 'var(--verified)',
  sealed: 'var(--sealed)',
  warn: 'var(--warn)',
  neutral: 'var(--ink)',
};

const VALUE_SIZE: Record<Size, number> = { sm: 22, md: 32, lg: 44 };

export function Stat({ label, value, sub, hue = 'neutral', size = 'md' }: StatProps) {
  return (
    <div className="stat-cell">
      <span className="eyebrow">{label}</span>
      <span
        className="stat-value"
        style={{ fontSize: VALUE_SIZE[size], color: HUE_VAR[hue] }}
      >
        {value}
      </span>
      {sub && <span className="stat-sub mono">{sub}</span>}
    </div>
  );
}

interface StatStripProps {
  children: ReactNode;
  bordered?: boolean;
}

export function StatStrip({ children, bordered = true }: StatStripProps) {
  return (
    <div className={`stat-strip${bordered ? ' stat-strip-bordered' : ''}`}>
      {children}
    </div>
  );
}
