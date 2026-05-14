// Shared Bearer-token auth for the 5 Vercel crons. Replaces 5 duplicate
// checkAuth() functions, each of which compared the token with `===` and
// emitted no log on failure.
//
// Two fixes vs the duplicates:
// 1. Constant-time compare via SHA-256 hashes (no length leak, no early-exit
//    timing oracle).
// 2. Structured warn log on every failure so probing is observable in Vercel logs.

import { createHash, timingSafeEqual } from 'node:crypto';

function constantTimeEq(a: string, b: string): boolean {
  // Hash both inputs to fixed-length buffers so the compare itself reveals no
  // length information and timingSafeEqual's equal-length precondition holds.
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkCronAuth(req: Request, path: string): boolean {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(`[cron-auth] ${path}: CRON_SECRET not configured in production — refusing`);
      return false;
    }
    // Dev convenience: no secret = no gate, so `curl http://localhost:3000/api/cron/X` works.
    return true;
  }

  const header = req.headers.get('authorization');
  if (!header) {
    console.warn(`[cron-auth] ${path}: missing authorization header`);
    return false;
  }

  if (!constantTimeEq(header, `Bearer ${expected}`)) {
    console.warn(`[cron-auth] ${path}: authorization header mismatch`);
    return false;
  }

  return true;
}
