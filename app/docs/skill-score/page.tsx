// V4 T1.3 — methodology page for the Skill Score formula.
// Linked from the profile's decayed-from sub-label so curious readers can
// understand the math without diving into source code.

import type { Metadata } from 'next';
import { PageEyebrow } from '../../../components/design';
import {
  DIFFICULTY_WEIGHTS,
  MIN_BOLD_CALLS,
  MIN_RANKED_RESOLVED,
  SKILL_HALF_LIFE_MS,
} from '../../../lib/leaderboard';

export const metadata: Metadata = {
  title: 'How the Skill Score works · TOLDPROOF',
  description:
    'Wilson lower bound on difficulty-weighted hits, with a 180-day recency half-life and a bold-call eligibility gate. The math that defends against alias sharding.',
};

const halfLifeDays = SKILL_HALF_LIFE_MS / (24 * 60 * 60 * 1000);

export default function SkillScoreDocsPage() {
  return (
    <div className="page">
      <div className="container narrow">
        <PageEyebrow>Docs · methodology</PageEyebrow>
        <h1
          className="display"
          style={{ fontSize: 'clamp(30px, 4.5vw, 48px)', marginTop: 12 }}
        >
          How the Skill Score works
        </h1>
        <p
          style={{
            marginTop: 16,
            fontSize: 15,
            color: 'var(--ink-2)',
            lineHeight: 1.6,
            maxWidth: 660,
          }}
        >
          One number, 0–100. It answers: <em>how often does this wallet call
          things right, weighted by how hard each call was, with recent calls
          counting more than old ones?</em>
        </p>

        <Section title="The formula">
          <p>
            For every resolved prediction owned by a wallet, we compute a
            contribution:
          </p>
          <Code>
            {`contribution = difficulty_weight × recency_weight`}
          </Code>
          <p>
            Sum these across <strong>every alias the wallet has ever
            operated</strong>, then run the Wilson lower bound at 95%
            confidence:
          </p>
          <Code>
            {`skill = wilson_lower_bound_95(
  weighted_hits = Σ contribution(p) for hits,
  weighted_attempts = Σ contribution(p) for all resolved
) × 100`}
          </Code>
        </Section>

        <Section title="Difficulty weight — how hard was the call?">
          <p>
            The AI judge classifies each prediction&apos;s difficulty when it
            attests. Trivial calls (already true at lock time) contribute
            nothing — the anti-spam choice.
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Difficulty</th>
                <th style={thStyle}>Weight</th>
                <th style={thStyle}>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Trivial" w={DIFFICULTY_WEIGHTS.trivial}>
                Already true at lock time. Doesn&apos;t move the score.
              </Row>
              <Row label="Easy" w={DIFFICULTY_WEIGHTS.easy}>
                Likely outcome — straightforward macro or near-term price call.
              </Row>
              <Row label="Real call" w={DIFFICULTY_WEIGHTS.medium}>
                Genuine uncertainty — could plausibly go either way.
              </Row>
              <Row label="Bold call" w={DIFFICULTY_WEIGHTS.hard}>
                Contrarian or surprising. The riskiest, worth the most.
              </Row>
            </tbody>
          </table>
        </Section>

        <Section title={`Recency weight — ${halfLifeDays}-day half-life`}>
          <p>
            Old hits decay. A prediction&apos;s contribution to the score
            halves every {halfLifeDays} days. This is the Metaculus default
            for forecasting tournaments.
          </p>
          <Code>
            {`recency_weight(p) = 0.5^(age_days / ${halfLifeDays})`}
          </Code>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Age</th>
                <th style={thStyle}>Weight</th>
              </tr>
            </thead>
            <tbody>
              <RecencyRow days={0} w={1} />
              <RecencyRow days={90} w={0.707} />
              <RecencyRow days={180} w={0.5} />
              <RecencyRow days={360} w={0.25} />
              <RecencyRow days={540} w={0.125} />
              <RecencyRow days={720} w={0.0625} />
            </tbody>
          </table>
          <p style={{ marginTop: 12 }}>
            Why decay matters: it makes <strong>maintaining a sharded fleet
            expensive</strong>. If a wallet operates 10 aliases and abandons
            8 of them, the abandoned hits drift toward irrelevance —
            statistical pressure to either keep all aliases active or drop the
            score.
          </p>
        </Section>

        <Section title="Eligibility gate — bold-call filter">
          <p>
            To appear on the ranked board, a wallet needs:
          </p>
          <ul>
            <li>
              ≥ {MIN_RANKED_RESOLVED} settled (resolved) predictions across
              all its aliases
            </li>
            <li>
              ≥ {MIN_BOLD_CALLS} <em>bold calls</em> (medium or hard
              difficulty) — prevents single-lucky-call ranks
            </li>
          </ul>
          <p>
            Wallets below the gate appear in the &quot;Provisional&quot;
            section instead.
          </p>
        </Section>

        <Section title="Wallet aggregation — sharding doesn't help">
          <p>
            We compute the score from the <strong>sum</strong> of weighted
            hits and attempts across every alias a wallet operates. A wallet
            with 2 lucky aliases and 8 abandoned losers sees its wallet score
            dragged down by the 8 misses. Sharding stops being a strategy.
          </p>
          <p style={{ marginTop: 12 }}>
            Per-alias scores remain visible on each profile as drill-down
            data — but the ranking number is always wallet-level.
          </p>
        </Section>

        <Section title="Why Wilson, not just hit-rate?">
          <p>
            A wallet with 3 hits out of 3 calls has a 100% hit rate — but
            that&apos;s a tiny sample. Wilson lower bound at 95% gives a
            statistically defensible lower bound that grows with sample size:
            a 3/3 profile scores around 30, while a 100/100 scores near 96.
            Forecasters earn the high score by sustaining performance, not
            by getting lucky once.
          </p>
          <p style={{ marginTop: 12 }}>
            The formula is Wilson (1927), most famously applied to product
            ratings by Reddit and Yelp. We extend it to non-integer
            successes (difficulty weights × decay factors produce continuous
            values) — at hackathon scale the discrete-style formula is close
            enough; a fully rigorous treatment would use a Beta-binomial.
          </p>
        </Section>
      </div>
    </div>
  );
}

