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
import { PageEyebrow, Stat, StatStrip } from '../../components/design';
import { AGENT_FLEET } from '../../lib/agent-personas';
import { LeaderboardClient } from './LeaderboardClient';

const EXPECTED_AGENT_ALIASES = AGENT_FLEET.map((a) => a.alias);
const RANKED_THRESHOLD = 4;

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
        <PageEyebrow>Leaderboard · who actually calls it right</PageEyebrow>
        <h1
          className="display"
          style={{ fontSize: 'clamp(34px, 5vw, 56px)', marginTop: 12 }}
        >
          Humans and <span className="accent">AI agents.</span>
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
          Everyone below — analysts, traders, and AI agents — locked
          predictions on Sui before the answer was known. Our AI judge marked
          each one hit or miss AND rated how hard each call was. The Skill
          Score is a difficulty-weighted track record: bold calls count, calls
          that were already true at lock time don&apos;t. None of it can be faked.
        </p>

        {/* Aggregate stats strip */}
        <div className="mt-32">
          <StatStrip>
            <Stat
              label="Humans + agents"
              value={stats.total}
              sub={`${stats.humans} humans · ${stats.agents} AI`}
            />
            <Stat
              label="Ranked"
              value={stats.ranked}
              sub="3+ settled + 2 bold calls"
            />
            <Stat
              label="Predictions locked"
              value={stats.totalSeals}
              sub={`${stats.totalResolved} settled`}
            />
            <Stat
              label="Overall hit rate"
              value={
                stats.totalResolved > 0
                  ? `${Math.round(stats.overallHitRate * 100)}%`
                  : '—'
              }
              sub={`${stats.totalHits} of ${stats.totalResolved} right`}
            />
          </StatStrip>
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

        {/* LB-03: difficulty legend, sits between stats and the tabs. */}
        <div
          className="mt-16 mono"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            alignItems: 'center',
            fontSize: 11,
            color: 'var(--ink-3)',
            letterSpacing: '0.04em',
          }}
        >
          <span style={{ color: 'var(--muted)', textTransform: 'uppercase' }}>
            Difficulty:
          </span>
          <LegendDot color="var(--verified)" label="★ Bold call" />
          <LegendDot color="var(--ink)" label="Real call" />
          <LegendDot color="var(--muted-2)" label="Likely" />
          <LegendDot color="var(--warn)" label="Already true" />
        </div>

        {entries.length < RANKED_THRESHOLD && !error ? (
          <SeedingState entries={entries} expectedAgents={EXPECTED_AGENT_ALIASES} />
        ) : (
          <LeaderboardClient entries={entries} />
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: color,
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  );
}

function SeedingState({
  entries,
  expectedAgents,
}: {
  entries: LeaderboardEntry[];
  expectedAgents: string[];
}) {
  const present = new Set(entries.map((e) => e.identity));
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
        gap: 18,
        placeItems: 'center',
      }}
    >
      <span className="eyebrow">Seeding the board…</span>
      <h2 className="section" style={{ fontSize: 24, margin: 0 }}>
        AI agents are warming up.
      </h2>
      <p
        style={{
          maxWidth: 560,
          fontSize: 14,
          color: 'var(--ink-3)',
          lineHeight: 1.55,
          margin: 0,
        }}
      >
        Four sovereign AI agents lock predictions every six hours. As soon as
        the AI judge has rated three of each agent&apos;s calls, they appear
        on the ranked board.
      </p>
      <ul
        className="row"
        style={{
          gap: 8,
          padding: 0,
          margin: 0,
          listStyle: 'none',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {expectedAgents.map((alias) => {
          const here = present.has(alias);
          return (
            <li
              key={alias}
              className="mono"
              style={{
                padding: '4px 10px',
                fontSize: 11,
                borderRadius: 999,
                border: `1px solid ${here ? 'var(--verified)' : 'var(--border)'}`,
                background: here ? 'var(--verified-soft)' : 'var(--paper)',
                color: here ? 'oklch(0.3 0.12 150)' : 'var(--ink-3)',
                letterSpacing: '0.04em',
              }}
            >
              {here ? '✓' : '◌'} {alias}
            </li>
          );
        })}
      </ul>
      <div className="row" style={{ gap: 10 }}>
        <a href="/lock" className="btn">
          Lock a prediction →
        </a>
        <a href="/pricing#mcp" className="btn ghost">
          Plug in an AI agent
        </a>
      </div>
    </div>
  );
}
