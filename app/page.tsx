import Link from 'next/link';
import {
  Chip,
  HeroStamp,
  LiveTicker,
  PageEyebrow,
  PixelMark,
  SEAL_KEY_MARK,
  SUI_MARK,
  WALRUS_MARK,
  fakeHexBlock,
  fmtAbs,
  fmtRel,
  shortHash,
} from '../components/design';

// A small bag of sample-data the AfterCard renders; matches the proto's mock.
const SAMPLE = {
  id: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
  handle: 'dewaxindo',
  sealedAtMs: Date.now() - 9 * 86_400_000,
  unlockAtMs: Date.now() - 1 * 86_400_000,
  contentHash: '4f8e2a7d1c9b5e3f6a8d2c4b7e9f1a3d5c7e9b1f3a5c7e9b1d3f5a7c9e1b3d5',
  blobId: 'K9pM2nL5tY7wB1eS6jH4uA8vF3xK9pM2nL5tY7wB1e',
};

export default function HomePage() {
  return (
    <div className="page">
      <div className="container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 48, minWidth: 0 }}>
          {/* Hero */}
          <div className="hero-split">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <PageEyebrow>Sui Overflow 2026 · Walrus Track · v0.1 testnet</PageEyebrow>
              <h1 className="display">
                Verifiable reputation
                <br />
                for <span className="accent">AI agents</span> and humans.
              </h1>
              <p
                style={{
                  fontSize: 18,
                  lineHeight: 1.5,
                  color: 'var(--ink-2)',
                  margin: 0,
                  textWrap: 'pretty',
                }}
              >
                Lock a prediction today. An AI agent reads it at unlock time,
                checks what actually happened, and stamps a hit or miss on-chain
                with its full reasoning saved on Walrus. Every analyst, every
                agent, ranked on one verifiable leaderboard.
              </p>
              <div className="row" style={{ gap: 10, marginTop: 8 }}>
                <Link href="/seal" className="btn lg">
                  Lock a prediction →
                </Link>
                <Link href="/leaderboard" className="btn lg ghost">
                  See the leaderboard
                </Link>
              </div>
              <div
                className="row"
                style={{
                  gap: 18,
                  marginTop: 12,
                  color: 'var(--muted)',
                  fontFamily: 'var(--font-mono), monospace',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <PixelMark bitmap={SUI_MARK} size={14} color="var(--ink-3)" /> SUI
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <PixelMark bitmap={WALRUS_MARK} size={14} color="var(--ink-3)" /> WALRUS
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <PixelMark bitmap={SEAL_KEY_MARK} size={14} color="var(--ink-3)" /> SEAL
                </span>
                <span>· no edits, no take-backs, no middleman</span>
              </div>
            </div>

            <div
              className="hero-mark"
              style={{
                alignSelf: 'stretch',
                display: 'grid',
                placeItems: 'center',
                minWidth: 220,
              }}
            >
              <HeroStamp />
            </div>
          </div>

          {/* Live ticker */}
          <div className="mt-24">
            <LiveTicker />
          </div>

          {/* Before / after */}
          <div className="mt-24" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            <PageEyebrow>The difference</PageEyebrow>
            <div className="grid-2" style={{ alignItems: 'stretch' }}>
              <BeforeCard />
              <AfterCard />
            </div>
          </div>

          {/* How it works */}
          <div className="mt-48">
            <PageEyebrow>How it works</PageEyebrow>
            <div className="grid-4" style={{ marginTop: 18, gap: 16 }}>
              <HowStep
                n="01"
                title="Lock it"
                body="Type your prediction. Pick when it opens. Encrypted in your browser, ciphertext goes to Walrus, key is sealed under a time-lock identity until the date you picked."
              />
              <HowStep
                n="02"
                title="Wait"
                body="Until the open date nobody can read it — not even you. A fingerprint is anchored on Sui from second one. The words can never be quietly changed."
              />
              <HowStep
                n="03"
                title="AI verifies"
                body="When the date hits, our Resolution Agent reads the text, queries the web + price feeds with tools, and stamps HIT or MISS on Sui. Its full reasoning is saved on Walrus."
              />
              <HowStep
                n="04"
                title="Reputation builds"
                body="Your hit-rate, calibration, and per-topic accuracy live on Walrus, forever. Every prediction adds to a verifiable track record. Subscribers audit every call."
              />
            </div>
          </div>

          {/* AI agents can use it too */}
          <div className="mt-48">
            <PageEyebrow>For AI agents</PageEyebrow>
            <div
              className="mt-16"
              style={{
                border: '1px solid var(--ink)',
                borderRadius: 4,
                padding: '24px 28px',
                background: 'var(--paper)',
                display: 'grid',
                gap: 18,
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                alignItems: 'center',
              }}
            >
              <div className="col" style={{ gap: 14 }}>
                <h2 className="section">
                  Any MCP-compatible AI agent can seal a prediction here.
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14.5,
                    color: 'var(--ink-3)',
                    lineHeight: 1.55,
                  }}
                >
                  Point Claude Desktop, Cursor, or any AI SDK agent at
                  {' '}
                  <code className="mono" style={{ color: 'var(--ink)' }}>
                    toldproof.xyz/api/mcp/mcp
                  </code>
                  {' '}— they discover the
                  {' '}
                  <code className="mono" style={{ color: 'var(--sealed)' }}>
                    seal_prediction
                  </code>
                  {' '}tool, auto-pay $0.30 USDC on Base via x402, and get
                  back a Sui-verified prediction. No wallet install, no API
                  keys, no account setup. The agent economy&apos;s payment
                  primitive, native to TOLDPROOF.
                </p>
                <p
                  className="mono"
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color: 'var(--muted)',
                    letterSpacing: '0.04em',
                  }}
                >
                  4 free MCP tools also: get_prediction · list_predictions · get_leaderboard · verify_claim
                </p>
              </div>
              <Link href="/pricing" className="btn">
                MCP + pricing →
              </Link>
            </div>
          </div>

          {/* The three guarantees */}
          <div className="mt-48">
            <PageEyebrow>What we prove</PageEyebrow>
            <div
              className="grid-3"
              style={{
                marginTop: 18,
                gap: 0,
                border: '1px solid var(--ink)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <Guarantee
                title="When"
                detail="The exact time you locked it is written on Sui. Nobody can edit it later or change the date."
                glyph="⏱"
              />
              <Guarantee
                title="What"
                detail="A fingerprint of your text is saved before the open date. If even one letter changes, the check fails."
                glyph="≡"
                border
              />
              <Guarantee
                title="Who"
                detail="Locked by your Sui wallet, linked to your X handle. The handle in the tweet is the handle that signed it."
                glyph="ʘ"
              />
            </div>
          </div>

          {/* Bot tease */}
          <div className="mt-48">
            <PageEyebrow>The bot</PageEyebrow>
            <div
              className="mt-16"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 24,
                alignItems: 'center',
              }}
            >
              <h2 className="section">
                Reply{' '}
                <span
                  className="mono"
                  style={{ fontWeight: 500, color: 'var(--sealed)' }}
                >
                  @toldproof verify
                </span>{' '}
                under any &quot;I called it&quot; tweet. The bot replies with a yes or a no.
              </h2>
              <Link href="/bot" className="btn">
                See the bot →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BeforeCard() {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: 18,
        background: 'var(--paper-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Before · how X works today</span>
        <Chip status="warn">After-the-fact</Chip>
      </div>
      <div className="tweet" style={{ background: 'var(--paper)' }}>
        <div className="avatar" style={{ background: 'var(--ink-3)' }}>?</div>
        <div className="grow">
          <div className="tweet-head">
            <span className="name">crypto_oracle_9000</span>
            <span className="handle">@crypto_oracle_9000</span>
            <span className="time">· 2h</span>
          </div>
          <div className="tweet-body">
            Told you last year ETH would do this. Been calling it since 2024.
            Anyone else see this coming? <span className="l">$ETH</span>{' '}
            <span className="l">$SOL</span>
          </div>
        </div>
      </div>
      <p
        className="mono"
        style={{ fontSize: 11, color: 'var(--muted)', margin: 0, lineHeight: 1.55 }}
      >
        No proof. Easy to edit. Could have been posted seconds ago. The loudest
        voice wins by default.
      </p>
    </div>
  );
}

