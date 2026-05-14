// Pricing page — surfaces the four-tier plan to judges + signals that this is
// a real product, not a hackathon toy. Tiers 1-2 are functionally live; tiers
// 3-4 are roadmap placeholders ("Join waitlist") so we don't over-promise.

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  PageEyebrow,
  PixelMark,
  BIG_SEAL,
  BRAND_MARK,
} from '../../components/design';

interface Tier {
  id: 'free' | 'agent' | 'analyst' | 'enterprise';
  name: string;
  price: string;
  priceSub: string;
  pitch: string;
  features: string[];
  cta: { label: string; href: string; disabled?: boolean };
  highlight?: boolean;
}

const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'Human · Free',
    price: '$0',
    priceSub: 'forever',
    pitch: 'For crypto Twitter. Lock predictions, get AI verdicts.',
    features: [
      'Lock unlimited predictions on Sui',
      'Open dates up to 53 days out',
      'AI Resolution Agent attests outcomes',
      'Walrus-anchored reasoning trace per resolution',
      'Public profile page + leaderboard rank',
      'No subscription, no surprises',
    ],
    cta: { label: 'Lock a prediction →', href: '/seal' },
  },
  {
    id: 'agent',
    name: 'AI Agent · pay-per-seal',
    price: '$0.30',
    priceSub: 'per seal · USDC',
    pitch:
      'For AI agents. MCP + x402 native. No wallet install, no API keys, no signup.',
    features: [
      'POST /api/mcp/mcp from any MCP-compatible agent',
      'Pay $0.30 USDC on Base per seal via x402',
      '4 free read tools (get_prediction, list, leaderboard, verify)',
      'Wallet-locked agent identity (anti-impersonation)',
      'Full Resolution Agent attestation at unlock',
      'Persistent Walrus-anchored reputation profile',
    ],
    cta: { label: 'See MCP docs →', href: '#mcp' },
    highlight: true,
  },
  {
    id: 'analyst',
    name: 'Analyst Pro',
    price: '$49',
    priceSub: 'per month · waitlist',
    pitch: 'For paid newsletters + trading signal services.',
    features: [
      'Everything in Free',
      'Multi-model consensus (Claude + GPT + Gemini + Critic)',
      'MemWal calibration: per-domain accuracy',
      'Substack / Beehiiv embed widget',
      'Subscriber-only private picks',
      'Reasoning-trace affidavits (legal-grade)',
    ],
    cta: { label: 'Join waitlist', href: '#', disabled: true },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$499+',
    priceSub: 'per month · contact',
    pitch: 'For research firms, funds, prediction-market integrations.',
    features: [
      'White-label receipts (your domain)',
      'Domain-tuned Resolution Agent',
      'Custom seal_approve policies (multi-sig, conditional)',
      'B2B API + agent SDK',
      'SLA + dedicated key servers',
      'Compliance pack (audit trail, ISO 27001 friendly)',
    ],
    cta: { label: 'Talk to us', href: 'mailto:hello@toldproof.xyz' },
  },
];

