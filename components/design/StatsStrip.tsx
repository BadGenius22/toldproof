'use client';

// StatsStrip — four bordered cells below the live ticker. Each number
// counts up from 0 → target when the strip first scrolls into view.
// SSR renders the final target (crawlers + no-JS see real values); the
// count-up is a post-hydration flourish only.

import { useEffect, useRef, useState } from 'react';

interface Props {
  sealed: number;
  revealed: number;
  hitRate: number; // 0..100
  avgLock: number; // days
}

export function StatsStrip({ sealed, revealed, hitRate, avgLock }: Props) {
  return (
    <div
      className="stats-strip"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        border: '1px solid var(--ink)',
        borderRadius: 4,
        overflow: 'hidden',
        background: 'var(--paper)',
      }}
    >
      <StatCell target={sealed} label="Sealed" />
      <StatCell target={revealed} label="Revealed" border />
      <StatCell target={hitRate} label="Hit rate" suffix="%" />
      <StatCell target={avgLock} label="Avg lock" suffix="d" border />
    </div>
  );
}

function StatCell({
  target,
  label,
  suffix = '',
  border = false,
}: {
  target: number;
  label: string;
  suffix?: string;
  border?: boolean;
}) {
  const safeTarget = Number.isFinite(target) ? Math.max(0, Math.round(target)) : 0;
  const [value, setValue] = useState(safeTarget);
  const ref = useRef<HTMLDivElement>(null);
  const ran = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || ran.current) return;
    if (
      typeof window === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      return; // leave the SSR target in place
    }
    // Reset to 0 so the count-up has somewhere to travel from. SSR already
    // rendered the real target — this reset is post-hydration only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(0);
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || ran.current) return;
        ran.current = true;
        observer.disconnect();
        const start = performance.now();
        const DURATION = 1100;
        function tick(now: number) {
          const t = Math.min(1, (now - start) / DURATION);
          const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
          setValue(Math.round(eased * safeTarget));
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [safeTarget]);

  return (
    <div
      ref={ref}
      style={{
        padding: '18px 16px',
        borderLeft: border ? '1px solid var(--border)' : 'none',
        display: 'grid',
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value.toLocaleString()}
        {suffix}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        }}
      >
        {label}
      </div>
    </div>
  );
}
