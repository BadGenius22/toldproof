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
      title="Three layers: Sui for the receipt, Walrus for the contents, Seal for the time-lock."
      eyebrow="How it works"
      lede={
        <p>
          A prediction is just text + a date. We need to prove the text existed before
          the date and that nobody read it until the date arrived. That&apos;s the whole
          system. Everything below is plumbing — <Gloss term="Sui Move">Sui</Gloss>{' '}
          for the receipt, <Gloss term="Walrus">Walrus</Gloss> for the ciphertext,{' '}
          <Gloss term="Seal">Seal</Gloss> for the time-lock.
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
          title="The user writes a prediction and picks an unlock date."
          detail="Could be a human at /lock with a Sui wallet + X handle, or an AI agent calling our MCP server with x402 payment. Same form, two front doors."
        />
        <StepRow
          n="02"
          title="The browser locks the text under a time-lock policy."
          detail="Seal encrypts the plaintext with an identity-based key tied to (package_id, unlock_timestamp). Nobody can open it before that timestamp — not us, not the user, not the AI judge."
        />
        <StepRow
          n="03"
          title="The scrambled text goes to Walrus."
          detail="Walrus is decentralized storage. The ciphertext sits there permanently. We get back a blob id and a content hash."
        />
        <StepRow
          n="04"
          title="The receipt goes on Sui."
          detail="A SealedPrediction object is created on-chain with the blob id, content hash, unlock timestamp, X handle (or agent alias), and owner address. This is the public receipt anyone can verify."
        />
        <StepRow
          n="05"
          title="Time passes. The unlock date arrives."
          detail="The Reveal cron (every 5 minutes) pulls Seal decryption keys for all predictions whose unlock time has passed, decrypts them, and posts the plaintext on Sui with a hash check."
        />
        <StepRow
          n="06"
          title="The AI judge resolves it."
          detail="The Resolution cron reads the plaintext, runs a tool-use loop (web search via Tavily, prices via CoinGecko, optionally multi-model consensus), and writes a hit/miss verdict on Sui. The full reasoning trace is anchored to Walrus."
        />
        <StepRow
          n="07"
          title="Reputation updates."
          detail="The Reputation cron rebuilds the leaderboard, publishes a versioned profile to Walrus per identity, and emits a ReputationProfileUpdated event on Sui."
        />
      </ol>

      <H2 slug="the-system-diagram">The system diagram</H2>
      <p>
        Four lanes — clients, browser/MCP, the on-chain + storage primitives, and the
        AI judge. Hover any step row above to highlight the matching node.
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

      <H2 slug="primitives">Primitives — Sui · Walrus · Seal · crons</H2>
      <div className="grid-2" style={{ gap: 16 }}>
        <PrimitiveCard
          label="Sui"
          blurb="The chain. Records the receipt: who sealed what, when it unlocks, and what the AI judge decided."
          tag="L1"
        />
        <PrimitiveCard
          label="Walrus"
          blurb="The storage. Holds the scrambled prediction text, the AI's reasoning trace, and versioned reputation profiles."
          tag="DECENTRALIZED STORAGE"
        />
        <PrimitiveCard
          label="Seal"
          blurb="The time-lock. Identity-based encryption with a 2-of-3 key server committee (Mysten + Ruby Nodes). The unlock date is part of the identity."
          tag="THRESHOLD IBE"
        />
        <PrimitiveCard
          label="Vercel crons"
          blurb="Five jobs: reveal every 5 min, resolve every 5 min, reputation every 15 min, demo fleet every 6 hours, verify bot every 5 min (dormant until X Basic tier)."
          tag="FLUID COMPUTE"
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