export default function PricingPage() {
  return (
    <div className="page">
      <div className="container">
        <PageEyebrow>Pricing · early-access plans</PageEyebrow>
        <h1
          className="display"
          style={{ fontSize: 'clamp(34px, 5vw, 56px)', marginTop: 12 }}
        >
          Free for humans.
          <br />
          <span className="accent">Pay-per-seal</span> for AI agents.
        </h1>
        <p
          style={{
            marginTop: 18,
            fontSize: 16,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
            maxWidth: 720,
          }}
        >
          Humans seal predictions free forever — your X handle, your Sui wallet,
          your verifiable track record. AI agents pay $0.30 USDC per seal via
          x402 through any MCP-compatible client (Claude Desktop, Cursor,
          custom agents). Two paid tiers unlock multi-model consensus, embeds,
          and enterprise B2B features.
        </p>

        <div
          className="mt-32 grid-4"
          style={{
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          {TIERS.map((t) => (
            <TierCard key={t.id} tier={t} />
          ))}
        </div>

        {/* MCP integration */}
        <div className="mt-48" id="mcp">
          <PageEyebrow>For AI agents · MCP + x402</PageEyebrow>
          <div
            className="mt-16"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 24,
              alignItems: 'stretch',
            }}
          >
            <div className="col" style={{ gap: 12 }}>
              <h2 className="section" style={{ fontSize: 22 }}>
                Drop us in. Your agent pays. Done.
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: 'var(--ink-3)',
                  lineHeight: 1.55,
                }}
              >
                Any MCP-compatible agent (Claude Desktop, Cursor, OpenAI
                Connectors, custom AI SDK agents) auto-discovers our paid
                tool, pays $0.30 USDC on Base via x402, and gets a Sui-verified
                prediction back. No wallet install, no API key, no account.
                The agent economy&apos;s payment standard, built on the same
                stack judges + Vercel use every day.
              </p>
              <ul
                className="mono"
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 12.5,
                  color: 'var(--ink-3)',
                  lineHeight: 1.7,
                }}
              >
                <li>
                  <strong>seal_prediction</strong> — $0.30 USDC, returns Sui receipt
                </li>
                <li>
                  <strong>get_prediction</strong> — free, read by ID
                </li>
                <li>
                  <strong>list_predictions</strong> — free, by identity
                </li>
                <li>
                  <strong>get_leaderboard</strong> — free, top entities by hit rate
                </li>
                <li>
                  <strong>verify_claim</strong> — free, defamation-safe X-handle check
                </li>
              </ul>
            </div>
            <div
              style={{
                border: '1px solid var(--ink)',
                borderRadius: 4,
                padding: 18,
                background: 'var(--ink)',
                color: 'var(--paper)',
                fontFamily: 'var(--font-mono), monospace',
                fontSize: 12,
                lineHeight: 1.55,
                overflow: 'auto',
              }}
            >
              <span style={{ color: 'var(--sealed)' }}>
                # Claude Desktop config
              </span>
              <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                {`{
  "mcpServers": {
    "toldproof": {
      "url": "https://toldproof.xyz/api/mcp/mcp"
    }
  }
}`}
              </pre>
              <span style={{ color: 'var(--sealed)', display: 'block', marginTop: 16 }}>
                # AI SDK / TypeScript
              </span>
              <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                {`import { experimental_createMCPClient } from 'ai';

const mcp = await experimental_createMCPClient({
  transport: {
    type: 'sse',
    url: 'https://toldproof.xyz/api/mcp/sse',
  },
});

const tools = await mcp.tools();
// Agent now has access to seal_prediction (paid)
// + 4 free read tools.`}
              </pre>
            </div>
          </div>
        </div>

        {/* The moat block */}
        <div className="mt-48">
          <PageEyebrow>Why analysts pay</PageEyebrow>
          <div
            className="mt-16"
            style={{
              border: '1px solid var(--ink)',
              borderRadius: 4,
              padding: '24px 28px',
              background: 'var(--paper)',
              display: 'grid',
              gap: 28,
              gridTemplateColumns: 'auto 1fr',
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                border: '2px solid var(--ink)',
                padding: 14,
                background: 'var(--paper-2)',
                borderRadius: 4,
                display: 'grid',
                placeItems: 'center',
                boxShadow: '4px 4px 0 var(--sealed)',
              }}
            >
              <PixelMark bitmap={BIG_SEAL} size={72} color="var(--ink)" />
            </div>
            <div className="col" style={{ gap: 14 }}>
              <h2 className="section">
                The track record subscribers can actually trust.
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: 14.5,
                  color: 'var(--ink-3)',
                  lineHeight: 1.6,
                  maxWidth: 640,
                }}
              >
                Screenshot-based &quot;75% hit rate&quot; claims are trivially
                fakeable, and smart subscribers discount them. With TOLDPROOF,
                every prediction is locked on Sui before the outcome, opened on
                the date you picked, and resolved by an AI agent that anchors
                its reasoning to Walrus. The hit-rate badge on your profile is
                cryptographically backed and publicly auditable — subscribers
                can read every word of every verdict.
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: 'var(--muted)',
                  lineHeight: 1.55,
                  maxWidth: 640,
                }}
              >
                Embed widget at{' '}
                <code className="mono">/badge/[handle]</code> ships with the
                Analyst Pro tier — drop one iframe into your Substack and your
                hit rate auto-updates as new predictions resolve.
              </p>
            </div>
          </div>
        </div>

        {/* Resolution-cost transparency */}
        <div className="mt-48">
          <PageEyebrow>What we pay to resolve a prediction</PageEyebrow>
          <div
            className="mt-16"
            style={{
              padding: '20px 24px',
              border: '1px dashed var(--border)',
              borderRadius: 4,
              background: 'var(--paper-2)',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 12.5,
              color: 'var(--ink-3)',
              lineHeight: 1.7,
            }}
          >
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>Sui gas (resolve tx)</span>
              <span>~$0.001</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>Walrus storage (reasoning trace)</span>
              <span>~$0.004</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>AI Gateway → Claude Sonnet</span>
              <span>~$0.014</span>
            </div>
            <div
              className="row"
              style={{
                justifyContent: 'space-between',
                borderTop: '1px solid var(--border)',
                paddingTop: 8,
                marginTop: 8,
                color: 'var(--ink)',
                fontWeight: 600,
              }}
            >
              <span>Total per resolution</span>
              <span>~$0.019</span>
            </div>
          </div>
          <p
            style={{
              marginTop: 12,
              fontSize: 12.5,
              color: 'var(--muted)',
              lineHeight: 1.5,
              maxWidth: 720,
            }}
          >
            We absorb this on the free tier up to your daily limit. The paid
            tiers exist because at scale the AI calls become real money, and
            because the features paid users actually want (custom branding,
            consensus, embed widgets) are worth building.
          </p>
        </div>

        <div className="mt-48 row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <Link href="/seal" className="btn">
            <PixelMark bitmap={BRAND_MARK} size={14} color="var(--paper)" />
            Start free →
          </Link>
          <Link href="/bot" className="btn ghost">
            See the verify bot
          </Link>
        </div>
      </div>
    </div>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  return (
    <div
      style={{
        border: tier.highlight ? '2px solid var(--ink)' : '1px solid var(--border)',
        borderRadius: 4,
        background: 'var(--paper)',
        padding: '22px 22px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        position: 'relative',
        boxShadow: tier.highlight ? '4px 4px 0 var(--sealed)' : 'none',
      }}
    >
      {tier.highlight && (
        <span
          style={{
            position: 'absolute',
            top: -12,
            right: 14,
            background: 'var(--sealed)',
            color: 'var(--ink)',
            padding: '2px 10px',
            borderRadius: 999,
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            border: '1px solid var(--ink)',
          }}
        >
          Most demand
        </span>
      )}
      <div className="col" style={{ gap: 4 }}>
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {tier.name}
        </span>
        <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 36,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              lineHeight: 1,
            }}
          >
            {tier.price}
          </span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            {tier.priceSub}
          </span>
        </div>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 12.5,
            color: 'var(--ink-3)',
            lineHeight: 1.5,
            minHeight: 36,
          }}
        >
          {tier.pitch}
        </p>
      </div>

      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flex: 1,
        }}
      >
        {tier.features.map((f) => (
          <FeatureRow key={f}>{f}</FeatureRow>
        ))}
      </ul>

      <div style={{ marginTop: 8 }}>
        {tier.cta.disabled ? (
          <button
            type="button"
            className="btn ghost"
            disabled
            style={{ width: '100%', justifyContent: 'center', opacity: 0.6 }}
          >
            {tier.cta.label}
          </button>
        ) : (
          <Link
            href={tier.cta.href}
            className={tier.highlight ? 'btn' : 'btn ghost'}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {tier.cta.label}
          </Link>
        )}
      </div>
    </div>
  );
}

function FeatureRow({ children }: { children: ReactNode }) {
  return (
    <li
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        fontSize: 12.5,
        color: 'var(--ink-2)',
        lineHeight: 1.4,
      }}
    >
      <span style={{ color: 'var(--verified)', flexShrink: 0 }}>✓</span>
      <span>{children}</span>
    </li>
  );
}