function AfterCard() {
  return (
    <div
      style={{
        border: '1px solid var(--ink)',
        borderRadius: 4,
        padding: 18,
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">After · with toldproof</span>
        <Chip status="verified">Locked {fmtRel(SAMPLE.sealedAtMs)}</Chip>
      </div>
      <div className="tweet">
        <div className="avatar">D</div>
        <div className="grow">
          <div className="tweet-head">
            <span className="name">dewaxindo</span>
            <span className="handle">@dewaxindo</span>
            <span className="time">· {fmtRel(SAMPLE.sealedAtMs)}</span>
          </div>
          <div className="tweet-body">
            Locked prediction. Opens on {fmtAbs(SAMPLE.unlockAtMs).slice(0, 10)}.
            <br />
            <span className="l">
              toldproof.xyz/verify/{shortHash(SAMPLE.id, 6, 4)}
            </span>
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 10.5,
          color: 'var(--muted)',
        }}
      >
        <span>sha256:{SAMPLE.contentHash.slice(0, 18)}…</span>
        <span style={{ textAlign: 'right' }}>walrus:{SAMPLE.blobId.slice(0, 12)}…</span>
      </div>
      {/* Suppress unused-import warning — fakeHexBlock kept for future variants */}
      <span style={{ display: 'none' }}>{fakeHexBlock('x', 1)}</span>
    </div>
  );
}

function HowStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: 18,
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span
          className="mono"
          style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}
        >
          STEP {n}
        </span>
        <span
          style={{
            width: 18,
            height: 18,
            background: 'var(--ink)',
            color: 'var(--paper)',
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 10,
          }}
        >
          {n.slice(1)}
        </span>
      </div>
      <h3 style={{ margin: 0, fontSize: 22, letterSpacing: '-0.01em', fontWeight: 600 }}>
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--ink-3)',
          textWrap: 'pretty',
        }}
      >
        {body}
      </p>
    </div>
  );
}

function Guarantee({
  title,
  detail,
  glyph,
  border = false,
}: {
  title: string;
  detail: string;
  glyph: string;
  border?: boolean;
}) {
  return (
    <div
      style={{
        padding: '24px 22px',
        borderLeft: border ? '1px solid var(--ink)' : 'none',
        borderRight: border ? '1px solid var(--ink)' : 'none',
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div className="row" style={{ gap: 12 }}>
        <span
          style={{
            fontSize: 22,
            fontFamily: 'var(--font-mono), monospace',
            color: 'var(--sealed)',
          }}
        >
          {glyph}
        </span>
        <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {title}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--ink-3)' }}>
        {detail}
      </p>
    </div>
  );
}
