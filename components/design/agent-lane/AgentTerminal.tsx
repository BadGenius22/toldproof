'use client';

// AgentTerminal — header bar + animated log body. Reveals the lane's log
// lines one at a time when scrolled into view, holds at the end, then loops.
// SSR renders the full log (crawler + no-JS see it); post-hydration the effect
// resets to 0 and types it back in. prefers-reduced-motion shows all at once
// with no cursor and no loop. Switching lanes resets and replays.

import { useEffect, useRef, useState } from 'react';
import {
  LANE_FOOT,
  LANE_HEAD,
  linesFor,
  type Lane,
  type LogLine,
} from './lanes';

const HOLD_MS = 2400; // pause on the finished log before the loop restarts

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function AgentTerminal({
  lane,
  speed = 1,
}: {
  lane: Lane;
  speed?: number;
}) {
  const lines = linesFor(lane);
  const head = LANE_HEAD[lane];
  const foot = LANE_FOOT[lane];

  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(lines.length);

  // Reveal once the terminal scrolls into view. Mirrors StatsStrip — IO with a
  // 0.35 threshold, with reduced-motion / no-IO falling through to "in view".
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (
      prefersReducedMotion() ||
      typeof window === 'undefined' ||
      !('IntersectionObserver' in window)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Typing + loop. Re-runs on lane change so the new lane replays from step 0.
  useEffect(() => {
    const ln = linesFor(lane);
    if (prefersReducedMotion()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(ln.length);
      return;
    }
    if (!inView) {
      setVisible(0);
      return;
    }
    let cancelled = false;
    let timer = 0;
    const run = (i: number) => {
      if (cancelled) return;
      if (i >= ln.length) {
        // Hold on the full log, then clear and start the next loop.
        timer = window.setTimeout(() => {
          if (cancelled) return;
          setVisible(0);
          timer = window.setTimeout(() => run(0), 90);
        }, HOLD_MS);
        return;
      }
      setVisible(i + 1);
      timer = window.setTimeout(
        () => run(i + 1),
        Math.max(120, ln[i]!.dwellMs / speed),
      );
    };
    setVisible(0);
    timer = window.setTimeout(() => run(0), 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [inView, lane, speed]);

  const total = lines.length;
  const typing = inView && visible > 0 && visible < total;
  const shown = lines.slice(0, visible);

  return (
    <div ref={rootRef} className="af-terminal af-card-chrome">
      <div className={`af-term-head${typing ? ' running' : ''}`}>
        <span className="af-live">
          <span className="af-dot" aria-hidden />
          {head.left}
        </span>
        <span className="af-term-endpoint mono">{head.right}</span>
      </div>
      <div className="af-term-body" aria-label="seal activity log">
        {shown.map((line, i) => (
          <LogRow
            key={`${lane}-${i}`}
            line={line}
            cursor={typing && i === visible - 1}
          />
        ))}
      </div>
      {visible >= total ? <div className="af-term-foot">{foot}</div> : null}
    </div>
  );
}

function LogRow({ line, cursor }: { line: LogLine; cursor: boolean }) {
  return (
    <div className="af-line">
      <span className={`af-glyph af-glyph-${line.colorKey}`} aria-hidden>
        {line.glyph === ' ' ? ' ' : line.glyph}
      </span>
      <span className="af-line-content">
        {line.segments.map((seg, i) => (
          <span key={i} className={`af-seg-${seg.kind}`}>
            {seg.text}
          </span>
        ))}
        {cursor ? (
          <span className="af-cursor" aria-hidden>
            ▋
          </span>
        ) : null}
      </span>
    </div>
  );
}
