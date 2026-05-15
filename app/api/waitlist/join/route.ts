// POST /api/waitlist/join — inline waitlist capture for the Pro tier +
// Reputation API add-on. Spec: docs/design/WAITLIST_FORM.md.
//
// Honeypot: real users never fill the hidden `honeypot` field. Bots will.
// We return 200 either way so the bot doesn't probe for the real signal.
//
// Privacy: API returns 200 whether this is a fresh row or a dupe. The
// UNIQUE index on (LOWER(email), tier) swallows dupes server-side.

import { NextResponse, type NextRequest } from 'next/server';
import { getSql } from '../../../../lib/db';
import { getSessionFromCookie } from '../../../../lib/session';

export const runtime = 'nodejs';

const VALID_TIERS = ['pro', 'reputation-api'] as const;
type Tier = (typeof VALID_TIERS)[number];

function isValidEmail(s: string): boolean {
  // Light validation — catch typos, not edge cases.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const { tier, email, honeypot } = body as {
    tier?: string;
    email?: string;
    honeypot?: string;
  };

  if (honeypot && honeypot.length > 0) {
    return NextResponse.json({ ok: true });
  }

  if (!tier || !VALID_TIERS.includes(tier as Tier)) {
    return NextResponse.json({ error: 'invalid_tier' }, { status: 400 });
  }
  if (!email || typeof email !== 'string' || !isValidEmail(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  // Pull optional context from existing session — never block on it.
  const session = getSessionFromCookie(req);
  const xHandle = session?.xHandle ?? null;
  const userAgent = (req.headers.get('user-agent') ?? '').slice(0, 512);
  const emailLower = email.toLowerCase().trim();
  const source = `pricing/${tier}`;

  const sql = getSql();
  try {
    await sql`
      INSERT INTO waitlist_signups (email, tier, source, x_handle, user_agent)
      VALUES (${emailLower}, ${tier}, ${source}, ${xHandle}, ${userAgent})
      ON CONFLICT ((LOWER(email)), tier) DO NOTHING
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[waitlist/join]', err);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }
}
