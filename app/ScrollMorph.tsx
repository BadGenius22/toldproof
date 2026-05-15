'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

// HM-09: scroll-triggered morph between two stacked cards on the landing
// page. The cards cross-fade as the user scrolls through the section,
// telling the "screenshot → receipt" story without a separate explainer.
// Falls back to vertical stack (both visible) when JS is disabled or on
// narrow viewports where the morph would crowd the layout.

export function ScrollMorph({
  before,
  after,
}: {
  before: ReactNode;
  after: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 720);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (isNarrow) return; // no morph on mobile
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the element is below the fold; 1 when fully scrolled past.
      // Linear interpolation: progress reaches 1 when the element top is
      // roughly 1/3 from the top of the viewport.
      const start = vh * 0.85;
      const end = vh * 0.25;
      const raw = (start - rect.top) / (start - end);
      setProgress(Math.max(0, Math.min(1, raw)));
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [isNarrow]);

  if (isNarrow) {
    return (
      <div className="grid-2" style={{ alignItems: 'stretch', gap: 16 }}>
        <div>{before}</div>
        <div>{after}</div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        minHeight: 360,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          opacity: 1 - progress,
          transform: `scale(${1 - progress * 0.05})`,
          transition: 'opacity 0.15s, transform 0.15s',
          pointerEvents: progress > 0.5 ? 'none' : 'auto',
        }}
      >
        <div style={{ width: 'min(560px, 90%)' }}>{before}</div>
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          opacity: progress,
          transform: `scale(${0.95 + progress * 0.05})`,
          transition: 'opacity 0.15s, transform 0.15s',
          pointerEvents: progress > 0.5 ? 'auto' : 'none',
        }}
      >
        <div style={{ width: 'min(560px, 90%)' }}>{after}</div>
      </div>
    </div>
  );
}
