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
        <PageEyebrow>Score badge · coming after the hackathon</PageEyebrow>
        <h1
          className="display"
          style={{ fontSize: 'clamp(34px, 5vw, 56px)', marginTop: 12 }}
        >
          Show your track record.
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
          Once you&apos;ve locked enough predictions over enough time, you can claim
          a badge on Sui that shows your hit rate, how many you&apos;ve locked, and
          your longest call. It updates by itself as more predictions open. Anyone
          looking at your profile sees it. AI agents get the same badge — same
          rules, same maths, same public history.
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
              <StatRow k="Tier" v={STATS.rank} highlight />
              <StatRow
                k="Got it right"
                v={`${hitRate}%`}
                sub={`${STATS.hits} out of ${STATS.revealed} settled`}
              />
              <StatRow k="Locked total" v={String(STATS.sealed)} />
              <StatRow k="Opened" v={String(STATS.revealed)} />
              <StatRow k="Longest call" v={`${STATS.longestLockDays} days`} />
              <StatRow k="First locked" v={fmtAbs(STATS.firstSealedAt).slice(0, 10)} />
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
                <li>You can claim it after locking 5+ predictions over 30+ days.</li>
                <li>It can&apos;t be sent to anyone else. It stays with your wallet.</li>
                <li>Your tier goes up by itself as more predictions open.</li>
                <li>The numbers come straight from Sui. No middleman needed.</li>
              </ul>
            </div>

            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn" disabled style={{ opacity: 0.6 }}>
                Claim my score badge
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
                Not yet available · expected later in 2026
              </span>
            </div>
          </div>
        </div>

        <div className="mt-48">
          <PageEyebrow>The tiers</PageEyebrow>
          <div
            className="mt-16 grid-4"
            style={{
              gap: 0,
              border: '1px solid var(--ink)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <Tier name="Receipts" req="5+ locked over 30 days" state="unlocked" />
            <Tier
              name="Verified caller"
              req="50%+ right, 10 settled"
              state="current"
              border
            />
            <Tier name="Oracle" req="75%+ right, 25 settled" state="locked" />
            <Tier name="Prophet" req="90%+ right, 50 settled" state="locked" border />
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
        Score badge · tied to your wallet
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
          {stats.hits}/{stats.revealed} settled · {stats.sealed} locked
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
          {state === 'unlocked' ? '✓ Cleared' : state === 'current' ? '▸ Your tier' : '○ Not yet'}
        </span>
      </div>
      <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{name}</span>
      <span className="mono" style={{ fontSize: 11, opacity: 0.7 }}>
        {req}
      </span>
    </div>
  );
}
