// Public profile — `/[handle]` lists every prediction sealed under that X handle.
// Reads directly from the on-chain Registry's `by_handle: Table<String, vector<ID>>`.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getPredictionsForHandle,
  getSuiClientForReads,
  type PredictionView,
} from '../../lib/registry';
import { getSql } from '../../lib/db';
import { getVerdictsForIdentity } from '../../lib/verdict-store';
import {
  bestCall,
  computeSkillStats,
  tierFromScore,
  type VerdictLookup,
} from '../../lib/leaderboard';
import {
  DifficultyHistogram,
  deriveProfileTag,
} from '../../components/DifficultyHistogram';
import { PredictionCard } from '../../components/PredictionCard';
import {
  EntityBadge,
  PageEyebrow,
  PixelMark,
  ProfileAvatar,
  Stat,
  StatStrip,
  BIG_SEAL,
  identityDisplay,
  shortHash,
} from '../../components/design';
import { ProfileFilters } from './filters';

// Look up the OAuth binding for this handle (humans only; agents are never
// in this table). Returns the bound wallet + created_at if present, null
// otherwise. Failures are non-fatal — if Neon is cold we just render the
// profile without the verified badge.
async function getXBinding(handle: string): Promise<{
  walletAddress: string;
  verifiedAt: string;
  avatarUrl: string | null;
  displayName: string | null;
} | null> {
  try {
    const sql = getSql();
    // Migration 004 added avatar_url + display_name. Both columns are nullable
    // so unmigrated rows still return null for those fields without erroring.
    const rows = (await sql`
      SELECT wallet_address, created_at, avatar_url, display_name
      FROM x_account_links
      WHERE LOWER(x_handle) = LOWER(${handle})
      LIMIT 1
    `) as Array<{
      wallet_address: string;
      created_at: string;
      avatar_url: string | null;
      display_name: string | null;
    }>;
    if (rows.length === 0) return null;
    return {
      walletAddress: rows[0].wallet_address,
      verifiedAt: rows[0].created_at,
      avatarUrl: rows[0].avatar_url,
      displayName: rows[0].display_name,
    };
  } catch {
    // If the migration hasn't been applied yet, the query above will throw
    // for the missing columns — fall back to a no-binding response so the
    // page still renders without avatar/displayName.
    return null;
  }
}

