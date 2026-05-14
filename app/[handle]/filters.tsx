'use client';

import { useState } from 'react';
import { PredictionCard } from '../../components/PredictionCard';
import type { PredictionView } from '../../lib/registry';

type Filter = 'all' | 'sealed' | 'awaiting' | 'revealed';

interface Counts {
  all: number;
  sealed: number;
  awaiting: number;
  revealed: number;
}

export function ProfileFilters({
  counts,
  predictions,
}: {
  counts: Counts;
  predictions: PredictionView[];
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const now = Date.now();
  const visible = predictions.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'revealed') return p.revealed;
    if (filter === 'sealed') return !p.revealed && now < p.unlockAtMs;
    if (filter === 'awaiting') return !p.revealed && now >= p.unlockAtMs;
    return true;
  });

  const tabs: Array<{ id: Filter; label: string; n: number }> = [
    { id: 'all', label: 'All', n: counts.all },
    { id: 'sealed', label: 'Still locked', n: counts.sealed },
    { id: 'awaiting', label: 'Ready to open', n: counts.awaiting },
    { id: 'revealed', label: 'Opened', n: counts.revealed },
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
                padding: '6px 12px',
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
          Sorted newest first
        </span>
      </div>

      <div
        className="mt-16"
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {visible.map((p) => (
          <PredictionCard key={p.id} p={p} />
        ))}
        {visible.length === 0 && (
          <div
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
            Nothing here yet.
          </div>
        )}
      </div>
    </>
  );
}
