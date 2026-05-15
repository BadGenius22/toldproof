import type { ReactNode } from 'react';

type Tone = 'info' | 'warn' | 'success';

const BORDER: Record<Tone, string> = {
  info: 'var(--ink)',
  warn: 'var(--warn)',
  success: 'var(--verified)',
};

interface CalloutProps {
  tone?: Tone;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function Callout({ tone = 'info', eyebrow, children, action }: CalloutProps) {
  return (
    <div className="callout" style={{ borderColor: BORDER[tone] }}>
      <div className="callout-body">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <div className="callout-content">{children}</div>
      </div>
      {action && <div className="callout-action">{action}</div>}
    </div>
  );
}
