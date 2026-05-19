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
          One number, 0 to 100. It answers:{' '}
          <em>
            how often does this wallet call things right, with harder calls
            counting more and recent calls counting more than old ones?
          </em>
        </p>
      }
    >
      <MethodologyStamp />

      <H2 slug="the-formula">01 · The formula</H2>
      <p>
        For every prediction the AI judge has decided, we compute one number — the
        prediction&apos;s contribution to the score:
      </p>
      <CodeBlock code={FORMULA_CONTRIB} language="formula" />
      <p>
        Add these up across <strong>every alias the same wallet has ever
        used</strong>, then run the{' '}
        <Gloss term="Wilson lower bound">Wilson lower bound</Gloss> at 95%
        confidence:
      </p>
      <CodeBlock code={FORMULA_SCORE} language="formula" />

      <H2 slug="difficulty-weight">02 · How hard was the call?</H2>
      <p>
        When the AI judge decides hit or miss, it also rates how hard the call was.
        Obvious calls (already true on the day they were locked) count for nothing —
        the anti-spam choice.
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
          <Row label="Obvious" w={DIFFICULTY_WEIGHTS.trivial}>
            Already true on the day it was locked. Doesn&apos;t move the score.
          </Row>
          <Row label="Easy" w={DIFFICULTY_WEIGHTS.easy}>
            Likely outcome — a safe macro guess or near-term price call.
          </Row>
          <Row label="Real call" w={DIFFICULTY_WEIGHTS.medium}>
            Genuine uncertainty — could go either way.
          </Row>
          <Row label="Bold call" w={DIFFICULTY_WEIGHTS.hard}>
            Going against the consensus. The riskiest, worth the most.
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
        An obvious-but-correct prediction still counts as a hit on your hit-rate
        badge — it just doesn&apos;t move the Skill Score. This is the anti-spam
        choice: &quot;the sun rose today&quot; shouldn&apos;t help anyone.
      </aside>

      <H2 slug="recency-weight">03 · Recent calls count more</H2>
      <p>
        Old hits fade. A prediction&apos;s contribution to the score halves every{' '}
        {HALF_LIFE_DAYS} days. This is the value{' '}
        <Gloss term="Metaculus">Metaculus</Gloss> uses for its own forecasting
        tournaments.
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
        Why fading matters: it makes{' '}
        <strong>running many fake accounts expensive</strong>. If a wallet creates
        10 aliases and abandons 8 of them, the old wins on the abandoned 8 keep
        fading until they barely matter — pressure to either keep every alias
        active or watch the score drop.
      </p>

      <H2 slug="worked-example">04 · Worked example</H2>
      <p>
        17 decided predictions, computed end-to-end against the real{' '}
        <code className="mono">lib/leaderboard</code> constants. Change{' '}
        <code className="mono">SKILL_HALF_LIFE_MS</code> in the code and the
        numbers below update automatically — this card stays in sync with the math.
      </p>
      <WorkedExample />

      <H2 slug="eligibility-gate">05 · Who can rank</H2>
      <p>To appear on the ranked leaderboard, a wallet needs:</p>
      <ul>
        <li>
          At least {MIN_RANKED_RESOLVED} decided predictions across all its aliases
        </li>
        <li>
          At least {MIN_BOLD_CALLS} <em>bold calls</em> (real-call or bold
          difficulty) — stops anyone from ranking off a single lucky hit
        </li>
      </ul>
      <p>
        Wallets below the bar show up in the &quot;Provisional&quot; section
        instead.
      </p>

      <H2 slug="wallet-aggregation">06 · One wallet, one score — aliases don&apos;t help</H2>
      <p>
        We compute the score from the <strong>sum</strong> of weighted hits and
        attempts across every alias one wallet operates. A wallet with 2 lucky
        aliases and 8 abandoned losing aliases sees its score dragged down by the
        8 losers. Creating extra aliases stops being a strategy.
      </p>
      <p style={{ marginTop: 12 }}>
        Each alias still shows its own score on its own profile page — for the
        curious. But the <em>ranking</em> number is always at the wallet level. The{' '}
        <Gloss term="publisher">publisher</Gloss> wallet is the anchor.
      </p>

      <H2 slug="frequently-asked">07 · Frequently asked</H2>
      <Faq />

      <H2 slug="why-wilson">08 · Why Wilson, not raw hit-rate?</H2>
      <p>
        A wallet with 3 hits out of 3 calls has a 100% hit rate — but that&apos;s a
        tiny sample. The <Gloss term="Wilson lower bound">Wilson lower bound</Gloss>{' '}
        at 95% gives a statistically careful answer that grows with sample size: a
        3-for-3 profile scores around 30, while a 100-for-100 scores near 96.
        Forecasters earn the high score by being right consistently, not by getting
        lucky once.
      </p>
      <p style={{ marginTop: 12 }}>
        The formula is Wilson (1927), most famously used for product ratings on
        Reddit and Yelp. We extend it to non-integer counts (difficulty weights ×
        recency factors produce decimal values) — at hackathon scale the basic
        formula is close enough; a fully rigorous version would use a{' '}
        <Gloss term="Beta-binomial">Beta-binomial</Gloss>.
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
        METHOD {METHODOLOGY_VERSION.toUpperCase()}
      </span>
      <span>used since {METHODOLOGY_INTRODUCED_AT}</span>
      {prev ? (
        <span style={{ color: 'var(--muted)' }}>
          before that: {prev.version} ({prev.summary})
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
      <span className="eyebrow">Related — the V4 anti-gaming kit</span>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6 }}>
        This Skill Score is one of four V4 anti-gaming pieces. The others:
      </p>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
        <RelatedLink href="/leaderboard" label="By-wallet leaderboard">
          where the score is ranked
        </RelatedLink>
        <RelatedLink
          href="/leaderboard"
          label="Wallet provenance footer"
        >
          shows every alias one wallet owns
        </RelatedLink>
        <RelatedLink href="/leaderboard" label="Trust badges">
          Single · Multi · Churner · Spam
        </RelatedLink>
      </ul>
      <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.04em' }}>
        Full plan:{' '}
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
      <td style={tdStyle}>{w.toFixed(1)}×</td>
      <td style={tdStyle}>{children}</td>
    </tr>
  );
}

function RecencyRow({ days, w }: { days: number; w: number }) {
  return (
    <tr>
      <td style={tdStyle}>
        {days === 0 ? 'today' : `${days} days ago`}
      </td>
      <td style={tdStyle}>{w.toFixed(3)}×</td>
    </tr>
  );
}
