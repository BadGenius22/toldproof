// /docs — developer + judge entrypoint. Hero + 5 section cards, matching the
// receipt aesthetic from /brand and /for-analysts. Content is lifted from
// README.md; this page is the index, not the source of truth.

import Link from 'next/link';
import { PageEyebrow, PixelMark, BIG_SEAL } from '../../components/design';

export const metadata = {
  title: 'Docs · TOLDPROOF',
  description:
    'How TOLDPROOF works: the Sui Move contract, the time-locked seal flow, the MCP + x402 agent surface, the AI Resolution Agent, and the v3 audit.',
};

type Section = {
  href: string;
  eyebrow: string;
  title: string;
  blurb: string;
  bullets: string[];
};

const SECTIONS: Section[] = [
  {
    href: '/docs/architecture',
    eyebrow: 'How it works',
    title: 'Architecture',
    blurb:
      'The end-to-end flow — wallet or MCP, Sui contract, Walrus storage, Seal time-lock, and the AI judge that opens it.',
    bullets: [
      'Sui + Walrus + Seal in one diagram',
      'Time-lock identity scheme',
      'Reveal + resolve cron timing',
    ],
  },
  {
    href: '/docs/move-contract',
    eyebrow: 'On Sui',
    title: 'Move contract',
    blurb:
      'The on-chain receipt. Three seal paths, three roles, first-claim-wins identity locks, 62 passing tests.',
    bullets: [
      'seal_prediction · seal_prediction_paid · seal_prediction_as_agent',
      'admin · resolver · treasury_addr',
      'seal_approve as entry, not public entry',
    ],
  },
  {
    href: '/docs/mcp',
    eyebrow: 'For AI agents',
    title: 'MCP integration',
    blurb:
      'Any MCP-compatible agent can discover the seal tool, pay $0.10 USDC via x402, and walk away with a Sui-verified prediction. No signup.',
    bullets: [
      'Endpoint: /api/mcp/mcp',
      'x402 payment on Base (USDC)',
      'AI SDK v6 bridge snippet',
    ],
  },
  {
    href: '/docs/resolution',
    eyebrow: 'The AI judge',
    title: 'Resolution Agent',
    blurb:
      'At unlock time, the agent reads the plaintext, runs a tool-use loop with web search and price feeds, and stamps a verdict on Sui — reasoning anchored to Walrus.',
    bullets: [
      'Tavily web search + CoinGecko price feeds',
      'Consensus mode: Claude + GPT + Gemini + critic',
      'Reasoning trace permanent on Walrus',
    ],
  },
  {
    href: '/docs/audit',
    eyebrow: 'Security',
    title: 'v3 audit',
    blurb:
      'Three rounds of /dewaxguard audits on the Move contract. v3 cleared the new paid path: 0 / 0 / 0 / 0 / 3.',
    bullets: [
      '0 Critical · 0 High · 0 Medium · 0 Low',
      '3 Informational, all noted',
      'Contract cleared for testnet',
    ],
  },
];

export default function DocsIndexPage() {
  return (
    <div className="page">
      <div className="container">
        <PageEyebrow>Docs</PageEyebrow>
        <div
          className="row"
          style={{ alignItems: 'flex-start', gap: 24, marginTop: 12, flexWrap: 'wrap' }}
        >
          <div style={{ flex: '1 1 480px', minWidth: 0 }}>
            <h1
              className="display"
              style={{ fontSize: 'clamp(34px, 5vw, 56px)', maxWidth: 720 }}
            >
              Everything a judge or developer needs to read TOLDPROOF in five minutes.
            </h1>
            <p
              style={{
                marginTop: 18,
                fontSize: 16,
                color: 'var(--ink-3)',
                lineHeight: 1.55,
                maxWidth: 680,
              }}
            >
              Five pages, in the order we&apos;d explain it ourselves. Start at the
              architecture diagram, walk down to the contract, then see how AI agents
              plug in via MCP, how the AI judge attests outcomes, and what the audit
              cleared. Everything links back to the live code on GitHub.
            </p>
          </div>
          <div
            style={{
              flex: '0 0 auto',
              transform: 'rotate(-3deg)',
              padding: 16,
              border: '3px solid var(--ink)',
              borderRadius: 6,
              background: 'var(--paper)',
              boxShadow: '4px 4px 0 var(--sealed)',
              display: 'grid',
              placeItems: 'center',
              gap: 6,
            }}
          >
            <PixelMark bitmap={BIG_SEAL} size={64} color="var(--ink)" />
            <span
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                borderTop: '1px dashed var(--ink)',
                paddingTop: 4,
                textAlign: 'center',
                width: '100%',
              }}
            >
              5 pages · 5 min
            </span>
          </div>
        </div>

        <div className="mt-48 grid-2" style={{ gap: 16 }}>
          {SECTIONS.map((s) => (
            <SectionCard key={s.href} section={s} />
          ))}
        </div>

        <div
          className="mt-48"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: 22,
            background: 'var(--paper-2)',
            display: 'grid',
            gap: 14,
          }}
        >
          <span className="eyebrow">Going deeper</span>
          <div
            className="row"
            style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}
          >
            <ResourceLink
              href="https://github.com/BadGenius22/toldproof"
              label="GitHub repo"
            />
            <ResourceLink
              href="https://github.com/BadGenius22/toldproof/blob/main/spec.md"
              label="Full spec.md"
            />
            <ResourceLink
              href="https://github.com/BadGenius22/toldproof/blob/main/AUDIT_REPORT_V3.md"
              label="v3 audit (markdown)"
            />
            <ResourceLink
              href="https://github.com/BadGenius22/toldproof/blob/main/ROADMAP_V4.md"
              label="v4 roadmap"
            />
            <ResourceLink
              href="https://github.com/BadGenius22/toldproof/blob/main/README.md"
              label="README"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ section }: { section: Section }) {
  return (
    <Link
      href={section.href}
      style={{
        display: 'grid',
        gap: 12,
        padding: 22,
        border: '1px solid var(--border)',
        borderRadius: 4,
        background: 'var(--paper)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <span className="eyebrow">{section.eyebrow}</span>
      <div
        style={{
          fontFamily: 'var(--font-sans), sans-serif',
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--ink)',
        }}
      >
        {section.title}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: 'var(--ink-3)',
          lineHeight: 1.55,
        }}
      >
        {section.blurb}
      </p>
      <ul
        style={{
          margin: 0,
          paddingLeft: 0,
          listStyle: 'none',
          display: 'grid',
          gap: 4,
        }}
      >
        {section.bullets.map((b) => (
          <li
            key={b}
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              letterSpacing: '0.04em',
            }}
          >
            <span style={{ color: 'var(--sealed-text)' }}>›</span> {b}
          </li>
        ))}
      </ul>
      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          color: 'var(--ink-2)',
          fontFamily: 'var(--font-mono), monospace',
          letterSpacing: '0.06em',
        }}
      >
        Read →
      </div>
    </Link>
  );
}

function ResourceLink({ href, label }: { href: string; label: string }) {
  const external = href.startsWith('http');
  const props = external
    ? { target: '_blank' as const, rel: 'noreferrer' as const }
    : {};
  return (
    <a
      href={href}
      {...props}
      className="mono"
      style={{
        fontSize: 12,
        padding: '6px 10px',
        border: '1px solid var(--border)',
        borderRadius: 4,
        color: 'var(--ink-2)',
        textDecoration: 'none',
        letterSpacing: '0.04em',
        background: 'var(--paper)',
      }}
    >
      {label} {external ? '↗' : '→'}
    </a>
  );
}

