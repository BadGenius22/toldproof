// Per-profile Open Graph image for /[handle]. Renders the handle + skill
// score + hit rate + last call so a link unfurl in X / Telegram / Discord
// reads as a real receipt instead of a generic site preview.
//
// Runs on the Node.js runtime so the existing Sui/Postgres reads work
// without needing edge-specific shims. Cached at the CDN by Next.js.

import { ImageResponse } from 'next/og';
import { getPredictionsForHandle, getSuiClientForReads } from '../../lib/registry';
import { getSql } from '../../lib/db';
import { getVerdictsForIdentity } from '../../lib/verdict-store';
import {
  computeSkillStats,
  tierFromScore,
  type VerdictLookup,
} from '../../lib/leaderboard';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'TOLDPROOF profile';

interface XBindingRow {
  avatar_url: string | null;
  display_name: string | null;
}

async function loadAvatar(handle: string): Promise<XBindingRow | null> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT avatar_url, display_name
      FROM x_account_links
      WHERE LOWER(x_handle) = LOWER(${handle})
      LIMIT 1
    `) as XBindingRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function ProfileOG({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: raw } = await params;
  const handle = raw.toLowerCase().replace(/^@/, '');

  const client = getSuiClientForReads();
  let predictions = await getPredictionsForHandle(client, handle).catch(() => []);
  const xBinding = await loadAvatar(handle);

  const resolved = predictions.filter((p) => p.resolved);
  const hits = resolved.filter((p) => p.hit).length;
  const hitRate = resolved.length > 0 ? Math.round((hits / resolved.length) * 100) : null;

  let skillScore: number | null = null;
  try {
    const verdictRows = await getVerdictsForIdentity(handle);
    const map = new Map<string, VerdictLookup>();
    for (const r of verdictRows) map.set(r.prediction_id, { difficulty: r.difficulty });
    if (resolved.length > 0) {
      const s = computeSkillStats(resolved, map);
      skillScore = Math.round(s.score);
    }
  } catch {
    skillScore = null;
  }

  const tier = skillScore !== null ? tierFromScore(skillScore, resolved.length >= 3) : null;
  const lastResolved = [...resolved].sort((a, b) => b.resolvedAtMs - a.resolvedAtMs)[0];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#f6f4ef',
          color: '#14130f',
          padding: '64px 80px',
          fontFamily: '"Inter", sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {xBinding?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={xBinding.avatar_url}
              alt={`@${handle}`}
              width={140}
              height={140}
              style={{ borderRadius: 12, border: '2px solid #d6d2c4' }}
            />
          ) : (
            <div
              style={{
                width: 140,
                height: 140,
                background: '#14130f',
                color: '#f6f4ef',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                fontSize: 64,
                fontWeight: 700,
              }}
            >
              {handle.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 28, color: '#807c70', letterSpacing: 2 }}>
              TOLDPROOF
            </div>
            <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1 }}>
              @{handle}
            </div>
            {xBinding?.display_name && (
              <div style={{ fontSize: 24, color: '#44413a', marginTop: 8 }}>
                {xBinding.display_name}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 32, marginTop: 60 }}>
          <Stat label="Skill Score" value={skillScore !== null ? String(skillScore) : '—'} sub={tier?.label ?? 'Unranked'} hero />
          <Stat label="Hit rate" value={hitRate !== null ? `${hitRate}%` : '—'} sub={`${hits} of ${resolved.length}`} />
          <Stat label="Locked" value={String(predictions.length)} sub={`${resolved.length} settled`} />
        </div>

        {lastResolved && (
          <div
            style={{
              marginTop: 48,
              padding: '20px 28px',
              background: lastResolved.hit ? '#eaffea' : '#fff0eb',
              border: `2px solid ${lastResolved.hit ? '#1aa260' : '#c25400'}`,
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxWidth: 980,
            }}
          >
            <div style={{ fontSize: 18, color: '#807c70', letterSpacing: 1 }}>
              LAST CALL · {lastResolved.hit ? 'HIT' : 'MISS'}
            </div>
            <div style={{ fontSize: 26, color: '#14130f', lineHeight: 1.3 }}>
              {truncate(lastResolved.revealedPlaintext || 'Hidden until open date', 140)}
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            color: '#807c70',
            fontSize: 22,
          }}
        >
          <span>toldproof.xyz/{handle}</span>
          <span>predictions nobody can fake</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Stat({
  label,
  value,
  sub,
  hero,
}: {
  label: string;
  value: string;
  sub: string;
  hero?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 24px',
        background: '#ecebe4',
        borderRadius: 12,
        minWidth: 220,
        gap: 6,
      }}
    >
      <span style={{ fontSize: 20, color: '#807c70', letterSpacing: 1 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: hero ? 88 : 56,
          fontWeight: 700,
          lineHeight: 1,
          color: '#14130f',
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 22, color: '#44413a' }}>{sub}</span>
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
