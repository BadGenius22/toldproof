// POST /api/waitlist
//
// Stores a (tier, email) signup in Neon. Used by the inline waitlist form
// on /pricing for the Pro tier and Reputation API add-on.
//
// Anti-spam: honeypot field (`website`) — if non-empty, we silently 200 but
// don't write. Bots fill every field; humans don't see this one.

import { getSql } from '../../../lib/db';

export const runtime = 'nodejs';

interface SignupBody {
  email?: unknown;
  tier?: unknown;
  source?: unknown;
  xHandle?: unknown;
  notes?: unknown;
  website?: unknown; // honeypot
}

const TIERS = new Set(['pro', 'reputation-api']);
// Pragmatic email check — RFC compliance is overkill for a waitlist.
// Catches typos like "name@gmail" without a TLD; doesn't try to validate
// disposable-mail providers.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clip(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

export async function POST(req: Request) {
  let body: SignupBody;
  try {
    body = (await req.json()) as SignupBody;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Honeypot — return success but skip the write. Bots stop guessing.
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return Response.json({ ok: true });
  }

  const email = clip(body.email, 254);
  const tier = clip(body.tier, 32);
  if (!email || !EMAIL_RE.test(email)) {
    return Response.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (!tier || !TIERS.has(tier)) {
    return Response.json({ error: 'invalid_tier' }, { status: 400 });
  }
  const source = clip(body.source, 64) ?? 'pricing-page';
  const xHandleRaw = clip(body.xHandle, 32);
  const xHandle = xHandleRaw ? xHandleRaw.replace(/^@/, '').toLowerCase() : null;
  const notes = clip(body.notes, 600);
  const userAgent = clip(req.headers.get('user-agent'), 300);

  try {
    const sql = getSql();
    await sql`
      INSERT INTO waitlist_signups (
        email, tier, source, x_handle, notes, user_agent
      ) VALUES (
        ${email}, ${tier}, ${source}, ${xHandle}, ${notes}, ${userAgent}
      )
      ON CONFLICT (LOWER(email), tier) DO NOTHING
    `;
    return Response.json({ ok: true });
  } catch (e: unknown) {
    console.error('[waitlist] insert failed:', e);
    // Don't leak DB errors to the client.
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}
