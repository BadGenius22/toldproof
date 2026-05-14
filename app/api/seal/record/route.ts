// POST /api/seal/record
//
// Called by the frontend AFTER a successful on-chain seal. Increments the
// monthly counter for the caller's bound handle. Trust model: this is best-
// effort accounting, not a security boundary — the seal is already final on
// Sui at this point. A user could decline to call this endpoint, but the
// on-chain object existence is the source of truth for "did they seal."
// Off-chain counter exists so the FREE/OVERAGE routing decision in
// /api/seal/preflight has something to read.
//
// Quota is enforced ONLY at preflight. By the time we're here, the seal
// already happened. We just need to record it.
//
// Request body: { mode: 'free' | 'overage' }
// Response: { ok: true, freeUsed, paidUsed }

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE_NAME,
  verifySession,
} from '../../../../lib/session';
import { getSql } from '../../../../lib/db';

export const runtime = 'nodejs';

interface RecordBody {
  mode: 'free' | 'overage';
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function POST(req: Request) {
  let body: RecordBody;
  try {
    body = (await req.json()) as RecordBody;
  } catch {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }
  if (body.mode !== 'free' && body.mode !== 'overage') {
    return NextResponse.json({ error: 'bad_input', detail: 'mode' }, { status: 400 });
  }

  const jar = await cookies();
  const session = verifySession(jar.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }

  const sql = getSql();
  const ym = currentYearMonth();
  const handle = session.xHandle;
  const isFree = body.mode === 'free';

  // Atomic upsert with conditional increment. Postgres ON CONFLICT does
  // the read-modify-write in a single statement, so concurrent seal
  // requests from the same handle don't race.
  const rows = (await sql`
    INSERT INTO seal_quota (x_handle, year_month, free_used, paid_used, created_at, updated_at)
    VALUES (
      ${handle}, ${ym},
      ${isFree ? 1 : 0},
      ${isFree ? 0 : 1},
      now(), now()
    )
    ON CONFLICT (x_handle, year_month) DO UPDATE SET
      free_used = seal_quota.free_used + ${isFree ? 1 : 0},
      paid_used = seal_quota.paid_used + ${isFree ? 0 : 1},
      updated_at = now()
    RETURNING free_used, paid_used
  `) as Array<{ free_used: number; paid_used: number }>;

  const row = rows[0];
  return NextResponse.json({
    ok: true,
    freeUsed: row.free_used,
    paidUsed: row.paid_used,
  });
}
