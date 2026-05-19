// V4 T1.3 — methodology page for the Skill Score formula.
// Linked from the profile's decayed-from sub-label so curious readers can
// understand the math without diving into source code.

import Link from 'next/link';
import type { Metadata } from 'next';
import { DocsShell } from '../../../components/docs/DocsShell';
import { H2 } from '../../../components/docs/HeadingAnchor';
import { CodeBlock } from '../../../components/docs/CodeBlock';
import { Gloss } from '../../../components/docs/Gloss';
import { WorkedExample } from '../../../components/docs/skill-score/WorkedExample';
import { DecayCurve } from '../../../components/docs/skill-score/DecayCurve';
import { Faq } from '../../../components/docs/skill-score/Faq';
import {
  DIFFICULTY_WEIGHTS,
  MIN_BOLD_CALLS,
  MIN_RANKED_RESOLVED,
  SKILL_HALF_LIFE_MS,
  METHODOLOGY_VERSION,
  METHODOLOGY_INTRODUCED_AT,
  METHODOLOGY_CHANGELOG,
} from '../../../lib/leaderboard';

export const metadata: Metadata = {
  title: 'How the Skill Score works · TOLDPROOF',
  description:
    'Wilson lower bound on difficulty-weighted hits, with a 180-day recency half-life and a bold-call eligibility gate. The math that defends against alias sharding.',
};

const HALF_LIFE_DAYS = SKILL_HALF_LIFE_MS / (24 * 60 * 60 * 1000);

const FORMULA_CONTRIB = `contribution = difficulty_weight × recency_weight`;

const FORMULA_SCORE = `skill = wilson_lower_bound_95(
  weighted_hits     = Σ contribution(p) for hits,
  weighted_attempts = Σ contribution(p) for all resolved
) × 100`;

const FORMULA_RECENCY = `recency_weight(p) = 0.5^(age_days / ${HALF_LIFE_DAYS})`;

export default function SkillScoreDocsPage() {
  return (
    <DocsShell
      slug="skill-score"
      title="How the Skill Score works"
      eyebrow="Reference · methodology"
      lede={
        <p className="skill-score-lede" style={{ textWrap: 'pretty' }}>
          One number, 0–100. It answers:{' '}
          <em>
            how often does this wallet call things right, weighted by how hard each
            call was, with recent calls counting more than old ones?
          </em>
        </p>
      }
    >
      <MethodologyStamp />

      <H2 slug="the-formula">01 · The formula</H2>
      <p>
        For every resolved prediction owned by a wallet, we compute a contribution:
      </p>
      <CodeBlock code={FORMULA_CONTRIB} language="formula" />
      <p>
        Sum these across <strong>every alias the wallet has ever operated</strong>,
        then run the <Gloss term="Wilson lower bound">Wilson lower bound</Gloss> at
        95% confidence:
      </p>
      <CodeBlock code={FORMULA_SCORE} language="formula" />

      <H2 slug="difficulty-weight">02 · Difficulty weight — how hard was the call?</H2>
      <p>
        The AI judge classifies each prediction&apos;s difficulty when it attests.
        Trivial calls (already true at lock time) contribute nothing — the anti-spam
        choice.
      </p>
      <table style={tableStyle}>
        <caption className="sr-only">
          Difficulty weights used in the Skill Score formula. Higher weight = call
          counts more, whether it&apos;s a hit or a miss.
        </caption>
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
      <aside
        style={{
          marginTop: 12,
          padding: '12px 14px',
          background: 'var(--paper-2)',
          border: '1px dashed var(--border)',
          borderRadius: 4,
          fontSize: 13,
          color: 'var(--ink-3)',
          lineHeight: 1.6,
        }}
      >
        A trivial correct prediction still counts as a hit on your hit-rate badge —
        it just doesn&apos;t contribute to the Skill Score. This is the anti-spam
        choice: &quot;the sun rose today&quot; shouldn&apos;t help anyone.
      </aside>

      <H2 slug="recency-weight">03 · Recency &amp; decay curve</H2>
      <p>
        Old hits decay. A prediction&apos;s contribution to the score halves every{' '}
        {HALF_LIFE_DAYS} days. This is the{' '}
        <Gloss term="Metaculus">Metaculus</Gloss> default for forecasting tournaments.
      </p>
      <CodeBlock code={FORMULA_RECENCY} language="formula" />
      <DecayCurve />
      <table style={{ ...tableStyle, marginTop: 16 }}>
        <caption className="sr-only">
          Recency weights at common ages. Multiply by the difficulty weight to get
          the per-prediction contribution.
        </caption>
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
        Why decay matters: it makes{' '}
        <strong>maintaining a sharded fleet expensive</strong>. If a wallet operates
        10 aliases and abandons 8 of them, the abandoned hits drift toward
        irrelevance — statistical pressure to either keep all aliases active or drop
        the score.
      </p>

      <H2 slug="worked-example">04 · Worked example</H2>
      <p>
        17 resolved predictions, computed end-to-end against the real{' '}
        <code className="mono">lib/leaderboard</code> constants. Change{' '}
        <code className="mono">SKILL_HALF_LIFE_MS</code> and the headline numbers
        below update automatically — this stays in sync with the math.
      </p>
      <WorkedExample />

      <H2 slug="eligibility-gate">05 · Eligibility gate — bold-call filter</H2>
      <p>To appear on the ranked board, a wallet needs:</p>
      <ul>
        <li>
          ≥ {MIN_RANKED_RESOLVED} settled (resolved) predictions across all its
          aliases
        </li>
        <li>
          ≥ {MIN_BOLD_CALLS} <em>bold calls</em> (medium or hard difficulty) —
          prevents single-lucky-call ranks
        </li>
      </ul>
      <p>
        Wallets below the gate appear in the &quot;Provisional&quot; section
        instead.
      </p>

      <H2 slug="wallet-aggregation">06 · Wallet aggregation — sharding doesn&apos;t help</H2>
      <p>
        We compute the score from the <strong>sum</strong> of weighted hits and
        attempts across every alias a wallet operates. A wallet with 2 lucky aliases
        and 8 abandoned losers sees its wallet score dragged down by the 8 misses.
        Sharding stops being a strategy.
      </p>
      <p style={{ marginTop: 12 }}>
        Per-alias scores remain visible on each profile as drill-down data — but the
        ranking number is always wallet-level. The{' '}
        <Gloss term="publisher">publisher</Gloss> address is the anchor.
      </p>

      <H2 slug="frequently-asked">07 · Frequently asked</H2>
      <Faq />

      <H2 slug="why-wilson">08 · Why Wilson, not just hit-rate?</H2>
      <p>
        A wallet with 3 hits out of 3 calls has a 100% hit rate — but that&apos;s a
        tiny sample. <Gloss term="Wilson lower bound">Wilson lower bound</Gloss> at
        95% gives a statistically defensible lower bound that grows with sample size:
        a 3/3 profile scores around 30, while a 100/100 scores near 96. Forecasters
        earn the high score by sustaining performance, not by getting lucky once.
      </p>
      <p style={{ marginTop: 12 }}>
        The formula is Wilson (1927), most famously applied to product ratings by
        Reddit and Yelp. We extend it to non-integer successes (difficulty weights ×
        decay factors produce continuous values) — at hackathon scale the
        discrete-style formula is close enough; a fully rigorous treatment would use
        a <Gloss term="Beta-binomial">Beta-binomial</Gloss>.
      </p>

      <RelatedT1 />
    </DocsShell>
  );
}

