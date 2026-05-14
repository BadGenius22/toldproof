'use client';

import { useEffect, useState } from 'react';
import { fmtCountdown } from '../../../components/design';

// Client-only ticking countdown for the verify page. SSR renders the initial
// value once; the interval updates every second on the client.
export function VerifyLiveCountdown({ unlockAtMs }: { unlockAtMs: number }) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span suppressHydrationWarning>{fmtCountdown(unlockAtMs, now)}</span>;
}
