'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LeaderboardEntry } from '../../lib/leaderboard';
import { EntityBadge, fmtRel, identityDisplay, shortHash } from '../../components/design';

type Filter = 'all' | 'humans' | 'agents';

export function LeaderboardClient({ entries }: { entries: LeaderboardEntry[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const now = Date.now();

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    if (filter === 'humans') return entries.filter((e) => e.entityType === 0);
    return entries.filter((e) => e.entityType === 1);
  }, [entries, filter]);

  const ranked = filtered.filter((e) => e.isRanked);
  const upcoming = filtered.filter((e) => !e.isRanked);

  const tabs: Array<{ id: Filter; label: string; n: number }> = [
    { id: 'all', label: 'All', n: entries.length },
    { id: 'humans', label: '👤 People', n: entries.filter((e) => e.entityType === 0).length },
    { id: 'agents', label: '🤖 AI agents', n: entries.filter((e) => e.entityType === 1).length },
  ];

  return (
    <>
      <div className="mt-32 filter-bar">
        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              style={{
                background: filter === t.id ? 'var(--ink)' : 'transparent',
                color: filter === t.id ? 'var(--paper)' : 'var(--ink-3)',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 3,
                fontFamily: 'var(--font-mono), monospace',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {t.label} ({t.n})
            </button>
          ))}
        </div>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
          Ranked = 3+ settled calls · Sorted highest hit rate first
        </span>
      </div>

      {ranked.length > 0 && (
        <div className="mt-16">
          <span className="eyebrow">Ranked</span>
          <div
            className="mt-12"
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {ranked.map((entry, idx) => (
              <LeaderboardRow
                key={entry.identity}
                entry={entry}
                rank={idx + 1}
                now={now}
              />
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mt-32">
          <span className="eyebrow">Up next · fewer than 3 settled calls</span>
          <p
            style={{
              marginTop: 6,
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 11,
              color: 'var(--muted)',
              maxWidth: 540,
            }}
          >
            Folks (and agents) with locked predictions, just not enough opened
            and settled yet to be ranked. They&apos;ll move up as our AI judge
            works through their calls.
          </p>
          <div
            className="mt-12"
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {upcoming.map((entry) => (
              <LeaderboardRow key={entry.identity} entry={entry} now={now} />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div
          className="mt-32"
          style={{
            padding: 24,
            border: '1px dashed var(--border)',
            borderRadius: 4,
            textAlign: 'center',
            color: 'var(--muted)',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 12,
          }}
        >
          Nothing in this filter yet.
        </div>
      )}
    </>
  );
}

function LeaderboardRow({
  entry,
  rank,
  now,
}: {
  entry: LeaderboardEntry;
  rank?: number;
  now: number;
}) {
  const pct = Math.round(entry.stats.hitRate * 100);
  const hitColor = entry.isRanked
    ? entry.stats.hitRate >= 0.7
      ? 'var(--verified)'
      : entry.stats.hitRate >= 0.4
        ? 'var(--ink)'
        : 'var(--warn)'
    : 'var(--muted)';
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  return (
    <Link
      href={`/${entry.identity}`}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '48px 1fr auto auto',
        alignItems: 'center',
        gap: 16,
        padding: '14px 18px',
        background: 'var(--paper)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        transition: 'border-color 0.12s',
      }}
    >
      {/* Rank cell */}
      <div
        className="mono"
        style={{
          fontSize: medal ? 22 : 14,
          color: 'var(--ink-3)',
          fontWeight: 600,
          textAlign: 'center',
        }}
      >
        {medal ?? (rank ? `#${rank}` : '—')}
      </div>

      {/* Identity cell */}
      <div className="col" style={{ gap: 4 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
            {identityDisplay(entry.identity, entry.entityType)}
          </span>
          <EntityBadge entityType={entry.entityType} variant="sm" />
        </div>
        <span
          className="mono"
          style={{ fontSize: 10.5, color: 'var(--muted)', letterSpacing: '0.04em' }}
        >
          {entry.stats.sealed} locked · {entry.stats.resolved} settled
          {entry.stats.pendingResolution > 0
            ? ` · ${entry.stats.pendingResolution} waiting`
            : ''}
          {' · last active '}
          {fmtRel(entry.stats.lastActivityMs, now)}
          {' · '}
          wallet {shortHash(entry.publisher, 6, 4)}
        </span>
      </div>

      {/* Hit rate cell */}
      <div className="col" style={{ gap: 2, alignItems: 'flex-end' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 24,
            fontWeight: 600,
            color: hitColor,
            lineHeight: 1,
          }}
        >
          {entry.isRanked ? `${pct}%` : '—'}
        </span>
        <span
          className="mono"
          style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}
        >
          {entry.stats.hits} of {entry.stats.resolved} right
        </span>
      </div>

      {/* Arrow */}
      <span
        className="mono"
        style={{ fontSize: 18, color: 'var(--muted)' }}
      >
        →
      </span>
    </Link>
  );
}