function MethodologyStamp() {
  const prev =
    METHODOLOGY_CHANGELOG[METHODOLOGY_CHANGELOG.length - 2];
  return (
    <div
      className="mono"
      style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        alignItems: 'baseline',
        padding: '10px 12px',
        border: '1px dashed var(--border)',
        borderRadius: 4,
        background: 'var(--paper-2)',
        fontSize: 11,
        letterSpacing: '0.06em',
        color: 'var(--ink-3)',
      }}
    >
      <span style={{ color: 'var(--sealed-text)', fontWeight: 600 }}>
        METHODOLOGY {METHODOLOGY_VERSION.toUpperCase()}
      </span>
      <span>introduced {METHODOLOGY_INTRODUCED_AT}</span>
      {prev ? (
        <span style={{ color: 'var(--muted)' }}>
          previous: {prev.version} ({prev.summary})
        </span>
      ) : null}
    </div>
  );
}

function RelatedT1() {
  return (
    <section
      style={{
        marginTop: 40,
        padding: 22,
        border: '1px solid var(--border)',
        borderRadius: 4,
        background: 'var(--paper-2)',
        display: 'grid',
        gap: 14,
      }}
    >
      <span className="eyebrow">Related — V4 anti-gaming stack</span>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6 }}>
        This Skill Score is one of four T1 mechanisms. The others:
      </p>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
        <RelatedLink href="/leaderboard" label="By-wallet leaderboard">
          where the score is ranked
        </RelatedLink>
        <RelatedLink
          href="/leaderboard"
          label="Wallet provenance footer"
        >
          every alias under one wallet
        </RelatedLink>
        <RelatedLink href="/leaderboard" label="Trust badges">
          Single · Multi · Churner · Spam
        </RelatedLink>
      </ul>
      <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.04em' }}>
        Roadmap:{' '}
        <a
          href="https://github.com/BadGenius22/toldproof/blob/main/ROADMAP_V4.md"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--ink-3)' }}
        >
          ROADMAP_V4.md §Theme 1 ↗
        </a>
      </div>
    </section>
  );
}

function RelatedLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: '14px 1fr 1fr',
        gap: 8,
        alignItems: 'baseline',
        fontSize: 13,
      }}
    >
      <span aria-hidden style={{ color: 'var(--sealed-text)' }}>
        →
      </span>
      <Link
        href={href}
        style={{ color: 'var(--ink-2)', textDecoration: 'none', fontWeight: 600 }}
      >
        {label}
      </Link>
      <span style={{ color: 'var(--muted)' }}>{children}</span>
    </li>
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
      <td style={tdStyle}>{w >= 0.999 ? '1.0×' : `${w.toFixed(3)}×`}</td>
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