// Anything that isn't a plausible X handle = 404.
// X handles: alphanumeric + underscore, 1-15 chars.
function isPlausibleHandle(s: string): boolean {
  if (s.startsWith('0x')) return false;
  return /^[A-Za-z0-9_]{1,15}$/.test(s);
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: raw } = await params;
  const handle = raw.toLowerCase().replace(/^@/, '');
  if (!isPlausibleHandle(handle)) notFound();

  const client = getSuiClientForReads();
  const [predictions, xBinding] = await Promise.all([
    getPredictionsForHandle(client, handle) as Promise<PredictionView[]>,
    getXBinding(handle),
  ]);

  const now = Date.now();
  const revealed = predictions.filter((p) => p.revealed);
  const sealed = predictions.filter((p) => !p.revealed && now < p.unlockAtMs);
  const awaiting = predictions.filter((p) => !p.revealed && now >= p.unlockAtMs);

  // Real hit-rate: only AI-resolved predictions count toward the rate. Revealed
  // predictions the Resolution Agent hasn't gotten to yet stay "pending" and
  // don't move the percentage in either direction. This is the trust-minimized
  // version of the old "hits = revealed" placeholder.
  const resolvedPreds = predictions.filter((p) => p.resolved);
  const hits = resolvedPreds.filter((p) => p.hit).length;
  const totalResolved = resolvedPreds.length;
  const hitRate = totalResolved > 0 ? Math.round((hits / totalResolved) * 100) : null;

  // Difficulty-aware skill stats. Pull verdict rows from Postgres (populated
  // by the resolver) and compute the same Wilson-bound Skill Score that
  // drives the leaderboard. Best-effort: if Postgres is cold or empty, mix
  // shows "unknown" entries and skill score = 0 — surfaces the missing data
  // honestly rather than guessing.
  let skill: ReturnType<typeof computeSkillStats> | null = null;
  let bestCallId: string | null = null;
  try {
    const verdictRows = await getVerdictsForIdentity(handle);
    const verdictMap = new Map<string, VerdictLookup>();
    for (const r of verdictRows) {
      verdictMap.set(r.prediction_id, { difficulty: r.difficulty });
    }
    skill = computeSkillStats(resolvedPreds, verdictMap);
    // Pin the best call (highest-difficulty hit) to the top of the profile
    // list. Only meaningful after 3+ settled calls so the pin doesn't lie.
    if (resolvedPreds.length >= 3) {
      const best = bestCall(resolvedPreds, verdictMap);
      bestCallId = best?.id ?? null;
    }
  } catch (e) {
    console.warn(`[profile] verdict load failed for ${handle}:`, e);
  }

  // Tag derivation — only meaningful with enough bold calls.
  const boldHits = skill ? Math.max(0, Math.round(skill.weightedHits)) : 0;
  const boldAttempts = skill ? Math.max(1, Math.round(skill.weightedAttempts)) : 1;
  const profileTag = skill
    ? deriveProfileTag(skill.mix, boldHits / boldAttempts)
    : null;

  // Pick the publisher address of the most recent prediction (if any) for the header.
  const publisher = predictions[0]?.publisher;
  // Anchor entity type to the first prediction (first-claim-wins on Move side).
  const entityType = predictions[0]?.entityType ?? 0;

  return (
    <div className="page">
      <div className="container">
        <PageEyebrow>Public profile · toldproof.xyz/{handle}</PageEyebrow>

        <div className="mt-12 profile-header">
          <div className="col" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <ProfileAvatar
                handle={handle}
                avatarUrl={xBinding?.avatarUrl ?? null}
                entityType={entityType as 0 | 1}
                publisher={publisher}
                size={96}
                verified={!!xBinding && entityType === 0}
              />
              <div className="col" style={{ gap: 6 }}>
                <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <h1
                    className="display"
                    style={{ fontSize: 'clamp(34px, 5vw, 56px)', margin: 0 }}
                  >
                    {identityDisplay(handle, entityType)}
                  </h1>
                  {predictions.length > 0 && (
                    <EntityBadge entityType={entityType} />
                  )}
                  {xBinding && entityType === 0 && (
                    <span
                      className="mono"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 12px',
                        border: '1px solid var(--verified, #1aa260)',
                        borderRadius: 999,
                        background: 'var(--verified-soft, #e8f7ee)',
                        fontSize: 11,
                        color: 'var(--verified, #1aa260)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                      title={`X account linked on ${new Date(xBinding.verifiedAt).toLocaleDateString()}`}
                    >
                      ✓ X verified
                    </span>
                  )}
                </div>
                {publisher && (
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: 'var(--muted)' }}
                  >
                    Sui · {shortHash(publisher, 8, 4)}
                    {xBinding && (
                      <>
                        {' · '}
                        Linked to X{' '}
                        {new Date(xBinding.verifiedAt).toLocaleDateString(
                          undefined,
                          { year: 'numeric', month: 'short', day: 'numeric' },
                        )}
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="row row-actions" style={{ gap: 10, flexWrap: 'wrap' }}>
            <Link href="/lock" className="btn">
              Lock a prediction →
            </Link>
          </div>
        </div>

        {predictions.length > 0 ? (
          <>
            {/* Stats strip */}
            <div className="mt-32">
              <StatStrip>
                <Stat label="Predictions locked" value={predictions.length} />
                <Stat label="Already opened" value={revealed.length} hue="verified" />
                <Stat label="Still locked" value={sealed.length} hue="sealed" />
                <Stat
                  label="Got it right"
                  value={hitRate != null ? `${hitRate}%` : '—'}
                  sub={
                    totalResolved > 0
                      ? `${hits}/${totalResolved} settled by AI agent`
                      : 'awaiting AI agent resolution'
                  }
                  hue="verified"
                />
              </StatStrip>
            </div>

            {/* Skill Score + difficulty mix — the anti-spam disclosure layer */}
            {skill && totalResolved > 0 && (
              <div
                className="mt-24"
                style={{
                  border: '1px solid var(--ink)',
                  borderRadius: 4,
                  padding: '20px 22px',
                  background: 'var(--paper)',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(180px, auto) 1fr',
                  gap: 24,
                  alignItems: 'center',
                }}
              >
                <div className="col" style={{ gap: 4 }}>
                  <span className="eyebrow">Skill Score · 0–100</span>
                  <div
                    className="row"
                    style={{ alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono), monospace',
                        fontSize: 44,
                        fontWeight: 600,
                        color:
                          skill.score >= 70
                            ? 'var(--verified)'
                            : skill.score >= 40
                              ? 'var(--ink)'
                              : 'var(--warn)',
                        lineHeight: 1,
                      }}
                    >
                      {skill.score}
                    </span>
                    {profileTag && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background:
                            profileTag.kind === 'bold'
                              ? 'var(--verified-soft, #eaffea)'
                              : 'var(--warn-soft, #fff7e6)',
                          color:
                            profileTag.kind === 'bold'
                              ? 'oklch(0.3 0.12 150)'
                              : 'var(--ink)',
                          border: `1px solid ${
                            profileTag.kind === 'bold'
                              ? 'var(--verified)'
                              : 'var(--warn)'
                          }`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {profileTag.label}
                      </span>
                    )}
                  </div>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: 'var(--muted)' }}
                  >
                    {tierFromScore(skill.score, totalResolved >= 3)?.label ?? 'Unranked'}
                    {' · '}
                    {skill.boldCalls} bold call{skill.boldCalls === 1 ? '' : 's'} · weighted by how hard each call was
                  </span>
                </div>
                <div className="col" style={{ gap: 10 }}>
                  <span className="eyebrow">Mix of calls so far</span>
                  <DifficultyHistogram mix={skill.mix} />
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}
                  >
                    Trivial calls (already true at lock time) don&apos;t move the
                    Skill Score. Bold calls (real or surprising) count most.
                  </span>
                </div>
              </div>
            )}

            <ProfileFilters
              counts={{
                all: predictions.length,
                sealed: sealed.length,
                awaiting: awaiting.length,
                revealed: revealed.length,
              }}
              predictions={predictions}
              bestCallId={bestCallId}
            />
          </>
        ) : (
          <EmptyProfileState handle={handle} />
        )}
      </div>
    </div>
  );
}

