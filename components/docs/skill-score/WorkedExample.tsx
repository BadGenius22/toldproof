// Worked end-to-end example of the Skill Score formula on 17 resolved
// predictions. Computed at render time against the real lib/leaderboard
// constants, so changing SKILL_HALF_LIFE_MS or DIFFICULTY_WEIGHTS
// automatically updates the headline numbers.

import {
  DIFFICULTY_WEIGHTS,
  SKILL_HALF_LIFE_MS,
  recencyWeight,
  wilsonLowerBound95,
} from '../../../lib/leaderboard';
import { WORKED_EXAMPLE_FIXTURE } from '../../../fixtures/wallets';

const HALF_LIFE_DAYS = SKILL_HALF_LIFE_MS / (24 * 60 * 60 * 1000);
const NOW = Date.UTC(2026, 4, 12); // 2026-05-12 — methodology v2 anchor

function ageMsFromDays(days: number) {
  return NOW - days * 24 * 60 * 60 * 1000;
}

export function WorkedExample() {
  // Per-row contributions
  const rows = WORKED_EXAMPLE_FIXTURE.map((r) => {
    const diffW = DIFFICULTY_WEIGHTS[r.difficulty];
    const recW = recencyWeight(ageMsFromDays(r.ageDays), NOW);
    const contrib = diffW * recW;
    return { ...r, diffW, recW, contrib };
  });

  // Aggregates — no decay vs decayed
  const noDecayAttempts = rows.reduce((s, r) => s + r.diffW, 0);
  const noDecayHits = rows.reduce((s, r) => s + (r.hit ? r.diffW : 0), 0);
  const decayedAttempts = rows.reduce((s, r) => s + r.contrib, 0);
  const decayedHits = rows.reduce((s, r) => s + (r.hit ? r.contrib : 0), 0);

  const noDecayPHat = noDecayAttempts > 0 ? noDecayHits / noDecayAttempts : 0;
  const decayedPHat = decayedAttempts > 0 ? decayedHits / decayedAttempts : 0;

  const noDecayWilson = wilsonLowerBound95(noDecayHits, noDecayAttempts);
  const decayedWilson = wilsonLowerBound95(decayedHits, decayedAttempts);

  const finalScore = Math.round(decayedWilson * 100);
  const naiveScore = Math.round(noDecayWilson * 100);
  const delta = finalScore - naiveScore;

  const display = rows.slice(0, 6);
  const remaining = rows.length - display.length;

  return (
    <div
      className="docs-worked-example"
      style={{
        border: '1px solid var(--ink)',
        borderRadius: 4,
        background: 'var(--paper)',
        marginTop: 16,
        overflow: 'hidden',
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 12,
        color: 'var(--ink-2)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--paper-2)',
          letterSpacing: '0.06em',
        }}
      >
        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
          Worked example · {rows.length} decided predictions
        </span>
        <span style={{ color: 'var(--muted)' }}>0xc187…391df</span>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 0,
        }}
      >
        <div
          style={{
            padding: 16,
            borderRight: '1px solid var(--border)',
          }}
        >
          <div
            className="eyebrow"
            style={{ marginBottom: 10, color: 'var(--muted)' }}
          >
            Sample predictions
          </div>
          <table
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}
          >
            <thead>
              <tr style={{ color: 'var(--muted)' }}>
                <th style={th}>age</th>
                <th style={th}>diff</th>
                <th style={th}>?</th>
                <th style={th}>contrib</th>
              </tr>
            </thead>
            <tbody>
              {display.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{r.ageDays}d</td>
                  <td style={td}>{shortDiff(r.difficulty)}</td>
                  <td
                    style={{
                      ...td,
                      color: r.hit ? 'var(--verified-text)' : 'var(--muted)',
                    }}
                  >
                    {r.hit ? 'hit' : 'miss'}
                  </td>
                  <td style={td}>
                    {formatX(r.diffW)} × {r.recW.toFixed(2)} ={' '}
                    <span style={{ color: 'var(--ink)' }}>
                      {r.contrib.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
              {remaining > 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      ...td,
                      color: 'var(--muted)',
                      fontStyle: 'italic',
                    }}
                  >
                    … {remaining} more rows
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={{ padding: 16 }}>
          <div
            className="eyebrow"
            style={{ marginBottom: 10, color: 'var(--muted)' }}
          >
            Totals — no fading vs fading
          </div>
          <table
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}
          >
            <caption className="sr-only">
              Side-by-side comparison of the Skill Score components with and
              without the {HALF_LIFE_DAYS}-day recency fading applied.
            </caption>
            <thead>
              <tr style={{ color: 'var(--muted)' }}>
                <th style={th}>metric</th>
                <th style={th}>no fade</th>
                <th style={th}>with fade</th>
              </tr>
            </thead>
            <tbody>
              <TotalsRow
                label="weighted hits"
                a={noDecayHits.toFixed(1)}
                b={decayedHits.toFixed(1)}
              />
              <TotalsRow
                label="weighted attempts"
                a={noDecayAttempts.toFixed(1)}
                b={decayedAttempts.toFixed(1)}
              />
              <TotalsRow
                label="p̂ (hit rate)"
                a={noDecayPHat.toFixed(3)}
                b={decayedPHat.toFixed(3)}
              />
              <TotalsRow
                label="Wilson 95% lower"
                a={noDecayWilson.toFixed(2)}
                b={decayedWilson.toFixed(2)}
              />
            </tbody>
          </table>
        </div>
      </div>

      <footer
        style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--sealed-soft)',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: 'var(--ink)', letterSpacing: '0.04em' }}>
          SKILL SCORE · FINAL
        </span>
        <span
          style={{
            fontSize: 22,
            color: 'var(--ink)',
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          {finalScore}
        </span>
        <span style={{ color: 'var(--sealed-text)' }}>
          {delta < 0 ? '−' : '+'}
          {Math.abs(delta)} from the no-fade score of {naiveScore}
        </span>
      </footer>

      <aside
        style={{
          padding: '12px 16px',
          fontSize: 11.5,
          color: 'var(--ink-3)',
          background: 'var(--paper-2)',
          borderTop: '1px dashed var(--border)',
          fontFamily: 'var(--font-sans), sans-serif',
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: 'var(--ink)' }}>Read this as:</strong>{' '}
        recent misses weigh heavier than old wins. Fading pulls the raw hit
        rate down by the old-miss share, and Wilson then trims further because
        once you fade out the old hits there are fewer calls effectively
        carrying weight than the raw count suggests.
      </aside>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: '1px dashed var(--border)',
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 500,
};

const td: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px dashed var(--border)',
  color: 'var(--ink-2)',
};

function TotalsRow({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr>
      <td style={{ ...td, color: 'var(--muted)' }}>{label}</td>
      <td style={td}>{a}</td>
      <td style={{ ...td, color: 'var(--ink)', fontWeight: 600 }}>{b}</td>
    </tr>
  );
}

function shortDiff(d: 'trivial' | 'easy' | 'medium' | 'hard'): string {
  return d === 'medium' ? 'real' : d === 'hard' ? 'bold' : d;
}

function formatX(w: number): string {
  return `${w.toFixed(1)}×`;
}
