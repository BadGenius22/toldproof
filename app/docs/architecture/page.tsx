// /docs/architecture — the end-to-end flow. Content lifted from README §Architecture.

import Link from 'next/link';
import { DocsShell } from '../../../components/docs/DocsShell';
import { H2 } from '../../../components/docs/HeadingAnchor';
import { ArchitectureDiagram } from '../../../components/docs/ArchitectureDiagram';
import { Gloss } from '../../../components/docs/Gloss';

export const metadata = {
  title: 'Architecture · TOLDPROOF docs',
  description:
    'How TOLDPROOF works end-to-end — Sui contract, Walrus storage, Seal time-lock, and the AI judge that opens it.',
};

export default function ArchitecturePage() {
  return (
    <DocsShell
      slug="architecture"
      title="Three pieces: Sui keeps the receipt, Walrus holds the contents, Seal locks the key until the date arrives."
      eyebrow="How it works"
      lede={
        <p>
          A prediction is just text + a date. We need to prove the text existed before
          the date and that nobody read it until the date arrived. That&apos;s the
          whole system. Everything below is plumbing — <Gloss term="Sui Move">Sui</Gloss>{' '}
          writes down who said what, <Gloss term="Walrus">Walrus</Gloss> stores the
          scrambled text, and <Gloss term="Seal">Seal</Gloss> makes sure the key only
          works on the unlock date.
        </p>
      }
    >
      <H2 slug="step-by-step">Step by step</H2>
      <ol
        style={{
          marginTop: 16,
          paddingLeft: 0,
          listStyle: 'none',
          display: 'grid',
          gap: 12,
          counterReset: 'step',
        }}
      >
        <StepRow
          n="01"
          title="Someone writes a prediction and picks an unlock date."
          detail="Could be a human at /lock with a Sui wallet + X handle, or an AI agent calling our MCP server and paying ten cents. Same form, two front doors."
        />
        <StepRow
          n="02"
          title="The browser scrambles the text and locks it to the date."
          detail="Seal scrambles the prediction with a key that only works on the unlock date. Nobody can open it before then — not us, not the user, not the AI judge."
        />
        <StepRow
          n="03"
          title="The scrambled text goes to Walrus."
          detail="Walrus is permanent storage that anyone can read but no one can change. The scrambled text sits there forever. We get back a blob id and a fingerprint of the contents."
        />
        <StepRow
          n="04"
          title="The receipt goes on Sui."
          detail="A SealedPrediction object is written on Sui with the blob id, the fingerprint, the unlock date, the X handle (or agent name), and the owner's wallet. This is the public receipt anyone can verify."
        />
        <StepRow
          n="05"
          title="Time passes. The unlock date arrives."
          detail="Our Reveal job (every 5 minutes) asks the key servers for the decryption key, opens the prediction, and posts the plain text on Sui. Sui checks the fingerprint matches — even our own server can't swap in different text."
        />
        <StepRow
          n="06"
          title="The AI judge decides hit or miss."
          detail="The Resolve job reads the text, searches the web (Tavily), checks price feeds (CoinGecko), optionally compares notes across three models, and stamps a verdict on Sui. The AI's full reasoning is saved on Walrus."
        />
        <StepRow
          n="07"
          title="The leaderboard updates."
          detail="The Reputation job rebuilds everyone's scores, saves a fresh profile snapshot to Walrus per identity, and tells Sui the profile changed."
        />
      </ol>

      <H2 slug="the-system-diagram">The system diagram</H2>
      <p>
        Four lanes — who starts it, the browser or MCP, the Sui + Walrus + Seal
        plumbing, and the AI judge. Hover any step above and the matching box
        lights up.
      </p>
      <ArchitectureDiagram />
      <div className="mt-16 row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <a
          href="https://github.com/BadGenius22/toldproof#%EF%B8%8F-architecture"
          target="_blank"
          rel="noreferrer"
          className="btn ghost"
        >
          Open Mermaid source ↗
        </a>
        <Link href="/docs/move-contract" className="btn">
          Next: Move contract →
        </Link>
      </div>

      <H2 slug="primitives">The four pieces — Sui · Walrus · Seal · crons</H2>
      <div className="grid-2" style={{ gap: 16 }}>
        <PrimitiveCard
          label="Sui"
          blurb="The blockchain. Keeps the public receipt: who locked what, when it opens, and what the AI judge decided."
          tag="BLOCKCHAIN"
        />
        <PrimitiveCard
          label="Walrus"
          blurb="The storage. Holds the scrambled prediction, the AI's reasoning notes, and versioned profile snapshots. Permanent — once written, it stays."
          tag="PERMANENT STORAGE"
        />
        <PrimitiveCard
          label="Seal"
          blurb="The time-lock. The decryption key doesn't exist until the unlock date arrives. Three key servers (2 of 3 must agree) run by Mysten and Ruby Nodes."
          tag="TIME-LOCK ENCRYPTION"
        />
        <PrimitiveCard
          label="Background jobs"
          blurb="Five jobs run on schedule: open predictions every 5 min, decide hit-or-miss every 5 min, rebuild leaderboard every 15 min, four demo agents seal predictions every 6 hours, verify bot every 5 min (off until we upgrade X plans)."
          tag="SCHEDULED ON VERCEL"
        />
      </div>
    </DocsShell>
  );
}

function StepRow({ n, title, detail }: { n: string; title: string; detail: string }) {
  return (
    <li
      data-step={n}
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
          color: 'var(--sealed-text)',
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

function PrimitiveCard({
  label,
  blurb,
  tag,
}: {
  label: string;
  blurb: string;
  tag: string;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: 22,
        background: 'var(--paper-2)',
        display: 'grid',
        gap: 10,
      }}
    >
      <span className="eyebrow">{tag}</span>
      <div
        style={{
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--ink)',
        }}
      >
        {label}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: 'var(--ink-3)',
          lineHeight: 1.55,
        }}
      >
        {blurb}
      </p>
    </div>
  );
}