function EmptyProfileState({ handle }: { handle: string }) {
  return (
    <div
      className="mt-32"
      style={{
        border: '1px dashed var(--ink)',
        borderRadius: 4,
        padding: '40px 32px',
        background: 'var(--paper-2)',
        display: 'grid',
        gap: 20,
        placeItems: 'center',
        textAlign: 'center',
      }}
    >
      <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
        <PixelMark bitmap={BIG_SEAL} size={96} color="var(--ink-3)" />
        <div
          style={{
            position: 'absolute',
            top: -8,
            right: -16,
            transform: 'rotate(8deg)',
            padding: '3px 8px',
            background: 'var(--warn-soft)',
            border: '1px solid var(--warn)',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'oklch(0.4 0.14 30)',
            borderRadius: 2,
          }}
        >
          Unsealed
        </div>
      </div>

      <div className="col" style={{ gap: 8, maxWidth: 460 }}>
        <h2 className="section" style={{ fontSize: 26 }}>
          @{handle}
          {' '}
          hasn&apos;t locked anything yet.
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 14.5,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
            textWrap: 'pretty',
          }}
        >
          Anyone can claim this handle by being the first to lock a prediction
          under it. Until someone does, any &quot;I called it&quot; tweet from
          @{handle} has no proof — and the bot will say so.
        </p>
      </div>

      <div className="row" style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/lock" className="btn">
          ▮ Be the first @{handle} →
        </Link>
        <Link href="/bot" className="btn ghost">
          See what the bot says
        </Link>
      </div>

      <div
        className="row"
        style={{
          gap: 14,
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 10.5,
          color: 'var(--muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <span>0 locked</span>
        <span>·</span>
        <span>0 opened</span>
        <span>·</span>
        <span>no record yet</span>
      </div>
    </div>
  );
}
