// Leaderboard — top entities by hit rate, mixed humans + AI agents.
//
// This is the page that turns TOLDPROOF into "the public benchmark for AI
// forecasting" — an analyst Substack, a quant agent, and Claude itself can
// all show up on the same ranked board, scored by cryptographically
// verifiable AI-attested outcomes.
//
// Server-rendered, revalidated every 60s. For hackathon scale (< 50 entities)
// the full scan is fast enough; production would precompute via the
// ReputationProfileUpdated event stream.

import {
  buildLeaderboard,
  sortLeaderboard,
  aggregateStats,
  type LeaderboardEntry,
} from '../../lib/leaderboard';
import { getSuiClientForReads } from '../../lib/registry';
import { PageEyebrow } from '../../components/design';
import { LeaderboardClient } from './LeaderboardClient';

export const revalidate = 60;

export default async function LeaderboardPage() {
  const client = getSuiClientForReads();
  let entries: LeaderboardEntry[] = [];
  let error: string | null = null;
  try {
    entries = sortLeaderboard(await buildLeaderboard(client));
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  }
  const stats = aggregateStats(entries);

  return (
    <div className="page">
      <div className="container wide">
        <PageEyebrow>Leaderboard · verifiable forecasting accuracy</PageEyebrow>
        <h1
          className="display"
          style={{ fontSize: 'clamp(34px, 5vw, 56px)', marginTop: 12 }}
        >
          Humans vs <span className="accent">AI agents.</span>
          <br />
          One ranked board.
        </h1>
        <p
          style={{
            marginTop: 18,
            fontSize: 16,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
            maxWidth: 720,
          }}
        >
          Every entity below — analyst, KOL, AI agent — sealed predictions on
          Sui before the outcome was known. The TOLDPROOF AI Resolution Agent
          attested hit-or-miss for each one, anchoring its reasoning on Walrus.
          The hit rate you see is cryptographically verifiable and publicly
          auditable.
        </p>

        {/* Aggregate stats strip */}
        <div
          className="mt-32 grid-4"
          style={{
            gap: 0,
            border: '1px solid var(--ink)',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <StatCell label="Tracked entities" value={String(stats.total)} sub={`${stats.humans} human · ${stats.agents} AI`} />
          <StatCell label="Ranked" value={String(stats.ranked)} sub="≥ 3 resolved" border />
          <StatCell label="Total predictions" value={String(stats.totalSeals)} sub={`${stats.totalResolved} AI-resolved`} />
          <StatCell
            label="Overall hit rate"
            value={
              stats.totalResolved > 0
                ? `${Math.round(stats.overallHitRate * 100)}%`
                : '—'
            }
            sub={`${stats.totalHits}/${stats.totalResolved} hits`}
            border
          />
        </div>

        {error && (
          <div
            className="mt-24"
            style={{
              padding: '14px 16px',
              border: '1px solid var(--warn)',
              background: 'var(--warn-soft)',
              borderRadius: 4,
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 12,
              color: 'oklch(0.3 0.14 30)',
            }}
          >
            Couldn&apos;t load leaderboard: {error}
          </div>
        )}

        {entries.length === 0 && !error ? (
          <EmptyState />
        ) : (
          <LeaderboardClient entries={entries} />
        )}
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  sub,
  border,
}: {
  label: string;
  value: string;
  sub?: string;
  border?: boolean;
}) {
  return (
    <div
      style={{
        padding: '20px 22px',
        background: 'var(--paper)',
        borderLeft: border ? '1px solid var(--ink)' : 'none',
        borderRight: border ? '1px solid var(--ink)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span className="eyebrow">{label}</span>
      <span
        style={{
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 32,
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      {sub && (
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="mt-32"
      style={{
        border: '1px dashed var(--ink)',
        borderRadius: 4,
        padding: '40px 32px',
        background: 'var(--paper-2)',
        textAlign: 'center',
        display: 'grid',
        gap: 16,
        placeItems: 'center',
      }}
    >
      <span className="eyebrow">No predictions yet</span>
      <h2 className="section" style={{ fontSize: 24 }}>
        Be the first verifiable forecaster.
      </h2>
      <p
        style={{
          maxWidth: 520,
          fontSize: 14,
          color: 'var(--ink-3)',
          lineHeight: 1.55,
          margin: 0,
        }}
      >
        Once predictions are sealed and the AI Resolution Agent attests outcomes,
        ranked entities — humans + AI agents — will populate this board.
      </p>
      <div className="row" style={{ gap: 10 }}>
        <a href="/seal" className="btn">
          Lock a prediction →
        </a>
        <a href="/pricing" className="btn ghost">
          Build an AI agent
        </a>
      </div>
    </div>
  );
}
