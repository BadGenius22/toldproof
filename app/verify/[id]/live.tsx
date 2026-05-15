'use client';

import { useEffect, useState } from 'react';
import { fmtCountdown } from '../../../components/design';

const DAY_MS = 24 * 60 * 60 * 1000;

// Client-only ticking countdown for the verify page. SSR renders the initial
// value once; the interval updates every second on the client.
//
// VF-07: inside the final 24h window, switch to a boxed digit-rolling
// display — each pair of digits lives in its own cell so the second-by-second
// tick reads like an old flip clock instead of plain text.
export function VerifyLiveCountdown({ unlockAtMs }: { unlockAtMs: number }) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const delta = unlockAtMs - now;
  if (delta > DAY_MS || delta <= 0) {
    return <span suppressHydrationWarning>{fmtCountdown(unlockAtMs, now)}</span>;
  }
  const h = Math.floor(delta / (60 * 60 * 1000));
  const m = Math.floor((delta % (60 * 60 * 1000)) / 60_000);
  const s = Math.floor((delta % 60_000) / 1000);
  return (
    <span
      className="digit-rolling"
      suppressHydrationWarning
      aria-label={`${h} hours ${m} minutes ${s} seconds`}
    >
      <DigitCell value={h} />
      <span className="digit-sep">:</span>
      <DigitCell value={m} />
      <span className="digit-sep">:</span>
      <DigitCell value={s} />
    </span>
  );
}

function DigitCell({ value }: { value: number }) {
  const text = String(value).padStart(2, '0');
  return (
    <span className="digit-cell" key={text}>
      {text}
    </span>
  );
}
