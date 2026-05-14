// Reputation NFT teaser — stretch goal, post-hackathon. Mock data only.

import {
  PageEyebrow,
  PixelMark,
  REP_BADGE,
  fmtAbs,
  DAY,
} from '../../components/design';

const STATS = {
  sealed: 12,
  revealed: 9,
  hits: 7,
  misses: 2,
  longestLockDays: 184,
  firstSealedAt: Date.now() - 184 * DAY,
  rank: 'Verified Caller',
};

export default function ReputationPage() {
  const hitRate = Math.round((STATS.hits / STATS.revealed) * 100);

  return (
    <div className="page">
      <div className="container">
        <PageEyebrow>Reputation NFT · post-hackathon stretch</PageEyebrow>
        <h1
          className="display"
          style={{ fontSize: 'clamp(34px, 5vw, 56px)', marginTop: 12 }}
        >
          Mint your hit rate.
        </h1>
        <p
          style={{
            marginTop: 18,
            fontSize: 16,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
            maxWidth: 680,
          }}
        >
          When you&apos;ve sealed enough predictions across a long enough window, you can mint a
          non-transferable NFT on Sui that anchors your hit rate, total seals, and longest
          time-lock. It updates automatically as new predictions resolve. Other people see it on
          your profile.
        </p>

        <div
          className="mt-32"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 380px) 1fr',
            gap: 36,
            alignItems: 'flex-start',
          }}
        >
          <NFTBadge stats={STATS} hitRate={hitRate} />

          <div className="col" style={{ gap: 20 }}>
            <div
              className="col"
              style={{
                gap: 0,
                border: '1px solid var(--ink)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <StatRow k="Rank" v={STATS.rank} highlight />
              <StatRow
                k="Hit rate"
                v={`${hitRate}%`}
                sub={`${STATS.hits} of ${STATS.revealed} resolved`}
              />
              <StatRow k="Sealed total" v={String(STATS.sealed)} />
              <StatRow k="Revealed" v={String(STATS.revealed)} />
              <StatRow k="Longest lock" v={`${STATS.longestLockDays} days`} />
              <StatRow k="First sealed" v={fmtAbs(STATS.firstSealedAt).slice(0, 10)} />
            </div>

            <div
              className="col"
              style={{
                gap: 10,
                padding: 16,
                border: '1px dashed var(--border)',
                borderRadius: 4,
              }}
            >
              <span className="eyebrow">How it works</span>
              <ul
                className="mono"
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 12,
                  color: 'var(--ink-3)',
                  lineHeight: 1.7,
                }}
              >
                <li>Mints when sealed ≥ 5 AND time window ≥ 30 days.</li>
                <li>Non-transferable — soulbound to the seal address.</li>
                <li>Tier auto-upgrades as more predictions resolve.</li>
                <li>Reads on-chain Registry counters; no off-chain trust.</li>
              </ul>
            </div>

            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn" disabled style={{ opacity: 0.6 }}>
                Mint reputation NFT
              </button>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  color: 'var(--muted)',
                  alignSelf: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                Locked · stretch goal · ETA Q3 2026
              </span>
            </div>
          </div>
        </div>

        <div className="mt-48">
          <PageEyebrow>Tier ladder</PageEyebrow>
          <div
            className="mt-16 grid-4"
            style={{
              gap: 0,
              border: '1px solid var(--ink)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <Tier name="Receipts" req="≥ 5 sealed, 30d window" state="unlocked" />
            <Tier
              name="Verified caller"
              req="≥ 50% hit, 10 resolved"
              state="current"
              border
            />
            <Tier name="Oracle" req="≥ 75% hit, 25 resolved" state="locked" />
            <Tier name="Prophet" req="≥ 90% hit, 50 resolved" state="locked" border />
          </div>
        </div>
      </div>
    </div>
  );
}

function NFTBadge({ stats, hitRate }: { stats: typeof STATS; hitRate: number }) {
  return (
    <div
      style={{
        position: 'relative',
        padding: 22,
        border: '3px solid var(--ink)',
        borderRadius: 6,
        background: 'var(--paper)',
        boxShadow: '5px 5px 0 var(--sealed)',
        display: 'grid',
        gap: 16,
        placeItems: 'center',
      }}
    >
      <span className="eyebrow" style={{ alignSelf: 'flex-start' }}>
        Reputation · SBT
      </span>
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          padding: 18,
          background: 'var(--paper-2)',
          border: '1px dashed var(--ink)',
          borderRadius: 4,
        }}
      >
        <PixelMark bitmap={REP_BADGE} size={140} color="var(--sealed)" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div
          className="mono"
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Tier · {stats.rank}
        </div>
        <div
          className="mono"
          style={{
            fontSize: 46,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            marginTop: 4,
          }}
        >
          {hitRate}%
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
          {stats.hits}/{stats.revealed} resolved · {stats.sealed} sealed
        </div>
      </div>
      <div
        style={{
          width: '100%',
          borderTop: '1px dashed var(--ink)',
          paddingTop: 10,
          textAlign: 'center',
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 9,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--ink)',
        }}
      >
        Sui · Walrus · Seal · v0.1
      </div>
    </div>
  );
}

function StatRow({
  k,
  v,
  sub,
  highlight,
}: {
  k: string;
  v: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        padding: '14px 18px',
        borderTop: '1px solid var(--border)',
        background: highlight ? 'var(--paper-2)' : 'var(--paper)',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {k}
      </span>
      <div className="col" style={{ gap: 2 }}>
        <span
          className="mono"
          style={{
            fontSize: highlight ? 18 : 15,
            fontWeight: highlight ? 600 : 400,
            color: 'var(--ink)',
          }}
        >
          {v}
        </span>
        {sub && (
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function Tier({
  name,
  req,
  state,
  border,
}: {
  name: string;
  req: string;
  state: 'unlocked' | 'current' | 'locked';
  border?: boolean;
}) {
  const isCurrent = state === 'current';
  return (
    <div
      style={{
        padding: '18px 18px',
        borderLeft: border ? '1px solid var(--ink)' : 'none',
        borderRight: border ? '1px solid var(--ink)' : 'none',
        background: isCurrent ? 'var(--ink)' : 'var(--paper)',
        color: isCurrent ? 'var(--paper)' : 'var(--ink)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: isCurrent ? 0.7 : 0.6,
          }}
        >
          {state === 'unlocked' ? '✓ Unlocked' : state === 'current' ? '▸ Current' : '○ Locked'}
        </span>
      </div>
      <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{name}</span>
      <span className="mono" style={{ fontSize: 11, opacity: 0.7 }}>
        {req}
      </span>
    </div>
  );
}
