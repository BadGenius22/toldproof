// POST /api/seal/preflight
//
// Cheap pre-flight check before the PredictionForm does its crypto pipeline.
// Two jobs:
//   1. OAuth gate — caller has a session AND it matches the requested handle.
//   2. Quota gate — caller hasn't exceeded 10 free seals this calendar month.
//
// Returns on success (200):
//   { ok: true, xHandle, freeUsed, freeLimit, freeRemaining,
//     mode: 'free' | 'overage', overagePriceUsd: 0.10 }
//
// Errors:
//   400 { error: 'bad_input' }
//   401 { error: 'no_session' }
//   403 { error: 'handle_mismatch' | 'wallet_mismatch', ... }
//
// Note: the contract is permissionless — a determined user calling seal_prediction
// directly via PTB bypasses this gate. The on-chain failsafe is the first-claim-wins
// identity lock + agent wallet lock. Cryptographic attestation is v1.1 roadmap.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE_NAME,
  verifySession,
} from '../../../../lib/session';
import { getSql } from '../../../../lib/db';

export const runtime = 'nodejs';

const FREE_LIMIT_PER_MONTH = 10;
const OVERAGE_PRICE_USD = 0.10;

interface PreflightBody {
  walletAddress: string;
  identity: string; // X handle to seal under
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function POST(req: Request) {
  let body: PreflightBody;
  try {
    body = (await req.json()) as PreflightBody;
  } catch {
    return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  }

  const wallet = body.walletAddress?.trim().toLowerCase();
  const identity = body.identity?.trim().toLowerCase().replace(/^@/, '');
  if (!wallet || !wallet.startsWith('0x') || wallet.length !== 66) {
    return NextResponse.json({ error: 'bad_input', detail: 'walletAddress' }, { status: 400 });
  }
  if (!identity) {
    return NextResponse.json({ error: 'bad_input', detail: 'identity' }, { status: 400 });
  }

  // 1. OAuth gate.
  const jar = await cookies();
  const session = verifySession(jar.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }
  if (session.walletAddress.toLowerCase() !== wallet) {
    return NextResponse.json(
      { error: 'wallet_mismatch', sessionWallet: session.walletAddress },
      { status: 403 },
    );
  }
  if (session.xHandle.toLowerCase() !== identity) {
    return NextResponse.json(
      { error: 'handle_mismatch', boundHandle: session.xHandle },
      { status: 403 },
    );
  }

  // 2. Quota gate. Look up the row for (handle, current month) — 0 used if absent.
  const sql = getSql();
  const ym = currentYearMonth();
  const rows = (await sql`
    SELECT free_used FROM seal_quota
    WHERE LOWER(x_handle) = LOWER(${identity}) AND year_month = ${ym}
    LIMIT 1
  `) as Array<{ free_used: number }>;
  const freeUsed = rows[0]?.free_used ?? 0;
  const freeRemaining = Math.max(0, FREE_LIMIT_PER_MONTH - freeUsed);
  const mode: 'free' | 'overage' = freeRemaining > 0 ? 'free' : 'overage';

  return NextResponse.json({
    ok: true,
    xHandle: session.xHandle,
    freeUsed,
    freeLimit: FREE_LIMIT_PER_MONTH,
    freeRemaining,
    mode,
    overagePriceUsd: OVERAGE_PRICE_USD,
  });
}