const tableStyle: React.CSSProperties = {
  marginTop: 12,
  width: '100%',
  borderCollapse: 'collapse',
  fontFamily: 'var(--font-mono), monospace',
  fontSize: 13,
};
const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px',
  borderBottom: '1px solid var(--ink)',
  background: 'var(--paper-2)',
  color: 'var(--ink-2)',
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};
const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px dashed var(--border)',
  color: 'var(--ink-2)',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-32">
      <h2
        className="section"
        style={{ fontSize: 22, marginBottom: 10, color: 'var(--ink)' }}
      >
        {title}
      </h2>
      <div
        style={{
          color: 'var(--ink-2)',
          lineHeight: 1.65,
          fontSize: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre
      style={{
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 12.5,
        background: 'var(--paper-2)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '12px 14px',
        margin: '6px 0',
        whiteSpace: 'pre-wrap',
        lineHeight: 1.55,
        color: 'var(--ink)',
      }}
    >
      {children}
    </pre>
  );
}

function Row({
  label,
  w,
  children,
}: {
  label: string;
  w: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td style={tdStyle}>
        <strong style={{ color: 'var(--ink)' }}>{label}</strong>
      </td>
      <td style={tdStyle}>{w.toFixed(1)}×</td>
      <td style={tdStyle}>{children}</td>
    </tr>
  );
}

function RecencyRow({ days, w }: { days: number; w: number }) {
  return (
    <tr>
      <td style={tdStyle}>
        {days === 0 ? 'fresh (today)' : `${days} days old`}
      </td>
      <td style={tdStyle}>{w.toFixed(3)}×</td>
    </tr>
  );
}
