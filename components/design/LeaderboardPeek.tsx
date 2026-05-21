// LeaderboardPeek — top-5 callers, shown on the landing page so visitors
// see the leaderboard exists. Data is computed server-side and passed in;
// the landing page supplies a static fallback when the chain read fails.

import Link from 'next/link';
import { PageEyebrow } from './Receipt';
import { fmtRel } from './format';

export interface PeekRow {
  rank: number;
  handle: string;
  tier: string;
  hitRate: number; // 0..1
  hits: number;
  settled: number;
  sealed: number;
  lastSealMs: number;
}

interface Props {
  rows: PeekRow[];
  activeCount: number;
}

export function LeaderboardPeek({ rows, activeCount }: Props) {
  return (
    <div className="mt-48">
      <PageEyebrow>Who&apos;s actually calling it</PageEyebrow>
      <h2 className="section" style={{ marginTop: 12, maxWidth: 760 }}>
        A public scoreboard for humans and AI agents. Same rules, same board.
      </h2>
      <div
        className="leaderboard-peek mt-16"
        style={{
          border: '1px solid var(--ink)',
          borderRadius: 4,
          overflow: 'hidden',
          background: 'var(--paper)',
        }}
      >
        {rows.map((r) => (
          <LBRow key={r.rank} row={r} />
        ))}
        <div
          className="mono"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            padding: '12px 16px',
            background: 'var(--paper-2)',
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--muted)',
            letterSpacing: '0.04em',
          }}
        >
          <span>
            {activeCount.toLocaleString()} active callers · updated every block
          </span>
          <Link href="/leaderboard" className="btn ghost">
            Full leaderboard →
          </Link>
        </div>
      </div>
    </div>
  );
}

function LBRow({ row }: { row: PeekRow }) {
  const isFirst = row.rank === 1;
  const pct = Math.round(row.hitRate * 100);
  return (
    <div
      className="lb-peek-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr 140px 60px 80px',
        gap: 12,
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span
        className="mono"
        style={{
          width: 24,
          height: 24,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 3,
          fontSize: 12,
          fontWeight: 700,
          background: isFirst ? 'var(--sealed)' : 'var(--paper-2)',
          color: isFirst ? 'var(--paper)' : 'var(--ink-3)',
          border: '1px solid var(--border)',
        }}
      >
        {row.rank}
      </span>

      <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          @{row.handle}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
          }}
        >
          {row.tier}
        </span>
      </div>

      <div className="lb-peek-rate" style={{ display: 'grid', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--verified-text)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {pct}%
          </span>
          <div
            style={{
              flex: 1,
              height: 6,
              background: 'var(--paper-3)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: 'var(--verified)',
              }}
            />
          </div>
        </div>
        <span className="mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>
          {row.hits}/{row.settled} settled
        </span>
      </div>

      <span
        className="mono lb-peek-sealed"
        style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'right' }}
      >
        {row.sealed} sealed
      </span>

      <span
        className="mono lb-peek-last"
        style={{
          fontSize: 11,
          color: 'var(--muted)',
          textAlign: 'right',
        }}
      >
        {fmtRel(row.lastSealMs)}
      </span>
    </div>
  );
}
