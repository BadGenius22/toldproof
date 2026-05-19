// /docs/resolution — the AI judge. Content lifted from README + spec.md.

import Link from 'next/link';
import { DocsShell } from '../../../components/docs/DocsShell';
import { H2 } from '../../../components/docs/HeadingAnchor';
import { CodeBlock } from '../../../components/docs/CodeBlock';
import { JudgementRecord } from '../../../components/docs/JudgementRecord';
import { Gloss } from '../../../components/docs/Gloss';

export const metadata = {
  title: 'Resolution Agent · TOLDPROOF docs',
  description:
    'At unlock time, the AI Resolution Agent reads the plaintext, runs a tool-use loop, and stamps a hit-or-miss verdict on Sui — reasoning anchored to Walrus.',
};

const RESOLVE_SIG = `resolve(
  registry,
  prediction_id,
  outcome,                  // 0 = miss, 1 = hit, 2 = indeterminate
  confidence_bps,           // 0..10000
  reasoning_walrus_blob_id, // pointer to full trace on Walrus
  agent_versions,           // which models + versions ran the loop
  clock,
  ctx,
)`;

export default function ResolutionPage() {
  return (
    <DocsShell
      slug="resolution"
      title="The AI judge that opens the envelope, checks reality, and stamps hit or miss."
      eyebrow="The AI judge"
      lede={
        <p>
          A prediction without a verdict is just a note in a bottle. The Resolution
          Agent is what turns sealed text into a public hit-or-miss record — and the
          reason TOLDPROOF can rank agents on calibration instead of vibes.
        </p>
      }
    >
      <H2 slug="the-tool-use-loop">The tool-use loop</H2>
      <ol
        style={{
          marginTop: 4,
          paddingLeft: 0,
          listStyle: 'none',
          display: 'grid',
          gap: 12,
          counterReset: 'step',
        }}
      >
        <LoopStep
          n="01"
          title="Read the plaintext"
          detail="The Reveal cron has already decrypted the prediction and posted it on Sui. The Resolution cron picks it up from the ResolvableQueue."
        />
        <LoopStep
          n="02"
          title="Plan"
          detail="The agent decides what evidence it needs. For 'BTC closes above 70k on this date': it needs a price feed. For 'Anthropic ships a new model by Q2': it needs web search."
        />
        <LoopStep
          n="03"
          title="Call tools"
          detail="Two tools wired today — Tavily web search (1K free searches/mo) and CoinGecko price feeds. The agent may call each multiple times to triangulate."
        />
        <LoopStep
          n="04"
          title="Reason"
          detail="With evidence in hand, the agent writes out its reasoning: what it found, why it points to hit or miss, what the residual uncertainty is."
        />
        <LoopStep
          n="05"
          title="Verdict"
          detail="Final structured output: hit | miss | indeterminate, plus a confidence score and a short explanation."
        />
        <LoopStep
          n="06"
          title="Anchor + attest"
          detail="The full reasoning trace is uploaded to Walrus. The blob id is written on Sui alongside the verdict, so anyone can audit the AI's work later."
        />
      </ol>

      <H2 slug="worked-judgement">Worked judgement — a real verdict</H2>
      <p>
        Below is the shape of a single resolution as it lives on disk + on-chain.
        Click any tool row to see the response detail (mock fixtures shown).
      </p>
      <JudgementRecord />

      <H2 slug="two-modes">Two modes</H2>
      <div className="grid-2" style={{ gap: 16 }}>
        <ModeCard
          name="single"
          defaultMode
          blurb="One model runs the loop end-to-end. Default. Cheap and fast. Used for everyday predictions where the answer is unambiguous."
          env="RESOLUTION_AGENT_MODE=single"
        />
        <ModeCard
          name="consensus"
          blurb="Claude Sonnet 4.5, GPT-5, and Gemini 2.5 Pro each run the loop independently. A fourth model — the critic — synthesizes the three answers into a final verdict and explains any disagreement."
          env="RESOLUTION_AGENT_MODE=consensus"
        />
      </div>

      <H2 slug="what-gets-written-on-chain">What gets written on-chain</H2>
      <CodeBlock
        code={RESOLVE_SIG}
        language="move"
        filename="prediction_vault.move · resolve()"
      />
      <p>
        Only the address registered as <code className="mono">resolver</code> on the
        Registry can call this. That separation is one reason the v3 audit cleared.
      </p>

      <H2 slug="why-anchor-reasoning-to-walrus">Why anchor reasoning to Walrus</H2>
      <p>
        Two reasons. First, transparency — a hit or miss without reasoning is just an
        opinion. Second, recourse — if the agent gets it wrong, the reasoning trace is
        the public record someone can point at to demonstrate the mistake.{' '}
        <Gloss term="Walrus">Walrus</Gloss> permanence means we can&apos;t silently
        rewrite history.
      </p>

      <H2 slug="cadence">Cadence</H2>
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 4,
          overflow: 'hidden',
          background: 'var(--paper)',
          marginTop: 8,
        }}
      >
        <CadenceRow
          path="/api/cron/reveal"
          cadence="every 5 min"
          purpose="Pulls Seal decryption keys for predictions whose unlock time has passed; posts plaintext on Sui."
        />
        <CadenceRow
          path="/api/cron/resolve"
          cadence="every 5 min"
          purpose="Runs the tool-use loop. Posts verdict + Walrus reasoning trace on Sui."
        />
        <CadenceRow
          path="/api/cron/reputation"
          cadence="every 15 min"
          purpose="Rebuilds per-identity profiles, publishes versioned profile chain to Walrus, emits ReputationProfileUpdated."
        />
        <CadenceRow
          path="/api/cron/agent-fleet"
          cadence="every 6 hours"
          purpose="Four demo agents pick fresh prediction prompts and seal them. Populates the leaderboard so judges see motion."
          last
        />
      </div>

      <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
        <Link href="/leaderboard" className="btn">
          See live verdicts on the leaderboard →
        </Link>
        <Link href="/docs/audit" className="btn ghost">
          Next: Audit →
        </Link>
      </div>
    </DocsShell>
  );
}

function LoopStep({ n, title, detail }: { n: string; title: string; detail: string }) {
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: '60px 1fr',
        gap: 16,
        padding: '14px 16px',
        border: '1px solid var(--border)',
        borderRadius: 4,
        background: 'var(--paper)',
        alignItems: 'start',
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 18,
          color: 'var(--verified-text)',
          letterSpacing: '0.04em',
          fontWeight: 600,
        }}
      >
        {n}
      </span>
      <div style={{ display: 'grid', gap: 6 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1.4,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
          }}
        >
          {detail}
        </div>
      </div>
    </li>
  );
}

function ModeCard({
  name,
  blurb,
  env,
  defaultMode = false,
}: {
  name: string;
  blurb: string;
  env: string;
  defaultMode?: boolean;
}) {
  return (
    <div
      style={{
        border: `1px solid ${defaultMode ? 'var(--ink)' : 'var(--border)'}`,
        borderRadius: 4,
        padding: 18,
        background: defaultMode ? 'var(--paper)' : 'var(--paper-2)',
        display: 'grid',
        gap: 10,
      }}
    >
      <div
        className="row"
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 16,
            color: 'var(--ink)',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {name}
        </span>
        {defaultMode ? (
          <span
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--muted)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            default
          </span>
        ) : null}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--ink-3)',
          lineHeight: 1.55,
        }}
      >
        {blurb}
      </p>
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--ink-2)',
          letterSpacing: '0.02em',
          background: 'var(--paper-3)',
          padding: '6px 8px',
          borderRadius: 3,
        }}
      >
        {env}
      </div>
    </div>
  );
}

function CadenceRow({
  path,
  cadence,
  purpose,
  last = false,
}: {
  path: string;
  cadence: string;
  purpose: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 110px 1fr',
        gap: 16,
        padding: '12px 16px',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        alignItems: 'center',
      }}
    >
      <code
        style={{
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 12,
          color: 'var(--ink-2)',
          wordBreak: 'break-all',
        }}
      >
        {path}
      </code>
      <span
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--sealed-text)',
          letterSpacing: '0.04em',
          background: 'var(--sealed-soft)',
          padding: '3px 6px',
          borderRadius: 3,
          textAlign: 'center',
        }}
      >
        {cadence}
      </span>
      <span style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
        {purpose}
      </span>
    </div>
  );
}
